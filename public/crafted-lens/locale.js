// This isolated story shares the parent's chosen language through its URL.
// Only text/accessible labels are observed: animation style changes are ignored.
(() => {
  if (new URLSearchParams(location.search).get('lang') !== 'en') return;
  document.documentElement.lang = 'en';
  document.title = 'Lens Focus — Lens craftsmanship | Optika Miftari';
  const copy = Object.fromEntries(`
Lens Focus — animacioni i punimit të thjerrëzës|Lens Focus — Lens craftsmanship animation
Faza 01 / 8 — Blloku optik|Stage 01 / 8 — Optical blank
Lens Focus · Punimi optik|Lens Focus · Optical craftsmanship
Shihni si ndërtohet|See how we craft
qartësia juaj.|your clarity.
Vizualizim ilustrues · specifikat e lentes konfirmohen me optikun.|Illustration · confirm lens specifications with your optician.
Duke përgatitur përvojën|Preparing your experience
Optika Miftari · Ilustrim i lentes|Optika Miftari · Lens illustration
Asgjë mes teje|Nothing between you
dhe|and
dritës.|the light.
Ndërtimi interaktiv nuk u ngarkua. Kontrollo lidhjen dhe ringarko.|The interactive experience could not load. Check your connection and reload.
Ringarko|Reload
Lëviz për të ndjekur formimin|Scroll to follow the process
01 · Blloku optik|01 · Optical blank
Gjithçka nis|It all begins
si një disk.|with a disc.
Materiali dhe dizajni i lentes zgjidhen sipas recetës dhe nevojës.|Lens material and design are selected for your prescription and needs.
02a · Formimi i konturit|02a · Shaping the contour
Konturi ndjek kornizën.|The contour follows the frame.
Konturi|Contour
Sipas kornizës|To fit the frame
Materiali|Material
Sipas lentes|Lens-dependent
Përshtatja|Fitting
Verifikim në laborator|Laboratory verification
02b · Formimi i lakimit|02b · Forming the curve
Një disk i sheshtë|A flat disc
mëson të lakohet.|takes its curve.
Lakimi dhe trashësia përcaktohen sipas recetës|Curvature and thickness are determined by the prescription
03 · Lustrimi optik|03 · Optical polishing
Lustrim për qartësi.|Polished for clarity.
Përpunimi i sipërfaqes sipas materialit|Surface processing suited to the material
04 · Shtresat optike|04 · Optical coatings
Trajtime të zgjedhura.|Selected treatments.
Një lente e personalizuar.|A personalised lens.
Trajtimet dhe materiali varen nga lentja e zgjedhur. Jo çdo lente i përfshin të gjitha.|Treatments and materials depend on the selected lens. Not every lens includes them all.
Shtresat · sipas lentes së zgjedhur|Coatings · depend on the selected lens
05a · Polarizimi|05a · Polarisation
Polarizimi, i ilustruar.|Polarisation, illustrated.
Opsion për lente të caktuara. Efekti dhe specifikimet verifikohen për modelin që zgjidhni.|Available for selected lenses. Verify the effect and specifications for your chosen model.
Polarizim|Polarisation
Orientim|Orientation
Sipas dizajnit|Design-dependent
Material|Material
Sipas produktit|Product-dependent
05b · Filtrimi spektral|05b · Spectral filtering
Çfarë hyn.|What gets through.
Çfarë jo.|What does not.
Mbrojtje UV|UV protection
Trajtimi optik|Optical treatment
Filtrimi i dritës|Light filtering
Sipas trajtimit|Treatment-dependent
Transmetimi|Transmission
Sipas materialit|Material-dependent
Nuanca|Tint
06 · Reagimi fotokromatik|06 · Photochromic response
Diell i plotë|Full sunlight
Reagim ilustrues ndaj dritës|Illustrative response to light
Vranësira|Cloud cover
Nuanca ndryshon sipas lentes|Tint varies by lens
Përsëri në diell|Back in sunlight
Koha varet nga materiali dhe kushtet|Timing depends on material and conditions
07a · Trajtimi i sipërfaqes|07a · Surface treatment
Mbrojtje shtesë.|Added protection.
Kujdes i përditshëm.|Everyday care.
Mbrojtja|Protection
Pastrimi|Cleaning
Sipas udhëzimeve|Follow the instructions
Kujdesi|Care
Përdorim i kujdesshëm|Handle with care
07b · Përfundimi i skajit|07b · Edge finishing
Skaj i lëmuar|Polished edge
Përshtatje me kornizën|Fitted to the frame
Trashësia në qendër|Centre thickness
Sipas recetës dhe materialit|Prescription- and material-dependent
Shenjat e identifikimit|Identification marks
Sipas dizajnit të lentes|Lens-design-dependent
08 · Kontrolli optik|08 · Optical inspection
Fuqia optike|Optical power
Sipas recetës|Prescription-dependent
Transmetimi i dritës|Light transmission
Indeksi i përthyerjes|Refractive index
Karakteristikat optike|Optical characteristics
Sipërfaqja|Surface
Kontroll vizual|Visual inspection
Përshtatja finale|Final fitting
Tetë faza ilustruese. Zgjedhja përfundimtare bëhet me optikun.|Eight illustrative stages. Make your final selection with your optician.
Shiko kornizat|Explore frames
Rezervo ekzaminimin|Book an examination
Koleksioni i Thjerrëzave|Lens collection
Shiko të gjitha →|View all →
Gri e polarizuar|Polarised grey
Kontrast qelibari|Amber contrast
Fotokromatike|Photochromic
Film polarizues|Polarising film
Filtër për dritën blu|Blue-light filter
Opsional|Optional
Rezistencë ndaj gërvishtjeve|Scratch resistance
Hidrofobike|Hydrophobic
Oleofobike|Oleophobic
Antirefleks|Anti-reflective
Materiali bazë|Base material
Skaj i përshtatur me kornizën|Edge fitted to the frame
Trashësi sipas recetës|Prescription-dependent thickness
Identifikimi i lentes|Lens identification
Kontrolli i sipërfaqes së përparme|Front-surface inspection
Trajtime sipas lentes|Lens-dependent treatments
Sipërfaqja e pasme · AR|Back surface · AR
LENS FOCUS · ILUSTRIM|LENS FOCUS · ILLUSTRATION
Faza|Stage
Blloku optik|Optical blank
Në pritje të lëvizjes|Ready when you are
Shiko lentet ↓|Explore lenses ↓
Ilustrim · specifikat e lentes konfirmohen me optikun.|Illustration · confirm lens specifications with your optician.
Shtresat optike · shihni detajet|Optical coatings · view details
Skaji i lentes · shihni detajet|Lens edge · view details
Kontrolli optik · shihni detajet|Optical inspection · view details
← Para|← Previous
Tjetra →|Next →
Ilustrim ·|Illustration ·
Pa zë|Sound off
Me zë|Sound on
Pa audio|No audio
Formimi i konturit|Shaping the contour
Lustrimi optik|Optical polishing
Shtresat optike|Optical coatings
Polarizimi|Polarisation
Kontrolli|Inspection
Ilustrim i procesit|Process illustration
Lëmimi i sipërfaqes|Surface polishing
Shtresat mbrojtëse|Protective coatings
Reagimi ndaj dritës|Response to light
Mbrojtja e sipërfaqes|Surface protection
Kontrolli optik|Optical inspection
Ilustrimi i punimit të lentes. Përdorni butonat Para dhe Tjetra për tetë fazat.|Lens craftsmanship illustration. Use Previous and Next to explore eight stages.
Fazat e punimit|Production stages
Faza e mëparshme|Previous stage
Faza tjetër|Next stage
Aktivizo zërin e animacionit|Enable animation sound
Çaktivizo zërin e animacionit|Disable animation sound
Zëri nuk mbështetet në këtë shfletues|Audio is unavailable in this browser
`.trim().split('\n').map(line=>{const i=line.indexOf('|');return [line.slice(0,i),line.slice(i+1)];}));
  function text(value) {
    const key = value.replace(/\s+/g,' ').trim();
    let result = copy[key];
    if (!result && key.includes(' · ')) result = key.split(' · ').map(part=>copy[part] || part).join(' · ');
    return result ? value.replace(value.trim(),result) : value;
  }
  function translateNode(node) {
    if (node.nodeType === 3) {
      if (node.parentElement?.closest('script,style')) return;
      const next = text(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    } else if (node.nodeType === 1) {
      if (node.matches('script,style')) return;
      for (const attr of ['aria-label','title','alt']) {
        const value = node.getAttribute(attr);
        if (value && text(value) !== value) node.setAttribute(attr,text(value));
      }
      for (const child of node.childNodes) translateNode(child);
    }
  }
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(translateNode);
      else translateNode(record.target);
    }
  });
  translateNode(document.body);
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','alt']});
})();
