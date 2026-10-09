"""Inspect a downloaded public-site rollback; never extract or modify it."""
import argparse
import hashlib
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("archive")
parser.add_argument("--report-dir", default="readiness-20260930")
args = parser.parse_args()
archive = Path(args.archive).resolve()
report_dir = (root / "output" / "qa" / args.report_dir).resolve()
if report_dir.parent != (root / "output" / "qa").resolve():
    raise SystemExit("Report must remain in the workspace QA directory")
if archive.parent != report_dir / "rollback" or archive.suffix != ".zip":
    raise SystemExit("Archive must be the named ZIP in this release's rollback directory")
with zipfile.ZipFile(archive) as backup:
    if backup.testzip() is not None:
        raise SystemExit("Rollback CRC failed")
    names = [item.filename for item in backup.infolist() if not item.is_dir()]
    if any(name.startswith("/") or ".." in Path(name).parts for name in names):
        raise SystemExit("Rollback contains unsafe paths")
    # Hostinger archives the selected directory's CONTENTS at the archive root.
    # Older exporters can include the public_html prefix; support either layout.
    prefix = "public_html/" if "public_html/index.html" in names else ""
    relative_names = [name[len(prefix):] if name.startswith(prefix) else name for name in names]
    private_roots = {"optika-miftari-data", "storage", "data", "sessions", "node_modules", "output", ".git", ".env"}
    if any(Path(name).parts[0] in private_roots for name in relative_names):
        raise SystemExit("Rollback includes a private runtime or unrelated source directory")
    if prefix + "index.html" not in names or prefix + ".htaccess" not in names:
        raise SystemExit("Rollback is missing its public entry point or rewrite rules")
    entry_html = backup.read(prefix + "index.html").decode("utf-8")
    if "index-CFcRHivF.js" not in entry_html:
        raise SystemExit("Rollback does not match the previous r10b live release")
proof = {
    "path": str(archive.relative_to(root)).replace("\\", "/"),
    "bytes": archive.stat().st_size,
    "entries": len(names),
    "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "crc": "passed",
    "outsideWebRoot": True,
    "previousRelease": "optika-itdks-seo-20260930-r10b",
    "archiveRoot": prefix or "Public directory contents at root",
    "scope": "Public-site rollback only; private sibling runtime data is preserved, not included. Restore not executed.",
}
(report_dir / "rollback-proof.json").write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
print(json.dumps(proof, indent=2))
