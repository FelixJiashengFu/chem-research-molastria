"""Optional standard-library preview for browsers that restrict local file access."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

if __name__ == '__main__':
    public = Path(__file__).resolve().parent / 'public'
    handler = partial(SimpleHTTPRequestHandler, directory=str(public))
    server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'ChemResearch Hub: {url}\nPress Ctrl+C to stop.')
    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
