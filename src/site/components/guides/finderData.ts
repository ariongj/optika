import type { L10n } from '@/lib/types';
import type { FrameShape } from '@/site/tryon/frames';
import { tri } from './lensData';

/* ------------------------------------------------------------------ */
/* Quiz answers                                                         */
/* ------------------------------------------------------------------ */
export type Kind = 'optical' | 'sun' | 'both';
export type Face = 'oval' | 'round' | 'square' | 'heart' | 'long' | 'unknown';
export type Style = 'classic' | 'minimal' | 'bold' | 'sport';
export type Material = 'metal' | 'dark' | 'warm' | 'clear';
export type Fit = 'narrow' | 'medium' | 'wide' | 'unknown';

export interface Answers {
  kind?: Kind;
  face?: Face;
  style?: Style;
  material?: Material;
  fit?: Fit;
}
export type StepKey = keyof Answers;

/** Quiz steps in order, with the query-string key used for shareable results. */
export const STEPS: { key: StepKey; param: string }[] = [
  { key: 'kind', param: 'lloji' },
  { key: 'face', param: 'fytyra' },
  { key: 'style', param: 'stili' },
  { key: 'material', param: 'materiali' },
  { key: 'fit', param: 'gjeresia' },
];

export interface Opt<T extends string> {
  id: T;
  label: L10n;
  hint: L10n;
}

export const KINDS: Opt<Kind>[] = [
  { id: 'optical', label: tri('Dioptrijske naočare', 'Syze optike', 'Optical glasses'), hint: tri('Za svaki dan, sa dioptrijom ili bez', 'Për çdo ditë, me ose pa dioptri', 'For every day, with or without a prescription') },
  { id: 'sun', label: tri('Naočare za sunce', 'Syze dielli', 'Sunglasses'), hint: tri('UV400, polarizovane, i sa dioptrijom', 'UV400, të polarizuara, edhe me dioptri', 'UV400, polarised, prescription-ready too') },
  { id: 'both', label: tri('Oboje', 'Të dyja', 'Both'), hint: tri('Pokazaćemo najbolje od obe vrste', 'Ju tregojmë më të mirat nga të dyja', 'We’ll show the best of both') },
];

export const FACES: Opt<Face>[] = [
  { id: 'oval', label: tri('Ovalno', 'Ovale', 'Oval'), hint: tri('Malo duže nego šire, meka vilica — pristaje vam većina oblika.', 'Pak më e gjatë se e gjerë, nofull e butë — ju rrinë shumica e formave.', 'A little longer than wide, soft jaw — most shapes suit you.') },
  { id: 'round', label: tri('Okruglo', 'E rrumbullakët', 'Round'), hint: tri('Širina i dužina skoro iste, puni obrazi — probajte uglaste linije.', 'Gjerësia dhe gjatësia gati të njëjta, faqe të plota — provoni linja këndore.', 'Width and length about equal, full cheeks — try angular lines.') },
  { id: 'square', label: tri('Kvadratno', 'Katrore', 'Square'), hint: tri('Široko čelo i izražena vilica — okrugli oblici ga ublažavaju.', 'Ball i gjerë dhe nofull e fortë — format e rrumbullakëta e zbusin.', 'Broad forehead and a strong jaw — round shapes soften it.') },
  { id: 'heart', label: tri('Srcoliko', 'Zemër', 'Heart'), hint: tri('Široko čelo, uska brada — okviri lakši gore ili blagi cat-eye.', 'Ball i gjerë, mjekër e ngushtë — korniza të lehta sipër ose cat-eye e butë.', 'Wide forehead, narrow chin — light-topped frames or a soft cat-eye.') },
  { id: 'long', label: tri('Duguljasto', 'E gjatë', 'Long'), hint: tri('Primetno duže nego šire — dublja sočiva i širi okviri.', 'Dukshëm më e gjatë se e gjerë — lente më të larta dhe korniza më të gjera.', 'Clearly longer than wide — deeper lenses and wider frames.') },
  { id: 'unknown', label: tri('Ne znam', 'Nuk e di', 'Not sure'), hint: tri('Nema problema — biramo prema stilu i veličini.', 'S’ka problem — zgjedhim sipas stilit dhe madhësisë.', 'No problem — we’ll match on style and size.') },
];

export const STYLES: Opt<Style>[] = [
  { id: 'classic', label: tri('Klasično', 'Klasike', 'Classic'), hint: tri('Provereni oblici: pravougaoni, avijator, panto', 'Linja të provuara: drejtkëndore, aviator, panto', 'Proven lines: rectangle, aviator, panto') },
  { id: 'minimal', label: tri('Moderno i minimalistički', 'Moderne & minimaliste', 'Modern & minimal'), hint: tri('Tanak profil, čisti detalji', 'Profil i hollë, detaje të pastra', 'Slim profile, clean details') },
  { id: 'bold', label: tri('Upečatljivo', 'E guximshme', 'Bold'), hint: tri('Debeo acetat, oblici sa karakterom', 'Acetat i trashë, forma me karakter', 'Thick acetate, shapes with character') },
  { id: 'sport', label: tri('Sportski', 'Sportive', 'Sporty'), hint: tri('Obuhvatni oblici, stabilni u pokretu', 'Forma mbështjellëse, të qëndrueshme në lëvizje', 'Wrap shapes that stay put on the move') },
];

export const MATERIALS: Opt<Material>[] = [
  { id: 'metal', label: tri('Tanak metal', 'Metal i hollë', 'Thin metal'), hint: tri('Lagani titan, skoro nevidljiv', 'Titan i lehtë, gati i padukshëm', 'Light titanium, almost invisible') },
  { id: 'dark', label: tri('Tamni acetat', 'Acetat i errët', 'Dark acetate'), hint: tri('Crna, grafit, teget', 'E zezë, grafit, blu e errët', 'Black, graphite, navy') },
  { id: 'warm', label: tri('Kornjača i topli tonovi', 'Breshkë & ngjyra të ngrohta', 'Tortoise & warm tones'), hint: tri('Havana, ćilibar, karamel, zlato', 'Havanë, qelibar, karamel, ar', 'Havana, amber, caramel, gold') },
  { id: 'clear', label: tri('Providno', 'Transparente', 'Transparent'), hint: tri('Kristal i providni tonovi', 'Kristal dhe tone të tejdukshme', 'Crystal and translucent tones') },
];

export const FITS: Opt<Fit>[] = [
  { id: 'narrow', label: tri('Uže', 'E ngushtë', 'Narrow'), hint: tri('Okviri ispod 135 mm', 'Korniza nën 135 mm', 'Frames under 135 mm') },
  { id: 'medium', label: tri('Srednje', 'Mesatare', 'Medium'), hint: tri('Okviri 135–140 mm', 'Korniza 135–140 mm', 'Frames 135–140 mm') },
  { id: 'wide', label: tri('Šire', 'E gjerë', 'Wide'), hint: tri('Okviri preko 140 mm', 'Korniza mbi 140 mm', 'Frames over 140 mm') },
  { id: 'unknown', label: tri('Ne znam', 'Nuk e di', 'Not sure'), hint: tri('Izmerićemo u optici, besplatno', 'Ua masim në optikë, falas', 'We’ll measure in store, free') },
];

export const OPTIONS = { kind: KINDS, face: FACES, style: STYLES, material: MATERIALS, fit: FITS } as const;

/* ------------------------------------------------------------------ */
/* Scoring tables (0–1)                                                 */
/* ------------------------------------------------------------------ */
type ShapeTable = Record<FrameShape, number>;

/** How well a frame shape balances each face shape (the classic "contrast" rule, softened). */
export const FACE_FIT: Record<Exclude<Face, 'unknown'>, ShapeTable> = {
  oval: { rectangle: 1, square: 0.9, round: 0.9, panto: 1, aviator: 1, 'cat-eye': 0.9, geometric: 0.9, wrap: 0.7 },
  round: { rectangle: 1, square: 1, geometric: 0.9, 'cat-eye': 0.7, aviator: 0.6, wrap: 0.6, panto: 0.45, round: 0.2 },
  square: { round: 1, panto: 1, aviator: 0.85, 'cat-eye': 0.8, geometric: 0.5, wrap: 0.5, rectangle: 0.4, square: 0.2 },
  heart: { round: 0.9, aviator: 0.95, 'cat-eye': 0.85, panto: 0.8, rectangle: 0.6, geometric: 0.6, wrap: 0.5, square: 0.4 },
  long: { square: 1, aviator: 0.9, panto: 0.85, round: 0.8, geometric: 0.8, 'cat-eye': 0.6, rectangle: 0.5, wrap: 0.5 },
};

export const STYLE_SHAPE: Record<Style, ShapeTable> = {
  classic: { rectangle: 1, aviator: 1, panto: 0.9, square: 0.75, round: 0.7, 'cat-eye': 0.6, geometric: 0.45, wrap: 0.1 },
  minimal: { rectangle: 1, round: 1, panto: 0.8, aviator: 0.6, geometric: 0.6, 'cat-eye': 0.5, square: 0.5, wrap: 0.1 },
  bold: { square: 1, geometric: 1, 'cat-eye': 0.95, panto: 0.8, aviator: 0.7, round: 0.6, rectangle: 0.55, wrap: 0.6 },
  sport: { wrap: 1, aviator: 0.45, rectangle: 0.2, square: 0.2, geometric: 0.15, round: 0.1, panto: 0.1, 'cat-eye': 0.1 },
};

/** Frame width ranges (mm) per face-width answer. */
export const FIT_RANGE: Record<Exclude<Fit, 'unknown'>, [number, number]> = {
  narrow: [0, 134.9],
  medium: [135, 140],
  wide: [140.1, 999],
};

export const WEIGHTS = { face: 30, style: 25, material: 25, fit: 20 } as const;

/* ------------------------------------------------------------------ */
/* Reason copy                                                          */
/* ------------------------------------------------------------------ */
export const FACE_WHY: Record<Exclude<Face, 'unknown'>, L10n> = {
  oval: tri('ovalno lice lako nosi ovaj oblik', 'fytyra ovale e mban lehtë këtë formë', 'an oval face carries this shape with ease'),
  round: tri('uglaste linije daju strukturu okruglom licu', 'linjat këndore i japin strukturë fytyrës së rrumbullakët', 'angular lines add structure to a round face'),
  square: tri('meke linije ublažavaju izraženu vilicu', 'linjat e buta e zbusin nofullën e fortë', 'softer lines balance a strong jaw'),
  heart: tri('uravnotežuje šire čelo i uzanu bradu', 'balancon ballin më të gjerë dhe mjekrën e hollë', 'balances a wider forehead and a narrow chin'),
  long: tri('dublja sočiva optički skraćuju lice', 'lentet më të larta e shkurtojnë optikisht fytyrën', 'deeper lenses visually shorten a long face'),
};

export const STYLE_WHY: Record<Style, L10n> = {
  classic: tri('Klasična silueta koja ne izlazi iz mode', 'Siluetë klasike që nuk del nga moda', 'A classic silhouette that never dates'),
  minimal: tri('Tanak, minimalistički profil', 'Profil i hollë, minimalist', 'A slim, minimal profile'),
  bold: tri('Upečatljiv oblik sa karakterom', 'Formë e guximshme me karakter', 'A confident shape with real character'),
  sport: tri('Obuhvatni oblik koji stoji stabilno u pokretu', 'Formë mbështjellëse që qëndron e palëvizur në lëvizje', 'A wrap shape that stays put on the move'),
};

export const MINIMAL_LIGHT = tri('Tanak i lagan profil — samo {weight}', 'Profil i hollë dhe i lehtë — vetëm {weight}', 'Slim and light — just {weight}');
export const METAL_WHY = tri('{material} — lagano za ceo dan', '{material} — e lehtë për gjithë ditën', '{material} — light enough for all day');
export const COLOUR_WHY: Record<Exclude<Material, 'metal'>, L10n> = {
  dark: tri('Duboka, elegantna boja: {colour}', 'Ngjyrë e thellë dhe elegante: {colour}', 'A deep, polished colour: {colour}'),
  warm: tri('Topli tonovi koji osvežavaju lice: {colour}', 'Tone të ngrohta që i japin dritë fytyrës: {colour}', 'Warm tones that light up the face: {colour}'),
  clear: tri('Providno i nenametljivo: {colour}', 'Transparente dhe e lehtë për syrin: {colour}', 'Translucent and easy on the eye: {colour}'),
};
export const FIT_WHY = tri('Širina {width} mm — za {size} lice', '{width} mm gjerësi — për fytyrë {size}', '{width} mm wide — made for a {size} face');
export const FIT_SIZE: Record<Exclude<Fit, 'unknown'>, L10n> = {
  narrow: tri('uže', 'të ngushtë', 'narrow'),
  medium: tri('srednje', 'mesatare', 'medium'),
  wide: tri('šire', 'të gjerë', 'wide'),
};
export const RX_WHY = tri('Spreman za dioptrijska sočiva iz naše laboratorije', 'Gati për lente me dioptri nga laboratori ynë', 'Ready for prescription lenses from our lab');
export const SUN_RX_WHY = tri('Može da se izradi i sa vašom dioptrijom', 'Mund të punohet edhe me dioptrinë tuaj', 'Can be made with your prescription too');
export const POLAR_WHY = tri('Polarizovana sočiva protiv odsjaja', 'Lente të polarizuara kundër shkëlqimit', 'Polarised lenses against glare');
export const BEST_WHY = tri('Jedan od najtraženijih okvira u optici', 'Ndër kornizat më të kërkuara në optikë', 'One of our most-chosen frames');

/** Fallback names for frame shapes (frames without a Shape spec). */
export const SHAPE_NAME: Record<FrameShape, L10n> = {
  rectangle: tri('Pravougaoni', 'Drejtkëndore', 'Rectangle'),
  square: tri('Kvadratni', 'Katrore', 'Square'),
  round: tri('Okrugli', 'E rrumbullakët', 'Round'),
  panto: tri('Panto', 'Panto', 'Panto'),
  aviator: tri('Avijator', 'Aviator', 'Aviator'),
  'cat-eye': tri('Cat-eye', 'Cat-eye', 'Cat-eye'),
  geometric: tri('Geometrijski', 'Gjeometrike', 'Geometric'),
  wrap: tri('Sportski', 'Sportive', 'Sport wrap'),
};

/* ------------------------------------------------------------------ */
/* Face-shape guide (below the quiz)                                    */
/* ------------------------------------------------------------------ */
export const FACE_GUIDE: { face: Exclude<Face, 'unknown'>; shapes: FrameShape[] }[] = [
  { face: 'oval', shapes: ['rectangle', 'aviator', 'panto'] },
  { face: 'round', shapes: ['rectangle', 'square', 'geometric'] },
  { face: 'square', shapes: ['round', 'panto', 'aviator'] },
  { face: 'heart', shapes: ['aviator', 'round', 'cat-eye'] },
  { face: 'long', shapes: ['square', 'aviator', 'panto'] },
];
