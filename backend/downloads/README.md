# Public downloads

Files here are served by the backend at `/downloads/...` on your own domain
(e.g. `https://tritechhub.online/downloads/dandorsolar-lock-agent.apk`).

The **“Build Lock Agent APK”** GitHub Action writes two files here and commits
them back to the branch:

- `dandorsolar-lock-agent.apk` — the signed lock-agent app the enrollment QR
  installs.
- `agent-checksum.txt` — the APK's signing-certificate checksum. The backend
  reads this automatically, so you don't need to set `AGENT_APK_CHECKSUM`.

With these present, the admin **Enroll phone** screen is ready and the QR points
at this app's own `/downloads/dandorsolar-lock-agent.apk`.
