// Curated site guidance, not an AI service or a staffed live chat. These answers
// intentionally contain no prices, inventory promises, medical advice or ETAs.
export const helpExcludedPages = new Set(['admin', 'account', 'product', 'fit', 'guides']);
export const helpCartPages = new Set(['shop', 'prescription', 'sunglasses']);

export function helpIsAvailable(page, blocked = false) {
  return Boolean(page) && !blocked && !helpExcludedPages.has(page);
}

const route = (page, path, label) => ({ page, path, label });
const sq = {
  launcher: 'Ndihmë', title: 'Si mund t’ju ndihmojmë?', eyebrow: 'Udhëzues i faqes',
  intro: 'Zgjidhni temën për një përgjigje të shkurtër dhe hapin e duhur.',
  close: 'Mbyll ndihmën', back: 'Të gjitha temat', topicsLabel: 'Temat e ndihmës',
  disclosure: 'Përgjigje të përgatitura, jo inteligjencë artificiale apo bisedë live. Për këshillë personale, kontaktoni ekipin.',
  contact: 'Flisni me ekipin', call: 'Telefononi', whatsapp: 'Hap WhatsApp',
  topics: {
    frames: { title: 'Si t’i zgjedh kornizat?', body: 'Filtroni sipas formës, materialit dhe përmasave. Hapni modelin për të krahasuar variantet pa humbur vendin në katalog. Përshtatja përfundimtare kontrollohet në optikë.', actions: [route('shop', '/shop', 'Shfleto kornizat'), route('fit', '/virtual-try-on', 'Provo virtualisht')] },
    prescription: { title: 'Kam nevojë për lente me recetë', body: 'Zgjidhni kornizën dhe konfigurimin e lenteve, pastaj kërkoni verifikimin nga optiku. Receta, matjet dhe përshtatshmëria kontrollohen para punimit. Mos dërgoni diagnoza ose dokumente mjekësore këtu.', actions: [route('prescription', '/prescription-glasses', 'Shiko syzet optike'), route('contact', '/contact#booking', 'Kërko këshillim')] },
    order: { title: 'Porosia dhe pagesa', body: 'Mund të vazhdoni edhe pa llogari. Kontrolloni artikujt, kontaktin dhe dërgesën përpara kërkesës. Dërgimi nuk kryen pagesë me kartë: ekipi konfirmon stokun, totalin dhe mënyrën e pagesës.', actions: [{ action: 'cart', label: 'Hap shportën' }, route('orderStatus', '/order-status', 'Gjurmo kërkesën')] },
    tryon: { title: 'Sa e saktë është prova 3D?', body: 'Prova virtuale ju ndihmon të vlerësoni stilin dhe përmasat në ekran. Pamja, ngjyrat dhe matjet orientuese nuk garantojnë përshtatjen reale dhe nuk zëvendësojnë matjet apo kontrollin nga optiku.', actions: [route('fit', '/virtual-try-on', 'Hap provën virtuale'), route('contact', '/contact#booking', 'Kërko përshtatje në optikë')] },
    clinic: { title: 'Dua një konsultë për sytë', body: 'Dërgoni kërkesën te Klinika Miftari për kontakt nga ekipi. Shërbimi, specialisti dhe orari konfirmohen individualisht; plotësimi i formularit nuk është një takim i konfirmuar.', actions: [route('clinic', '/clinic#clinic-enquiry', 'Kontakto klinikën')] },
    partners: { title: 'Bashkëpunim me Optical Lab', body: 'Optical Lab ka formularë të veçantë për partnerët në Kosovë dhe Bashkimin Evropian. Aplikimi hap një diskutim me ekipin, jo një llogari partneri ose porosi të miratuar. Përdorni vetëm të dhëna biznesi, pa të dhëna pacientësh.', actions: [route('labKosovo', '/laboratory/kosovo#application', 'Partneritet në Kosovë'), route('labEurope', '/laboratory/europe#application', 'EU partnerships · English')] },
  },
};

const en = {
  launcher: 'Help', title: 'How can we help?', eyebrow: 'Website guide',
  intro: 'Choose a topic for a short answer and the next step.',
  close: 'Close help', back: 'All topics', topicsLabel: 'Help topics',
  disclosure: 'Prepared guidance, not AI or live chat. Contact the team for advice specific to your business.',
  contact: 'Talk to the team', call: 'Call the team', whatsapp: 'Open WhatsApp',
  topics: {
    partners: { title: 'Apply for an EU partnership', body: 'Use the EU application to tell Optical Lab about your business and the services you need. Submission starts a discussion; it is not partner approval, an order confirmation or a new trade account.', actions: [route('labEurope', '/laboratory/europe#application', 'Open the EU application')] },
    documentation: { title: 'Technical documents and certificates', body: 'Ask the team for documentation for your specific product and destination market before ordering. The website does not publish verified certificates; eligibility and supporting documents need individual review.', actions: [route('labEurope', '/laboratory/europe#documentation', 'View documentation details')] },
    process: { title: 'What happens after I apply?', body: 'A successful submission displays a request reference. The team reviews your business requirements and contacts you about technical scope and commercial terms. Production, delivery dates and prices are agreed separately.', actions: [route('labEurope', '/laboratory/europe#application', 'Start an application')] },
    privacy: { title: 'What information should I provide?', body: 'Provide business and contact details only. Do not include prescriptions, diagnoses, patient names or medical records in the partnership form. The team can discuss a suitable process for any later order documentation.', actions: [route('labEurope', '/laboratory/europe#application', 'Open the business form')] },
    kosovo: { title: 'My business is based in Kosovo', body: 'Use the separate Kosovo partnership page so your enquiry includes the correct market. Both Albanian and English are available. You can review the two markets before choosing where to apply.', actions: [route('labKosovo', '/laboratory/kosovo', 'Kosovo partners'), route('partners', '/laboratory/partners', 'Compare markets')] },
  },
};

export function getSiteHelp(page) {
  const copy = page === 'labEurope' ? en : sq;
  const defaultOrder = Object.keys(copy.topics);
  const first = page === 'clinic' ? 'clinic'
    : ['brand', 'partners', 'labKosovo'].includes(page) ? 'partners'
    : ['guides', 'article', 'examination', 'prescription'].includes(page) ? 'prescription'
    : ['orderStatus', 'policies'].includes(page) ? 'order' : null;
  const topicKeys = first ? [first, ...defaultOrder.filter(key => key !== first)] : defaultOrder;
  return { ...copy, locale: page === 'labEurope' ? 'en' : 'sq', topics: topicKeys.map(id => ({ id, ...copy.topics[id] })) };
}
