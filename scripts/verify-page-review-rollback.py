"""Verify the fresh pre-r22 public rollback without exposing archive contents."""
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
source = Path('C:/Users/A/Downloads/optika-pre-page-review-public-20261008-r22.zip')
report = root / 'output/qa/page-review-20261008-r22'
with zipfile.ZipFile(source) as archive:
    assert archive.testzip() is None, 'Rollback CRC failed'
    names = archive.namelist()
    assert 'index.html' in names and '.htaccess' in names
    assert not any(n.startswith('/') or '..' in Path(n).parts for n in names)
    scripts = re.findall(r'assets/index-[^\s"<>]+\.js', archive.read('index.html').decode())
    assert scripts, 'Missing previous entry script'
    with zipfile.ZipFile(root / 'release/optika-itdks-page-review-20261008-r22.zip') as release:
        assert all(archive.read(n) == release.read(n) for n in ['api/seo.php', 'api/seo-render.php']), 'Unexpected SEO PHP change'
target = report / 'rollback' / source.name
target.parent.mkdir(parents=True, exist_ok=True)
assert not target.exists(), 'Rollback target already exists'
shutil.copy2(source, target)
proof = {'path':str(target.relative_to(root)), 'bytes':target.stat().st_size, 'entries':len(names), 'sha256':hashlib.sha256(target.read_bytes()).hexdigest(), 'crc':'passed', 'outsideWebRoot':True, 'previousScripts':scripts, 'seoPhpUnchanged':True, 'scope':'Public-site rollback; sibling private data untouched; restore not executed'}
(report / 'rollback-proof.json').write_text(json.dumps(proof,indent=2),encoding='utf-8')
print(json.dumps(proof,indent=2))
