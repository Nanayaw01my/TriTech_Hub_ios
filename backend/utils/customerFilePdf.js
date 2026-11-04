/**
 * Customer file PDF: everything recorded for one customer, in one document.
 * Details the DSR filled in, guarantor, consents, phone & plan, payments,
 * and every photo taken at registration (Ghana Card, customer, guarantor,
 * signature, proof of income).
 */
const PDFDocument = require('pdfkit');
const logger = require('./logger');

const ORANGE = '#EA580C';
const DARK = '#111827';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const MARGIN = 50;

const dateStr = (d, withTime = false) => {
  if (!d) return null;
  const x = new Date(d);
  if (isNaN(x)) return null;
  return withTime
    ? x.toLocaleString('en-GH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : x.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
};
const ghs = (n) => (n === null || n === undefined || n === '' ? null : `GHS ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`);
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1).replace(/_/g, ' ') : null);
const yesNo = (b) => (b ? 'Yes' : 'No');
const METHOD = { manual_cash: 'Cash (office)', manual_momo: 'MoMo (office)', manual_bank: 'Bank transfer' };

/**
 * Load an image as a JPEG/PNG buffer pdfkit can draw. Cloudinary images are
 * converted to JPEG on the fly (a PDF upload comes back as its first page).
 * Returns null if it can't be loaded.
 */
async function loadImage(src) {
  if (!src || typeof src !== 'string') return null;
  try {
    if (src.startsWith('data:')) {
      const m = src.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
      return m ? Buffer.from(m[2], 'base64') : null;
    }
    let url = src;
    if (/res\.cloudinary\.com\/.+\/image\/upload\//.test(url)) {
      const isPdf = /\.pdf(\?|$)/i.test(url);
      url = url.replace('/image/upload/', `/image/upload/f_jpg,b_white,q_80,w_1200,c_limit${isPdf ? ',pg_1' : ''}/`);
      if (isPdf) url = url.replace(/\.pdf(\?|$)/i, '.jpg$1');
    }
    const get = async (u) => {
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
      const isPng = buf[0] === 0x89 && buf[1] === 0x50;
      return isJpg || isPng ? buf : null;
    };
    // Converted copy first; if that fails, the original file as uploaded.
    return (await get(url).catch(() => null)) || (url !== src ? await get(src) : null);
  } catch (e) {
    logger.warn('[customer-file] image not loaded: %s', e.message);
    return null;
  }
}

/**
 * Stream the customer's file PDF to `res`.
 * data = { customer, plan, payments, settings }
 */
async function writeCustomerFile(res, { customer, plan, payments, settings }) {
  const c = customer;
  const ph = c.photos || {};
  const device = plan?.device_id || null;
  const business = settings?.business_name || 'Dan & Dor Solar Company Ltd.';

  // Fetch the photos first so a slow one doesn't stall the stream halfway.
  const photoList = [
    ['Customer photo', ph.customer_photo],
    ['Ghana Card (front)', ph.ghana_card_front],
    ['Ghana Card (back)', ph.ghana_card_back],
    ['Guarantor photo', ph.guarantor_photo],
    ['Customer signature', ph.signature],
    ['Proof of income', c.proof_of_income],
  ];
  const images = await Promise.all(photoList.map(([, src]) => loadImage(src)));

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true, info: { Title: `Customer file - ${c.full_name}`, Author: business } });
  const safeName = String(c.full_name || 'customer').replace(/[^\w-]+/g, '-');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="customer-file-${safeName}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);

  const W = doc.page.width - MARGIN * 2;
  const bottom = () => doc.page.height - MARGIN - 20;
  const ensure = (h) => { if (doc.y + h > bottom()) doc.addPage(); };

  // ── Header ──
  doc.rect(0, 0, doc.page.width, 80).fill(ORANGE);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(20).text(business, MARGIN, 22, { width: W - 140 });
  doc.font('Helvetica').fontSize(10).text('Customer File', MARGIN, 50);
  const contact = settings?.contact_phone ? `Tel: ${settings.contact_phone}` : '';
  if (contact) doc.fontSize(9).text(contact, doc.page.width - MARGIN - 160, 28, { width: 160, align: 'right' });
  doc.y = 96;

  // Customer photo next to the name, if we have it.
  const top = doc.y;
  let textX = MARGIN;
  if (images[0]) {
    try {
      doc.image(images[0], MARGIN, top, { fit: [90, 110], align: 'center', valign: 'center' });
      doc.rect(MARGIN, top, 90, 110).strokeColor(LINE).lineWidth(1).stroke();
      textX = MARGIN + 105;
    } catch (_) { /* unreadable image: skip */ }
  }
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(18).text(c.full_name || '—', textX, top + 4, { width: W - (textX - MARGIN) });
  doc.font('Helvetica').fontSize(10).fillColor(MUTED)
    .text(`Account ${c.user_id?.account_number || '—'}   ·   Registered ${dateStr(c.createdAt, true) || '—'}`, textX, doc.y + 4, { width: W - (textX - MARGIN) });
  if (plan?.status) {
    doc.text(`Plan status: ${cap(plan.status)}${device?.lock_status ? `   ·   Phone: ${cap(device.lock_status)}` : ''}`, textX, doc.y + 2, { width: W - (textX - MARGIN) });
  }
  if (c.deleted_at) doc.fillColor('#b91c1c').text(`Deleted on ${dateStr(c.deleted_at, true)}`, textX, doc.y + 2);
  doc.y = Math.max(doc.y, images[0] ? top + 110 : doc.y) + 14;

  // ── Helpers ──
  const section = (title) => {
    ensure(50);
    doc.moveDown(0.6);
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(13).text(title, MARGIN, doc.y);
    const y = doc.y + 2;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + W, y).strokeColor(ORANGE).lineWidth(1.5).stroke();
    doc.y = y + 8;
  };
  // Two label/value pairs per line.
  const rows = (pairs) => {
    const list = pairs.filter(Boolean);
    const colW = W / 2;
    const labelW = 110;
    const valW = colW - labelW - 10;
    doc.fontSize(10);
    for (let i = 0; i < list.length; i += 2) {
      const pair = [list[i], list[i + 1]].filter(Boolean);
      const h = Math.max(...pair.map(([, v]) => doc.font('Helvetica').heightOfString(String(v ?? '—'), { width: valW }))) + 6;
      ensure(h);
      const y = doc.y;
      pair.forEach(([label, value], j) => {
        const x = MARGIN + j * colW;
        doc.font('Helvetica').fillColor(MUTED).text(label, x, y, { width: labelW });
        doc.fillColor(DARK).text(value === null || value === undefined || value === '' ? '—' : String(value), x + labelW, y, { width: valW });
      });
      doc.y = y + h;
    }
  };

  // ── Customer ──
  section('Customer details');
  rows([
    ['Full name', c.full_name],
    ['Phone', c.phone],
    ['Email', c.email],
    ['Ghana Card no.', c.ghana_card_id],
    ['Occupation', c.occupation],
    ['Income', [ghs(c.income?.amount), c.income?.source].filter(Boolean).join(' · ') || null],
    ['Account number', c.user_id?.account_number],
    ['Login active', c.user_id ? yesNo(c.user_id.is_active !== false) : null],
  ]);

  section('Address');
  rows([
    ['Region', c.location?.region],
    ['District', c.location?.district],
    ['Town', c.location?.town],
    ['Landmark', c.location?.landmark],
    ['GPS address', c.location?.gps_address],
  ]);

  section('Guarantor');
  rows([
    ['Full name', c.guarantor?.full_name],
    ['Phone', c.guarantor?.phone],
    ['Ghana Card no.', c.guarantor?.ghana_card_id],
    ['Relationship', c.guarantor?.relationship],
  ]);

  section('Registered by');
  rows([
    ['DSR', c.created_by?.name],
    ['Staff ID', c.created_by?.staff_id],
    ['DSR email', c.created_by?.email],
    ['Branch', c.created_by?.branch],
    ['Registered on', dateStr(c.createdAt, true)],
    ['Last updated', dateStr(c.updatedAt, true)],
  ]);

  section('Customer agreed to');
  const k = c.consents || {};
  rows([
    ['Terms & agreement', yesNo(k.terms)],
    ['Is 18 or older', yesNo(k.adult)],
    ['Phone is managed', yesNo(k.device_management)],
    ['Late fee per day', ghs(k.late_fee_per_day)],
    ['Agreed on', dateStr(k.accepted_at, true)],
    c.deletion_requested_at ? ['Data deletion asked', dateStr(c.deletion_requested_at, true)] : null,
  ]);

  // ── Phone & plan ──
  if (plan) {
    section('Phone');
    rows([
      ['Model', device?.model],
      ['IMEI', device?.imei],
      ['Serial number', device?.serial_number],
      ['Lock status', cap(device?.lock_status)],
      ['App version', device?.agent?.app_version],
      ['Last check-in', dateStr(device?.agent?.last_heartbeat, true)],
    ]);

    section('Plan');
    const paidCount = plan.payments_made ?? null;
    rows([
      ['Price', ghs(plan.total_price)],
      ['Deposit', `${ghs(plan.down_payment) || '—'}${plan.down_payment_paid ? ' (paid)' : ' (not paid)'}`],
      ['Plan', `${plan.total_payments || '—'} ${plan.frequency || ''} payments`],
      ['Each payment', ghs(plan.installment_amount)],
      ['Payments made', paidCount !== null ? `${paidCount} of ${plan.total_payments}` : null],
      ['Balance left', ghs(plan.remaining_balance)],
      ['Late fees owed', ghs(plan.penalty_balance || 0)],
      ['Late fees total', ghs(plan.penalties_total || 0)],
      ['Status', cap(plan.status)],
      ['Approved on', dateStr(plan.approved_at, true)],
      ['Started on', dateStr(plan.activated_at || plan.start_date, true)],
      ['Next due', dateStr(plan.next_due_date)],
      ['Ends', dateStr(plan.end_date)],
      plan.closed_at ? ['Closed on', dateStr(plan.closed_at, true)] : null,
      plan.close_reason ? ['Close reason', cap(plan.close_reason)] : null,
      plan.review_note ? ['Review note', plan.review_note] : null,
    ]);
  } else {
    section('Plan');
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('No plan recorded for this customer.', MARGIN, doc.y);
  }

  // ── Payments ──
  section(`Payments (${payments.length})`);
  if (!payments.length) {
    doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('No payments yet.', MARGIN, doc.y);
  } else {
    const cols = [
      ['Date', 100], ['Amount', 70], ['Method', 80], ['Reference', 120], ['Note', W - 370],
    ];
    const header = () => {
      ensure(40);
      const y = doc.y;
      doc.rect(MARGIN, y, W, 18).fill('#f3f4f6');
      let x = MARGIN + 4;
      doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9);
      cols.forEach(([h, w]) => { doc.text(h, x, y + 5, { width: w - 6 }); x += w; });
      doc.y = y + 22;
    };
    header();
    doc.font('Helvetica').fontSize(9);
    payments.forEach((p, i) => {
      if (doc.y + 16 > bottom()) { doc.addPage(); header(); doc.font('Helvetica').fontSize(9); }
      const y = doc.y;
      if (i % 2 === 1) doc.rect(MARGIN, y - 2, W, 15).fill('#f9fafb');
      const vals = [
        dateStr(p.payment_date || p.createdAt, true) || '—',
        ghs(p.amount) || '—',
        METHOD[p.payment_method] || 'Paystack',
        p.paystack_reference || '—',
        p.notes || '—',
      ];
      let x = MARGIN + 4;
      doc.fillColor(DARK);
      cols.forEach(([, w], j) => { doc.text(vals[j], x, y, { width: w - 6, lineBreak: false, ellipsis: true }); x += w; });
      doc.y = y + 15;
    });
    const total = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE).text(`Total paid: ${ghs(total)}`, MARGIN, doc.y, { width: W, align: 'right' });
  }

  // ── Photos ──
  const pics = photoList
    .map(([label, src], i) => ({ label, src, img: images[i] }))
    .filter((p) => p.src);
  if (pics.length) {
    doc.addPage();
    section('Photos & documents');
    const boxW = (W - 20) / 2;
    const boxH = 230;
    let col = 0;
    let rowY = doc.y;
    pics.forEach((p) => {
      if (col === 0 && rowY + boxH + 20 > bottom()) { doc.addPage(); rowY = MARGIN; }
      const x = MARGIN + col * (boxW + 20);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text(p.label, x, rowY, { width: boxW });
      const iy = rowY + 16;
      doc.rect(x, iy, boxW, boxH).strokeColor(LINE).lineWidth(1).stroke();
      let drawn = false;
      if (p.img) {
        try { doc.image(p.img, x + 4, iy + 4, { fit: [boxW - 8, boxH - 8], align: 'center', valign: 'center' }); drawn = true; } catch (_) { /* skip */ }
      }
      if (!drawn) {
        doc.font('Helvetica').fontSize(9).fillColor(MUTED)
          .text('Could not show this file here. Open it with the link:', x + 10, iy + 20, { width: boxW - 20 });
        if (/^https?:/i.test(p.src)) {
          doc.fillColor(ORANGE).text(p.src, x + 10, doc.y + 4, { width: boxW - 20, link: p.src, underline: true });
        }
      }
      col = (col + 1) % 2;
      if (col === 0) rowY = iy + boxH + 20;
    });
  }

  // ── Footer on every page ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Writing below the bottom margin would make pdfkit add a new page.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - MARGIN + 10;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED)
      .text(`${business} · Customer file · ${c.full_name} · Generated ${dateStr(new Date(), true)} · Confidential`, MARGIN, y, { width: W - 60, lineBreak: false });
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, MARGIN + W - 60, y, { width: 60, align: 'right', lineBreak: false });
  }

  doc.end();
}

module.exports = { writeCustomerFile, loadImage };
