from pathlib import Path
from html.parser import HTMLParser
from html import escape
import re
import base64

root=Path(__file__).resolve().parents[1]
page=root/'dist/index.html'
outer=page.read_text()
class Frame(HTMLParser):
    def handle_starttag(self,tag,attrs):
        if tag=='iframe': self.inner=dict(attrs)['data-srcdoc']
frame=Frame();frame.feed(outer);inner=frame.inner
font='data:font/woff2;base64,'+base64.b64encode((root/'src/assets/PretendardVariable.woff2').read_bytes()).decode()
inner=re.sub(r"(@font-face\{font-family:FC;src:url\(')[^']+(')",lambda m:m[1]+font+m[2],inner,count=1)
icons={
 'bell':'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 'calendar-days':'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18M8 15h1M15 15h1M8 18h1"/>',
 'chevron-right':'<path d="m9 5 7 7-7 7"/>',
 'file-text':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 12h8M8 16h6"/>',
 'house':'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
 'newspaper':'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 7h5v5H7zM16 7h1M16 11h1M7 16h10"/>',
 'plus':'<path d="M12 5v14M5 12h14"/>',
 'users':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/><circle cx="9" cy="7" r="4"/>',
 'x':'<path d="m6 6 12 12M18 6 6 18"/>'
}
inner=re.sub(r'<i[^>]*data-lucide="([^"]+)"[^>]*></i>',lambda m:'<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[m[1]]+'</svg>' if m[1] in icons else m[0],inner)
inner=re.sub(r'<style id="fc-beyond-style">.*?</style>\s*','',inner,flags=re.S)
inner=re.sub(r'<script id="fc-beyond-script">.*?</script>\s*','',inner,flags=re.S)
if 'id="fc-beyond"' not in inner:
    inner=inner.replace('</main>','<section class="beyond" data-view="beyond" id="fc-beyond" hidden></section></main>',1)
inner=inner.replace('];let ad=0,paused=','];window.FCBrandMedia=ads;let ad=0,paused=',1)
js='\n'.join((root/'src'/name).read_text() for name in ['beyond-core.js','beyond-blocks.js','beyond-classes.js','beyond-forms.js','beyond-schedule.js','beyond-club.js','beyond-boot.js'])
inner=inner.replace('</body>','<style id="fc-beyond-style">'+(root/'src/beyond.css').read_text()+'</style>\n<script id="fc-beyond-script">'+js+'</script>\n</body>',1)
outer=re.sub(r'data-srcdoc="[^"]*"',lambda _: 'data-srcdoc="'+escape(inner)+'"',outer,count=1)
if '// FC Beyond share context' not in outer:
    outer=outer.replace('frame.srcdoc = srcdoc.replace(', r'''// FC Beyond share context: pass the real origin and preview query into the sandbox.
  const shareContext = JSON.stringify({origin:location.origin,query:location.search}).replaceAll("<", "\\u003c");
  const withContext = srcdoc.replace("/*FC_SHARE_CONTEXT*/null", shareContext);
  frame.srcdoc = withContext.replace(''',1)
outer=outer.replace('<title>FC Growth</title>','<title>FC Growth · Beyond Football</title>',1)
page.write_text(outer)
(root/'dist/Pretendard-LICENSE.txt').write_text((root/'src/assets/Pretendard-LICENSE.txt').read_text())
print('Embedded expanded class, forms and schedule flows.')
