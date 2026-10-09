// The API stores unspecified measurements as zero. Empty optional number inputs
// must stay empty when reopened, otherwise HTML min validation blocks every save.
export function productEditorMeasurements(product) {
  return Object.fromEntries(['frameWidth', 'lensWidth', 'lensHeight', 'bridgeWidth', 'templeLength']
    .map(key => [key, Number(product[key]) > 0 ? product[key] : '']));
}

export const cmsNavigation = [
  { label: 'Përmbledhje', section: 'Dashboard' },
  { label: 'Porosi', section: 'Orders', permission: 'orders.read' },
  { label: 'Produkte', permission: 'catalog.read', children: [['Produktet','Products'],['Koleksionet','Collections'],['Inventari','Inventory','inventory.write']] },
  { label: 'Klientë', section: 'Clients', permission: 'customers.read' },
  { label: 'Rritja', section: 'Offers', permission: 'marketing.read' },
  { label: 'Zbritje', section: 'Rules', permission: 'marketing.read' },
  { label: 'Kontakte', section: 'Contacts', permission: 'contacts.read' },
  { label: 'Termine', section: 'Appointments', permission: 'contacts.read' },
  { label: 'Analitikë', section: 'Analytics', permission: 'analytics.read' },
  { label: 'Online Store', group: 'KANALE SHITJEJE', permission: 'content.read', children: [['Faqet & SEO','Content'],['Slideshow & bannerë','Placements'],['Versionet','Revisions']] },
  { label: 'Integrime', section: 'Integrations' },
  { label: 'Konfigurimet', group: 'ADMINISTRIMI', children: [['Llogaria & siguria','Settings'],['Stafi & rolet','Staff','staff.manage'],['Historiku','Audit','audit.read']] },
];
export const canCms = (permissions = [], permission) => !permission || permissions.includes('*') || permissions.includes(permission);
export function canOpenCmsSection(permissions, section) {
  for (const entry of cmsNavigation) {
    if (entry.section === section) return canCms(permissions, entry.permission);
    const child = entry.children?.find(([, id]) => id === section);
    if (child) return canCms(permissions, entry.permission) && canCms(permissions, child[2]);
  }
  return false;
}
export function cmsSearch(data, query) {
  const q = query.trim().toLocaleLowerCase(); if (q.length < 2) return [];
  return [
    ...(data.products || []).map(p => ({title:p.name, detail:p.sku, section:'Products', query:p.sku || p.name})),
    ...(data.orders || []).map(p => ({title:p.id, detail:p.customer, section:'Orders', query:p.id})),
    ...(data.customers || []).map(p => ({title:p.name, detail:p.email, section:'Clients', query:p.email || p.name})),
    ...(data.submissions || []).map(p => ({title:p.organization || p.name, detail:p.id, section:p.type === 'appointment' ? 'Appointments' : 'Contacts', query:p.id})),
  ].filter(p => `${p.title} ${p.detail}`.toLocaleLowerCase().includes(q)).slice(0, 10);
}
export function parseCatalogueCsv(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i=0; i<text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i+1] === '"') { value += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(value); value=''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if(c === '\r' && text[i+1] === '\n') i++; row.push(value); if(row.some(Boolean)) rows.push(row); row=[]; value=''; }
    else value += c;
  }
  if (quoted) throw new Error('CSV ka thonjëza të pambyllura.');
  row.push(value); if (row.some(Boolean)) rows.push(row);
  const headers = (rows.shift() || []).map(h => h.replace(/^\uFEFF/, '').trim().toLowerCase());
  if (!['sku','name','price','stock'].every(h => headers.includes(h))) throw new Error('CSV kërkon kolonat sku, name, price, stock.');
  if (new Set(headers).size !== headers.length) throw new Error('CSV ka kolona të dyfishta.');
  return rows.map((r, i) => { if(r.length !== headers.length) throw new Error(`Rreshti ${i+2} ka numër të pasaktë kolonash.`); return Object.fromEntries(headers.map((h,j) => [h,r[j]])); });
}
export function catalogueCsv(products) {
  const headers = ['sku','name','price','stock','type','collection','status'];
  const escape = v => `"${String(v ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"','""')}"`;
  return '\uFEFF' + [headers, ...products.map(p => headers.map(h=>p[h]))].map(r=>r.map(escape).join(',')).join('\r\n');
}
export function downloadCatalogue(products) {
  const url=URL.createObjectURL(new Blob([catalogueCsv(products)],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a'); a.href=url; a.download='miftari-katalogu.csv'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export const blankRule = {title:'',type:'order',method:'code',code:'',valueType:'percent',value:1000,status:'Draft',startsAt:'',endsAt:'',productIds:[],rewardProductIds:[],combinesWith:[],minimumCents:0,minimumQuantity:0,usageLimit:0,perCustomerLimit:0,buyQuantity:2,getQuantity:1,maxApplications:1,maximumShippingCents:0,countries:[],customerIds:[]};
export const blankPlacement = {title:'',subtitle:'',image:'',mobileImage:'',alt:'',cta:'Shiko koleksionin',href:'/shop/',position:'home_banner',layout:'inset',order:0,offerId:'',status:'Draft',startsAt:'',endsAt:''};
export const cmsStatus = r => r.status === 'Published' ? r.endsAt && Date.parse(r.endsAt) <= Date.now() ? 'Skaduar' : r.startsAt && Date.parse(r.startsAt)>Date.now() ? 'Planifikuar' : 'Aktiv' : ({Draft:'Draft',Paused:'Pezulluar',Archived:'Arkivuar'}[r.status] || r.status);
