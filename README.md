# GhostPoint Command

React frontend for viewing two iPhone camera streams through a cloud WebRTC gateway. The attached brief is product context only: this does not implement the Flutter/UWB application.

## Local webcam demo

A working local MediaMTX configuration and webcam publisher are included. The complete webcam demo currently targets **Windows x64**, with **Node.js 22 or newer**, npm, Git, and a webcam. Chrome or Edge is recommended. From a fresh clone, run these commands in the repository directory:

```powershell
npm install
powershell -NoProfile -ExecutionPolicy Bypass -File .\local-demo\install-mediamtx.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\local-demo\start-demo.ps1
```

The execution policy option applies only to those individual PowerShell processes; it does not change the machine's saved policy. Review the scripts before running them. The installer downloads the official MediaMTX release and verifies its SHA-256 checksum.

Open `http://127.0.0.1:5174` and click **Start webcam demo**, then allow camera access. Both panels display the same webcam; the microphone is off. Click **Stop webcam** to stop capture. Keep the launcher terminal open, and press Ctrl+C there to stop the servers. See [local-demo/README.md](local-demo/README.md) for details and troubleshooting.

The video actually goes through a local MediaMTX server: browser webcam capture → WHIP → MediaMTX → two WHEP playback connections → dashboard. WebRTC TCP fallback is enabled for local browsers where UDP fails. The iPhone/GStreamer RTP/UDP path below remains a separate integration. MediaMTX is installed locally rather than committed; webcam images, recordings, machine settings, node_modules, and build output are excluded from the repository.

## Run locally

```sh
npm install
npm run dev
```

Production build: `npm run build` (output: `dist/`). Nothing is pushed or deployed automatically.

## Connect cameras

The transport path is **iPhone H.264 → RTP/UDP → cloud GStreamer receiver → WebRTC gateway → React**. A web browser cannot bind raw UDP ports. Each camera needs a separate WHEP playback endpoint, e.g. `https://gateway.example.com/alpha/whep` and `/bravo/whep`.

Open connection settings, save both URLs, and click **Connect gateway**. Demo mode is explicitly synthetic and includes no actual camera or UWB data. Real mode shows measured inbound frame rate and bitrate; it does not invent agent locations. Focus view expands one feed. Disconnect releases peer connections and requests WHEP resource deletion when the server returns a Location header.

The cloud server and iPhone capture app are not included. The local webcam demo has been verified with live video in both panels; iPhone/cloud ingest has not been tested. The cloud gateway must:

- Receive two distinct RTP/H.264 streams on configured ports (UI defaults are 5000 and 5002).
- Match payload types, codec parameters, packetization, and SPS/PPS emitted by the iPhone sender.
- Bridge media to WebRTC using GStreamer's `webrtcbin` or a compatible media server.
- Implement WHEP POST (SDP offer → SDP answer), resource Location, and DELETE.
- Allow viewer origin via CORS, allow Content-Type and POST/DELETE, expose Location, and handle OPTIONS.
- Provide HTTPS and suitable ICE candidates/firewall rules. Cross-network use may require TURN; add short-lived ICE server configuration to `openStream` in `src/stream.js` through your authenticated backend. Never ship permanent TURN credentials in source.

Illustrative receiver diagnostic (not the WebRTC bridge):

```sh
gst-launch-1.0 udpsrc port=5000 caps="application/x-rtp,media=video,encoding-name=H264,payload=96,clock-rate=90000" ! rtpjitterbuffer latency=100 ! rtph264depay ! h264parse ! avdec_h264 ! fakesink
```

Use a second pipeline on port 5002. In your production gateway replace the diagnostic decode/sink with the gateway-specific RTP/WebRTC media path. Transport/authentication, iOS capture, and gateway configuration need integration on your actual server. Endpoint URLs are stored locally; no tokens are collected by this prototype. Automatic reconnect is not implemented; disconnect and connect to retry.

References: [GStreamer webrtcbin](https://gstreamer.freedesktop.org/documentation/webrtc/), [WHEP draft](https://datatracker.ietf.org/doc/draft-ietf-wish-whep/), [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API).
