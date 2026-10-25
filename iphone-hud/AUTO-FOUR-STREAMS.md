# Automatic four-phone assignment

Apply `auto-four-streams.patch` to **uwbhud branch iphone-hud-broadcast at 4768c24 or a compatible descendant**. This is an incremental patch, not the original broadcast integration patch. Preserve your changes and run `git apply --check` before applying:

```sh
git switch iphone-hud-broadcast
git pull
git apply --check /path/to/GhostPointFrontEnd/iphone-hud/auto-four-streams.patch
git apply /path/to/GhostPointFrontEnd/iphone-hud/auto-four-streams.patch
npm ci
npx tsc --noEmit
npx expo lint
npx expo run:ios --device
```

Only `modules/uwb-ar/BroadcastControls.tsx` changes. Existing Swift capture, ranging and rendering code stay intact. Rebuild/install the app on each phone; no additional pods or permissions are introduced. On launch it connects to the built-in server. Tap Start Broadcast to claim the first free slot and accept ReplayKit consent. No URL or password is entered. Stop releases the pending reservation; active stream occupancy is read from MediaMTX. Failed/uncompleted startup reservations expire after 90 seconds. A fifth concurrent phone gets an “all four slots busy” error. Capture stays opt-in and stops on background/Stop through the existing native lifecycle.

The built-in origin is `https://parents-costumes-eco-threshold.trycloudflare.com`. It is a temporary Quick Tunnel hostname. If it changes, update the `SERVER` constant and rebuild; a permanent domain is required to avoid that maintenance. The app does not discover arbitrary tunnel names automatically.

The browser opens the live dashboard automatically and polls live occupancy. It shows zero-state, one full-width feed, or a two-column grid for 2–4 feeds (one column on mobile). Missing phones do not occupy panels. The four server paths are `hud`, `hud2`, `hud3`, and `hud4`.

TypeScript and ESLint were run on this native source. Xcode compilation, ReplayKit consent, and physical four-iPhone capture must still be verified on your Mac/devices. Browser synthetic media and allocator checks do not establish native device success.
