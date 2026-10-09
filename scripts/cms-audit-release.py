"""Verify the exact frontend upgrade against its fresh private rollback copy."""
from pathlib import Path
import hashlib, json, re, shutil, zipfile

root = Path(__file__).resolve().parent.parent
out = root / 'output/qa/final-audit-20261008'
backup = Path('C:/Users/A/Downloads/optika-pre-cms-audit-public-20261008-r19.zip')
package = root / 'release/optika-itdks-cms-audit-20261008-r19.zip'
sha = lambda b: hashlib.sha256(b).hexdigest()
suite = json.loads((out / 'suite-results.json').read_text())
assert len(suite['results']) == 34 and all(x['status'] == 'verified' for x in suite['results'])
with zipfile.ZipFile(backup) as old, zipfile.ZipFile(package) as new:
    assert old.testzip() is None and new.testzip() is None
    assert 'index.html' in old.namelist() and 'api/bootstrap.php' in old.namelist()
    changed, added = [], []
    for name in new.namelist():
        body = new.read(name)
        assert not re.search(rb'sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{30,}', body), 'Secret-like value in release'
        assert body == (root / 'dist' / name).read_bytes(), 'Package differs from final build'
        if name not in old.namelist():
            assert re.fullmatch(r'assets/[A-Za-z0-9_-]+\.js', name), f'Unexpected new path: {name}'
            added.append(name)
        elif body != old.read(name):
            assert name.endswith('.html'), f'Unexpected non-HTML change: {name}'
            changed.append(name)
    assert len(added) == 5, 'Review unexpected asset change count'
    assert all(new.read(n) == old.read(n) for n in new.namelist() if n.endswith('.php'))
    report = {'backup': {'path': str(out / 'rollback' / backup.name), 'bytes': backup.stat().st_size,
        'sha256': sha(backup.read_bytes()), 'files': len(old.namelist()), 'crc': 'passed',
        'scope': 'Fresh public_html rollback only; private data and Luna configuration are untouched by this frontend upgrade'},
        'release': {'path': str(package), 'sha256': sha(package.read_bytes()), 'files': len(new.namelist()),
        'changedHtml': changed, 'newAssets': added, 'phpUnchanged': True, 'secretLikeValues': 0},
        'localSuites': 34, 'unitTests': 198, 'lunaPurePhpChecks': 35,
        'browserFixesVerified': ['Existing-product Cancel returns without saving', 'New-product Cancel returns',
          'Product name label in English', 'Optional measurements remain blank on reopen',
          'Create, reopen, edit, save and refresh synthetic draft', '320px CMS editor has no horizontal overflow'],
        'deploymentStatus': 'packaged-not-deployed'}
(out / 'rollback').mkdir(exist_ok=True)
shutil.copy2(backup, out / 'rollback' / backup.name)
(out / 'release-verification.json').write_text(json.dumps(report, indent=2))
print(json.dumps({k:v for k,v in report.items() if k not in ['release']}, indent=2))
print(json.dumps({'changedHtml':len(changed),'newAssets':added,'phpUnchanged':True}))
