"""Public test HUD viewer and WHIP/WHEP proxy, without client login.

Secrets live in a mode-0600 runtime JSON file, never in the static bundle.
"""
import argparse
import base64
import http.client
import json
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit


def basic(user, password):
    return 'Basic ' + base64.b64encode(f'{user}:{password}'.encode()).decode()


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *_args):
        pass  # Don't log credentials, URLs, or SDP.

    def list_directory(self, _path):
        self.send_error(404)

    def end_headers(self):
        if urlsplit(self.path).path in ('/', '/index.html', '/version.json'):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        super().do_GET()

    def do_HEAD(self):
        super().do_HEAD()

    def proxy(self):
        path = urlsplit(self.path)
        match = re.fullmatch(r'/media/(hud|hud2)/(whip|whep)(/[a-zA-Z0-9-]+)?', path.path)
        if not match or path.query or path.fragment:
            self.send_error(404)
            return
        stream, kind, session = match[1], match[2], match[3]
        role = 'publisher' if kind == 'whip' else 'viewer'
        if self.command not in ('POST', 'DELETE', 'OPTIONS') or (self.command == 'POST' and session):
            self.send_error(405)
            return
        if self.headers.get('Transfer-Encoding'):
            self.send_error(411)
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            self.send_error(400)
            return
        if not 0 <= size <= 256 * 1024:
            self.send_error(413)
            return
        upstream = http.client.HTTPConnection('127.0.0.1', self.server.gateway_port, timeout=20)
        try:
            headers = {'Authorization': self.server.credentials[role]}
            if self.headers.get('Content-Type'):
                headers['Content-Type'] = self.headers['Content-Type']
            upstream.request(self.command, path.path[len('/media'):], self.rfile.read(size), headers)
            response = upstream.getresponse()
            body = response.read()
            self.send_response(response.status)
            for key, value in response.getheaders():
                if key.lower() == 'location':
                    location = urlsplit(value)
                    if not location.path.startswith('/' + stream + '/' + kind + '/'):
                        continue
                    value = '/media' + location.path
                elif key.lower() not in ('content-type', 'etag', 'accept-patch'):
                    continue
                self.send_header(key, value)
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (OSError, http.client.HTTPException):
            self.send_error(502, 'Media gateway unavailable')
        finally:
            upstream.close()

    do_POST = proxy
    do_DELETE = proxy
    do_OPTIONS = proxy


def make_server(directory, secrets, port=35174, gateway_port=28889):
    server = ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory=directory))
    server.credentials = {
        'publisher': basic('hud-publisher', secrets['publish_password']),
        'viewer': basic('hud-viewer', secrets['view_password']),
    }
    server.gateway_port = gateway_port
    return server


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', required=True)
    parser.add_argument('--secrets', required=True)
    args = parser.parse_args()
    with open(args.secrets, encoding='utf-8') as file:
        secrets = json.load(file)
    make_server(args.directory, secrets).serve_forever()
