// The privacy notice of the server-backed shop. The notice bundled with the site describes the demo (GitHub Pages, no
// server database, forms relayed by an outside service); a shop running on its own server works differently, and the
// notice has to say what really happens there:
//   - hosted with Hostinger, with the shop's own database beside the site;
//   - forms go to that server and nowhere else;
//   - a marketing consent is recorded with its time, wording, shortened IP address and browser type;
//   - the form limiter keeps a one-way code of the IP address for about a day;
//   - visitors get no cookies; signed-in staff get one session cookie.
// Only the sections that differ are replaced (by position: the three languages have the same section order).
// The shop's owner should read the result before opening the shop: it states facts about this software, not legal advice.
import type { L10n } from '@/lib/types';

const HOST_POLICY = 'https://www.hostinger.com/legal/privacy-policy';

/** Section number (0 = first "## " heading) → replacement, per language. */
const SECTIONS: Record<number, L10n> = {
  0: {
    me: `## Bez analitike i reklamnih kolačića
Sajt **ne koristi alate za analitiku, reklame ili praćenje** i **ne postavlja kolačiće posetiocima**. Dok pregledate sajt, ništa se ne učitava od drugih kompanija: stranice, slike, fontovi i virtuelna proba dolaze sa samog sajta. Samo osoblje koje se prijavljuje u administraciju prodavnice dobija jedan kolačić, koji ga drži prijavljenim.`,
    sq: `## Pa analitikë dhe pa cookies reklamuese
Faqja **nuk përdor mjete analitike, reklamash apo gjurmimi** dhe **nuk u vendos cookies vizitorëve**. Gjatë shfletimit nuk ngarkohet asgjë nga kompani të tjera: faqet, fotot, fontet dhe prova virtuale vijnë nga vetë faqja. Vetëm stafi që hyn në administrimin e dyqanit merr një cookie, që e mban të kyçur.`,
    en: `## No analytics, no advertising cookies
The site uses **no analytics, advertising or tracking tools** and sets **no cookies for visitors**. Nothing is loaded from other companies while you browse: pages, images, fonts and the virtual try-on all come from the site itself. Only staff who sign in to the shop’s administration get one cookie, which keeps them signed in.`,
  },
  1: {
    me: `## Hosting
Sajt i baza podataka prodavnice hostovani su kod kompanije Hostinger. Kao kod svakog sajta, IP adresa vašeg uređaja i tražena stranica stižu do servera hostinga i beleže se u njegovim serverskim zapisima. Pogledajte [Hostinger politiku privatnosti](${HOST_POLICY}).`,
    sq: `## Hostimi
Faqja dhe baza e të dhënave e dyqanit hostohen te kompania Hostinger. Si në çdo faqe interneti, adresa IP e pajisjes suaj dhe faqja që kërkoni arrijnë te serverët e hostimit dhe regjistrohen në regjistrat e tyre. Shihni [politikën e privatësisë së Hostinger](${HOST_POLICY}).`,
    en: `## Hosting
The website and the shop’s database are hosted with Hostinger. As with any website, your device’s IP address and the page you request reach the hosting servers and are recorded in their server logs. See the [Hostinger privacy policy](${HOST_POLICY}).`,
  },
  2: {
    me: `## Šta nam šaljete putem obrazaca
Narudžbe, zahtevi za termin, kontakt i partnerski upiti i prijave na newsletter sadrže ono što unesete — na primer ime, broj telefona, e-mail, adresu dostave i, za dioptrijska sočiva, recept i merenja (PD, visina montaže). Koristimo ih samo da obradimo vaš zahtev.

Ono što pošaljete čuva se u bazi podataka prodavnice na tom hostingu, gde ga naše osoblje obrađuje kroz administraciju prodavnice. Ne šalje se nijednom drugom servisu. Kopija ostaje u vašem pregledaču, kako bi sajt mogao da prikaže potvrdu i status narudžbe.

Kada pristanete da primate ponude, beležimo i datum, tekst na koji ste pristali, skraćeni oblik vaše IP adrese i vrstu pregledača, kao dokaz saglasnosti. Saglasnost možete povući u svakom trenutku: preko linka za odjavu u našim porukama ili tako što nam javite.

Da bi se obrasci zaštitili od zloupotrebe, server oko jedan dan čuva jednosmerni kod izveden iz vaše IP adrese, iz kog se adresa ne može pročitati.`,
    sq: `## Çfarë na dërgoni përmes formularëve
Porositë, kërkesat për termin, mesazhet e kontaktit, kërkesat për bashkëpunim dhe regjistrimet në newsletter përmbajnë atë që shkruani — p.sh. emrin, numrin e telefonit, e-mailin, adresën e dërgesës dhe, për lente me recetë, recetën dhe matjet (PD, lartësia e montimit). I përdorim vetëm për të trajtuar kërkesën tuaj.

Ajo që dërgoni ruhet në bazën e të dhënave të dyqanit në atë hostim, ku stafi ynë e trajton përmes administrimit të dyqanit. Nuk i dërgohet asnjë shërbimi tjetër. Një kopje mbetet në shfletuesin tuaj, që faqja t’ju tregojë konfirmimin dhe statusin e porosisë.

Kur pranoni të merrni oferta, regjistrojmë edhe datën, tekstin që keni pranuar, një formë të shkurtuar të adresës suaj IP dhe llojin e shfletuesit, si dëshmi të pëlqimit. Pëlqimin mund ta tërhiqni në çdo kohë: përmes lidhjes për çregjistrim në mesazhet tona ose duke na njoftuar.

Për t’i mbrojtur formularët nga keqpërdorimi, serveri ruan për rreth një ditë një kod njëkahësh të nxjerrë nga adresa juaj IP, nga i cili adresa nuk mund të lexohet.`,
    en: `## What you send us through forms
Orders, appointment requests, contact and partner enquiries and newsletter sign-ups contain what you enter — for example your name, phone number, e-mail, delivery address and, for prescription lenses, your prescription and measurements (PD, fitting height). We use them only to handle your request.

What you send is stored in the shop’s database on that hosting, where our staff handle it through the shop’s administration. It is not sent to any other service. A copy stays in your browser so the site can show your confirmation and order status.

When you agree to receive offers, we also record the date, the wording you agreed to, a shortened form of your IP address and your browser type, as proof of your consent. You can withdraw it at any time: through the unsubscribe link in our messages or by telling us.

To protect the forms from misuse, the server keeps a one-way code derived from your IP address for about a day; the address cannot be read back from it.`,
  },
  5: {
    me: `## Šta se čuva u vašem pregledaču
Da bi radio, sajt čuva nekoliko stvari u lokalnoj memoriji vašeg pregledača — nikada u kolačićima. Ništa od toga ne napušta vaš uređaj, osim podataka iz obrasca koji pošaljete:

- jezik, korpu, listu želja, kodove za popust i nedavno pregledane proizvode;
- odgovore iz vodiča za izbor okvira i izabrani prikaz prodavnice;
- kopije narudžbi i zahteva koje ste poslali i nacrt narudžbe (samo za trenutnu karticu pregledača), da ne izgubite uneto;
- kopiju kataloga prodavnice, da se stranice brže otvaraju;
- poziciju na stranicama koje ste posetili i tehničke oznake (samo za trenutnu karticu pregledača);
- keš fajlova i fotografija sajta, da ponovne posete budu brže.

Sve to možete u svakom trenutku obrisati brisanjem podataka ovog sajta u podešavanjima pregledača.`,
    sq: `## Çfarë ruhet në shfletuesin tuaj
Që të funksionojë, faqja ruan disa gjëra në hapësirën lokale të shfletuesit tuaj — asnjëherë në cookies. Asgjë prej tyre nuk largohet nga pajisja juaj, përveç të dhënave të formularit që dërgoni:

- gjuhën, shportën, listën e dëshirave, kodet e zbritjes dhe produktet e shikuara së fundi;
- përgjigjet në udhëzuesin për zgjedhjen e kornizës dhe pamjen e dyqanit që keni zgjedhur;
- kopjet e porosive dhe kërkesave që keni dërguar dhe draftin e porosisë (vetëm për skedën aktuale), që të mos humbni atë që keni shkruar;
- një kopje të katalogut të dyqanit, që faqet të hapen më shpejt;
- pozicionin në faqet që keni vizituar dhe shenja teknike (vetëm për skedën aktuale);
- një kopje (cache) të skedarëve dhe fotove të faqes, që vizitat e radhës të jenë më të shpejta.

Të gjitha këto mund t’i fshini në çdo kohë, duke fshirë të dhënat e kësaj faqeje te cilësimet e shfletuesit.`,
    en: `## Stored in your browser
To work, the site keeps a few things in your browser’s local storage — never in cookies. None of it leaves your device, except the form entries you send:

- your language, cart, wishlist, discount codes and recently viewed products;
- your answers in the frame finder and the shop layout you picked;
- copies of the orders and requests you sent, and a checkout draft (current browser tab only) so you don’t lose what you typed;
- a copy of the shop’s catalogue so pages open quickly;
- your position on pages you visited and technical markers (current browser tab only);
- a cache of the site’s files and photos so repeat visits are faster.

You can remove all of it at any time by clearing this site’s data in your browser settings.`,
  },
  7: {
    me: `## Koliko dugo čuvamo podatke
Račune i dokumentaciju narudžbi čuvamo onoliko koliko propisuje poreski zakon. Upite brišemo čim to zatražite. Kada povučete marketinšku saglasnost, odmah prestajemo da vam pišemo; zapis o tome kada ste pristali i kada ste saglasnost povukli čuvamo kao dokaz.`,
    sq: `## Sa kohë i ruajmë
Faturat dhe dokumentet e porosive i ruajmë aq sa kërkon ligji tatimor. Kërkesat e kontaktit i fshijmë sapo të na e kërkoni. Kur e tërhiqni pëlqimin për marketing, ndalojmë menjëherë së shkruari; shënimin se kur keni pranuar dhe kur e keni tërhequr pëlqimin e ruajmë si dëshmi.`,
    en: `## How long we keep data
Invoices and order records are kept for as long as tax law requires. Enquiries are deleted as soon as you ask. When you withdraw a marketing consent we stop writing to you at once; the record of when you agreed and when you withdrew is kept as proof.`,
  },
};

/** The bundled notice with the sections above swapped in. Returns the text unchanged if its shape is not the expected one. */
export function hostedPrivacy(body: L10n): L10n {
  const out = { ...body };
  for (const lang of ['me', 'sq', 'en'] as const) {
    const parts = (body[lang] ?? '').split(/\n(?=## )/);
    // intro + 9 sections; anything else means the notice was rewritten — leave it alone
    if (parts.length !== 10) continue;
    // every section but the last ends with the blank line that separates it from the next heading
    for (const [i, text] of Object.entries(SECTIONS)) parts[Number(i) + 1] = text[lang] + (Number(i) + 1 < parts.length - 1 ? '\n' : '');
    out[lang] = parts.join('\n');
  }
  return out;
}
