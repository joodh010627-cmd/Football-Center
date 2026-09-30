"""Build the exported prototype with Python's standard library only."""
from pathlib import Path
from html import escape
import base64, json, subprocess, sys
root=Path(__file__).resolve().parents[1]
inner=(root/'src/app-shell.html').read_text(encoding='utf-8')
for asset in json.loads((root/'src/embedded-assets.json').read_text(encoding='utf-8')):
    uri='data:'+asset['mime']+';base64,'+base64.b64encode((root/asset['path']).read_bytes()).decode('ascii')
    inner=inner.replace(asset['token'],uri)
outer=(root/'src/preview-shell.html').read_text(encoding='utf-8')
assert outer.count('__FC_APP_HTML__')==1, 'Expected one preview shell placeholder'
(root/'dist').mkdir(exist_ok=True)
(root/'dist/index.html').write_text(outer.replace('__FC_APP_HTML__',escape(inner)),encoding='utf-8')
for script in ['embed-club.py','embed-beyond.py']:
    subprocess.run([sys.executable,'-X','utf8',str(root/'scripts'/script)],cwd=root,check=True)
print('Ready: dist/index.html')
