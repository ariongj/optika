// Client-confirmed structure: Lab B2B in Kosovo/EU; clinic in Kosovo.
// Named clinicians and individual procedures still require confirmation.
export const holdingDefaults = {
  groupTitle: 'Shikim i qartë. Stil që ju shkon.',
  groupSubtitle: 'Syze që ju ngjajnë. Lente të punuara për ju. Dhe kujdesi i një familjeje, prej 30 vjetësh.',
  groupSeoTitle: 'Miftari Holding Group | Optical, Optical Lab & Klinika Miftari',
  groupSeoDescription: '30 vjet kujdes familjar. Syze optike dhe dielli, lente me recetë në laboratorin privat dhe Klinika Miftari. Zbuloni Miftari Holding Group.',
  labTitle: 'Receta juaj. Precizioni ynë.',
  labSubtitle: 'Optical Lab lidh recetën, matjet dhe kornizën në një proces të vetëm: përgatitje, centrim, montim dhe kontroll përfundimtar.',
  labSeoTitle: 'Optical Lab | Lente me recetë dhe punim optik — Miftari',
  labSeoDescription: 'Laboratori optik i Miftari Holding Group. Punim i lenteve me recetë, montim dhe kontroll i porosisë. Kontakt për klientë dhe bashkëpunim profesional.',
  clinicTitle: 'Kujdesi për sytë fillon me ju.',
  clinicSubtitle: 'Klinika Miftari është pjesa klinike e grupit: kujdesi specialistik për sytë, konsultimi dhe vlerësimi për trajtim.',
  clinicSeoTitle: 'Klinika Miftari | Kujdes specialistik për sytë',
  clinicSeoDescription: 'Kontaktoni Klinika Miftari për informacion mbi konsultat specialistike dhe vlerësimin për trajtim. Shërbimi, specialisti dhe orari konfirmohen nga ekipi.',
  partnersTitle: 'Punojmë më mirë, së bashku.',
  partnersSubtitle: 'Jeni optikë apo profesionist i fushës? Flisni me Optical Lab për punimin e lenteve me recetë dhe mënyrën e bashkëpunimit.',
  partnersSeoTitle: 'Partnerë profesionalë | Miftari Optical Lab',
  partnersSeoDescription: 'Dërgoni një kërkesë bashkëpunimi te Miftari Optical Lab. Specifikimet, kapaciteti, afatet dhe kushtet konfirmohen individualisht.',
  labKosovoTitle: 'Laboratori juaj. Më afër biznesit tuaj.',
  labKosovoSubtitle: 'Lente me recetë, montim dhe kontroll për optikat dhe profesionistët në Kosovë. Një bashkëpunim i drejtpërdrejtë me Optical Lab, pjesë e Miftari Holding Group.',
  labKosovoSeoTitle: 'Optical Lab Kosovë | Partneritet B2B — Miftari',
  labKosovoSeoDescription: 'Aplikoni për bashkëpunim me Optical Lab në Kosovë. Punim i lenteve me recetë, montim dhe verifikim. Kushtet konfirmohen individualisht.',
  labEuropeTitle: 'Your practice. Our optical craft.',
  labEuropeSubtitle: 'A direct prescription-lens partnership for optical professionals in the European Union. Work with Optical Lab, the production division of Miftari Holding Group in Kosovo.',
  labEuropeSeoTitle: 'Optical Lab Europe | B2B Lens Partnerships — Miftari',
  labEuropeSeoDescription: 'Explore a prescription-lens partnership with Miftari Optical Lab in Kosovo. Request technical documentation and discuss your EU market requirements before ordering.',
  labDocumentationNoteSq: 'Dokumentacioni teknik dhe çdo dëshmi certifikimi shqyrtohen sipas produktit dhe tregut. Në këtë faqe nuk publikohen pretendime certifikimi pa dokumente të verifikuara.',
  labDocumentationNoteEn: 'Technical documents and any certification evidence are reviewed for the specific product and destination market. No verified certificates are currently published on this page.',
};

export const groupRoutes = { home: '/', optical: '/optical', clinic: '/clinic', partners: '/laboratory/partners', labKosovo: '/laboratory/kosovo', labEurope: '/laboratory/europe' };
export const divisionNames = { optical: 'Optical', lab: 'Optical Lab', clinic: 'Klinika Miftari' };
export function holdingCopy(content = {}) {
  return Object.fromEntries(Object.entries(holdingDefaults).map(([key, fallback]) => [key, typeof content[key] === 'string' && content[key].trim() ? content[key] : fallback]));
}
export const enquiryTopics = {
  clinic: ['Konsultë me specialistin e syve', 'Informacion për vlerësim kirurgjikal', 'Informacion për vizitë kontrolli'],
  lab: ['Bashkëpunim për lente me recetë', 'Montim dhe kontroll i porosive', 'Informacion për bashkëpunim profesional'],
};
export function divisionName(value) { return divisionNames[value] || divisionNames.optical; }
export function enquiryError(code) {
  if (code === 'consent_required') return 'Ju lutem pranoni përdorimin e kontaktit për këtë kërkesë.';
  if (code === 'invalid_email') return 'Kontrolloni adresën e emailit.';
  if (code === 'too_many_attempts' || code === 'rate_limit_exceeded') return 'Shumë kërkesa. Provoni më vonë ose na telefononi.';
  return 'Nuk morëm konfirmim. Të dhënat mbeten në formular; provoni përsëri ose na telefononi.';
}
