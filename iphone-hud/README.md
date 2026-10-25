# Native iPhone publisher integration

The iPhone app remains in https://github.com/GatorHackV-Ghostpoint/uwbhud. This frontend repository includes its broadcast changes as `uwbhud-broadcast.patch`, rather than copying or publishing a second app repository.

The patch targets uwbhud revision `4eceb62ea6169c1174896cd67eee80716c9df9a7` and contains only the native ReplayKit/WebRTC publisher, essential controls, the existing module registration and podspec integration, and the App control mount. It does not alter UWB ranging or HUD rendering code. It has not been pushed to uwbhud.

From a checkout of the app with your work preserved, inspect and apply:

```sh
git apply --check /path/to/GhostPointFrontEnd/iphone-hud/uwbhud-broadcast.patch
git apply /path/to/GhostPointFrontEnd/iphone-hud/uwbhud-broadcast.patch
```

If the check fails, stop and reconcile your app's changes; do not reset or overwrite them. See [DEVICE-TEST.md](DEVICE-TEST.md) for Mac build/install commands, endpoint configuration, credential retrieval through SSH, actual verification results and the required four-layer HUD acceptance test.

Native iOS compilation, signing, device installation and actual HUD capture remain unverified. The external synthetic browser transport test passed; it does not prove any iPhone HUD layer is captured. TURN remains unconfigured for restrictive networks.
