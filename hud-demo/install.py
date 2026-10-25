"""Install isolated user services, reusing existing MediaMTX/cloudflared binaries.

Run from a NEW release directory only. Does not stop or alter previous demos.
"""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import time


def install():
    os.umask(0o077)
    release = Path(__file__).resolve().parent.parent
    base = Path.home() / '.local/share/ghostpoint-frontend'
    runtime = release / 'runtime'
    runtime.mkdir(exist_ok=False)
    previous = Path((base / 'current-release.txt').read_text().strip())
    shared = Path((base / 'current-shared-release.txt').read_text().strip())
    # Snapshot the existing deployment config/pointers before adding services.
    backup = runtime / 'backup'
    backup.mkdir()
    for source in (base / 'current-release.txt', base / 'current-shared-release.txt', previous / 'cloud-demo/mediamtx.yml'):
        shutil.copy2(source, backup / source.name)
    credentials = {'publish_password': secrets.token_urlsafe(32), 'view_password': secrets.token_urlsafe(32)}
    (runtime / 'credentials.json').write_text(json.dumps(credentials))
    config = f'''logLevel: info
rtsp: false
rtmp: false
hls: false
srt: false
moq: false
api: false
playback: false
webrtc: true
webrtcAddress: 127.0.0.1:28889
webrtcLocalUDPAddress: :18200
webrtcLocalTCPAddress: :18200
webrtcIPsFromInterfaces: false
webrtcAdditionalHosts: [64.177.50.116]
webrtcICEServers2: []
webrtcAllowOrigins: []
authInternalUsers:
  - user: hud-publisher
    pass: {credentials['publish_password']}
    permissions:
      - action: publish
        path: hud
      - action: publish
        path: hud2
  - user: hud-viewer
    pass: {credentials['view_password']}
    permissions:
      - action: read
        path: hud
      - action: read
        path: hud2
paths:
  hud:
    source: publisher
    overridePublisher: false
    record: false
  hud2:
    source: publisher
    overridePublisher: false
    record: false
'''
    (runtime / 'mediamtx.yml').write_text(config)
    units = Path.home() / '.config/systemd/user'
    units.mkdir(parents=True, exist_ok=True)
    commands = {
        'media': f'{previous}/runtime/mediamtx {runtime}/mediamtx.yml',
        'web': f'/usr/bin/python3 {release}/hud-demo/serve.py --directory {release}/dist --secrets {runtime}/credentials.json',
        'https': f'{shared}/runtime/cloudflared tunnel --url http://127.0.0.1:35174 --protocol http2 --no-autoupdate',
    }
    for name in commands:
        if (units / f'ghostpoint-hud-{name}.service').exists():
            raise RuntimeError('Existing HUD service found; back it up and inspect before updating.')
    for name, command in commands.items():
        log = runtime / f'{name}.log'
        unit = f'''[Unit]
Description=Ghostpoint HUD {name}
After=network-online.target
[Service]
WorkingDirectory={release}
ExecStart={command}
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
StandardOutput=append:{log}
StandardError=append:{log}
[Install]
WantedBy=default.target
'''
        (units / f'ghostpoint-hud-{name}.service').write_text(unit)
    subprocess.run(['systemctl', '--user', 'daemon-reload'], check=True)
    for name in commands:
        subprocess.run(['systemctl', '--user', 'enable', '--now', f'ghostpoint-hud-{name}'], check=True)
    (base / 'current-hud-release.txt').write_text(str(release) + '\n')
    for _ in range(60):
        import re
        log = runtime / 'https.log'
        match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', log.read_text() if log.exists() else '')
        if match:
            (runtime / 'https-url').write_text(match[0] + '\n')
            print('HUD HTTPS origin: ' + match[0])
            print('Credentials remain in runtime/credentials.json (mode 0600).')
            return
        time.sleep(1)
    raise RuntimeError('HTTPS tunnel did not publish an origin; inspect runtime/https.log.')


if __name__ == '__main__':
    install()
