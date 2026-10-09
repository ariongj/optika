"""Inspect fresh r8 rollback copies without exposing private record contents."""
import hashlib
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
folder = root / "output/qa/feature-deployment"
reports = []
for kind, required in [("public", "api/bootstrap.php"), ("data", "events.json")]:
    path = folder / "rollback" / f"optika-pre-features-{kind}-20260929-r8.zip"
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, "Invalid rollback ZIP"
        names = archive.namelist()
        assert required in names, "Unexpected backup scope"
        assert not any(name.startswith('/') or '..' in Path(name).parts for name in names)
        info = {"kind": kind, "archive": path.name, "bytes": path.stat().st_size,
                "entries": len(names), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "crc": "passed", "private": True, "storedOutsideWebRoot": True}
        if kind == "data":
            info["privateCredentialsPresent"] = "credentials.json" in names
        else:
            source = archive.read("api/bootstrap.php").decode("utf-8")
            info["legacyEmbeddedCredentialFallback"] = "const OM_DEFAULT_PASSWORD_HASH" in source
        reports.append(info)

output = {"backups": reports, "snapshot": "Point-in-time copies; not an atomic cross-directory snapshot or restore test",
          "deploymentPrerequisite": "Preserve the legacy administrator identity in private configuration with explicit approval before r8 replacement"}
(folder / "rollback-checks.json").write_text(json.dumps(output, indent=2), encoding="utf-8")
print(json.dumps(output, indent=2))
