"""Create an additive public-site upgrade; never replace runtime data or PHP."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
build = root / "dist"
target = root / "release" / "optika-itdks-campaign-upgrade-20260928.zip"
excluded = {"api", "uploads", "server"}
entries = []
if target.exists():
    raise SystemExit("Refusing to replace an existing deployment artifact")
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for source in sorted(build.rglob("*")):
        if not source.is_file():
            continue
        relative = source.relative_to(build)
        if relative.parts[0] in excluded:
            continue
        info = zipfile.ZipInfo(relative.as_posix())
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, source.read_bytes())
        entries.append(relative.as_posix())
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    for name in archive.namelist():
        assert archive.read(name) == (build / name).read_bytes()
        assert (archive.getinfo(name).external_attr >> 16) & 0o777 == 0o644
        assert name.split("/")[0] not in excluded
    assert 'href="https://optika.itdks.tech/"' in archive.read("index.html").decode()
    assert "https://optika.itdks.tech/" in archive.read("sitemap.xml").decode()
report = {
    "artifact": target.name,
    "files": len(entries),
    "bytes": target.stat().st_size,
    "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
    "target": "https://optika.itdks.tech",
    "excluded": sorted(excluded),
    "crc": "passed",
    "exactMatchToBuild": True,
    "fileMode": "0644",
    "deployment": "Additive extraction into existing public_html; do not delete existing files",
}
(root / "output/qa/campaign-rebuild/deployment-package.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
