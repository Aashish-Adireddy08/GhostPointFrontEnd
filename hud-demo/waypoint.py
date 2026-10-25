"""One room waypoint and one session-scoped phone allowed to replace it."""
import math
import secrets
import threading
import time


class WaypointRoom:
    def __init__(self):
        self.lock = threading.RLock()
        self.phones = {}
        self.holder = None
        self.point = None
        self.revision = 0

    def register(self, token, stream):
        with self.lock:
            # A reused stream slot is a new device session and cannot inherit permission.
            for old in list(self.phones):
                if self.phones[old]['stream'] == stream:
                    self.remove(old)
            self.phones[token] = {'stream': stream, 'seen': time.monotonic()}

    def remove(self, token):
        with self.lock:
            self.phones.pop(token, None)
            if self.holder == token:
                self.holder = None
            if self.point and self.point['creator'] == token:
                self.point = None
            self.revision += 1

    def prune(self):
        for token, phone in list(self.phones.items()):
            if time.monotonic() - phone['seen'] > 30:
                self.remove(token)

    def public(self):
        with self.lock:
            self.prune()
            point = {k: v for k, v in self.point.items() if k != 'creator'} if self.point else None
            return {'phones': sorted([{'stream': p['stream']} for p in self.phones.values()], key=lambda p: p['stream']),
                    'holder': self.phones.get(self.holder, {}).get('stream'), 'point': point, 'revision': self.revision}

    def command(self, action, payload):
        with self.lock:
            self.prune()
            if action == 'grant':
                stream = payload.get('stream')
                token = next((t for t, p in self.phones.items() if p['stream'] == stream), None)
                if stream is not None and token is None:
                    return 409, {'error': 'This phone needs the waypoint app update and an active session.'}
                self.holder = token
                self.revision += 1
            elif action == 'clear':
                self.point = None
                self.revision += 1
            else:
                token = payload.get('device')
                if not isinstance(token, str) or token not in self.phones:
                    return 403, {'error': 'Reconnect this phone to the broadcast server.'}
                self.phones[token]['seen'] = time.monotonic()
                if action == 'set':
                    if token != self.holder:
                        return 403, {'error': 'Only the phone selected in the dashboard can set the waypoint.'}
                    ref = payload.get('reference', {})
                    position = ref.get('position') if isinstance(ref, dict) else None
                    if (not isinstance(position, list) or len(position) != 3 or
                        not all(type(v) in (int, float) and math.isfinite(v) and abs(v) < 10000 for v in position) or
                        not isinstance(ref.get('peer'), str) or not 1 <= len(ref['peer']) <= 63 or
                        type(ref.get('epoch')) is not int or not 0 <= ref['epoch'] <= 4294967295):
                        return 400, {'error': 'Invalid AR waypoint coordinates.'}
                    self.revision += 1
                    self.point = {'id': secrets.token_hex(8), 'creator': token, 'stream': self.phones[token]['stream'],
                                  'reference': {'peer': ref['peer'], 'epoch': ref['epoch'], 'position': position}}
                state = self.public()
                state['canPlace'] = token == self.holder
                return 200, state
            return 200, self.public()
