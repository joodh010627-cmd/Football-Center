"""Local preview only; this is not a product backend."""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import argparse
parser=argparse.ArgumentParser(description='Preview FC Growth locally')
parser.add_argument('--port',type=int,default=8000)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(SimpleHTTPRequestHandler,directory=str(root/'dist')))
print(f'App: http://127.0.0.1:{args.port}/',flush=True)
print('Press Ctrl+C to stop. Changes require running scripts/build.py again.',flush=True)
try: server.serve_forever()
except KeyboardInterrupt: server.server_close()
