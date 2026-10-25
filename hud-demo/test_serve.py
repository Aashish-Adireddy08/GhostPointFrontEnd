import http.client
import importlib.util
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

spec = importlib.util.spec_from_file_location('hud_server', Path(__file__).with_name('serve.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ProxyTests(unittest.TestCase):
    def setUp(self):
        self.requests = []
        requests = self.requests

        class Gateway(BaseHTTPRequestHandler):
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

        self.gateway = ThreadingHTTPServer(('127.0.0.1', 0), Gateway)
        self.directory = tempfile.TemporaryDirectory()
        Path(self.directory.name, 'index.html').write_text('viewer')
        self.web = module.make_server(self.directory.name, {'publish_password': 'pub-secret', 'view_password': 'read-secret'},
                                      port=0, gateway_port=self.gateway.server_port)
        for server in (self.web, self.gateway):
            threading.Thread(target=server.serve_forever, daemon=True).start()

    def tearDown(self):
        for server in (self.web, self.gateway):
            server.shutdown()
            server.server_close()
        self.directory.cleanup()

    def request(self, method, path, role=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.web.server_port)
        headers = {'Authorization': self.web.credentials[role]} if role else {}
        connection.request(method, path, headers=headers)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def test_authentication_and_role_separation(self):
        self.assertEqual(self.request('GET', '/')[0], 401)
        self.assertEqual(self.request('GET', '/', 'viewer')[2], b'viewer')
        self.assertEqual(self.request('POST', '/media/hud/whip', 'viewer')[0], 401)
        self.assertEqual(self.request('POST', '/media/hud/whep', 'publisher')[0], 401)
        self.assertFalse(self.requests)

    def test_protocol_proxy_and_same_origin_location(self):
        for path, role in (('/media/hud/whip', 'publisher'), ('/media/hud/whep', 'viewer')):
            status, headers, body = self.request('POST', path, role)
            self.assertEqual(status, 201)
            self.assertEqual(body, b'answer')
            self.assertEqual(headers['Location'], path + '/session-id')
            self.assertEqual(self.requests[-1], (path[len('/media'):], self.web.credentials[role]))

    def test_unrelated_paths_and_queries_blocked(self):
        for path in ('/media/webcam/whip', '/media/hud/whip?secret=bad', '/media/../api', '/media/hud/whip/a/b'):
            self.assertEqual(self.request('POST', path, 'publisher')[0], 404)


if __name__ == '__main__':
    unittest.main()
