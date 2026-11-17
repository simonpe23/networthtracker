"""Package the built app as a self-contained HTML file and a source archive.

Run `npm run build`, then `python3 scripts/package.py [output-directory] [edition]`.
"""
from pathlib import Path
import base64
import mimetypes
import re
import sys
import zipfile

root = Path(__file__).resolve().parent.parent
dist = root / 'dist'
out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'release'
out.mkdir(parents=True, exist_ok=True)
edition = sys.argv[2] if len(sys.argv) > 2 else 'powder-coral'
if not re.fullmatch(r'[a-z0-9-]+', edition):
    raise SystemExit('Edition must contain only lowercase letters, digits, and hyphens.')
html = (dist / 'index.html').read_text()
css_tag = re.search(r'<link[^>]+href="([^"]+\.css)"[^>]*>', html)
script_tag = re.search(r'<script[^>]+src="([^"]+\.js)"[^>]*></script>', html)
if not css_tag or not script_tag:
    raise SystemExit('Expected a built Vite HTML entry. Run npm run build first.')
css = (dist / css_tag.group(1).lstrip('/')).read_text()

def inline_asset(match):
    path = dist / match.group(1).lstrip('/')
    mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    data = base64.b64encode(path.read_bytes()).decode()
    return f'url(data:{mime};base64,{data})'

css = re.sub(r'url\((?:[\"\']?)(/assets/[^)\"\']+)(?:[\"\']?)\)', inline_asset, css)
html = html.replace(css_tag.group(0), '<style>' + css + '</style>')
js = (dist / script_tag.group(1).lstrip('/')).read_text()
html = html.replace(script_tag.group(0), '<script type="module">' + js.replace('</script', '<\\/script') + '</script>')
favicon = base64.b64encode((dist / 'favicon.svg').read_bytes()).decode()
html = html.replace('href="/favicon.svg"', f'href="data:image/svg+xml;base64,{favicon}"')
html_path = out / f'sp-net-worth-tracker-{edition}.html'
html_path.write_text(html)
source_path = out / f'sp-net-worth-tracker-{edition}-source.zip'
entries = ['.github', 'src', 'public', 'tests', 'scripts', '.gitignore', '.prettierignore', 'README.md', 'BUILD_PROMPT.md', 'index.html', 'package.json', 'package-lock.json', 'playwright.config.ts', 'tsconfig.json', 'vite.config.ts']
with zipfile.ZipFile(source_path, 'w', zipfile.ZIP_DEFLATED) as archive:
    for entry in entries:
        path = root / entry
        files = sorted(path.rglob('*')) if path.is_dir() else [path]
        for file in files:
            if file.is_file() and '__pycache__' not in file.parts:
                archive.write(file, Path('sp-net-worth-tracker') / file.relative_to(root))
with zipfile.ZipFile(source_path) as archive:
    if archive.testzip() is not None:
        raise SystemExit('Source archive verification failed.')
print(f'Single-file app: {html_path} ({html_path.stat().st_size:,} bytes)')
print(f'Source archive: {source_path} ({source_path.stat().st_size:,} bytes)')
