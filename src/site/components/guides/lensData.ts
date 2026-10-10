import type { L10n, Product } from '@/lib/types';

// L10n order is (me = Serbian Latin, sq, en) — same as the catalogue.
export const tri = (me: string, sq: string, en: string): L10n => ({ me, sq, en });

/* ------------------------------------------------------------------ */
/* Lens chooser                                                         */
/* ------------------------------------------------------------------ */
export type LensUse = 'distance' | 'reading' | 'screen' | 'all' | 'sun' | 'inout';
export type Strength = 'low' | 'mid' | 'high' | 'vhigh' | 'unknown';
export type KnownStrength = Exclude<Strength, 'unknown'>;

export const USES: { id: LensUse; label: L10n; hint: L10n }[] = [
  { id: 'distance', label: tri('Za daljinu', 'Për larg', 'Distance'), hint: tri('Vožnja, TV, table, ulica', 'Vozitje, TV, tabela, rrugë', 'Driving, TV, signs, the street') },
  { id: 'reading', label: tri('Za čitanje', 'Për lexim', 'Reading'), hint: tri('Knjige, telefon, rad izbliza', 'Libra, telefon, punë nga afër', 'Books, phone, close work') },
  { id: 'screen', label: tri('Ekran i kancelarija', 'Ekran & zyrë', 'Screen & office'), hint: tri('Računar i duge sate za stolom', 'Kompjuter dhe orë të gjata në tavolinë', 'Computer and long hours at a desk') },
  { id: 'all', label: tri('Sve u jednom paru', 'Gjithçka në një palë', 'All in one pair'), hint: tri('Daljina, ekran i blizina — bez menjanja', 'Larg, ekran dhe afër — pa ndërruar syze', 'Distance, screen and near — no swapping') },
  { id: 'sun', label: tri('Sunce sa dioptrijom', 'Dielli me dioptri', 'Prescription sun'), hint: tri('Vožnja po suncu, more, planina', 'Vozitje në diell, det, mal', 'Sunny drives, the sea, the mountains') },
  { id: 'inout', label: tri('Unutra i napolje', 'Brenda & jashtë', 'Indoors & out'), hint: tri('Jedan par koji sam potamni na suncu', 'Një palë që errësohet vetë në diell', 'One pair that darkens by itself in the sun') },
];

export const STRENGTHS: { id: Strength; label: L10n; hint: L10n }[] = [
  { id: 'low', label: tri('Do ±2', 'Deri ±2', 'Up to ±2'), hint: tri('Blaga dioptrija', 'Recetë e lehtë', 'Mild') },
  { id: 'mid', label: tri('±2 – ±4', '±2 – ±4', '±2 – ±4'), hint: tri('Srednja', 'Mesatare', 'Moderate') },
  { id: 'high', label: tri('±4 – ±6', '±4 – ±6', '±4 – ±6'), hint: tri('Jaka', 'E fortë', 'Strong') },
  { id: 'vhigh', label: tri('Preko ±6', 'Mbi ±6', 'Over ±6'), hint: tri('Vrlo jaka', 'Shumë e fortë', 'Very strong') },
  { id: 'unknown', label: tri('Ne znam', 'Nuk e di', 'Not sure'), hint: tri('Ili nemam recept', 'Ose nuk kam recetë', 'Or no prescription yet') },
];

/** Lens package (catalogue id) per use, plus a sensible alternative. */
export const PRIMARY: Record<LensUse, string> = {
  distance: 'p-lens-single',
  reading: 'p-lens-single',
  screen: 'p-lens-screen',
  all: 'p-lens-progressive',
  sun: 'p-lens-sun-rx',
  inout: 'p-lens-photochromic',
};
export const ALTERNATIVE: Record<LensUse, string> = {
  distance: 'p-lens-photochromic',
  reading: 'p-lens-screen',
  screen: 'p-lens-progressive',
  all: 'p-lens-screen',
  sun: 'p-lens-photochromic',
  inout: 'p-lens-sun-rx',
};
export const THIN_ID = 'p-lens-thin';

/** Short names of the lens packages (chips, tables); CMS-added packages fall back to their full name. */
export const SHORT: Record<string, L10n> = {
  'p-lens-single': tri('Jednožižna', 'Njëvizore', 'Single vision'),
  'p-lens-progressive': tri('Progresivna', 'Progresive', 'Progressive'),
  'p-lens-screen': tri('Za ekran', 'Për ekran', 'Screen'),
  'p-lens-photochromic': tri('Fotohromatska', 'Fotokromatike', 'Photochromic'),
  'p-lens-sun-rx': tri('Sunčana sa dioptrijom', 'Dielli me dioptri', 'Prescription sun'),
  'p-lens-thin': tri('Ultra tanka 1.74', 'Ultra të holla 1.74', 'Ultra-thin 1.74'),
};

/** Alternative reason when the 1.74 package leads (distance / reading over ±6). */
export const THIN_ALT_WHY = tri('ako želite povoljniju opciju sa indeksom 1.67', 'nëse doni një opsion më të leverdishëm me indeks 1.67', 'if you’d prefer a more affordable 1.67 option');

/** Why the alternative might suit instead. */
export const ALT_WHY: Record<LensUse, L10n> = {
  distance: tri('ako želite da vam isti par bude i za sunce', 'nëse doni që e njëjta palë të jetë edhe për diell', 'if you want the same pair to work in the sun'),
  reading: tri('ako čitate uglavnom sa ekrana', 'nëse lexoni kryesisht nga ekrani', 'if most of your reading is on screens'),
  screen: tri('ako vam treba i daljina, ne samo sto', 'nëse ju duhet edhe larg, jo vetëm tavolina', 'if you also need distance, not just the desk'),
  all: tri('ako vam treba par samo za radni sto', 'nëse ju duhet një palë vetëm për tavolinën e punës', 'if you only need a pair for the desk'),
  sun: tri('ako želite jedan par za unutra i napolje', 'nëse doni një palë për brenda dhe jashtë', 'if you want one pair for indoors and out'),
  inout: tri('ako vam trebaju prave sunčane, i polarizovane', 'nëse doni syze të vërteta dielli, edhe të polarizuara', 'if you want true sunglasses, polarised too'),
};

/** Recommendation reasons. */
export const USE_WHY: Record<LensUse, L10n> = {
  distance: tri('Jedna jasna zona za daljinu — za vožnju, ulicu i TV', 'Një zonë e qartë për larg — për vozitje, rrugë dhe TV', 'One clear zone for distance — driving, the street and TV'),
  reading: tri('Miran fokus za knjigu i telefon, bez pomeranja glave', 'Fokus i qetë për librin dhe telefonin, pa lëvizur kokën', 'A calm focus for books and your phone, without tilting your head'),
  screen: tri('Manje odsjaja sa ekrana i kancelarijske rasvete', 'Më pak reflektim nga ekrani dhe ndriçimi i zyrës', 'Fewer reflections from screens and office lighting'),
  all: tri('Daljina, ekran i blizina u jednom paru — bez vidljive linije', 'Larg, ekran dhe afër në një palë — pa vijë të dukshme', 'Distance, screen and near in one pair — no visible line'),
  sun: tri('Vaš recept u nijansi kategorije 3 sa UV400 — po želji polarizovan', 'Receta juaj në ngjyrim kategoria 3 me UV400 — sipas dëshirës e polarizuar', 'Your prescription in a category 3 tint with UV400 — polarised if you like'),
  inout: tri('Tamni na suncu i svetli u zatvorenom — jedan par za ceo dan', 'Errësohet në diell dhe zbardhet brenda — një palë për gjithë ditën', 'Darkens in the sun and clears indoors — one pair all day'),
};

export const STRENGTH_WHY: Record<Strength, L10n> = {
  low: tri('Za dioptriju do ±2 standardni indeks 1.50 je sasvim dovoljan', 'Për recetë deri ±2 mjafton indeksi standard 1.50', 'Up to ±2 the standard 1.50 index is all you need'),
  mid: tri('Indeks 1.60 drži sočivo primetno tanjim i lakšim', 'Indeksi 1.60 e mban lenten dukshëm më të hollë dhe më të lehtë', 'A 1.60 index keeps the lens noticeably thinner and lighter'),
  high: tri('Indeks 1.67 — znatno tanje ivice i lakše naočare', 'Indeksi 1.67 — skaje dukshëm më të holla dhe syze më të lehta', 'A 1.67 index — much thinner edges and lighter glasses'),
  vhigh: tri('Visok indeks 1.74 — najtanje sočivo koje izrađujemo', 'Indeks i lartë 1.74 — lentja më e hollë që punojmë', 'High-index 1.74 — the thinnest lens we make'),
  unknown: tri('Bez važećeg recepta? Pregled vida je 15 € — besplatan uz okvir', 'Pa recetë të vlefshme? Kontrolli i syve 15 € — falas me kornizë', 'No valid prescription? An eye exam is €15 — free with a frame'),
};

/** Ideal index per strength (ids match the catalogue's `index` option values). */
export const IDEAL_INDEX: Record<KnownStrength, number> = { low: 1.5, mid: 1.6, high: 1.67, vhigh: 1.74 };

/** Representative power per strength band, for the thickness illustration (dioptres). */
export const STRENGTH_POWER: Record<KnownStrength, number> = { low: 2, mid: 3.5, high: 5, vhigh: 7 };

/* ------------------------------------------------------------------ */
/* Thickness illustration                                               */
/* ------------------------------------------------------------------ */
export const INDICES: { n: number; label: string; name: L10n; centre: number }[] = [
  { n: 1.5, label: '1.50', name: tri('Standard', 'Standard', 'Standard'), centre: 2.0 },
  { n: 1.6, label: '1.60', name: tri('Tanje', 'Më e hollë', 'Thinner'), centre: 1.6 },
  { n: 1.67, label: '1.67', name: tri('Ultra tanko', 'Ultra e hollë', 'Ultra-thin'), centre: 1.4 },
  { n: 1.74, label: '1.74', name: tri('Najtanje', 'Më e holla', 'Thinnest'), centre: 1.3 },
];

/** Index (1.50…1.74) a lens option value stands for, read from its label ("1.60 më e hollë" → 1.6). */
export function indexOf(label: L10n): number | null {
  const m = `${label.en} ${label.sq}`.match(/1\.(\d{2})/);
  return m ? Number(`1.${m[1]}`) : null;
}

/** Index of a lens package from its `index` spec (the 1.74 package has no option, only a spec). */
export function specIndex(p: Product): number | null {
  const s = p.specs.find((x) => /index|indeks/i.test(`${x.label.en} ${x.label.sq}`));
  return s ? indexOf(s.value) : null;
}

/* ------------------------------------------------------------------ */
/* Lens types                                                           */
/* ------------------------------------------------------------------ */
export type ZoneKind = 'single' | 'progressive' | 'screen' | 'photo' | 'sun' | 'thin';

export const TYPES: { id: string; zone: ZoneKind; forWho: L10n; know: L10n }[] = [
  {
    id: 'p-lens-single',
    zone: 'single',
    forWho: tri('Jedna udaljenost: daljina ili čitanje', 'Një distancë: larg ose lexim', 'One distance: far or reading'),
    know: tri('Ne ispravlja istovremeno daljinu i blizinu — za to postoje progresivna.', 'Nuk korrigjon njëkohësisht larg dhe afër — për këtë janë progresivet.', 'It doesn’t correct far and near at once — that’s what progressives are for.'),
  },
  {
    id: 'p-lens-progressive',
    zone: 'progressive',
    forWho: tri('Kada vam trebaju i daljina i blizina, obično posle 40. godine', 'Kur ju duhet edhe larg edhe afër, zakonisht pas të 40-ave', 'When you need both far and near, usually after 40'),
    know: tri('Navikavanje traje nekoliko dana; kontrola prilagođavanja posle preuzimanja je besplatna.', 'Përshtatja zgjat disa ditë; kontrolli i përshtatjes pas dorëzimit është falas.', 'Getting used to them takes a few days; the adaptation check after handover is free.'),
  },
  {
    id: 'p-lens-screen',
    zone: 'screen',
    forWho: tri('Duge sate za računarom i telefonom', 'Orë të gjata para kompjuterit dhe telefonit', 'Long hours at a computer and on your phone'),
    know: tri('Smanjuje odsjaj; nema dokaza da sprečava zamor očiju — pauze pomažu više.', 'Ul reflektimin; nuk ka dëshmi se e parandalon lodhjen e syve — pushimet ndihmojnë më shumë.', 'Cuts glare; there’s no evidence it prevents eye strain — breaks help more.'),
  },
  {
    id: 'p-lens-photochromic',
    zone: 'photo',
    forWho: tri('Česti prelasci unutra–napolje', 'Kalime të shpeshta brenda–jashtë', 'Frequent indoor–outdoor switches'),
    know: tri('Iza vetrobrana malo tamne, jer staklo automobila zaustavlja UV.', 'Pas xhamit të makinës errësohen pak, sepse xhami i ndal rrezet UV.', 'Behind a windscreen they barely darken, because car glass blocks UV.'),
  },
  {
    id: 'p-lens-sun-rx',
    zone: 'sun',
    forWho: tri('Vožnja, more i planina — sa vašim receptom', 'Vozitje, det dhe mal — me recetën tuaj', 'Driving, the sea and mountains — with your prescription'),
    know: tri('Nijansa kategorije 3 nije za vožnju noću.', 'Ngjyrimi i kategorisë 3 nuk është për vozitje natën.', 'A category 3 tint is not for driving at night.'),
  },
  {
    id: 'p-lens-thin',
    zone: 'thin',
    forWho: tri('Dioptrija preko ±6', 'Receta mbi ±6', 'Prescriptions over ±6'),
    know: tri('Kod blagih dioptrija razlika je mala — nije uvek vredno doplate.', 'Te recetat e lehta dallimi është i vogël — jo gjithmonë ia vlen kostoja.', 'With mild prescriptions the difference is small — not always worth the extra cost.'),
  },
];

/* ------------------------------------------------------------------ */
/* Coatings                                                             */
/* ------------------------------------------------------------------ */
export type CoatingId = 'ar' | 'hard' | 'uv' | 'blue' | 'photo' | 'polar';

export const COATINGS: { id: CoatingId; name: L10n; does: L10n; doesnt: L10n; match: RegExp }[] = [
  {
    id: 'ar',
    name: tri('Antirefleks', 'Antirefleks', 'Anti-reflective'),
    does: tri('Smanjuje odsjaje na sočivu: manje bleštanja noću, a vaše oči se bolje vide na fotografijama i video-pozivima.', 'Ul reflektimet në lente: më pak shkëlqim natën, ndërsa sytë tuaj duken më qartë në foto dhe video-thirrje.', 'Cuts reflections on the lens: less glare at night, and your eyes show clearly in photos and video calls.'),
    doesnt: tri('Ne čini sočivo otpornim na ogrebotine; čistite ga krpicom od mikrofibera.', 'Nuk e bën lenten të pagërvishtshme; pastrojeni me leckë mikrofibre.', 'It doesn’t make the lens scratch-proof; clean it with a microfibre cloth.'),
    match: /anti-?reflect/i,
  },
  {
    id: 'hard',
    name: tri('Tvrdi sloj', 'Shtresë e fortë', 'Hard coat'),
    does: tri('Povećava otpornost na svakodnevne ogrebotine.', 'Rrit rezistencën ndaj gërvishtjeve të përditshme.', 'Adds resistance to everyday scratches.'),
    doesnt: tri('Ne štiti od peska, ključeva u džepu ili brisanja suvom odećom.', 'Nuk mbron nga rëra, çelësat në xhep apo fshirja me rroba të thata.', 'It won’t survive sand, keys in a pocket or wiping with a dry shirt.'),
    match: /hard coat|scratch/i,
  },
  {
    id: 'uv',
    name: tri('UV400', 'UV400', 'UV400'),
    does: tri('Blokira UV zrake do 400 nm — puna UV zaštita za oči.', 'Bllokon rrezet UV deri në 400 nm — mbrojtje e plotë UV për sytë.', 'Blocks UV rays up to 400 nm — full UV protection for your eyes.'),
    doesnt: tri('Tamnoća sočiva ne govori ništa o UV zaštiti — proverite specifikaciju.', 'Errësia e lentes nuk tregon asgjë për mbrojtjen UV — kontrolloni specifikimin.', 'How dark a lens is says nothing about UV protection — check the spec.'),
    match: /\bUV/i,
  },
  {
    id: 'blue',
    name: tri('Filter plavog svetla', 'Filtër drite blu', 'Blue-light filter'),
    does: tri('Filtrira deo plavo-ljubičastog svetla i, uz antirefleks, smanjuje odsjaje sa ekrana.', 'Filtron një pjesë të dritës blu-vjollcë dhe, me antirefleks, ul reflektimet nga ekrani.', 'Filters part of the blue-violet light and, with anti-reflective, cuts screen glare.'),
    doesnt: tri('Nema čvrstih dokaza da sprečava digitalni zamor ili bolesti oka. Pravilo 20-20-20 pomaže više.', 'Nuk ka dëshmi të forta se parandalon lodhjen digjitale apo sëmundjet e syve. Rregulli 20-20-20 ndihmon më shumë.', 'There’s no solid evidence it prevents digital eye strain or eye disease. The 20-20-20 rule helps more.'),
    match: /blue/i,
  },
  {
    id: 'photo',
    name: tri('Fotohromatska', 'Fotokromatike', 'Photochromic'),
    does: tri('Tamni pod UV svetlom za nekoliko minuta i ponovo svetli u zatvorenom.', 'Errësohet nën dritën UV brenda pak minutash dhe zbardhet sërish brenda.', 'Darkens under UV within minutes and clears again indoors.'),
    doesnt: tri('Iza vetrobrana jedva tamni — ne zamenjuje sunčane naočare za vožnju.', 'Pas xhamit të makinës mezi errësohet — nuk i zëvendëson syzet e diellit për vozitje.', 'Barely darkens behind a windscreen — not a substitute for driving sunglasses.'),
    match: /photochrom/i,
  },
  {
    id: 'polar',
    name: tri('Polarizacija', 'Polarizim', 'Polarisation'),
    does: tri('Uklanja zaslepljujući odsjaj sa vode, puta i stakla.', 'Heq shkëlqimin verbues nga uji, rruga dhe xhami.', 'Removes blinding glare from water, roads and glass.'),
    doesnt: tri('Nije isto što i UV zaštita i može da oteža čitanje nekih LCD ekrana.', 'Nuk është e njëjta gjë me mbrojtjen UV dhe mund ta vështirësojë leximin e disa ekraneve LCD.', 'It isn’t the same as UV protection, and can make some LCD screens harder to read.'),
    match: /polari/i,
  },
];

/** Lens packages that include / offer a coating — read from the products' coating spec and options. */
export function coatingIn(p: Product, c: (typeof COATINGS)[number]) {
  const coat = p.specs.find((s) => /coating|shtres/i.test(`${s.label.en} ${s.label.sq}`))?.value.en ?? '';
  const opt = p.options.some((o) => c.match.test(`${o.id} ${o.name.en}`));
  return c.match.test(coat) || opt;
}

/* ------------------------------------------------------------------ */
/* Materials / index table                                              */
/* ------------------------------------------------------------------ */
export const INDEX_ROWS: { n: number; thinner: L10n; forRx: L10n; note: L10n }[] = [
  { n: 1.5, thinner: tri('—', '—', '—'), forRx: tri('do ±2', 'deri ±2', 'up to ±2'), note: tri('Najpovoljnija, vrlo čista optika', 'Më e leverdishmja, optikë shumë e pastër', 'Best value, very clear optics') },
  { n: 1.6, thinner: tri('oko 15–20%', 'rreth 15–20%', 'about 15–20%'), forRx: tri('±2 – ±4', '±2 – ±4', '±2 – ±4'), note: tri('Najbolji odnos cene i tankoće', 'Ekuilibri më i mirë çmim–hollësi', 'The best balance of price and thinness') },
  { n: 1.67, thinner: tri('oko 25%', 'rreth 25%', 'about 25%'), forRx: tri('±4 – ±6', '±4 – ±6', '±4 – ±6'), note: tri('Primetno tanje ivice', 'Skaje dukshëm më të holla', 'Visibly thinner edges') },
  { n: 1.74, thinner: tri('do 40%', 'deri 40%', 'up to 40%'), forRx: tri('preko ±6', 'mbi ±6', 'over ±6'), note: tri('Najtanje sočivo koje izrađujemo', 'Lentja më e hollë që punojmë', 'The thinnest lens we make') },
];

/* ------------------------------------------------------------------ */
/* Prescription explainer                                               */
/* ------------------------------------------------------------------ */
export type RxTerm = 'eye' | 'sph' | 'cyl' | 'axis' | 'add' | 'pd';

export const RX_TERMS: { id: RxTerm; short: string; name: L10n; text: L10n }[] = [
  {
    id: 'eye',
    short: 'OD / OS',
    name: tri('Desno i levo oko', 'Syri i djathtë dhe i majtë', 'Right and left eye'),
    text: tri('OD je desno oko, OS levo. Svaki red recepta pripada jednom oku — vrednosti se nikad ne mešaju.', 'OD është syri i djathtë, OS i majti. Çdo rresht i recetës i përket një syri — vlerat nuk përzihen kurrë.', 'OD is the right eye, OS the left. Each row belongs to one eye — the values are never mixed.'),
  },
  {
    id: 'sph',
    short: 'SPH',
    name: tri('Sfera', 'Sfera', 'Sphere'),
    text: tri('Glavna jačina u dioptrijama. Minus obično znači kratkovidost (slabije vidite daleko), plus dalekovidost.', 'Fuqia kryesore në dioptri. Minus zakonisht do të thotë miopi (shihni keq larg), plus hipermetropi.', 'The main power in dioptres. Minus usually means short-sight (distance is blurry), plus means long-sight.'),
  },
  {
    id: 'cyl',
    short: 'CYL',
    name: tri('Cilindar', 'Cilindri', 'Cylinder'),
    text: tri('Jačina za astigmatizam. Ako polje stoji prazno, astigmatizma nema ili je zanemarljiv.', 'Fuqia për astigmatizmin. Nëse fusha është bosh, astigmatizëm nuk ka ose është i papërfillshëm.', 'The power for astigmatism. If it’s blank, there is no astigmatism to correct.'),
  },
  {
    id: 'axis',
    short: 'AX',
    name: tri('Osa', 'Boshti', 'Axis'),
    text: tri('Ugao cilindra, od 0 do 180°. Uvek ide uz CYL i prepisuje se tačno kako stoji.', 'Këndi i cilindrit, nga 0 deri në 180°. Shkon gjithmonë me CYL dhe kopjohet saktësisht siç është.', 'The angle of the cylinder, from 0 to 180°. It always comes with CYL and is copied exactly.'),
  },
  {
    id: 'add',
    short: 'ADD',
    name: tri('Adicija', 'Shtesa', 'Addition'),
    text: tri('Dodatna jačina za blizinu — za progresivna sočiva i naočare za čitanje. Obično je ista za oba oka.', 'Fuqia shtesë për afër — për lente progresive dhe syze leximi. Zakonisht është e njëjtë për të dy sytë.', 'Extra power for near vision — for progressives and reading glasses. Usually the same for both eyes.'),
  },
  {
    id: 'pd',
    short: 'PD',
    name: tri('Zenični razmak', 'Distanca pupilare', 'Pupillary distance'),
    text: tri('Razmak između zenica u milimetrima, često posebno za svako oko. Ako ga nema na receptu, izmerićemo ga besplatno.', 'Distanca mes bebëzave në milimetra, shpesh veç për secilin sy. Nëse nuk është në recetë, e masim falas.', 'The distance between your pupils in millimetres, often per eye. If it isn’t on your prescription, we measure it for free.'),
  },
];

/* ------------------------------------------------------------------ */
/* From prescription to lens (lab)                                      */
/* ------------------------------------------------------------------ */
export const LAB_STEPS: { title: L10n; text: L10n }[] = [
  { title: tri('Vaš recept', 'Receta juaj', 'Your prescription'), text: tri('Donesite recept koji imate ili zakažite pregled — izbor počinje od vaših potreba.', 'Sillni recetën që keni ose rezervoni një kontroll — zgjedhja nis nga nevoja juaj.', 'Bring the prescription you have or book an exam — the choice starts with your needs.') },
  { title: tri('Okvir na licu', 'Korniza në fytyrë', 'The frame on your face'), text: tri('Prvo podešavamo okvir, pa tek onda određujemo položaj sočiva.', 'Së pari e përshtatim kornizën, pastaj përcaktojmë vendosjen e lenteve.', 'We adjust the frame first, then decide where the lenses sit.') },
  { title: tri('Lična merenja', 'Matjet personale', 'Personal measurements'), text: tri('PD i visina montaže mere se na okviru koji ste izabrali — besplatno.', 'PD-ja dhe lartësia e montimit maten në kornizën që keni zgjedhur — falas.', 'PD and fitting height are measured on the frame you chose — free of charge.') },
  { title: tri('Laboratorija i preuzimanje', 'Laboratori & dorëzimi', 'Lab & handover'), text: tri('Optical Lab izrađuje sočiva za 2–7 radnih dana; pre predaje proveravamo jačinu i montažu.', 'Optical Lab i punon lentet për 2–7 ditë pune; para dorëzimit kontrollojmë fuqinë dhe montimin.', 'Optical Lab makes the lenses in 2–7 working days; we check power and mounting before handover.') },
];

export const ADVICE_SLUGS = ['si-ta-lexoni-receten', 'lentet-progresive', 'lentet-per-ekran-drita-blu', 'polarizim-apo-uv400'];

/* ------------------------------------------------------------------ */
/* FAQ                                                                  */
/* ------------------------------------------------------------------ */
export const LENS_FAQ: { q: L10n; a: L10n }[] = [
  {
    q: tri('Koliko traje izrada sočiva?', 'Sa kohë duhet për lentet?', 'How long do the lenses take?'),
    a: tri('Od 2 do 7 radnih dana, zavisno od paketa: jednožižna i za ekran 2–4 dana, progresivna 4–6, ultra tanka 1.74 do 7 dana. Javljamo vam se čim su gotova.', 'Nga 2 deri në 7 ditë pune, sipas paketës: njëvizoret dhe për ekran 2–4 ditë, progresivet 4–6, ultra të hollat 1.74 deri në 7 ditë. Ju njoftojmë sapo të jenë gati.', 'From 2 to 7 working days depending on the package: single-vision and screen 2–4 days, progressives 4–6, ultra-thin 1.74 up to 7 days. We let you know as soon as they’re ready.'),
  },
  {
    q: tri('Mogu li da donesem svoj okvir?', 'A mund ta sjell kornizën time?', 'Can I bring my own frame?'),
    a: tri('Da. Ugrađujemo nova sočiva u vaš okvir ako je u dobrom stanju — proverićemo ga u optici pre nego što potvrdimo porudžbinu.', 'Po. Montojmë lente të reja në kornizën tuaj nëse është në gjendje të mirë — e kontrollojmë në optikë para se ta konfirmojmë porosinë.', 'Yes. We fit new lenses into your own frame if it’s in good condition — we check it in store before confirming the order.'),
  },
  {
    q: tri('Šta ako nemam recept?', 'Po nëse nuk kam recetë?', 'What if I don’t have a prescription?'),
    a: tri('Zakažite pregled vida kod nas: 15 €, besplatno uz kupovinu okvira. Recept dobijate na licu mesta.', 'Rezervoni kontrollin e syve te ne: 15 €, falas me blerjen e kornizës. Recetën e merrni në vend.', 'Book an eye exam with us: €15, free with a frame purchase. You get your prescription on the spot.'),
  },
  {
    q: tri('Koliko se navikava na progresivna sočiva?', 'Sa kohë duhet për t’u mësuar me progresivet?', 'How long does it take to get used to progressives?'),
    a: tri('Većini ljudi nekoliko dana. Ako se ni posle toga ne osećate prijatno, svratite — kontrola prilagođavanja je besplatna.', 'Shumicës së njerëzve disa ditë. Nëse edhe pas kësaj nuk ndiheni rehat, ejani — kontrolli i përshtatjes është falas.', 'For most people a few days. If you still don’t feel comfortable after that, drop by — the adaptation check is free.'),
  },
  {
    q: tri('Da li mi je potreban filter plavog svetla?', 'A më duhet filtri i dritës blu?', 'Do I need a blue-light filter?'),
    a: tri('Nije obavezan. Može da smanji odsjaj sa ekrana, ali nema dokaza da sprečava zamor ili bolesti oka. Ako dugo radite za računarom, važnije su pauze i dobra udaljenost od ekrana.', 'Nuk është i detyrueshëm. Mund ta ulë reflektimin nga ekrani, por nuk ka dëshmi se parandalon lodhjen apo sëmundjet e syve. Nëse punoni gjatë në kompjuter, më të rëndësishme janë pushimet dhe distanca e mirë nga ekrani.', 'It’s optional. It can cut screen glare, but there’s no evidence it prevents eye strain or disease. If you work long hours at a computer, breaks and a good screen distance matter more.'),
  },
  {
    q: tri('Kakvu garanciju imaju sočiva?', 'Çfarë garancie kanë lentet?', 'What warranty do the lenses have?'),
    a: tri('Paketi sočiva imaju 1 godinu garancije na izradu i slojeve. Za okvire je dostupan i Nega+ — 12 meseci zaštite od loma.', 'Paketat e lenteve kanë 1 vit garanci për punimin dhe shtresat. Për kornizat ofrohet edhe Kujdes+ — 12 muaj mbrojtje nga thyerja.', 'Lens packages carry a 1-year warranty on workmanship and coatings. For frames there’s also Care+ — 12 months of breakage cover.'),
  },
];
