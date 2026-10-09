"""Check the rebuilt public files against an already verified release manifest."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
report_dir = root / "output/qa/readiness-20260930"
release = json.loads((report_dir / "deployment-package.json").read_text(encoding="utf-8"))
checks = []
for entry in release["manifest"]:
    target = (root / "dist" / entry["path"]).resolve()
    if not target.is_relative_to(root / "dist"):
        raise SystemExit("Manifest path leaves the build")
    actual = hashlib.sha256(target.read_bytes()).hexdigest() if target.is_file() else "missing"
    checks.append({"path": entry["path"], "status": "verified" if actual == entry["sha256"] else "failed", "expected": entry["sha256"], "actual": actual})
proof = {"scope": "Final patched-toolchain rebuild compared with the delivered r11 manifest", "artifact": release["artifact"], "summary": {"total": len(checks), "verified": sum(check["status"] == "verified" for check in checks), "failed": sum(check["status"] == "failed" for check in checks)}, "checks": checks}
(report_dir / "final-rebuild-proof.json").write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
print(json.dumps({**proof["summary"], "failures": [check for check in checks if check["status"] == "failed"]}, indent=2))
if proof["summary"]["failed"]:
    raise SystemExit(1)
live_proof = json.loads((report_dir / "deployment-proof.json").read_text(encoding="utf-8"))
live_audit = json.loads((report_dir / "live-audit.json").read_text(encoding="utf-8"))
live_browser = json.loads((report_dir / "live-browser-acceptance.json").read_text(encoding="utf-8"))
if live_proof["artifactSha256"] != release["sha256"] or any(report["summary"]["failed"] for report in (live_proof, live_audit, live_browser)):
    raise SystemExit("Cannot mark the release publicly verified without matching successful live evidence")
release["deploymentStatus"] = "deployed-live-public-verified"
release["liveVerification"] = {
    "at": live_proof["at"],
    "assetAndRedirectChecks": live_proof["summary"]["verified"],
    "seoChecks": live_audit["summary"]["verified"],
    "browserChecks": live_browser["summary"]["verified"],
    "privateWorkflowScope": "Isolated local tests only; live protected writes/providers remain unverified",
    "patchedToolchainBuildMatchesRelease": True,
}
(report_dir / "deployment-package.json").write_text(json.dumps(release, indent=2) + "\n", encoding="utf-8")
