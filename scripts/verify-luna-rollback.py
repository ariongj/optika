"""Verify private rollback archives without exposing record contents."""
import hashlib
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
destination = root / 'output/qa/luna-20261005/rollback'
destination.mkdir(parents=True, exist_ok=True)
report = []
for name in ['optika-pre-luna-public-20261005-r16.zip', 'optika-pre-luna-data-20261005-r16.zip']:
    source = Path('C:/Users/A/Downloads') / name
    data = source.read_bytes()
    with zipfile.ZipFile(source) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        assert names and all(not x.startswith('/') and '..' not in Path(x).parts for x in names)
        hashes = {name: hashlib.sha256(archive.read(name)).hexdigest() for name in names if not name.endswith('/')}
    target = destination / name
    if target.exists():
        assert target.read_bytes() == data
    else:
        target.write_bytes(data)
    report.append({'path': str(target), 'bytes': len(data), 'files': len(hashes), 'crc': 'passed', 'sha256': hashlib.sha256(data).hexdigest(), 'entryHashes': hashes})
(destination / 'integrity.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps([{k: v for k, v in item.items() if k != 'entryHashes'} for item in report], indent=2))
