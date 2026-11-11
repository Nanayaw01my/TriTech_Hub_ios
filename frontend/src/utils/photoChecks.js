/**
 * Photo checks for the customer registration form, run on the DSR's phone
 * (no photo leaves the phone for this).
 *
 *  - Same picture used twice (front = back, customer = guarantor …): BLOCK.
 *  - Too dark / too bright / blurry: warn.
 *  - Ghana Card FRONT without a face, or BACK with a big face: warn.
 *  - No face on the customer / guarantor photo: warn.
 *  - Guarantor looks like the customer: warn.
 *  - Customer doesn't look like the Ghana Card photo: warn.
 *
 * Warnings can be overridden by the DSR ("It's correct"); they're then flagged
 * for the admin. Face checks use face-api (models served from /models/face);
 * if they can't load, only the picture checks run.
 */

const MODEL_URL = '/models/face'
let faceApiPromise = null

/** Load face-api and its models once (about 12 MB, cached by the browser). */
export function loadFaceApi() {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      await faceapi.tf.ready()
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])
      return faceapi
    })().catch((e) => {
      faceApiPromise = null // try again next time
      throw e
    })
  }
  return faceApiPromise
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = src
  })
}

/** Draw [img] scaled so its longer side is at most [max] px. */
function scaled(img, max) {
  const r = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height))
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * r))
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * r))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d').drawImage(img, 0, 0, w, h)
  return c
}

function grayOf(canvas) {
  const { width: w, height: h } = canvas
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data
  const g = new Float32Array(w * h)
  for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  return { g, w, h }
}

/** Brightness (0-255) and sharpness (variance of the Laplacian). */
function quality(img) {
  const { g, w, h } = grayOf(scaled(img, 400))
  let sum = 0
  for (let i = 0; i < g.length; i++) sum += g[i]
  const mean = sum / g.length
  let n = 0, m = 0, m2 = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]
      n++
      const delta = lap - m
      m += delta / n
      m2 += delta * (lap - m)
    }
  }
  return { brightness: mean, sharpness: n > 1 ? m2 / (n - 1) : 0 }
}

/** 64-bit difference hash: nearly the same for the same picture, even re-saved. */
function dHash(img) {
  const c = document.createElement('canvas')
  c.width = 9
  c.height = 8
  c.getContext('2d').drawImage(img, 0, 0, 9, 8)
  const { g } = grayOf(c)
  const bits = []
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits.push(g[y * 9 + x] > g[y * 9 + x + 1] ? 1 : 0)
  return bits
}
const hashDistance = (a, b) => a.reduce((s, v, i) => s + (v !== b[i] ? 1 : 0), 0)

/** Faces in the picture, biggest first: { score, heightRatio, descriptor }. */
async function faces(img) {
  const faceapi = await loadFaceApi()
  const inner = scaled(img, 800)
  const opts = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 })
  const detect = async (canvas) => faceapi.detectAllFaces(canvas, opts).withFaceLandmarks(true).withFaceDescriptors()
  let found = await detect(inner)
  if (!found.length) {
    // Close-up selfies, where the face fills the whole frame, are often missed:
    // try again with a border around the picture.
    const pad = Math.round(Math.max(inner.width, inner.height) * 0.2)
    const canvas = document.createElement('canvas')
    canvas.width = inner.width + pad * 2
    canvas.height = inner.height + pad * 2
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(inner, pad, pad)
    found = await detect(canvas)
  }
  return found
    .map((f) => ({
      score: f.detection.score,
      heightRatio: f.detection.box.height / inner.height, // share of the photo's height
      descriptor: Array.from(f.descriptor),
    }))
    .sort((a, b) => b.heightRatio - a.heightRatio)
}
const faceDistance = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0))

/**
 * Analyse one photo. Returns { hash, quality, faces, facesChecked }.
 * facesChecked = false when the face models couldn't load (offline etc.).
 */
export async function analysePhoto(dataUrl) {
  const img = await loadImage(dataUrl)
  const out = { hash: dHash(img), quality: quality(img), faces: [], facesChecked: false }
  try {
    // Don't keep the DSR waiting if the models are slow to download.
    out.faces = await Promise.race([
      faces(img),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000)),
    ])
    out.facesChecked = true
  } catch {
    out.facesChecked = false
  }
  return out
}

const LABEL = {
  ghana_card_front: 'Ghana Card FRONT',
  ghana_card_back: 'Ghana Card BACK',
  customer_photo: 'customer photo',
  guarantor_photo: 'guarantor photo',
}
const ORDER = ['ghana_card_front', 'ghana_card_back', 'customer_photo', 'guarantor_photo']

/**
 * All problems across the photos analysed so far.
 * results: { [field]: analysePhoto() result }.
 * Returns [{ field, code, level: 'block' | 'warn', message }].
 */
export function photoIssues(results) {
  const issues = []
  const add = (field, code, level, message) => issues.push({ field, code, level, message })

  // Picture quality.
  for (const f of ORDER) {
    const r = results[f]
    if (!r) continue
    if (r.quality.brightness < 45) add(f, 'photo_dark', 'warn', 'This photo is too dark. Retake it in better light.')
    else if (r.quality.brightness > 238) add(f, 'photo_bright', 'warn', 'This photo is too bright (glare). Retake it without the flash or glare.')
    if (r.quality.sharpness < 20) add(f, 'photo_blurry', 'warn', 'This photo looks blurry. Hold the phone still and retake it.')
  }

  // The same picture used twice: always wrong.
  for (let i = 0; i < ORDER.length; i++) {
    for (let j = i + 1; j < ORDER.length; j++) {
      const a = results[ORDER[i]]
      const b = results[ORDER[j]]
      if (a && b && hashDistance(a.hash, b.hash) <= 5) {
        const msg = ORDER[j] === 'ghana_card_back' && ORDER[i] === 'ghana_card_front'
          ? 'This is the same picture as the Ghana Card FRONT. Turn the card over and snap the BACK.'
          : ORDER[j] === 'guarantor_photo' && ORDER[i] === 'customer_photo'
            ? 'This is the same picture as the customer photo. Snap the GUARANTOR, not the customer.'
            : `This is the same picture as the ${LABEL[ORDER[i]]}. Snap the ${LABEL[ORDER[j]]}.`
        add(ORDER[j], 'same_picture', 'block', msg)
      }
    }
  }

  const front = results.ghana_card_front
  const back = results.ghana_card_back
  const cust = results.customer_photo
  const guar = results.guarantor_photo

  // Ghana Card sides: the front has the holder's photo; the back doesn't.
  if (front?.facesChecked && front.faces.length === 0) {
    add('ghana_card_front', 'front_no_face', 'warn',
      "No face found on this card photo — it may be the BACK. Snap the FRONT (the side with the person's picture), close and clear.")
  }
  if (back?.facesChecked && back.faces.some((f) => f.score >= 0.6 && f.heightRatio >= 0.1)) {
    add('ghana_card_back', 'back_has_face', 'warn',
      "This looks like the FRONT of the card (it has the person's picture). Turn the card over and snap the BACK.")
  }

  // People photos must show a face.
  if (cust?.facesChecked && cust.faces.length === 0) {
    add('customer_photo', 'customer_no_face', 'warn', "No face found. Snap the customer's face clearly, facing the camera.")
  }
  if (guar?.facesChecked && guar.faces.length === 0) {
    add('guarantor_photo', 'guarantor_no_face', 'warn', "No face found. Snap the guarantor's face clearly, facing the camera.")
  }

  // Guarantor must be a different person.
  const custFace = cust?.faces?.[0]?.descriptor
  const guarFace = guar?.faces?.[0]?.descriptor
  const cardFace = front?.faces?.[0]?.descriptor
  if (guarFace && ((custFace && faceDistance(guarFace, custFace) < 0.5) || (cardFace && faceDistance(guarFace, cardFace) < 0.5))) {
    add('guarantor_photo', 'guarantor_same_as_customer', 'warn',
      'This looks like the SAME PERSON as the customer. The guarantor must be someone else — snap the guarantor.')
  }

  // Customer should be the Ghana Card holder (lenient: card photos are small).
  if (custFace && cardFace && faceDistance(custFace, cardFace) > 0.72) {
    add('customer_photo', 'customer_card_mismatch', 'warn',
      "The customer's face doesn't seem to match the photo on the Ghana Card. Check you have the right person and the right card.")
  }

  // A blocked photo must be retaken anyway: don't pile warnings on top.
  const blocked = new Set(issues.filter((i) => i.level === 'block').map((i) => i.field))
  return issues.filter((i) => i.level === 'block' || !blocked.has(i.field))
}

/** Stable key for an issue, used to remember the DSR's "It's correct". */
export const issueKey = (i) => `${i.field}:${i.code}`
