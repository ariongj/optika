"""Build a verified, additive division-site upgrade, never a fresh installation."""

import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path


def require(condition, message):
    if not condition:
        raise SystemExit(message)


root = Path(__file__).resolve().parent.parent
build = root / "dist"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--name", default="optika-itdks-divisions-20260929-r7")
parser.add_argument("--report-dir", default="division-release")
parser.add_argument("--frontend-only", action="store_true", help="Package public UI assets only; preserve every existing API endpoint")
parser.add_argument("--include-seo", action="store_true", help="Add only the read-only public SEO renderer and public metadata registry")
parser.add_argument("--include-bootstrap", action="store_true", help="Include the credential-free core upgrade; requires existing private administrator configuration")
parser.add_argument("--include-account-hardening", action="store_true", help="Include the account and prescription concurrency fixes without runtime data")
args = parser.parse_args()
for value in (args.name, args.report_dir):
    require(re.fullmatch(r"[a-z0-9-]+", value), "Use a lowercase release/report slug, not a path")

target = root / "release" / f"{args.name}.zip"
report_path = root / "output" / "qa" / args.report_dir / "deployment-package.json"
require(build.is_dir(), "Build dist first; no build directory exists")
require(not target.exists(), "Refusing to overwrite an existing release")

# Only explicitly selected source endpoints are upgraded; private account,
# credential, prescription and commerce records never enter the archive.
require(not args.frontend_only or not (args.include_bootstrap or args.include_account_hardening), "Frontend-only releases cannot include PHP upgrades")
patched_api = set() if args.frontend_only else {"api/index.php", "api/submit.php", "api/holding-content.php"}
seo_files = {"api/seo.php", "api/seo-render.php", "api/seo-template.html"} if args.include_seo else set()
if args.include_seo:
    patched_api.update({"api/seo.php", "api/seo-render.php"})
if args.include_bootstrap:
    bootstrap_source = (root / "public/api/bootstrap.php").read_text(encoding="utf-8")
    require("OM_DEFAULT_PASSWORD_HASH" not in bootstrap_source and "OM_DEFAULT_PASSWORD_SALT" not in bootstrap_source,
            "Refusing to package a bootstrap with embedded credential defaults")
    require("function om_credentials_ready(" in bootstrap_source, "Missing safe administrator configuration check")
    patched_api.add("api/bootstrap.php")
if args.include_account_hardening:
    patched_api.update({"api/account.php", "api/prescription-upload.php"})
excluded_roots = {"api", "uploads", "server", "data", "storage", "optika-miftari-data", "node_modules", "output", "tmp"}
public_extensions = {".html", ".js", ".css", ".webp", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".webmanifest", ".xml", ".txt", ".wasm", ".task"}
required_routes = {
    "index.html", "optical/index.html", "clinic/index.html", "laboratory/index.html",
    "laboratory/partners/index.html", "laboratory/kosovo/index.html", "laboratory/europe/index.html",
    "shop/index.html", "sunglasses/index.html", "prescription-glasses/index.html",
    "account/index.html", "staff/index.html",
}
required_images = {
    "assets/brand/optika-craftsmanship-2026.webp",
    "assets/brand/miftari-lab-partnership.webp",
    "assets/brand/miftari-lab-partnership-small.webp",
    "assets/brand/miftari-optical-lifestyle.webp",
    "assets/brand/miftari-optical-lifestyle-small.webp",
    "assets/brand/miftari-clinic-2026.webp",
    "assets/brand/optika-miftari-monogram.png",
}
entries = []
for source in sorted(build.rglob("*")):
    relative = source.relative_to(build)
    name = relative.as_posix()
    if relative.parts[0].lower() in excluded_roots and name not in patched_api and name not in seo_files:
        continue
    require(not source.is_symlink(), f"Symlink is not permitted in this release: {name}")
    if not source.is_file():
        continue
    require(source.resolve().is_relative_to(build.resolve()), f"File escapes the build directory: {name}")
    require(name == ".htaccess" or not any(part.startswith(".") for part in relative.parts), f"Hidden file is not permitted: {name}")
    require(not any(term in name.lower() for term in ("credentials", "password", "secret", "session", "private", "-seed.")), f"Private or seed-like path is not permitted: {name}")
    if name in patched_api:
        require(source.read_bytes() == (root / "public" / relative).read_bytes(), f"Stale PHP build; rebuild before packaging: {name}")
    else:
        require(name in {".htaccess", "seo-pages.json"} or source.suffix.lower() in public_extensions, f"Unexpected public file type: {name}")
        require(source.suffix.lower() != ".php", f"PHP outside the explicit allowlist: {name}")
        require(source.suffix.lower() != ".txt" or name in {
            "robots.txt", "assets/fonts/manrope-OFL.txt",
            "assets/fonts/cormorantgaramond-OFL.txt", "assets/fonts/ibmplexmono-OFL.txt",
        }, f"Unexpected text handoff or access file: {name}")
    payload = source.read_bytes()
    entries.append({"path": name, "source": source, "bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()})

names = {entry["path"] for entry in entries}
require(len(names) == len(entries), "Duplicate archive entry")
require(patched_api <= names, "Missing one or more required patched PHP files")
require(seo_files <= names and (not args.include_seo or "seo-pages.json" in names), "Missing public SEO renderer/template/registry")
require(required_routes <= names, "Required division routes missing: " + ", ".join(sorted(required_routes - names)))
require(required_images <= names, "Required campaign images missing: " + ", ".join(sorted(required_images - names)))
require({".htaccess", "sitemap.xml", "robots.txt", "manifest.webmanifest"} <= names, "Missing hosting or metadata files")
require({name for name in names if name.startswith("api/")} == patched_api | seo_files, "Unexpected API file in upgrade")
require({name for name in names if name.lower().endswith(".php")} == patched_api, "Unexpected PHP file in upgrade")

target.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(target, "x", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for entry in entries:
        payload = entry["source"].read_bytes()
        require(hashlib.sha256(payload).hexdigest() == entry["sha256"], f"Build changed while packaging: {entry['path']}")
        info = zipfile.ZipInfo(entry["path"])
        info.create_system = 3
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(info, payload)

with zipfile.ZipFile(target) as archive:
    require(archive.testzip() is None, "ZIP CRC verification failed")
    require(set(archive.namelist()) == names and len(archive.namelist()) == len(entries), "ZIP entry list differs from manifest")
    for entry in entries:
        name = entry["path"]
        payload = archive.read(name)
        require(payload == entry["source"].read_bytes(), f"ZIP bytes differ from final build: {name}")
        require(hashlib.sha256(payload).hexdigest() == entry["sha256"], f"ZIP SHA-256 differs from manifest: {name}")
        require(len(payload) == entry["bytes"], f"ZIP length differs from manifest: {name}")
        require((archive.getinfo(name).external_attr >> 16) & 0o777 == 0o644, f"Incorrect permission bits: {name}")
    require('href="https://optika.itdks.tech/"' in archive.read("index.html").decode("utf-8"), "Homepage canonical does not target the Optika subdomain")
    sitemap = archive.read("sitemap.xml").decode("utf-8")
    for market, language in (("kosovo", "sq"), ("europe", "en")):
        page = archive.read(f"laboratory/{market}/index.html").decode("utf-8")
        url = f"https://optika.itdks.tech/laboratory/{market}/"
        require(f'lang="{language}"' in page, f"Incorrect document language for {market}")
        require(f'href="{url}"' in page, f"Missing canonical for {market}")
        require(url in sitemap, f"Missing sitemap entry for {market}")

report = {
    "artifact": target.name,
    "files": len(entries),
    "bytes": target.stat().st_size,
    "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
    "target": "https://optika.itdks.tech",
    "crc": "passed",
    "exactMatchToBuild": True,
    "manifestHashesVerified": True,
    "fileMode": "0644",
    "patchedApi": sorted(patched_api),
    "requiredRoutes": sorted(required_routes),
    "requiredImages": sorted(required_images),
    "preserved": (["all existing API endpoints"] if args.frontend_only else ([] if args.include_bootstrap else ["bootstrap.php"])) + ["private runtime data", "credentials", "customer accounts", "orders", "uploads", "catalogue and account seed files", "other PHP endpoints"],
    "administratorRequirement": "Existing private credentials.json required; no built-in password fallback" if args.include_bootstrap else "Existing administrator configuration preserved",
    "deployment": "Upgrade only: additive extraction into existing public_html; no deletion or data migration. Not a fresh-install package.",
    "deploymentStatus": "packaged-not-deployed",
    "manifest": [{key: entry[key] for key in ("path", "bytes", "sha256")} for entry in entries],
}
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps({key: value for key, value in report.items() if key != "manifest"}, indent=2))
