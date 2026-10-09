// Anonymous GET-only checks against this project's isolated preview. No writes to APIs.
import fs from "node:fs/promises";
import http from "node:http";
import assert from "node:assert/strict";
import { blogPosts } from "../src/data/catalog.js";
const base = "http://127.0.0.1:4190";
// Node's Fetch denylist includes this project's registered preview port.
// Use the native local HTTP client; do not move or reconfigure the server.
const get = url => new Promise((resolve, reject) => {
  const request = http.get(url, response => {
    const chunks = [];
    response.on("data", chunk => chunks.push(chunk));
    response.on("end", () => resolve({ ok: response.statusCode === 200, text: async () => Buffer.concat(chunks).toString("utf8") }));
    response.on("error", reject);
  });
  request.setTimeout(10000, () => request.destroy(new Error("Local route check timed out")));
  request.on("error", reject);
});
const routes = ["/", "/optical", "/shop", "/prescription-glasses", "/sunglasses", "/ekzaminimi", "/virtual-try-on", "/wishlist", "/account", "/order-status", "/policies", "/laboratory", "/lens-focus", "/laboratory/kosovo", "/laboratory/europe", "/laboratory/partners", "/contact", "/about", "/clinic", "/staff", ...blogPosts.map(post => `/lens-focus/articles/${post.slug}`)];
const checks = [];
const check = (name, passed) => { checks.push({ name, status: passed ? "verified" : "failed" }); assert.ok(passed, name); };
for (const path of routes) {
  const response = await get(base + path);
  const html = await response.text();
  check(`${path}: HTML route`, response.ok && html.includes("<!doctype html>"));
  check(`${path}: application script`, /type="module"[^>]*src="\/assets\/index-/.test(html));
}
const lens = await fs.readFile("dist/lens-focus/index.html", "utf8");
check("Lens Focus metadata follows the new page", lens.includes("Bota juaj. Në fokus.") && lens.includes("Lentet tuaja, hap pas hapi"));
check("Initial public page no longer preloads Three.js or administrator code", !/<link[^>]*modulepreload[^>]*(?:three-|AdminPortal-|LegacyAssemblyScene)/.test(lens));
const assets = [...lens.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map(match => match[1]);
for (const path of assets) {
  const response = await get(base + path);
  check(`${path}: asset served`, response.ok && !(await response.text()).startsWith("<!doctype html>"));
}
const story = await get(base + "/crafted-lens/index.html?mode=guided&v=20260929-lens-studio");
check("User-controlled lens animation served", story.ok && (await story.text()).includes("data-mobile-legend"));
const report = { checkedAt: new Date().toISOString(), environment: base, status: "locally verified; not deployed", checks, noApiMutations: true };
await fs.mkdir("output/qa/menu-lens", { recursive: true });
await fs.writeFile("output/qa/menu-lens/local-acceptance.json", JSON.stringify(report, null, 2));
console.log(`${checks.length}/${checks.length} local route and build checks passed. No API mutations.`);
