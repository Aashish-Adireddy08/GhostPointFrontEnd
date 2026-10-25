# One shared waypoint, one authorized phone

## Updated selection, clear and names (1.6.0)

**Already installed the original waypoint patch?** Apply only `waypoint-improvements.patch` to that app source, then rebuild/install. **No waypoint code yet?** Apply the updated `shared-waypoint.patch` after `auto-four-streams.patch`. Do not apply both waypoint patches to the same source. Preserve work and run `git apply --check` first. The incremental patch targets the previous shared-waypoint source and changes four files: WaypointControls.tsx, WaypointOverlay.swift, UwbArModule.swift, UwbArView.swift.

```sh
# For an app that already has the original waypoint feature:
git apply --check /path/to/GhostPointFrontEnd/iphone-hud/waypoint-improvements.patch
git apply /path/to/GhostPointFrontEnd/iphone-hud/waypoint-improvements.patch
npx tsc --noEmit
npx expo lint
npx expo run:ios --device
```

The new native build explicitly enables horizontal/vertical plane detection and mesh reconstruction on supported LiDAR devices. Surface selection tries detected plane geometry, estimated surfaces and extended detected planes around the tap. If no plane is found, a nearby visible AR feature within 18 screen points can provide an **estimated** point. Failures retain the old waypoint and leave placement armed, with readable feedback. Featureless, reflective and poorly lit surfaces can still fail.

For those cases select **Distance**, enter **0.2–15 metres**, tap Place/Replace, then tap a direction. This is an explicit estimated 3D placement along the camera ray, not a detected surface. It is labeled as distance-based on the phone and website. There is no silent arbitrary-distance fallback.

The selected phone has a **Waypoint name** field (optional, up to 40 characters), **Save name**, and a dedicated **Clear waypoint** button whenever a point exists. Names are shared with other phones and shown on the amber marker and website. The website also provides Rename waypoint and Clear waypoint. Phone clear/rename requests require the currently selected phone session; the existing public test dashboard retains its operator controls. Blank names default to Waypoint. Stop/clear cancels armed placement.

Native TypeScript/lint and server name/clear-permission tests pass. Actual raycasts, mesh behavior, fallback accuracy, native compilation and touch/UI behavior still require Xcode and physical-device validation. New phone code is required for improved selection, on-phone clear, and on-phone naming; the website/server update alone cannot change ARKit detection.

Apply **shared-waypoint.patch after auto-four-streams.patch** on uwbhud's `iphone-hud-broadcast` branch (base 4768c24). These are source patches, not app updates delivered to an installed iPhone. Preserve local changes and check before applying:

```sh
git switch iphone-hud-broadcast
git pull
# Apply auto-four-streams.patch only if it is not already applied.
git apply --check /path/to/GhostPointFrontEnd/iphone-hud/shared-waypoint.patch
git apply /path/to/GhostPointFrontEnd/iphone-hud/shared-waypoint.patch
npm ci
npx tsc --noEmit
npx expo lint
npx expo run:ios --device
```

A native rebuild/install on every participating phone is required. New Swift source is in the existing local Expo module podspec's source glob; no new native dependency, peer packet format or microphone permission is added. The patch changes the waypoint controls/overlay, adds small native registration and AR view hooks, and adds coordinate reference/mapping helpers to UWBTracker. Its initial AR epoch becomes random to distinguish a new tracking world from an old waypoint; existing ranging, pose fitting, person snapping and peer rendering algorithms are preserved.

## Use

1. Start broadcasting from updated phones. In the website's amber **Shared waypoint** panel choose the one phone allowed to place. Choose Nobody to revoke the permission. Older builds can still broadcast but cannot participate in waypoint control.
2. On that phone tap **Place waypoint**, then tap a visible floor or wall. A successful AR raycast publishes one world-space point. A new placement replaces it; the server rejects placements from every other phone session. A failed raycast leaves the previous waypoint intact.
3. All updated connected phones poll the shared point. It appears as an **amber diamond / orange 3D block and rectangular WAYPOINT distance label**, visually different from the existing green phone spheres/pills. When off screen an amber off-screen notice appears. The rendered marker is included in the existing ReplayKit stream; the dashboard's amber card reports its active state, not a fabricated position in the video.
4. Click **Clear waypoint** on the dashboard to remove it from all phones. Changing who can place does not create a second waypoint. The existing point remains until replaced, cleared, or its creator session disappears.

The point is referenced to the creator's AR world and epoch. Other phones use the existing UWB/peer AR alignment to map it into their own worlds. They must be paired and sufficiently aligned, with normal AR tracking. Until that is available (or after a relocalization invalidates the old world), the marker is hidden and the phone shows a waiting-for-alignment/tracking message. No GPS accuracy, cross-room global coordinate system, or placement through walls is claimed.

## Session behavior

The opaque broadcast assignment token also identifies the phone's waypoint session. It never goes into video URLs or browser bundles. Phones heartbeat once per second while connected. A phone that stops, loses its session, or misses heartbeat for 30 seconds loses its placement grant; its own waypoint is cleared. Reusing a stream slot does not inherit the former phone's grant. Server restarts clear grants/waypoints and require phones to reconnect (Stop/Start Broadcast). The waypoint is intentionally held in memory, with no recording or position history.

The dashboard remains the public test dashboard requested earlier: anyone who can open it can change the placement grant or clear the point. There is no added browser login. Device placement itself requires the currently granted phone token; hiding a phone button is not the only enforcement.

## Device acceptance required

TypeScript, ESLint, server permission/one-point concurrency tests, and browser control-flow checks do not prove native compilation or AR accuracy. Xcode compilation/signing, tap gestures/raycasts, permission changes, peer alignment, relocalization, marker visibility in ReplayKit, and real cross-phone placement remain to be verified on physical iPhones. Use two or more paired phones: grant A, place, compare location from B; reject B's unauthorized set; grant B and replace; revoke/clear; reset a tracking world; stop/reconnect a creator. Verify green phone markers/ranging are unaffected. Also verify placement on supported floor/wall surfaces and an honest failure when no surface is found.
