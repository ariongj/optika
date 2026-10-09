"""Verify the exact client-review artifact against the locally tested build."""
import hashlib
import json
import zipfile
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
build = root / "dist"
package = root / (sys.argv[1] if len(sys.argv) > 1 else "release/optika-miftari-reference-rework-2026-09-28.zip")
forbidden_parts = {"node_modules", ".git", ".codex", ".claude", "optika-miftari-data", "backups", "sessions", "prescriptions", "tmp", "output"}
allowed_storage = {"api/storage/.htaccess", "api/storage/commerce-seed.json", "api/storage/customer-account-seed.json"}
with zipfile.ZipFile(package) as archive:
    names = archive.namelist()
    assert len(names) == len(set(names)), "Duplicate archive entries"
    assert archive.testzip() is None, "CRC failure"
    for name in names:
        path = Path(name)
        assert not path.is_absolute() and ".." not in path.parts, "Unsafe path"
        assert not forbidden_parts.intersection(path.parts), "Private or generated directory included"
        assert not path.name.startswith(".env"), "Environment file included"
        assert not any(word in path.name.lower() for word in ("test_accounts", "admin_access", "credentials")), "Credential note included"
        assert path.suffix.lower() not in {".zip", ".log", ".sqlite", ".db"}, "Unrelated artifact included"
        if name.startswith("api/storage/"):
            assert name in allowed_storage, "Operational storage included"
        data = archive.read(name)
        assert data == (build / name).read_bytes(), f"Build differs from ZIP: {name}"
        if path.suffix.lower() in {".php", ".json", ".js", ".html"}:
            assert b"-----BEGIN PRIVATE KEY-----" not in data, "Private key included"
            assert b"sk-proj-" not in data, "API credential included"
    # Only pre-existing one-way test-account verifiers belong in the seed.
    seed = json.loads(archive.read("api/storage/customer-account-seed.json"))
    def reject_plaintext_password(value):
        if isinstance(value, dict):
            assert not {"password", "plainPassword", "plaintextPassword", "temporaryPassword"}.intersection(value), "Plaintext password key in seed"
            for child in value.values():
                reject_plaintext_password(child)
        elif isinstance(value, list):
            for child in value:
                reject_plaintext_password(child)
    reject_plaintext_password(seed)
result = {
    "package": package.name,
    "files": len(names),
    "bytes": package.stat().st_size,
    "sha256": hashlib.sha256(package.read_bytes()).hexdigest(),
    "exactMatchToTestedBuild": True,
    "crc": "passed",
    "privateDataAndCredentialNotes": "excluded",
    "authentication": "Existing test-account one-way verifiers preserved; no new credentials created",
}
evidence = root / (sys.argv[2] if len(sys.argv) > 2 else "output/qa/reference-rework/package-checks.json")
evidence.parent.mkdir(parents=True, exist_ok=True)
evidence.write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps(result, indent=2))
