export const editorialMedia = {
  labKosovoImage: ['Optical Lab · Kosovë', '/assets/brand/optika-craftsmanship-2026.webp', true],
  labEuropeImage: ['Optical Lab · European partnerships', '/assets/brand/miftari-lab-partnership.webp', true],
  opticalLifestyleImage: ['Optical · stil dhe jetë', '/assets/brand/miftari-optical-lifestyle.webp', true],
  groupHeroImage: ['Ballina · fushata editoriale', '/assets/brand/atelier-optical-2026.webp', true],
  groupSunImage: ['Ballina · jetë me syze dielli', '/assets/brand/atelier-sun-2026.webp', true],
  groupCraftImage: ['Ballina · mjeshtëria optike', '/assets/brand/miftari-craft-campaign.webp', true],
  groupOpticalImage: ['Grupi · Optical', '/assets/brand/optika-home-category-2026.webp', true],
  groupLabImage: ['Grupi · Optical Lab', '/assets/brand/optika-miftari-lens-verification.webp', false],
  clinicImage: ['Klinika · vizual ilustrues', '/assets/brand/miftari-clinic-2026.webp', true],
  heroImage: ['Optical · fotografia kryesore', '/assets/brand/atelier-optical-2026.webp', true],
  homeCollectionImage: ['Optical · koleksionet', '/assets/brand/optika-home-category-2026.webp', true],
  laboratoryImage: ['Laboratori · punimi', '/assets/brand/optika-craftsmanship-2026.webp', true],
  examinationImage: ['Ekzaminimi · kontrolli', '/assets/brand/optika-examination-2026.webp', true],
  aboutImage: ['Rreth nesh · tradita', '/assets/brand/optika-miftari-generational-craft.webp', false],
  prescriptionImage: ['Me dioptri · fushata', '/assets/brand/optika-optical-2026.webp', true],
  sunglassesImage: ['Syze dielli · fushata', '/assets/brand/atelier-sun-2026.webp', true],
  lensDetailImage: ['Lens Focus · sipërfaqja e lentes', '/assets/brand/optika-lens-detail-2026.webp', true],
  contactImage: ['Kontakti · përshtatja', '/assets/brand/optika-contact-2026.webp', true],
};

export function safeEditorialImage(value) {
  return typeof value === 'string' && /^\/(?:assets|uploads)\/[a-zA-Z0-9_/-]+\.(?:webp|png|jpe?g)$/i.test(value) ? value : '';
}
