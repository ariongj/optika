"""Validate named downloaded rollback archives without exposing stored records."""
import hashlib
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parent.parent
reports = []
for name, required in [
    ("optika-pre-campaign-public-20260928.zip", "index.html"),
    ("optika-pre-campaign-data-20260928.zip", "events.json"),
]:
    path = root / "backups" / name
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None, "CRC failure"
        assert required in archive.namelist(), "Wrong backup scope"
        count = len(archive.namelist())
    reports.append({"archive":name,"bytes":path.stat().st_size,"entries":count,"crc":"passed","sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"publiclyUploaded":False})
target = root / "output/qa/campaign-rebuild/rollback-checks.json"
target.write_text(json.dumps(reports,indent=2),encoding="utf-8")
print(json.dumps(reports,indent=2))
