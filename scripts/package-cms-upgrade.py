"""Package an existing-install CMS upgrade, excluding all operational data."""
import hashlib
import json
import zipfile
import argparse
from pathlib import Path

root = Path(__file__).resolve().parent.parent
build = root / "dist"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--name", default="optika-itdks-cms-upgrade-20261003-r12.zip")
parser.add_argument("--report-dir", default="output/qa/cms-proposal-20261003")
args = parser.parse_args()
if Path(args.name).name != args.name or not args.name.endswith(".zip"):
    raise SystemExit("Release name must be a ZIP basename")
target = root / "release" / args.name
report_dir = (root / args.report_dir).resolve()
if not report_dir.is_relative_to((root / "output/qa").resolve()):
    raise SystemExit("Report directory must stay inside output/qa")
report_dir.mkdir(parents=True, exist_ok=True)
report_path = report_dir / "package.json"
api_files = {
    "account.php", "bootstrap.php", "cms-core.php", "cms-discounts.php",
    "cms-public.php", "cms.php", "holding-content.php", "index.php",
    "order-status.php", "prescription-download.php", "prescription-upload.php",
    "quote.php", "seo-render.php", "seo.php", "seo-template.html", "submit.php",
    "track.php", "upload-model.php", "upload.php", "luna.php", "luna-core.php",
}
excluded = {"uploads", "server", "storage", "tmp", "output", "node_modules"}
if target.exists():
    raise SystemExit("Refusing to replace an existing release")
entries = []
for source in sorted(build.rglob("*")):
    if not source.is_file():
        continue
    relative = source.relative_to(build)
    if any(part in excluded for part in relative.parts):
        continue
    if relative.parts[0] == "api" and (len(relative.parts) != 2 or relative.name not in api_files):
        continue
    if source.suffix.lower() in {".map", ".zip", ".log", ".sqlite", ".db"} or relative.name.startswith(".env"):
        raise SystemExit(f"Unexpected build artifact: {relative}")
    entries.append((source, relative.as_posix()))
assert all((build / "api" / name).is_file() for name in api_files)
with zipfile.ZipFile(target, "x", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for source, name in entries:
        info = zipfile.ZipInfo(name)
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, source.read_bytes())
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert {n for n in archive.namelist() if n.startswith("api/")} == {"api/" + n for n in api_files}
    for source, name in entries:
        assert archive.read(name) == source.read_bytes()
        assert (archive.getinfo(name).external_attr >> 16) & 0o777 == 0o644
    assert 'href="https://optika.itdks.tech/"' in archive.read("index.html").decode()
    assert ".htaccess" in archive.namelist()
report = {
    "artifact": str(target), "files": len(entries), "bytes": target.stat().st_size,
    "sha256": hashlib.sha256(target.read_bytes()).hexdigest(), "crc": "passed",
    "exactMatchToBuild": True, "permissions": "0644", "apiFiles": sorted(api_files),
    "containsCredentialsOrOperationalData": False,
    "status": "Packaged existing-install upgrade; not deployed or live-verified",
    "target": "https://optika.itdks.tech", "entries": [name for _, name in entries],
}
report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({k: v for k, v in report.items() if k != "entries"}, indent=2))
