"""Additive group-site upgrade; preserve live accounts, inventory and uploads."""
import hashlib
import json
import zipfile
import argparse
import re
from pathlib import Path

root = Path(__file__).resolve().parent.parent
build = root / 'dist'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--name', default='optika-itdks-holding-group-20260928-r4')
parser.add_argument('--report-dir', default='holding-group')
args = parser.parse_args()
for value in (args.name, args.report_dir):
    if not re.fullmatch(r'[a-z0-9-]+', value):
        raise SystemExit('Use a lowercase release/report slug, not a path')
target = root / 'release' / f'{args.name}.zip'
patched_api = {'api/bootstrap.php', 'api/index.php', 'api/submit.php', 'api/holding-content.php'}
excluded_roots = {'api', 'uploads', 'server'}
entries = []
if target.exists():
    raise SystemExit('Refusing to overwrite an existing release')
for source in sorted(build.rglob('*')):
    if not source.is_file():
        continue
    relative = source.relative_to(build).as_posix()
    if relative.split('/')[0] in excluded_roots and relative not in patched_api:
        continue
    assert not any(part.startswith('.') for part in Path(relative).parts if part != '.htaccess')
    assert not relative.endswith(('.zip', '.map', '.log', '.sqlite', '.db'))
    entries.append((relative, source))
names = {name for name, _ in entries}
assert patched_api <= names
assert {'index.html', 'optical/index.html', 'clinic/index.html', 'laboratory/partners/index.html', 'assets/brand/miftari-clinic-2026.webp'} <= names
with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name, source in entries:
        info = zipfile.ZipInfo(name)
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, source.read_bytes())
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    for name, source in entries:
        assert archive.read(name) == source.read_bytes()
        assert (archive.getinfo(name).external_attr >> 16) & 0o777 == 0o644
    assert 'href="https://optika.itdks.tech/"' in archive.read('index.html').decode()
    assert 'https://optika.itdks.tech/clinic' in archive.read('sitemap.xml').decode()
report = {
    'artifact': target.name, 'files': len(entries), 'bytes': target.stat().st_size,
    'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
    'target': 'https://optika.itdks.tech', 'crc': 'passed', 'exactMatchToBuild': True,
    'fileMode': '0644', 'patchedApi': sorted(patched_api),
    'preserved': ['private runtime data', 'credentials', 'uploads', 'catalogue seed', 'other PHP endpoints'],
    'deployment': 'Upgrade only: additive extraction into existing public_html; no deletion or data migration',
    'manifest': [{'path': name, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()} for name, source in entries],
}
report_path = root / 'output/qa' / args.report_dir / 'deployment-package.json'
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key != 'manifest'}, indent=2))
