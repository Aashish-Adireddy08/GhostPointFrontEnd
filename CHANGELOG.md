# Changes

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
