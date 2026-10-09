import { products } from '../data/catalog.js';

// Catalogue descriptions are translated without changing product IDs or specifications.
const rows = [
  ['Architectural acetate, titanium details and polarised lenses to control glare.', 'Precision hinges, polarised CR-39 lenses, adjustable nose pads and a scratch-resistant coating.'],
  ['A lightweight optical frame with clean lens geometry and a low-profile titanium bridge.', 'Beta-titanium wire frame, low-reflection coating, ergonomic bridge and very lightweight temples.'],
  ['A sporty silhouette with controlled curvature and high-contrast gradient lenses.', 'Carbon-polymer frame, hydrophobic coating, flexible hinges and curved temples.'],
  ['A soft, round optical frame suited to slim prescription lenses and long days at a screen.', 'Titanium rims, adjustable nose pads, low-reflection coating and discreet hinges.'],
  ['A clean aviator silhouette with mirrored lenses and prescription-sun options.', 'Titanium bridge, acetate detail, polarised mirrored lenses and a scratch-resistant coating.'],
  ['A precise, lightweight rectangular optical frame with an understated technical finish.', 'Carbon-polymer chassis, titanium temple cores and screen-lens options.'],
  ['An amber panto frame in polished acetate, with gradient lenses for everyday light.', 'Five-barrel hinges, metal temple cores, CR-39 UV400 lenses and hand-polished edges.'],
  ['A lightweight champagne cat-eye with a slim profile and brown gradient lenses.', 'Slim metal rims, adjustable nose pads, precision hinges and UV400 lenses.'],
  ['A refined brushed-titanium aviator with a double bridge and green polarised lenses.', 'Titanium construction, adjustable silicone nose pads, polarised CR-39 lenses and UV400 protection.'],
  ['A matte-black rectangular frame with an architectural profile and neutral polarised lenses.', '4 mm acetate, inset metal hinges, polarised UV400 lenses and reinforced temples.'],
  ['A lightweight, warm-toned geometric frame in transparent caramel, with adaptive amber lenses.', 'Polished bio-acetate, metal temple cores, precision hinges and UV400 lenses.'],
  ['A lightweight graphite sports frame with controlled coverage and deep-grey polarised lenses.', 'Carbon polymer, flexible hinges, curved UV400 lenses and a hydrophobic coating.'],
];
const base = products.slice(0,12);
export const productEnglish = {};
base.slice(0,12).forEach((p,i) => {
  if (!rows[i]) return;
  productEnglish[p.description] = rows[i][0];
  productEnglish[p.technical] = rows[i][1];
});
for (const p of products) {
  const source = base.find(b => p.description?.startsWith(b.description));
  if (source && p.description !== source.description) productEnglish[p.description] = `${productEnglish[source.description]} This variant pairs ${p.color.toLowerCase()} with ${p.lensColor.toLowerCase()} lenses.`;
  productEnglish[p.seoTitle] = `${p.name} · ${p.type === 'Sunglasses' ? 'Sunglasses' : 'Prescription frames'} | Optika Miftari`;
  productEnglish[p.metaDescription] = `${p.name}: ${p.type === 'Sunglasses' ? 'sunglasses' : 'optical frames'} with lens options at Optika Miftari. Explore the frame, size and fitting details.`;
}
Object.assign(productEnglish,Object.fromEntries(`
Përgatitet brenda 2–4 ditësh pune pas kontrollit laboratorik.|Prepared within 2–4 working days after the laboratory check.
Rishikim i përshtatjes brenda 30 ditësh për korniza të papërdorura.|Fit review within 30 days for unused frames.
Pastrojeni me mikrofibër, ruajeni në kuti dhe shmangni nxehtësinë në automjet.|Clean with microfibre, store in the case and avoid heat inside vehicles.
Pala me dioptri përgatitet pas verifikimit të recetës dhe matjeve.|Prescription eyewear is prepared after the prescription and measurements are verified.
Përshtatja e kornizës rishikohet brenda 30 ditësh.|Frame fit can be reviewed within 30 days.
Shpëlajini thjerrëzat para fshirjes dhe përdorni leckën e furnizuar.|Rinse the lenses before wiping and use the supplied cloth.
Modelet sportive në stok përgatiten brenda 1–3 ditësh pune.|In-stock sports models are prepared within 1–3 working days.
Rishikim brenda 30 ditësh, me filmin mbrojtës të thjerrëzës të paprekur.|Review within 30 days, with the lens protective film intact.
Shpëlani kripën dhe rërën para pastrimit me mikrofibër.|Rinse away salt and sand before cleaning with microfibre.
Përgatitet pas verifikimit të recetës dhe distancës pupillare.|Prepared after the prescription and pupillary distance are verified.
Korniza rishikohet brenda 30 ditësh; thjerrëzat e personalizuara vlerësohen individualisht.|Frames can be reviewed within 30 days; custom lenses are assessed individually.
Pastrojeni vetëm me sprej për thjerrëza dhe mikrofibër.|Clean only with lens spray and microfibre.
Përgatitet brenda 2–5 ditësh pune, varësisht nga ngjyrimi me dioptri.|Prepared within 2–5 working days, depending on the prescription tint.
Rishikim i përshtatjes brenda 30 ditësh për kornizën ose variantet jo të personalizuara.|Fit review within 30 days for the frame or non-customised variants.
Mos përdorni lecka abrazive mbi shtresën pasqyrë.|Do not use abrasive cloths on mirrored coatings.
Përgatitet pas inspektimit laboratorik dhe kontrollit të recetës.|Prepared after laboratory inspection and prescription verification.
Rishikim i përshtatjes brenda 30 ditësh.|Fit review within 30 days.
Ruajeni në kuti dhe përdorni sprej të sigurt për thjerrëzat.|Store in the case and use a lens-safe spray.
Korniza në stok përgatitet brenda 1-3 ditësh pune; lentet me dioptri kërkojnë konfirmim laboratorik.|In-stock frames are prepared within 1–3 working days; prescription lenses require laboratory confirmation.
Përshtatja e kornizës rishikohet në optikë; lentet e personalizuara konfirmohen para punimit.|Frame fit is reviewed in store; custom lenses are confirmed before production.
Shpëlajeni para fshirjes dhe ruajeni në kuti, larg nxehtësisë së drejtpërdrejtë.|Rinse before wiping and store in the case, away from direct heat.
Dërgesa ose marrja në optikë konfirmohet brenda 1-3 ditësh pune për kornizën në stok.|Delivery or collection is confirmed within 1–3 working days for in-stock frames.
Përshtatja kontrollohet para dorëzimit; punimet me dioptri fillojnë vetëm pas konfirmimit.|Fit is checked before handover; prescription work starts only after confirmation.
Përdorni sprej për lente dhe leckë mikrofibre; mos ushtroni presion mbi rimin metalik.|Use lens spray and a microfibre cloth; do not press on the metal rim.
Korniza në stok përgatitet brenda 1-3 ditësh; ngjyrosja me dioptri kërkon kohë laboratorike.|In-stock frames are prepared within 1–3 days; prescription tinting requires laboratory time.
Korniza pa lente të personalizuara mund të rishikohet sipas gjendjes dhe përshtatjes.|Frames without custom lenses can be reviewed according to their condition and fit.
Shpëlajeni kripën dhe pluhurin para fshirjes; ruajeni gjithmonë në kuti.|Rinse away salt and dust before wiping; always store in the case.
Korniza në stok përgatitet brenda 1-3 ditësh pune pas konfirmimit.|In-stock frames are prepared within 1–3 working days after confirmation.
Përshtatja dhe gjendja e kornizës kontrollohen para çdo kthimi ose ndërrimi.|Frame fit and condition are checked before any return or exchange.
Pastrojeni me ujë të vakët dhe mikrofibër; shmangni alkoolin dhe temperaturat e larta.|Clean with lukewarm water and microfibre; avoid alcohol and high temperatures.
Korniza në stok përgatitet brenda 1-3 ditësh; lentet adaptive me dioptri konfirmohen veçmas.|In-stock frames are prepared within 1–3 days; adaptive prescription lenses are confirmed separately.
Korniza kontrollohet për gjendje dhe përshtatje; lentet e punuara janë të personalizuara.|The frame is checked for condition and fit; manufactured lenses are customised.
Ruajeni në kuti dhe pastroni lentet vetëm me produkte të sigurta për veshjet optike.|Store in the case and clean lenses only with products safe for optical coatings.
Modeli në stok përgatitet brenda 1-3 ditësh pune pas konfirmimit.|In-stock models are prepared within 1–3 working days after confirmation.
Përshtatja sportive kontrollohet në optikë; korniza duhet të jetë e papërdorur për rishikim kthimi.|Sports fit is checked in store; the frame must be unused for a return review.
Shpëlajeni pas plazhit ose aktivitetit; mos fshini pluhurin mbi lente të thata.|Rinse after the beach or exercise; do not wipe dust from dry lenses.
Kthehu te udhëzuesit|Back to guides
lexim|read
Mbani parasysh|Keep in mind
Një pyetje për takimin tuaj|A question for your appointment
Diskutojeni me optikun|Discuss with your optician
Udhëzues i përgjithshëm, jo diagnozë ose recetë. Zgjedhja dhe matjet përfundimtare kërkojnë vlerësim individual nga profesionisti.|General guidance, not a diagnosis or prescription. Final selection and measurements require an individual professional assessment.
Lexim plotësues:|Further reading:
. Burimi nuk nënkupton partneritet me Miftari.|. This source does not imply a partnership with Miftari.
Vazhdoni me|Explore next
Nga informacioni, te zgjedhja juaj.|From understanding to your choice.
Edhe këto mund t’ju ndihmojnë.|You may also find these helpful.
`.trim().split('\n').map(line=>{const i=line.indexOf('|');return [line.slice(0,i),line.slice(i+1)];})));
