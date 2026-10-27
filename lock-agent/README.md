# Dan & Dor Solar Lock Agent (Android)

A custom **Device Owner** app that is installed on each Android phone sold on an
installment plan. The backend can remotely **lock** (full-screen, un-dismissable)
and **unlock** the phone, and the agent blocks the escape routes (factory reset,
adding users, safe boot). It replaces the old iOS SimpleMDM/Lost Mode mechanism.

> Package: `com.dandorsolar.lockagent` · min Android 8.0 (API 26)

---

## How it works

1. **Enrollment (point of sale).** The phone is **factory reset**, then at the
   welcome screen the staff taps the screen **6 times** to open the QR scanner and
   scans the **enrollment QR** from the admin app (Devices → a sold device →
   *Enroll phone*). Android downloads this agent APK and makes it **Device Owner**.
   The QR carries a one-time `enrollment_token` + the backend URL; the agent calls
   `POST /api/agent/enroll` and receives a device secret.
2. **Normal use.** The agent runs headless. Every ~15 minutes (and on boot, and
   when the app is opened) it calls `POST /api/agent/heartbeat` to read the
   *desired* lock state.
3. **Lock.** When an account goes overdue, the backend sets the desired state to
   `locked`. The agent shows a full-screen Dan & Dor Solar lock (kiosk / lock-task
   mode) that can't be dismissed, and keeps factory reset disabled.
4. **Unlock.** When the customer pays, the backend sets `unlocked`; the agent
   leaves kiosk mode and the phone is normal again.

Locks apply **instantly** if Firebase Cloud Messaging is configured (see below),
otherwise within the ~15-minute poll window.

---

## Build the APK

### Option A — GitHub Actions (recommended)
Run the **“Build Lock Agent APK”** workflow (Actions tab → Run workflow). It
builds `app-release.apk`, prints the **signature checksum** in the run summary,
and uploads the APK + `checksum.txt` as an artifact.

Optional release signing: add repo secrets `KEYSTORE_BASE64` (base64 of your
`.jks`), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`. Without them the APK is
debug-signed, which is fine for testing.

### Option B — Android Studio
Open the `lock-agent/` folder, let Gradle sync, then **Build → Generate Signed
Bundle / APK → APK**. Use a keystore you keep safe (the same keystore must sign
every update, because the signature is pinned in the provisioning QR).

---

## Wire it to the backend (automatic)

The **“Build Lock Agent APK”** workflow commits the built APK and its checksum
into `backend/downloads/`:

- `backend/downloads/dandorsolar-lock-agent.apk`
- `backend/downloads/agent-checksum.txt`

The backend serves the APK from its **own domain** at
`/downloads/dandorsolar-lock-agent.apk` and reads the checksum from that file,
so **you don't need to set `AGENT_APK_URL` or `AGENT_APK_CHECKSUM`** — just
**deploy the backend** after the workflow runs, and the admin “Enroll phone”
screen is ready.

Only set these if you want to change defaults:

```
PUBLIC_BACKEND_URL=https://tritechhub.online   # your domain (used in the QR)
BUSINESS_NAME=Dan & Dor Solar Company Ltd.
BUSINESS_PHONE=+233XXXXXXXXX
AGENT_APK_URL=...        # override to host the APK elsewhere
AGENT_APK_CHECKSUM=...   # override the committed checksum
```

Until the workflow has published the APK + checksum (and you've deployed), the
admin “Enroll phone” screen shows **“not ready.”**

To compute the checksum yourself from an APK:
```bash
apksigner verify --print-certs app-release.apk | grep "SHA-256 digest" | head -1 \
  | awk -F': ' '{print $2}' | tr -d ' :' | xxd -r -p | openssl base64 -A | tr '+/' '-_' | tr -d '='
```

---

## Instant lock with Firebase (optional)

Poll-only already works (locks apply within ~15 min). For **instant** lock/unlock
and fresher location, turn on Firebase Cloud Messaging. **No `google-services.json`
is needed** — the agent initializes Firebase from 4 build-time values, and the
build works with or without them.

**1. Create the Firebase project (free)**
- [console.firebase.google.com](https://console.firebase.google.com) → *Add project*.
- Add an **Android app** with package name `com.dandorsolar.lockagent`.
- Download the generated `google-services.json` (you won't commit it — you just
  read 4 values out of it).

**2. Add these 4 values as GitHub repo secrets**, then re-run the build workflow.
Map them from `google-services.json`:

| GitHub secret | from google-services.json |
|---|---|
| `FIREBASE_APP_ID` | `client[0].client_info.mobilesdk_app_id` (looks like `1:123…:android:abc…`) |
| `FIREBASE_API_KEY` | `client[0].api_key[0].current_key` |
| `FIREBASE_SENDER_ID` | `project_info.project_number` |
| `FIREBASE_PROJECT_ID` | `project_info.project_id` |

**3. On the backend, set `FIREBASE_SERVICE_ACCOUNT`** (so the server can send
pushes): Firebase console → *Project settings → Service accounts → Generate new
private key* → paste that whole JSON into the env var → redeploy.

**4. Re-enroll (or update) phones.** Each phone registers its FCM token on
check-in; after that, Lock/Unlock is delivered in seconds instead of on the poll.

> Needs Google Play Services on the phone (virtually all Samsung/Tecno/Infinix/
> Xiaomi retail phones have it). Phones without it silently stay poll-only.

---

## Test on a device/emulator (without factory reset)

On a **fresh** device/emulator with **no accounts added**, you can set Device
Owner over adb:

```bash
adb install app-release.apk
adb shell dpm set-device-owner com.dandorsolar.lockagent/.LockDeviceAdminReceiver
```

Then enroll by passing the backend URL + a token (generate one from the admin
“Enroll phone” screen) — for a quick manual test you can push them into prefs via
the provisioning flow, or just trigger the QR provisioning on a real reset device.
Use the admin **Lock / Unlock** buttons and watch the phone converge within the
poll window.

> Removing Device Owner for testing: `adb shell dpm remove-active-admin com.dandorsolar.lockagent/.LockDeviceAdminReceiver` (only works while not fully locked down).

---

## Honest limitations

- Device Owner can only be set on a **factory-reset** phone, so enrollment must
  happen **at point of sale**, before the customer adds their Google account.
- A determined customer with unlocked-bootloader tools could still flash the
  phone, but for ordinary retail hire-purchase this gives a real, enforceable
  lock and blocks the common escapes (reset, safe boot, new user).
- Needs testing on a **physical Android phone** — provisioning and kiosk behavior
  vary slightly by manufacturer (Samsung/Tecno/Infinix skins).
