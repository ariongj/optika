export const lensChoices = [
  { id: 'progressive', label: 'Progresive', need: 'Disa distanca', title: 'Një palë. Nga largësia te leximi.', copy: 'Për ju që përdorni shikimin në disa distanca gjatë ditës. Receta, korniza dhe matjet personale përcaktojnë zgjedhjen.', use: 'Përditshmëri, ekran dhe lexim', discuss: 'Rutina juaj dhe përshtatja me lentet', note: 'Zonat dhe distancat në ilustrim janë orientuese, jo një simulim i recetës suaj.', zones: ['Larg', 'Ekran', 'Afër'] },
  { id: 'single', label: 'Monofokale', need: 'Një distancë', title: 'Qartësi aty ku ju duhet.', copy: 'Një korrigjim për një distancë të caktuar: për larg ose për afër, sipas recetës. Optiku ju ndihmon të zgjidhni materialin dhe përshtatjen.', use: 'Larg ose afër, sipas recetës', discuss: 'Distanca kryesore e përdorimit', note: 'Një lente monofokale nuk korrigjon njëkohësisht çdo distancë.', zones: ['Një distancë'] },
  { id: 'office', label: 'Zyrë & ekran', need: 'Puna nga afër', title: 'Për hapësirën ku punoni.', copy: 'Lexim, ekran dhe distanca pune në ambient të brendshëm. Sillni distancën e monitorit dhe tregojini optikut si kaloni ditën.', use: 'Tavolinë, monitor dhe lexim', discuss: 'Distanca e ekranit dhe kufijtë e përdorimit', note: 'Përshtatshmëria për aktivitete të tjera, përfshirë drejtimin e automjetit, konfirmohet me optikun.', zones: ['Ekran', 'Lexim'] },
  { id: 'sun', label: 'Dritë & diell', need: 'Brenda dhe jashtë', title: 'Zgjedhje për dritën e ditës.', copy: 'Lente dielli me recetë, opsione fotokromatike ose polarizim. Janë zgjedhje të ndryshme; i krahasojmë sipas mënyrës si do t’i përdorni.', use: 'Aktivitete jashtë dhe dritë e ndryshueshme', discuss: 'Nuanca, polarizimi dhe specifikimi UV', note: 'Ngjyra e lentes nuk është provë e mbrojtjes UV. Kontrolloni specifikimin e produktit me optikun.', zones: ['Dritë & diell'] },
];

export const lensTreatments = [
  ['Antirefleks', 'Për të kufizuar reflektimet në sipërfaqen e lentes. Pyetni për trajtimin që ofrohet me lentet tuaja.'],
  ['Shtresë mbrojtëse', 'Për rezistencë më të mirë gjatë përdorimit. Nuk e bën lenten të pagërvishtshme.'],
  ['Pastrimi i sipërfaqes', 'Trajtimet hidrofobike dhe oleofobike mund të lehtësojnë pastrimin. Ndiqni udhëzimet e kujdesit.'],
  ['Mbrojtja UV', 'Konfirmohet nga specifikimi i lentes së zgjedhur, jo vetëm nga errësia apo ngjyra e saj.'],
];

export const lensMeasurements = [
  ['01', 'Receta juaj', 'Sillni recetën që keni ose rezervoni një ekzaminim. Zgjedhja nis nga nevoja juaj për shikim.'],
  ['02', 'Korniza në fytyrë', 'Përshtatim pozicionin e kornizës përpara se të përcaktojmë vendosjen e lenteve.'],
  ['03', 'Matjet personale', 'Distanca pupillare dhe lartësia e montimit lidhen me kornizën. Matjet shtesë varen nga sistemi i lentes.'],
  ['04', 'Kontrolli & dorëzimi', 'Optical Lab punon lentet; në optikë kontrollojmë montimin dhe bëjmë përshtatjen finale.'],
];
