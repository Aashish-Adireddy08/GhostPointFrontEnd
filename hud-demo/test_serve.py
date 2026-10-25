import http.client
import importlib.util
from pathlib import Path
import tempfile
import threading
import json
import time
from concurrent.futures import ThreadPoolExecutor
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

spec = importlib.util.spec_from_file_location('hud_server', Path(__file__).with_name('serve.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProxyTests(unittest.TestCase):
    def setUp(self):
        self.requests = []
        requests = self.requests
        self.live = []
        live = self.live

        class Gateway(BaseHTTPRequestHandler):
            def do_GET(self):
                body = json.dumps({'items': [{'name': name, 'online': True} for name in live]}).encode()
                self.send_response(200)
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_POST(self):
                requests.append((self.path, self.headers['Authorization']))
                self.rfile.read(int(self.headers.get('Content-Length', 0)))
                self.send_response(201)
                self.send_header('Location', 'http://localhost:28889' + self.path + '/session-id')
                self.send_header('Content-Length', '6')
                self.end_headers()
                self.wfile.write(b'answer')

            def log_message(self, *_args):
                pass

            def do_DELETE(self):
                requests.append((self.path, self.headers['Authorization']))
                self.send_response(200)
                self.send_header('Content-Length', '0')
                self.end_headers()

        self.gateway = ThreadingHTTPServer(('127.0.0.1', 0), Gateway)
        self.directory = tempfile.TemporaryDirectory()
        Path(self.directory.name, 'index.html').write_text('viewer')
        self.web = module.make_server(self.directory.name, {'publish_password': 'pub-secret', 'view_password': 'read-secret'},
                                      port=0, gateway_port=self.gateway.server_port, api_port=self.gateway.server_port)
        for server in (self.web, self.gateway):
            threading.Thread(target=server.serve_forever, daemon=True).start()

    def tearDown(self):
        for server in (self.web, self.gateway):
            server.shutdown()
            server.server_close()
        self.directory.cleanup()

    def request(self, method, path, role=None, body=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.web.server_port)
        headers = {'Authorization': self.web.credentials[role]} if role else {}
        connection.request(method, path, body=json.dumps(body) if body is not None else None, headers=headers)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def test_test_mode_needs_no_client_credentials(self):
        status, headers, body = self.request('GET', '/')
        self.assertEqual(status, 200)
        self.assertEqual(body, b'viewer')
        self.assertNotIn('WWW-Authenticate', headers)
        for endpoint in ('whip', 'whep'):
            self.assertEqual(self.request('POST', '/media/hud/' + endpoint)[0], 201)

    def test_protocol_proxy_and_same_origin_location(self):
        for stream in ('hud', 'hud2', 'hud3', 'hud4'):
            for kind, role in (('whip', 'publisher'), ('whep', 'viewer')):
                path = '/media/' + stream + '/' + kind
                status, headers, body = self.request('POST', path)
                self.assertEqual(status, 201)
                self.assertEqual(body, b'answer')
                self.assertEqual(headers['Location'], path + '/session-id')
                self.assertEqual(self.requests[-1], (path[len('/media'):], self.web.credentials[role]))
                self.assertEqual(self.request('DELETE', headers['Location'])[0], 200)
                self.assertEqual(self.requests[-1][0], path[len('/media'):] + '/session-id')

    def test_unrelated_paths_and_queries_blocked(self):
        self.assertEqual(self.request('POST', '/media/hud2/whip')[0], 201)
        for path in ('/media/webcam/whip', '/media/hud5/whip', '/media/hud/whip?secret=bad', '/media/../api', '/media/hud/whip/a/b'):
            self.assertEqual(self.request('POST', path, 'publisher')[0], 404)

    def test_concurrent_assignment_capacity_release_and_expiry(self):
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.request('POST', '/broadcast/claim'), range(4)))
        assigned = [json.loads(result[2]) for result in results]
        self.assertTrue(all(result[0] == 200 for result in results))
        self.assertEqual({item['stream'] for item in assigned}, set(module.STREAMS))
        self.assertEqual(self.request('POST', '/broadcast/claim')[0], 409)
        self.request('POST', '/broadcast/release', body={'lease': assigned[0]['lease']})
        self.assertEqual(json.loads(self.request('POST', '/broadcast/claim')[2])['stream'], assigned[0]['stream'])
        token = next(iter(self.web.leases))
        name, _ = self.web.leases[token]
        self.web.leases[token] = (name, time.monotonic() - 1)
        self.assertEqual(json.loads(self.request('POST', '/broadcast/claim')[2])['stream'], name)

    def test_discovery_and_manual_publisher_occupancy(self):
        self.live.extend(['hud', 'hud3', 'unrelated'])
        status = json.loads(self.request('GET', '/broadcast/slots')[2])
        self.assertEqual(status['streams'], ['hud', 'hud3'])
        self.assertEqual(json.loads(self.request('POST', '/broadcast/claim')[2])['stream'], 'hud2')


if __name__ == '__main__':
    unittest.main()
