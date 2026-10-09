"""One-time approved preservation of the existing r7 login, not a password reset.

Reads the verified private rollback copy, never logs credential values, and emits
only a private configuration artifact for the same site's non-public data folder.
"""
import hashlib
import json
import re
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
folder = root / "output/qa/feature-deployment"
public_backup = folder / "rollback/optika-pre-features-public-20260929-r8.zip"
assert hashlib.sha256(public_backup.read_bytes()).hexdigest() == "a82e44a6110b9470c9f02d3ae0c7fc893252c00561daf60f802c61aa667a87b3", "Rollback changed"
with zipfile.ZipFile(public_backup) as archive:
    assert archive.testzip() is None
    source = archive.read("api/bootstrap.php").decode("utf-8")

def quoted_constant(name):
    matches = re.findall(r"const\s+" + re.escape(name) + r"\s*=\s*'([^'\\\r\n]+)'\s*;", source)
    assert len(matches) == 1, "Unsupported legacy constant"
    return matches[0]

iterations = re.findall(r"const\s+OM_PASSWORD_ITERATIONS\s*=\s*([0-9_]+)\s*;", source)
assert len(iterations) == 1
credentials = {
    "email": quoted_constant("OM_DEFAULT_ADMIN_EMAIL"),
    "salt": quoted_constant("OM_DEFAULT_PASSWORD_SALT"),
    "hash": quoted_constant("OM_DEFAULT_PASSWORD_HASH"),
    "iterations": int(iterations[0].replace("_", "")),
    "updatedAt": None,
}
assert re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", credentials["email"])
assert re.fullmatch(r"[a-fA-F0-9]{64}", credentials["hash"])
assert credentials["salt"] and credentials["iterations"] > 0
private_folder = folder / "private-config"
private_folder.mkdir(exist_ok=True)
target = private_folder / "credentials.json"
assert not target.exists(), "Do not overwrite prepared credentials"
with target.open("x", encoding="utf-8") as handle:
    json.dump(credentials, handle, indent=2)
assert json.loads(target.read_text(encoding="utf-8")) == credentials
print(json.dumps({"prepared": True, "existingIdentityPreserved": True, "passwordChanged": False,
                  "mustChangePasswordStatePreserved": True, "credentialValuesPrinted": False,
                  "destination": "private sibling optika-miftari-data/credentials.json"}))
