# HUD broadcast: implementation and device acceptance

Status on 2026-10-25: native source implemented, not compiled or installed on an iPhone here. Actual ReplayKit capture of every HUD layer remains UNVERIFIED and is a release blocker. Testing the original repository does not validate this change. Windows cannot run Xcode, sign the app, or access your physical iPhone.

The supplied `C:\Users\gmarc\dev\Gatorhack` path was absent. Work was done in a clean clone of https://github.com/GatorHackV-Ghostpoint/uwbhud at `4eceb62ea6169c1174896cd67eee80716c9df9a7`, beside the existing browser frontend. Nothing was committed or pushed.

## Minimal path

ReplayKit app-screen sample buffers -> native RTCCVPixelBuffer/RTCVideoFrame -> send-only WebRTC video track -> authenticated HTTPS WHIP -> MediaMTX -> existing browser WHEP receiver.

Camera capture, markers, native tags, peer discovery, ranging, pose alignment, person snapping and their files are unchanged. No camera-only substitute, FFmpeg, GStreamer, view screenshot loop, audio track, recording file or JS video buffers were added. ReplayKit app/microphone audio samples are discarded; the microphone and ReplayKit camera are explicitly disabled. All currently visible app UI, including broadcast controls, is intended to appear in capture. Screen capture stops on Stop, app background, module destruction, capture error, or failed/timed-out media connection. It requires foreground use and system screen-capture consent.

The pinned CocoaPods dependency is `WebRTC-lib 154.0.0`, added to the existing local Expo module podspec. Its CocoaPods registry spec declares iOS 15.0 minimum; this app already targets 16.4. It provides native Objective-C/Swift APIs without depending on React Native version or its bridge architecture. This avoids adding a React Native WebRTC wrapper to Expo 58 / React Native 0.88. No existing JS dependency version or lockfile was changed. Registry compatibility and TypeScript checks do not prove CocoaPods/Xcode linkage.

References checked:
- https://github.com/CocoaPods/Specs/blob/master/Specs (WebRTC-lib 154.0.0 registry spec)
- https://github.com/stasel/WebRTC/tree/154.0.0
- https://docs.expo.dev/versions/v58.0.0/
- https://docs.expo.dev/modules/module-api/
- https://developer.apple.com/documentation/replaykit/rpscreenrecorder/startcapture(handler:completionhandler:)

## Build/install on your Mac (required; NOT executed here)

1. Preserve any existing local changes on your Mac. Use the provided source archive as a separate checkout, or apply only the six changed/new app files against the base revision above. Do not overwrite unrelated work. The archive contains no `.git`, dependencies, signing files or runtime secrets.
2. Install the repository's locked JS dependencies:
   ```sh
   npm ci
   npx tsc --noEmit
   npx expo lint
   ```
3. Generate native projects and resolve pods, with Xcode and CocoaPods installed:
   ```sh
   npx expo prebuild --platform ios
   ```
   Inspect the CocoaPods output and `ios/Podfile.lock`: `UwbAr` must resolve `WebRTC-lib (154.0.0)`. Resolve any signing/build errors before proceeding. Native module code cannot run in Expo Go; create a new development build. Do not copy generated `ios/` into source control.
4. Connect/unlock a UWB-capable physical iPhone, enable Developer Mode, choose the correct Apple development team, and run:
   ```sh
   npx expo run:ios --device
   ```
   Alternatively open the generated `ios/*.xcworkspace` in Xcode, select the physical iPhone and development team, then Build and Run. An existing valid bundle identifier/team provisioning is required. No signing credentials are included here. For cloud builds, follow this repo's EAS workflow with your own Apple credentials; none was initiated from this machine.

## First acceptance gate: every HUD layer

On your test iPhone enter:

- WHIP URL: `https://parents-costumes-eco-threshold.trycloudflare.com/media/hud/whip`
- Publishing password: obtain privately over SSH using the command below; username `hud-publisher` is supplied by native code.

On an authorized machine:
```sh
ssh aashish@64.177.50.116 'cat /home/aashish/.local/share/ghostpoint-frontend/releases/hud-20261025/runtime/credentials.json'
```
Keep this output private. Do not paste it into source, build environment variables, client bundles, issue trackers or chat. It contains separate `publish_password` and `view_password` values. These are broadcast credentials, unrelated to SSH key passphrases or Linux account passwords.

1. Pair with another UWB-capable iPhone so markers/tags actually render; do not simulate success by showing only the camera. Start Broadcast and accept iOS capture consent.
2. On a browser open `https://parents-costumes-eco-threshold.trycloudflare.com/?hud=1`. Authenticate as `hud-viewer` with `view_password`, then click Watch broadcast.
3. Compare the physical phone and browser side by side. Verify the moving camera background, RealityKit marker dots, native name/distance tags, and React Native name/status cards. Move a peer off screen to verify RN arrows and their labels; exercise stale/waiting states to verify bottom cards. All four layers must be visible in the received video, correctly aligned and oriented, without cropped top/bottom edges.
4. If any layer is black, absent, stale independently of the phone, or cropped, STOP: the goal has not been met. Save the iOS version/device, Xcode build error or a consented screen comparison and investigate before reporting success. No camera-only fallback is included.
5. Verify UWB updates, discovery/reconnection, alignment and person snapping still behave as before with broadcasting on and off.
6. Stop Broadcast. The browser must stop receiving new frames; restarting should create a fresh session. Repeat rapid Start/Stop, deny capture permission, use a wrong publishing password, background the app and interrupt networking. Capture/resources should stop with an error/status; no microphone use or recording file should appear. Re-enter the foreground and Start explicitly; there is no automatic background broadcast.

## Actual checks performed here

- App: `npm ci --ignore-scripts`, TypeScript `tsc --noEmit`, ESLint: passed. No iOS compilation, CocoaPods resolution, signing, installation or ReplayKit/device test was possible here.
- Browser frontend: production build passed in a separate `.local/hud-dist` directory; five pre-existing WHIP/WHEP unit tests passed.
- Server proxy: three authentication/role separation, routing and Location-rewriting tests passed locally and on Vultr.
- Actual Chrome -> HTTPS WHIP -> Vultr MediaMTX -> HUD viewer smoke test passed using a changing SYNTHETIC portrait canvas. Received 291x633 video, both top and bottom test bands present, selected public UDP media candidate. Viewer stop and explicit WHIP DELETE passed. This proves transport/playback only.
- A repeated check exposed a first-frame startup race; the HUD viewer was fixed to wait/retry when MediaMTX reports no stream yet. User service lingering was enabled and verified for persistence after SSH logout.
- Before administrator firewall changes, public media timed out. After the administrator opened inbound UDP/TCP 18200, the external UDP video test passed. TURN has not been provided or configured. Restrictive networks that block direct UDP/TCP media remain unsupported/unverified.

The Quick Tunnel HTTPS hostname is temporary and changes on tunnel restart. Check `runtime/https-url` against the current `runtime/https.log` and use its origin for both endpoints. Do not assume this demo hostname is durable hosting.
