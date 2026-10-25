# iPhone HUD test deployment

Current version 1.1.1 is public testing mode: no username or password is required to view or publish. Anyone with the test URL can use it. Internal MediaMTX credentials remain on the server and are injected by the loopback proxy; they are not client requirements. The authentication descriptions below describe the original deployment, superseded for public clients by version 1.1.1.

Versioned updates use a separate `releases/hud-<version>-<commit>` directory for `dist/` and `hud-demo/`. Only `ghostpoint-hud-web.service` moves to the new code; MediaMTX, the existing credentials/runtime, and the HTTPS tunnel keep running. Before switching, the previous web unit and `current-hud-release.txt` are saved under the original runtime's `backup/` directory. The public `/version.json` endpoint records the deployed package version, commit and UTC build timestamp. The HUD viewer displays the version/commit, and the dashboard footer displays the version.

This adds a `?hud=1` viewer mode to the existing frontend, reusing its `openStream` WHEP receiver. The normal dashboard, webcam demo and shared-room demo remain available. HUD video uses `object-fit: contain` to keep the entire portrait screen visible.

## Installed on 2026-10-25

Access works as `aashish@64.177.50.116` with an existing local identity. The supplied `linuxuser` login failed; it was not modified. The requested Windows workspace was absent; see [iphone-hud/DEVICE-TEST.md](../iphone-hud/DEVICE-TEST.md) for the actual clone location and device build/test steps.

New release: `/home/aashish/.local/share/ghostpoint-frontend/releases/hud-20261025`.

- Reuses the installed MediaMTX **v1.21.2** binary in `deploy-20261024-065129-83046bd1/runtime`; runs a separate instance so existing sessions/config are preserved.
- Reuses the installed cloudflared binary in `shared-20261024-070758/runtime` for a separate temporary HTTPS Quick Tunnel. No existing tunnel was restarted.
- `ghostpoint-hud-media.service`: signaling only on loopback `28889`, public UDP/TCP media `18200`, advertised address `64.177.50.116`. Only path `hud`, authenticated scoped publisher/reader, publisher takeover disabled, recording disabled, other streaming protocols/API off.
- `ghostpoint-hud-web.service`: loopback `35174`, authenticated static viewer and restricted `/media/hud/{whip,whep}` proxy. Publisher credentials cannot read the viewer; reader credentials cannot publish. No credentials are embedded in static JavaScript.
- `ghostpoint-hud-https.service`: HTTPS origin `https://parents-costumes-eco-threshold.trycloudflare.com` at verification time. Viewer `/?hud=1`; publisher `/media/hud/whip`. It changes on tunnel restart; consult runtime logs and update the phone URL. HTTPS terminates at Cloudflare; WebRTC media uses DTLS/SRTP directly to Vultr.
- Generated secrets are in mode-0600 `runtime/credentials.json` and `runtime/mediamtx.yml` under a private release. Obtain them through authorized SSH, never source control or client bundles.
- Existing config and release pointer snapshots are in `runtime/backup/`. Existing release pointers and services were not overwritten. A new `current-hud-release.txt` identifies this release.

An administrator opened UDP and TCP 18200 in the host firewall. External UDP transport then passed. No TURN exists yet. This demo does not claim connectivity on restrictive networks; deploying authenticated TURN, commonly TLS on 443 with a real domain/certificate, requires admin/provider access and validation from those networks. The current account has no passwordless sudo. User lingering was enabled with `loginctl enable-linger` and verified (`Linger=yes`), so the user services persist after SSH logout. No system-wide application service or unrelated application was changed.

## Verification

```sh
python3 -m unittest discover -s hud-demo -p test_serve.py -v
systemctl --user is-active ghostpoint-hud-media ghostpoint-hud-web ghostpoint-hud-https
```

`smoke.cjs` uses Playwright/Chrome and retrieves only the current HTTPS origin through SSH and uses a fresh browser context with no credentials. Set `HUD_SSH_IDENTITY`, optionally `PLAYWRIGHT_MODULE` and `CHROME_PATH`, then run `node hud-demo/smoke.cjs` from the frontend directory. It publishes a synthetic changing portrait canvas, opens the actual HUD viewer, verifies decoded video and full frame edges, and deletes the publisher resource. This test passed externally over UDP; it does not verify ReplayKit, any iPhone HUD layer, or native compilation. A repeat test exposed a first-frame startup race (the viewer requested a stream just before it became available). The HUD viewer now retries a missing-stream HTTP 404 until publishing starts or viewing is stopped; other errors remain visible.

Local app checks passed: TypeScript and ESLint. Existing browser WHIP/WHEP tests: five passed. Proxy tests: three passed both locally and on Vultr. Production viewer build passed. Device build/install, HUD layer comparison, native cleanup behavior, cellular and restrictive-network tests remain required. See [iphone-hud/DEVICE-TEST.md](../iphone-hud/DEVICE-TEST.md) for the acceptance checklist.

## Deployment/recovery

`install.py` was run from the new release after copying the production `dist/` and `hud-demo/` files. It snapshots the current config/pointers before creating separate user units. It refuses an existing runtime or existing HUD units; inspect/back up before any future update. There is no automatic replacement of the current demo deployments.

To disable only this addition:
```sh
systemctl --user disable --now ghostpoint-hud-https ghostpoint-hud-web ghostpoint-hud-media
```
This leaves all original demos untouched. Runtime credentials and backups remain in the release until explicitly removed. Rotating publishing/viewer passwords requires updating the private credentials JSON and MediaMTX config together, then restarting only the HUD media/web units; never paste the passwords into the frontend build.
