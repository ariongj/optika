"""Frontend-only upgrade for the existing Optika review installation."""
from pathlib import Path
import hashlib
import json
import zipfile
import argparse
import re

root = Path(__file__).resolve().parent.parent
build = root / 'dist'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--name', default='optika-itdks-service-refinement-20260928-r2')
parser.add_argument('--report-dir', default='service-refinement')
args = parser.parse_args()
for value in (args.name, args.report_dir):
    if not re.fullmatch(r'[a-z0-9-]+', value):
        raise SystemExit('Use a lowercase release/report slug, not a path')
target = root / 'release' / f'{args.name}.zip'
report_path = root / 'output/qa' / args.report_dir / 'deployment-package.json'
report_path.parent.mkdir(parents=True, exist_ok=True)
if target.exists():
    raise SystemExit('Refusing to overwrite an existing release')
entries = []
for path in sorted(build.rglob('*')):
    if not path.is_file():
        continue
    relative = path.relative_to(build).as_posix()
    if relative.split('/')[0] in {'api', 'uploads', 'server'}:
        continue
    assert not any(part.startswith('.') and part != '.htaccess' for part in Path(relative).parts)
    assert not relative.endswith(('.zip', '.map', '.log', '.db', '.sqlite', '.json'))
    assert not any(word in relative.lower() for word in ['credentials', 'session', 'password', 'private'])
    entries.append((relative, path))
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name, path in entries:
        info = zipfile.ZipInfo(name)
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, path.read_bytes())
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    for name, path in entries:
        assert archive.read(name) == path.read_bytes()
        assert (archive.getinfo(name).external_attr >> 16) & 0o777 == 0o644
    assert 'https://optika.itdks.tech/' in archive.read('index.html').decode()
    assert 'https://optika.itdks.tech/' in archive.read('sitemap.xml').decode()
report = {
    'artifact': target.name, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
    'files': len(entries), 'bytes': target.stat().st_size, 'crc': 'passed',
    'exactMatchToBuild': True, 'fileMode': '0644', 'target': 'https://optika.itdks.tech',
    'preserved': ['all PHP endpoints', 'private runtime data', 'uploads', 'credentials', 'catalogue seed'],
    'deployment': 'Frontend-only additive extraction to existing public_html. Not a fresh-install package.',
    'manifest': [{'path': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for name, path in entries]
}
report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key != 'manifest'}, indent=2))
