"""Verify downloaded rollback archives without reading private data into logs."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--release', choices=['completion', 'service'], default='completion')
release = parser.parse_args().release

root = Path(__file__).resolve().parent.parent
results = []
for kind in ('public', 'data'):
    name = f'optika-pre-{release}-{kind}-20260928.zip'
    source = Path('C:/Users/A/Downloads') / name
    target = root / 'backups' / name
    if not target.exists():
        shutil.copy2(source, target)
    assert source.read_bytes() == target.read_bytes()
    with zipfile.ZipFile(target) as archive:
        assert archive.testzip() is None
        names = archive.namelist()
        assert len(names) > 0
        assert not any(n.startswith('/') or '..' in Path(n).parts for n in names)
        if kind == 'public':
            assert any(n.endswith('api/bootstrap.php') for n in names)
            assert any(n.endswith('index.html') for n in names)
    results.append({'archive':name, 'bytes':target.stat().st_size,'entries':len(names),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'crc':'passed'})
report_dir = 'service-refinement' if release == 'service' else 'completion-pass'
(root / f'output/qa/{report_dir}/rollback-backups.json').write_text(json.dumps({'archives':results,'scope':'Remote archives retained outside public_html and copied locally. Sequential snapshots, not atomic; restore not executed.'},indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
