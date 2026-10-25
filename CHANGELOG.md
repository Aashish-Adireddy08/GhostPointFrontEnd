# Changes

## 1.1.0 — 2026-10-25

- Add the authenticated iPhone HUD broadcast viewer, server deployment scripts and native app integration patch.
- Display a consistent version in the HUD viewer and dashboard, plus the source commit in the HUD viewer.
- Generate `version.json` with release version, source commit and UTC build time; prevent caching of the entry page and version manifest.
- Deploy the FrontEnd branch build as a separate server release while preserving media services, credentials and the HTTPS hostname.

Synthetic remote video playback and cleanup are verified. Actual iPhone HUD capture and restrictive-network TURN connectivity remain unverified.
