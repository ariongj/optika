"""Read-only pixel comparison of original and CDN-served deployment images."""
from pathlib import Path
import json
import zipfile
import io
from PIL import Image, ImageChops, ImageStat

root = Path(__file__).resolve().parent.parent
qa = root / 'output/qa/whole-site'
report = json.loads((qa / 'live-exact-release.json').read_text())
release = zipfile.ZipFile(root / 'release/optika-itdks-whole-site-20260929-r6.zip')
backup = zipfile.ZipFile(qa / 'optika-pre-whole-site-public-20260929.zip')
results = []
for check in report['checks']:
    if check.get('exactMatch') is not False:
        continue
    name = check['path']
    original = Image.open(io.BytesIO(release.read(name))).convert('RGBA')
    live = Image.open(qa / 'live-images' / name.replace('/', '_')).convert('RGBA')
    same_size = original.size == live.size
    difference = ImageStat.Stat(ImageChops.difference(original, live)).mean if same_size else None
    results.append({
        'path': name, 'originalSize': original.size, 'liveSize': live.size,
        'sameAsPreviousOrigin': release.read(name) == backup.read(name),
        'meanChannelDifference255': difference,
        'visuallyEquivalentCompression': same_size and max(difference) < 4,
    })
(qa / 'live-image-comparison.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
raise SystemExit(0 if all(item['visuallyEquivalentCompression'] for item in results) else 1)
