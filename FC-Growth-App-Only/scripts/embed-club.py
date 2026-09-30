from pathlib import Path
from html.parser import HTMLParser
from html import escape
import re

root = Path(__file__).resolve().parents[1]
page = root / 'dist/index.html'
outer = page.read_text()

class Frame(HTMLParser):
    def handle_starttag(self, tag, attrs):
        if tag == 'iframe':
            self.inner = dict(attrs)['data-srcdoc']

frame = Frame()
frame.feed(outer)
inner = frame.inner
inner, count = re.subn(r'<section class="subpage" data-view="club" hidden>.*?</section>', '<section class="subpage" data-view="club" hidden><div id="fc-club-screen" class="club-screen"></div></section>', inner, count=1, flags=re.S)
assert count == 1
inner = re.sub(r'<style id="fc-club-styles">.*?</style>\s*', '', inner, flags=re.S)
inner = re.sub(r'<script id="fc-club-script">.*?</script>\s*', '', inner, flags=re.S)
css = (root / 'src/club.css').read_text()
js = (root / 'src/club.js').read_text()
inner = inner.replace('</body>', '<style id="fc-club-styles">' + css + '</style>\n<script id="fc-club-script">' + js + '</script>\n</body>', 1)
outer = re.sub(r'data-srcdoc="[^"]*"', lambda _: 'data-srcdoc="' + escape(inner) + '"', outer, count=1)
page.write_text(outer)
print('Embedded club screens in the existing mobile app.')
