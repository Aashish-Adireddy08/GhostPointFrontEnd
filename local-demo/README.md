# Local webcam demo

The computer runs MediaMTX, a real media gateway. The browser captures the webcam (video only), publishes it to MediaMTX using WHIP, and receives it back over two independent WHEP viewer connections. Both dashboard panels show the same webcam. No recording is enabled. The media server listens only on loopback and cannot be reached from other computers.

This demo uses WebRTC for capture/upload instead of GStreamer. It proves the server-to-dashboard playback path. It does not test raw RTP/UDP ingest from iPhones.

## Start

From the ghostpoint project directory, run:

```powershell
npm install
powershell -NoProfile -ExecutionPolicy Bypass -File .\local-demo\install-mediamtx.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\local-demo\start-demo.ps1
```

Open http://127.0.0.1:5174 in Chrome or Edge. Click **Start webcam demo**, allow camera access, and wait for **Publisher: connected**. Both camera panels should then show video received from the server. **Stop webcam** releases the webcam and all demo connections. Closing or reloading the page also ends capture. Microphone access is not requested.

If permission is declined, use the browser's site settings to allow camera access. Close other apps using the webcam if it is busy. Keep this tab open during the demo. The synthetic **Demo mode** button is separate from the real webcam demo; stop the webcam before switching modes.

## Installed dependency

MediaMTX v1.21.2 for Windows x64 is downloaded from its official GitHub release into `.local/mediamtx/` (ignored by Git). Its release archive is checked against the official SHA-256 checksums before extraction. To install manually, download the Windows amd64 ZIP from https://github.com/bluenviron/mediamtx/releases/tag/v1.21.2 and extract into that directory. The included license remains alongside the executable.

The supplied install/start scripts require Windows x64 and Node.js 22+. The React frontend and MediaMTX also support other operating systems, but macOS/Linux launch scripts are not included. On those platforms install the corresponding official MediaMTX binary, run it with `local-demo/mediamtx.yml`, and start Vite with `npm run dev -- --port 5174 --strictPort` in another terminal. macOS/Linux webcam operation has not been verified in this project.

Ports: dashboard TCP 5174, WHIP/WHEP HTTP TCP 8889, WebRTC UDP and TCP 8189, local diagnostic API TCP 9997. All bind to 127.0.0.1. TCP provides a fallback for browsers where the loopback UDP connection fails, including the in-app browser used for testing. No router forwarding, firewall changes, cloud account, or TURN server is required.

To stop everything, click **Stop webcam**, then press Ctrl+C in the launcher terminal. The launcher stops the MediaMTX process it created. If servers were started separately, stop their individual terminal sessions.
