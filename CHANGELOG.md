# Changes

## 1.6.0 — 2026-10-25

- Improve the native waypoint picker with explicit horizontal/vertical plane detection, supported LiDAR mesh reconstruction, multiple raycast targets and a nearby visual-feature fallback.
- Add explicit distance placement for undetected surfaces, with estimated-placement labels and persistent failure feedback.
- Add optional shared waypoint names, rename controls on phone/dashboard, and a dedicated selected-phone Clear waypoint button after placement.
- Enforce name validation and phone clear/rename permission on the server; preserve the one-waypoint limit.
- Ship both an incremental waypoint-improvements patch and the updated full shared-waypoint patch. Native compilation and physical surface testing remain unverified.

## 1.5.0 — 2026-10-25

- Add dashboard selection of the one phone permitted to place a shared waypoint, plus revoke and clear controls.
- Enforce one waypoint and one session-scoped placement grant on the server. New placement replaces the previous point; stale/reused sessions do not inherit permission.
- Add an incremental native patch for tap-to-surface raycasting and a distinct amber diamond/orange marker with a WAYPOINT distance label, mapped through the existing peer AR alignment.
- Native compilation, physical placement/alignment and ReplayKit layer verification remain required on iPhones.

## 1.4.1 — 2026-10-25

- Fix token generation when running the proxy as a standalone service.
- Send explicit JSON bodies for phone assignment requests through the HTTPS tunnel.

## 1.4.0 — 2026-10-25

- Add hud3/hud4 with independent MediaMTX paths and publish/read permissions.
- Automatically discover live phones and adjust the dashboard from zero to four panels; live mode opens by default (`?hud=0` retains simulation entry).
- Add atomic free-slot allocation, capacity errors, reservation expiry/release, and a loopback-only MediaMTX status API.
- Include an incremental iPhone controls patch based on native commit 4768c24: built-in server, no pasted URL, automatic slot assignment on Start Broadcast. Capture remains opt-in.
- Add allocator tests and a four-publisher end-to-end synthetic transport/layout test. Physical iPhone capture remains unverified.

## 1.3.0 — 2026-10-25

- Apply the supplied two-phone server patch: permit `hud` and `hud2` WHIP/WHEP routes, session deletion, and MediaMTX publish/read permissions.
- Connect both integrated dashboard panels independently, labeled Phone 1 and Phone 2. A missing publisher waits without blocking the other panel.
- Add a two-publisher external smoke test with distinct portrait frames and independent stop/cleanup checks.
- Native named-stream support is available in uwbhud branch `iphone-hud-broadcast`, commit `4768c24` (Allow broadcast stream name in WHIP URL). Actual physical phone capture remains a device acceptance check.

## 1.2.0 — 2026-10-25

- Display the iPhone broadcast inside the original Ghostpoint command dashboard instead of a separate plain viewer.
- Add Watch phone broadcast to the original page; the existing `?hud=1` link opens the same dashboard and starts waiting for the phone automatically.
- Focus the first camera panel for the single iPhone stream; leave the second slot idle. Preserve the entire portrait frame above the panel's label strip.
- Wait for the phone publisher when no stream exists yet. Preserve the original simulation and webcam modes, with no login requirements added.

## 1.1.1 — 2026-10-25

- Remove client login requirements from the test viewer and WHIP/WHEP routes.
- Remove the publishing password input from the iPhone controls; only the HTTPS URL is required.
- Test public viewing/publishing in a fresh browser context without credentials. HTTPS and internal loopback MediaMTX credentials remain implementation details; users do not need them.

## 1.1.0 — 2026-10-25

- Add the authenticated iPhone HUD broadcast viewer, server deployment scripts and native app integration patch.
- Display a consistent version in the HUD viewer and dashboard, plus the source commit in the HUD viewer.
- Generate `version.json` with release version, source commit and UTC build time; prevent caching of the entry page and version manifest.
- Deploy the FrontEnd branch build as a separate server release while preserving media services, credentials and the HTTPS hostname.

Synthetic remote video playback and cleanup are verified. Actual iPhone HUD capture and restrictive-network TURN connectivity remain unverified.
