import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { blogPosts, products } from "../src/data/catalog.js";
import { holdingDefaults } from '../src/holdingContent.js';
import { guideDetails } from '../src/guideContent.js';
import { editorialMedia } from '../src/editorialMedia.js';
import { pageDefinitions } from '../src/seoPages.js';
import { canonicalUrl, socialImagePath, productSeoTitle, articleSeoTitle, seoGraph, privateSeoPaths } from '../src/seo.js';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(projectRoot, "dist");
const publicDir = join(projectRoot, "public");
const siteUrl = (process.env.VITE_PUBLIC_SITE_URL || "https://optikamiftari.com").replace(/\/$/, "");
const baseTemplate = (await readFile(join(distDir, "index.html"), "utf8"))
  .replaceAll('https://optikamiftari.com', siteUrl);

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const absoluteUrl = (path = "/") => `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
const productPath = (product) => `/${product.type === "Sunglasses" ? "syze-dielli" : "syze-optike"}/${encodeURIComponent(product.id)}`;
const productType = (product) => product.type === "Sunglasses" ? "Syze dielli" : "Syze me dioptri";
const sqLabels = {
  Square: "Katrore", Rectangle: "Drejtkëndore", Round: "Rrethore", Wrap: "Sportive", Aviator: "Aviator", "Cat-eye": "Sy mace", Geometric: "Gjeometrike",
  "Japanese acetate and titanium": "Acetat japonez dhe titan", "Beta titanium": "Titan beta", "Carbon polymer": "Polimer karboni", "Titanium and bio-acetate": "Titan dhe bio-acetat", "Titanium and acetate": "Titan dhe acetat", "Carbon polymer and titanium": "Polimer karboni dhe titan",
  "Pearl chrome": "Krom perle", "Ice grey": "Gri akulli", "Black pearl": "Perlë e zezë", "Champagne pearl": "Perlë shampanje", Clear: "E tejdukshme", "Blue-reflect": "Reflektim blu", "Blue-light": "Për dritën blu", Polarized: "E polarizuar", Gradient: "Gradient", Mirror: "Pasqyrë", "Clear Rx": "E tejdukshme"
};
const sqLabel = (value) => sqLabels[value] || value;
const formatPrice = (amount) => new Intl.NumberFormat("sq-XK", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
}).format(amount);



const sharedNav = `
  <header class="static-site-header">
    <a class="static-brand" href="/" aria-label="Optika Miftari, kthehu në ballinë">
      <img src="/assets/brand/optika-miftari-monogram.png" width="52" height="52" alt="" />
      <span>OPTIKA<strong>MIFTARI</strong></span>
    </a>
    <nav aria-label="Navigimi kryesor">
      <a href="/optical">Optical</a><a href="/laboratory">Optical Lab</a><a href="/clinic">Klinika Miftari</a><a href="/about">Grupi</a><a href="/contact">Kontakt</a>
    </nav>
  </header>`;

const staticFooter = `
  <footer class="static-site-footer">
    <strong>Optika Miftari</strong>
    <p>Mbretëresha Teutë 182, 40000 Mitrovicë · +383 43 777 667 · Hënë–Shtunë 10:00–19:30</p>
    <nav aria-label="Lidhje ndihmëse"><a href="/ekzaminimi/">Ekzaminimi</a><a href="/lens-focus/">Lens Focus</a><a href="/virtual-try-on/">Provo virtualisht</a><a href="/account/">Llogaria ime</a><a href="/policies/">Politikat</a><a href="/contact/">Kontakt dhe rezervime</a><a href="/order-status/">Gjurmo porosinë</a></nav>
  </footer>`;

const productCards = (page) => products.filter((product) => (page === "/prescription-glasses" ? product.type !== "Sunglasses" : page === "/sunglasses" ? product.type === "Sunglasses" : true)).slice(0, page === "/" ? 4 : products.length).map((product) => `
  <article><a href="${productPath(product)}"><img src="${escapeHtml(product.image)}" width="480" height="360" loading="lazy" alt="${escapeHtml(`${product.name}, ${productType(product).toLowerCase()}, pamja ballore`)}" /><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(productType(product))} · ${escapeHtml(formatPrice(product.salePrice || product.price))}</p></a></article>`).join("");

const staticPageBody = (definition) => {
  const [path, , , heading, copy] = definition;
  if (path === '/laboratory/europe') return `<header class="static-site-header"><a class="static-brand" href="/"><img src="/assets/brand/optika-miftari-monogram.png" alt="" width="52" height="52"/><span>OPTIKA<strong>MIFTARI</strong></span></a><nav aria-label="Main navigation"><a href="/laboratory">Optical Lab · Albanian</a><a href="/laboratory/kosovo">Kosovo · Shqip</a><a href="/laboratory/europe">European partnerships</a></nav></header><main class="static-route-page"><section class="static-route-hero"><p>OPTICAL LAB · MIFTARI HOLDING GROUP</p><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(copy)}</p><a class="static-primary-cta" href="tel:+38343777667">Contact the laboratory</a><a href="#application">Partner application</a></section><section class="static-route-hero" id="documentation"><h2>The right evidence, before the first order.</h2><p>${escapeHtml(holdingDefaults.labDocumentationNoteEn)}</p><p>Discuss product specifications, traceability, certificates, scope and cross-border arrangements before any order is accepted.</p></section><section class="static-route-hero" id="application"><h2>Start a professional partnership.</h2><p>Enable JavaScript to complete the secure application form, or call +383 43 777 667. Business contact information only; do not send patient records.</p></section></main><footer class="static-site-footer"><strong>Miftari Holding Group · Optical Lab</strong><p>Private laboratory in Kosovo. EU partnership enquiries.</p><a href="/laboratory/partners">Choose your market</a></footer>`;
  if (path === '/laboratory/kosovo') return `${sharedNav}<main class="static-route-page"><section class="static-route-hero"><p>OPTICAL LAB · KOSOVË</p><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(copy)}</p><a href="#application">Aplikoni për bashkëpunim</a><a href="/laboratory/europe">European partnerships · English</a></section><section class="static-route-hero" id="application"><h2>Prezantoni biznesin tuaj.</h2><p>Aktivizoni JavaScript për formularin e aplikimit ose telefononi +383 43 777 667. Aplikimi nuk është miratim partneriteti.</p><p>${escapeHtml(holdingDefaults.labDocumentationNoteSq)}</p></section></main>${staticFooter}`;
  if (path === '/') return `${sharedNav}<main class="static-route-page"><section class="static-route-hero"><p>MIFTARI HOLDING GROUP</p><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(copy)}</p></section><section class="static-product-grid">${[['Optical','/optical','Syze optike dhe syze dielli.'],['Optical Lab','/laboratory','Lente me recetë. Bashkëpunim B2B në Kosovë dhe Bashkimin Evropian.'],['Klinika Miftari','/clinic','Kujdes specialistik për sytë në Kosovë.']].map(([name, href, text]) => `<article><a href="${href}"><h2>${name}</h2></a><p>${text}</p></article>`).join('')}</section></main>${staticFooter}`;
  if (['/clinic','/laboratory/partners'].includes(path)) return `${sharedNav}<main class="static-route-page"><section class="static-route-hero"><p>MIFTARI HOLDING GROUP</p><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(copy)}</p><a class="static-primary-cta" href="tel:+38343777667">Kontaktoni ekipin Miftari</a><p>${path === '/clinic' ? 'Konsulta, kontrolle dhe kujdes kirurgjikal. Specialisti, shërbimi dhe orari konfirmohen nga ekipi. Ky kanal nuk shërben për urgjenca.' : 'B2B në Kosovë dhe Bashkimin Evropian. Specifikimet, afatet dhe logjistika konfirmohen individualisht.'}</p>${path === '/laboratory/partners' ? '<nav><a href="/laboratory/kosovo">Optical Lab Kosovë</a><a href="/laboratory/europe">Optical Lab Europe</a></nav>' : ''}</section></main>${staticFooter}`;
  const guideIndex = path === "/lens-focus" ? `<section class="static-route-hero"><h2>Udhëzues për lentet dhe kujdesin e syve</h2><nav aria-label="Të gjithë udhëzuesit">${blogPosts.map(article => `<p><a href="/lens-focus/articles/${encodeURIComponent(article.slug)}/">${escapeHtml(article.title)}</a> — ${escapeHtml(article.excerpt)}</p>`).join("")}</nav></section>` : "";
  const extra = path === "/optical" || path === "/shop" || path === "/prescription-glasses" || path === "/sunglasses"
    ? `<section class="static-product-grid" aria-label="Korniza të zgjedhura">${productCards(path)}</section>`
    : `<nav class="static-route-links" aria-label="Hapat e ardhshëm"><a href="/shop">Shfleto kornizat</a><a href="/contact#booking">Rezervo ekzaminimin</a><a href="/virtual-try-on">Provo virtualisht</a></nav>`;
  return `${sharedNav}<main class="static-route-page"><section class="static-route-hero"><p>OPTIKA MIFTARI · MITROVICË</p><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(copy)}</p><div><a class="static-primary-cta" href="/contact#booking">Rezervo ekzaminimin</a><a href="/shop">Shiko kornizat</a></div></section>${extra}${guideIndex}</main>${staticFooter}`;
};

const staticProductBody = (product) => {
  const gallery = (product.gallery?.length ? product.gallery : [product.image]);
  const categoryPath = product.type === "Sunglasses" ? "/sunglasses" : "/prescription-glasses";
  const familyId = product.baseId || product.id;
  const family = products.filter((candidate) => candidate.id === familyId || candidate.baseId === familyId);
  return `${sharedNav}<main class="static-product-page">
    <nav class="static-breadcrumb" aria-label="Breadcrumb"><a href="/">Ballina</a><span>›</span><a href="${categoryPath}">${productType(product)}</a><span>›</span><span aria-current="page">${escapeHtml(product.name)}</span></nav>
    <section class="static-product-above-fold">
      <div class="static-product-gallery"><img src="${escapeHtml(gallery[0])}" width="900" height="700" fetchpriority="high" alt="${escapeHtml(`${product.name}, ${productType(product).toLowerCase()}, pamja ballore`)}" /></div>
      <div class="static-product-summary"><p>OPTIKA MIFTARI · ${escapeHtml(product.collection)}</p><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description)}</p><p>${escapeHtml(`Kornizë ${sqLabel(product.frameShape).toLowerCase()} prej ${sqLabel(product.material).toLowerCase()}, me masë ${product.size} dhe përshtatje ${product.fitProfile || "mesatare"}.`)}</p><p class="static-product-price">${escapeHtml(formatPrice(product.salePrice || product.price))}</p><p class="static-stock">${product.stock > 0 ? `Në stok · ${product.stock} copë` : "Aktualisht nuk ka stok"}</p><a class="static-primary-cta" href="#konfigurimi">Konfiguro dhe shto në shportë</a><p>${escapeHtml(product.delivery || "Afati i përgatitjes konfirmohet para porosisë.")}</p><ul class="static-product-assurance"><li>Dërgesa: mënyra dhe kostoja në shportë</li><li>Marrja në optikë: zgjidheni në përfundim të porosisë</li><li>Përshtatja përfundimtare kontrollohet nga optiku</li><li><a href="/policies#returns">Kushtet e kthimit dhe përjashtimet</a></li></ul></div>
    </section>
    <section id="konfigurimi" class="static-product-details"><h2>Masat dhe specifikat</h2><dl>
      <div><dt>Modeli / SKU</dt><dd>${escapeHtml(product.name)} / ${escapeHtml(product.sku)}</dd></div><div><dt>Lloji</dt><dd>${escapeHtml(productType(product))}</dd></div><div><dt>Forma</dt><dd>${escapeHtml(sqLabel(product.frameShape))}</dd></div><div><dt>Materiali</dt><dd>${escapeHtml(sqLabel(product.material))}</dd></div><div><dt>Ngjyra</dt><dd>${escapeHtml(sqLabel(product.color))}</dd></div><div><dt>Thjerrëza</dt><dd>${escapeHtml(sqLabel(product.lensType))} · ${escapeHtml(sqLabel(product.lensColor))}</dd></div><div><dt>Mbrojtja</dt><dd>${escapeHtml(product.uv)}${product.polarized ? " · Të polarizuara" : ""}</dd></div><div><dt>Masat</dt><dd>${escapeHtml(product.size)} · lente ${product.lensWidth || "—"} mm · urë ${product.bridgeWidth || "—"} mm · bishta ${product.templeLength || "—"} mm</dd></div><div><dt>Me dioptri</dt><dd>${product.prescriptionReady ? "Po, pas verifikimit të recetës" : "Jo"}</dd></div><div><dt>Kujdesi</dt><dd>${escapeHtml(product.care || "Pastrojeni me mikrofibër dhe ruajeni në kuti.")}</dd></div><div><dt>Shërbimi pas blerjes</dt><dd>${escapeHtml(product.service || "Rregullimi fillestar kryhet në optikë.")}</dd></div>
    </dl><p>Aktivizoni JavaScript për konfigurimin dhe shportën, ose <a href="tel:+38343777667">kontaktoni optikën</a>.</p></section>
    <section class="static-product-variants"><h2>Variantet e këtij modeli</h2>${family.map((variant) => `<a href="${productPath(variant)}"${variant.id === product.id ? ' aria-current="page"' : ""}>${escapeHtml(variant.name)} · ${escapeHtml(sqLabel(variant.color))} · ${escapeHtml(formatPrice(variant.salePrice || variant.price))}</a>`).join("")}</section>
  </main>${staticFooter}`;
};

const staticArticleBody = (article) => { const detail = guideDetails[article.slug]; return `${sharedNav}<main class="static-route-page"><nav class="static-breadcrumb" aria-label="Rruga e faqes"><a href="/lens-focus#lens-guides">Lens Focus</a><span>›</span><span aria-current="page">${escapeHtml(article.title)}</span></nav><article class="static-article"><p>${escapeHtml(article.category)} · ${escapeHtml(article.readTime)}</p><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(article.excerpt)}</p>${detail ? `<section><h2>${escapeHtml(detail[0])}</h2><p>${escapeHtml(detail[1])}</p></section>` : ''}<section><h2>Mbani parasysh</h2><ul>${article.points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul></section>${detail ? `<section><h2>Një pyetje për takimin tuaj</h2><p>${escapeHtml(detail[2])}</p><a href="/contact#booking">Diskutojeni me optikun</a></section>` : ''}<p>Udhëzues i përgjithshëm, jo diagnozë ose recetë. Zgjedhja dhe matjet përfundimtare kërkojnë vlerësim individual nga profesionisti.</p></article></main>${staticFooter}`; };

function withoutRouteMeta(html) {
  const metaKeys = ["description", "robots", "og:title", "og:description", "og:type", "og:url", "og:image", "og:image:alt", "twitter:card", "twitter:title", "twitter:description", "twitter:image", "product:price:amount", "product:price:currency", "product:availability"];
  let output = html;
  for (const key of metaKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]*>\\s*`, "gi"), "");
  }
  return output.replace(/<link[^>]+rel=["']canonical["'][^>]*>\s*/gi, "");
}

// Social crawlers (WhatsApp, Facebook, LinkedIn) handle JPEG previews more reliably than WebP,
// so og/twitter images use the JPEG derivative generated alongside each converted product image.
const socialImage = (image = "/og.png") => {
  const jpeg = image.replace(/^\/assets\/products\/([^/]+)\.webp$/, "/assets/social/$1.jpg");
  return jpeg;
};

function routeHtml({ title, description, path, image = "/og.png", type = "website", noindex = false, schema, replaceBaseSchema = false, body, price, availability, extraHead = "" }) {
  const canonical = canonicalUrl(siteUrl, path);
  const shareImage = socialImagePath(image);
  const metadata = [
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${noindex || privateSeoPaths.includes(path) ? "noindex, follow" : "index, follow, max-image-preview:large"}" />`,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="${escapeHtml(type)}" />`,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    `<meta property="og:image" content="${escapeHtml(absoluteUrl(shareImage))}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(type === "product" ? `${title}, pamja e produktit` : title)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(absoluteUrl(shareImage))}" />`,
    price ? `<meta property="product:price:amount" content="${escapeHtml(price)}" />` : "",
    price ? `<meta property="product:price:currency" content="EUR" />` : "",
    availability ? `<meta property="product:availability" content="${escapeHtml(availability)}" />` : "",
    schema ? `<script id="optika-prerendered-structured-data" type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>` : "",
    extraHead
  ].filter(Boolean).join("\n    ");
  const template = baseTemplate.replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi, '');
  return withoutRouteMeta(template)
    .replace(/<html lang="[^"]*">/, `<html lang="${path === '/laboratory/europe' ? 'en' : 'sq'}">`)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace("</head>", `    ${metadata}\n  </head>`)
    .replace(/<div id="root">[\s\S]*?<\/div>\s*<script>window\.dataLayer/, `<div id="root">${body}</div>\n    <script>window.dataLayer`);
}

const labMarketPresentation = {
  '/laboratory/kosovo': { language: 'sq', image: editorialMedia.labKosovoImage[1] },
  '/laboratory/europe': { language: 'en', image: editorialMedia.labEuropeImage[1] },
};

function labMarketSchema({ path, title, description, language, image }) {
  const url = absoluteUrl(path);
  const holdingId = absoluteUrl('/#holding-group');
  const labId = `${url}#optical-lab`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': holdingId, name: 'Miftari Holding Group', url: absoluteUrl('/') },
      {
        '@type': 'Organization', '@id': labId, name: 'Optical Lab',
        url, description, parentOrganization: { '@id': holdingId },
        logo: absoluteUrl('/assets/brand/optika-miftari-monogram.png'),
        image: absoluteUrl(image), telephone: '+38343777667',
        location: { '@type': 'Place', name: language === 'en' ? 'Kosovo' : 'Kosovë' },
      },
      {
        '@type': 'WebPage', '@id': `${url}#webpage`, url, name: title,
        description, inLanguage: language, about: { '@id': labId },
        mainEntity: { '@id': labId }, primaryImageOfPage: { '@type': 'ImageObject', url: absoluteUrl(image) },
      },
    ],
  };
}

async function writeRoute(path, html) {
  const target = path === "/" ? join(distDir, "index.html") : join(distDir, decodeURIComponent(path.slice(1)), "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, "utf8");
}

for (const definition of pageDefinitions) {
  const [path, title, description, , , noindex = false] = definition;
  const market = labMarketPresentation[path];
  const extraHead = path === "/"
      ? `<link rel="preload" as="image" href="/assets/brand/atelier-optical-2026.webp" imagesrcset="/assets/brand/atelier-optical-2026-small.webp 768w, /assets/brand/atelier-optical-2026.webp 1536w" imagesizes="100vw" fetchpriority="high" />`
    : path === "/optical"
      ? `<link rel="preload" as="image" href="/assets/brand/atelier-optical-2026.webp" imagesrcset="/assets/brand/atelier-optical-2026-small.webp 768w, /assets/brand/atelier-optical-2026.webp 1536w" imagesizes="100vw" fetchpriority="high" />`
    : "";
  await writeRoute(path, routeHtml({
    title, description, path, noindex, extraHead,
    image: market?.image,
    schema: seoGraph({ site: siteUrl, path, title, description, language: market?.language, image: market?.image }),
    replaceBaseSchema: Boolean(market),
    body: staticPageBody(definition),
  }));
}

for (const product of products) {
  const path = productPath(product);
  const title = productSeoTitle(product);
  const description = product.metaDescription || product.description;
  await writeRoute(path, routeHtml({
    title,
    description,
    path,
    image: product.image,
    type: "product",
    schema: seoGraph({ site: siteUrl, path, title, description, image: product.image, product }),
    body: staticProductBody(product),
    price: String(product.salePrice || product.price),
    availability: product.stock > 0 ? "in stock" : "out of stock"
  }));
}

for (const article of blogPosts) {
  const path = `/lens-focus/articles/${encodeURIComponent(article.slug)}`;
  const title = articleSeoTitle(article);
  const schema = seoGraph({ site: siteUrl, path, title, description: article.excerpt, article });
  await writeRoute(path, routeHtml({ title, description: article.excerpt, path, type: "article", schema, body: staticArticleBody(article) }));
}

const indexablePaths = [
  ...pageDefinitions.filter((definition) => !definition[5] && !privateSeoPaths.includes(definition[0])).map((definition) => definition[0]),
  ...products.map(productPath),
  ...blogPosts.map((article) => `/lens-focus/articles/${encodeURIComponent(article.slug)}`)
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indexablePaths.map((path) => `  <url><loc>${escapeHtml(canonicalUrl(siteUrl, path))}</loc></url>`).join("\n")}\n</urlset>\n`;
await writeFile(join(distDir, "sitemap.xml"), sitemap, "utf8");
// Public metadata only. The PHP renderer reads existing published CMS data;
// no credentials, customer records or database snapshots are bundled here.
const contentKeys = { '/': 'group', '/optical': 'home', '/clinic': 'clinic', '/laboratory': 'lab', '/laboratory/partners': 'partners', '/laboratory/kosovo': 'labKosovo', '/laboratory/europe': 'labEurope', '/shop': 'shop', '/ekzaminimi': 'examination', '/prescription-glasses': 'prescription', '/sunglasses': 'sunglasses', '/about': 'about', '/contact': 'contact' };
const registry = { site: siteUrl, indexablePages: indexablePaths.filter(path => !products.some(product => productPath(product) === path)).map(path => canonicalUrl(siteUrl, path)), pages: Object.fromEntries(pageDefinitions.map(([path, title, description, heading, copy]) => [path, { title, description, heading, copy, canonical: canonicalUrl(siteUrl, path), image: absoluteUrl(labMarketPresentation[path]?.image || '/og.png'), contentKey: contentKeys[path] || '' }])) };
await writeFile(join(distDir, 'seo-pages.json'), JSON.stringify(registry), 'utf8');
await writeFile(join(distDir, 'api/seo-template.html'), await readFile(join(distDir, productPath(products[0]).slice(1), 'index.html'), 'utf8'), 'utf8');
await writeFile(join(publicDir, "sitemap.xml"), sitemap, "utf8");
await writeFile(join(distDir, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /uploads/\nDisallow: /optika-miftari-data/\nDisallow: /lens-focus-hero/\nSitemap: ${siteUrl}/sitemap.xml\n`, "utf8");

const notFoundBody = `${sharedNav}<main class="static-route-page"><section class="static-route-hero"><p>404</p><h1>Kjo faqe nuk u gjet.</h1><p>Produkti ose faqja mund të jetë zhvendosur. Kthehuni te katalogu për të vazhduar.</p><div><a class="static-primary-cta" href="/shop">Shiko kornizat</a><a href="/">Kthehu në ballinë</a></div></section></main>${staticFooter}`;
await writeFile(join(distDir, "404.html"), routeHtml({ title: "Faqja nuk u gjet | Optika Miftari", description: "Faqja e kërkuar nuk u gjet.", path: "/404", noindex: true, body: notFoundBody }), "utf8");

const htaccessPath = join(distDir, ".htaccess");
let htaccess = await readFile(htaccessPath, "utf8");
const redirects = products.map((product) => `  RewriteRule ^products/${product.id}/?$ ${productPath(product)}/ [R=301,L,NE]`).join("\n");
// Prerender is also run after metadata-only corrections without rebuilding
// Vite. Replace our generated redirect block rather than duplicating it.
htaccess = htaccess.replace(/\r?\n\r?\n  # Legacy product URLs redirect one-to-one to descriptive permanent URLs\.\r?\n(?:  RewriteRule \^products\/[^\r\n]*(?:\r?\n|$))*/g, '\n');
htaccess = htaccess.replace(
  "  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]",
  `  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]\n\n  # Legacy product URLs redirect one-to-one to descriptive permanent URLs.\n${redirects}`
);
await writeFile(htaccessPath, htaccess, "utf8");

console.log(`Prerendered ${pageDefinitions.length} pages, ${products.length} products and ${blogPosts.length} articles.`);
