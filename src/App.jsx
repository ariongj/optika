import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import EditorialImage from './EditorialImage.jsx';
import LanguageSwitch, { useLanguage } from './i18n/LanguageSwitch.jsx';
import { translate } from './i18n/locale.js';
import { editorialMedia, safeEditorialImage } from './editorialMedia.js';
import AdviceArticle from './AdviceArticle.jsx';
import { guideReadingTime } from './guideContent.js';
import { normalizeSearch } from './catalogSearch.js';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bell,
  Boxes,
  Camera,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  Eye,
  FileText,
  Heart,
  Image as ImageIcon,
  Instagram,
  Layers3,
  LockKeyhole,
  MapPin,
  Megaphone,
  Menu,
  MessageCircle,
  Minus,
  Pause,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Truck,
  UploadCloud,
  User,
  Users,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import {
  analyticsEvents,
  blogPosts,
  coatings,
  collections,
  campaigns,
  contentPages,
  faqItems,
  initialCustomers,
  initialOrders,
  lensPackages,
  mediaAssets,
  products as seedProducts,
  reviews,
  roleMatrix,
  teamMembers
} from "./data/catalog.js";
import CraftedAudio from "./craftedAudio.js";
import AccountPage from "./AccountPage.jsx";
import CatalogSearch from './CatalogSearch.jsx';
import SiteHelp from './SiteHelp.jsx';
import { reloadableProductPath, shopProductId } from './productRoutes.js';
import { persistableCart, selectedCatalogProduct, createLatestUpload } from './cartPersistence.js';
import OrderTracking from './OrderTracking.jsx';
import { GroupHome, ClinicPage, LabPartnersPage } from './HoldingPages.jsx';
import CmsStorefront from './CmsStorefront.jsx';
import { holdingDefaults, groupRoutes } from './holdingContent.js';
import { LabMarketPage, LabEuropeFooter } from './LabMarketPages.jsx';
import { euro, roundMoney, quotedCartLines, cartAvailability, cartLineLimit, removeSubmittedLines, polarizedDiscountBase as polarizedBase, checkoutDeliveryErrors, confirmedCheckoutOrder, checkoutWithDeadline } from './checkoutExperience.js';
import { EditorialHome, EditorialCatalog, EditorialProductCard, EditorialLaboratory, EditorialAbout, EditorialExamination } from "./EditorialPages.jsx";
import { modelVariants, productDescription, frameSwatches, prescriptionSummary, upsertCartLine } from "./commercePresentation.js";
import { emptyCheckoutCustomer, readCheckoutDraft, saveCheckoutDraft, clearCheckoutDraft, createCheckoutRequestIdentity } from "./checkoutDraft.js";
import useDialogFocus from "./useDialogFocus.js";
import { megaNavigation, navigationIndex } from './megaNavigation.js';
import LensFocusPage from './LensFocusPage.jsx';
import { pageDefinitions } from './seoPages.js';
import { canonicalUrl, socialImagePath, productSeoTitle, articleSeoTitle, seoGraph, privateSeoPaths } from './seo.js';
import { bookingCalendar, bookingTimes, bookingContactError, sendAppointment, appointmentFailure, initialMeasurementMarkers, estimatePhotoDimensions } from './navigationForms.js';

const VirtualTryOn3D = lazy(() => import("./VirtualTryOn3D.jsx"));
const LegacyAssemblyScene = lazy(() => import("./LegacyAssemblyScene.jsx"));
const AdminPortal = lazy(() => import("./AdminPortal.jsx"));

const money = euro;
const shqipLabels = {
  All: "Të gjitha",
  Sunglasses: "Syze dielli",
  "Prescription Glasses": "Syze me dioptri",
  Men: "Burra",
  Women: "Gra",
  Unisex: "Uniseks",
  Square: "Katrore",
  Rectangle: "Drejtkëndore",
  Round: "Rrethore",
  Wrap: "Sportive",
  Aviator: "Aviator",
  "Cat-eye": "Sy mace",
  Geometric: "Gjeometrike",
  Photochromic: "Fotokromatike",
  Medium: "Mesatare",
  "Medium-wide": "Mesatare e gjerë",
  Wide: "E gjerë",
  "Clear Rx": "Të tejdukshme",
  "Blue-light": "Për dritën blu",
  Polarized: "Të polarizuara",
  Gradient: "Gradient",
  Mirror: "Pasqyrë",
  New: "E re",
  "Best Seller": "Më e shitura",
  "Rx Ready": "Gati për dioptri",
  Limited: "Edicion i kufizuar",
  Premium: "Premium",
  Sport: "Sport",
  Newest: "Më të rejat",
  "Best-selling": "Më të shiturat",
  "Price: low": "Çmimi: nga më i ulëti",
  "Price: high": "Çmimi: nga më i larti",
  Popularity: "Popullariteti",
  "Under €400": "Nën €400",
  "€400+": "€400+",
  Ready: "Po",
  No: "Jo",
  Driving: "Vozitje",
  Beach: "Plazh",
  Fashion: "Stil",
  Everyday: "Përditë",
  Work: "Punë",
  Reading: "Lexim",
  "Non-polarized": "Jo të polarizuara",
  "Mirror coating": "Shtresë pasqyrë",
  "Gradient lenses": "Lente gradient",
  "Japanese acetate and titanium": "Acetat japonez dhe titan",
  "Beta titanium": "Titan beta",
  "Carbon polymer": "Polimer karboni",
  "Titanium and bio-acetate": "Titan dhe bio-acetat",
  "Titanium and acetate": "Titan dhe acetat",
  "Carbon polymer and titanium": "Polimer karboni dhe titan",
  Oval: "Ovale",
  Heart: "Zemër",
  "Black gold": "E zezë me ar",
  "Chrome clear": "Krom e tejdukshme",
  Graphite: "Grafit",
  "Pearl chrome": "Krom perle",
  "Black chrome": "Krom i zi",
  "Matte graphite": "Grafit mat",
  "Amber tortoise": "Havana qelibar",
  Champagne: "Shampanjë",
  "Brushed silver": "Argjend i furçuar",
  "Matte black": "E zezë mat",
  "Translucent caramel": "Karamel i tejdukshëm",
  "Carbon black": "E zezë karboni",
  "Titanium smoke": "Titan tymi",
  "Black titanium": "Titan i zi",
  Silver: "Argjend",
  "Black pearl": "Perlë e zezë",
  Gunmetal: "Gri metalike",
  "Navy graphite": "Grafit blu i errët",
  Caramel: "Karamel",
  "Dark tortoise": "Havana e errët",
  Gold: "Ar",
  Burgundy: "Bordo",
  "Dark havana": "Havana e errët",
  "Forest black": "E gjelbër e errët",
  "Translucent ruby": "Rubin i tejdukshëm",
  "Crystal smoke": "Kristal tymi",
  Smoke: "Tymi",
  "Olive titanium": "Titan ulliri",
  "Champagne pearl": "Perlë shampanje",
  Obsidian: "Obsidian",
  Clear: "E tejdukshme",
  "Gradient smoke": "Tymi gradient",
  "Mirror gold": "Ar pasqyrë",
  "Honey gradient": "Mjaltë gradient",
  "Brown gradient": "Kafe gradient",
  "Mineral green": "E gjelbër minerale",
  "Neutral smoke": "Tymi neutral",
  "Warm amber": "Qelibar i ngrohtë",
  "Deep grey": "Gri e thellë",
  Amber: "Qelibar",
  "Blue-reflect": "Reflektim blu",
  "Blue mirror": "Blu pasqyrë",
  Green: "E gjelbër",
  "Olive gradient": "Ulliri gradient",
  "Photochromic grey": "Gri fotokromatike",
  Bronze: "Bronz",
  "Mirror silver": "Argjend pasqyrë"
};
const shqipLabel = (value) => shqipLabels[value] || value;
const orderStatusLabels = {
  Pending: "Në pritje",
  Confirmed: "E konfirmuar",
  "In lab": "Në laborator",
  Ready: "Gati",
  Completed: "E përfunduar",
  "Return requested": "Kthimi u kërkua",
  Returned: "E kthyer",
  Cancelled: "E anuluar",
  "Awaiting confirmation": "Në pritje të konfirmimit",
  "Awaiting payment": "Në pritje të pagesës",
  "Partially paid": "Pjesërisht e paguar",
  Paid: "E paguar",
  Refunded: "E rimbursuar",
  Unfulfilled: "Ende pa përgatitur",
  Processing: "Në përgatitje",
  "Ready for pickup": "Gati për marrje",
  Shipped: "E dërguar",
  Delivered: "E dorëzuar",
  "Standard insured": "Dërgesë standarde e siguruar",
  "Store pickup": "Marrje në optikë"
};
const orderStatusLabel = (value) => orderStatusLabels[value] || value;
const storePhone = "38343777667";
const openWhatsApp = (message) => {
  const url = `https://wa.me/${storePhone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
};
const trackPublicEvent = (eventName, parameters = {}) => {
  if (typeof window === "undefined") return;
  const event = { event: eventName, ...parameters };
  window.dispatchEvent(new CustomEvent("optika:conversion", { detail: event }));
  if (Array.isArray(window.dataLayer)) window.dataLayer.push(event);
  fetch("/api/track.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify({
      event: eventName,
      path: window.location.pathname,
      label: parameters.item_name || parameters.destination || parameters.appointment_type || "",
      device: window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop",
      language: navigator.language || ""
    })
  }).catch(() => undefined);
};

const submitPublicRecord = async (payload) => {
  const response = await fetch("/api/submit.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    keepalive: true,
    body: JSON.stringify({ company: "", ...payload })
  });
  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok || !result?.ok) {
    const error = new Error(result?.error || "submission_unavailable");
    error.code = result?.error || "submission_unavailable";
    throw error;
  }
  return result;
};
const normalizeOrderBrand = (order) => ({
  ...order,
  id: String(order.id || "").replace(/^(AUR|VIS)-/, "OM-"),
  email: order.email || customerEmailByName[order.customer] || "Kontakti ruhet në porosi",
  phone: order.phone || customerOrderDetailsByName[order.customer]?.phone || "Kontakti ruhet në porosi",
  shipping: order.shipping || "Dërgesë standarde e siguruar",
  deliveryAddress: order.deliveryAddress || customerOrderDetailsByName[order.customer]?.address || "Mitrovicë, Kosovo",
  payment: order.payment || "Konfirmohet me optikën",
  updatedAt: order.updatedAt || order.date
});
const customerEmailByName = {
  "Mira Luan": "mira.luan@gmail.com",
  "Ben Marku": "ben.marku@gmail.com",
  "Elena R.": "elena.rama@gmail.com",
  "Dion P.": "dion.preni@gmail.com"
};
const customerOrderDetailsByName = {
  "Mira Luan": { phone: "+383 44 220 417", address: "40000 Mitrovicë, Kosovo" },
  "Ben Marku": { phone: "+383 49 315 208", address: "10000 Prishtinë, Kosovo" },
  "Elena R.": { phone: "+383 45 612 390", address: "40000 Mitrovicë, Kosovo" },
  "Dion P.": { phone: "+383 48 704 155", address: "40000 Mitrovicë, Kosovo" }
};
const normalizeCustomerBrand = (customer) => ({
  ...customer,
  email: customerEmailByName[customer.name] || customer.email
});
const isSyntheticAuditRecord = (record) => Object.values(record || {})
  .some((value) => /audit customer/i.test(String(value)));
const catalogVersion = "optika-miftari-2026-08-20-webp-product-catalog";
const brandVersion = "optika-miftari-2026-07-17";
const pageTitles = {
  home: holdingDefaults.groupSeoTitle,
  optical: "Optical | Syze optike dhe syze dielli — Miftari",
  clinic: holdingDefaults.clinicSeoTitle,
  partners: holdingDefaults.partnersSeoTitle,
  labKosovo: holdingDefaults.labKosovoSeoTitle,
  labEurope: holdingDefaults.labEuropeSeoTitle,
  shop: "Bli Syze Online - Optika Miftari",
  product: "Optika Miftari - Konfiguroni Syzet",
  admin: "Optika Miftari Operations",
  examination: "Ekzaminimi Profesional i Syrit - Optika Miftari",
  prescription: "Syze me Dioptri - Optika Miftari",
  sunglasses: "Syze Dielli - Optika Miftari",
  fit: "Provo Syzet dhe Mat Fytyrën Online - Optika Miftari",
  guides: "Lens Focus | Lentet tuaja, hap pas hapi | Optika Miftari",
  article: "Udhëzuesi Optik - Optika Miftari",
  wishlist: "Të Preferuarat - Optika Miftari",
  brand: "Punimi dhe Laboratori Optik - Optika Miftari",
  about: "Rreth Optika Miftari - Traditë familjare dhe ekspertizë optike",
  contact: "Kontaktoni Optika Miftari",
  policies: "Politikat - Optika Miftari",
  orderStatus: "Gjurmo Porosinë - Optika Miftari",
  account: "Llogaria Ime - Optika Miftari"
};

const pagePaths = {
  ...groupRoutes,
  home: "/",
  shop: "/shop",
  examination: "/ekzaminimi",
  prescription: "/prescription-glasses",
  sunglasses: "/sunglasses",
  guides: "/lens-focus",
  fit: "/virtual-try-on",
  wishlist: "/wishlist",
  brand: "/laboratory",
  about: "/about",
  contact: "/contact",
  policies: "/policies",
  orderStatus: "/order-status",
  account: "/account",
  admin: "/staff"
};

const productPathFor = (productOrId) => reloadableProductPath(productOrId, seedProducts);

const routeFromPath = (pathname = "/", search = "") => {
  const normalized = `/${pathname}`.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
  const cmsProductId = shopProductId(normalized, search);
  if (cmsProductId) return { page: "product", productId: cmsProductId };
  const productMatch = normalized.match(/^\/(?:products|syze-optike|syze-dielli)\/([^/]+)$/);
  const articleMatch = normalized.match(/^\/lens-focus\/articles\/([^/]+)$/);

  if (productMatch) {
    try {
      return { page: "product", productId: decodeURIComponent(productMatch[1]) };
    } catch {
      return { page: "product", productId: "" };
    }
  }

  if (articleMatch) {
    try {
      return { page: "article", articleSlug: decodeURIComponent(articleMatch[1]) };
    } catch {
      return { page: "notFound" };
    }
  }

  if (normalized === "/shop") return { page: "shop" };
  if (normalized === "/optical") return { page: "optical" };
  if (normalized === "/clinic") return { page: "clinic" };
  if (normalized === "/laboratory/partners") return { page: "partners" };
  if (normalized === "/laboratory/kosovo") return { page: "labKosovo" };
  if (normalized === "/laboratory/europe") return { page: "labEurope" };
  if (normalized === "/sunglasses") return { page: "sunglasses" };
  if (normalized === "/prescription-glasses") return { page: "prescription" };
  if (normalized === "/ekzaminimi" || normalized === "/examination") return { page: "examination" };
  if (["/virtual-try-on", "/fit-studio", "/matje-online"].includes(normalized)) return { page: "fit" };
  if (["/guides", "/lens-technology", "/lens-focus", "/lens-oculus"].includes(normalized)) return { page: "guides" };
  if (normalized === "/wishlist") return { page: "wishlist" };
  if (["/brand", "/crafted", "/laboratory"].includes(normalized)) return { page: "brand" };
  if (normalized === "/about") return { page: "about" };
  if (normalized === "/contact") return { page: "contact" };
  if (normalized === "/policies") return { page: "policies" };
  if (normalized === "/order-status") return { page: "orderStatus" };
  if (["/account", "/login", "/register"].includes(normalized)) return { page: "account" };
  if (["/staff", "/operations"].includes(normalized)) return { page: "admin" };
  return { page: normalized === "/" ? "home" : "notFound" };
};

const pathForPage = (page, productId) => (
  page === "product"
    ? productPathFor(productId || seedProducts[0].id)
    : page === "article"
      ? `/lens-focus/articles/${encodeURIComponent(productId || blogPosts[0].slug)}`
      : pagePaths[page] || "/"
);

const defaultAdminHero = {
  ...holdingDefaults,
  title: "Shihni mirë. Jini vetvetja.",
  subtitle: "Korniza që ju shkojnë. Lente të punuara për ju, në laboratorin tonë.",
  primaryCta: "Shiko kornizat",
  secondaryCta: "Rezervo ekzaminimin",
  banner: "Laborator optik profesional / Mitrovicë",
  shopTitle: "Të gjitha kornizat.",
  shopSubtitle: "Korniza optike dhe syze dielli. Zgjidhni online; për lentet dhe punimin kujdeset laboratori ynë.",
  examinationTitle: "Së pari, si shihni ju?",
  examinationSubtitle: "Matim shikimin dhe kuptojmë punën, ekranin, leximin e vozitjen, që receta dhe lentet të funksionojnë në jetën e përditshme.",
  prescriptionTitle: "Syze me dioptri.",
  prescriptionSubtitle: "Zgjidhni kornizën; pastaj përcaktojmë lentet sipas recetës, ekranit, leximit, vozitjes dhe matjeve tuaja.",
  sunglassesTitle: "Syze dielli.",
  sunglassesSubtitle: "Zgjidhni formën dhe filtrin, provojeni modelin virtualisht dhe kërkoni lente dielli me dioptri kur korniza e lejon.",
  aboutTitle: "Familjarë në kujdes. Të përkushtuar ndaj shikimit.",
  aboutSubtitle: "30 vjet përvojë, dy lokacione dhe një laborator privat. Një shtëpi optike ku këshillimi dhe punimi bëhen bashkë.",
  contactTitle: "Le të flasim për shikimin tuaj.",
  contactSubtitle: "Zgjidhni arsyen e vizitës, ditën dhe orën e preferuar. Ekipi e kontrollon kërkesën dhe ju dërgon konfirmimin personalisht.",
  featuredProducts: "prm-m2, nov-n04, sol-s7, vtx-x1",
  featuredCollections: "Signature Lab, Optical Core, Motion Series",
  reviewHeadline: "Kujdes personal. Precizion profesional."
};

const defaultAdminSeo = {
  metaTitle: "Optika Miftari - Syze Optike dhe Syze Dielli",
  metaDescription: "Optikë familjare me laborator privat. Nga ekzaminimi te lentet dhe montimi, porosia juaj punohet nga ekipi ynë, pa ndërmjetësues.",
  canonical: "https://optikamiftari.com/",
  ogImage: "/assets/products/vortex-x1-studio.webp",
  productSchema: true,
  faqSchema: true,
  sitemap: "/sitemap.xml"
};
const orderStatuses = ["Pending", "Paid", "Processing", "Shipped", "Completed", "Cancelled"];

// The 2026-08-20 release converted bundled catalog imagery from PNG to WebP; catalogs cached
// by earlier releases may still point at the retired .png files.
// optika-miftari-monogram.png is the one bundled PNG that was kept, so it is excluded.
const legacyImagePattern = /^(\/assets\/(?:products|brand|concepts|references|assembly)\/(?!optika-miftari-monogram\.png)[^/]+)\.png$/;
const healLegacyAssetPath = (value) =>
  typeof value === "string" ? value.replace(legacyImagePattern, "$1.webp") : value;
const healLegacyProductImages = (product) => {
  if (!product || typeof product !== "object") return product;
  const healed = { ...product };
  if (healed.image) healed.image = healLegacyAssetPath(healed.image);
  if (Array.isArray(healed.gallery)) healed.gallery = healed.gallery.map(healLegacyAssetPath);
  return healed;
};

// Display headings set their final sentence in the serif accent voice; titles
// edited through the CMS keep the same treatment automatically.
const emphasizeFinalSentence = (title) => {
  if (typeof title !== "string" || !title.trim()) return null;
  const sentences = title.match(/[^.!?]+[.!?]*\s*/g) || [];
  if (sentences.length < 2) return title;
  const tail = sentences.pop();
  return <>{sentences.join("")}<em>{tail}</em></>;
};

const readStorage = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local browser storage is an enhancement; failing silently keeps the storefront usable.
  }
};

const emptyProductDraft = {
  id: "",
  name: "",
  type: "Sunglasses",
  audience: "Unisex",
  collection: "Signature Lab",
  price: "",
  salePrice: "",
  stock: "",
  frameShape: "Square",
  color: "Black gold",
  lensColor: "Smoke",
  material: "Japanese acetate and titanium",
  size: "51-20-145",
  lensType: "Polarized",
  uv: "UV400",
  image: "/assets/products/vortex-x1-studio.webp",
  badges: "New, Premium",
  prescriptionReady: true,
  polarized: true,
  blueLight: false,
  faceShapes: "Oval, Round",
  lifestyle: "Everyday, Fashion",
  description: "",
  technical: "",
  seoTitle: "",
  metaDescription: ""
};

function App() {
  const language = useLanguage();
  const initialRoute = useMemo(() => routeFromPath(
    typeof window === "undefined" ? "/" : window.location.pathname,
    typeof window === "undefined" ? "" : window.location.search
  ), []);
  const [page, setPage] = useState(initialRoute.page);
  const [routePath, setRoutePath] = useState(
    typeof window === "undefined" ? "/" : window.location.pathname
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [products, setProducts] = useState(() => {
    const saved = readStorage("visionaire-products", null);
    if (!Array.isArray(saved)) return seedProducts;
    const healed = saved.map(healLegacyProductImages);
    if (readStorage("visionaire-catalog-version", "") === catalogVersion) return healed;
    const seedIds = new Set(seedProducts.map((product) => product.id));
    return [...seedProducts, ...healed.filter((product) => !seedIds.has(product.id))];
  });
  const [selectedProductId, setSelectedProductId] = useState(initialRoute.productId ?? seedProducts[0].id);
  const [selectedArticleSlug, setSelectedArticleSlug] = useState(initialRoute.articleSlug || blogPosts[0].slug);
  const [cart, setCart] = useState(() => persistableCart(readStorage("visionaire-cart", [])));
  const [editingCartLineId, setEditingCartLineId] = useState(null);
  const [wishlist, setWishlist] = useState(() => new Set(readStorage("visionaire-wishlist", [])));
  const [compare, setCompare] = useState(() => new Set(readStorage("visionaire-compare", [])));
  const [cartOpen, setCartOpen] = useState(false);
  const [quickProductId, setQuickProductId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [events, setEvents] = useState(() => readStorage("visionaire-events", []));
  const cartAddGuardRef = useRef({ signature: "", at: 0 });
  const [homepageContent, setHomepageContent] = useState(() => (
    readStorage("visionaire-brand-version", "") === brandVersion
      ? readStorage("visionaire-homepage-cms", defaultAdminHero)
      : defaultAdminHero
  ));
  const [storeCampaigns, setStoreCampaigns] = useState(() => readStorage("visionaire-campaigns", campaigns));
  const [customerSession, setCustomerSession] = useState({ authenticated: false, profile: null, csrf: "" });

  const selectedProduct = selectedCatalogProduct(products, selectedProductId) || {
    id: '', name: 'Modeli nuk është i disponueshëm',
    description: 'Ky model nuk gjendet në katalogun aktual.', gallery: [], stock: 0,
  };
  const quickProduct = products.find((product) => product.id === quickProductId) || null;
  const selectedArticle = blogPosts.find((post) => post.slug === selectedArticleSlug) || null;

  useEffect(() => {
    const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL || "https://optikamiftari.com").replace(/\/$/, "");
    const missingSeoPage = page === 'notFound' || (page === 'home' && routePath.replace(/\/$/, '') !== '') || (page === 'product' && !selectedProduct.id) || (page === 'article' && !selectedArticle);
    const canonicalPath = missingSeoPage ? routePath : page === 'product' ? productPathFor(selectedProduct) : page === 'article' ? pathForPage('article', selectedArticle.slug) : pagePaths[page] || routePath;
    const definition = pageDefinitions.find(item => item[0] === canonicalPath.replace(/\/$/, '') || item[0] === canonicalPath) || pageDefinitions[0];
    const contentKey = { home: 'group', optical: 'home', clinic: 'clinic', partners: 'partners', labKosovo: 'labKosovo', labEurope: 'labEurope', brand: 'lab', shop: 'shop', examination: 'examination', prescription: 'prescription', sunglasses: 'sunglasses', about: 'about', contact: 'contact' }[page];
    const title = missingSeoPage ? 'Faqja nuk u gjet | Optika Miftari' : page === 'product' ? productSeoTitle(selectedProduct) : page === 'article' ? articleSeoTitle(selectedArticle) : homepageContent[contentKey + 'SeoTitle'] || definition[1];
    const description = missingSeoPage ? 'Kjo faqe nuk është e disponueshme. Kthehuni te katalogu ose kontaktoni Optika Miftari.' : page === 'product' ? selectedProduct.metaDescription || selectedProduct.description : page === 'article' ? selectedArticle.excerpt : homepageContent[contentKey + 'SeoDescription'] || definition[2];
    document.documentElement.lang = language === 'en' || page === 'labEurope' ? 'en' : 'sq';
    document.title = translate(title);
    const canonical = canonicalUrl(publicSiteUrl, canonicalPath);
    const imageKey = page === 'labEurope' ? 'labEuropeImage' : 'labKosovoImage';
    const image = page === 'product' && selectedProduct.image ? socialImagePath(selectedProduct.image) : page === 'labEurope' || page === 'labKosovo' ? safeEditorialImage(homepageContent[imageKey]) || editorialMedia[imageKey][1] : '/og.png';
    const setMeta = (selector, value) => document.querySelector(selector)?.setAttribute('content', value);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
    for (const key of ['description', 'og:description', 'twitter:description']) setMeta(`meta[${key.startsWith('og:') ? 'property' : 'name'}="${key}"]`, translate(description));
    for (const key of ['og:title', 'twitter:title']) setMeta(`meta[${key.startsWith('og:') ? 'property' : 'name'}="${key}"]`, translate(title));
    setMeta('meta[property="og:url"]', canonical);
    setMeta('meta[property="og:type"]', page === 'product' ? 'product' : page === 'article' ? 'article' : 'website');
    setMeta('meta[property="og:image"]', new URL(image, publicSiteUrl).href);
    setMeta('meta[name="twitter:image"]', new URL(image, publicSiteUrl).href);
    setMeta('meta[property="og:image:alt"]', page === 'product' ? selectedProduct.name + ', pamja e produktit' : title);
    setMeta('meta[name="robots"]', privateSeoPaths.includes(canonicalPath.replace(/\/$/, '')) || page === 'admin' || missingSeoPage ? 'noindex, follow' : 'index, follow, max-image-preview:large');
    document.querySelectorAll('meta[property^="product:"]').forEach(meta => meta.remove());
    if (page === 'product' && selectedProduct.id) for (const [key, value] of Object.entries({ 'product:price:amount': String(selectedProduct.salePrice || selectedProduct.price), 'product:price:currency': 'EUR', 'product:availability': selectedProduct.stock > 0 ? 'in stock' : 'out of stock' })) {
      const meta = document.createElement('meta'); meta.setAttribute('property', key); meta.content = value; document.head.appendChild(meta);
    }
    const dynamicSchemaId = 'optika-page-structured-data';
    document.getElementById(dynamicSchemaId)?.remove();
    document.getElementById('optika-prerendered-structured-data')?.remove();
    document.querySelectorAll('head script[data-optika-base-schema], head script[type="application/ld+json"]:not([id])').forEach(script => script.remove());
    const schema = document.createElement('script'); schema.id = dynamicSchemaId; schema.type = 'application/ld+json';
    schema.textContent = JSON.stringify(seoGraph({ site: publicSiteUrl, path: canonicalPath, title: translate(title), description: translate(description), image, product: page === 'product' && selectedProduct.id ? selectedProduct : undefined, article: page === 'article' && selectedArticle ? selectedArticle : undefined, language: document.documentElement.lang }));
    document.head.appendChild(schema);
  }, [language, page, routePath, products, selectedProductId, selectedArticleSlug, homepageContent]);

  // A language or background content update must not move the reader's place.
  useEffect(() => {
    let hashTarget = '';
    try { hashTarget = decodeURIComponent(window.location.hash.replace(/^#/, "")); } catch { /* A malformed anchor must not interrupt page recovery. */ }
    if (hashTarget) {
      window.requestAnimationFrame(() => {
        document.getElementById(hashTarget)?.scrollIntoView({ block: "start" });
      });
    } else {
      const root = document.documentElement;
      const previousBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      root.style.scrollBehavior = previousBehavior;
    }
  }, [
    page,
    routePath,
    selectedProductId,
    selectedArticleSlug
  ]);

  useEffect(() => {
    const restoreRoute = () => {
      setEditingCartLineId(null);
      const route = routeFromPath(window.location.pathname, window.location.search);
      setPage(route.page);
      setRoutePath(window.location.pathname);
      if (route.page === 'product') setSelectedProductId(route.productId ?? '');
      if (route.articleSlug) setSelectedArticleSlug(route.articleSlug);
      setMobileOpen(false);
      window.requestAnimationFrame(() => {
        let hashTarget = '';
        try { hashTarget = decodeURIComponent(window.location.hash.replace(/^#/, "")); } catch { /* Ignore malformed history anchors. */ }
        if (hashTarget) {
          document.getElementById(hashTarget)?.scrollIntoView({ block: "start" });
        } else {
          window.scrollTo(0, 0);
        }
      });
    };

    window.addEventListener("popstate", restoreRoute);
    return () => window.removeEventListener("popstate", restoreRoute);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/account.php?resource=session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.headers.get("content-type")?.includes("application/json") ? response.json() : null)
      .then((payload) => {
        if (!active || !payload?.ok) return;
        setCustomerSession({ authenticated: Boolean(payload.authenticated), profile: payload.profile || null, csrf: payload.csrf || "" });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (page !== "admin") {
      trackPublicEvent("page_view", { destination: page, path: routePath });
    }
  }, [page, routePath]);

  useEffect(() => {
    if (page !== "product" || !selectedProduct.id) return;
    trackPublicEvent("view_item", {
      item_id: selectedProduct.id,
      item_name: selectedProduct.name,
      value: selectedProduct.salePrice || selectedProduct.price,
      currency: "EUR"
    });
  }, [page, selectedProduct.id]);

  useEffect(() => {
    // Written together so a stored catalog can never carry a newer version stamp than its contents.
    writeStorage("visionaire-products", products);
    writeStorage("visionaire-catalog-version", catalogVersion);
  }, [products]);
  useEffect(() => writeStorage("visionaire-cart", persistableCart(cart)), [cart]);
  useEffect(() => writeStorage("visionaire-wishlist", [...wishlist]), [wishlist]);
  useEffect(() => writeStorage("visionaire-compare", [...compare]), [compare]);
  useEffect(() => writeStorage("visionaire-events", events), [events]);
  useEffect(() => writeStorage("visionaire-homepage-cms", homepageContent), [homepageContent]);
  useEffect(() => {
    let active = true;
    fetch("/api/index.php?resource=public", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.headers.get("content-type")?.includes("application/json") ? response.json() : null)
      .then((payload) => {
        if (!active || !payload?.ok) return;
        if (Array.isArray(payload.products)) setProducts(payload.products);
        if (Array.isArray(payload.campaigns)) setStoreCampaigns(payload.campaigns);
        if (payload.content) {
          setHomepageContent((current) => ({
            ...current,
            ...payload.content,
            title: payload.content.heroTitle || current.title,
            subtitle: payload.content.heroSubtitle || current.subtitle,
            primaryCta: payload.content.primaryCta || current.primaryCta,
            secondaryCta: payload.content.secondaryCta || current.secondaryCta,
            banner: payload.content.announcement || current.banner
          }));
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const logEvent = (label) => {
    setEvents((items) => [{ label, time: new Date().toLocaleTimeString() }, ...items].slice(0, 8));
  };

  const navigate = (nextPage, productId, pathOverride, editLineId = null) => {
    setEditingCartLineId(editLineId);
    const nextItemId = productId
      || (nextPage === "product" ? "prm-m2" : nextPage === "article" ? selectedArticleSlug : selectedProductId);
    const nextUrl = new URL(pathOverride || pathForPage(nextPage, nextItemId), window.location.origin);
    if (language === 'en') nextUrl.searchParams.set('lang', 'en');
    const nextPath = nextUrl.pathname + nextUrl.search + nextUrl.hash;
    const nextPathname = nextUrl.pathname;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath !== nextPath) {
      window.history.pushState({ page: nextPage, itemId: nextItemId }, "", nextPath);
    }
    setRoutePath(nextPathname || "/");
    if (nextPage === "product" && productId) setSelectedProductId(productId);
    if (nextPage === "article" && productId) setSelectedArticleSlug(productId);
    setPage(nextPage);
    setQuickProductId(null);
    setMobileOpen(false);
    logEvent(`CTA click: ${nextPage}`);
    trackPublicEvent("page_navigation", { destination: nextPage, path: nextPath });
    const hashTarget = nextPath.includes("#") ? decodeURIComponent(nextPath.split("#")[1]) : "";
    if (hashTarget) {
      window.setTimeout(() => {
        document.getElementById(hashTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  };

  const addToCart = (product, configuration = {}) => {
    const availableStock = Math.max(0, Number(product.stock || 0));
    if (availableStock < 1) {
      setToast(`${product.name} nuk është aktualisht në stok.`);
      return;
    }
    const requestedQuantity = Math.max(1, Math.min(Number(configuration.quantity || 1), availableStock, 10));
    const comparableConfiguration = { ...configuration };
    delete comparableConfiguration.total;
    delete comparableConfiguration.quantity;
    const signature = `${product.id}:${JSON.stringify(comparableConfiguration)}`;
    const now = Date.now();
    if (cartAddGuardRef.current.signature === signature && now - cartAddGuardRef.current.at < 700) return;
    cartAddGuardRef.current = { signature, at: now };
    const unitPrice = configuration.total
      ? configuration.total / Math.max(1, configuration.quantity || 1)
      : product.salePrice || product.price;
    const result = upsertCartLine(cart, { lineId: `${product.id}-${now}`, signature, productId: product.id, name: product.name, image: product.image, price: unitPrice, configuration, quantity: requestedQuantity, availableStock }, editingCartLineId);
    if (result.error) {
      setToast(result.error === 'cart_line_limit' ? 'Shporta pranon deri në 25 konfigurime. Hiqni një artikull për të shtuar një tjetër.' : result.error === "missing_line" ? "Artikulli ndryshoi. Rihapni shportën dhe provoni përsëri." : "Sasia në shportë tejkalon stokun ose kufirin prej 10 copësh.");
      return;
    }
    setCart(result.items);
    setCartOpen(true);
    setToast(`${product.name} ${editingCartLineId ? "u përditësua" : "u shtua në shportë"}`);
    setEditingCartLineId(null);
    logEvent("Add to cart");
    trackPublicEvent("add_to_cart", {
      item_id: product.id,
      item_name: product.name,
      value: configuration.total || product.salePrice || product.price,
      currency: "EUR"
    });
  };

  const toggleSet = (setter, value, eventName) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
        logEvent(eventName);
      }
      return next;
    });
  };

  const cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

  return (
    <div className={`app-shell ${page !== "admin" ? "editorial-site" : ""}`} data-page={page}>
      {page !== "admin" && <a className="ed-skip-link" href="#main-content">{page === 'labEurope' ? 'Skip to content' : 'Kalo te përmbajtja'}</a>}
      {page !== "admin" && <Header
          page={page}
          navigate={navigate}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          cartCount={cartCount}
          wishlistCount={wishlist.size}
          onCart={() => setCartOpen(true)}
          onSearch={() => setSearchOpen(true)}
          customerSession={customerSession}
        />}
      <main id="main-content" tabIndex={-1} className={page !== "home" && page !== "admin" ? "main-with-fixed-header" : ""}>
        {(page === 'notFound' || (page === 'article' && !selectedArticle)) && <NotFoundPage navigate={navigate} article={page === 'article'} />}
        {['home','shop'].includes(page) && <CmsStorefront page={page} products={products} openQuickView={product => setQuickProductId(product.id)} />}
        {page === "home" && <GroupHome navigate={navigate} content={homepageContent} products={products} label={shqipLabel} openQuickView={(product) => setQuickProductId(product.id)} toggleWishlist={(id) => toggleSet(setWishlist, id, "Wishlist add")} wishlist={wishlist} />}
        {page === "clinic" && <ClinicPage navigate={navigate} content={homepageContent} />}
        {page === "partners" && <LabPartnersPage navigate={navigate} content={homepageContent} />}
        {page === "labKosovo" && <LabMarketPage marketSegment="kosovo" navigate={navigate} content={homepageContent} />}
        {page === "labEurope" && <LabMarketPage marketSegment="eu" navigate={navigate} content={homepageContent} />}
        {page === "optical" && (
          <HomePage
            products={products}
            homepageContent={homepageContent}
            navigate={navigate}
            addToCart={addToCart}
            toggleWishlist={(id) => toggleSet(setWishlist, id, "Wishlist add")}
            wishlist={wishlist}
            openQuickView={(product) => setQuickProductId(product.id)}
          />
        )}
        {page === "shop" && (
          <ShopPage
            key={routePath}
            products={products}
            content={homepageContent}
            navigate={navigate}
            addToCart={addToCart}
            wishlist={wishlist}
            compare={compare}
            toggleWishlist={(id) => toggleSet(setWishlist, id, "Wishlist add")}
            toggleCompare={(id) => toggleSet(setCompare, id, "Compare add")}
            openQuickView={(product) => setQuickProductId(product.id)}
          />
        )}
        {page === "examination" && <ExaminationPage navigate={navigate} content={homepageContent} />}
        {(page === "prescription" || page === "sunglasses") && (
          <CollectionLandingPage
            kind={page}
            products={products}
            content={homepageContent}
            navigate={navigate}
            addToCart={addToCart}
            wishlist={wishlist}
            compare={compare}
            toggleWishlist={(id) => toggleSet(setWishlist, id, "Wishlist add")}
            toggleCompare={(id) => toggleSet(setCompare, id, "Compare add")}
            openQuickView={(product) => setQuickProductId(product.id)}
          />
        )}
        {page === "product" && selectedProduct.id && (
          <ProductPage
            product={selectedProduct}
            addToCart={addToCart}
            products={products}
            navigate={(nextPage, productId, path) => navigate(nextPage, productId, path, nextPage === "product" ? editingCartLineId : null)}
            editingLine={cart.find((item) => item.lineId === editingCartLineId)}
            cancelEdit={() => { setEditingCartLineId(null); setCartOpen(true); }}
            wishlist={wishlist}
            toggleWishlist={(id) => toggleSet(setWishlist, id, "Wishlist add")}
          />
        )}
        {page === "product" && !selectedProduct.id && <section className="section-shell" style={{paddingBlock:'48px'}}>
          <h1>Modeli nuk është i disponueshëm</h1>
          <p>Ky model nuk gjendet në katalogun aktual. Mund të shikoni kornizat e tjera ose të kontaktoni optikën.</p>
          <button className="primary-button" onClick={() => navigate('shop')}>Shiko kornizat</button>
        </section>}
        {page === "fit" && (
          <FitStudioPage
            products={products}
            selectedProduct={selectedProduct}
            navigate={navigate}
            addToCart={addToCart}
            wishlist={wishlist}
            toggleWishlist={(id) => toggleSet(setWishlist, id, "Wishlist add")}
            compare={compare}
            toggleCompare={(id) => toggleSet(setCompare, id, "Compare add")}
            trackEvent={trackPublicEvent}
          />
        )}
        {page === "admin" && (
          <Suspense fallback={<div className="page-section" role="status">Duke ngarkuar portalin…</div>}>
          <AdminPortal
            seedProducts={seedProducts}
            setStoreProducts={setProducts}
            setHomepageContent={setHomepageContent}
            navigate={navigate}
          />
          </Suspense>
        )}
        {page === "wishlist" && (
          <WishlistPage
            products={products.filter((product) => wishlist.has(product.id))}
            navigate={navigate}
            addToCart={addToCart}
            toggleWishlist={(id) => toggleSet(setWishlist, id, "Wishlist add")}
            wishlist={wishlist}
            openQuickView={(product) => setQuickProductId(product.id)}
          />
        )}
        {page === "brand" && (
          <BrandPage
            products={products}
            homepageContent={homepageContent}
            navigate={navigate}
            addToCart={addToCart}
            toggleWishlist={(id) => toggleSet(setWishlist, id, "Wishlist add")}
            wishlist={wishlist}
            openQuickView={(product) => setQuickProductId(product.id)}
          />
        )}
        {page === "guides" && <GuidesPage navigate={navigate} content={homepageContent} />}
        {page === "article" && selectedArticle && <ArticlePage article={selectedArticle} navigate={navigate} />}
        {page === "about" && <AboutPage navigate={navigate} content={homepageContent} />}
        {page === "contact" && <ContactPage navigate={navigate} content={homepageContent} />}
        {page === "policies" && <PoliciesPage navigate={navigate} />}
        {page === "orderStatus" && <OrderTracking key={routePath} navigate={navigate} label={orderStatusLabel} />}
        {page === "account" && <AccountPage navigate={navigate} session={customerSession} onSessionChange={setCustomerSession} content={homepageContent} />}
      </main>
      {page !== "admin" && (page === 'labEurope' ? <LabEuropeFooter navigate={navigate} /> : <SiteFooter navigate={navigate} />)}
      <ProductQuickView
        product={quickProduct}
        products={products}
        onClose={() => setQuickProductId(null)}
        onSelect={(product) => setQuickProductId(product.id)}
        addToCart={(product, configuration) => {
          setQuickProductId(null);
          addToCart(product, configuration);
        }}
        navigate={navigate}
        wishlist={wishlist}
        toggleWishlist={(id) => toggleSet(setWishlist, id, "Wishlist add")}
      />
      <CartDrawer
        key={customerSession?.profile?.id || "guest"}
        open={cartOpen}
        setOpen={setCartOpen}
        cart={cart}
        setCart={setCart}
        total={cartTotal}
        logEvent={logEvent}
        navigate={navigate}
        campaigns={storeCampaigns}
        products={products}
        setStoreProducts={setProducts}
        customerSession={customerSession}
        editItem={(item) => { setCartOpen(false); navigate("product", item.productId, undefined, item.lineId); }}
      />
      {page !== "admin" && ["shop", "prescription", "sunglasses"].includes(page) && !cartOpen && !quickProduct && compare.size === 0 && (
        <button className="floating-cart-button" onClick={() => setCartOpen(true)} aria-label={`Hap shportën, ${cartCount} ${cartCount === 1 ? 'artikull' : 'artikuj'}`}>
          <ShoppingBag size={20} />
          {cartCount > 0 && <span>{cartCount}</span>}
        </button>
      )}
      <CatalogSearch
        open={searchOpen}
        setOpen={setSearchOpen}
        products={products}
        navigate={navigate}
        openQuickView={(product) => setQuickProductId(product.id)}
        label={shqipLabel}
        money={money}
      />
      <SiteHelp page={page} blocked={cartOpen || Boolean(quickProduct) || searchOpen || mobileOpen || compare.size > 0} navigate={navigate} onOpenCart={() => setCartOpen(true)} />
      {toast && !cartOpen && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function NotFoundPage({ navigate, article = false }) {
  const follow = (event, destination) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(destination);
  };
  return <section className="ed-not-found section-shell" aria-labelledby="recovery-title">
    <span className="ed-kicker">404 / OPTIKA MIFTARI</span>
    <h1 id="recovery-title">{article ? 'Ky udhëzues nuk u gjet.' : 'Kjo faqe nuk u gjet.'}</h1>
    <p>Lidhja mund të ketë ndryshuar. Zgjidhni ku dëshironi të vazhdoni; shporta dhe përzgjedhjet tuaja mbeten këtu.</p>
    <div className="ed-not-found-actions">
      <a className="primary-button" href={article ? '/lens-focus/' : '/shop/'} onClick={event => follow(event, article ? 'guides' : 'shop')}>{article ? 'Shiko udhëzuesit' : 'Shiko kornizat'}<ChevronRight size={16} /></a>
      <a className="outline-button" href="/" onClick={event => follow(event, 'home')}>Faqja kryesore</a>
      <a className="ed-text-link" href="/contact/" onClick={event => follow(event, 'contact')}>Kontakto ekipin</a>
    </div>
  </section>;
}

function Header({ page, navigate, mobileOpen, setMobileOpen, cartCount, wishlistCount, onCart, onSearch, customerSession }) {
  const english = useLanguage() === 'en' || page === 'labEurope';
  const headerText = (sq, en) => english ? en.replace(' · Albanian storefront', '').replace(' · Albanian', '') : sq;
  const [openMenu, setOpenMenu] = useState("");
  const [mobileSubnav, setMobileSubnav] = useState("");
  const hoverTimer = useRef(null);
  const mobileNavRef = useRef(null);
  useDialogFocus(mobileOpen, mobileNavRef, () => setMobileOpen(false));
  const contactAction = page === 'clinic'
    ? { page: 'clinic', path: '/clinic#clinic-enquiry', label: 'Kërko konsultë' }
    : page === 'labEurope'
      ? { page: 'labEurope', path: '/laboratory/europe#application', label: 'Partner enquiry' }
    : page === 'labKosovo'
      ? { page: 'labKosovo', path: '/laboratory/kosovo#application', label: 'Apliko si partner' }
    : page === 'partners'
      ? { page: 'partners', path: '/laboratory/partners#partner-enquiry', label: 'Kontakt B2B' }
      : { page: 'contact', path: '/contact#booking', label: 'Rezervo' };
  const nav = [
    { target: "optical", label: headerText("Koleksioni", "Shop frames"), path: "/optical", pages: ["optical", "shop", "prescription", "product", "examination"], children: [
      { target: "shop", label: "Të gjitha kornizat", detail: "BLI ONLINE", path: "/shop" },
      { target: "prescription", label: "Syze optike", detail: "KORNIZA PËR RECETËN TUAJ", path: "/prescription-glasses" },
      { target: "sunglasses", label: "Syze dielli", detail: "GJENI STILIN TUAJ", path: "/sunglasses" },
      { target: "examination", label: "Ekzaminimi optik", detail: "MATJE DHE KËSHILLIM", path: "/ekzaminimi" }
    ] },
    { target: "sunglasses", label: headerText("Syze dielli", "Sunglasses"), path: "/sunglasses", pages: ["sunglasses"], children: [] },
    { target: "brand", label: "Optical Lab", path: "/laboratory", pages: ["brand", "guides", "article", "partners", "labKosovo", "labEurope"], children: [
      { target: "guides", label: "Lens Focus", detail: "TEKNOLOGJIA E LENTEVE", path: "/lens-focus" },
      { target: "labKosovo", label: "Optical Lab Kosovë", detail: "PARTNERITET B2B · SHQIP", path: "/laboratory/kosovo" },
      { target: "labEurope", label: "Optical Lab Europe", detail: "EU PARTNERSHIPS · ENGLISH", path: "/laboratory/europe" },
      { target: "partners", label: "Aplikimi B2B", detail: "ZGJIDHNI TREGUN TUAJ", path: "/laboratory/partners" }
    ] },
    { target: "clinic", label: "Klinika Miftari", path: "/clinic", pages: ["clinic"], children: [] },
    { target: "about", label: "Grupi", path: "/about", pages: ["home", "about", "policies"], children: [
      { target: "home", label: "Miftari Holding Group", detail: "TRI DIVIZIONE, NJË VIZION", path: "/" },
      { target: "policies", label: "Porositë dhe politikat", detail: "INFORMACION PARA BLERJES", path: "/policies" }
    ] }
  ];
  if (english) {
    const names = { shop: ['All frames', 'ALBANIAN STOREFRONT'], prescription: ['Prescription glasses', 'ALBANIAN STOREFRONT'], sunglasses: ['Sunglasses', 'ALBANIAN STOREFRONT'], examination: ['Eye examinations', 'KOSOVO · ALBANIAN'], guides: ['Lens Focus', 'LENS TECHNOLOGY · ALBANIAN'], labKosovo: ['Optical Lab Kosovo', 'KOSOVO · SHQIP'], labEurope: ['Optical Lab Europe', 'EU PARTNERSHIPS · ENGLISH'], partners: ['Partner application', 'CHOOSE YOUR MARKET'], home: ['Miftari Holding Group', 'THREE DIVISIONS · ALBANIAN'], policies: ['Orders & policies', 'ALBANIAN STOREFRONT'] };
    for (const item of nav) {
      if (item.target === 'about') item.label = 'The group';
      if (item.target === 'fit') item.label = 'Virtual try-on';
      for (const child of item.children) if (names[child.target]) [child.label, child.detail] = names[child.target];
    }
  }

  const navigation = megaNavigation(nav, english);
  const clearHover = () => window.clearTimeout(hoverTimer.current);
  const closeMenu = () => { clearHover(); setOpenMenu(''); };
  const toggleMenu = (item) => { clearHover(); setOpenMenu(current => current === item.target ? '' : item.target); };
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  useEffect(() => {
    setMobileSubnav('');
    closeMenu();
  }, [mobileOpen, page]);

  useEffect(() => {
    const closeDesktopMenu = (event) => {
      if (!event.target.closest?.(".desktop-nav-group")) closeMenu();
    };
    document.addEventListener("pointerdown", closeDesktopMenu);
    return () => document.removeEventListener("pointerdown", closeDesktopMenu);
  }, []);

  useEffect(() => {
    closeMenu();
  }, [page]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 901px)");
    const closeMobileOnDesktop = () => { closeMenu(); if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeMobileOnDesktop);
    return () => desktop.removeEventListener("change", closeMobileOnDesktop);
  }, [setMobileOpen]);

  const goTo = (item) => {
    closeMenu();
    setMobileSubnav("");
    setMobileOpen(false);
    navigate(item.target, item.productId, item.path);
  };

  const followLink = (event, item) => {
    // Preserve open-in-new-tab, copy-link and browser navigation semantics.
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    goTo(item);
  };

  const handleGroupKeyDown = (event, item) => {
    const group = event.currentTarget;
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      clearHover();
      setOpenMenu(item.target);
      const focused = document.activeElement;
      window.requestAnimationFrame(() => {
        const links = [...group.querySelectorAll(".desktop-subnav a[href]")];
        const current = links.indexOf(focused);
        const index = navigationIndex(event.key, current, links.length);
        links[index]?.focus();
      });
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      group.querySelector(".desktop-nav-trigger")?.focus();
    }
  };

  return (
    <header className={`site-header is-unified has-mega-navigation ${openMenu ? 'mega-is-open' : ''}`}>
      <a href="/" className="brand" onClick={event => followLink(event, { target: 'home', path: '/' })} aria-label={headerText('Kthehu në faqen kryesore', 'Miftari Holding Group homepage · Albanian')}>
        <img className="brand-logo" src="/assets/brand/optika-miftari-monogram.png" alt="" />
        <span className="brand-wordmark">
          OPTIKA
          <strong>MIFTARI</strong>
        </span>
      </a>
      <LanguageSwitch />
      <nav className="desktop-nav" aria-label={headerText('Navigimi kryesor', 'Main navigation')}>
        {navigation.map((item) => {
          const hasSubpages = item.children.length > 0;
          const isOpen = hasSubpages && openMenu === item.target;
          const NavTrigger = hasSubpages ? 'button' : 'a';
          return (
            <div
              className={`desktop-nav-group ${hasSubpages ? "has-subpages" : "is-direct"} ${isOpen ? "is-open" : ""}`}
              key={item.label}
              onPointerEnter={(event) => {
                if (event.pointerType !== 'mouse') return;
                clearHover();
                if (hasSubpages) hoverTimer.current = window.setTimeout(() => setOpenMenu(item.target), 160);
                else closeMenu();
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== 'mouse') return;
                clearHover();
                const group = event.currentTarget;
                hoverTimer.current = window.setTimeout(() => {
                  if (!group.contains(document.activeElement)) setOpenMenu('');
                }, 220);
              }}
              onBlur={hasSubpages ? (event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) closeMenu();
              } : undefined}
              onKeyDown={hasSubpages ? (event) => handleGroupKeyDown(event, item) : undefined}
            >
              <NavTrigger
                className={`desktop-nav-trigger ${item.pages.includes(page) ? "active" : ""}`}
                href={hasSubpages ? undefined : item.path}
                data-testid={`nav-${item.label.toLowerCase().replaceAll(" ", "-")}`}
                onClick={event => hasSubpages ? toggleMenu(item) : followLink(event, item)}
                aria-current={item.target === page ? "page" : undefined}
                aria-expanded={hasSubpages ? isOpen : undefined}
                aria-controls={hasSubpages ? `desktop-subnav-${item.target}` : undefined}
              >
                <span>{item.label}</span>
                {hasSubpages && <ChevronDown size={13} aria-hidden="true" />}
              </NavTrigger>
              {hasSubpages && (
                <div className="desktop-subnav mega-panel" id={`desktop-subnav-${item.target}`} hidden={!isOpen} aria-label={english ? `${item.label} pages` : `Nënfaqet e ${item.label}`}>
                  <div className={`mega-panel-inner mega-columns-${item.columns.length}`}>
                    <div className="mega-link-columns">
                      {item.columns.map(column => <section className="mega-column" key={column.title} aria-label={column.title}>
                        <h2>{column.title}</h2>
                        {column.links.map(child => <a key={child.path} href={child.path} aria-current={child.target === page ? 'page' : undefined} onClick={event => followLink(event, child)}>{child.label}</a>)}
                      </section>)}
                    </div>
                    <div className="mega-features">
                      {item.features.map(child => <a className={`mega-feature is-${child.kind}`} key={child.path} href={child.path} onClick={event => followLink(event, child)} aria-current={child.target === page ? 'page' : undefined}>
                        <span className="mega-feature-image"><img src={isOpen ? child.image : undefined} alt="" width="320" height="240" decoding="async" /></span>
                        <span className="mega-feature-caption">{child.caption}</span>
                        <span className="mega-feature-label">{child.label}<ChevronRight size={16} aria-hidden="true" /></span>
                      </a>)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
      {openMenu && <button className="mega-backdrop" tabIndex={-1} aria-label={headerText('Mbyll nënmenynë', 'Close navigation panel')} onClick={closeMenu} />}
      <div className="header-actions">
        <SitePageLink className="header-booking" navigate={navigate} page={contactAction.page} path={contactAction.path}>{contactAction.label}</SitePageLink>
        <button className="icon-button header-search" onClick={onSearch} aria-label={headerText('Kërko produkte', 'Search products · Albanian storefront')}>
          <Search size={19} />
        </button>
        <SitePageLink className={`icon-button header-account ${customerSession?.authenticated ? "is-authenticated" : ""} ${page === "account" ? "selected" : ""}`} navigate={navigate} page="account" aria-label={customerSession?.authenticated ? `${headerText('I kyçur si', 'Signed in as')} ${customerSession.profile?.firstName || headerText('klient', 'customer')}. ${headerText('Hap llogarinë time', 'Open my account · Albanian')}` : headerText('Hyr ose krijo llogari', 'Sign in or create an account · Albanian')} title={headerText('Llogaria ime', 'My account · Albanian')}>
          <User size={19} />
          {customerSession?.authenticated && <span className="header-account-name"><small>{headerText('I KYÇUR', 'SIGNED IN')}</small><strong>{customerSession.profile?.firstName || headerText('Llogaria', 'Account')}</strong></span>}
        </SitePageLink>
        <SitePageLink className="icon-button count-button header-wishlist" navigate={navigate} page="wishlist" aria-label={headerText('Të preferuarat', 'Saved frames · Albanian storefront')}>
          <Heart size={19} />
          {wishlistCount > 0 && <span>{wishlistCount}</span>}
        </SitePageLink>
        <button className="icon-button count-button" onClick={onCart} aria-label={headerText('Hap shportën', 'Open bag · Albanian storefront')}>
          <ShoppingBag size={19} />
          {cartCount > 0 && <span>{cartCount}</span>}
        </button>
        {import.meta.env.DEV && (
          <button
            className="icon-button staff-access"
            onClick={() => navigate("admin")}
            aria-label="Hap portalin e stafit"
            title="Portali i stafit"
          >
            <LockKeyhole size={18} />
          </button>
        )}
        <button
          className="icon-button mobile-toggle"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? headerText('Mbyll menynë', 'Close menu') : headerText('Hap menynë', 'Open menu')}
          aria-expanded={mobileOpen}
          aria-controls="mobile-site-navigation"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
      {mobileOpen && (
        <>
        <button className="mobile-nav-backdrop" tabIndex={-1} aria-label={headerText('Mbyll menynë', 'Close menu')} onClick={() => setMobileOpen(false)} />
        <nav ref={mobileNavRef} id="mobile-site-navigation" className="mobile-nav" role="dialog" aria-modal="true" aria-label={headerText('Navigimi në telefon', 'Mobile navigation')}>
          <div className="mobile-nav-top"><span>{headerText('Zbuloni Miftari', 'Explore Miftari')}</span><button type="button" data-autofocus aria-label={headerText('Mbyll menynë', 'Close menu')} onClick={() => setMobileOpen(false)}><X size={20} /></button></div>
          <button className="mobile-catalog-search" onClick={(event) => { event.currentTarget.closest('header')?.querySelector('.mobile-toggle')?.focus(); setMobileOpen(false); onSearch(); }}><Search size={18} />{headerText('Kërko model, ngjyrë ose material', 'Search frames · Albanian storefront')} <ChevronRight size={16} /></button>
          <button className="mobile-nav-primary" onClick={() => navigate(contactAction.page, undefined, contactAction.path)}>{contactAction.label === 'Rezervo' ? 'Rezervo ekzaminimin optik' : contactAction.label} <ChevronRight size={16} /></button>
          <button className="mobile-account-link" onClick={() => navigate("account")}><User size={17} /> {customerSession?.authenticated ? `${headerText('Llogaria e', 'Account:')} ${customerSession.profile?.firstName || headerText('klientit', 'customer')}` : headerText('Hyr ose krijo llogari', 'Sign in · Albanian storefront')}<ChevronRight size={16} /></button>
          {navigation.map((item) => {
            const hasSubpages = item.children.length > 0;
            const expanded = hasSubpages && mobileSubnav === item.label;
            return (
              <div className={`mobile-nav-group ${hasSubpages ? "has-subpages" : "is-direct"} ${expanded ? "is-open" : ""}`} key={item.label}>
                <div className="mobile-nav-heading">
                  <button
                    className={`mobile-nav-parent ${item.pages.includes(page) ? "active" : ""}`}
                    data-testid={`mobile-nav-${item.label.toLowerCase().replaceAll(" ", "-")}`}
                    onClick={() => hasSubpages ? setMobileSubnav(expanded ? '' : item.label) : goTo(item)}
                    aria-current={item.target === page ? "page" : undefined}
                    aria-expanded={hasSubpages ? expanded : undefined}
                    aria-controls={hasSubpages ? `mobile-subnav-${item.target}` : undefined}
                  >
                    {item.label}
                    {hasSubpages && <ChevronDown size={17} aria-hidden="true" />}
                  </button>
                </div>
                {hasSubpages && expanded && (
                  <div className="mobile-subnav" id={`mobile-subnav-${item.target}`}>
                    {item.children.map((child) => (
                      <a key={`${item.target}-mobile-${child.target}`} href={child.path} aria-current={child.target === page ? "page" : undefined} onClick={event => followLink(event, child)}>{child.label}</a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {import.meta.env.DEV && (
            <button className="mobile-staff-link" onClick={() => navigate("admin", undefined, "/staff")}>
              Staff workspace <ChevronRight size={16} />
            </button>
          )}
        </nav>
        </>
      )}
    </header>
  );
}

function HomePage(props) { return <GroupHome {...props} optical content={props.homepageContent} label={shqipLabel} />; }
function ExpandedHomePageArchive({ products, navigate, addToCart, toggleWishlist, wishlist }) {
  const opticalProducts = products.filter((product) => product.type === "Prescription Glasses");
  const sunProducts = products.filter((product) => product.type === "Sunglasses");
  const featuredProducts = [
    ...opticalProducts.slice(0, 2),
    ...sunProducts.slice(-2)
  ].slice(0, 4);
  const [activeZone, setActiveZone] = useState("distance");
  const progressiveZones = [
    {
      id: "distance",
      number: "01",
      label: "Largësi",
      context: "Rrugë · drejtim · hapësirë",
      copy: "Zona e sipërme optimizohet për orientim të qartë dhe shikim të rehatshëm në distancë."
    },
    {
      id: "screen",
      number: "02",
      label: "Ekrani",
      context: "Punë · biseda · lëvizje",
      copy: "Korridori i ndërmjetëm përshtatet me distancën reale të ekranit dhe mënyrën si punoni."
    },
    {
      id: "near",
      number: "03",
      label: "Afër",
      context: "Telefon · lexim · detaje",
      copy: "Zona e afërt vendoset sipas recetës, kornizës dhe pozicionit tuaj natyral të leximit."
    }
  ];
  const activeZoneData = progressiveZones.find((zone) => zone.id === activeZone) || progressiveZones[0];

  return (
    <div className="om-home omx-home">
      <section className="omx-hero">
        <div className="omx-hero-copy">
          <span className="omx-kicker"><Eye size={16} /> SHTËPI OPTIKE FAMILJARE · 30 VJET</span>
          <h1>Qartësi,<br /><em>brez pas brezi.</em></h1>
          <p>
            Prej tri dekadash, Optika Miftari bashkon ekzaminimin profesional,
            thjerrëzat me recetë dhe punimin e kujdesshëm në një përvojë të vetme.
          </p>
          <div className="omx-actions">
            <button className="omx-btn omx-btn-light" data-testid="hero-exam" onClick={() => navigate("contact")}>
              Rezervo ekzaminimin <ChevronRight size={17} />
            </button>
            <button className="omx-btn omx-btn-ghost" onClick={() => navigate("about")}>
              Rreth nesh
            </button>
          </div>
          <div className="omx-hero-facts" aria-label="Besimi dhe shërbimet kryesore">
            <span><b>30</b> vjet kujdes optik</span>
            <span><b>02</b> lokacione</span>
            <span><b>01</b> proces i plotë</span>
          </div>
        </div>
        <div className="omx-hero-photo">
          <img src="/assets/brand/optika-miftari-fitting-campaign.webp" width="1672" height="941" fetchpriority="high" decoding="async" alt="Optiku duke përshtatur kornizën e një klienteje" />
          <div className="omx-hero-photo-note" aria-hidden="true">
            <span>EKZAMINIM</span><span>MATJE</span><span>PUNIM</span><span>PËRSHTATJE</span>
          </div>
        </div>
      </section>

      <nav className="omx-entry-grid" aria-label="Filloni këtu">
        {[
          [Eye, "Ekzaminimi", "Receta dhe shëndeti i syrit", () => navigate("contact")],
          [Layers3, "Progresivet", "Larg, ekran dhe afër", () => navigate("guides", undefined, "/lens-focus")],
          [ShoppingBag, "Me dioptri", "Korniza për recetën tuaj", () => navigate("prescription", undefined, "/prescription-glasses")],
          [Camera, "Provo online", "Kamerë, selfie dhe matje", () => navigate("fit", sunProducts[0]?.id, "/virtual-try-on")]
        ].map(([Icon, title, copy, action], index) => (
          <button key={title} onClick={action}>
            <span className="omx-entry-number">0{index + 1}</span>
            <Icon size={21} />
            <strong>{title}</strong>
            <small>{copy}</small>
            <ChevronRight size={17} />
          </button>
        ))}
      </nav>

      <section className="omx-manifesto">
        <div>
          <span className="omx-eyebrow">TRADITË FAMILJARE · PRECIZION MODERN</span>
          <h2>Jo vetëm çfarë mbani.<br />Por si do të shihni.</h2>
        </div>
        <div className="omx-manifesto-copy">
          <p>
            Ne e njohim shikimin si përgjegjësi afatgjatë. Prandaj receta, rutina,
            korniza, centrimi dhe kontrolli final trajtohen nga një ekip që ju shoqëron
            nga ekzaminimi deri te dorëzimi.
          </p>
          <button className="omx-link" onClick={() => navigate("about")}>
            Historia dhe standardi ynë <ChevronRight size={16} />
          </button>
        </div>
      </section>

      <section className="omx-heritage" aria-label="Premtimi i Optika Miftari">
        <div className="omx-heritage-mark">
          <img src="/assets/brand/optika-miftari-monogram.png" alt="" />
          <span>OPTIKA MIFTARI</span>
        </div>
        <div className="omx-heritage-copy">
          <span className="omx-eyebrow">QARTËSIA KALON BREZ PAS BREZI</span>
          <h2>Një emër familjar.<br />Një standard që vazhdon.</h2>
          <p>
            Përvojën e 30 viteve e bashkojmë me matje moderne,
            laborator optik dhe kujdes personal për fëmijë, të rritur dhe të moshuar.
          </p>
        </div>
        <div className="omx-heritage-values">
          <span><b>01</b> Dëgjojmë nevojën</span>
          <span><b>02</b> Matim me saktësi</span>
          <span><b>03</b> Dorëzojmë me kujdes</span>
        </div>
      </section>

      <section className="omx-progressive">
        <div className="omx-progressive-visual">
          <div className="omx-zone-stack" aria-label="Zonat e thjerrëzës progresive">
            {progressiveZones.map((zone) => (
              <button
                key={zone.id}
                className={activeZone === zone.id ? "is-active" : ""}
                onClick={() => setActiveZone(zone.id)}
                aria-pressed={activeZone === zone.id}
              >
                <span>{zone.number}</span>
                <strong>{zone.label}</strong>
                <small>{zone.context}</small>
              </button>
            ))}
          </div>
          <div className="omx-zone-detail" aria-live="polite">
            <span>{activeZoneData.number} · {activeZoneData.label}</span>
            <p>{activeZoneData.copy}</p>
          </div>
        </div>
        <div className="omx-progressive-copy">
          <span className="omx-eyebrow">PROGRESIVE TË PERSONALIZUARA</span>
          <h2>Një palë.<br />Tri distanca.<br />Një matje e saktë.</h2>
          <p>
            Progresivet i zgjedhim sipas recetës, kornizës, anatomisë së fytyrës
            dhe mënyrës si lëvizin sytë tuaj gjatë ditës.
          </p>
          <div className="omx-checks">
            <span><Check size={16} /> Distanca pupillare dhe lartësia e montimit</span>
            <span><Check size={16} /> Këndi dhe pozicioni real i kornizës</span>
            <span><Check size={16} /> Kontroll pas montimit dhe përshtatje</span>
          </div>
          <button className="omx-btn omx-btn-dark" onClick={() => navigate("contact")}>
            Flisni me optikun <ChevronRight size={17} />
          </button>
        </div>
      </section>

      <section className="omx-frames">
        <div className="omx-section-head">
          <div>
            <span className="omx-eyebrow">KORNIZA TË ZGJEDHURA</span>
            <h2>Forma që ju shkon.<br />Masa që ju rri mirë.</h2>
          </div>
          <button className="omx-link" onClick={() => navigate("shop")}>
            Shiko të gjitha kornizat <ChevronRight size={16} />
          </button>
        </div>
        <div className="omx-product-grid">
          {featuredProducts.map((product) => (
            <HomeProductTile
              key={product.id}
              product={product}
              navigate={navigate}
              addToCart={addToCart}
              toggleWishlist={toggleWishlist}
              wishlist={wishlist}
            />
          ))}
        </div>
      </section>

      <section className="omx-process">
        <div className="omx-section-head">
          <div>
            <span className="omx-eyebrow">NGA RECETA TE PALËT E PËRFUNDUARA</span>
            <h2>Një proces i qartë.<br />Pa hamendësim.</h2>
          </div>
          <button className="omx-link" onClick={() => navigate("brand")}>
            Shiko laboratorin <ChevronRight size={16} />
          </button>
        </div>
        <div className="omx-process-grid">
          {[
            ["/assets/crafted/lens-blank-lab.webp", "01", "Kuptojmë", "Recetën, rutinën dhe çfarë ju lodh gjatë ditës."],
            ["/assets/crafted/laser-cutting-lab.webp", "02", "Përgatisim", "Materialin, shtresat dhe centrimin për kornizën tuaj."],
            ["/assets/crafted/lens-polishing-lab.webp", "03", "Përshtatim", "Drejtimin, rehatinë dhe uljen e kornizës në fytyrë."]
          ].map(([image, number, title, copy]) => (
            <article key={number}>
              <img src={image} alt="" loading="lazy" />
              <div><span>{number}</span><h3>{title}</h3><p>{copy}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="omx-rx-sun">
        <div className="omx-rx-sun-photo">
          <img src="/assets/products/optika-miftari-sun-collection.webp" alt="Koleksion i syzeve të diellit që mund të përgatiten edhe me recetë" loading="lazy" />
        </div>
        <div className="omx-rx-sun-copy">
          <span className="omx-eyebrow">SYZE DIELLI ME RECETË</span>
          <h2>Mbrojtje nga dielli.<br />Shikimi juaj, brenda.</h2>
          <p>
            Zgjidhni kornizën dhe ne vlerësojmë recetën, kurbën, materialin,
            ngjyrën dhe polarizimin për një palë që funksionon si syze optike dhe duket si syze dielli.
          </p>
          <div className="omx-checks">
            <span><Check size={16} /> Recetë, centrim dhe përshtatje për kornizën</span>
            <span><Check size={16} /> Nuanca, polarizim dhe mbrojtje UV sipas nevojës</span>
            <span><Check size={16} /> Kontroll përfundimtar para dorëzimit</span>
          </div>
          <button className="omx-btn omx-btn-dark" onClick={() => navigate("shop")}>
            Zgjidhni kornizën <ChevronRight size={17} />
          </button>
        </div>
      </section>

      <section className="omx-fit">
        <div className="omx-fit-copy">
          <span className="omx-eyebrow">FIT STUDIO · NË PAJISJEN TUAJ</span>
          <h2>Provojini online.<br />Konfirmojini me optikun.</h2>
          <p>
            Krahasoni proporcionin me kamerë ose selfie dhe vlerësoni masën me një
            kartë standarde. Receta dhe centrimi përfundimtar verifikohen gjithmonë në optikë.
          </p>
          <div className="omx-fit-tools">
            <span><Camera size={18} /> Provë virtuale</span>
            <span><Ruler size={18} /> Matje e udhëzuar</span>
            <span><ShieldCheck size={18} /> Foto lokale, pa ngarkim</span>
          </div>
          <button className="omx-btn omx-btn-dark" onClick={() => navigate("fit", sunProducts[0]?.id, "/virtual-try-on")}>
            Hape Fit Studio <ChevronRight size={17} />
          </button>
        </div>
        <div className="omx-fit-photo">
          <img src="/assets/products/meridian-m9-studio.jpg" alt="Korniza Meridian M9 për provë virtuale" loading="lazy" />
        </div>
      </section>

      <section className="omx-care-proof">
        <div className="omx-reviews-lead">
          <span className="omx-eyebrow">BESIMI NUK ËSHTË SLOGAN</span>
          <h2>Tri gjëra që i mbrojmë në çdo palë.</h2>
        </div>
        <div className="omx-care-grid">
          <article><Eye size={22} /><span>01</span><h3>Qartësinë</h3><p>Receta dhe matjet duhet të punojnë së bashku në kornizën reale.</p></article>
          <article><ShieldCheck size={22} /><span>02</span><h3>Rehatinë</h3><p>Pesha, ura, këndi dhe pozicioni kontrollohen për përdorim të përditshëm.</p></article>
          <article><Users size={22} /><span>03</span><h3>Marrëdhënien</h3><p>Shërbimi vazhdon me përshtatje, këshillim dhe kujdes pas dorëzimit.</p></article>
        </div>
      </section>

      <section className="omx-visit">
        <div className="omx-visit-copy">
          <span className="omx-eyebrow">OPTIKA MIFTARI · DY LOKACIONE</span>
          <h2>Filloni me një bisedë dhe ekzaminim të saktë.</h2>
          <p>Lokacioni Mitrovicë · Mbretëresha Teutë 182 · E hënë–E shtunë · 10:00–19:30</p>
        </div>
        <div className="omx-visit-details">
          <span><MapPin size={18} /> 40000 Mitrovicë, Kosovë</span>
          <span><Phone size={18} /> +383 43 777 667</span>
          <span><Clock size={18} /> Na pyesni për lokacionin më të afërt</span>
        </div>
        <div className="omx-visit-actions">
          <button className="omx-btn omx-btn-light" onClick={() => navigate("contact")}>
            <CalendarDays size={17} /> Rezervo ekzaminimin
          </button>
          <a className="omx-btn omx-btn-outline-light" href={`https://wa.me/${storePhone}`} target="_blank" rel="noreferrer">
            <MessageCircle size={17} /> WhatsApp
          </a>
        </div>
      </section>
    </div>
  );
}

function HomeProductTile({ product, navigate, openQuickView, addToCart, toggleWishlist, wishlist }) {
  const inspectProduct = () => openQuickView ? openQuickView(product) : navigate("product", product.id);
  return (
    <article className="om-product-tile">
      <div className="om-product-media">
        <button className="om-product-image-button" onClick={inspectProduct} aria-label={`Shiko shpejt ${product.name}`}>
          <img src={product.image} alt={product.name} loading="lazy" />
        </button>
        <span className="om-product-type">{shqipLabel(product.type)}</span>
        <button
          className={`om-product-heart ${wishlist?.has(product.id) ? "active" : ""}`}
          onClick={() => toggleWishlist(product.id)}
          aria-label="Shto ose hiq nga të preferuarat"
        >
          <Heart size={17} />
        </button>
      </div>
      <div className="om-product-copy">
        <div>
          <h3>{product.name}</h3>
          <p>{shqipLabel(product.frameShape)} · {product.size} · {product.uv}</p>
        </div>
        <strong>{money(product.salePrice || product.price)}</strong>
      </div>
      <div className="om-product-actions">
        <button onClick={inspectProduct}>Shiko shpejt</button>
        {product.type === "Sunglasses" && product.virtualTryOnEnabled !== false && (
          <button onClick={() => navigate("fit", product.id, "/virtual-try-on")}><Camera size={15} /> Provo në 3D</button>
        )}
        <button onClick={() => addToCart(product)}><ShoppingBag size={15} /> Shto</button>
      </div>
    </article>
  );
}

function RetailHomePage({ products, homepageContent, navigate, addToCart, toggleWishlist, wishlist }) {
  const featuredIds = String(homepageContent.featuredProducts || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const featuredProducts = featuredIds.length
    ? featuredIds.map((id) => products.find((product) => product.id === id)).filter(Boolean)
    : products.slice(0, 3);
  const heroProduct = featuredProducts[0] || products[0];
  const sunProduct = products.find((product) => product.type === "Sunglasses") || products[0];
  const opticalProduct = products.find((product) => product.type === "Prescription Glasses") || products[1] || products[0];

  return (
    <div className="sales-home">
      <section className="sales-hero">
        <div className="sales-hero-copy">
          <span className="sales-kicker">OPTIKA MIFTARI / MITROVICA</span>
          <h1>Eyewear,<br /><em>made personal.</em></h1>
          <p>
            Original sunglasses, prescription glasses, and professional lens finishing—
            selected and fitted around the way you live.
          </p>
          <div className="sales-hero-actions">
            <button className="primary-button" data-testid="hero-shop" onClick={() => navigate("shop")}>
              Shop all frames <ChevronRight size={18} />
            </button>
            <button className="secondary-button" data-testid="hero-prescription" onClick={() => navigate("product", opticalProduct.id)}>
              Build prescription pair
            </button>
          </div>
          <div className="sales-hero-proof" aria-label="Service highlights">
            <span><Check size={15} /> Personal fitting</span>
            <span><Check size={15} /> Professional optical lab</span>
            <span><Check size={15} /> Expert lens review</span>
          </div>
        </div>

        <div className="sales-hero-product">
          <span className="sales-hero-orbit" aria-hidden="true" />
          <img src={heroProduct.image} alt={`${heroProduct.name} premium eyewear`} />
          <div className="sales-product-caption">
            <span>{heroProduct.badges?.[0] || "Featured frame"}</span>
            <strong>{heroProduct.name}</strong>
            <button onClick={() => navigate("product", heroProduct.id)} aria-label={`View ${heroProduct.name}`}>
              {money(heroProduct.salePrice || heroProduct.price)} <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>

      <nav className="home-pathways" aria-label="Explore Optika Miftari">
        <button onClick={() => navigate("shop")}>
          <span>01</span><strong>Sunglasses</strong><small>UV400 & polarized</small><ChevronRight size={17} />
        </button>
        <button onClick={() => navigate("product", opticalProduct.id)}>
          <span>02</span><strong>Prescription</strong><small>Frames + custom lenses</small><ChevronRight size={17} />
        </button>
        <button onClick={() => navigate("guides", undefined, "/lens-focus")}>
          <span>03</span><strong>Lens care</strong><small>Choose with confidence</small><ChevronRight size={17} />
        </button>
        <button onClick={() => navigate("brand")}>
          <span>04</span><strong>Our craft</strong><small>See how a pair is made</small><ChevronRight size={17} />
        </button>
      </nav>

      <section className="section home-shop-intro" id="collections">
        <div className="section-heading inline-heading">
          <div>
            <p>Start with what you need</p>
            <h2>Two ways to find your next pair.</h2>
          </div>
          <button className="text-link" onClick={() => navigate("shop")}>
            See the full collection <ChevronRight size={16} />
          </button>
        </div>
        <div className="home-category-grid">
          <article className="home-category-card">
            <div>
              <span>SYZE DIELLI</span>
              <h3>Sun, styled<br />your way.</h3>
              <p>Original silhouettes with UV protection, polarized options, and prescription-ready lenses.</p>
              <button className="primary-button" onClick={() => navigate("shop")}>Shop sunglasses</button>
            </div>
            <img src={sunProduct.image} alt={sunProduct.name} />
          </article>
          <article className="home-category-card optical-card">
            <div>
              <span>SYZE OPTIKE</span>
              <h3>Clarity without<br />compromise.</h3>
              <p>Choose the frame, add your prescription, and let our optical team review every detail.</p>
              <button className="primary-button" onClick={() => navigate("product", opticalProduct.id)}>Build your pair</button>
            </div>
            <img src={opticalProduct.image} alt={opticalProduct.name} />
          </article>
        </div>
      </section>

      <section className="section home-best-sellers">
        <div className="section-heading inline-heading">
          <div>
            <p>Most wanted</p>
            <h2>Frames people come back for.</h2>
          </div>
          <button className="secondary-button" data-testid="home-view-all" onClick={() => navigate("shop")}>
            Shop all frames
          </button>
        </div>
        <ProductRail
          products={featuredProducts.length ? featuredProducts : products.slice(0, 3)}
          navigate={navigate}
          addToCart={addToCart}
          toggleWishlist={toggleWishlist}
          wishlist={wishlist}
        />
      </section>

      <section className="section home-rx-panel">
        <div className="home-rx-copy">
          <span className="sales-kicker">PRESCRIPTION, SIMPLIFIED</span>
          <h2>Your prescription.<br />Our precision.</h2>
          <p>
            Order your frame now and upload your prescription when you are ready.
            Our team checks the details before your lenses enter the lab.
          </p>
          <button className="primary-button" onClick={() => navigate("product", opticalProduct.id)}>
            Start your prescription pair <ChevronRight size={17} />
          </button>
        </div>
        <ol className="home-rx-steps">
          <li><b>01</b><div><strong>Choose your frame</strong><span>Find the shape, color, and fit that feels right.</span></div></li>
          <li><b>02</b><div><strong>Add your prescription</strong><span>Upload it now, enter it manually, or send it later.</span></div></li>
          <li><b>03</b><div><strong>We review and finish</strong><span>Your lenses are checked, fitted, and inspected by our optical team.</span></div></li>
        </ol>
      </section>

      <section className="section home-difference">
        <div className="section-heading inline-heading">
          <div>
            <p>Why Optika Miftari</p>
            <h2>More than a frame shop.</h2>
          </div>
          <button className="secondary-button" onClick={() => navigate("contact")}>
            Visit us in Mitrovica
          </button>
        </div>
        <div className="home-difference-grid">
          <article><User size={23} /><span>01</span><h3>Personal fitting</h3><p>Face shape, bridge fit, prescription, and daily routine are considered together.</p></article>
          <article><ShieldCheck size={23} /><span>02</span><h3>Lab-level precision</h3><p>Professional lens preparation, careful installation, alignment, and final inspection.</p></article>
          <article><MessageCircle size={23} /><span>03</span><h3>Advice that stays human</h3><p>Clear guidance before purchase and real support when your prescription needs review.</p></article>
        </div>
      </section>

      <section className="home-brand-teaser">
        <div className="home-brand-teaser-copy">
          <span>CRAFTED BY MIFTARI</span>
          <h2>See what goes<br />into every pair.</h2>
          <p>Step inside the materials, lens layers, engineering, and hand-finishing behind the glasses.</p>
          <button className="gold-button" onClick={() => navigate("brand")}>
            Experience the brand story <ChevronRight size={17} />
          </button>
        </div>
        <div className="home-brand-teaser-visual">
          <span>14 STAGES / ONE FINISHED PAIR</span>
          <img src={assemblyAssets.final} alt="Optika Miftari finished sunglasses" />
        </div>
      </section>

      <Reviews />

      <section className="home-visit-band">
        <div className="home-visit-mark">
          <img src="/assets/brand/optika-miftari-monogram.png" alt="" />
        </div>
        <div>
          <span>OPTIKA MIFTARI / MITROVICA</span>
          <h2>Try them on. Talk to an expert. Leave certain.</h2>
          <p>Mbretëresha Teutë 182 · Monday–Saturday · 10:00–19:30</p>
        </div>
        <div className="home-visit-actions">
          <button className="primary-button" onClick={() => navigate("contact")}><MapPin size={16} /> Plan your visit</button>
          <a className="secondary-button" href="https://www.instagram.com/optikamiftari/" target="_blank" rel="noreferrer">
            <Instagram size={16} /> Instagram
          </a>
        </div>
      </section>
    </div>
  );
}

function LegacyHomePage({ products, homepageContent, navigate, addToCart, toggleWishlist, wishlist }) {
  const featuredIds = String(homepageContent.featuredProducts || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const featuredProducts = featuredIds.length
    ? featuredIds.map((id) => products.find((product) => product.id === id)).filter(Boolean)
    : products.slice(0, 3);

  return (
    <>
      <section className="miftari-brand-band" aria-label="Optika Miftari">
        <div className="miftari-brand-lockup">
          <img src="/assets/brand/optika-miftari-monogram.png" alt="Optika Miftari monogram" />
          <p>OPTIKA MIFTARI <span>MITROVICË</span></p>
        </div>
        <div>
          <span className="brand-eyebrow">{homepageContent.banner}</span>
          <h2>Syze optike. Syze dielli. Precision for every pair.</h2>
          <p>Frames selected with taste, lenses prepared with care, and personal fitting from our optical laboratory in Mitrovica.</p>
        </div>
        <div className="miftari-brand-actions">
          <a className="primary-button" href="https://www.instagram.com/optikamiftari/" target="_blank" rel="noreferrer">
            <Instagram size={17} /> Instagram
          </a>
          <button className="secondary-button" onClick={() => navigate("contact")}>Visit the store</button>
        </div>
      </section>
      <section className="section split-shop" id="collections">
        <div className="section-heading">
          <p>Shop by intent</p>
          <h2>Sunglasses and prescription glasses made for modern life.</h2>
        </div>
        <div className="split-grid">
          {collections.slice(0, 2).map((item, index) => (
            <article className="feature-panel tall" key={item.title}>
              <span>0{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
              <button className="text-link" onClick={() => navigate(index === 0 ? "shop" : "product")}>
                {item.cta} <ChevronRight size={16} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="section collection-showcase">
        <div className="section-heading inline-heading">
          <div>
            <p>Featured collections</p>
            <h2>Frames grouped by optical intent, not just style.</h2>
          </div>
          <button className="secondary-button" onClick={() => navigate("shop")}>
            Browse collections
          </button>
        </div>
        <div className="collection-grid">
          {collections.map((item, index) => (
            <article key={item.title}>
              <span>0{index + 1}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-heading inline-heading">
          <div>
            <p>Featured collection</p>
            <h2>Best sellers with optical-lab precision.</h2>
          </div>
            <button className="secondary-button" data-testid="home-view-all" onClick={() => navigate("shop")}>
            View all
          </button>
        </div>
        <ProductRail
          products={featuredProducts.length ? featuredProducts : products.slice(0, 3)}
          navigate={navigate}
          addToCart={addToCart}
          toggleWishlist={toggleWishlist}
          wishlist={wishlist}
        />
      </section>

      <section className="section">
        <div className="section-heading inline-heading">
          <div>
            <p>New arrivals</p>
            <h2>Fresh silhouettes, tuned for modern prescriptions.</h2>
          </div>
          <button className="secondary-button" onClick={() => navigate("shop")}>
            Shop new arrivals
          </button>
        </div>
        <ProductRail
          products={[...products].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3)}
          navigate={navigate}
          addToCart={addToCart}
          toggleWishlist={toggleWishlist}
          wishlist={wishlist}
        />
      </section>

      <LensTechnology />
      <PrescriptionSimple navigate={navigate} />
      <TryOnSection navigate={navigate} />
      <WhyDifferent />
      <Reviews />
      <EducationSection navigate={navigate} />

      <section className="final-cta">
        <div>
          <h2>Your next frame starts with your vision.</h2>
          <p>Build a complete pair with lens packages, coatings, prescription upload, and expert review.</p>
        </div>
        <div className="cta-row">
          <button className="primary-button" onClick={() => navigate("product")}>
            Build prescription pair
          </button>
          <button className="ghost-button" onClick={() => navigate("shop")}>
            Shop sunglasses
          </button>
          <button className="secondary-button" onClick={() => navigate("contact")}>
            Book eye consultation
          </button>
        </div>
      </section>
    </>
  );
}

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const smoothStep = (value) => {
  const next = clamp01(value);
  return next * next * (3 - 2 * next);
};
const stageRange = (phase, start, end) => smoothStep((phase - start) / Math.max(0.001, end - start));
const stageWindow = (phase, enterStart, enterEnd, exitStart, exitEnd) => {
  const entered = stageRange(phase, enterStart, enterEnd);
  const exited = stageRange(phase, exitStart, exitEnd);
  return clamp01(entered * (1 - exited));
};

const assemblyAssets = {
  final: "/assets/assembly/visionaire-sunglasses-clean.webp",
  frame: "/assets/assembly/visionaire-front-frame.webp",
  leftTemple: "/assets/assembly/visionaire-left-temple.webp",
  rightTemple: "/assets/assembly/visionaire-right-temple.webp",
  hinges: "/assets/assembly/visionaire-hinges.webp",
  rawLab: "/assets/crafted/lens-blank-lab.webp",
  laserLab: "/assets/crafted/laser-cutting-lab.webp",
  polishLab: "/assets/crafted/lens-polishing-lab.webp"
};

const craftedLayerLabels = [
  "UV layer",
  "Polarized film",
  "Blue-light filter",
  "Scratch shield",
  "Hydrophobic coat",
  "Anti-reflective",
  "Base lens"
];

const craftedEnvironments = ["Bright sun", "Cloud cover", "Blue light", "Polarized"];
const craftedSpecs = ["UV400 / 100%", "POLARIZED / CAT. 3", "ACETATE / 4.0 MM", "RX / READY"];
const craftedStageWindows = [
  [0, 0.09],
  [0.09, 0.155],
  [0.155, 0.19],
  [0.19, 0.3],
  [0.3, 0.325],
  [0.325, 0.42],
  [0.42, 0.458],
  [0.458, 0.605],
  [0.605, 0.675],
  [0.675, 0.732],
  [0.732, 0.818],
  [0.818, 0.878],
  [0.878, 0.948],
  [0.948, 1]
];
const craftedStageMap = Object.fromEntries(craftedStageWindows.map((range, index) => [`s${index + 1}`, range]));

const mix = (from, to, amount) => from + (to - from) * clamp01(amount);

function partStyle({ x = 0, y = 0, scale = 1, rotate = 0, opacity = 1, blur = 0 }) {
  return {
    opacity: clamp01(opacity),
    transform: `translate(-50%, -50%) translate3d(${x}%, ${y}%, 0) rotate(${rotate}deg) scale(${scale})`,
    filter: blur ? `blur(${blur}px)` : undefined
  };
}

function WebGLAssemblyScene(props) {
  return <Suspense fallback={null}><LegacyAssemblyScene {...props} stages={craftedStageMap} fallback={assemblyAssets.final} /></Suspense>;
}

function SignatureAssemblyScene({ progress, stage, stages }) {
  const p = clamp01(progress);
  const activeStage = stages[stage - 1] || stages[0];
  const localProgress = clamp01(p * stages.length - (stage - 1));
  const templeTravel = stageRange(p, 0.42, 0.5);
  const frameTravel = stageRange(p, 0.33, 0.38);
  const finalReveal = stageRange(p, 0.82, 0.93);
  const partFade = 1 - finalReveal * 0.9;
  const rawOpacity = stageWindow(p, -0.01, 0.01, 0.055, 0.07);
  const laserOpacity = stageWindow(p, 0.055, 0.069, 0.13, 0.143);
  const polishOpacity = stageWindow(p, 0.13, 0.143, 0.205, 0.218);
  const stackOpacity = stageWindow(p, 0.205, 0.22, 0.275, 0.288);
  const blueprintOpacity = stageWindow(p, 0.275, 0.29, 0.345, 0.36);
  const detailOpacity = stageWindow(p, 0.5, 0.515, 0.56, 0.575);
  const materialOpacity = stageWindow(p, 0.565, 0.58, 0.635, 0.65);
  const xrayOpacity = stageWindow(p, 0.635, 0.65, 0.705, 0.72);
  const environmentOpacity = stageWindow(p, 0.705, 0.725, 0.84, 0.868);
  const productGlow = stageWindow(p, 0.08, 0.14, 0.98, 1.01);
  const manufacturingOpacity = Math.max(rawOpacity, laserOpacity, polishOpacity);
  const virtualStageOpacity = stageRange(p, 0.185, 0.235);
  const cameraTurn = stageRange(p, 0.38, 0.68) - stageRange(p, 0.68, 0.92);
  const cameraLift = stageRange(p, 0.29, 0.56) - stageRange(p, 0.72, 0.92);
  const sceneVars = {
    "--stage-accent": activeStage.accent,
    "--stage-progress": localProgress.toFixed(3),
    "--hero-progress": p.toFixed(3),
    "--camera-yaw": `${mix(-1.5, 2.6, cameraTurn)}deg`,
    "--camera-pitch": `${mix(0.8, -1.1, cameraLift)}deg`,
    "--camera-scale": mix(1.01, 1.055, stageRange(p, 0.3, 0.92)).toFixed(3)
  };

  return (
    <div className="crafted-scene signature-assembly-scene" data-kind={activeStage.kind} style={sceneVars} aria-hidden="true">
      <div className="crafted-reality-plates">
        <img
          className="crafted-reality-plate raw-plate"
          src={assemblyAssets.rawLab}
          alt=""
          style={{ opacity: rawOpacity, transform: `scale(${mix(1.035, 1.09, localProgress)})` }}
        />
        <img
          className="crafted-reality-plate laser-plate"
          src={assemblyAssets.laserLab}
          alt=""
          style={{ opacity: laserOpacity, transform: `scale(${mix(1.07, 1.015, localProgress)}) translateY(${mix(-1.5, 0, localProgress)}%)` }}
        />
        <img
          className="crafted-reality-plate polish-plate"
          src={assemblyAssets.polishLab}
          alt=""
          style={{ opacity: polishOpacity, transform: `scale(${mix(1.045, 1.09, localProgress)}) translateY(${mix(0, -1.5, localProgress)}%)` }}
        />
        <span className="crafted-lab-vignette" style={{ opacity: manufacturingOpacity }} />
        <span className="crafted-lab-scan" style={{ opacity: laserOpacity }} />
      </div>

      <div className="crafted-atmosphere">
        <span className="crafted-light crafted-light-a" />
        <span className="crafted-light crafted-light-b" />
        <span className="crafted-grid-floor" />
      </div>

      <div className="crafted-virtual-stage" style={{ opacity: virtualStageOpacity }}>
        <div className="crafted-platform">
          <span />
          <b />
        </div>

        <div className="crafted-layer-stack" style={{ opacity: stackOpacity }}>
          {craftedLayerLabels.map((label, index) => (
            <span key={label} style={{ "--layer-index": index }}>
              <i />
              <b>{label}</b>
            </span>
          ))}
        </div>

        <div className="crafted-blueprint" style={{ opacity: blueprintOpacity }}>
          <img src={assemblyAssets.frame} alt="" />
          <span className="blueprint-line line-width">52.0 mm</span>
          <span className="blueprint-line line-bridge">18.0 mm</span>
          <span className="blueprint-line line-temple">145 mm</span>
        </div>

        <div className="crafted-product-stage">
        <img
          className="crafted-product-part part-frame"
          src={assemblyAssets.frame}
          alt=""
          style={partStyle({
            x: 0,
            y: mix(8, 0, frameTravel),
            scale: mix(0.92, 1, frameTravel),
            rotate: mix(-1.2, 0, frameTravel),
            opacity: stageWindow(p, 0.335, 0.355, 0.84, 0.9) * partFade
          })}
        />
        <img
          className="crafted-product-part part-left-temple"
          src={assemblyAssets.leftTemple}
          alt=""
          style={partStyle({
            x: mix(-62, 0, templeTravel),
            y: mix(12, 0, templeTravel),
            scale: mix(0.96, 1, templeTravel),
            rotate: mix(-7, 0, templeTravel),
            opacity: stageWindow(p, 0.405, 0.43, 0.82, 0.89) * partFade
          })}
        />
        <img
          className="crafted-product-part part-right-temple"
          src={assemblyAssets.rightTemple}
          alt=""
          style={partStyle({
            x: mix(62, 0, templeTravel),
            y: mix(12, 0, templeTravel),
            scale: mix(0.96, 1, templeTravel),
            rotate: mix(7, 0, templeTravel),
            opacity: stageWindow(p, 0.405, 0.43, 0.82, 0.89) * partFade
          })}
        />
        <img
          className="crafted-product-part part-hinges"
          src={assemblyAssets.hinges}
          alt=""
          style={partStyle({
            x: mix(12, 0, templeTravel),
            y: mix(-3, 0, templeTravel),
            scale: mix(0.95, 1, templeTravel),
            rotate: mix(2, 0, templeTravel),
            opacity: stageWindow(p, 0.41, 0.435, 0.78, 0.86) * partFade
          })}
        />
        <img
          className="crafted-product-part part-final"
          src={assemblyAssets.final}
          alt=""
          style={partStyle({
            x: 0,
            y: mix(6, 0, finalReveal),
            scale: mix(0.96, 1.03, finalReveal),
            opacity: finalReveal
          })}
        />
        <span className="crafted-product-glow" style={{ opacity: productGlow }} />
        </div>

        <div className="crafted-detail-overlay" style={{ opacity: detailOpacity }}>
          <span>Laser engraved branding</span>
          <span>Titanium core</span>
          <span>5 barrel hinge</span>
        </div>

        <div className="crafted-spec-overlay" style={{ opacity: materialOpacity }}>
          {craftedSpecs.map((spec, index) => (
            <span key={spec} style={{ "--spec-index": index }}>
              <i />
              {spec}
            </span>
          ))}
        </div>

        <div className="crafted-xray" style={{ opacity: xrayOpacity }}>
          <img src={assemblyAssets.final} alt="" />
          <span />
          <b>Internal scan</b>
        </div>

        <div className="crafted-environment-strip" style={{ opacity: environmentOpacity }}>
          {craftedEnvironments.map((label) => (
            <span key={label}>
              <b>{label}</b>
            </span>
          ))}
        </div>
      </div>

      <div className="crafted-process-data" style={{ opacity: manufacturingOpacity }}>
        <span>{stage === 1 ? "OPTICAL BLANK / 72 MM" : stage === 2 ? "CUT PATH / 0.01 MM" : "EDGE FINISH / RA 0.2"}</span>
        <b>{stage === 1 ? "REFRACTIVE INDEX 1.60" : stage === 2 ? "3-AXIS CALIBRATED" : "DIAMOND WHEEL / 8K"}</b>
      </div>
    </div>
  );
}

function AssemblyHero({ navigate, homepageContent = defaultAdminHero, lensMode = false }) {
  const [progress, setProgress] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [autoAssembling, setAutoAssembling] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const scrollRaf = useRef(0);
  const autoScrollRaf = useRef(0);
  const autoActiveRef = useRef(false);
  const audioRef = useRef(null);
  const lastAudioTimeRef = useRef(performance.now());

  const stopAndResetAudio = (resetProgress = 0) => {
    audioRef.current?.reset(resetProgress);
    lastAudioTimeRef.current = performance.now();
    setSoundOn(false);
  };

  const startAssemblyAudio = (startProgress = 0) => {
    let audio = audioRef.current;
    if (!audio) {
      const mobileVolume = window.matchMedia("(max-width: 860px)").matches;
      audio = new CraftedAudio({ masterVolume: mobileVolume ? 0.16 : 0.32 });
      audioRef.current = audio;
    }
    audio.reset(startProgress);
    audio.setEnabled(true);
    lastAudioTimeRef.current = performance.now();
    setSoundOn(true);
  };

  useEffect(() => {
    const measure = () => {
      const el = document.getElementById("assembly-hero");
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const range = el.offsetHeight - window.innerHeight;
      const next = Math.min(1, Math.max(0, -rect.top / Math.max(1, range)));
      setProgress(next);
    };
    const onScroll = () => {
      window.cancelAnimationFrame(scrollRaf.current);
      scrollRaf.current = window.requestAnimationFrame(measure);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(scrollRaf.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(
    () => () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    },
    []
  );

  useEffect(
    () => () => {
      cancelAnimationFrame(autoScrollRaf.current);
      if (window.__visionaireAutoAssembly?.raf) cancelAnimationFrame(window.__visionaireAutoAssembly.raf);
      if (window.__visionaireAutoAssembly) window.__visionaireAutoAssembly.active = false;
      autoActiveRef.current = false;
      document.documentElement.classList.remove("is-auto-assembling");
    },
    []
  );

  useEffect(() => {
    if (!autoAssembling) return undefined;

    const interrupt = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      cancelAnimationFrame(autoScrollRaf.current);
      if (window.__visionaireAutoAssembly?.raf) cancelAnimationFrame(window.__visionaireAutoAssembly.raf);
      if (window.__visionaireAutoAssembly) window.__visionaireAutoAssembly.active = false;
      autoScrollRaf.current = 0;
      autoActiveRef.current = false;
      document.documentElement.classList.remove("is-auto-assembling");
      setAutoAssembling(false);
      setAutoPaused(false);
      stopAndResetAudio(0);
    };

    window.addEventListener("keydown", interrupt);

    return () => {
      window.removeEventListener("keydown", interrupt);
    };
  }, [autoAssembling]);

  const assemblyStages = [
    {
      label: "Raw Material",
      title: "Crafted from optical precision.",
      copy: "Two premium crystal blanks. Nothing yet manufactured.",
      readout: "Awaiting input",
      kind: "lens",
      accent: "#e8b84b"
    },
    {
      label: "Laser Cutting",
      title: "Every millimeter, contoured",
      copy: "Precision beams cut the sunglass lens profile to a tight optical tolerance.",
      readout: "Beam +/-0.01mm",
      kind: "laser",
      accent: "#ff9d55"
    },
    {
      label: "Lens Polishing",
      title: "Diamond polish finish",
      copy: "Edges are smoothed and polished until the lens reads clean from every angle.",
      readout: "RA 0.2nm",
      kind: "polish",
      accent: "#f4c36b"
    },
    {
      label: "Optical Stack",
      title: "Seven layers. One lens.",
      copy: "UV, polarized, blue-light, scratch, hydrophobic, and anti-reflective layers fuse into one lens.",
      readout: "7 coatings",
      kind: "layers",
      accent: "#b8d7ff"
    },
    {
      label: "Frame Blueprint",
      title: "Measured before it exists",
      copy: "Lens width, bridge, base curve, and temple length are mapped as a technical blueprint.",
      readout: "CAD / DXF",
      kind: "blueprint",
      accent: "#9ed8ff"
    },
    {
      label: "Frame Forming",
      title: "Acetate, formed",
      copy: "The front frame takes shape around the optics with polished black acetate and gold detail.",
      readout: "Acetate 4.0mm",
      kind: "frame",
      accent: "#d7a34f"
    },
    {
      label: "Temple Assembly",
      title: "Temples engaged.",
      copy: "The arms slide into the hinge geometry and align to the frame body.",
      readout: "Hinge torque OK",
      kind: "hardware",
      accent: "#f0bb68"
    },
    {
      label: "Precision Details",
      title: "Every detail has a purpose",
      copy: "Engraving, titanium core, hand-finished bevels, and hinge hardware are inspected up close.",
      readout: "QC / macro",
      kind: "detail",
      accent: "#e9c47c"
    },
    {
      label: "Material & Spec",
      title: "Material proof, not decoration",
      copy: "The finished silhouette is checked against UV400, polarized, lightweight, and prescription-ready specs.",
      readout: "Spec sheet",
      kind: "material",
      accent: "#bfe6ff"
    },
    {
      label: "X-Ray Analysis",
      title: "See the engineering inside",
      copy: "Transparent scan mode exposes hinge assemblies, lens seating, and internal frame structure.",
      readout: "Internal scan",
      kind: "xray",
      accent: "#93dcff"
    },
    {
      label: "Adaptive Optics",
      title: "Lenses adapt to the world",
      copy: "The optics shift through bright sun, cloud cover, blue light, and glare reduction demonstrations.",
      readout: "Photochromic",
      kind: "adaptive",
      accent: "#8fb8ff"
    },
    {
      label: "Environment",
      title: "Designed for every moment",
      copy: "The product moves from technical assembly into real daily environments without losing clarity.",
      readout: "Field test",
      kind: "environment",
      accent: "#c9a56c"
    },
    {
      label: "Final Assembly",
      title: "Hand-finished. Optically calibrated.",
      copy: "Temples, hinges, lenses, and frame settle into their final tolerances, then every pair is checked by hand.",
      readout: "Grade AAA",
      kind: "final",
      accent: "#f0c56d"
    },
    {
      label: "Ready to Wear",
      title: homepageContent.title || defaultAdminHero.title,
      copy: homepageContent.subtitle || defaultAdminHero.subtitle,
      readout: "Ready",
      kind: "final",
      accent: "#e8b84b"
    }
  ];
  const lensStageOverrides = [
    {
      label: "Lens Input",
      title: "Receta bëhet sistem optik.",
      copy: "Dioptria, përdorimi dhe materialet vendosin pikën e nisjes për çdo thjerrëz.",
      readout: "RX data ready",
      accent: "#75e7ff"
    },
    {
      label: "Digital Surfacing",
      title: "Çdo mikron ka drejtim.",
      copy: "Sipërfaqja llogaritet dhe përpunohet me tolerancë të kontrolluar për fushën tuaj të shikimit.",
      readout: "Surface ±0.01",
      accent: "#63d8ff"
    },
    {
      label: "Edge Precision",
      title: "Forma ndjek kornizën.",
      copy: "Konturi dhe skajet përgatiten sipas gjeometrisë reale të kornizës, jo një mase të përgjithshme.",
      readout: "Edge calibrated",
      accent: "#89f0ff"
    },
    {
      label: "Optical Stack",
      title: "Shtresa që punojnë si një.",
      copy: "Antirefleks, rezistencë ndaj gërvishtjeve, UV dhe sipërfaqe hidrofobike bashkohen në një sistem.",
      readout: "Coating stack",
      accent: "#a7e9ff"
    },
    {
      label: "Progressive Map",
      title: "Larg. Ekran. Afër.",
      copy: "Korridori progresiv ndërtohet rreth distancave ku shikoni më shpesh gjatë ditës.",
      readout: "3 vision zones",
      accent: "#72cfff"
    },
    {
      label: "Frame Fit",
      title: "Optika përshtatet me kornizën.",
      copy: "Lartësia, këndi dhe pozicioni i kornizës ndikojnë drejtpërdrejt në performancën e thjerrëzës.",
      readout: "Frame geometry",
      accent: "#ffb184"
    },
    {
      label: "Optical Alignment",
      title: "Qendrat takohen me sytë.",
      copy: "PD-ja dhe centrimi monokular verifikohen që secili sy të gjejë zonën e tij të qartë.",
      readout: "Centers locked",
      accent: "#79e5ff"
    },
    {
      label: "Personalization",
      title: "Matje për mënyrën tuaj të shikimit.",
      copy: "Anatomia, qëndrimi dhe rutina përkthehen në parametra optikë të personalizuar.",
      readout: "Individual fit",
      accent: "#9beaff"
    },
    {
      label: "Material Index",
      title: "Më e hollë, kur receta e kërkon.",
      copy: "Indeksi dhe materiali zgjidhen për të balancuar trashësinë, peshën, rezistencën dhe qartësinë.",
      readout: "Index selected",
      accent: "#c6f3ff"
    },
    {
      label: "Internal Scan",
      title: "Kontroll brenda sistemit.",
      copy: "Ulja e thjerrëzës, simetria dhe pozicioni në kornizë verifikohen para dorëzimit.",
      readout: "Optical scan",
      accent: "#62d9ff"
    },
    {
      label: "Adaptive Optics",
      title: "Drita ndryshon. Shikimi përshtatet.",
      copy: "Opsionet fotokromatike dhe filtrat e kontrolluar reagojnë ndaj ambientit pa humbur rehatinë.",
      readout: "Light adaptive",
      accent: "#98b9ff"
    },
    {
      label: "Field Simulation",
      title: "Testuar për jetën reale.",
      copy: "Rruga, ekrani, leximi dhe drita e fortë simulohen si skenarë, jo si specifika të izoluara.",
      readout: "4 field tests",
      accent: "#f5b37f"
    },
    {
      label: "Final Calibration",
      title: "Montuar. Drejtuar. Verifikuar.",
      copy: "Pala përfundimtare kontrollohet për centrimin, drejtimin dhe mënyrën si ulet në fytyrë.",
      readout: "QC complete",
      accent: "#7de7ff"
    },
    {
      label: "Lens Focus",
      title: "Qartësi e kalibruar për ju.",
      copy: "Nga receta te përshtatja finale, çdo matje punon për të njëjtin rezultat: shikim të rehatshëm.",
      readout: "Lens system ready",
      accent: "#75e7ff"
    }
  ];
  const stages = lensMode
    ? assemblyStages.map((item, index) => ({ ...item, ...lensStageOverrides[index] }))
    : assemblyStages;
  const stageWindowIndex = craftedStageWindows.findIndex(([, end]) => progress < end);
  const stage = stageWindowIndex === -1 ? stages.length : stageWindowIndex + 1;
  const activeStage = stages[stage - 1];
  const technicalRows = {
    2: [["Precision", "+/-0.01 mm"], ["Fiber beam", "1064 nm"], ["Medical optics", "CE 1"]],
    4: craftedLayerLabels.map((label, index) => [label, String(index + 1).padStart(2, "0")]),
    5: [["Lens width", "52.0 mm"], ["Bridge", "18.0 mm"], ["Temple", "145 mm"], ["Base curve", "6.00"]],
    7: [["Left hinge", "Locked"], ["Right hinge", "Locked"], ["Cycle test", "12,000"]],
    9: [["Total weight", "18 g"], ["Core", "Grade 5 Ti"], ["Acetate", "Hand poured"], ["UV protection", "UV400"]],
    10: [["Frame core", "Visible"], ["Lens seating", "Verified"], ["Hinge geometry", "Calibrated"]]
  }[stage] || [];

  const goToStage = (index) => {
    cancelAnimationFrame(autoScrollRaf.current);
    autoScrollRaf.current = 0;
    document.documentElement.classList.remove("is-auto-assembling");
    setAutoAssembling(false);
    setAutoPaused(false);

    const el = document.getElementById("assembly-hero");
    if (!el) return;
    const top = window.scrollY + el.getBoundingClientRect().top;
    const range = el.offsetHeight - window.innerHeight;
    const [start, end] = craftedStageWindows[index];
    const targetProgress = index === craftedStageWindows.length - 1 ? 0.975 : start + (end - start) * 0.48;
    startAssemblyAudio(targetProgress);
    window.scrollTo({
      top: top + range * targetProgress,
      behavior: "smooth"
    });
  };

  const toggleAutoAssembly = () => {
    const runningAuto = window.__visionaireAutoAssembly;
    if (autoAssembling || autoActiveRef.current || runningAuto?.active) {
      cancelAnimationFrame(autoScrollRaf.current);
      if (runningAuto?.raf) cancelAnimationFrame(runningAuto.raf);
      if (runningAuto) runningAuto.active = false;
      autoScrollRaf.current = 0;
      autoActiveRef.current = false;
      document.documentElement.classList.remove("is-auto-assembling");
      setAutoAssembling(false);
      setAutoPaused(true);
      stopAndResetAudio(progress);
      return;
    }

    const el = document.getElementById("assembly-hero");
    if (!el) return;

    const top = window.scrollY + el.getBoundingClientRect().top;
    const range = Math.max(1, el.offsetHeight - window.innerHeight);
    const targetProgress = 0.985;
    const startProgress = progress >= 0.97 ? 0 : progress;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      stopAndResetAudio(0);
      window.scrollTo(0, top + range * targetProgress);
      autoActiveRef.current = false;
      setAutoPaused(false);
      return;
    }

    document.documentElement.classList.add("is-auto-assembling");
    autoActiveRef.current = true;
    window.__visionaireAutoAssembly = { active: true, raf: 0 };

    if (startProgress === 0 && progress >= 0.97) {
      stopAndResetAudio(0);
      window.scrollTo(0, top);
    }

    startAssemblyAudio(startProgress);

    const startedAt = performance.now();
    const mobileAssembly = window.matchMedia("(max-width: 860px)").matches;
    const duration = Math.max(4000, (mobileAssembly ? 28000 : 22000) * (targetProgress - startProgress));
    setAutoPaused(false);
    setAutoAssembling(true);

    const tick = (now) => {
      const auto = window.__visionaireAutoAssembly;
      if (!auto?.active) return;
      const elapsed = clamp01((now - startedAt) / duration);
      const linearProgress = startProgress + (targetProgress - startProgress) * elapsed;
      let nextProgress = linearProgress;

      if (mobileAssembly) {
        const activeWindow = craftedStageWindows.find(([start, end]) => linearProgress >= start && linearProgress <= end)
          || craftedStageWindows[craftedStageWindows.length - 1];
        const segmentStart = Math.max(startProgress, activeWindow[0]);
        const segmentEnd = Math.min(targetProgress, activeWindow[1]);
        const segmentProgress = clamp01((linearProgress - segmentStart) / Math.max(0.001, segmentEnd - segmentStart));
        nextProgress = segmentStart + (segmentEnd - segmentStart) * smoothStep(segmentProgress);
      }
      window.scrollTo(0, top + range * nextProgress);

      if (elapsed < 1) {
        auto.raf = requestAnimationFrame(tick);
        autoScrollRaf.current = auto.raf;
      } else {
        autoScrollRaf.current = 0;
        autoActiveRef.current = false;
        auto.active = false;
        document.documentElement.classList.remove("is-auto-assembling");
        setAutoAssembling(false);
        setAutoPaused(false);
        stopAndResetAudio(0);
      }
    };

    window.__visionaireAutoAssembly.raf = requestAnimationFrame(tick);
    autoScrollRaf.current = window.__visionaireAutoAssembly.raf;
  };

  const toggleSound = () => {
    const next = !soundOn;
    if (next) {
      startAssemblyAudio(progress);
    } else {
      stopAndResetAudio(progress);
    }
  };

  const skipAssembly = () => {
    cancelAnimationFrame(autoScrollRaf.current);
    if (window.__visionaireAutoAssembly?.raf) cancelAnimationFrame(window.__visionaireAutoAssembly.raf);
    if (window.__visionaireAutoAssembly) window.__visionaireAutoAssembly.active = false;
    autoActiveRef.current = false;
    document.documentElement.classList.remove("is-auto-assembling");
    setAutoAssembling(false);
    setAutoPaused(false);
    stopAndResetAudio(0);
    document.getElementById("collections")?.scrollIntoView({ behavior: "auto", block: "start" });
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (progress >= 0.985) {
      audio.reset(0);
      setSoundOn(false);
      return;
    }
    const now = performance.now();
    const delta = Math.min(0.1, Math.max(1 / 240, (now - lastAudioTimeRef.current) / 1000));
    lastAudioTimeRef.current = now;
    audio.update(progress, delta);
  }, [progress]);

  const autoAssemblyLabel = autoAssembling
    ? (lensMode ? "Pause lens sequence" : "Pause assembly")
    : autoPaused
      ? (lensMode ? "Continue lens sequence" : "Continue assembly")
      : progress >= 0.97
        ? (lensMode ? "Replay lens sequence" : "Replay assembly")
        : (lensMode ? "Start lens sequence" : "Press to assemble");

  return (
    <section
      className={`assembly-hero crafted-assembly-hero crafted-webgl-hero ${lensMode ? "lens-experience-hero" : ""}`}
      id="assembly-hero"
      data-stage={stage}
      data-experience={lensMode ? "lens" : "brand"}
      style={{ "--assembly": progress }}
    >
      <div className="assembly-sticky crafted-assembly-sticky">
        <div className="crafted-progress-line" aria-hidden="true">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>

        <header className="crafted-hud">
          <span className="crafted-mode">{lensMode ? "OPTIKA MIFTARI / LENS FOCUS 01" : "OPTIKA MIFTARI / LAB SERIES 01"}</span>
          <div className="crafted-stage-status" aria-live="polite">
            <span>Stage</span>
            <b>{String(stage).padStart(2, "0")}</b>
            <i>/ {String(stages.length).padStart(2, "0")}</i>
            <em>{activeStage.label}</em>
          </div>
          <span className="crafted-top-readout">{activeStage.readout}<i /></span>
        </header>

        <WebGLAssemblyScene progress={progress} lensMode={lensMode} />

        <aside className="crafted-copy-panel" aria-live="polite" key={stage}>
          <span>{String(stage).padStart(2, "0")} / {activeStage.label}</span>
          <h1>{activeStage.title}</h1>
          <p>{activeStage.copy}</p>
          {stage >= 13 && (
            <div className="crafted-copy-actions">
              <button className="primary-button light" data-testid="hero-shop" onClick={() => navigate(lensMode ? "contact" : "shop")}>
                {lensMode ? "Rezervo matjen" : homepageContent.primaryCta || defaultAdminHero.primaryCta} <ChevronRight size={18} />
              </button>
              <button className="gold-button" data-testid="hero-prescription" onClick={() => navigate("product")}>
                {lensMode ? "Zgjidh kornizën" : homepageContent.secondaryCta || defaultAdminHero.secondaryCta} <ChevronRight size={18} />
              </button>
            </div>
          )}
        </aside>

        {technicalRows.length > 0 && (
          <div className="auric-technical-panel" aria-hidden="true">
            {technicalRows.map(([label, value]) => (
              <span key={label}>
                <small>{label}</small>
                <b>{value}</b>
              </span>
            ))}
          </div>
        )}

        {(stage === 11 || stage === 12) && (
          <div className="auric-phase-strip" aria-hidden="true">
            {craftedEnvironments.map((label) => <span key={label}>{label}</span>)}
          </div>
        )}

        <nav className="crafted-stage-rail" aria-label={lensMode ? "Lens technology stages" : "Assembly stages"}>
          <div className="crafted-stage-track">
            {stages.map((item, index) => (
              <button
                key={item.label}
                type="button"
                aria-label={`${String(index + 1).padStart(2, "0")} ${item.label}`}
                title={item.label}
                className={`${stage === index + 1 ? "is-current" : ""} ${stage > index + 1 ? "is-complete" : ""}`}
                onClick={() => goToStage(index)}
              >
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="crafted-bottom-readout" aria-hidden="true">
          <span>{lensMode ? "Lens sequence" : "Assembly"} / {Math.round(progress * 100)}%</span>
          <b>{activeStage.readout}</b>
        </div>

        <button
          className={`crafted-sound ${soundOn ? "is-on" : ""}`}
          type="button"
          aria-pressed={soundOn}
          aria-label={soundOn ? "Turn assembly sound off" : "Turn assembly sound on"}
          title={soundOn ? "Turn sound off" : "Turn sound on"}
          onClick={toggleSound}
        >
          {soundOn ? <Volume2 size={16} strokeWidth={1.8} /> : <VolumeX size={16} strokeWidth={1.8} />}
          <span className="crafted-sound-label">{soundOn ? "Sound on" : "Sound off"}</span>
        </button>

        <button
          className={`crafted-auto-assemble ${autoAssembling ? "is-running" : ""} ${progress >= 0.97 && !autoAssembling ? "is-complete" : ""}`}
          type="button"
          aria-pressed={autoAssembling}
          aria-label={autoAssemblyLabel}
          onClick={toggleAutoAssembly}
        >
          {autoAssembling ? <Pause size={15} strokeWidth={1.8} /> : <Play size={15} strokeWidth={1.8} />}
          <span>{autoAssemblyLabel}</span>
        </button>

        <button className="crafted-mobile-skip" type="button" onClick={skipAssembly}>
          {lensMode ? "Shko te teknologjia" : "Skip story"} <ChevronRight size={14} />
        </button>

        <div className="crafted-scroll-cue" style={{ opacity: clamp01(1 - progress * 22) }} aria-hidden="true">
          <span />
          {lensMode ? "Scroll to calibrate" : "Scroll to craft"}
        </div>
      </div>
    </section>
  );
}

function ProductRail({ products, navigate, openQuickView, addToCart, toggleWishlist, wishlist }) {
  return (
    <div className="product-rail">
      {products.map((product) => (
        <ProductCard
          product={product}
          key={product.id}
          navigate={navigate}
          openQuickView={openQuickView}
          addToCart={addToCart}
          toggleWishlist={toggleWishlist}
          wishlist={wishlist}
        />
      ))}
    </div>
  );
}

const swatchColor = frameSwatches;

function ProductCard(props) { return <EditorialProductCard {...props} />; }
function ProductQuickView({ product, products, onClose, onSelect, addToCart, navigate, wishlist, toggleWishlist }) {
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const panelRef = useRef(null);
  useDialogFocus(Boolean(product), panelRef, onClose);

  useEffect(() => {
    if (!product) return undefined;
    setImageIndex(0);
    setQuantity(1);
  }, [product?.id]);

  if (!product) return null;

  const images = [product.image, ...(product.gallery || [])]
    .filter(Boolean)
    .filter((image, index, items) => items.indexOf(image) === index);
  const related = [];
  const seenImages = new Set([product.image]);
  for (const candidate of products) {
    if (candidate.id === product.id || candidate.type !== product.type || seenImages.has(candidate.image)) continue;
    seenImages.add(candidate.image);
    related.push(candidate);
    if (related.length === 5) break;
  }
  const price = product.salePrice || product.price;
  const variants = modelVariants(products, product);
  const inStock = Number(product.stock || 0) > 0;
  const visibleImageIndex = Math.min(imageIndex, Math.max(0, images.length - 1));
  const stepImage = (direction) => setImageIndex((current) => (current + direction + images.length) % images.length);
  const addStandardProduct = () => addToCart(product, {
    quantity,
    purchaseMode: "ready",
    lensPackage: product.type === "Sunglasses" ? "Siç paraqitet" : "Vetëm korniza",
    coating: "Pa shtesë",
    rxMode: "Nuk kërkohet",
    frameVariant: product.color,
    lensTint: product.lensColor
  });

  return (
    <aside className="product-quick-view open" role="dialog" aria-modal="true" aria-label={`Shiko shpejt ${product.name}`}>
      <button className="product-quick-backdrop" onClick={onClose} aria-label="Mbyll pamjen e produktit" />
      <div className="product-quick-panel" ref={panelRef} data-testid="product-quick-view">
        <header className="product-quick-head">
          <div><span>SHIKO SHPEJT</span><small>Pa u larguar nga katalogu</small></div>
          <button className="product-quick-close" onClick={onClose} aria-label="Mbyll"><X size={18} /></button>
        </header>

        <div className="product-quick-main">
          <div className="product-quick-gallery">
            <div className="product-quick-image" role="group" aria-label={`Fotografitë e ${product.name}`} onKeyDown={(event) => { if (images.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); stepImage(event.key === 'ArrowLeft' ? -1 : 1); } }}>
              <img src={images[visibleImageIndex] || product.image} alt={`${product.name}, pamja ${visibleImageIndex + 1}`} />
              {images.length > 1 && <>
                <button className="previous" onClick={() => stepImage(-1)} aria-label="Pamja e mëparshme"><ChevronRight size={19} /></button>
                <button className="next" onClick={() => stepImage(1)} aria-label="Pamja tjetër"><ChevronRight size={19} /></button>
              </>}
              <span aria-live="polite" aria-atomic="true">{visibleImageIndex + 1} / {images.length}</span>
            </div>
            {images.length > 1 && (
              <div className="product-quick-thumbnails" aria-label="Pamjet e produktit">
                {images.map((image, index) => (
                  <button key={image} className={index === visibleImageIndex ? "active" : ""} aria-label={`Shiko pamjen ${index + 1}`} aria-pressed={index === visibleImageIndex} onClick={() => setImageIndex(index)}>
                    <img src={image} alt={`Pamja ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="product-quick-copy">
            <div className="product-quick-title">
              <div><span>{shqipLabel(product.type)} · {product.collection}</span><h2>{product.name}</h2></div>
              <button className={wishlist?.has(product.id) ? "active" : ""} onClick={() => toggleWishlist(product.id)} aria-pressed={Boolean(wishlist?.has(product.id))} aria-label={wishlist?.has(product.id) ? `Hiq ${product.name} nga të preferuarat` : `Ruaj ${product.name} te të preferuarat`}><Heart size={19} /></button>
            </div>
            <div className="product-quick-price"><strong>{money(price)}</strong>{product.salePrice && <del>{money(product.price)}</del>}<span className={inStock ? "in-stock" : "out-stock"}>{inStock ? `${product.stock} në stok` : "Nuk ka stok"}</span></div>
            <p>{productDescription(product, shqipLabel)}</p>

            <dl className="product-quick-facts">
              <div><dt>Masa</dt><dd>{product.size}</dd></div>
              <div><dt>Forma</dt><dd>{shqipLabel(product.frameShape)}</dd></div>
              <div><dt>Lentja</dt><dd>{shqipLabel(product.lensType)}</dd></div>
              <div><dt>Mbrojtja</dt><dd>{product.uv}</dd></div>
            </dl>

            <fieldset className="ed-quick-variants"><legend>Zgjidhni variantin</legend><div>{variants.map((variant) => <button key={variant.id} aria-pressed={variant.id === product.id} onClick={() => onSelect(variant)}><i aria-hidden="true" style={{ background: swatchColor[variant.color] || "#777" }} /><span><strong>{variant.name}</strong><small>{shqipLabel(variant.color)} · {money(variant.salePrice || variant.price)}</small></span>{variant.id === product.id && <Check size={15} />}</button>)}</div><small>Fotografia ilustron modelin. Ngjyra dhe disponueshmëria konfirmohen sipas variantit.</small></fieldset>

            <div className="product-quick-purchase">
              <div className="product-quick-quantity" aria-label="Sasia">
                <button disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Zvogëlo sasinë"><Minus size={15} /></button>
                <output aria-live="polite" aria-atomic="true" aria-label="Sasia e zgjedhur">{quantity}</output>
                <button disabled={quantity >= Math.min(10, Number(product.stock || 0))} onClick={() => setQuantity((value) => Math.min(10, Number(product.stock || 10), value + 1))} aria-label="Rrit sasinë"><Plus size={15} /></button>
              </div>
              <button className="product-quick-add" disabled={!inStock} onClick={addStandardProduct}><ShoppingBag size={17} /> {inStock ? "Shto në shportë" : "Nuk ka stok"}</button>
            </div>

            <div className="product-quick-secondary-actions">
              {product.type === "Sunglasses" && product.virtualTryOnEnabled !== false && <button onClick={() => navigate("fit", product.id, "/virtual-try-on")}><Camera size={16} /> Provo në 3D</button>}
              {product.prescriptionReady && <button onClick={() => navigate("product", product.id)}><FileText size={16} /> Konfiguro lentet</button>}
              <button onClick={() => navigate("product", product.id)}>Detajet e plota <ChevronRight size={15} /></button>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="product-quick-related">
              <div><span>MUND T’JU PËLQEJNË</span><small>Gjeni formën tuaj</small></div>
            <nav>
              {related.map((candidate) => (
                <button key={candidate.id} onClick={() => onSelect(candidate)}>
                  <img src={candidate.image} alt={candidate.name} />
                  <span><strong>{candidate.name}</strong><small>{money(candidate.salePrice || candidate.price)}</small></span>
                </button>
              ))}
            </nav>
          </section>
        )}
      </div>
    </aside>
  );
}

function LensTechnology() {
  const rows = [
    ["UV400", "100% UVA/UVB protection for sunglass builds."],
    ["Anti-reflective", "Cleaner night driving and sharper digital contrast."],
    ["Photochromic", "Adaptive tint for indoor-to-outdoor transitions."],
    ["Thinner lenses", "High-index options for stronger prescriptions."]
  ];

  return (
    <section className="section technology-section">
      <div className="technology-copy">
        <p>Lens technology</p>
        <h2>From lens to frame, every detail is designed for clarity.</h2>
        <p>
          Choose optical packages by how you live: driving, beach, fashion, sport, work, reading, or everyday.
        </p>
      </div>
      <div className="lens-stack" aria-label="Layered lens technology visual">
        <div className="lens-disc disc-one" />
        <div className="lens-disc disc-two" />
        <div className="lens-disc disc-three" />
        <span className="beam" />
      </div>
      <div className="tech-list">
        {rows.map(([title, copy]) => (
          <article key={title}>
            <Sparkles size={18} />
            <div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PrescriptionSimple({ navigate }) {
  const steps = [
    "Choose single vision, reading, distance, progressive, blue-light, or prescription sunglasses.",
    "Upload a file, enter the prescription manually, send it later, or contact support before ordering.",
    "Select coatings, thinner lenses, UV protection, scratch resistance, and lab review."
  ];

  return (
    <section className="section prescription-band">
      <div>
        <p>Prescription made simple</p>
        <h2>Build around the way your eyes actually work.</h2>
      </div>
      <div className="step-list">
        {steps.map((step, index) => (
          <article key={step}>
            <span>0{index + 1}</span>
            <p>{step}</p>
          </article>
        ))}
      </div>
      <button className="primary-button" onClick={() => navigate("product")}>
        Start prescription flow
      </button>
    </section>
  );
}

function TryOnSection({ navigate }) {
  const [selectedShape, setSelectedShape] = useState("Oval");
  return (
    <section className="section tryon-section">
      <div className="face-map">
        <span className="scan-line" />
        <div className="face-outline">
          <Eye size={78} />
        </div>
      </div>
      <div>
        <p>Virtual try-on</p>
        <h2>Match frames to face shape, bridge width, and lifestyle.</h2>
        <p>
          The guide recommends square, oval, rectangle, wrap, and aviator silhouettes based on face balance and
          fit goals.
        </p>
        <div className="quiz-grid">
          {["Oval", "Round", "Square", "Heart"].map((shape) => (
            <button key={shape} className={selectedShape === shape ? "selected" : ""} onClick={() => setSelectedShape(shape)}>{shape}</button>
          ))}
        </div>
        <button className="gold-button" onClick={() => navigate("shop")}>
          Find my frame
        </button>
      </div>
    </section>
  );
}

function WhyDifferent() {
  const items = [
    [ShieldCheck, "Premium materials", "Japanese acetate, titanium, carbon polymer, and precision hinges."],
    [Truck, "Delivery clarity", "Inventory status, shipping options, confirmation, and order updates."],
    [RefreshCw, "Risk-free fit", "Care guidance, return policy, and recently viewed recommendations."],
    [MessageCircle, "Human review", "Support can check prescriptions before the order enters the lab."]
  ];
  return (
    <section className="section">
      <div className="section-heading">
        <p>Why choose us</p>
        <h2>Luxury shopping, optical health, and product personalization in one flow.</h2>
      </div>
      <div className="benefit-grid">
        {items.map(([Icon, title, copy]) => (
          <article key={title}>
            <Icon size={23} />
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Reviews() {
  return (
    <section className="section review-section">
      <div className="section-heading">
        <p>Fjalët e klientëve</p>
        <h2>Siguria që vjen kur shikoni më qartë.</h2>
      </div>
      <div className="review-grid">
        {reviews.map((review) => (
          <article key={review.name}>
            <div className="rating">{"*".repeat(review.rating)}</div>
            <p>"{review.quote}"</p>
            <strong>{review.name}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function EducationSection({ navigate }) {
  return (
    <section className="section education-section">
      <div className="section-heading inline-heading">
        <div>
          <p>Guides</p>
          <h2>Make better optical decisions before you buy.</h2>
        </div>
        <button className="secondary-button" onClick={() => navigate("guides")}>
          Open guides
        </button>
      </div>
      <div className="article-row">
        {blogPosts.map((post) => (
          <article key={post.title}>
            <span>{post.category}</span>
            <h3>{post.title}</h3>
            <p>{post.excerpt}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ShopPage(props) { return <EditorialCatalog {...props} label={shqipLabel} />; }
function CollectionLandingPage(props) { return <EditorialCatalog {...props} label={shqipLabel} />; }
function ExaminationPage(props) { return <EditorialExamination {...props} />; }
function ProductPage({ product, addToCart, products, navigate, wishlist, toggleWishlist, editingLine, cancelEdit }) {
  const [compactProductLayout, setCompactProductLayout] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 860px)').matches);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 860px)');
    const update = () => setCompactProductLayout(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  // Keep one semantic primary heading at the same responsive position as the
  // existing layout, without remounting any configuration or cart fields.
  const MobileProductTitle = compactProductLayout ? 'h1' : 'h2';
  const DesktopProductTitle = compactProductLayout ? 'h2' : 'h1';
  const [purchaseMode, setPurchaseMode] = useState(product.type === "Sunglasses" ? "ready" : "prescription");
  const [lens, setLens] = useState(lensPackages[0].id);
  const [coating, setCoating] = useState("anti-reflective");
  const [rxMode, setRxMode] = useState("Upload prescription");
  const [fileName, setFileName] = useState("");
  const [prescriptionToken, setPrescriptionToken] = useState("");
  const [uploadState, setUploadState] = useState("idle");
  const [rxError, setRxError] = useState("");
  const [manualRx, setManualRx] = useState({
    odSph: "", odCyl: "", odAxis: "", odAdd: "",
    osSph: "", osCyl: "", osAxis: "", osAdd: "",
    pd: "", prism: "", base: ""
  });
  const [qty, setQty] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [selectedImage, setSelectedImage] = useState(product.image);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const galleryRef = useRef(null);
  useDialogFocus(galleryOpen, galleryRef, () => setGalleryOpen(false));
  const [isAdding, setIsAdding] = useState(false);
  const [sunTreatment, setSunTreatment] = useState(product.polarized ? "Polarized" : "Non-polarized");
  const [frameVariant, setFrameVariant] = useState(`${shqipLabel(product.color)} / ${shqipLabel(product.lensColor)}`);
  const [lensTint, setLensTint] = useState(product.lensColor);
  const [lifestyle, setLifestyle] = useState(product.lifestyle?.[0] || "Everyday");
  const addingRef = useRef(false);
  const prescriptionUploads = useRef(createLatestUpload());
  useEffect(() => () => prescriptionUploads.current.cancel(), []);
  useEffect(() => {
    prescriptionUploads.current.cancel();
    setUploadState(current => current === 'uploading' ? 'idle' : current);
  }, [rxMode, purchaseMode]);
  const rxModeLabels = {
    "Upload prescription": "Ngarko recetën",
    "Enter manually": "Shkruaje manualisht",
    "Send later": "Dërgoje më vonë",
    "Contact support": "Kontakto optikën"
  };

  const selectedLens = lensPackages.find((item) => item.id === lens);
  const selectedCoating = coatings.find((item) => item.id === coating);
  const basePrice = product.salePrice || product.price;
  const total = basePrice + (purchaseMode === "prescription" ? selectedLens.price + selectedCoating.price : 0);
  const relatedProducts = useMemo(() => {
    const currentFamily = product.baseId || product.id;
    const seenFamilies = new Set([currentFamily]);
    return products
      .filter((item) => item.type === product.type)
      .filter((item) => {
        const family = item.baseId || item.id;
        if (seenFamilies.has(family)) return false;
        seenFamilies.add(family);
        return true;
      })
      .slice(0, 4);
  }, [product, products]);
  const familyVariants = useMemo(() => {
    const familyId = product.baseId || product.id;
    return products.filter((item) => item.id === familyId || item.baseId === familyId);
  }, [product, products]);

  useEffect(() => {
    const saved = editingLine?.configuration || {};
    prescriptionUploads.current.cancel();
    setPurchaseMode(saved.purchaseMode || (product.type === "Sunglasses" ? "ready" : "prescription"));
    setLens(lensPackages.find((option) => option.name === saved.lensPackage)?.id || lensPackages[0].id);
    setCoating(coatings.find((option) => option.name === saved.coating)?.id || "anti-reflective");
    setRxMode(Object.keys(rxModeLabels).find((key) => rxModeLabels[key] === saved.rxMode || key === saved.rxMode) || "Upload prescription");
    setSelectedImage(product.image);
    setRotation(0);
    setSunTreatment(saved.sunTreatment || (product.polarized ? "Polarized" : "Non-polarized"));
    setFrameVariant(editingLine?.productId === product.id && saved.frameVariant ? saved.frameVariant : `${shqipLabel(product.color)} / ${shqipLabel(product.lensColor)}`);
    setLensTint(saved.lensTint || product.lensColor);
    setLifestyle(saved.lifestyle || product.lifestyle?.[0] || "Everyday");
    setQty(editingLine?.quantity || 1);
    setRxError("");
    setFileName(saved.prescriptionFile || "");
    setPrescriptionToken(saved.prescriptionToken || "");
    setUploadState(saved.prescriptionToken ? "complete" : "idle");
    setManualRx({ odSph: "", odCyl: "", odAxis: "", odAdd: "", osSph: "", osCyl: "", osAxis: "", osAdd: "", pd: "", prism: "", base: "", ...(saved.manualRx || {}) });
  }, [product.id, editingLine?.lineId]);

  const validateManualPrescription = () => {
    const numeric = (value) => value !== "" && Number.isFinite(Number(value));
    if (!numeric(manualRx.odSph) || !numeric(manualRx.osSph)) {
      return "Shkruani vlerën SPH për syrin e djathtë dhe syrin e majtë.";
    }
    if (Number(manualRx.odSph) < -20 || Number(manualRx.odSph) > 20 || Number(manualRx.osSph) < -20 || Number(manualRx.osSph) > 20) {
      return "SPH duhet të jetë ndërmjet -20.00 dhe +20.00.";
    }
    for (const side of ["od", "os"]) {
      const cyl = manualRx[`${side}Cyl`];
      const axis = manualRx[`${side}Axis`];
      if (cyl !== "" && (!numeric(cyl) || Number(cyl) < -6 || Number(cyl) > 6)) return "CYL duhet të jetë ndërmjet -6.00 dhe +6.00.";
      if (cyl !== "" && Number(cyl) !== 0 && (!numeric(axis) || Number(axis) < 0 || Number(axis) > 180)) return "Kur shkruani CYL, AXIS duhet të jetë ndërmjet 0 dhe 180.";
      const add = manualRx[`${side}Add`];
      if (add !== "" && (!numeric(add) || Number(add) < 0 || Number(add) > 4)) return "ADD duhet të jetë ndërmjet 0.00 dhe +4.00.";
    }
    if (!numeric(manualRx.pd) || Number(manualRx.pd) < 40 || Number(manualRx.pd) > 80) {
      return "PD duhet të jetë ndërmjet 40 dhe 80 mm. Nëse nuk e dini, zgjidhni ‘Kontakto optikën’.";
    }
    return "";
  };

  const handlePrescriptionFile = async (file) => {
    prescriptionUploads.current.cancel();
    setRxError("");
    setFileName(file?.name || "");
    setPrescriptionToken("");
    if (!file) {
      setUploadState("idle");
      return;
    }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type) || file.size > 10 * 1024 * 1024) {
      setUploadState("error");
      setRxError("Receta duhet të jetë PDF, JPG ose PNG dhe jo më e madhe se 10 MB.");
      return;
    }
    setUploadState("uploading");
    const upload = prescriptionUploads.current.begin();
    const timeout = window.setTimeout(() => {
      if (!upload.current()) return;
      prescriptionUploads.current.cancel();
      setUploadState('error');
      setRxError('Ngarkimi nuk u konfirmua. Provoni përsëri ose zgjidhni “Dërgoje më vonë”.');
    }, 30000);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/prescription-upload.php", {
        method: "POST",
        body: form,
        signal: upload.signal,
        credentials: "same-origin"
      });
      const result = await response.json().catch(() => null);
      if (!upload.current()) return;
      if (!response.ok || !result?.ok || !result?.token) throw new Error(result?.error || "upload_failed");
      setPrescriptionToken(result.token);
      setUploadState("complete");
    } catch {
      if (!upload.current()) return;
      setUploadState("error");
      setRxError("Receta nuk u ngarkua. Provoni përsëri ose zgjidhni ‘Dërgoje më vonë’. ");
    } finally { window.clearTimeout(timeout); }
  };

  const addConfigured = () => {
    if (addingRef.current) return;
    if (purchaseMode === "prescription") {
      const validationMessage = rxMode === "Upload prescription"
        ? (!prescriptionToken || uploadState !== "complete" ? "Ngarkoni recetën me sukses para se ta shtoni porosinë." : "")
        : rxMode === "Enter manually"
          ? validateManualPrescription()
          : "";
      if (validationMessage) {
        setRxError(validationMessage);
        document.getElementById("prescription-options")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    setRxError("");
    addingRef.current = true;
    setIsAdding(true);
    addToCart(product, {
      purchaseMode,
      lensPackage: purchaseMode === "prescription"
        ? selectedLens.name
        : product.type === "Sunglasses" ? "Siç paraqitet" : "Vetëm korniza",
      coating: purchaseMode === "prescription" ? selectedCoating.name : "Pa shtesë",
      rxMode: purchaseMode === "prescription" ? rxModeLabels[rxMode] : "Nuk kërkohet",
      prescriptionNeedsReentry: false,
      prescriptionFile: purchaseMode === "prescription" && rxMode === "Upload prescription" ? fileName || "Pa dokument të zgjedhur" : "Nuk kërkohet",
      prescriptionToken: purchaseMode === "prescription" && rxMode === "Upload prescription" ? prescriptionToken : "",
      manualPrescription: purchaseMode === "prescription" && rxMode === "Enter manually" ? JSON.stringify(manualRx) : "",
      manualRx: purchaseMode === "prescription" && rxMode === "Enter manually" ? manualRx : {},
      frameVariant,
      lensTint,
      sunTreatment,
      lifestyle,
      quantity: qty,
      total: total * qty
    });
    window.setTimeout(() => {
      addingRef.current = false;
      setIsAdding(false);
    }, 700);
  };

  return (
    <section className="page-section product-page">
      {editingLine && <div className="ed-editing-cart" role="status"><span><strong>Po ndryshoni një artikull të shportës.</strong> Ndryshimet ruhen vetëm kur i konfirmoni.</span><button className="ed-link" onClick={cancelEdit}>Anulo dhe kthehu në shportë</button></div>}
      <div className="mobile-product-summary">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <a href="/" onClick={(event) => { event.preventDefault(); navigate("home"); }}>Ballina</a>
          <span>/</span>
          <a href={product.type === "Sunglasses" ? "/sunglasses" : "/prescription-glasses"} onClick={(event) => { event.preventDefault(); navigate(product.type === "Sunglasses" ? "sunglasses" : "prescription"); }}>{shqipLabel(product.type)}</a>
          <span>/</span><span aria-current="page">{product.name}</span>
        </nav>
        <div className="product-title-row">
          <div>
            <MobileProductTitle>{product.name}</MobileProductTitle>
            <p>{productDescription(product, shqipLabel)}</p>
          </div>
          <button
            className={`icon-button ${wishlist.has(product.id) ? "selected" : ""}`}
            onClick={() => toggleWishlist(product.id)}
            aria-label={wishlist.has(product.id) ? "Hiqe nga të preferuarat" : "Ruaje te të preferuarat"}
          >
            <Heart size={20} />
          </button>
        </div>
        <div className="price-line">
          <strong>{money(product.salePrice || product.price)}</strong>
          {product.salePrice && <span>{money(product.price)}</span>}
        </div>
        <div className="mobile-product-meta" aria-label="Disponueshmëria dhe modeli">
          <span className={product.stock > 0 ? "in-stock" : "out-of-stock"}>
            {product.stock > 5 ? `Në stok · ${product.stock} copë` : product.stock > 0 ? `Stok i ulët · ${product.stock} copë` : "Nuk ka stok"}
          </span>
          <span>SKU {product.sku}</span>
        </div>
      </div>
      <div className="product-detail-grid">
        <div className="gallery-panel">
          <button
            type="button"
            className="main-product-image"
            style={{ "--rotate": `${rotation}deg` }}
            onClick={() => setGalleryOpen(true)}
            aria-label={`Zmadho pamjen e ${product.name}`}
          >
            <img src={selectedImage} width="1200" height="900" fetchpriority="high" decoding="async" alt={`${product.name}, ${shqipLabel(product.type).toLowerCase()}, pamja e zgjedhur`} />
            <span><Eye size={16} /> Zmadho</span>
          </button>
          <details className="product-view-tools"><summary>Pamjet e produktit <ChevronDown size={16} /></summary><div className="rotation-control">
            <label>
              Animi i fotografisë (opsional)
              <input
                type="range"
                min="-18"
                max="18"
                value={rotation}
                onChange={(event) => setRotation(event.target.value)}
              />
            </label>
          </div></details>
          {product.gallery.length > 1 && <div className="thumbnail-row">
            {product.gallery.map((image, index) => (
              <button
                key={image}
                type="button"
                className={selectedImage === image ? "selected" : ""}
                onClick={() => setSelectedImage(image)}
                aria-label={`Shfaq pamjen ${index + 1} të ${product.name}`}
              >
                <img src={image} width="180" height="130" alt={`${product.name}, pamja ${index + 1}`} loading="lazy" decoding="async" />
              </button>
            ))}
          </div>}
          <div className="spec-row">
            <span>
              <ShieldCheck size={18} /> {product.uv}
            </span>
            <span>
              <Sparkles size={18} /> {product.polarized ? "Të polarizuara" : shqipLabel(product.lensType)}
            </span>
            <span>
              <Eye size={18} /> {product.prescriptionReady ? "Gati për dioptri" : "Vetëm për diell"}
            </span>
          </div>
          {product.type === "Sunglasses" && product.virtualTryOnEnabled !== false && (
            <button className="product-fit-launch" onClick={() => navigate("fit", product.id, "/virtual-try-on")}>
              <Camera size={20} />
              <span><strong>{`Provo ${product.name} në 3D`}</strong><small>Gjurmim live, fotografi dhe model interaktiv</small></span>
              <ChevronRight size={18} />
            </button>
          )}
        </div>

        <div className="configurator">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <a href="/" onClick={(event) => { event.preventDefault(); navigate("home"); }}>Ballina</a>
            <span>/</span>
            <a href={product.type === "Sunglasses" ? "/sunglasses" : "/prescription-glasses"} onClick={(event) => { event.preventDefault(); navigate(product.type === "Sunglasses" ? "sunglasses" : "prescription"); }}>{shqipLabel(product.type)}</a>
            <span>/</span><span aria-current="page">{product.name}</span>
          </nav>
          <div className="product-title-row">
            <div>
              <DesktopProductTitle>{product.name}</DesktopProductTitle>
              <p>{productDescription(product, shqipLabel)}</p>
            </div>
            <button
              className={`icon-button ${wishlist.has(product.id) ? "selected" : ""}`}
              onClick={() => toggleWishlist(product.id)}
              aria-label={wishlist.has(product.id) ? "Hiqe nga të preferuarat" : "Ruaje te të preferuarat"}
            >
              <Heart size={20} />
            </button>
          </div>
          <div className="price-line">
            <strong>{money(product.salePrice || product.price)}</strong>
            {product.salePrice && <span>{money(product.price)}</span>}
          </div>
          <div className="product-identity-strip">
            <span><small>SKU</small><b>{product.sku}</b></span>
            <span><small>DISPONUESHMËRIA</small><b>{product.stock > 5 ? `Në stok · ${product.stock} copë` : product.stock > 0 ? `Stok i ulët · ${product.stock} copë` : "Nuk ka stok"}</b></span>
            <span><small>PËRSHTATJA</small><b>{product.fitProfile || "Mesatare"}</b></span>
          </div>

          <div className="product-above-fold-actions">
            <button type="button" className="primary-button" disabled={product.stock <= 0 || isAdding || uploadState === 'uploading'} onClick={() => purchaseMode === 'ready' ? addConfigured() : document.getElementById("product-order-config")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              {isAdding ? 'Duke ruajtur…' : product.stock <= 0 ? 'Nuk ka stok' : purchaseMode === 'ready' ? 'Shto në shportë' : 'Konfiguro dhe porosit'} <ChevronRight size={17} />
            </button>
            <span><Truck size={16} /><small>Dërgesë në Kosovë</small><b>{product.delivery || "Afati konfirmohet para porosisë."}</b></span>
          </div>
          <p className="product-price-note">Çmimet paraqiten në EUR. Totali, receta dhe çdo tarifë konfirmohen para pagesës.</p>
          <details className="product-disclosure product-info-disclosure"><summary>Dërgesa, marrja dhe kthimet <ChevronDown size={17} /></summary><div className="product-assurance-grid" aria-label="Dërgesa, marrja dhe kthimet">
            <a href="/policies#delivery" onClick={(event) => { event.preventDefault(); navigate("policies", undefined, "/policies#delivery"); }}>
              <Truck size={16} /><span><small>Dërgesa</small><strong>Mënyra dhe kostoja në shportë</strong></span>
            </a>
            <a href="/contact" onClick={(event) => { event.preventDefault(); navigate("contact"); }}>
              <MapPin size={16} /><span><small>Marrja në optikë</small><strong>Falas, pas kontrollit final</strong></span>
            </a>
            <a href="/policies#returns" onClick={(event) => { event.preventDefault(); navigate("policies", undefined, "/policies#returns"); }}>
              <RefreshCw size={16} /><span><small>Kthimet</small><strong>30 ditë për korniza standarde</strong></span>
            </a>
            <a href={`tel:+${storePhone}`}>
              <ShieldCheck size={16} /><span><small>Pas blerjes</small><strong>Rregullim fillestar në optikë</strong></span>
            </a>
          </div></details>

          <div id="product-order-config">
          <ConfiguratorSection title="Si dëshironi ta porosisni?" defaultOpen>
            <div className="purchase-mode-grid">
              <button
                className={purchaseMode === "ready" ? "selected" : ""}
                onClick={() => setPurchaseMode("ready")}
              >
                <span><strong>{product.type === "Sunglasses" ? "Siç paraqitet" : "Vetëm korniza"}</strong><small>{product.type === "Sunglasses" ? "Korniza dhe thjerrëzat e diellit të modelit" : "Thjerrëzat me recetë shtohen më vonë"}</small></span>
                <b>{money(basePrice)}</b>
              </button>
              {product.prescriptionReady && (
                <button
                  className={purchaseMode === "prescription" ? "selected" : ""}
                  onClick={() => setPurchaseMode("prescription")}
                >
                  <span><strong>Me thjerrëza me recetë</strong><small>Zgjidhni paketën, shtresën dhe mënyrën e recetës</small></span>
                  <b>{money(basePrice + selectedLens.price + selectedCoating.price)}</b>
                </button>
              )}
            </div>
          </ConfiguratorSection>
          </div>

          <ConfiguratorSection title="Varianti i kornizës">
            <div className="variant-product-grid" aria-label={`Variantet e ${product.name}`}>
              {familyVariants.map((variant) => (
                <a
                  key={variant.id}
                  href={productPathFor(variant)}
                  className={variant.id === product.id ? "selected" : ""}
                  aria-current={variant.id === product.id ? "page" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    if (variant.id === product.id) return;
                    trackPublicEvent("variant_selected", { item_id: variant.id, item_name: variant.name, parent_item_id: product.baseId || product.id });
                    navigate("product", variant.id);
                  }}
                >
                  <span><strong>{shqipLabel(variant.color)}</strong><small>{shqipLabel(variant.lensColor)} · {variant.sku}</small></span>
                  <b>{money(variant.salePrice || variant.price)}</b>
                  <em>{variant.stock > 0 ? `${variant.stock} në stok` : "Nuk ka stok"}</em>
                </a>
              ))}
            </div>
          </ConfiguratorSection>

          {product.type === "Sunglasses" && purchaseMode === "prescription" && (
            <ConfiguratorSection title="Preferencat për diell" summary={`${shqipLabel(lensTint)} · ${shqipLabel(sunTreatment)}`}>
              <p>Preferenca për konsultim, jo variante shtesë në stok. Optiku konfirmon mundësinë dhe çmimin përfundimtar para punimit.</p>
              <div className="chip-grid">
                {(product.lensColors || [product.lensColor]).map((tint) => (
                  <button
                    key={tint}
                    className={lensTint === tint ? "selected" : ""}
                    onClick={() => setLensTint(tint)}
                  >
                    {shqipLabel(tint)}
                  </button>
                ))}
                {["Polarized", "Non-polarized", "UV400", "Mirror coating", "Gradient lenses"].map((option) => (
                  <button key={option} className={sunTreatment === option ? "selected" : ""} onClick={() => setSunTreatment(option)}>
                    {shqipLabel(option)}
                  </button>
                ))}
              </div>
              <div className="segmented-control lifestyle-control">
                {["Driving", "Beach", "Fashion", "Sport", "Everyday"].map((item) => (
                  <button key={item} className={lifestyle === item ? "selected" : ""} onClick={() => setLifestyle(item)}>
                    {shqipLabel(item)}
                  </button>
                ))}
              </div>
            </ConfiguratorSection>
          )}

          <ConfiguratorSection title="A ju përshtatet kjo kornizë?" summary={`${product.frameWidth || "—"} mm · ${product.size}`}>
            <div className="face-chip-row">
              {product.faceShapes.map((shape) => (
                <span key={shape}>{shqipLabel(shape)}</span>
              ))}
            </div>
            <p>Këto janë sugjerime orientuese, jo rregulla. Rehatia dhe përshtatja e {product.name} konfirmohen me provë në optikë.</p>
          </ConfiguratorSection>

          {purchaseMode === "prescription" && <ConfiguratorSection title="1. Zgjidhni lentet" summary={`${selectedLens.name} · +${money(selectedLens.price)}`} defaultOpen>
            <div className="option-stack">
              {lensPackages.map((item) => (
                <button
                  key={item.id}
                  className={lens === item.id ? "selected" : ""}
                  onClick={() => setLens(item.id)}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <b>{money(item.price)}</b>
                </button>
              ))}
            </div>
          </ConfiguratorSection>}

          {purchaseMode === "prescription" && <ConfiguratorSection title="2. Shtresa e lentes" summary={`${selectedCoating.name} · +${money(selectedCoating.price)}`}>
            <div className="chip-grid">
              {coatings.map((item) => (
                <button
                  key={item.id}
                  className={coating === item.id ? "selected" : ""}
                  onClick={() => setCoating(item.id)}
                >
                  {item.name} <span>{money(item.price)}</span>
                </button>
              ))}
            </div>
          </ConfiguratorSection>}

          {purchaseMode === "prescription" && <div id="prescription-options"><ConfiguratorSection title="3. Si do ta dërgoni recetën?">
            <p className="configurator-note">Vlerat dhe dokumenti i recetës nuk ruhen në shportën e përhershme të shfletuesit. Pas rifreskimit, plotësojini përsëri ose zgjidhni ta dërgoni recetën më vonë.</p>
            {editingLine?.configuration?.prescriptionNeedsReentry && <p role="status">Për privatësinë tuaj, receta e mëparshme nuk u rikthye nga shfletuesi.</p>}
            <div className="segmented-control">
              {["Upload prescription", "Enter manually", "Send later", "Contact support"].map((mode) => (
                <button key={mode} className={rxMode === mode ? "selected" : ""} onClick={() => { setRxMode(mode); setRxError(""); }}>
                  {rxModeLabels[mode]}
                </button>
              ))}
            </div>
            {rxMode === "Upload prescription" && (
              <label className="upload-zone">
                <UploadCloud size={24} />
                <span>{uploadState === "uploading" ? "Duke e ngarkuar në mënyrë të sigurt…" : uploadState === "complete" ? `${fileName} · u ngarkua` : fileName || "Zgjidh PDF, JPG ose PNG deri në 10 MB"}</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(event) => handlePrescriptionFile(event.target.files?.[0])}
                />
              </label>
            )}
            {rxMode === "Enter manually" && (
              <div className="rx-manual-entry">
                {[{ key: "od", title: "Syri i djathtë (OD)" }, { key: "os", title: "Syri i majtë (OS)" }].map((eye) => (
                  <fieldset key={eye.key}>
                    <legend>{eye.title}</legend>
                    <div className="rx-grid">
                      {[{ suffix: "Sph", label: "SPH", min: -20, max: 20 }, { suffix: "Cyl", label: "CYL", min: -6, max: 6 }, { suffix: "Axis", label: "AXIS", min: 0, max: 180 }, { suffix: "Add", label: "ADD", min: 0, max: 4 }].map((field) => {
                        const key = `${eye.key}${field.suffix}`;
                        return <label key={key}>{field.label}<input type="number" inputMode="decimal" step={field.suffix === "Axis" ? 1 : 0.25} min={field.min} max={field.max} value={manualRx[key]} onChange={(event) => setManualRx({ ...manualRx, [key]: event.target.value })} placeholder={field.suffix === "Axis" ? "0–180" : "0.00"} /></label>;
                      })}
                    </div>
                  </fieldset>
                ))}
                <fieldset>
                  <legend>Matjet shtesë</legend>
                  <div className="rx-grid">
                    <label>PD (mm)<input type="number" inputMode="decimal" step="0.5" min="40" max="80" value={manualRx.pd} onChange={(event) => setManualRx({ ...manualRx, pd: event.target.value })} placeholder="40–80" /></label>
                    <label>Prizëm <small>Opsionale</small><input value={manualRx.prism} maxLength="24" onChange={(event) => setManualRx({ ...manualRx, prism: event.target.value })} /></label>
                    <label>Drejtimi i bazës <small>Opsionale</small><input value={manualRx.base} maxLength="24" onChange={(event) => setManualRx({ ...manualRx, base: event.target.value })} /></label>
                  </div>
                </fieldset>
              </div>
            )}
            {rxMode === "Send later" && (
              <p className="rx-note">Korniza rezervohet, ndërsa punimi në laborator pret derisa të dërgohet dhe të verifikohet receta.</p>
            )}
            {rxMode === "Contact support" && (
              <p className="rx-note">Ekipi i optikës do të rishikojë paketën e thjerrëzave, PD-në dhe recetën para konfirmimit final.</p>
            )}
            <p className="rx-privacy-note"><ShieldCheck size={15} /> Dokumenti ruhet jashtë dosjeve publike dhe është i qasshëm vetëm për stafin e autorizuar. Punimi nuk fillon pa verifikim optik.</p>
            {rxError && <p className="rx-validation-error" role="alert">{rxError}</p>}
          </ConfiguratorSection></div>}

          <details className="product-disclosure product-spec-disclosure"><summary>Masat, materiali dhe kujdesi <ChevronDown size={17} /></summary><p>{productDescription(product, shqipLabel)}</p><div className="measurement-table">
            <h3>Masat dhe specifikat</h3>
            <div><span>Brendi</span><strong>Optika Miftari</strong></div>
            <div><span>Modeli / SKU</span><strong>{product.name} / {product.sku}</strong></div>
            <div><span>Lloji i kornizës</span><strong>{shqipLabel(product.type)} · {shqipLabel(product.frameShape)}</strong></div>
            <div>
              <span>Madhësia</span>
              <strong>{shqipLabel(product.size)}</strong>
            </div>
            {product.frameWidth && (
              <div>
                <span>Gjerësia totale</span>
                <strong>{product.frameWidth} mm</strong>
              </div>
            )}
            <div><span>Masat e kornizës</span><strong>Lente {product.lensWidth || "—"} mm · urë {product.bridgeWidth || "—"} mm · bishta {product.templeLength || "—"} mm{product.lensHeight ? ` · lartësi ${product.lensHeight} mm` : ""}</strong></div>
            <div>
              <span>Materiali</span>
              <strong>{shqipLabel(product.material)}</strong>
            </div>
            <div><span>Ngjyra e kornizës / lentes</span><strong>{shqipLabel(product.color)} / {shqipLabel(product.lensColor)}</strong></div>
            <div><span>Lloji dhe mbrojtja e lentes</span><strong>{shqipLabel(product.lensType)} · {product.uv} · {product.polarized ? "e polarizuar" : "jo e polarizuar"}</strong></div>
            <div><span>Përdorimi / përshtatja</span><strong>{shqipLabel(product.audience)} · {(product.lifestyle || []).map(shqipLabel).join(", ")}</strong></div>
            <div><span>Për thjerrëza me recetë</span><strong>{product.prescriptionReady ? "Po, pas verifikimit të recetës dhe matjeve" : "Jo"}</strong></div>
            <div>
              <span>Forma e fytyrës</span>
              <strong>{product.faceShapes.map(shqipLabel).join(", ")}</strong>
            </div>
            {product.weight && (
              <div>
                <span>Pesha</span>
                <strong>{product.weight}</strong>
              </div>
            )}
            {product.lensCategory && (
              <div>
                <span>Kategoria e lentes</span>
                <strong>{product.lensCategory}</strong>
              </div>
            )}
            <div>
              <span>Kujdesi</span>
              <strong>{product.care || "Pastrojini me mikrofibër, ruajini në kuti dhe shmangni nxehtësinë."}</strong>
            </div>
            {product.service && (
              <div>
                <span>Shërbimi pas blerjes</span>
                <strong>{product.service}</strong>
              </div>
            )}
            <div><span>Aksesorët dhe garancia</span><strong>Konfirmohen sipas variantit para porosisë; rregullimi fillestar kryhet nga optika.</strong></div>
          </div>

          <div className="measurement-guide" aria-label="Shpjegimi i masave të kornizës">
            <span><b>{product.lensWidth || "—"}</b><small>Gjerësia e lentes</small></span>
            <i aria-hidden="true" />
            <span><b>{product.bridgeWidth || "—"}</b><small>Gjerësia e urës</small></span>
            <i aria-hidden="true" />
            <span><b>{product.templeLength || "—"}</b><small>Gjatësia e bishtave</small></span>
          </div>

          <div className="service-info">
            <article>
              <Truck size={18} />
              <span>Dërgesa</span>
              <p>{product.delivery || "Mënyra dhe afati konfirmohen para përgatitjes së porosisë."}</p>
            </article>
            <article>
              <RefreshCw size={18} />
              <span>Kthimet & përshtatja</span>
              <p>{product.returns || "Përshtatja dhe mundësia e kthimit kontrollohen me optikën."}</p>
            </article>
          </div>

          </details>
          <div className="checkout-panel">
            <div className="qty-control">
              <button aria-label="Zvogëlo sasinë" disabled={qty <= 1} onClick={() => setQty((value) => Math.max(1, value - 1))}>-</button>
              <span>{qty}</span>
              <button aria-label="Rrit sasinë" disabled={qty >= Math.min(10, Math.max(0, Number(product.stock || 0)))} onClick={() => setQty((value) => Math.min(10, Math.max(1, Number(product.stock || 0)), value + 1))}>+</button>
            </div>
            <div className="product-buy-action">
              <small>{purchaseMode === "prescription" ? `${selectedLens.name} · ${selectedCoating.name}` : product.type === "Sunglasses" ? "Modeli siç paraqitet" : "Vetëm korniza"}</small>
              <button className="primary-button" data-testid="add-configured-pair" disabled={Number(product.stock || 0) < 1 || isAdding || uploadState === "uploading"} onClick={addConfigured}>
                <ShoppingBag size={17} /> {Number(product.stock || 0) < 1 ? "Nuk ka stok" : isAdding ? "Duke ruajtur…" : `${editingLine ? "Ruaj ndryshimet" : "Shto në shportë"} - ${money(total * qty)}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <details className="product-disclosure product-lens-comparison"><summary>Krahasoni llojet e lenteve <ChevronDown size={18} /></summary><LensComparison /></details>

      <section className="section related-products">
        <div className="section-heading inline-heading">
          <div>
            <p>Produkte të ngjashme</p>
            <h2>Korniza që mund t'ju përshtaten.</h2>
          </div>
        </div>
        <ProductRail
          products={relatedProducts}
          navigate={navigate}
          addToCart={addToCart}
          wishlist={wishlist}
          toggleWishlist={toggleWishlist}
        />
      </section>

      <div className="mobile-product-cta" aria-label="Veprimi i shpejtë i produktit">
        <span><small>{purchaseMode === "prescription" ? "Me lente · sipas zgjedhjes" : "Vetëm modeli"}</small><strong>{money(total * qty)}</strong></span>
        <button type="button" disabled={Number(product.stock || 0) < 1 || isAdding || uploadState === "uploading"} onClick={() => purchaseMode === "ready" ? addConfigured() : document.getElementById("product-order-config")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{Number(product.stock || 0) < 1 ? "Nuk ka stok" : isAdding ? "Duke ruajtur…" : purchaseMode === "ready" ? "Shto në shportë" : "Konfiguro"}</button>
      </div>

      {galleryOpen && (
        <div className="product-gallery-modal" ref={galleryRef} role="dialog" aria-modal="true" aria-label={`Pamja e zmadhuar e ${product.name}`}>
          <button type="button" className="gallery-modal-close" onClick={() => setGalleryOpen(false)} aria-label="Mbyll pamjen e zmadhuar"><X size={22} /></button>
          <img src={selectedImage} width="1600" height="1200" alt={`${product.name}, pamja e zmadhuar`} />
          <p>{product.name} · {shqipLabel(product.color)} · {shqipLabel(product.lensColor)}</p>
        </div>
      )}
    </section>
  );
}

function ConfiguratorSection({ title, children, summary, defaultOpen = false }) {
  if (summary) return <details className="config-section product-disclosure" open={defaultOpen || undefined}><summary><span><strong>{title}</strong><small>{summary}</small></span><ChevronDown size={17} /></summary><div className="product-disclosure-body">{children}</div></details>;
  return (
    <section className="config-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function LensComparison() {
  const rows = [
    ["Të polarizuara", "Më pak shkëlqim verbues", "Vozitje, plazh dhe diell i fortë"],
    ["Për ekran", "Komoditet digjital", "Punë dhe përdorim i gjatë i ekranit"],
    ["Fotokromatike", "Ngjyrim që përshtatet", "Kalime brenda dhe jashtë"],
    ["Progresive", "Recetë me disa zona", "Lexim, tavolinë dhe largësi"]
  ];

  return (
    <section className="section comparison-section">
      <div className="section-heading">
        <p>Krahasimi i thjerrëzave</p>
        <h2>Zgjidhni mënyrën si duhet të punojë thjerrëza.</h2>
      </div>
      <div className="comparison-table" role="table" aria-label="Tabela e krahasimit të thjerrëzave">
        <div role="row" className="table-head">
          <span role="columnheader">Thjerrëza</span>
          <span role="columnheader">Përfitimi</span>
          <span role="columnheader">Përdorimi</span>
        </div>
        {rows.map((row) => (
          <div role="row" key={row[0]}>
            {row.map((cell) => (
              <span role="cell" key={cell}>
                {cell}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="coating-visual">
        <article>
          <span>Pa shtresë</span>
          <div className="demo-lens glare-heavy" />
        </article>
        <article>
          <span>Shtresë antirefleks</span>
          <div className="demo-lens glare-soft" />
        </article>
        <article>
          <span>Ngjyrim fotokromatik</span>
          <div className="demo-lens tint-shift" />
        </article>
      </div>
    </section>
  );
}

function AdminPage({ products, setProducts, ordersSeed, events, homepageContent, setHomepageContent, navigate }) {
  const brandIsCurrent = readStorage("visionaire-brand-version", "") === brandVersion;
  const [unlocked, setUnlocked] = useState(() => readStorage("visionaire-admin-unlocked", false));
  const [password, setPassword] = useState("");
  const [activeAdmin, setActiveAdmin] = useState("Dashboard");
  const [orders, setOrders] = useState(() => readStorage("visionaire-orders", ordersSeed)
    .map(normalizeOrderBrand)
    .filter((order) => !isSyntheticAuditRecord(order)));
  const [customers, setCustomers] = useState(() => readStorage("visionaire-customers", initialCustomers)
    .map(normalizeCustomerBrand)
    .filter((customer) => !isSyntheticAuditRecord(customer)));
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerSegment, setCustomerSegment] = useState("All customers");
  const [selectedCustomerId, setSelectedCustomerId] = useState(() => initialCustomers[0]?.id || "");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState("All orders");
  const [selectedOrderId, setSelectedOrderId] = useState(() => ordersSeed[0]?.id || "");
  const [adminNotice, setAdminNotice] = useState("");
  const [draft, setDraft] = useState(emptyProductDraft);
  const [editingProductId, setEditingProductId] = useState("");
  const [discounts, setDiscounts] = useState(() => brandIsCurrent ? readStorage("visionaire-campaigns", campaigns) : campaigns);
  const [seo, setSeo] = useState(() => brandIsCurrent ? readStorage("visionaire-seo-cms", defaultAdminSeo) : defaultAdminSeo);
  const [pages, setPages] = useState(() => readStorage("visionaire-content-pages", contentPages));
  const [posts, setPosts] = useState(() => readStorage("visionaire-blog-posts", blogPosts));
  const [faqs, setFaqs] = useState(() => readStorage("visionaire-faqs", faqItems));
  const [mediaLibrary, setMediaLibrary] = useState(() => readStorage("visionaire-media", mediaAssets));
  const [team, setTeam] = useState(() => readStorage("visionaire-team", teamMembers));
  const [pageDraft, setPageDraft] = useState({ title: "", type: "Guide", status: "Draft", seo: "" });
  const [campaignDraft, setCampaignDraft] = useState({ code: "", value: "", scope: "", active: true, channel: "Homepage banner" });
  const [analyticsConfig, setAnalyticsConfig] = useState(() => readStorage("visionaire-analytics-config", {
    googleAnalyticsId: "",
    metaPixelId: "",
    trackProductViews: true,
    trackCart: true,
    trackCheckout: true,
    trackPrescriptionUpload: true,
    trackNewsletter: true
  }));

  useEffect(() => writeStorage("visionaire-admin-unlocked", unlocked), [unlocked]);
  useEffect(() => writeStorage("visionaire-brand-version", brandVersion), []);
  useEffect(() => writeStorage("visionaire-orders", orders), [orders]);
  useEffect(() => writeStorage("visionaire-customers", customers), [customers]);
  useEffect(() => writeStorage("visionaire-campaigns", discounts), [discounts]);
  useEffect(() => writeStorage("visionaire-seo-cms", seo), [seo]);
  useEffect(() => writeStorage("visionaire-content-pages", pages), [pages]);
  useEffect(() => writeStorage("visionaire-blog-posts", posts), [posts]);
  useEffect(() => writeStorage("visionaire-faqs", faqs), [faqs]);
  useEffect(() => writeStorage("visionaire-media", mediaLibrary), [mediaLibrary]);
  useEffect(() => writeStorage("visionaire-team", team), [team]);
  useEffect(() => writeStorage("visionaire-analytics-config", analyticsConfig), [analyticsConfig]);
  useEffect(() => {
    if (!adminNotice) return undefined;
    const timeout = window.setTimeout(() => setAdminNotice(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [adminNotice]);

  if (!unlocked) {
    return (
      <section className="admin-login">
        <div className="login-panel">
          <LockKeyhole size={34} />
          <h1>Optika Miftari Operations</h1>
          <p>Customer care, orders, products, prescriptions, content, and storefront performance in one workspace.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setUnlocked(password.trim().length >= 4);
            }}
          >
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Workspace access code"
              data-testid="admin-password"
            />
            <button className="primary-button" data-testid="admin-unlock">Open workspace</button>
          </form>
        </div>
      </section>
    );
  }

  const splitList = (value) =>
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const fillDraftFromProduct = (product) => {
    setEditingProductId(product.id);
    setDraft({
      ...emptyProductDraft,
      ...product,
      price: String(product.price || ""),
      salePrice: product.salePrice ? String(product.salePrice) : "",
      stock: String(product.stock || ""),
      badges: (product.badges || []).join(", "),
      faceShapes: (product.faceShapes || []).join(", "),
      lifestyle: (product.lifestyle || []).join(", "),
      prescriptionReady: Boolean(product.prescriptionReady),
      polarized: Boolean(product.polarized),
      blueLight: Boolean(product.blueLight)
    });
    setActiveAdmin("Products");
  };

  const resetProductDraft = () => {
    setEditingProductId("");
    setDraft(emptyProductDraft);
  };

  const handleProductMedia = (files) => {
    const selected = Array.from(files || []).filter((file) => file.type.startsWith("image/"));
    selected.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result;
        setMediaLibrary((items) => [
          { name: file.name, folder: "Uploads", type: "Product image", url },
          ...items.filter((item) => item.name !== file.name)
        ]);
        if (index === 0) {
          setDraft((current) => ({ ...current, image: url, gallery: [url] }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleMediaUpload = (files) => {
    const selected = Array.from(files || []).filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    selected.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const mediaType = file.type.startsWith("video/") ? "Video" : "Image";
        setMediaLibrary((items) => [
          { name: file.name, folder: "Uploads", type: mediaType, url: reader.result },
          ...items.filter((item) => item.name !== file.name)
        ]);
        setAdminNotice(`${file.name} added to the media library.`);
      };
      reader.readAsDataURL(file);
    });
  };

  const addProduct = (event) => {
    event.preventDefault();
    if (!draft.name || !draft.price) return;
    const product = {
      id: editingProductId || `cms-${Date.now()}`,
      sku: draft.sku || `CMS-${Math.floor(Math.random() * 9000) + 1000}`,
      name: draft.name,
      type: draft.type,
      audience: draft.audience,
      collection: draft.collection,
      price: Number(draft.price),
      salePrice: draft.salePrice ? Number(draft.salePrice) : null,
      image: draft.image || "/assets/products/vortex-x1-studio.webp",
      gallery: draft.gallery || [draft.image || "/assets/products/vortex-x1-studio.webp"],
      frameShape: draft.frameShape,
      color: draft.color,
      lensColor: draft.lensColor,
      material: draft.material,
      size: draft.size,
      lensType: draft.lensType,
      createdAt: draft.createdAt || new Date().toISOString().slice(0, 10),
      popularity: Number(draft.popularity || 72),
      variants: splitList(draft.variants || `${draft.color} / ${draft.lensColor}`),
      colors: splitList(draft.colors || draft.color),
      lensColors: splitList(draft.lensColors || draft.lensColor),
      polarized: Boolean(draft.polarized),
      uv: draft.uv,
      prescriptionReady: Boolean(draft.prescriptionReady),
      blueLight: Boolean(draft.blueLight),
      stock: Number(draft.stock || 0),
      badges: splitList(draft.badges),
      faceShapes: splitList(draft.faceShapes),
      lifestyle: splitList(draft.lifestyle),
      description: draft.description || "Optika Miftari eyewear selected for comfort, clarity, and confident daily wear.",
      technical: draft.technical || "Frame construction and lens compatibility reviewed by the optical team.",
      delivery: draft.delivery || "Ships after order and prescription review.",
      returns: draft.returns || "Returns are reviewed according to frame condition and lens customization.",
      care: draft.care || "Microfiber clean and case storage.",
      seoTitle: draft.seoTitle || `${draft.name} | Optika Miftari`,
      metaDescription: draft.metaDescription || "Discover this Optika Miftari frame, available with professional lens and fitting support."
    };
    setProducts((items) =>
      editingProductId ? items.map((item) => (item.id === editingProductId ? product : item)) : [product, ...items]
    );
    setAdminNotice(editingProductId ? `${product.name} updated.` : `${product.name} added to the catalog.`);
    resetProductDraft();
  };

  const updateOrderStatus = (id, status) => {
    setOrders((items) => items.map((order) => (
      order.id === id ? { ...order, status, updatedAt: new Date().toISOString().slice(0, 10) } : order
    )));
    setAdminNotice(`${id} moved to ${status}.`);
  };

  const addPage = (event) => {
    event.preventDefault();
    if (!pageDraft.title) return;
    const next = { ...pageDraft, status: pageDraft.status || "Draft" };
    if (pageDraft.type === "Blog") {
      setPosts((items) => [{ title: next.title, category: "CMS", excerpt: next.seo || "CMS-created article." }, ...items]);
    } else if (pageDraft.type === "FAQ") {
      setFaqs((items) => [{ question: next.title, answer: next.seo || "Add the approved customer-facing answer here." }, ...items]);
    } else {
      setPages((items) => [next, ...items]);
    }
    setAdminNotice(`${next.title} created as ${next.status.toLowerCase()}.`);
    setPageDraft({ title: "", type: "Guide", status: "Draft", seo: "" });
  };

  const addCampaign = (event) => {
    event.preventDefault();
    if (!campaignDraft.code) return;
    setDiscounts((items) => [campaignDraft, ...items]);
    setAdminNotice(`${campaignDraft.code} is now available in checkout.`);
    setCampaignDraft({ code: "", value: "", scope: "", active: true, channel: "Homepage banner" });
  };

  const downloadFile = (name, contents, type) => {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportCatalog = () => {
    const csv = ["sku,name,type,collection,price,stock,prescriptionReady"]
      .concat(products.map((product) => [
        product.sku,
        product.name,
        product.type,
        product.collection,
        product.salePrice || product.price,
        product.stock,
        product.prescriptionReady ? "Yes" : "No"
      ].map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")))
      .join("\n");
    downloadFile("optika-miftari-catalog.csv", csv, "text/csv");
    setAdminNotice("Catalog export prepared.");
  };

  const generateSitemap = () => {
    const base = String(seo.canonical || "https://optikamiftari.com/").replace(/\/$/, "");
    const urls = ["", "/shop", "/lens-focus", "/about", "/contact", ...products.map((product) => `/products/${product.id}`)];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((path) => `  <url><loc>${base}${path}</loc></url>`).join("\n")}\n</urlset>`;
    downloadFile("sitemap.xml", xml, "application/xml");
    setAdminNotice(`Sitemap generated with ${urls.length} URLs.`);
  };

  const exportOrders = () => {
    const columns = ["id", "customer", "product", "total", "status", "date", "prescription", "email", "phone", "shipping", "deliveryAddress", "payment", "note"];
    const csv = [columns.join(",")]
      .concat(orders.map((order) => columns
        .map((key) => `"${String(order[key] ?? "").replaceAll('"', '""')}"`)
        .join(",")))
      .join("\n");
    downloadFile("optika-miftari-orders.csv", csv, "text/csv");
    setAdminNotice("Order export prepared.");
  };

  const adminNav = [
    [Activity, "Dashboard"],
    [Boxes, "Products"],
    [ShoppingBag, "Orders"],
    [Users, "Customers"],
    [UploadCloud, "Prescriptions"],
    [ImageIcon, "Media"],
    [FileText, "Content"],
    [Search, "SEO"],
    [Megaphone, "Marketing"],
    [BarChart3, "Analytics"],
    [Users, "Roles"],
    [Settings, "Settings"]
  ];

  const showPanel = (section) => activeAdmin === section;
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const openOrders = orders.filter((order) => !["Completed", "Cancelled"].includes(order.status)).length;
  const prescriptionQueue = orders.filter((order) => order.prescription && !["None", "Verified"].includes(order.prescription)).length;
  const filteredCustomers = customers.filter((customer) => {
    const query = customerQuery.trim().toLowerCase();
    const matchesQuery = !query || [customer.name, customer.email, customer.segment, customer.prescription]
      .join(" ")
      .toLowerCase()
      .includes(query);
    const matchesSegment = customerSegment === "All customers" || customer.segment === customerSegment;
    return matchesQuery && matchesSegment;
  });
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) || filteredCustomers[0] || customers[0];
  const filteredOrders = orders.filter((order) => {
    const query = orderQuery.trim().toLowerCase();
    const matchesQuery = !query || [order.id, order.customer, order.product, order.email, order.prescription]
      .join(" ")
      .toLowerCase()
      .includes(query);
    const matchesStatus = orderStatus === "All orders" || order.status === orderStatus;
    return matchesQuery && matchesStatus;
  });
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || filteredOrders[0] || orders[0];
  const openCustomerOrders = (customer) => {
    setOrderQuery(customer.name);
    setOrderStatus("All orders");
    const firstOrder = orders.find((order) => order.customer === customer.name);
    if (firstOrder) setSelectedOrderId(firstOrder.id);
    setActiveAdmin("Orders");
  };

  return (
    <section className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand admin-brand">
          <img className="brand-logo" src="/assets/brand/optika-miftari-monogram.png" alt="" />
          <span className="brand-wordmark">
            OPTIKA <strong>MIFTARI</strong>
            <small>OPERATIONS</small>
          </span>
        </div>
        {adminNav.map(([Icon, label]) => (
          <button className={activeAdmin === label ? "active" : ""} key={label} onClick={() => setActiveAdmin(label)}>
            <Icon size={17} />
            {label}
          </button>
        ))}
      </aside>
      <div className="admin-main">
        <div className="admin-topbar">
          <div>
            <h1>{activeAdmin === "Dashboard" ? "Store operations" : activeAdmin}</h1>
            <p>{activeAdmin === "Dashboard" ? "Orders, customer care, prescription review, and storefront performance at a glance." : `Manage ${activeAdmin.toLowerCase()} without leaving the operations workspace.`}</p>
          </div>
          <div className="admin-user">
            <Bell size={18} />
            <span>AD</span>
            <b>Admin</b>
          </div>
        </div>
        {adminNotice && (
          <div className="admin-notice" role="status">
            <Check size={16} /> {adminNotice}
          </div>
        )}

        {activeAdmin === "Dashboard" && (
          <div className="kpi-grid">
            {[
              ["Tracked revenue", money(revenue), `${orders.length} live orders`],
              ["Open orders", String(openOrders), "Across payment, lab, and delivery"],
              ["Customers", String(customers.length), `${customers.filter((customer) => customer.status === "Active").length} active relationships`],
              ["Rx attention", String(prescriptionQueue), "Requires optical review"]
            ].map(([label, value, change]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{change}</small>
              </article>
            ))}
          </div>
        )}

        <div className={`admin-grid ${activeAdmin === "Dashboard" ? "" : "single-admin-grid"}`}>
          {activeAdmin === "Dashboard" && (
            <>
              <AdminPanel title="Recent orders" action="Open orders" onAction={() => setActiveAdmin("Orders")}>
                <div className="order-table dashboard-orders">
                  {orders.slice(0, 5).map((order) => (
                    <div key={order.id}>
                      <span>{order.id}</span>
                      <span>{order.customer}</span>
                      <strong>{money(order.total)}</strong>
                      <small>{order.status}</small>
                      <small>{order.prescription}</small>
                    </div>
                  ))}
                </div>
              </AdminPanel>

              <AdminPanel title="Customer attention" action="Open CRM" onAction={() => setActiveAdmin("Customers")}>
                <div className="attention-list">
                  {customers
                    .filter((customer) => customer.status !== "Active" || ["PD required", "Awaiting upload"].includes(customer.prescription))
                    .slice(0, 4)
                    .map((customer) => (
                      <button key={customer.id} onClick={() => { setSelectedCustomerId(customer.id); setActiveAdmin("Customers"); }}>
                        <span>
                          <strong>{customer.name}</strong>
                          <small>{customer.segment} / {customer.prescription}</small>
                        </span>
                        <b>{customer.status}</b>
                      </button>
                    ))}
                </div>
              </AdminPanel>

              <AdminPanel title="Prescription queue" action="Review queue" onAction={() => setActiveAdmin("Prescriptions")}>
                <div className="queue-summary">
                  <strong>{prescriptionQueue}</strong>
                  <span>orders need a file, PD confirmation, or optical review before lab release.</span>
                  <div>
                    <small>Uploaded</small><b>{orders.filter((order) => order.prescription === "Uploaded").length}</b>
                    <small>Manual</small><b>{orders.filter((order) => order.prescription === "Manual entry").length}</b>
                    <small>Send later</small><b>{orders.filter((order) => order.prescription === "Send later").length}</b>
                  </div>
                </div>
              </AdminPanel>

              <AdminPanel title="Storefront signals" action="View analytics" onAction={() => setActiveAdmin("Analytics")}>
                <div className="event-log dashboard-events">
                  {(events.length ? events : [{ label: "Waiting for storefront activity", time: "--:--" }]).slice(0, 6).map((event) => (
                    <div key={`${event.label}-${event.time}`}>
                      <span>{event.label}</span>
                      <small>{event.time}</small>
                    </div>
                  ))}
                </div>
              </AdminPanel>
            </>
          )}

          {showPanel("Products") && <AdminPanel
            title="Product management"
            action={editingProductId ? "Editing product" : "Export catalog"}
            onAction={editingProductId ? undefined : exportCatalog}
          >
            <form className="admin-form" onSubmit={addProduct}>
              <div className="admin-form-grid">
                <input
                  placeholder="Product name"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                />
                <select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>
                  <option>Sunglasses</option>
                  <option>Prescription Glasses</option>
                </select>
                <select value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value })}>
                  <option>Unisex</option>
                  <option>Men</option>
                  <option>Women</option>
                </select>
                <input
                  placeholder="Collection"
                  value={draft.collection}
                  onChange={(event) => setDraft({ ...draft, collection: event.target.value })}
                />
                <input
                  type="number"
                  placeholder="Base price"
                  value={draft.price}
                  onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                />
                <input
                  type="number"
                  placeholder="Sale price"
                  value={draft.salePrice}
                  onChange={(event) => setDraft({ ...draft, salePrice: event.target.value })}
                />
                <input
                  type="number"
                  placeholder="Stock"
                  value={draft.stock}
                  onChange={(event) => setDraft({ ...draft, stock: event.target.value })}
                />
                <input
                  placeholder="Frame color"
                  value={draft.color}
                  onChange={(event) => setDraft({ ...draft, color: event.target.value })}
                />
                <input
                  placeholder="Lens color"
                  value={draft.lensColor}
                  onChange={(event) => setDraft({ ...draft, lensColor: event.target.value })}
                />
                <input
                  placeholder="Material"
                  value={draft.material}
                  onChange={(event) => setDraft({ ...draft, material: event.target.value })}
                />
                <input
                  placeholder="Frame size e.g. 51-20-145"
                  value={draft.size}
                  onChange={(event) => setDraft({ ...draft, size: event.target.value })}
                />
                <select
                  value={draft.frameShape}
                  onChange={(event) => setDraft({ ...draft, frameShape: event.target.value })}
                >
                  <option>Square</option>
                  <option>Rectangle</option>
                  <option>Round</option>
                  <option>Wrap</option>
                  <option>Aviator</option>
                </select>
                <select value={draft.lensType} onChange={(event) => setDraft({ ...draft, lensType: event.target.value })}>
                  <option>Polarized</option>
                  <option>Clear Rx</option>
                  <option>Gradient</option>
                  <option>Blue-light</option>
                  <option>Mirror</option>
                </select>
                <input
                  placeholder="UV protection"
                  value={draft.uv}
                  onChange={(event) => setDraft({ ...draft, uv: event.target.value })}
                />
                <input
                  placeholder="Badges, comma separated"
                  value={draft.badges}
                  onChange={(event) => setDraft({ ...draft, badges: event.target.value })}
                />
                <input
                  placeholder="Variants, comma separated"
                  value={draft.variants || ""}
                  onChange={(event) => setDraft({ ...draft, variants: event.target.value })}
                />
                <input
                  placeholder="Face shapes"
                  value={draft.faceShapes}
                  onChange={(event) => setDraft({ ...draft, faceShapes: event.target.value })}
                />
                <input
                  placeholder="Lifestyle categories"
                  value={draft.lifestyle}
                  onChange={(event) => setDraft({ ...draft, lifestyle: event.target.value })}
                />
              </div>
              <div className="toggle-row compact-toggles">
                {[
                  ["prescriptionReady", "Prescription-ready"],
                  ["polarized", "Polarized"],
                  ["blueLight", "Blue-light"]
                ].map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={Boolean(draft[key])}
                      onChange={(event) => setDraft({ ...draft, [key]: event.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <textarea
                placeholder="Product description"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
              <textarea
                placeholder="Technical details"
                value={draft.technical}
                onChange={(event) => setDraft({ ...draft, technical: event.target.value })}
              />
              <div className="admin-form-grid">
                <input
                  placeholder="SEO title"
                  value={draft.seoTitle}
                  onChange={(event) => setDraft({ ...draft, seoTitle: event.target.value })}
                />
                <input
                  placeholder="Meta description"
                  value={draft.metaDescription}
                  onChange={(event) => setDraft({ ...draft, metaDescription: event.target.value })}
                />
              </div>
              <label className="media-upload">
                <ImageIcon size={17} />
                Upload product images / 3D assets
                <input type="file" multiple accept="image/*" onChange={(event) => handleProductMedia(event.target.files)} />
              </label>
              <div className="admin-action-row">
                <button className="gold-button">
                  <Plus size={16} /> {editingProductId ? "Save product" : "Create product"}
                </button>
                {editingProductId && (
                  <button className="secondary-button" type="button" onClick={resetProductDraft}>
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
            <div className="admin-list">
              {products.map((product) => (
                <div key={product.id}>
                  <img src={product.image} alt="" />
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.type} / {product.stock} in stock / {money(product.price)}</small>
                  </span>
                  <button aria-label="Edit product" onClick={() => fillDraftFromProduct(product)}>
                    <Edit3 size={15} />
                  </button>
                  <button
                    aria-label="Delete product"
                    onClick={() => setProducts((items) => items.filter((item) => item.id !== product.id))}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </AdminPanel>}

          {showPanel("Orders") && <AdminPanel title="Order management" action="Download CSV" onAction={exportOrders}>
            <div className="crm-toolbar order-toolbar">
              <label>
                <Search size={16} />
                <input
                  value={orderQuery}
                  onChange={(event) => setOrderQuery(event.target.value)}
                  placeholder="Search order, customer, product, or Rx"
                />
              </label>
              <select value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)}>
                <option>All orders</option>
                {orderStatuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </div>
            <div className="order-workspace">
              <div className="order-table order-list" aria-label="Order list">
                {filteredOrders.map((order) => (
                  <button
                    type="button"
                    key={order.id}
                    className={selectedOrder?.id === order.id ? "selected" : ""}
                    onClick={() => setSelectedOrderId(order.id)}
                  >
                    <span><strong>{order.id}</strong><small>{order.date}</small></span>
                    <span><strong>{order.customer}</strong><small>{order.product}</small></span>
                    <span><strong>{money(order.total)}</strong><small>{order.prescription}</small></span>
                    <b data-status={order.status}>{order.status}</b>
                  </button>
                ))}
                {!filteredOrders.length && <p className="empty-state">No orders match this view.</p>}
              </div>
              {selectedOrder && (
                <aside className="order-profile">
                  <div className="order-profile-head">
                    <div>
                      <span>ORDER</span>
                      <h3>{selectedOrder.id}</h3>
                    </div>
                    <b data-status={selectedOrder.status}>{selectedOrder.status}</b>
                  </div>
                  <dl>
                    <div><dt>Customer</dt><dd>{selectedOrder.customer}</dd></div>
                    <div><dt>Contact</dt><dd>{selectedOrder.email}<small>{selectedOrder.phone}</small></dd></div>
                    <div><dt>Products</dt><dd>{selectedOrder.product}</dd></div>
                    <div><dt>Total</dt><dd>{money(selectedOrder.total)}</dd></div>
                    <div><dt>Prescription</dt><dd>{selectedOrder.prescription}</dd></div>
                    <div><dt>Delivery</dt><dd>{selectedOrder.shipping}<small>{selectedOrder.deliveryAddress}</small></dd></div>
                    <div><dt>Payment</dt><dd>{selectedOrder.payment}</dd></div>
                  </dl>
                  <label>
                    Fulfillment status
                    <select value={selectedOrder.status} onChange={(event) => updateOrderStatus(selectedOrder.id, event.target.value)}>
                      {orderStatuses.map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                  <label>
                    Internal note
                    <textarea
                      value={selectedOrder.note || ""}
                      onChange={(event) => setOrders((items) => items.map((order) => (
                        order.id === selectedOrder.id ? { ...order, note: event.target.value } : order
                      )))}
                    />
                  </label>
                  {!["Completed", "Cancelled"].includes(selectedOrder.status) && (
                    <button
                      type="button"
                      className="primary-button"
                      data-testid="advance-order"
                      onClick={() => {
                        const currentIndex = orderStatuses.indexOf(selectedOrder.status);
                        const nextStatus = orderStatuses[Math.min(4, Math.max(0, currentIndex + 1))];
                        updateOrderStatus(selectedOrder.id, nextStatus);
                      }}
                    >
                      Advance to next stage <ChevronRight size={16} />
                    </button>
                  )}
                </aside>
              )}
            </div>
          </AdminPanel>}

          {showPanel("Customers") && <AdminPanel title="Customer relationships" action={`${filteredCustomers.length} records`}>
            <div className="crm-toolbar">
              <label>
                <Search size={16} />
                <input
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="Search name, email, segment, or Rx status"
                />
              </label>
              <select value={customerSegment} onChange={(event) => setCustomerSegment(event.target.value)}>
                <option>All customers</option>
                {[...new Set(customers.map((customer) => customer.segment))].map((segment) => (
                  <option key={segment}>{segment}</option>
                ))}
              </select>
            </div>
            <div className="crm-layout">
              <div className="customer-table" aria-label="Customer list">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    className={selectedCustomer?.id === customer.id ? "selected" : ""}
                    onClick={() => setSelectedCustomerId(customer.id)}
                  >
                    <span className="customer-avatar">{customer.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                    <span>
                      <strong>{customer.name}</strong>
                      <small>{customer.email}</small>
                    </span>
                    <span>
                      <strong>{money(customer.spend)}</strong>
                      <small>{customer.orders} order{customer.orders === 1 ? "" : "s"}</small>
                    </span>
                    <b data-status={customer.status}>{customer.status}</b>
                  </button>
                ))}
                {!filteredCustomers.length && <p className="empty-state">No customer matches this view.</p>}
              </div>
              {selectedCustomer && (
                <aside className="customer-profile">
                  <div className="customer-profile-head">
                    <span className="customer-avatar large">{selectedCustomer.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                    <div>
                      <h3>{selectedCustomer.name}</h3>
                      <p>{selectedCustomer.email}</p>
                    </div>
                  </div>
                  <dl>
                    <div><dt>Segment</dt><dd>{selectedCustomer.segment}</dd></div>
                    <div><dt>Last order</dt><dd>{selectedCustomer.lastOrder}</dd></div>
                    <div><dt>Lifetime value</dt><dd>{money(selectedCustomer.spend)}</dd></div>
                    <div><dt>Prescription</dt><dd>{selectedCustomer.prescription}</dd></div>
                  </dl>
                  <label>
                    Relationship status
                    <select
                      value={selectedCustomer.status}
                      onChange={(event) => setCustomers((items) => items.map((customer) => customer.id === selectedCustomer.id ? { ...customer, status: event.target.value } : customer))}
                    >
                      <option>Active</option>
                      <option>Follow-up</option>
                      <option>Needs review</option>
                      <option>VIP</option>
                    </select>
                  </label>
                  <label>
                    Client note
                    <textarea
                      value={selectedCustomer.note}
                      onChange={(event) => setCustomers((items) => items.map((customer) => customer.id === selectedCustomer.id ? { ...customer, note: event.target.value } : customer))}
                    />
                  </label>
                  <button className="primary-button" type="button" onClick={() => openCustomerOrders(selectedCustomer)}>View related orders</button>
                </aside>
              )}
            </div>
          </AdminPanel>}

          {showPanel("Settings") && <AdminPanel title="Homepage CMS" action="Preview storefront" onAction={() => navigate("home")}>
            <div className="admin-form">
              {Object.entries(homepageContent).map(([key, value]) => (
                <label key={key}>
                  {key.replace(/([A-Z])/g, " $1")}
                  <input value={value} onChange={(event) => setHomepageContent({ ...homepageContent, [key]: event.target.value })} />
                </label>
              ))}
              <div className="toggle-row">
                {["Hero", "Featured products", "Reviews", "Banners", "Promotional blocks"].map((section) => (
                  <label key={section}>
                    <input type="checkbox" defaultChecked />
                    {section}
                  </label>
                ))}
              </div>
              <button className="primary-button" type="button" data-testid="save-homepage" onClick={() => setAdminNotice("Homepage content saved.") }>
                <Check size={16} /> Save homepage
              </button>
            </div>
          </AdminPanel>}

          {showPanel("Prescriptions") && <AdminPanel title="Prescription management" action="View uploads">
            <div className="admin-list compact">
              {lensPackages.map((item) => (
                <div key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.detail}</small>
                  </span>
                  <b>{money(item.price)}</b>
                </div>
              ))}
              {coatings.slice(0, 4).map((item) => (
                <div key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>Upgrade price and availability</small>
                  </span>
                  <b>{money(item.price)}</b>
                </div>
              ))}
            </div>
          </AdminPanel>}

          {showPanel("Content") && <AdminPanel title="Content CMS" action="New guide">
            <form className="admin-form content-editor" onSubmit={addPage}>
              <div className="admin-form-grid">
                <input
                  placeholder="Page, blog, guide, FAQ, or policy title"
                  value={pageDraft.title}
                  onChange={(event) => setPageDraft({ ...pageDraft, title: event.target.value })}
                />
                <select value={pageDraft.type} onChange={(event) => setPageDraft({ ...pageDraft, type: event.target.value })}>
                  <option>Guide</option>
                  <option>Blog</option>
                  <option>Page</option>
                  <option>Policy</option>
                  <option>FAQ</option>
                </select>
                <select value={pageDraft.status} onChange={(event) => setPageDraft({ ...pageDraft, status: event.target.value })}>
                  <option>Draft</option>
                  <option>Published</option>
                  <option>Scheduled</option>
                </select>
              </div>
              <input
                placeholder="SEO summary or FAQ answer"
                value={pageDraft.seo}
                onChange={(event) => setPageDraft({ ...pageDraft, seo: event.target.value })}
              />
              <button className="gold-button">
                <Plus size={16} /> Create content
              </button>
            </form>
            <div className="content-list">
              {posts.map((post) => (
                <article key={post.title}>
                  <span>{post.category || "Blog"}</span>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                </article>
              ))}
              {pages.map((pageItem) => (
                <article key={pageItem.title}>
                  <span>{pageItem.type}</span>
                  <h3>{pageItem.title}</h3>
                  <p>{pageItem.status} / {pageItem.seo}</p>
                </article>
              ))}
              {faqs.map((faq) => (
                <article key={faq.question}>
                  <span>FAQ</span>
                  <h3>{faq.question}</h3>
                  <p>{faq.answer}</p>
                </article>
              ))}
            </div>
          </AdminPanel>}

          {showPanel("Media") && <AdminPanel title="Media CMS" action={`${mediaLibrary.length} assets`}>
            <label className="media-upload">
              <ImageIcon size={17} />
              Upload images, videos, icons, product renders, or 3D previews
              <input type="file" multiple accept="image/*,video/*" onChange={(event) => handleMediaUpload(event.target.files)} />
            </label>
            <div className="media-grid">
              {mediaLibrary.map((asset) => (
                <article key={`${asset.folder}-${asset.name}`}>
                  {asset.url?.startsWith("data:image") || asset.url?.endsWith(".png") ? <img src={asset.url} alt="" /> : <ImageIcon size={22} />}
                  <strong>{asset.name}</strong>
                  <span>{asset.folder} / {asset.type}</span>
                  <button
                    className="media-delete"
                    type="button"
                    aria-label={`Delete ${asset.name}`}
                    onClick={() => {
                      setMediaLibrary((items) => items.filter((item) => item.name !== asset.name));
                      setAdminNotice(`${asset.name} removed.`);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </article>
              ))}
            </div>
          </AdminPanel>}

          {showPanel("SEO") && <AdminPanel title="SEO CMS" action="Generate sitemap" onAction={generateSitemap}>
            <div className="admin-form">
              {Object.entries(seo).map(([key, value]) => (
                <label key={key}>
                  {key.replace(/([A-Z])/g, " $1")}
                  {typeof value === "boolean" ? (
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) => setSeo({ ...seo, [key]: event.target.checked })}
                    />
                  ) : (
                    <input value={value} onChange={(event) => setSeo({ ...seo, [key]: event.target.value })} />
                  )}
                </label>
              ))}
              <div className="schema-list">
                {["Product schema", "FAQ schema", "Breadcrumb schema", "Clean URLs", "Blog SEO"].map((item) => (
                  <span key={item}>
                    <Check size={15} /> {item}
                  </span>
                ))}
              </div>
            </div>
          </AdminPanel>}

          {showPanel("Marketing") && <AdminPanel title="Marketing CMS" action="Create campaign">
            <form className="admin-form" onSubmit={addCampaign}>
              <div className="admin-form-grid">
                <input
                  placeholder="Discount code"
                  value={campaignDraft.code}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, code: event.target.value.toUpperCase() })}
                />
                <input
                  placeholder="Value"
                  value={campaignDraft.value}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, value: event.target.value })}
                />
                <input
                  placeholder="Scope"
                  value={campaignDraft.scope}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, scope: event.target.value })}
                />
                <select
                  value={campaignDraft.channel}
                  onChange={(event) => setCampaignDraft({ ...campaignDraft, channel: event.target.value })}
                >
                  <option>Homepage banner</option>
                  <option>Popup</option>
                  <option>Email</option>
                  <option>Abandoned cart</option>
                  <option>Landing page</option>
                </select>
              </div>
              <button className="gold-button">
                <Plus size={16} /> Add campaign
              </button>
            </form>
            <div className="discount-list">
              {discounts.map((discount, index) => (
                <div key={discount.code}>
                  <strong>{discount.code}</strong>
                  <span>{discount.value} / {discount.scope} / {discount.channel}</span>
                  <label>
                    <input
                      type="checkbox"
                      checked={discount.active}
                      onChange={(event) =>
                        setDiscounts((items) =>
                          items.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, active: event.target.checked } : item
                          )
                        )
                      }
                    />
                    Active
                  </label>
                </div>
              ))}
            </div>
            <div className="toggle-row">
              {["Popups", "Newsletter forms", "Seasonal banners", "Abandoned cart email"].map((item) => (
                <label key={item}>
                  <input type="checkbox" defaultChecked={item !== "Popups"} />
                  {item}
                </label>
              ))}
            </div>
          </AdminPanel>}

          {showPanel("Analytics") && <AdminPanel title="Analytics" action="Connect pixels">
            <div className="admin-form-grid">
              <input
                placeholder="Google Analytics ID"
                value={analyticsConfig.googleAnalyticsId}
                onChange={(event) => setAnalyticsConfig({ ...analyticsConfig, googleAnalyticsId: event.target.value })}
              />
              <input
                placeholder="Meta Pixel ID"
                value={analyticsConfig.metaPixelId}
                onChange={(event) => setAnalyticsConfig({ ...analyticsConfig, metaPixelId: event.target.value })}
              />
            </div>
            <div className="toggle-row compact-toggles">
              {[
                ["trackProductViews", "Product views"],
                ["trackCart", "Add-to-cart"],
                ["trackCheckout", "Checkout"],
                ["trackPrescriptionUpload", "Prescription upload"],
                ["trackNewsletter", "Newsletter"]
              ].map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={analyticsConfig[key]}
                    onChange={(event) => setAnalyticsConfig({ ...analyticsConfig, [key]: event.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="analytics-grid">
              {analyticsEvents.map((event) => (
                <span key={event}>
                  <Activity size={14} /> {event}
                </span>
              ))}
            </div>
            <div className="event-log">
              {(events.length ? events : [{ label: "Waiting for storefront events", time: "--:--" }]).map((event) => (
                <div key={`${event.label}-${event.time}`}>
                  <span>{event.label}</span>
                  <small>{event.time}</small>
                </div>
              ))}
            </div>
          </AdminPanel>}

          {showPanel("Roles") && <AdminPanel title="Roles and permissions" action={`${team.length} users`}>
            <div className="team-list">
              {team.map((member) => (
                <div key={member.name}>
                  <strong>{member.name}</strong>
                  <select
                    value={member.role}
                    onChange={(event) =>
                      setTeam((items) =>
                        items.map((item) => (item.name === member.name ? { ...item, role: event.target.value } : item))
                      )
                    }
                  >
                    {roleMatrix.map((role) => (
                      <option key={role.role}>{role.role}</option>
                    ))}
                  </select>
                  <span>{member.status}</span>
                </div>
              ))}
            </div>
            <div className="role-list">
              {roleMatrix.map((role) => (
                <div key={role.role}>
                  <strong>{role.role}</strong>
                  <span>{role.permissions}</span>
                </div>
              ))}
            </div>
          </AdminPanel>}
        </div>
      </div>
    </section>
  );
}

function AdminPanel({ title, action, onAction, children }) {
  return (
    <article className="admin-panel">
      <div className="admin-panel-head">
        <h2>{title}</h2>
        {action && (onAction ? (
          <button onClick={onAction}>
            {action} <ChevronRight size={14} />
          </button>
        ) : (
          <span className="admin-panel-meta">{action}</span>
        ))}
      </div>
      {children}
    </article>
  );
}

function FitStudioPage({ products, selectedProduct, navigate, addToCart, wishlist, toggleWishlist, compare, toggleCompare, trackEvent }) {
  const sunglasses = useMemo(
    () => products.filter((product) => product.type === "Sunglasses" && product.virtualTryOnEnabled !== false),
    [products]
  );
  const initialProduct = sunglasses.find((product) => product.id === selectedProduct?.id) || sunglasses[0];
  const [selectedId, setSelectedId] = useState(initialProduct?.id || "");
  const [activeTool, setActiveTool] = useState("try");
  const activeProduct = sunglasses.find((product) => product.id === selectedId) || initialProduct;
  const fitPathname = window.location.pathname;

  useEffect(() => {
    if (selectedProduct?.type === "Sunglasses") setSelectedId(selectedProduct.id);
  }, [selectedProduct]);

  useEffect(() => {
    setActiveTool(fitPathname === "/matje-online" ? "measure" : "try");
  }, [fitPathname]);

  if (!activeProduct) {
    return (
      <section className="page-section fit-studio-page">
        <div className="fit-vto-unavailable">
          <Camera size={30} />
          <h1>Prova 3D po përgatitet.</h1>
          <p>Aktualisht nuk ka model të aktivizuar për provë virtuale. Shikoni fotografitë e produkteve ose rezervoni një përshtatje profesionale në optikë.</p>
          <div><button className="primary-button" onClick={() => navigate("shop")}>Shiko kornizat</button><button className="secondary-button" onClick={() => navigate("contact")}>Rezervo përshtatjen</button></div>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section fit-studio-page">
      {activeTool === "try" && <h1 className="sr-only">Provo syzet virtualisht në 3D</h1>}
      <div className="fit-tool-tabs" id="fit-tools" role="tablist" aria-label="Mjetet e Fit Studio">
        <button
          className={activeTool === "try" ? "active" : ""}
          onClick={() => setActiveTool("try")}
          role="tab"
          aria-selected={activeTool === "try"}
        >
          <Camera size={20} />
          <span><strong>Provo syzet</strong><small>Kamerë · foto · model</small></span>
        </button>
        <button
          className={activeTool === "measure" ? "active" : ""}
          onClick={() => setActiveTool("measure")}
          role="tab"
          aria-selected={activeTool === "measure"}
        >
          <Ruler size={20} />
          <span><strong>Mat fytyrën</strong><small>Orientim për masën</small></span>
        </button>
      </div>

      {activeTool === "measure" && (
        <section className="measurement-intro" aria-labelledby="measurement-title">
          <div>
            <span className="brand-eyebrow">MATJE ORIENTUESE ONLINE</span>
            <h1 id="measurement-title">Cila masë ju përshtatet?</h1>
            <p>Zgjidhni një fotografi ballore me një kartë standarde, duke mbuluar çdo të dhënë personale në kartë. Rezultati ndihmon në zgjedhjen e madhësisë dhe verifikohet nga optiku para porosisë.</p>
          </div>
          <div className="measurement-intro-trust" aria-label="Privatësia dhe saktësia">
            <span><LockKeyhole size={16} /><b>Në pajisjen tuaj</b><small>Fotografia nuk ngarkohet</small></span>
            <span><Ruler size={16} /><b>85.60 mm</b><small>Kartë standarde</small></span>
            <span><ShieldCheck size={16} /><b>Verifikim optik</b><small>Para punimit final</small></span>
          </div>
        </section>
      )}

      {activeTool === "try" ? (
        <Suspense fallback={<div className="vto3d-loading-shell" role="status">Duke ngarkuar provën 3D…</div>}>
          <VirtualTryOn3D
            sunglasses={sunglasses}
            activeProduct={activeProduct}
            setSelectedId={setSelectedId}
            navigate={navigate}
            openMeasurement={() => setActiveTool("measure")}
            addToCart={addToCart}
            wishlist={wishlist}
            toggleWishlist={toggleWishlist}
            compare={compare}
            toggleCompare={toggleCompare}
            trackEvent={trackEvent}
          />
        </Suspense>
      ) : (
        <OnlineMeasurement
          activeProduct={activeProduct}
          navigate={navigate}
          openTryOn={() => setActiveTool("try")}
        />
      )}

      <div className="fit-how-grid" id="how-it-works">
        {[
          ["01", "Dritë e mirë", "Qëndroni përballë një dritareje, hiqni syzet dhe mbajeni kamerën drejt me fytyrën."],
          ["02", "Pozicion i saktë", "Për matje, mbajeni kartën horizontalisht në të njëjtin plan me fytyrën, jo më afër kamerës."],
          ["03", "Konfirmim optik", "Ruani vlerësimin si pikënisje; PD-ja e recetës dhe centrimi final verifikohen nga profesionisti."]
        ].map(([number, title, copy]) => (
          <article key={number}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>

      <div className="fit-clinical-note">
        <ShieldCheck size={24} />
        <div>
          <strong>Një mjet për zgjedhjen e kornizës, jo ekzaminim mjekësor.</strong>
          <p>
            Matjet nga fotografia janë vlerësime dhe varen nga këndi, distanca dhe vendosja e kartës.
            Mos i përdorni për të prodhuar thjerrëza pa verifikim profesional të PD-së, recetës dhe centrimit.
          </p>
        </div>
        <button className="secondary-button" onClick={() => navigate("contact")}>Rezervo verifikimin</button>
      </div>
    </section>
  );
}

const tryOnCutoutCache = new Map();

const createTryOnCutout = (source) => new Promise((resolve, reject) => {
  if (!source) {
    reject(new Error("Missing product image"));
    return;
  }
  if (tryOnCutoutCache.has(source)) {
    resolve(tryOnCutoutCache.get(source));
    return;
  }
  const image = new Image();
  if (/^https?:/i.test(source)) image.crossOrigin = "anonymous";
  image.onload = () => {
    try {
      const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = Math.min(1, 1200 / Math.max(1, longestSide));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0, width, height);
      const pixels = context.getImageData(0, 0, width, height);
      const data = pixels.data;
      let alreadyTransparent = 0;
      const sample = { r: 0, g: 0, b: 0, count: 0 };
      const border = Math.max(2, Math.round(Math.min(width, height) * 0.025));

      for (let y = 0; y < height; y += Math.max(1, Math.round(height / 80))) {
        for (let x = 0; x < width; x += Math.max(1, Math.round(width / 80))) {
          const index = (y * width + x) * 4;
          if (data[index + 3] < 235) alreadyTransparent += 1;
        }
      }

      const hasTransparency = alreadyTransparent > 12;
      if (!hasTransparency) {
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (x >= border && x < width - border && y >= border && y < height - border) continue;
            const index = (y * width + x) * 4;
            sample.r += data[index];
            sample.g += data[index + 1];
            sample.b += data[index + 2];
            sample.count += 1;
          }
        }
        const background = {
          r: sample.r / Math.max(1, sample.count),
          g: sample.g / Math.max(1, sample.count),
          b: sample.b / Math.max(1, sample.count)
        };
        for (let index = 0; index < data.length; index += 4) {
          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];
          const distance = Math.sqrt(
            ((red - background.r) ** 2)
            + ((green - background.g) ** 2)
            + ((blue - background.b) ** 2)
          );
          const brightness = (red + green + blue) / 3;
          const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
          let alpha = data[index + 3];
          if (distance <= 18) alpha = 0;
          else if (distance < 68) alpha = Math.round(alpha * ((distance - 18) / 50));
          if (brightness > 238 && chroma < 30) {
            alpha = Math.min(alpha, Math.max(0, Math.round((255 - brightness) * 15)));
          }
          data[index + 3] = alpha;
        }
        context.putImageData(pixels, 0, 0);
      }

      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (data[(y * width + x) * 4 + 3] < 28) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      if (minX >= maxX || minY >= maxY) {
        resolve(source);
        return;
      }
      const cropWidth = maxX - minX + 1;
      const cropHeight = maxY - minY + 1;
      const padding = Math.max(8, Math.round(Math.max(cropWidth, cropHeight) * 0.035));
      const output = document.createElement("canvas");
      output.width = cropWidth + padding * 2;
      output.height = cropHeight + padding * 2;
      output.getContext("2d").drawImage(
        canvas,
        minX,
        minY,
        cropWidth,
        cropHeight,
        padding,
        padding,
        cropWidth,
        cropHeight
      );
      const cutout = output.toDataURL("image/png");
      tryOnCutoutCache.set(source, cutout);
      resolve(cutout);
    } catch (error) {
      reject(error);
    }
  };
  image.onerror = () => reject(new Error("Product image could not be prepared"));
  image.src = source;
});

function VirtualTryOn({ sunglasses, activeProduct, setSelectedId, navigate, openMeasurement }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const photoInputRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [posePhotos, setPosePhotos] = useState({ front: "", left: "", right: "" });
  const [cameraError, setCameraError] = useState("");
  const [poseAlignments, setPoseAlignments] = useState({
    front: { scale: 54, left: 50, top: 40, rotation: 0 },
    left: { scale: 52, left: 53, top: 40, rotation: -2 },
    right: { scale: 52, left: 47, top: 40, rotation: 2 }
  });
  const [frameOpacity, setFrameOpacity] = useState(94);
  const [viewAngle, setViewAngle] = useState("front");
  const [alignmentMode, setAlignmentMode] = useState(false);
  const [overlaySrc, setOverlaySrc] = useState("/assets/assembly/visionaire-sunglasses-clean.webp");
  const [overlayPreparing, setOverlayPreparing] = useState(false);

  const poseOrder = ["front", "left", "right"];
  const poseCopy = {
    front: { number: "01", label: "Përballë", action: "përballë", instruction: "Mbajeni fytyrën drejt dhe shikoni kamerën." },
    left: { number: "02", label: "Profili majtas", action: "nga e majta", instruction: "Kthejeni kokën ngadalë majtas, me veshin ende të dukshëm." },
    right: { number: "03", label: "Profili djathtas", action: "nga e djathta", instruction: "Kthejeni kokën ngadalë djathtas, me veshin ende të dukshëm." }
  };
  const photoData = posePhotos[viewAngle];
  const capturedPoseCount = poseOrder.filter((pose) => Boolean(posePhotos[pose])).length;
  const hasAnyPose = capturedPoseCount > 0;
  const currentAlignment = poseAlignments[viewAngle];
  const frameScale = currentAlignment.scale;
  const frameLeft = currentAlignment.left;
  const frameTop = currentAlignment.top;
  const frameRotation = currentAlignment.rotation;
  const updateCurrentAlignment = (key, value) => {
    setPoseAlignments((current) => ({
      ...current,
      [viewAngle]: { ...current[viewAngle], [key]: value }
    }));
  };
  const setFrameScale = (value) => updateCurrentAlignment("scale", value);
  const setFrameLeft = (value) => updateCurrentAlignment("left", value);
  const setFrameTop = (value) => updateCurrentAlignment("top", value);
  const setFrameRotation = (value) => updateCurrentAlignment("rotation", value);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    let active = true;
    setOverlayPreparing(true);
    setOverlaySrc("");
    createTryOnCutout(activeProduct?.image)
      .then((source) => {
        if (!active) return;
        setOverlaySrc(source);
        setOverlayPreparing(false);
      })
      .catch(() => {
        if (!active) return;
        setOverlaySrc("/assets/assembly/visionaire-sunglasses-clean.webp");
        setOverlayPreparing(false);
      });
    const productWidth = Number(activeProduct?.frameWidth || 138);
    const productScale = Math.max(46, Math.min(62, Math.round(53 + (productWidth - 138) * 0.16)));
    setPoseAlignments({
      front: { scale: productScale, left: 50, top: 40, rotation: 0 },
      left: { scale: Math.max(42, productScale - 2), left: 53, top: 40, rotation: -2 },
      right: { scale: Math.max(42, productScale - 2), left: 47, top: 40, rotation: 2 }
    });
    return () => { active = false; };
  }, [activeProduct?.id, activeProduct?.image, activeProduct?.frameWidth]);

  const resetAlignment = () => {
    const productWidth = Number(activeProduct?.frameWidth || 138);
    const productScale = Math.max(46, Math.min(62, Math.round(53 + (productWidth - 138) * 0.16)));
    const defaults = {
      front: { scale: productScale, left: 50, top: 40, rotation: 0 },
      left: { scale: Math.max(42, productScale - 2), left: 53, top: 40, rotation: -2 },
      right: { scale: Math.max(42, productScale - 2), left: 47, top: 40, rotation: 2 }
    };
    setPoseAlignments((current) => ({ ...current, [viewAngle]: defaults[viewAngle] }));
  };

  const startCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Kamera nuk mbështetet nga ky shfletues. Përdorni opsionin Ngarko selfie.");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false
      });
      streamRef.current = stream;
      setPosePhotos((current) => ({ ...current, [viewAngle]: "" }));
      setCameraActive(true);
    } catch {
      setCameraError("Kamera nuk u hap. Lejoni aksesin në shfletues ose ngarkoni një selfie.");
    }
  };

  const usePhoto = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCameraError("Zgjidhni një fotografi JPG, PNG ose WEBP.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setCameraError("Fotografia duhet të jetë më e vogël se 12 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      stopCamera();
      setPosePhotos((current) => ({ ...current, [viewAngle]: String(reader.result || "") }));
      setCameraError("");
      resetAlignment();
      setAlignmentMode(true);
    };
    reader.readAsDataURL(file);
  };

  const captureCamera = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) {
      setCameraError("Prisni një moment që kamera të fokusohet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPosePhotos((current) => ({ ...current, [viewAngle]: canvas.toDataURL("image/jpeg", 0.9) }));
    stopCamera();
    resetAlignment();
    setAlignmentMode(true);
  };

  const hasFaceSource = cameraActive || Boolean(photoData);
  const viewConfiguration = {
    left: { label: "Majtas", perspective: "perspective(900px) rotateY(28deg) scaleX(0.92)" },
    front: { label: "Përballë", perspective: "perspective(900px) rotateY(0deg) scaleX(1)" },
    right: { label: "Djathtas", perspective: "perspective(900px) rotateY(-28deg) scaleX(0.92)" }
  }[viewAngle];

  const alignFromStage = (event) => {
    if (!photoData || !alignmentMode) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const left = ((event.clientX - bounds.left) / bounds.width) * 100;
    const top = ((event.clientY - bounds.top) / bounds.height) * 100;
    setFrameLeft(Math.round(Math.max(12, Math.min(88, left))));
    setFrameTop(Math.round(Math.max(18, Math.min(68, top))));
    setAlignmentMode(false);
  };

  return (
    <div className="fit-workspace" id="try-studio">
      <div className="tryon-panel">
        <div
          className={`tryon-stage ${hasFaceSource ? "has-source" : ""} ${alignmentMode ? "is-aligning" : ""}`}
          data-view={viewAngle}
          onPointerDown={alignFromStage}
        >
          {cameraActive && <video ref={videoRef} className="tryon-video" autoPlay playsInline muted />}
          {photoData && <img className="tryon-photo" src={photoData} alt="Selfie e zgjedhur për provën virtuale" />}
          {!hasFaceSource && (
            <div className="tryon-placeholder">
              <div className="face-guide"><span /><i /><b /></div>
              <Camera size={34} />
              <strong>{posePhotos[viewAngle] ? "Pamja është gati" : `Fotografoni: ${poseCopy[viewAngle].label}`}</strong>
              <span>{poseCopy[viewAngle].instruction} Dritë natyrale · pa syze.</span>
            </div>
          )}
          {hasAnyPose && (
            <div className="tryon-angle-toolbar" onPointerDown={(event) => event.stopPropagation()}>
              <span><b>3X</b> {capturedPoseCount}/3 pamje reale</span>
              <div role="group" aria-label="Zgjidh fotografinë e fytyrës">
                {[
                  ["front", "Përballë"],
                  ["left", "Majtas"],
                  ["right", "Djathtas"]
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={`${viewAngle === value ? "active" : ""} ${posePhotos[value] ? "complete" : ""}`}
                    aria-pressed={viewAngle === value}
                    onClick={() => {
                      stopCamera();
                      setViewAngle(value);
                      setAlignmentMode(false);
                    }}
                  >
                    {label}{posePhotos[value] ? " ✓" : " +"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {hasFaceSource && (
            <>
              <div className="face-alignment-guide" aria-hidden="true"><span /><i /></div>
              {overlaySrc ? (
                <img
                  className="virtual-frame-overlay"
                  src={overlaySrc}
                  alt={`Simulim i ${activeProduct?.name || "kornizës"} mbi fytyrë`}
                  style={{
                    width: `${frameScale}%`,
                    left: `${frameLeft}%`,
                    top: `${frameTop}%`,
                    opacity: frameOpacity / 100,
                    transform: `translate(-50%, -50%) rotate(${frameRotation}deg) ${viewConfiguration.perspective}`
                  }}
                />
              ) : (
                <div className="tryon-overlay-loader"><RefreshCw size={20} /><span>Po sinkronizohet {activeProduct?.name}</span></div>
              )}
            </>
          )}
          {photoData && (
            <div className="tryon-model-chip">
              <span>{overlayPreparing ? "DUKE PËRGATITUR" : "MODEL I SINKRONIZUAR"}</span>
              <strong>{activeProduct?.name}</strong>
              <small>{viewConfiguration.label} · foto reale e klientit</small>
            </div>
          )}
          {photoData && alignmentMode && (
            <div className="tryon-alignment-prompt">
              <b>01</b>
              <span><strong>Klikoni te ura e hundës</strong><small>Korniza do të qendërzohet mes syve.</small></span>
            </div>
          )}
          <div className="tryon-privacy"><LockKeyhole size={14} /> Përpunohet vetëm në pajisjen tuaj</div>
        </div>

        <div className="tryon-pose-strip" aria-label="Tre fotografitë e provës virtuale">
          {poseOrder.map((pose) => (
            <button
              type="button"
              key={pose}
              className={`${viewAngle === pose ? "active" : ""} ${posePhotos[pose] ? "complete" : ""}`}
              onClick={() => {
                stopCamera();
                setViewAngle(pose);
                setAlignmentMode(false);
              }}
            >
              {posePhotos[pose] ? (
                <img src={posePhotos[pose]} alt="" />
              ) : (
                <b>{poseCopy[pose].number}</b>
              )}
              <span>
                <strong>{poseCopy[pose].label}</strong>
                <small>{posePhotos[pose] ? "Foto gati" : "Shto fotografinë"}</small>
              </span>
              <i aria-hidden="true">{posePhotos[pose] ? "✓" : "+"}</i>
            </button>
          ))}
        </div>

        <div className="tryon-source-actions">
          <button className="primary-button" onClick={cameraActive ? captureCamera : startCamera}>
            <Camera size={18} /> {cameraActive ? `Bëj foton ${poseCopy[viewAngle].action}` : `Kamera · ${poseCopy[viewAngle].label}`}
          </button>
          <button className="secondary-button" onClick={() => photoInputRef.current?.click()}>
            <ImageIcon size={18} /> Ngarko · {poseCopy[viewAngle].label}
          </button>
          {(hasAnyPose || cameraActive) && (
            <button
              className="quiet-button"
              onClick={() => {
                stopCamera();
                setPosePhotos({ front: "", left: "", right: "" });
                setViewAngle("front");
                setAlignmentMode(false);
              }}
            >
              <RefreshCw size={16} /> Pastro 3 pamjet
            </button>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              usePhoto(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
        {cameraError && <p className="fit-error" role="alert">{cameraError}</p>}
      </div>

      <aside className="fit-controls-panel">
        <div className="fit-selected-product">
          <img src={activeProduct?.image} alt="" />
          <div>
            <small>MODELI AKTIV · I SINKRONIZUAR</small>
            <strong>{activeProduct?.name}</strong>
            <span>{activeProduct?.frameWidth || "—"} mm · {activeProduct?.fitProfile || activeProduct?.size}</span>
          </div>
          <b>{activeProduct ? money(activeProduct.salePrice || activeProduct.price) : ""}</b>
        </div>

        <div className="tryon-adjustments">
          <div className="tryon-adjustment-head">
            <div><h3>Përshtate mbi fytyrë</h3><span>Qendra optike fillon te ura e hundës.</span></div>
            <b>{viewConfiguration.label}</b>
          </div>
          {photoData && (
            <div className="tryon-calibration-actions">
              <button
                type="button"
                className={alignmentMode ? "active" : ""}
                onClick={() => setAlignmentMode((current) => !current)}
              >
                <Ruler size={15} /> {alignmentMode ? "Klikoni në foto" : "Qendërzo urën"}
              </button>
              <button type="button" onClick={resetAlignment}><RefreshCw size={15} /> Rivendos</button>
            </div>
          )}
          <label>
            <span>Gjerësia <b>{frameScale}%</b></span>
            <input type="range" min="38" max="82" value={frameScale} disabled={!photoData} onChange={(event) => setFrameScale(Number(event.target.value))} />
          </label>
          <label>
            <span>Qendra horizontale <b>{frameLeft}%</b></span>
            <input type="range" min="12" max="88" value={frameLeft} disabled={!photoData} onChange={(event) => setFrameLeft(Number(event.target.value))} />
          </label>
          <label>
            <span>Pozicioni vertikal <b>{frameTop}%</b></span>
            <input type="range" min="18" max="68" value={frameTop} disabled={!photoData} onChange={(event) => setFrameTop(Number(event.target.value))} />
          </label>
          <label>
            <span>Rrotullimi <b>{frameRotation}°</b></span>
            <input type="range" min="-14" max="14" value={frameRotation} disabled={!photoData} onChange={(event) => setFrameRotation(Number(event.target.value))} />
          </label>
          <label>
            <span>Intensiteti <b>{frameOpacity}%</b></span>
            <input type="range" min="55" max="100" value={frameOpacity} disabled={!photoData} onChange={(event) => setFrameOpacity(Number(event.target.value))} />
          </label>
          {hasAnyPose && (
            <p className="tryon-angle-note">
              Çdo kënd përdor fotografinë reale të klientit dhe ruan përshtatjen e vet. Korniza mbetet një simulim 2D; PD-ja dhe centrimi final verifikohen në optikë.
            </p>
          )}
        </div>

        <div className="fit-model-picker">
          <div>
            <h3>Zgjidh modelin</h3>
            <span>Paraqitja është simulim i proporcionit dhe siluetës.</span>
          </div>
          <div className="fit-model-grid">
            {sunglasses.map((product) => (
              <button
                key={product.id}
                className={product.id === activeProduct?.id ? "active" : ""}
                onClick={() => {
                  setSelectedId(product.id);
                }}
                aria-label={`Provo ${product.name}`}
              >
                <img src={product.image} alt="" loading="lazy" />
                <span>{product.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="fit-next-actions">
          <button className="primary-button" onClick={() => navigate("product", activeProduct?.id)}>
            Shiko detajet e modelit <ChevronRight size={17} />
          </button>
          <button className="secondary-button" onClick={openMeasurement}>
            <Ruler size={17} /> Vazhdo me matjen
          </button>
        </div>
      </aside>
    </div>
  );
}

function OnlineMeasurement({ activeProduct, navigate, openTryOn }) {
  const measureInputRef = useRef(null);
  const photoLoadRef = useRef(0);
  const [photoData, setPhotoData] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoAspect, setPhotoAspect] = useState(1);
  const [markers, setMarkers] = useState(initialMeasurementMarkers);
  const [calibrationConfirmed, setCalibrationConfirmed] = useState(false);
  const [bridgeProfile, setBridgeProfile] = useState("medium");

  const updateMarker = (group, index, rawValue) => {
    setCalibrationConfirmed(false);
    const value = Number(rawValue);
    setMarkers((current) => {
      const next = [...current[group]];
      next[index] = index === 0
        ? Math.min(value, next[1] - 2)
        : Math.max(value, next[0] + 2);
      return { ...current, [group]: next };
    });
  };

  const results = useMemo(() => estimatePhotoDimensions(markers), [markers]);
  const measurementReady = Boolean(photoData && calibrationConfirmed && results);
  const bridgeNote = { narrow: 'Syzet zakonisht rrëshqasin', medium: 'Pa shqetësim të zakonshëm në urë', wide: 'Syzet zakonisht shtrëngojnë' }[bridgeProfile];

  const useMeasurementPhoto = (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Zgjidhni një fotografi JPG, PNG ose WEBP.");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setPhotoError("Fotografia duhet të jetë më e vogël se 12 MB.");
      return;
    }
    const loadId = ++photoLoadRef.current;
    setPhotoLoading(true);
    setPhotoError("");
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        if (loadId !== photoLoadRef.current) return;
        if (image.naturalWidth < 300 || image.naturalHeight < 300) {
          setPhotoError("Fotografia është shumë e vogël. Zgjidhni një foto të qartë, së paku 300 × 300 px.");
        } else {
          setPhotoData(String(reader.result || ""));
          setPhotoAspect(image.naturalWidth / image.naturalHeight);
          setMarkers(initialMeasurementMarkers());
          setCalibrationConfirmed(false);
        }
        setPhotoLoading(false);
      };
      image.onerror = () => { if (loadId === photoLoadRef.current) { setPhotoError("Nuk mundëm ta hapim fotografinë. Provoni një skedar tjetër JPG, PNG ose WEBP."); setPhotoLoading(false); } };
      image.src = String(reader.result || "");
    };
    reader.onerror = () => { if (loadId === photoLoadRef.current) { setPhotoError("Fotografia nuk u lexua. Provoni përsëri."); setPhotoLoading(false); } };
    reader.readAsDataURL(file);
  };

  const sendMeasurement = () => {
    if (!measurementReady) return;
    trackPublicEvent("measurement_verification_request", {
      selected_model: activeProduct?.name || "Pa model"
    });
    openWhatsApp([
      "Përshëndetje Optika Miftari, bëra matjen orientuese në Fit Studio.",
      `Distanca e bebëzave në foto (jo PD për recetë): rreth ${results.pd.toFixed(0)} mm`,
      `Gjerësia e fytyrës: ${results.faceWidth.toFixed(0)} mm`,
      `Shënim për urën: ${bridgeNote}`,
      `Modeli që po shikoj: ${activeProduct?.name || "ende pa zgjedhur"}`,
      "Dëshiroj verifikim profesional para porosisë."
    ].join("\n"));
  };

  const downloadMeasurement = () => {
    if (!measurementReady) return;
    trackPublicEvent("measurement_report_download", {
      selected_model: activeProduct?.name || "Pa model"
    });
    const report = [
      "OPTIKA MIFTARI — PËRMBLEDHJE E MATJES ORIENTUESE",
      "",
      `Data: ${new Date().toLocaleDateString("en-GB")}`,
      `Distanca e bebëzave në foto: rreth ${results.pd.toFixed(0)} mm (jo PD për recetë)`,
      `Gjerësia e fytyrës: ${results.faceWidth.toFixed(0)} mm`,
      `Shënim për urën: ${bridgeNote}`,
      "Metoda: përpjesëtim i shënuesve manualë me një kartë 85.60 mm. Saktësia nuk është verifikuar.",
      `Modeli i zgjedhur: ${activeProduct?.name || "Pa model"}`,
      "",
      "Ky rezultat është orientues. PD-ja monokulare/binokulare, lartësia e montimit, receta dhe centrimi final duhet të verifikohen nga profesionisti."
    ].join("\n");
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "optika-miftari-matja-orientuese.txt";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const markerConfig = [
    { group: "face", index: 0, label: "Fytyra M", className: "face-marker" },
    { group: "card", index: 0, label: "Karta M", className: "card-marker" },
    { group: "pupils", index: 0, label: "Bebëza M", className: "pupil-marker" },
    { group: "pupils", index: 1, label: "Bebëza D", className: "pupil-marker" },
    { group: "card", index: 1, label: "Karta D", className: "card-marker" },
    { group: "face", index: 1, label: "Fytyra D", className: "face-marker" }
  ];
  const workflowStep = !photoData ? 1 : measurementReady ? 3 : 2;

  return (
    <div className="measurement-flow">
      <div className="measurement-stepper" aria-label="Hapat e matjes">
        {[
          ["01", "Fotografia", "Fytyrë drejt dhe kartë standarde"],
          ["02", "Shënuesit", "Kartë, bebëza dhe gjerësi fytyre"],
          ["03", "Vlerësimi", "Për diskutim me optikun"]
        ].map(([number, title, copy], index) => {
          const step = index + 1;
          return (
            <div key={number} className={`${workflowStep === step ? "active" : ""} ${workflowStep > step ? "complete" : ""}`}>
              <b>{workflowStep > step ? <Check size={14} /> : number}</b>
              <span><strong>{title}</strong><small>{copy}</small></span>
            </div>
          );
        })}
      </div>

      <div className="measurement-workspace">
        <div className="measurement-main">
        <div className="measurement-instruction">
          <Ruler size={23} />
          <div>
            <strong>Përdorni një kartë standarde me gjerësi 85.60 mm.</strong>
            <span>Mbajeni horizontalisht pranë fytyrës, pa e anuar dhe në të njëjtën largësi nga kamera. Mbuloni çdo emër, numër ose të dhënë personale në kartë.</span>
          </div>
        </div>

        <div className={`measurement-photo-stage ${photoData ? "has-photo" : ""}`} style={{ '--measurement-aspect': photoAspect }} aria-busy={photoLoading}>
          {photoData ? (
            <>
              <img src={photoData} alt="Foto për matjen e udhëzuar të fytyrës" />
              {markerConfig.map((marker) => (
                <span
                  key={`${marker.group}-${marker.index}`}
                  className={`measurement-marker ${marker.className}`}
                  style={{ left: `${markers[marker.group][marker.index]}%` }}
                >
                  <i>{marker.label}</i>
                </span>
              ))}
            </>
          ) : (
            <button className="measurement-upload-prompt" disabled={photoLoading} onClick={() => measureInputRef.current?.click()}>
              <UploadCloud size={34} />
              <strong>{photoLoading ? "Duke hapur fotografinë…" : "Ngarko fotografinë për matje"}</strong>
              <span>Fytyrë drejt · kartë horizontale · pa zmadhim · dritë e mirë</span>
            </button>
          )}
          <div className="tryon-privacy"><LockKeyhole size={14} /> Fotoja nuk largohet nga pajisja</div>
        </div>
        <div className="measurement-photo-actions">
          <button className="secondary-button" disabled={photoLoading} onClick={() => measureInputRef.current?.click()}>
            <ImageIcon size={18} /> {photoData ? "Ndrysho fotografinë" : "Zgjidh fotografinë"}
          </button>
          <input
            ref={measureInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => { useMeasurementPhoto(event.target.files?.[0]); event.target.value = ''; }}
          />
          {photoData && <button type="button" className="quiet-button" onClick={() => { photoLoadRef.current += 1; setPhotoData(''); setPhotoLoading(false); setCalibrationConfirmed(false); setMarkers(initialMeasurementMarkers()); setPhotoError(''); }}><Trash2 size={16} /> Hiq fotografinë</button>}
          {photoError && <span className="fit-error" role="alert">{photoError}</span>}
        </div>

        <div className="marker-controls">
          <div className="marker-controls-head">
            <div>
              <h3>Poziciononi 6 shënuesit</h3>
              <p>Pozicionet fillestare janë shembull, jo zbulim automatik. Vendosni secilin shënues sipas fotografisë.</p>
            </div>
            <div className="marker-legend">
              <span><i className="card-dot" /> Kartë</span>
              <span><i className="pupil-dot" /> Bebëza</span>
              <span><i className="face-dot" /> Fytyrë</span>
            </div>
          </div>
          {[
            ["card", "Skajet e kartës"],
            ["pupils", "Qendrat e bebëzave"],
            ["face", "Skajet e fytyrës"]
          ].map(([group, label]) => (
            <div className="dual-range-control" key={group}>
              <span>{label}</span>
              <label>
                Majtas
                <input
                  type="range"
                  min="3"
                  max="95"
                  step="0.5"
                  value={markers[group][0]}
                  disabled={!photoData || photoLoading}
                  aria-label={`${label} — shënuesi majtas`}
                  onChange={(event) => updateMarker(group, 0, event.target.value)}
                />
              </label>
              <label>
                Djathtas
                <input
                  type="range"
                  min="5"
                  max="97"
                  step="0.5"
                  value={markers[group][1]}
                  disabled={!photoData || photoLoading}
                  aria-label={`${label} — shënuesi djathtas`}
                  onChange={(event) => updateMarker(group, 1, event.target.value)}
                />
              </label>
            </div>
          ))}
          <label className="measurement-calibration-confirm"><input type="checkbox" checked={calibrationConfirmed} disabled={!photoData || photoLoading || !results} onChange={(event) => setCalibrationConfirmed(event.target.checked)} /><span>I kam vendosur të gjashtë shënuesit. Karta është 85.60 mm, e drejtë dhe në të njëjtin plan me fytyrën.</span></label>
          {photoData && !results && <p className="fit-error" role="status">Kontrolloni skajet e kartës dhe vendosni bebëzat brenda skajeve të fytyrës. Karta duhet të jetë mjaft e madhe në fotografi.</p>}
        </div>
        </div>

        <aside className="measurement-result-panel">
        <span className="brand-eyebrow">REZULTAT ORIENTUES</span>
        <h2>Vlerësimi i përmasave</h2>
        {!measurementReady ? (
          <div className="measurement-empty-result">
            <Ruler size={34} />
            <strong>{photoData ? 'Konfirmoni shënuesit e fotografisë' : 'Filloni me një fotografi të qartë'}</strong>
            <p>Vlerësimi shfaqet vetëm pasi të vendosni gjashtë shënuesit dhe të konfirmoni kalibrimin. Nuk përllogaritet automatikisht nga fytyra.</p>
          </div>
        ) : (
          <>
            <div className="measurement-quality check"><Ruler size={17} /> Vlerësim nga shënuesit tuaj — i paverifikuar</div>
            <p className="measurement-geometry-note">Përpjesëtimi përdor kartën si referencë. Këndi i kamerës, largësia e kartës dhe shënuesit mund ta ndryshojnë rezultatin. Nuk matet saktësia dhe nuk jepet recetë.</p>
            <div className="measurement-results-grid">
              <div><span>Distanca mes bebëzave në foto</span><strong>~{results.pd.toFixed(0)} <small>mm</small></strong></div>
              <div><span>Gjerësia e fytyrës në foto</span><strong>~{results.faceWidth.toFixed(0)} <small>mm</small></strong></div>
            </div>
            <div className="bridge-profile">
              <span>Si ju përshtaten zakonisht syzet te hunda?</span>
              <div>
                {[
                  ["narrow", "Rrëshqasin"],
                  ["medium", "Normalisht"],
                  ["wide", "Shtrëngojnë"]
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={bridgeProfile === value ? "active" : ""}
                    aria-pressed={bridgeProfile === value}
                    onClick={() => setBridgeProfile(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {activeProduct && (
              <div className="measurement-product-check">
                <img src={activeProduct.image} alt="" />
                <div>
                  <small>MODELI I ZGJEDHUR</small>
                  <strong>{activeProduct.name}</strong>
                  <span>
                    {activeProduct.frameWidth
                      ? `${activeProduct.frameWidth} mm — gjerësia e deklaruar e modelit; përshtatja konfirmohet në optikë`
                      : "Kontrolloni masën në detajet e modelit"}
                  </span>
                </div>
              </div>
            )}
            <div className="measurement-result-actions">
              <button className="primary-button measurement-whatsapp" onClick={sendMeasurement}>
                <MessageCircle size={18} /> Verifikoje me optikun
              </button>
              <button className="secondary-button" onClick={downloadMeasurement}>
                <Download size={17} /> Ruaj përmbledhjen
              </button>
            </div>
          </>
        )}
        <p className="measurement-disclaimer">
          Mos i përdorni këto vlera për porositjen ose prodhimin e lenteve. PD-ja, lartësia e montimit, ura dhe përshtatja e kornizës verifikohen nga optiku.
        </p>
        <div className="fit-next-actions">
          <button className="secondary-button" onClick={openTryOn}><Camera size={17} /> Provo modelin</button>
          <button className="quiet-button" onClick={() => navigate("contact")}>Rezervo në optikë</button>
        </div>
        </aside>
      </div>
    </div>
  );
}

function LensFocusHero({ navigate }) {
  const heroRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const stages = [
    {
      number: "01",
      label: "Receta",
      title: "Nga numrat, te harta optike.",
      copy: "SPH, CYL, AXIS dhe ADD vendosin fuqinë. Ne i lidhim me mënyrën si shihni gjatë ditës.",
      readout: "RX INPUT / VERIFIED"
    },
    {
      number: "02",
      label: "Zonat",
      title: "Larg. Ekran. Afër.",
      copy: "Tri distanca kalojnë pa vijë ndarëse përmes një korridori progresiv të projektuar për rutinën tuaj.",
      readout: "3 FIELDS / MAPPED"
    },
    {
      number: "03",
      label: "Pozicioni",
      title: "Matjet vendosin qartësinë në vend.",
      copy: "PD-ja, lartësia, këndi dhe distanca sy–thjerrëz e pozicionojnë hartën për secilin sy.",
      readout: "POSITION / CALIBRATED"
    },
    {
      number: "04",
      label: "Sipërfaqja",
      title: "Shtresa që punojnë si një.",
      copy: "Antirefleksi, rezistenca, mbrojtja UV dhe sipërfaqja hidrofobike ndërtojnë sistemin final.",
      readout: "4 LAYERS / APPLIED"
    },
    {
      number: "05",
      label: "Lens Focus",
      title: "Një thjerrëz. E kalibruar për ju.",
      copy: "Dizajni final kontrollohet në kornizën reale dhe përfundon me përshtatjen profesionale.",
      readout: "PERSONAL LENS / READY"
    }
  ];
  const stageIndex = Math.min(stages.length - 1, Math.floor(progress * stages.length));
  const activeStage = stages[stageIndex];

  useEffect(() => {
    const measure = () => {
      const hero = heroRef.current;
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const range = hero.offsetHeight - window.innerHeight;
      setProgress(Math.min(1, Math.max(0, -rect.top / Math.max(1, range))));
    };
    let frame = 0;
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const goToStage = (index) => {
    const hero = heroRef.current;
    if (!hero) return;
    const top = window.scrollY + hero.getBoundingClientRect().top;
    const range = hero.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + range * (index / (stages.length - 1)), behavior: "smooth" });
  };

  return (
    <section
      ref={heroRef}
      id="lens-focus-hero"
      className="lfh-hero"
      data-stage={stageIndex + 1}
      style={{ "--lens-progress": progress }}
    >
      <div className="lfh-sticky">
        <div className="lfh-progress" aria-hidden="true"><span style={{ width: `${progress * 100}%` }} /></div>
        <div className="lfh-topline">
          <span>OPTIKA MIFTARI / LENS FOCUS</span>
          <b>{activeStage.readout}</b>
        </div>

        <div className="lfh-stage">
          <div className="lfh-copy" key={activeStage.number}>
            <span>{activeStage.number} / {activeStage.label}</span>
            <h1>{activeStage.title}</h1>
            <p>{activeStage.copy}</p>
            {stageIndex === stages.length - 1 && (
              <div className="lfh-actions">
                <button className="primary-button" onClick={() => navigate("contact")}>Rezervo matjen <ChevronRight size={17} /></button>
                <button className="secondary-button" onClick={() => document.getElementById("lens-systems")?.scrollIntoView({ behavior: "smooth" })}>Shiko sistemet</button>
              </div>
            )}
          </div>

          <div className="lfh-optic" aria-hidden="true">
            <div className="lfh-lens">
              <span className="lfh-zone zone-distance"><i>LARG</i></span>
              <span className="lfh-zone zone-screen"><i>EKRAN</i></span>
              <span className="lfh-zone zone-near"><i>AFËR</i></span>
              <span className="lfh-axis axis-x" />
              <span className="lfh-axis axis-y" />
              <span className="lfh-center" />
            </div>
            <div className="lfh-measure-lines">
              <span>PD 31.5</span><span>FH 22.0</span><span>PANTO 8°</span>
            </div>
            <div className="lfh-layer-stack">
              <span>AR</span><span>UV</span><span>HC</span><span>HYDRO</span>
            </div>
          </div>
        </div>

        <nav className="lfh-rail" aria-label="Fazat e sistemit optik">
          {stages.map((item, index) => (
            <button
              key={item.number}
              className={index === stageIndex ? "is-active" : index < stageIndex ? "is-complete" : ""}
              aria-current={index === stageIndex ? "step" : undefined}
              onClick={() => goToStage(index)}
            >
              <b>{item.number}</b><span>{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          className="lfh-skip"
          onClick={() => document.getElementById("lens-systems")?.scrollIntoView({ behavior: "smooth" })}
        >
          Kapërce përmbledhjen <ChevronRight size={15} />
        </button>
      </div>
    </section>
  );
}

function GuidesPage(props) { return <LensFocusPage {...props} />; }

function ArticlePage({ article, navigate }) { return <AdviceArticle article={article} articles={blogPosts} navigate={navigate} />; }

function WishlistPage({ products, navigate, openQuickView, addToCart, toggleWishlist, wishlist }) {
  return (
    <section className="page-section wishlist-page">
      <div className="page-hero compact">
        <div>
          <span className="brand-eyebrow">ZGJEDHJET TUAJA</span>
          <h1>Të preferuarat tuaja.</h1>
          <p>Rishikoni modelet dhe variantet që ju pëlqejnë. Lista ruhet në këtë shfletues; nuk sinkronizohet mes pajisjeve.</p>
        </div>
        <button className="primary-button" onClick={() => navigate("shop")}>
          Vazhdo me katalogun
        </button>
      </div>
      {products.length ? (
        <ProductRail
          products={products}
          navigate={navigate}
          openQuickView={openQuickView}
          addToCart={addToCart}
          toggleWishlist={toggleWishlist}
          wishlist={wishlist}
        />
      ) : (
        <div className="empty-surface">
          <Heart size={36} />
          <h2>Nuk keni ruajtur ende korniza.</h2>
          <p>Përdorni ikonën e zemrës te çdo produkt për të krijuar listën tuaj.</p>
          <button className="gold-button" onClick={() => navigate("shop")}>
            Shiko kornizat
          </button>
        </div>
      )}
    </section>
  );
}

function BrandPage(props) { return <EditorialLaboratory {...props} assets={assemblyAssets} />; }
function AboutPage(props) { return <EditorialAbout {...props} />; }
function ContactPage({ navigate, content }) {
  const [sent, setSent] = useState(false);
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingSaved, setBookingSaved] = useState(false);
  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingReference, setBookingReference] = useState("");
  const [bookingAttempt, setBookingAttempt] = useState(null);
  const bookingBusyRef = useRef(false);
  const bookingFeedbackRef = useRef(null);
  const bookingServices = [
    { value: "Ekzaminim i syrit", duration: "45 min", note: "Kontroll i shikimit dhe diskutim i nevojave tuaja." },
    { value: "Matje për progresive", duration: "45 min", note: "PD, lartësia, këndi dhe pozicioni real i kornizës." },
    { value: "Këshillim për recetën", duration: "30 min", note: "Shpjegim i recetës, materialit dhe shtresave." },
    { value: "Përshtatje e kornizës", duration: "20 min", note: "Rregullim i urës, bishtave dhe pozicionit në fytyrë." },
    { value: "Ndihmë për porosinë", duration: "15 min", note: "Disponueshmëri, dërgesë dhe kontroll i konfigurimit." }
  ];
  const bookableDays = bookingCalendar();
  const timeSlots = bookingTimes;
  const [appointment, setAppointment] = useState(bookingServices[0].value);
  const [selectedDate, setSelectedDate] = useState(bookableDays[0]?.value || "");
  const [selectedTime, setSelectedTime] = useState(timeSlots[0]);
  const [bookingError, setBookingError] = useState("");
  const activeService = bookingServices.find((service) => service.value === appointment) || bookingServices[0];
  const activeDay = bookableDays.find((day) => day.value === selectedDate);
  useEffect(() => { if (bookingError || sent) bookingFeedbackRef.current?.focus(); }, [bookingError, sent]);

  return (
    <section className="page-section contact-page">
      <div className="page-hero compact">
        <div>
          <span className="brand-eyebrow">VIZITONI OPTIKA MIFTARI</span>
          <h1>{content?.contactTitle || "Rezervoni kohën tuaj me optikun."}</h1>
          <p>{content?.contactSubtitle || "Zgjidhni arsyen e vizitës, ditën dhe orën e preferuar. Ekipi e kontrollon kërkesën dhe ju dërgon konfirmimin personalisht."}</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => { document.getElementById("booking")?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: "start" }); document.querySelector('#booking select')?.focus({ preventScroll: true }); }}
        >
          Fillo rezervimin <ChevronRight size={16} />
        </button>
      </div>
      <div className="contact-grid" id="booking">
        <form
          className="contact-form booking-form"
          aria-busy={bookingSubmitting}
          onInput={(event) => event.target.setCustomValidity?.('')}
          onSubmit={async (event) => {
            event.preventDefault();
            if (bookingBusyRef.current || sent) return;
            const form = event.currentTarget;
            const formData = new FormData(form);
            const payload = {
              type: 'appointment', appointmentSchemaVersion: 1,
              name: String(formData.get('name') || '').trim(),
              phone: String(formData.get('phone') || '').trim(),
              email: String(formData.get('email') || '').trim(),
              message: String(formData.get('message') || '').trim(),
              service: appointment, preferredDate: selectedDate, preferredTime: selectedTime,
              consent: formData.get('consent') === 'on'
            };
            const fieldError = bookingContactError(payload);
            if (fieldError) {
              const control = form.elements.namedItem(fieldError[0]);
              control?.setCustomValidity(fieldError[1]);
              control?.reportValidity();
              control?.focus();
              return;
            }
            if (!activeDay || !selectedTime) {
              setBookingError("Zgjidhni ditën dhe orën e preferuar.");
              return;
            }
            const fingerprint = JSON.stringify(payload);
            if (bookingAttempt && bookingAttempt.fingerprint !== fingerprint) {
              setBookingError('Këto të dhëna ndryshojnë nga tentativa e mëparshme. Riktheni të dhënat e para për ta riprovuar, ose filloni shprehimisht një kërkesë të re më poshtë.');
              return;
            }
            const attempt = bookingAttempt || { fingerprint, id: crypto.randomUUID() };
            setBookingAttempt(attempt);
            const message = [
              "Përshëndetje Optika Miftari, dëshiroj të kërkoj një takim.",
              `Emri: ${payload.name}`,
              `Telefoni: ${payload.phone}`,
              `Email: ${payload.email || "Nuk u dha"}`,
              `Shërbimi: ${appointment}`,
              `Dita e preferuar: ${activeDay.full}`,
              `Ora e preferuar: ${selectedTime}`,
              `Mesazhi: ${payload.message || "Pa mesazh shtesë"}`
            ].join("\n");
            bookingBusyRef.current = true;
            setBookingSubmitting(true);
            setBookingMessage(message);
            setBookingSaved(false);
            setBookingError("");
            try {
              const result = await sendAppointment({ ...payload, appointmentRequestId: attempt.id });
              trackPublicEvent("appointment_request", {
                appointment_type: appointment,
                preferred_date: selectedDate,
                preferred_time: selectedTime
              });
              setSent(true);
              setBookingSaved(true);
              setBookingReference(result.id);
              setBookingMessage(`${message}\nReferenca e kërkesës: ${result.id}`);
            } catch (error) {
              setSent(false);
              setBookingError(appointmentFailure(error));
              // A validation rejection cannot have created a record; corrected
              // details may safely receive a new reference on the next attempt.
              if (error.status === 422) setBookingAttempt(null);
            } finally {
              bookingBusyRef.current = false;
              setBookingSubmitting(false);
            }
          }}
        >
          <div className="booking-form-head">
            <span>KËRKESË PËR TAKIM</span>
            <h2>Kërkoni një takim.</h2>
            <p>Zgjidhni orarin që ju përshtatet, sipas kohës lokale në Kosovë. Orët janë preferenca, jo vende të konfirmuara.</p>
          </div>
          <fieldset className="booking-fields" disabled={bookingSubmitting || sent}>
          <div className="booking-step">
            <div className="booking-step-label"><b>01</b><span>Shërbimi</span></div>
            <label>
              Lloji i takimit
              <select value={appointment} onChange={(event) => setAppointment(event.target.value)}>
                {bookingServices.map((service) => (
                  <option key={service.value} value={service.value}>
                    {service.value}
                  </option>
                ))}
              </select>
            </label>
            <p className="booking-service-note"><Clock size={15} /> {activeService.note}</p>
          </div>

          <div className="booking-step">
            <div className="booking-step-label"><b>02</b><span>Dita</span></div>
            <div className="booking-date-grid" role="group" aria-label="Zgjidhni ditën e preferuar">
              {bookableDays.map((day) => (
                <button
                  type="button"
                  key={day.value}
                  className={selectedDate === day.value ? "active" : ""}
                  aria-pressed={selectedDate === day.value}
                  onClick={() => setSelectedDate(day.value)}
                >
                  <span>{day.weekday}</span>
                  <strong>{day.date}</strong>
                </button>
              ))}
            </div>
          </div>

          <div className="booking-step">
            <div className="booking-step-label"><b>03</b><span>Ora e preferuar</span></div>
            <div className="booking-time-grid" role="group" aria-label="Zgjidhni orën e preferuar">
              {timeSlots.map((time) => (
                <button
                  type="button"
                  key={time}
                  className={selectedTime === time ? "active" : ""}
                  aria-pressed={selectedTime === time}
                  onClick={() => setSelectedTime(time)}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          <div className="booking-step">
            <div className="booking-step-label"><b>04</b><span>Kontakti</span></div>
            <div className="booking-contact-grid">
              <label>
                Emri dhe mbiemri *
                <input required name="name" minLength={2} maxLength={140} autoComplete="name" placeholder="Emri juaj" />
              </label>
              <label>
                Telefoni *
                <input required name="phone" type="tel" maxLength={80} autoComplete="tel" placeholder="+383 ..." />
              </label>
            </div>
            <label>
              Email <small>Opsionale</small>
              <input name="email" type="email" maxLength={180} autoComplete="email" placeholder="emri@shembull.com" />
            </label>
          </div>

          <label>
            Shënim për optikun <small>Opsional</small>
            <textarea name="message" maxLength={1000} placeholder="P.sh. modeli që dëshironi të provoni. Mos shkruani diagnoza ose të dhëna mjekësore." />
          </label>
          <label className="booking-consent"><input required type="checkbox" name="consent" /><span>Pajtohem që Optika Miftari t’i përdorë këto të dhëna për të më kontaktuar për takimin. <a href="/policies#privacy" target="_blank" rel="noopener noreferrer">Privatësia (hapet veçmas)</a></span></label>
          <div className="booking-summary" aria-live="polite">
            <CalendarDays size={20} />
            <div>
              <span>KËRKESA JUAJ</span>
              <strong>{appointment}</strong>
              <small>{activeDay?.full || "Zgjidhni ditën"} · {selectedTime || "Zgjidhni orën"}</small>
            </div>
          </div>
          </fieldset>
          {bookingSaved && sent && (
            <div ref={bookingFeedbackRef} tabIndex={-1} className="booking-feedback success" role="status">
              <CheckCircle2 size={20} />
              <div><strong>Kërkesa u ruajt · {bookingReference}</strong><p>Ky është konfirmim pranimi, jo konfirmim i takimit. Ekipi do t’ju kontaktojë për orarin.</p></div>
              <button type="button" onClick={() => openWhatsApp(bookingMessage)}>Hap WhatsApp</button>
            </div>
          )}
          {bookingError && (
            <div ref={bookingFeedbackRef} tabIndex={-1} className="booking-feedback error" role="alert">
              <AlertCircle size={20} />
              <div><strong>Nuk kemi konfirmim për kërkesën.</strong><p>{bookingError}</p></div>
              {bookingMessage && <button type="button" onClick={() => openWhatsApp(bookingMessage)}>Vazhdo në WhatsApp</button>}
            </div>
          )}
          {bookingError && bookingAttempt && <div className="booking-retry-actions"><button type="button" className="quiet-button" onClick={() => { setBookingAttempt(null); setBookingError(''); }}>Përdor të dhënat si kërkesë të re</button><small>Nëse tentativa e parë u ruajt, një kërkesë e re mund të krijojë dublim. Për të njëjtat të dhëna përdorni butonin e riprovimit.</small></div>}
          <p className="contact-form-note">Ky është orari juaj i preferuar, jo një termin i garantuar. Mos dërgoni të dhëna mjekësore në shënim.</p>
          {sent ? <button type="button" className="gold-button" onClick={(event) => { event.currentTarget.form?.reset(); setSent(false); setBookingSaved(false); setBookingReference(''); setBookingAttempt(null); setBookingMessage(''); setBookingError(''); window.requestAnimationFrame(() => document.querySelector('.booking-form input[name="name"]')?.focus()); }}>Fillo një kërkesë të re</button> : <button type="submit" className="gold-button" disabled={bookingSubmitting}><MessageCircle size={18} /> {bookingSubmitting ? 'Duke ruajtur…' : bookingAttempt ? 'Riprovo të njëjtën kërkesë' : 'Kërko këtë takim'}</button>}
        </form>
        <div className="contact-panels" id="locations">
          <figure className="ed-contact-photo"><EditorialImage name="contactImage" value={content?.contactImage} alt="Skenë ilustruese e përshtatjes së kornizës" /><figcaption>Këshillim dhe përshtatje, në optikë.<small>Imazh ilustrues</small></figcaption></figure>
          <article>
            <Phone size={22} />
            <h2>Telefononi optikën</h2>
            <p><a href="tel:+38343777667">+383 43 777 667</a></p>
          </article>
          <article>
            <MapPin size={22} />
            <h2>Mbretëresha Teutë 182</h2>
            <p>40000 Mitrovicë, Kosovë</p>
            <a className="text-link" href="https://www.google.com/maps/search/?api=1&query=Optika+Miftari+Mbret%C3%ABresha+Teut%C3%AB+182+Mitrovic%C3%AB" target="_blank" rel="noreferrer">Hap në hartë</a>
          </article>
          <article>
            <Clock size={22} />
            <h2>Orari</h2>
            <p>E hënë - E shtunë / 10:00 - 19:30<br />E diel / Mbyllur</p>
          </article>
          <article>
            <Instagram size={22} />
            <h2>@optikamiftari</h2>
            <p>Modele të reja, këshilla për lentet dhe njoftime nga optika.</p>
            <a className="text-link" href="https://www.instagram.com/optikamiftari/" target="_blank" rel="noreferrer">Shiko Instagramin</a>
          </article>
        </div>
      </div>
    </section>
  );
}

function OrderStatusPage({ navigate }) {
  const [lookup, setLookup] = useState({ orderId: "", contact: "" });
  const [order, setOrder] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [checking, setChecking] = useState(false);

  const checkOrder = async (event) => {
    event.preventDefault();
    setChecking(true);
    setStatusError("");
    setOrder(null);
    try {
      const response = await fetch("/api/order-status.php", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lookup)
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "order_not_found");
      setOrder(payload.order);
    } catch (error) {
      setStatusError(error.message === "rate_limit_exceeded"
        ? "Shumë kontrolle të njëpasnjëshme. Provoni pak më vonë."
        : "Porosia nuk u gjet. Kontrolloni numrin dhe emailin ose telefonin e përdorur në porosi.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="page-section order-status-page">
      <div className="page-hero compact">
        <div><span className="brand-eyebrow">GJURMIMI I POROSISË</span><h1>Kontrolloni ku ndodhet porosia juaj.</h1><p>Vendosni numrin e porosisë dhe emailin ose telefonin që përdorët gjatë porosisë.</p></div>
        <button className="secondary-button" onClick={() => navigate("contact")}>Kërko ndihmë</button>
      </div>
      <div className="order-status-layout">
        <form className="order-status-form" onSubmit={checkOrder}>
          <label>Numri i porosisë<input required value={lookup.orderId} onChange={(e) => setLookup({ ...lookup, orderId: e.target.value.toUpperCase() })} placeholder="OM-123456" /></label>
          <label>Emaili ose telefoni<input required value={lookup.contact} onChange={(e) => setLookup({ ...lookup, contact: e.target.value })} placeholder="emri@shembull.com ose +383..." /></label>
          {statusError && <p className="checkout-error" role="alert">{statusError}</p>}
          <button className="primary-button" disabled={checking}>{checking ? "Duke kontrolluar…" : "Kontrollo statusin"}</button>
        </form>
        <div className="order-status-result" aria-live="polite">
          {!order ? <div className="order-status-empty"><ShoppingBag size={26} /><strong>Statusi do të shfaqet këtu.</strong><span>Të dhënat përdoren vetëm për të verifikuar porosinë tuaj.</span></div> : <>
            <header><span>POROSIA {order.id}</span><h2>{orderStatusLabel(order.status)}</h2><p>Përditësuar: {order.updatedAt ? new Date(order.updatedAt).toLocaleString("sq-AL") : order.date}</p></header>
            <div className="order-status-grid">
              <span><small>Produktet</small><b>{order.product}</b></span>
              <span><small>Totali</small><b>{money(order.total)}</b></span>
              <span><small>Pagesa</small><b>{orderStatusLabel(order.paymentStatus)}</b></span>
              <span><small>Dorëzimi</small><b>{orderStatusLabel(order.fulfillmentStatus)}</b></span>
              <span><small>Mënyra</small><b>{orderStatusLabel(order.shipping)}</b></span>
              <span><small>Gjurmimi</small><b>{order.trackingNumber || "Shtohet pas nisjes"}</b></span>
            </div>
            {order.paymentLink && order.paymentStatus !== "Paid" && <a className="primary-button order-payment-link" href={order.paymentLink} target="_blank" rel="noopener noreferrer">Hap pagesën e sigurt <ChevronRight size={16} /></a>}
          </>}
        </div>
      </div>
    </section>
  );
}

function PoliciesPage({ navigate }) {
  return (
    <section className="page-section policies-page">
      <div className="page-hero compact">
        <div>
          <span className="brand-eyebrow">POROSI ME SIGURI</span>
          <h1>Porositë, pa paqartësi.</h1>
          <p>Informacioni praktik përpara blerjes: çfarë konfirmojmë, si përgatitet porosia dhe ku gjeni ndihmë.</p>
        </div>
        <button className="primary-button" onClick={() => navigate("contact")}>Pyet optikën</button>
      </div>

      <nav className="policy-index" aria-label="Temat e politikave">{[["orders","Porosia & pagesa"],["prescriptions","Receta"],["delivery","Dërgesa"],["returns","Kthimet"],["privacy","Privatësia"],["care","Kujdesi"]].map(([id,title]) => <a key={id} href={`#${id}`}>{title}<ChevronRight size={15}/></a>)}</nav>
      <div className="policy-grid">
        <article id="orders">
          <span>01 / POROSIA & PAGESA</span>
          <h2>Çdo porosi konfirmohet personalisht.</h2>
          <p>
            Dërgimi i kërkesës nuk e ngarkon kartën dhe nuk krijon shitje finale. Optika Miftari konfirmon
            disponueshmërinë, recetën, çmimin final, mënyrën e pagesës dhe afatin përpara se të fillojë puna laboratorike.
            Stoku rezervohet për 24 orë; pa konfirmim, rezervimi lirohet automatikisht. Kur dërgohet një lidhje pagese,
            përdorni vetëm lidhjen HTTPS që shfaqet te gjurmimi i porosisë.
          </p>
        </article>
        <article id="prescriptions">
          <span>02 / RECETA</span>
          <h2>Detajet optike kontrollohen para prodhimit.</h2>
          <p>
            Recetën mund ta ngarkoni, ta shkruani manualisht ose ta dërgoni më vonë. Vlerat, PD-ja, paketa e
            thjerrëzave, shtresat dhe përshtatshmëria e kornizës konfirmohen para punës laboratorike.
          </p>
        </article>
        <article id="delivery">
          <span>03 / DËRGESA</span>
          <h2>Afati fillon pas konfirmimit final.</h2>
          <p>
            Kornizat në stok zakonisht dërgohen brenda 1–4 ditësh pune. Thjerrëzat me recetë kërkojnë kohë
            shtesë laboratorike. Afati dhe çdo tarifë ekspres konfirmohen me optikën para pagesës.
          </p>
        </article>
        <article id="returns">
          <span>04 / KTHIMET & PËRSHTATJA</span>
          <h2>Kornizat standarde mund të kontrollohen për përshtatje.</h2>
          <p>
            Kornizat standarde, të papërdorura dhe në gjendje origjinale mund të kthehen brenda 30 ditësh.
            Thjerrëzat me recetë, nuancat dhe punimet e personalizuara shqyrtohen individualisht.
          </p>
        </article>
        <article id="privacy">
          <span>05 / PRIVATËSIA</span>
          <h2>Informacioni përdoret vetëm për kërkesën tuaj.</h2>
          <p>
            Preferencat e shportës qëndrojnë në pajisjen tuaj. Kur dërgoni një kërkesë për takim ose porosi,
            emri, kontakti dhe detajet e kërkesës ruhen në portalin e Optika Miftari për konfirmim,
            shërbim dhe ndjekje. Dokumentet e recetës ruhen në hapësirë private, jashtë dosjeve publike, lidhen
            me porosinë përkatëse dhe mund të shkarkohen vetëm nga stafi i autorizuar. Faqja nuk ruan të dhëna
            karte ose fotografi selfie të përdorura në provën virtuale.
            Për qasje, korrigjim ose anonimizim të të dhënave të kërkesës, kontaktoni optikën. Të dhënat operative
            mbahen vetëm për aq sa nevojiten për porosinë, garancinë dhe detyrimet e zbatueshme të evidencës.
          </p>
        </article>
        <article id="care">
          <span>06 / KUJDESI</span>
          <h2>Zakone të vogla mbrojnë thjerrëzat dhe kornizën.</h2>
          <p>
            Shpëlani pluhurin, përdorni solucion të sigurt dhe mikrofibër të pastër, ruajini syzet në kasë dhe
            shmangni nxehtësinë e panelit të makinës.
          </p>
        </article>
      </div>

      <div className="appointment-band policy-support-band">
        <MessageCircle size={26} />
        <div>
          <h2>Keni pyetje për porosinë ose kthimin?</h2>
          <p>Kontaktoni optikën para pagesës ose miratimit të punës së personalizuar.</p>
        </div>
        <button className="gold-button" onClick={() => navigate("contact")}>Kontakto Optika Miftari</button>
      </div>
    </section>
  );
}

function SitePageLink({ navigate, page, path, children, ...props }) {
  const href = path || pagePaths[page] || '/';
  return <a {...props} href={href} onClick={event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); navigate(page, undefined, href);
  }}>{children}</a>;
}

function SiteFooter({ navigate }) {
  const english = useLanguage() === 'en';
  return (
    <footer className="site-footer">
      <div className="footer-invitation"><div><span>OPTIKA MIFTARI</span><h2>{english ? 'A personal perspective.' : 'Një këndvështrim personal.'}</h2></div><SitePageLink navigate={navigate} page="shop" className="atelier-button light">{english ? 'Find your next pair' : 'Gjeni palën tuaj'}<ChevronRight size={20}/></SitePageLink></div>
      <div className="footer-main">
        <div className="footer-brand">
          <img src="/assets/brand/optika-miftari-monogram.png" alt="" />
          <div>
            <strong>OPTIKA MIFTARI</strong>
            <span>Qartësi, brez pas brezi.</span>
          </div>
          <p>Pjesë e Miftari Holding Group. Optical, Optical Lab dhe Klinika Miftari: tri fusha të lidhura me kujdesin për shikimin.</p>
        </div>
        <nav aria-label="Kornizat dhe thjerrëzat">
          <span>BLI ONLINE</span>
<SitePageLink navigate={navigate} page="shop">Shiko kornizat</SitePageLink>
<SitePageLink navigate={navigate} page="prescription" path="/prescription-glasses">Syze me dioptri</SitePageLink>
<SitePageLink navigate={navigate} page="sunglasses" path="/sunglasses">Syze dielli</SitePageLink>
<SitePageLink navigate={navigate} page="fit" path="/virtual-try-on">Provo & mat online</SitePageLink>
        </nav>
        <nav aria-label="Miftari Holding Group">
          <span>GRUPI MIFTARI</span>
<SitePageLink navigate={navigate} page="optical">Optical</SitePageLink>
<SitePageLink navigate={navigate} page="brand" path="/laboratory">Optical Lab</SitePageLink>
<SitePageLink navigate={navigate} page="clinic">Klinika Miftari</SitePageLink>
<SitePageLink navigate={navigate} page="partners">Partnerë profesionalë</SitePageLink>
<SitePageLink navigate={navigate} page="guides" path="/lens-focus">Lens Focus</SitePageLink>
<SitePageLink navigate={navigate} page="about">Rreth nesh</SitePageLink>
<SitePageLink navigate={navigate} page="examination" path="/ekzaminimi">Ekzaminimi</SitePageLink>
<SitePageLink navigate={navigate} page="contact">Na vizitoni</SitePageLink>
        </nav>
        <nav aria-label="Mbështetja">
          <span>MBËSHTETJE</span>
<SitePageLink navigate={navigate} page="orderStatus">Gjurmo porosinë</SitePageLink>
<SitePageLink navigate={navigate} page="account">Llogaria ime</SitePageLink>
<SitePageLink navigate={navigate} page="policies">Politikat e optikës</SitePageLink>
          <a href={`tel:+${storePhone}`}>+383 43 777 667</a>
          <a href="https://www.instagram.com/optikamiftari/" target="_blank" rel="noreferrer">Instagram</a>
        </nav>
      </div>
      <div className="footer-bottom">
        <span>© 2026 Optika Miftari</span>
        <span>2 lokacione · Mitrovicë: Mbretëresha Teutë 182</span>
<SitePageLink navigate={navigate} page="policies">Privatësia · Kthimet · Dërgesa</SitePageLink>
      </div>
    </footer>
  );
}


function CartDrawer({ open, setOpen, cart, setCart, total, logEvent, navigate, campaigns: activeCampaigns, products, setStoreProducts, customerSession, editItem }) {
  const createEmptyCustomer = () => readCheckoutDraft(draftStorage, draftOwner, customerSession?.profile);
  const draftOwner = customerSession?.profile?.id || "guest";
  const draftStorage = useMemo(() => { try { return window.sessionStorage; } catch { return null; } }, []);
  const requestIdentity = useMemo(() => createCheckoutRequestIdentity(draftStorage, draftOwner), [draftStorage, draftOwner]);
  const submittingRef = useRef(false);
  const [discount, setDiscount] = useState("");
  const [step, setStep] = useState("cart");
  const [orderNumber, setOrderNumber] = useState("");
  const [customer, setCustomer] = useState(() => readCheckoutDraft(draftStorage, draftOwner, customerSession?.profile));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [pendingOrder, setPendingOrder] = useState(null);
  const [serverAccepted, setServerAccepted] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [confirmedTotal, setConfirmedTotal] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [removedLine, setRemovedLine] = useState(null);
  const [deliveryErrors, setDeliveryErrors] = useState({});
  const [reviewConsent, setReviewConsent] = useState({ contact: false, policies: false });
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const closeCartRef = useRef(null);
  const shippingOptions = {
    insured: { label: "Dërgesë standarde e siguruar", detail: "Afati konfirmohet nga optika", price: 0 },
    express: { label: "Dërgesë ekspres nga laboratori", detail: "Disponueshmëria dhe afati konfirmohen", price: 24 },
    pickup: { label: "Marrje në optikë", detail: "Ju njoftojmë kur porosia të jetë gati", price: 0 }
  };
  const availableCampaigns = Array.isArray(activeCampaigns) ? activeCampaigns : [];
  const matchedCampaign = availableCampaigns.find((campaign) => (
    campaign.code.toUpperCase() === discount.trim().toUpperCase()
  ));
  const lensDiscountBase = cart.reduce((sum, item) => {
    const selected = lensPackages.find((option) => option.name === item.configuration?.lensPackage);
    return sum + (selected?.price || 0) * (item.quantity || 1);
  }, 0);
  const polarizedDiscountBase = polarizedBase(cart, products);
  const matchedScope = String(matchedCampaign?.scope || "").toLowerCase();
  const eligibleCampaignBase = matchedScope.includes("lens")
    ? lensDiscountBase
    : matchedScope.includes("polarized")
      ? polarizedDiscountBase
      : total;
  const campaignEligible = !matchedCampaign || matchedCampaign.value === "Free" || eligibleCampaignBase > 0;
  const appliedCampaign = matchedCampaign?.active && campaignEligible ? matchedCampaign : null;
  const [quoteState, setQuoteState] = useState({ key: '', quote: null, error: '' });
  const [quoteRetry, setQuoteRetry] = useState(0);
  const quoteBody = JSON.stringify({ items: cart.map(({ productId, quantity, configuration }) => ({ productId, quantity, configuration })), discountCode: discount.trim().toUpperCase(), shippingKey: customer.shipping, country: ({'Kosovë':'XK','Shqipëri':'AL','Maqedoni e Veriut':'MK','Mal i Zi':'ME'})[customer.country] || '', account: draftOwner });
  const currentQuote = quoteState.key === quoteBody ? quoteState.quote : null;
  const displayCart = quotedCartLines(cart, currentQuote);
  const quotedSubtotal = currentQuote ? currentQuote.subtotal : total;
  const quotePending = open && cart.length > 0 && quoteState.key !== quoteBody;
  useEffect(() => {
    if (!open || !cart.length || step === 'confirmed') return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/quote.php', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:quoteBody,signal:controller.signal});
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'quote_unavailable');
        setQuoteState({key:quoteBody,quote:result.quote,error:''});
      } catch (error) { if (error.name !== 'AbortError') setQuoteState({key:quoteBody,quote:null,error:'Çmimi nuk u verifikua. Kontrolloni lidhjen, stokun dhe konfigurimin; rifreskoni për të riprovuar.'}); }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [quoteBody,open,step,quoteRetry]);
  const discountPercent = appliedCampaign?.value?.includes("%") ? Number.parseFloat(appliedCampaign.value) : 0;
  const discountBase = appliedCampaign ? eligibleCampaignBase : total;
  const savings = currentQuote ? currentQuote.discount : discountPercent ? roundMoney(discountBase * (discountPercent / 100)) : 0;
  const discountFeedback = quotePending ? 'Duke verifikuar…' : quoteState.error && quoteState.key === quoteBody ? quoteState.error : currentQuote ? (discount.trim() ? currentQuote.discountCode ? 'Kodi u verifikua nga serveri' : 'Kodi nuk zbatohet për këtë shportë' : currentQuote.discount || currentQuote.shippingDiscount ? 'Oferta automatike u aplikua' : 'Opsionale') : !discount.trim()
    ? "Opsionale"
    : !matchedCampaign
      ? "Kodi nuk u njoh"
      : !matchedCampaign.active
        ? "Kodi ka skaduar ose nuk është aktiv"
        : !campaignEligible
          ? matchedScope.includes("lens")
            ? "Kodi vlen vetëm për paketat e lenteve"
            : "Kodi vlen vetëm për syze të polarizuara"
          : appliedCampaign.value === "Free" ? "Shërbimi përfshihet" : `${appliedCampaign.value} u aplikua`;
  const shippingFee = currentQuote ? currentQuote.shippingFee : shippingOptions[customer.shipping]?.price || 0;
  const finalTotal = currentQuote ? currentQuote.total : Math.max(0, roundMoney(total - savings + shippingFee));
  const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const stockIssues = cartAvailability(cart, products);
  const prescriptionIssues = cart.filter((item) => item.configuration?.prescriptionNeedsReentry);
  const deliveryAddress = customer.shipping === "pickup"
    ? "Marrje në optikë — lokacioni konfirmohet nga ekipi"
    : `${customer.address}${customer.apartment ? `, ${customer.apartment}` : ""}, ${customer.postcode} ${customer.city}, ${customer.country}`;

  useEffect(() => {
    if (step !== "confirmed") saveCheckoutDraft(draftStorage, draftOwner, customer);
  }, [customer, step, draftStorage, draftOwner]);

  useEffect(() => {
    if (cart.length === 0 && step !== "confirmed") setStep("cart");
  }, [cart.length, step]);

  useEffect(() => {
    setDeliveryErrors((current) => {
      if (!Object.keys(current).length) return current;
      const next = checkoutDeliveryErrors(customer);
      return Object.fromEntries(Object.entries(next).filter(([key]) => key in current));
    });
  }, [customer]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.scrollTo({ top: 0, behavior: "instant" });
    if (step !== "cart") panelRef.current?.querySelector("h2")?.focus();
  }, [step, open]);

  useEffect(() => {
    if (!open || !customerSession?.authenticated || !customerSession.profile) return;
    const profile = customerSession.profile;
    setCustomer((current) => ({
      ...current,
      firstName: current.firstName || profile.firstName || "",
      lastName: current.lastName || profile.lastName || "",
      email: current.email || profile.email || "",
      phone: current.phone || profile.phone || "",
      address: current.address || profile.address || "",
      city: current.city || profile.city || "",
      postcode: current.postcode || profile.postcode || "",
      country: current.country || profile.country || "Kosovë",
      contactPreference: current.contactPreference || profile.contactPreference || "WhatsApp"
    }));
  }, [open, customerSession?.authenticated, customerSession?.profile?.id]);

  useEffect(() => {
    if (!open) return undefined;
    trackPublicEvent("view_cart", { item_count: itemCount, value: finalTotal, currency: "EUR" });
    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement;
    const drawer = panelRef.current?.closest('.cart-drawer');
    const background = [...(drawer?.parentElement?.children || [])].filter((node) => node !== drawer).map((node) => ({ node, inert: node.inert }));
    background.forEach(({ node }) => { node.inert = true; });
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !submittingRef.current) closeCartRef.current?.();
      if (event.key === "Tab" && panelRef.current) {
        const focusable = [...panelRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((node) => node.getClientRects().length);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && (document.activeElement === last || !focusable.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => panelRef.current?.querySelector("button")?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      background.forEach(({ node, inert }) => { node.inert = inert; });
      window.removeEventListener("keydown", onKeyDown);
      if (previousFocusRef.current instanceof HTMLElement) previousFocusRef.current.focus();
    };
  }, [open, setOpen]);

  const continueToPayment = (event) => {
    event.preventDefault();
    if (stockIssues.length || prescriptionIssues.length) { setStep('cart'); return; }
    const errors = checkoutDeliveryErrors(customer);
    setDeliveryErrors(errors);
    if (Object.keys(errors).length) {
      window.requestAnimationFrame(() => panelRef.current?.querySelector(`[name="${Object.keys(errors)[0]}"]`)?.focus());
      return;
    }
    setReviewConsent({ contact: false, policies: false });
    setStep("review");
    logEvent("Checkout started");
    trackPublicEvent("begin_checkout", { item_count: itemCount, value: finalTotal, currency: "EUR" });
  };

  const completeOrder = (nextOrder, message, accepted, submittedItems = cart) => {
    // The portal is the order record. Do not duplicate customer/medical records in localStorage.
    setReceipt({ shipping: nextOrder.shipping, count: submittedItems.reduce((sum, line) => sum + Number(line.quantity || 1), 0) });
    setOrderNumber(nextOrder.id);
    setConfirmedTotal(Number(nextOrder.total || 0));
    setWhatsappMessage(message);
    setServerAccepted(accepted);
    setPendingOrder(null);
    setOrderError("");
    setStep("confirmed");
    if (accepted) {
      setCart((current) => removeSubmittedLines(current, submittedItems));
      clearCheckoutDraft(draftStorage, draftOwner);
      requestIdentity.clear();
    }
    setRemovedLine(null);
    logEvent(accepted ? "Order request saved" : "WhatsApp-only order request");
    trackPublicEvent("purchase_request", {
      order_id: nextOrder.id,
      value: nextOrder.total,
      currency: "EUR",
      saved_to_portal: accepted
    });
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    if (submittingRef.current || !cart.length) return;
    if (stockIssues.length || prescriptionIssues.length) { setStep('cart'); return; }
    const errors = checkoutDeliveryErrors(customer);
    if (Object.keys(errors).length) { setDeliveryErrors(errors); setStep('delivery'); return; }
    if (!reviewConsent.contact || !reviewConsent.policies) return;
    if (!currentQuote || quotePending) { setOrderError('Prisni verifikimin e çmimit para dërgimit të kërkesës.'); return; }
    const submittedItems = cart;
    submittingRef.current = true;
    setIsSubmitting(true);
    let id;
    try {
      id = await requestIdentity.get({ customer, discount: discount.trim().toUpperCase(), items: cart.map(({ productId, quantity, configuration }) => ({ productId, quantity, configuration })) });
    } catch {
      submittingRef.current = false;
      setIsSubmitting(false);
      setOrderError("Kërkesa nuk mund të përgatitet. Rifreskoni faqen; shporta juaj ruhet.");
      return;
    }
    const fullName = `${customer.firstName} ${customer.lastName}`.trim();
    const prescription = prescriptionSummary(cart);
    const nextOrder = {
      id,
      customer: fullName,
      product: cart.map((item) => `${item.name} x${item.quantity || 1}`).join(" / "),
      total: finalTotal,
      status: "Pending",
      date: new Date().toISOString().slice(0, 10),
      prescription,
      note: `${shippingOptions[customer.shipping].label}. WhatsApp order request.`,
      email: customer.email,
      phone: customer.phone,
      shipping: shippingOptions[customer.shipping].label,
      deliveryAddress,
      contactPreference: customer.contactPreference,
      customerNote: customer.note,
      subtotal: total,
      discount: savings,
      discountCode: discount.trim().toUpperCase(),
      shippingFee,
      currency: "EUR",
      priceStatus: "Awaiting optical confirmation",
      payment: "Confirm with store",
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    const items = cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity || 1,
      unitPrice: item.price,
      lineTotal: item.price * (item.quantity || 1),
      configuration: item.configuration || {}
    }));

    setIsSubmitting(true);
    setOrderError("");
    setPendingOrder(null);
    trackPublicEvent("order_submission_attempted", { order_id: id, value: finalTotal, currency: "EUR" });
    try {
      const result = await checkoutWithDeadline(submitPublicRecord({
        type: "order",
        orderId: id,
        name: fullName,
        email: customer.email,
        phone: customer.phone,
        product: nextOrder.product,
        items,
        subtotal: total,
        discount: savings,
        discountCode: discount.trim().toUpperCase(),
        quoteFingerprint: currentQuote.fingerprint,
        country: ({'Kosovë':'XK','Shqipëri':'AL','Maqedoni e Veriut':'MK','Mal i Zi':'ME'})[customer.country] || '',
        shippingKey: customer.shipping,
        shippingFee,
        total: finalTotal,
        currency: "EUR",
        prescription,
        shipping: nextOrder.shipping,
        deliveryAddress: nextOrder.deliveryAddress,
        contactPreference: customer.contactPreference,
        customerNote: customer.note,
        message: nextOrder.note
      }));
      const acceptedOrder = confirmedCheckoutOrder(result, id);
      if (!acceptedOrder) throw Object.assign(new Error('checkout_unconfirmed'), { code: 'checkout_unconfirmed' });
      if (Array.isArray(result.products) && result.products.length) setStoreProducts(result.products);
      const serverOrder = { ...nextOrder, ...acceptedOrder };
      const confirmedMessage = [
        `Përshëndetje Optika Miftari, dua të konfirmoj porosinë ${serverOrder.id}.`,
        `Klienti: ${fullName}`,
        `Email: ${customer.email}`,
        `Telefoni: ${customer.phone}`,
        `Artikujt: ${serverOrder.product}`,
        `Receta: ${prescription}`,
        `Dërgesa: ${serverOrder.shipping}`,
        `Adresa: ${serverOrder.deliveryAddress}`,
        `Kontakti i preferuar: ${customer.contactPreference}`,
        customer.note ? `Shënim: ${customer.note}` : "",
        `Totali i verifikuar nga sistemi: ${money(serverOrder.total)}`,
        "Ju lutem konfirmoni recetën dhe mënyrën e pagesës para fillimit të punës laboratorike."
      ].filter(Boolean).join("\n");
      completeOrder(serverOrder, confirmedMessage, true, submittedItems);
    } catch (error) {
      trackPublicEvent("checkout_error", { order_id: id, error_code: error.code || "submission_unavailable", value: finalTotal, currency: "EUR" });
      const messageByCode = {
        quote_changed: 'Çmimi ose oferta ndryshoi. Kontrolloni totalin e përditësuar dhe konfirmoni përsëri; kërkesa nuk u regjistrua.',
        cart_line_limit: 'Shporta pranon deri në 25 konfigurime. Hiqni një artikull për të shtuar një tjetër.',
        invalid_quantity: 'Kontrolloni sasitë: lejohen nga 1 deri në 10 copë për konfigurim.',
        invalid_cart_item: 'Një artikull nuk është i vlefshëm. Hiqeni dhe shtojeni përsëri.',
        rate_limit_exceeded: "Janë dërguar shumë kërkesa nga kjo pajisje. Provoni pak më vonë.",
        invalid_email: "Kontrolloni adresën e emailit.",
        name_and_phone_required: "Emri dhe telefoni janë të detyrueshëm.",
        cart_empty: "Shporta është bosh.",
        product_not_found: "Një produkt nuk është më në katalog. Hiqeni dhe shtojeni përsëri.",
        insufficient_stock: "Stoku ndryshoi gjatë porosisë. Kontrolloni sasitë dhe provoni përsëri.",
        order_id_conflict: "Ky kod nuk mund të ripërdoret për këtë kontakt. Provoni përsëri për të krijuar një kod të ri.",
        invalid_lens_configuration: "Konfigurimi i thjerrëzës ka ndryshuar. Rihapeni produktin dhe zgjidheni përsëri.",
        prescription_not_supported: "Ky model nuk mbështet konfigurimin me recetë. Ndryshoni konfigurimin ose zgjidhni një model tjetër.",
        prescription_upload_required: "Receta e ngarkuar nuk u gjet. Ngarkojeni përsëri ose zgjidhni ta dërgoni më vonë.",
        manual_prescription_required: "Vlerat e recetës mungojnë. Plotësoni të dy sytë dhe PD-në.",
        invalid_shipping_method: "Zgjidhni përsëri mënyrën e dërgesës."
      };
      if (error.code === 'order_id_conflict') requestIdentity.clear();
      if (error.code === 'quote_changed') {
        setQuoteState({ key: '', quote: null, error: '' });
        setQuoteRetry((value) => value + 1);
        setReviewConsent({ contact: false, policies: false });
      }
      const uncertain = !messageByCode[error.code];
      setOrderError(messageByCode[error.code] || "Përgjigjja nuk mbërriti. Kërkesa mund të jetë regjistruar: riprovoni me të njëjtin kod ose kontrolloni statusin para se të ndryshoni porosinë.");
      setPendingOrder({ id, uncertain, message: `Përshëndetje Optika Miftari. Ju lutem kontrolloni statusin e kërkesës ${id} për ${fullName} para se të krijoni një porosi tjetër. Nuk mora konfirmim në faqe.` });
      window.requestAnimationFrame(() => panelRef.current?.querySelector('.checkout-error')?.focus());
    } finally {
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const removeLine = (item) => { setRemovedLine(item); setCart((items) => items.filter((line) => line.lineId !== item.lineId)); };
  const updateQuantity = (lineId, delta) => setCart((items) => items.map((item) => item.lineId !== lineId ? item : {
    ...item, quantity: delta < 0 ? Math.max(1, Number(item.quantity || 1) - 1) : Math.max(Number(item.quantity || 1), Math.min(cartLineLimit(items, item, products), Number(item.quantity || 1) + 1))
  }));
  const undoRemoval = () => {
    if (!removedLine) return;
    setCart((items) => items.some((line) => line.lineId === removedLine.lineId) ? items : [...items, removedLine]);
    setRemovedLine(null);
  };
  const copyOrder = async () => {
    try { await navigator.clipboard.writeText(orderNumber); setCopyFeedback('Kodi u kopjua.'); }
    catch { setCopyFeedback('Zgjidhni kodin më sipër për ta kopjuar.'); }
  };

  const finish = () => {
    setStep("cart");
    setOrderNumber("");
    setDiscount("");
    if (serverAccepted) setCustomer(createEmptyCustomer());
    setOrderError("");
    setPendingOrder(null);
    setServerAccepted(false);
    setWhatsappMessage("");
    setConfirmedTotal(null);
    setReceipt(null);
    setCopyFeedback('');
    setReviewConsent({ contact: false, policies: false });
    setOpen(false);
  };
  closeCartRef.current = () => step === 'confirmed' ? finish() : setOpen(false);

  return (
    <aside className={`cart-drawer ${open ? "open" : ""}`} aria-hidden={!open} role="dialog" aria-modal={open} aria-label="Shporta dhe përfundimi i porosisë">
      <div className="cart-backdrop" onClick={() => !isSubmitting && (step === 'confirmed' ? finish() : setOpen(false))} />
      <div className="cart-panel" ref={panelRef} aria-busy={isSubmitting}>
        <div className="cart-head">
          <div>
            <h2 tabIndex={-1}>{step === "confirmed" ? serverAccepted ? "Kërkesa u regjistrua" : "Kërkesa nuk u regjistrua" : step === "cart" ? "Shporta juaj" : "Kërkesa e porosisë"}</h2>
            <p>{step === 'confirmed' ? receipt?.count : itemCount} {(step === 'confirmed' ? receipt?.count : itemCount) === 1 ? 'artikull' : 'artikuj'} / {step === "confirmed" ? "Pa pagesë automatike" : "konfirmohet personalisht nga optika"}</p>
          </div>
          <button className="icon-button" disabled={isSubmitting} onClick={() => step === 'confirmed' ? finish() : setOpen(false)} aria-label="Mbyll shportën">
            <X size={19} />
          </button>
        </div>

        {step !== "confirmed" && cart.length > 0 && (
          <div className="checkout-progress" aria-label="Hapat e porosisë">
            {["Shporta", "Dërgesa", "Kontrolli"].map((label, index) => {
              const currentIndex = step === "cart" ? 0 : step === "delivery" ? 1 : 2;
              return <button type="button" key={label} disabled={isSubmitting || index > currentIndex} aria-current={index === currentIndex ? 'step' : undefined} className={currentIndex >= index ? "active" : ""} onClick={() => setStep(['cart', 'delivery', 'review'][index])}><b>{currentIndex > index ? <Check size={12} /> : index + 1}</b>{label}</button>;
            })}
          </div>
        )}

        {step === "confirmed" ? (
          <div className="confirmation">
            <span className="confirmation-mark">{serverAccepted ? <Check size={28} /> : <MessageCircle size={28} />}</span>
            <small>{serverAccepted ? 'KODI I POROSISË' : 'REFERENCË PËR KONTAKT'}</small>
            <div className="receipt-reference"><code>{orderNumber}</code><button type="button" onClick={copyOrder}>Kopjo kodin</button></div>
            {copyFeedback && <small role="status">{copyFeedback}</small>}
            <h3>{serverAccepted ? "Hapi tjetër? Ne ju kontaktojmë." : "Vazhdoni në WhatsApp."}</h3>
            <p>{serverAccepted
              ? "Ekipi do t’ju kontaktojë për të konfirmuar disponueshmërinë, konfigurimin dhe mënyrën e pagesës. Nuk nevojitet ta dërgoni kërkesën përsëri."
              : "Asnjë porosi nuk është regjistruar. Dërgoni mesazhin në WhatsApp për të kërkuar ndihmë; shporta juaj mbetet e ruajtur."}</p>
            <div className="confirmation-summary">
              <span><Truck size={17} /> {receipt?.shipping}</span>
              <span><ShieldCheck size={17} /> Nuk merret pagesë online</span>
              <strong>{money(confirmedTotal ?? finalTotal)}</strong>
            </div>
            {serverAccepted && <button className="primary-button" onClick={() => { const id = orderNumber; finish(); navigate('orderStatus', undefined, `/order-status?order=${encodeURIComponent(id)}`); }}>Ndiq porosinë <ChevronRight size={17}/></button>}
            <button className={serverAccepted ? 'secondary-button' : 'primary-button'} onClick={() => openWhatsApp(whatsappMessage)}><MessageCircle size={17} /> {serverAccepted ? 'Pyet optikën në WhatsApp' : 'Hap WhatsApp dhe dërgo'}</button>
            <button className="secondary-button" onClick={finish}>Mbyll dhe vazhdo blerjen</button>
          </div>
        ) : step === "cart" ? (
          <>
            {removedLine && <div className="cart-undo" role="status"><span>{removedLine.name} u hoq.</span><button type="button" onClick={undoRemoval}>Rikthe</button></div>}
            {!cart.length ? <div className="cart-empty-discovery"><ShoppingBag size={36}/><h3>Gjeni palën tuaj.</h3><p>Shikoni modelet, krahasoni masat dhe ruani zgjedhjen këtu.</p><button className="primary-button" onClick={() => { setOpen(false); navigate('shop'); }}>Shfleto kornizat <ChevronRight size={17}/></button><button className="secondary-button" onClick={() => { setOpen(false); navigate('sunglasses'); }}>Shiko syzet e diellit</button></div> : <>
            {stockIssues.length > 0 && <div className="cart-stock-warning" role="alert"><strong>Kontrolloni sasitë para se të vazhdoni.</strong><span>Stoku i {stockIssues.map((line) => line.name).join(', ')} nuk mbulon sasinë në shportë. Ulni sasinë ose hiqni artikullin.</span></div>}
            {prescriptionIssues.length > 0 && <div className="cart-stock-warning" role="alert"><strong>Receta juaj nuk ruhet në këtë pajisje.</strong><span>Pas rihapjes së faqes, plotësoni përsëri recetën për {prescriptionIssues.map((line) => line.name).join(', ')} ose zgjidhni “Dërgo më vonë” te konfigurimi.</span>{prescriptionIssues.map((line) => <button type="button" className="cart-edit-link" key={line.lineId} onClick={() => editItem(line)}>Plotëso recetën — {line.name}</button>)}</div>}
            {cart.length > 25 && <p className="cart-stock-warning" role="alert">Shporta pranon deri në 25 konfigurime. Hiqni një artikull për të shtuar një tjetër.</p>}
            <div className="cart-items">
              {displayCart.map((item) => (
                <article key={item.lineId}>
                  <img src={item.image} alt={`${item.name} në shportë`} />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.configuration?.lensPackage || "Vetëm korniza"}</span>
                    <small>{shqipLabel(item.configuration?.frameVariant || item.configuration?.coating || "Konfigurim standard")}</small>
                    <div className="cart-quantity" aria-label={`Sasia për ${item.name}`}>
                      <button type="button" disabled={(item.quantity || 1) <= 1} onClick={() => updateQuantity(item.lineId, -1)} aria-label={`Zvogëlo sasinë e ${item.name}`}><Minus size={13} /></button>
                      <output aria-live="polite" aria-atomic="true" aria-label={`Sasia për ${item.name}`}>{item.quantity || 1}</output>
                      <button type="button" disabled={(item.quantity || 1) >= cartLineLimit(cart, item, products)} onClick={() => updateQuantity(item.lineId, 1)} aria-label={`Rrit sasinë e ${item.name}`}><Plus size={13} /></button>
                    </div>
                    <button type="button" className="cart-edit-link" onClick={() => editItem(item)}>Ndrysho konfigurimin</button>
                  </div>
                  <b>{money(item.price * (item.quantity || 1))}</b>
                  <button aria-label={`Hiq ${item.name}`} onClick={() => removeLine(item)}>
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
            </div>
            <form className="checkout-form" onSubmit={(event) => { event.preventDefault(); if (!stockIssues.length && !prescriptionIssues.length) setStep("delivery"); }}>
              <label>
                Kodi i zbritjes
                <span className="discount-entry">
                  <input maxLength={60} autoComplete="off" autoCapitalize="characters" aria-describedby="checkout-discount-status" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="Shkruani kodin, nëse e keni" />
                  <b id="checkout-discount-status" role="status">{discountFeedback}</b>
                </span>
              </label>
              <div className="summary-lines">
                <span>
                  Nëntotali <b>{money(quotedSubtotal)}</b>
                </span>
                {savings > 0 && <span>Zbritja <b>-{money(savings)}</b></span>}
                {appliedCampaign && !savings && <span>{appliedCampaign.scope} <b>Përfshihet</b></span>}
                <span>Dërgesa e siguruar <b>Llogaritet në hapin tjetër</b></span>
                <strong>
                  Totali i vlerësuar <b>{money(Math.max(0, quotedSubtotal - savings))}</b>
                </strong>
              </div>
              <button className="primary-button" disabled={!cart.length || cart.length > 25 || stockIssues.length > 0 || prescriptionIssues.length > 0}>
                Vazhdo te dërgesa <ChevronRight size={17} />
              </button>
            </form>
            </>}
          </>
        ) : step === "delivery" ? (
          <form className="checkout-form checkout-step-form" noValidate onSubmit={continueToPayment}>
            <div className={`checkout-account-state ${customerSession?.authenticated ? "is-signed-in" : ""}`}>
              <User size={17} />
              <span>{customerSession?.authenticated ? <><strong>Po porositni si {customerSession.profile?.firstName}.</strong><small>Kjo porosi do të ruhet në llogarinë tuaj.</small></> : <><strong>Vazhdoni si mysafir ose hyni.</strong><small>Me llogari, porosia dhe statusi ruhen në historikun tuaj.</small></>}</span>
              <button type="button" onClick={() => { setOpen(false); navigate("account"); }}>{customerSession?.authenticated ? "Llogaria" : "Hyr"}</button>
            </div>
            <div className="checkout-section-heading">
              <Truck size={19} />
              <div><h3>Ku t’ju dorëzojmë syzet?</h3><p>Zgjidhni dërgesën ose marrjen në optikë. Nuk kërkohet pagesë tani.</p></div>
            </div>
            <div className="checkout-field-grid">
              <label>Emri<input name="firstName" maxLength={70} autoComplete="given-name" required aria-invalid={Boolean(deliveryErrors.firstName)} aria-describedby={deliveryErrors.firstName ? 'checkout-firstName-error' : undefined} value={customer.firstName} onChange={(event) => setCustomer({ ...customer, firstName: event.target.value })} />{deliveryErrors.firstName && <small className="checkout-field-error" id="checkout-firstName-error">{deliveryErrors.firstName}</small>}</label>
              <label>Mbiemri<input name="lastName" maxLength={70} autoComplete="family-name" required aria-invalid={Boolean(deliveryErrors.lastName)} aria-describedby={deliveryErrors.lastName ? 'checkout-lastName-error' : undefined} value={customer.lastName} onChange={(event) => setCustomer({ ...customer, lastName: event.target.value })} />{deliveryErrors.lastName && <small className="checkout-field-error" id="checkout-lastName-error">{deliveryErrors.lastName}</small>}</label>
            </div>
            <label>Email<input name="email" type="email" maxLength={180} autoComplete="email" required aria-invalid={Boolean(deliveryErrors.email)} aria-describedby={deliveryErrors.email ? 'checkout-email-error' : undefined} value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} placeholder="emri@shembull.com" />{deliveryErrors.email && <small className="checkout-field-error" id="checkout-email-error">{deliveryErrors.email}</small>}</label>
            <label>Telefoni<input name="phone" type="tel" maxLength={40} autoComplete="tel" required aria-invalid={Boolean(deliveryErrors.phone)} aria-describedby={deliveryErrors.phone ? 'checkout-phone-error' : undefined} value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} placeholder="P.sh. +383 4X XXX XXX" />{deliveryErrors.phone && <small className="checkout-field-error" id="checkout-phone-error">{deliveryErrors.phone}</small>}</label>
            <fieldset className="shipping-options">
              <legend>Mënyra e dërgesës</legend>
              {Object.entries(shippingOptions).map(([value, option]) => (
                <label key={value} className={customer.shipping === value ? "selected" : ""}>
                  <input type="radio" name="shipping" value={value} checked={customer.shipping === value} onChange={() => setCustomer({ ...customer, shipping: value })} />
                  <span><strong>{option.label}</strong><small>{option.detail}</small></span>
                  <b>{option.price ? money(option.price) : "Falas"}</b>
                </label>
              ))}
            </fieldset>
            {customer.shipping !== "pickup" && <>
              <div className="checkout-field-grid address-grid">
                <label>Adresa<input name="address" maxLength={250} autoComplete="street-address" required aria-invalid={Boolean(deliveryErrors.address)} aria-describedby={deliveryErrors.address ? 'checkout-address-error' : undefined} value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} />{deliveryErrors.address && <small className="checkout-field-error" id="checkout-address-error">{deliveryErrors.address}</small>}</label>
                <label>Apartamenti / hyrja <small>Opsionale</small><input maxLength={80} autoComplete="address-line2" value={customer.apartment} onChange={(event) => setCustomer({ ...customer, apartment: event.target.value })} /></label>
              </div>
              <div className="checkout-field-grid city-grid">
                <label>Qyteti<input name="city" maxLength={100} autoComplete="address-level2" required aria-invalid={Boolean(deliveryErrors.city)} aria-describedby={deliveryErrors.city ? 'checkout-city-error' : undefined} value={customer.city} onChange={(event) => setCustomer({ ...customer, city: event.target.value })} />{deliveryErrors.city && <small className="checkout-field-error" id="checkout-city-error">{deliveryErrors.city}</small>}</label>
                <label>Kodi postar<input name="postcode" maxLength={12} autoComplete="postal-code" required aria-invalid={Boolean(deliveryErrors.postcode)} aria-describedby={deliveryErrors.postcode ? 'checkout-postcode-error' : undefined} value={customer.postcode} onChange={(event) => setCustomer({ ...customer, postcode: event.target.value })} />{deliveryErrors.postcode && <small className="checkout-field-error" id="checkout-postcode-error">{deliveryErrors.postcode}</small>}</label>
              </div>
              <label>
                Shteti
                <select name="country" autoComplete="country-name" value={customer.country} onChange={(event) => setCustomer({ ...customer, country: event.target.value })}>
                  <option>Kosovë</option>
                  <option>Shqipëri</option>
                  <option>Maqedoni e Veriut</option>
                  <option>Mal i Zi</option>
                </select>
              </label>
            </>}
            <fieldset className="contact-options">
              <legend>Si preferoni t'ju kontaktojmë?</legend>
              <div>{["WhatsApp", "Telefon", "Email"].map((method) => <label key={method} className={customer.contactPreference === method ? "selected" : ""}><input type="radio" name="contactPreference" value={method} checked={customer.contactPreference === method} onChange={() => setCustomer({ ...customer, contactPreference: method })} />{method}</label>)}</div>
            </fieldset>
            <label>Shënim për optikën <small>Opsionale</small><textarea rows="3" maxLength="600" value={customer.note} onChange={(event) => setCustomer({ ...customer, note: event.target.value })} placeholder="P.sh. më telefononi pas orës 17:00 ose dua verifikim të PD-së." /></label>
            <p className="checkout-draft-note">Të dhënat e dërgesës ruhen përkohësisht në këtë skedë. Shënimi dhe receta nuk ruhen në draft.</p>
            <div className="checkout-actions">
              <button type="button" className="secondary-button" onClick={() => setStep("cart")}>Kthehu</button>
              <button className="primary-button">Kontrollo porosinë <ChevronRight size={17} /></button>
            </div>
          </form>
        ) : (
          <form className="checkout-form checkout-step-form" onSubmit={placeOrder}>
            {quoteState.error && !currentQuote && <div role="alert"><p>{quoteState.error}</p><button type="button" className="secondary-button" onClick={()=>{setQuoteState({key:'',quote:null,error:''});setQuoteRetry(n=>n+1);}}>Riprovo verifikimin</button></div>}
            <fieldset className="checkout-review-fields" disabled={isSubmitting}>
            <div className="checkout-section-heading">
              <MessageCircle size={19} />
              <div><h3>Kontrollo dhe dërgo</h3><p>Kërkesa ruhet te optika. Ekipi ju kontakton për të konfirmuar porosinë dhe mënyrën e pagesës.</p></div>
            </div>
            <div className="order-review-card">
              <span><small>Klienti</small><b>{customer.firstName} {customer.lastName}</b></span>
              <span><small>Kontakti</small><b>{customer.email}<br />{customer.phone}</b></span>
              <span><small>Dërgesa</small><b>{shippingOptions[customer.shipping].label}</b></span>
              <span><small>Adresa / marrja</small><b>{deliveryAddress}</b></span>
              <span><small>Kontakti i preferuar</small><b>{customer.contactPreference}</b></span>
              {customer.note && <span><small>Shënimi</small><b>{customer.note}</b></span>}
            </div>
            <div className="checkout-review-items" aria-label="Artikujt për konfirmim">{displayCart.map((item) => <div key={item.lineId}><img src={item.image} alt="" /><span><strong>{item.name} × {item.quantity || 1}</strong><small>{item.configuration?.lensPackage || "Vetëm korniza"} · {shqipLabel(item.configuration?.frameVariant || "")}</small></span><b>{money(item.price * (item.quantity || 1))}</b></div>)}<button type="button" className="cart-edit-link" onClick={() => setStep("cart")}>Ndrysho artikujt</button></div>
            <label className="secure-check"><input type="checkbox" required checked={reviewConsent.contact} onChange={(event) => setReviewConsent((current) => ({ ...current, contact: event.target.checked }))} /> Konfirmoj se konfigurimi dhe kontakti janë të sakta dhe pranoj që Optika Miftari të më kontaktojë për këtë kërkesë.</label>
            <label className="secure-check"><input type="checkbox" required checked={reviewConsent.policies} onChange={(event) => setReviewConsent((current) => ({ ...current, policies: event.target.checked }))} /> Pranoj kushtet e porosisë, privatësisë, dërgesës dhe kthimeve.</label>
            <a className="checkout-policy-link" href="/policies" target="_blank" rel="noopener noreferrer" tabIndex={isSubmitting ? -1 : undefined}>Lexo politikat <small>(hapet në skedë të re; porosia ruhet këtu)</small></a>
            <div className="summary-lines payment-summary">
              <span>Produktet <b>{money(quotedSubtotal)}</b></span>
              {savings > 0 && <span>Zbritja <b>-{money(savings)}</b></span>}
              {appliedCampaign && !savings && <span>{appliedCampaign.scope} <b>Përfshihet</b></span>}
              <span>{shippingOptions[customer.shipping].label} <b>{shippingFee ? money(shippingFee) : "Falas"}</b></span>
              <strong>Totali i vlerësuar <b>{money(finalTotal)}</b></strong>
            </div>
            <div className="checkout-security"><ShieldCheck size={17} /><span>Nuk mblidhen të dhëna karte. Optika konfirmon personalisht totalin dhe mënyrën e pagesës.</span></div>
            {orderError && <div className="checkout-error" role="alert" tabIndex={-1}><strong>{pendingOrder?.uncertain ? 'Statusi nuk është konfirmuar' : 'Kontrolloni kërkesën'}</strong><span>{orderError}</span>{pendingOrder && <><code>{pendingOrder.id}</code><div className="checkout-recovery-actions">{pendingOrder.uncertain && <button type="button" onClick={() => { setOpen(false); navigate('orderStatus', undefined, `/order-status?order=${encodeURIComponent(pendingOrder.id)}`); }}>Kontrollo statusin</button>}<button type="button" onClick={() => openWhatsApp(pendingOrder.message)}>Pyet optikën me këtë kod</button></div></>}</div>}
            <div className="checkout-actions">
              <button type="button" className="secondary-button" disabled={isSubmitting} onClick={() => setStep("delivery")}>Kthehu</button>
              <button className="primary-button" disabled={isSubmitting || quotePending || !currentQuote}>{isSubmitting ? <><RefreshCw size={17} className="spin" /> Duke ruajtur…</> : quotePending ? 'Duke verifikuar çmimin…' : pendingOrder?.uncertain ? <><RefreshCw size={17} /> Riprovoni të njëjtën kërkesë</> : <><MessageCircle size={17} /> Dërgo kërkesën - {money(finalTotal)}</>}</button>
            </div>
            </fieldset>
            {isSubmitting && <p className="checkout-pending-status" role="status">Po presim konfirmimin e optikës. Mos e dërgoni kërkesën nga një skedë tjetër.</p>}
          </form>
        )}
      </div>
    </aside>
  );
}

export default App;
