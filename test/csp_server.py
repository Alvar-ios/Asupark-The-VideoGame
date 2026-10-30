import http.server, socketserver, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src data: blob:")
        super().end_headers()
    def log_message(self, *a): pass
import os; os.chdir(sys.argv[1])
socketserver.TCPServer(('127.0.0.1', int(sys.argv[2])), H).serve_forever()
