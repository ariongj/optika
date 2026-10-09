# Optika Miftari Virtual Try-On 3D

## What is included

The public experience at `/virtual-try-on` has three connected modes:

- **Live Camera:** on-device face-landmark tracking, smoothed 3-axis pose, bridge anchoring, frame scaling, face-depth occlusion and front/rear camera switching.
- **Photo:** local JPG/PNG/WEBP analysis with automatic placement, optional front/left/right portrait slots, and manual scale, horizontal, vertical and rotation controls. Each angle is processed on-device and can be reviewed without uploading the visitor's image.
- **3D Product:** drag, zoom, reset, full-screen and keyboard controls. Arrow keys rotate, `+`/`-` zoom and `0` resets the view.

The selected product, simulated frame colour, lens colour and tint intensity remain available when switching modes. Capture, comparison, favourite, share, catalogue add-to-cart, fitting booking and prescription-lens continuation are connected to the existing catalogue flows. **Add-to-cart adds the selected catalogue SKU and quantity only:** simulated colours and tint are not purchased lens specifications. Prescription options are chosen on the product page. A frame with zero stock cannot be added from this studio.

Products explicitly disabled for Virtual Try-On in Operations do not expose a broken 3D entry point.

## Browser and device support

Camera mode requires HTTPS in production; browsers expose `getUserMedia()` only in a secure context. Localhost is allowed for development. See [MDN: MediaDevices.getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

| Platform | Live Camera | Photo | 3D Product | Release status |
| --- | --- | --- | --- | --- |
| Current Chrome / Edge desktop | Targeted | Targeted | Targeted | Desktop UI and no-camera flow verified locally |
| Current Chrome / Safari on iOS and Android | Targeted | Targeted | Targeted | Responsive UI verified by emulation; physical-device camera QA required |
| Current Safari macOS | Targeted | Targeted | Targeted | Physical-device camera QA required |
| Current Firefox | Best effort | Targeted | Targeted | Live tracking needs physical-device QA |
| In-app webviews / older devices | Not guaranteed | Best effort | Best effort | Use Photo or 3D Product fallback |

The tracker tries GPU execution first and falls back to CPU. WebGL, WebAssembly, camera permissions, available memory and GPU drivers still vary by device.

## 3D asset requirements

Operations accepts binary glTF 2.0 (`.glb`) files up to 20 MB. The server verifies the GLB header, version and declared file length before storing the file.

Production target per frame:

- preferred transfer size: under 3 MB;
- recommended geometry: 30,000–60,000 triangles on desktop and at most about 30,000 for a mobile-first asset;
- textures: 1024 px normally, 2048 px only for details that remain visible in close view;
- one product at real scale, centred at the bridge, with transforms applied before export;
- separate meshes/materials named with recognizable terms such as `frame`, `front`, `left_lens`, `right_lens`, `left_temple`, `right_temple`, `hinge`, `bridge`, `nose_pad` and `logo`;
- PBR base colour, metalness and roughness materials; avoid uncompressed oversized textures and hidden geometry.

Draco-compressed geometry is **not enabled in this release**. Export a standard GLB unless a Draco decoder is added and tested.

The public studio uses an uploaded product GLB when it loads successfully. Otherwise it displays a **clearly labelled dimensional approximation**, constructed from the catalogue frame shape and measurements. Missing or invalid measurements use bounded default values, not measurements inferred from the visitor's face. The approximation is not an exact product scan, a manufactured specification or proof of fit; the adjacent catalogue photograph remains the visual product reference.

**Automatic reconstruction from perspective catalogue photographs is disabled in the visitor flow.** A photographed frame already contains perspective and temples; mapping that image onto a plane with additional generated temples produced duplicate, disconnected-looking arms. A single 2D image cannot establish accurate 3D geometry. The renderer retains a separately gated experimental front-photo path, but the public component explicitly disables it; there is no claim that it digitizes products.

Uploaded GLBs are normalized after their authoring rotation, with the front plane anchored at the bridge and translation scaled with the geometry. Product viewing fits the rotated model bounds to the available canvas. Live/photo rendering keeps the bridge anchored to the tracked face rather than shifting it with the model's rearward centre of mass. The interface distinguishes catalogue models, approximations and GLB-load failures.

## Product measurements

Record these values from the manufacturer or a calibrated physical sample:

- total frame width in millimetres;
- lens width and lens height;
- bridge width;
- temple length;
- available size variants;
- prescription compatibility, colours, lens options, price and stock.

Do not infer exact optical measurements from a product photograph. The interface describes its size output as visual guidance and directs the customer to professional verification.

## Adding and calibrating a model

1. Sign in at `/staff` and open **Products**.
2. Create or edit the catalogue product.
3. In **Virtual Try-On 3D**, enable the feature and upload the optimized `.glb`.
4. Enter all five real measurements.
5. Use the embedded front, angled and profile preview.
6. Adjust scale, vertical offset and X/Y/Z rotation until the bridge and front plane are centred.
7. Confirm frame and lens mesh names so colour changes target the correct materials.
8. Save the product, open it on the public site and test Live, Photo and 3D Product modes on both desktop and a real phone.
9. If alignment is not acceptable, disable Virtual Try-On for that product until calibration is corrected.

The current CMS exposes scale, vertical offset and rotation calibration. Each uploaded asset still requires comparison with its real physical product. There is no automatic guarantee that a GLB is correctly oriented, product-exact or optically calibrated. Per-product 3D anchor points, temple deformation and a visual face-anchor editor would require a later specialist calibration module.

## Privacy and data flow

```text
Camera / selected photo
        ↓
Browser memory on the visitor's device
        ↓
MediaPipe Face Landmarker (on-device landmarks)
        ↓
Transient pose values → Three.js renderer
        ↓
Optional user-initiated capture / download
```

- Camera permission is requested only after the visitor presses the consent button.
- Camera tracks stop when the visitor changes mode, presses **Fik kamerën**, leaves the component or hides the page. A permission request completing after cancellation cannot attach a stale camera stream.
- Video is not recorded or uploaded by the application.
- Uploaded photos are read with `FileReader`, remain in browser memory and are not posted to the Optika API.
- Raw images, video and facial landmarks are not included in analytics events.
- Captures exist only in the current React session unless the visitor explicitly downloads or shares them; the comparison tray includes a clear control.
- Each portrait slot has a deletion action. A portrait is not converted into a rotatable 3D head: the three slots remain separate photographs with their own detected pose.
- No identity, health, ethnicity or other sensitive trait inference is performed.
- MediaPipe documents on-device input processing, but its npm privacy notice states that performance and utilization metrics may be sent to Google. This must be reflected in the production privacy/cookie review: [@mediapipe/tasks-vision on npm](https://www.npmjs.com/package/@mediapipe/tasks-vision).

## Performance architecture

- The Virtual Try-On React interface is route-lazy-loaded.
- MediaPipe is split into its own JavaScript chunk and loaded for the try-on flow.
- The face model and WebAssembly runtime are hosted locally under `/mediapipe/`.
- GLBs are requested only for the selected product; the catalogue does not download every 3D model.
- The standard visitor path does not load or process catalogue photos for reconstruction.
- Rendering pixel ratio is capped more aggressively on small screens.
- Camera requests target 960 × 720 at 30 FPS; detection is capped at 30 updates per second. Actual capture size and speed remain device-dependent.
- Rendering pauses outside the viewport or while the document is hidden. Canvas dimensions and orthographic projection update through `ResizeObserver`; portrait pose is also recomputed when the stage changes size.
- Product viewing has an adaptive desktop stage height, a single scrolling configuration panel and purchase actions immediately after the selected product. Mobile retains its compact stacked layout.
- GPU tracking falls back to CPU, and Photo / 3D Product remain available when camera mode cannot run.
- Apache/LiteSpeed cache and MIME rules for `.wasm` and `.glb` are included in `.htaccess`.

The runtime target is approximately 30 FPS on supported modern mobile devices, but this has not been certified across physical devices in this workspace. Battery, thermals, GPU and camera resolution affect sustained performance.

## Analytics events

The first-party analytics path records event names and product/configuration metadata, including open, mode change, camera permission, face detection, product/colour/lens change, capture, comparison, favourite, share, fitting request, add-to-cart, completion and errors. It must never be extended with raw landmarks, photos or video frames.

## Verification record

September 29, 2026 feature-polish pass:

- **Passed:** `node --test scripts/try-on-realism.test.mjs` covers crop mapping, matrix extraction, mirroring, aspect-correct roll, head-turn scale, manual controls, camera-session cancellation, symmetric dimensional geometry, mask exclusion, GLB normalization and all-angle canvas fitting.
- **Passed:** 108 aspect/angle/pitch/zoom combinations test all eight model-bound corners against the available viewport (864 corner checks).
- **Passed:** JSX compilation through Vite's `transformWithEsbuild` after the feature changes.
- **Verified locally:** desktop/mobile product-view screenshots were reviewed after the adaptive-height and purchase-order changes. The 1280 × 900 desktop stage measures 430px; the selected product and purchase actions remain together above configuration. Photo mode analyzed a public illustrative fixture, accepted a manual adjustment and removed the photo on request. This is pipeline evidence, not a real-person fit-accuracy benchmark. See `output/qa/feature-polish/browser-workflows.md` and the final screenshots.
- **Unverified physical-device gate:** iOS Safari, Android Chrome and real-camera permission/tracking, lighting, session stability and thermal performance.
- **Unverified product-accuracy gate:** individual commercial frames need calibrated, physically verified product-specific GLBs or approved third-party digitization. Procedural previews do not satisfy this gate.
- These source/unit checks do not assert deployment, payment behaviour or production readiness.

## Known limitations

- Without a calibrated uploaded GLB, the studio uses explicitly labelled procedural geometry. It does not make a real product scan from a catalogue photograph.
- Occlusion uses an approximate depth-only face ellipsoid. Hair segmentation and strand-level occlusion are not included. In product-only view, temples may naturally remain visible through semi-transparent lenses at some angles.
- The tracker estimates a visual head pose; it does not provide clinically validated pupillary distance or optical centration.
- The studio provides positioning guidance, not a face-width verdict. Final bridge fit, pantoscopic angle, PD, fitting height and prescription lens centration require an optician.
- Temple opening/closing animation is available only when a future product asset and animation controller provide it.
- Physical-device, demographic, lighting, hairstyle, eyewear-on-face and long-session thermal testing remains a launch gate.

For a provider-backed alternative with eyewear digitization and commercial device QA, evaluate [Banuba Eyewear Virtual Try-On](https://www.banuba.com/glasses-virtual-try-on), [Perfect Corp eyewear solutions](https://www.perfectcorp.com/business/products/virtual-try-on) or [DeepAR](https://www.deepar.ai/). Provider licensing, privacy terms and data flows require separate approval.
# LUNA AI guide — 5 October 2026

The try-on screen now includes an expandable Albanian/English LUNA panel above the preview. It answers questions about camera permissions, local photo placement, manual alignment and the 3D viewer using `gpt-6-luna`. Quick controls open the existing modes; changing mode collapses the panel and restores focus to the selected tab. Camera access still requires the existing explicit start button.

This is a text-based tool guide, not AI face analysis, a face scanner, a 3D generator or a clinical measurement service. The provider receives the submitted question, language, mode, basic technical status and an allowlisted subset of public catalogue frame details. Photos, video, face landmarks, account records and conversation history are not sent. The panel requires an unchecked-by-default sharing choice. Responses are rendered as plain text, not HTML; model text cannot execute actions or change a basket. No prompts or answers are saved by the application. Requests use `store: false`; this does not make a claim about provider retention policy.

## Private configuration and deployment

- The approved key is stored locally in the ignored workspace `.env.local` and, after explicit activation approval, in Hostinger's private `optika-miftari-data/luna.env`, outside `public_html`, with owner-only permissions (0600). It is not a `VITE_` variable and must never be placed in a frontend bundle, public file, repository or release ZIP.
- The PHP worker reads `OPENAI_API_KEY` from its server environment first, otherwise from that fixed private sibling file. The file parser accepts one literal `OPENAI_API_KEY` only; it never executes configuration. Missing, malformed, oversized, symlinked, publicly located or world-accessible configuration is rejected. PHP cURL and a valid CA trust store are required. Local `.env.local` is loaded by the Node preview launcher, not by the browser. Uploading the upgrade ZIP alone does not install the secret.
- Set `OPTIKA_LUNA_ENABLED=0` to disable AI without disabling the try-on tools. The exact model is fixed to `gpt-6-luna` without silent fallback.
- Limits: 600-character question, 4 KiB request, 400 output tokens, 25-second provider timeout; six requests/minute and twenty/hour per daily-hashed IP; 200 attempts/day globally by default. `OPTIKA_LUNA_DAILY_LIMIT` can set 1–5000 attempts/day. Limits count attempted calls, including failures, and the global counter is protected by a file lock. These are request guards, not a currency budget or a replacement for provider account limits.
- Private `OPTIKA_STORAGE_DIR` contains `luna-usage.json` and `luna-usage.lock`: counters, timestamps and daily-hashed IPs only. The current day replaces the previous day on the next request. No customer questions, photos, answers or secrets are stored there.
- Unknown input fields (including images/history), absent consent, invalid CSRF, invalid modes and cross-origin requests are rejected. Missing configuration/provider failures are shown honestly; the underlying camera/photo/3D tools remain available.

## Local verification

After the regular build and prerender, run `php scripts/luna-core.test.php`. Use `node --env-file=.env.local scripts/luna-qa.mjs --live` for isolated endpoint checks with three synthetic provider requests, or omit `--live` for checks without generation. `node --env-file=.env.local scripts/luna-qa.mjs --serve` opens the isolated PHP preview on the registered loopback port 4190; it refuses an occupied port, disables outbound mail and uses a new private QA data directory. Stop that launcher when finished. The scripts assume the existing local `tmp/php-8.5.9` runtime.

The 5 October r16 deployment was followed by r17 activation with explicit user approval, then r18 localized-label guidance. **LUNA replies are active on https://optika.itdks.tech** and real-domain `gpt-6-luna` responses were verified. Public routes, assets and the mobile flows below were checked on the real domain. Hardware camera and personal-photo workflows were not used in LUNA testing.

### Verified release: r16

- Build and prerender passed; 196 existing JavaScript unit tests and 20 LUNA PHP checks passed.
- Final isolated API run: 24 checks passed, including three real `gpt-6-luna` answers, missing configuration, consent, CSRF, cross-origin/method/body rejection, image/history rejection, and minute/hour/day limits. Evidence: `output/qa/luna-20261005/api-live.json`.
- Browser: real English and Albanian answers; unchecked consent blocks submission; photo/3D shortcuts collapse the panel and focus the selected tab; keyboard rotation changes 0 to 7 degrees and the guide's centre action restores 0; fullscreen exits with Escape; no automatic camera start and no browser console errors observed.
- Responsive: open panel and answer checked at 320, 390, 768 and 1440 pixels in both languages; no horizontal overflow and 16-pixel question input. Desktop and mobile screenshots were visually inspected during testing; no screenshot files are included in the ZIP.
- Release: `release/optika-itdks-luna-upgrade-20261005-r16.zip`, 254 files, 19,623,092 bytes. CRC, exact packaged/build match and 0644 permissions passed. SHA-256: `0edbb828f1fcd9d600319a1e358c076ea936c13a312ada9bf7b19ca82eb8f273`.
- All 260 built files were checked against the exact local API key without printing it: zero matches. The release excludes environment files and private runtime data. New PHP endpoints are explicitly included in the packaging allowlist.

### Hostinger deployment verification — 5 October 2026

- Target verified in the authenticated dashboard: `optika.itdks.tech`. The exact r16 archive was uploaded outside the web root, then extracted with overwrite into `public_html/.`; existing uploads and private operational data were not part of the package. Site-specific cache clearing returned success.
- Fresh pre-deployment public/data rollback archives were created outside the public root and downloaded to a separate machine. Local private copies and CRC/SHA-256/per-entry integrity evidence: `output/qa/luna-20261005/rollback/`. Public archive: 64,741,217 bytes / 315 entries. Data archive: 237,212 bytes / 16 entries. Neither belongs in a public release.
- Live GET-only audit: 1,500/1,500 checks passed across 96 indexable URLs plus utility routes, metadata, links, assets and 404 behavior. Evidence: `output/qa/luna-deploy-20261005/live-audit.json`.
- Deployment checks: 134/134 passed. All 125 checked asset files match the built release, either directly through the CDN or at the authenticated-dashboard hosting origin with normal TLS validation. Seventeen CDN-served image byte streams differ, while their origin hashes match exactly. Public APIs, anonymous session states and non-public secret/archive paths passed. Evidence: `output/qa/luna-deploy-20261005/release-check.json`.
- Real-domain browser checks: English/Albanian mode switching; mobile 3D shortcut and 40-degree rotation; photo upload controls visible; add-to-bag for Vortex X1 at EUR 420; delivery form reachable at 320 px; no horizontal overflow in the checked 320/390 px states; 16 px Luna question input; no console errors observed. The temporary cart item was removed afterward. Screenshots were visually inspected but not saved to files.
- No live orders/payments, account mutations, camera access or personal photo uploads were performed. Authenticated operational workflows and physical-device camera tests are not claimed as live-verified. The AI panel honestly shows configuration-required; live provider responses remain blocked on secret-destination approval and activation.

### Activated demo: r18 — 5 October 2026

This supersedes the r16 activation blocker above. The user explicitly approved activation and private key storage. The approved file was saved outside the web root and restricted to 0600. Server-side credential handling follows the [official OpenAI authentication guidance](https://developers.openai.com/api/reference/overview). No key was placed in source, browser code, or ZIPs.

- Final package: `release/optika-itdks-luna-demo-20261005-r18.zip`; 254 entries; 19,623,757 bytes; SHA-256 `104340caa372b5646d6d922ff7a66a8e9c7e8d5a124476e974fd70a0d3d50a0c`. CRC/build/permission checks passed. Only `api/luna.php` and `api/luna-core.php` differ from the previously verified r16 release. The deployed versions of both PHP files were downloaded through the authenticated file manager and their hashes matched source and final build. The r17 archive was deployed, then its single `luna-core.php` was updated to the exact r18 version.
- 35 focused PHP checks passed (29 input/payload/output/config-parser checks plus six private-file checks). The activated loader passed 24 isolated API regressions, including three real answers. Real-domain activation checks passed 10/10: exact requested model, a real Albanian reply, CSRF/consent/image-field rejection and non-public key/archive paths.
- Real-browser answers verified in Albanian and English. A mixed-language reset label in one English answer was corrected; the final live answer used “Centre the view,” and the repeated English 3D preset returned fully English labels. Consent is initially unchecked and blocks submission. The 3D shortcut works. At 320 and 390 px, answers are readable with no horizontal overflow and 16 px question input. No console errors observed. Screenshots were visually inspected, not saved as files.
- The post-activation GET-only site audit passed 1,500/1,500 checks. Evidence: `output/qa/luna-activation-20261005/`; final package, deployed-file hashes and secret-exclusion summary: `output/qa/luna-demo-final-20261005/`. All 260 build files passed exact-key exclusion. No customer records or real orders/payments were changed.
- Rollback: restore the two API files from the preserved r16 package to return to environment-only/unconfigured Luna, leaving the rest of the site and private business records intact. Preserve the separately protected private secret; never include it in a public rollback ZIP. Existing full pre-deployment backups remain in the private hosting root and local ignored rollback folder.

#### Two-minute demonstration

1. Open https://optika.itdks.tech/virtual-try-on/?lang=sq and expand **LUNA · Asistenti AI**.
2. Select **Si ta nis kamerën?**, review and tick the OpenAI sharing choice, then press **Pyet LUNA-n**. Show the real Albanian guidance; this does not start the camera.
3. Press **Shiko në 3D**. Rotate the model with the left/right presets, then centre it. No camera or account is needed for this portion.
4. Switch to **EN**, reopen LUNA, and ask **How do I use the 3D model?**. Show the English answer and the photo/camera shortcuts.
5. If showing the bag, add the catalogue frame and proceed only as far as the delivery form. Do not submit a real order during a demonstration. Remove the temporary bag item afterward.

Demo scope: real AI text help and the existing illustrative try-on tools, not AI face analysis, medical measurements or accurate product reconstruction. Photos and camera footage are not sent to Luna. Actual hardware-camera/personal-photo QA, payment/provider readiness and broader production acceptance are separate from this demo sign-off. Request limits remain six/minute, twenty/hour per daily-hashed IP and 200/day globally; do not remove these guards for a demo.
- Unverified: live Hostinger setup/deployment, real-domain provider access, hardware camera/personal-photo journeys, and forced provider outage/timeout behavior. This verification is not a full security or accessibility audit. The temporary QA server was stopped after testing.
