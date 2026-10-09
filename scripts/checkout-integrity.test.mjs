import test from 'node:test';
import assert from 'node:assert/strict';
import { quotedCartLines } from '../src/checkoutExperience.js';
import { upsertCartLine } from '../src/commercePresentation.js';
import { translate } from '../src/i18n/locale.js';
import { readCheckoutDraft, saveCheckoutDraft } from '../src/checkoutDraft.js';

const line = (index) => ({lineId:`line-${index}`,signature:`config-${index}`,productId:`product-${index}`,quantity:1,price:99,availableStock:20,configuration:{purchaseMode:'ready'}});
test('All quoted line prices match the server without mutating the saved basket', () => {
  const cart = [line(0),line(1)];
  const quote = {items:[{productId:'product-0',quantity:1,unitPrice:125.55},{productId:'product-1',quantity:1,unitPrice:80}]};
  assert.deepEqual(quotedCartLines(cart,quote).map(l=>l.price),[125.55,80]);
  assert.deepEqual(cart.map(l=>l.price),[99,99]);
  assert.equal(quotedCartLines(cart,quote)[0].configuration,cart[0].configuration);
  assert.deepEqual(quotedCartLines(cart,null),cart);
  assert.deepEqual(quotedCartLines(cart,{items:[quote.items[1],quote.items[0]]}),cart);
});
test('The 25-line limit allows merging and editing but never a silently dropped 26th line', () => {
  const cart = Array.from({length:25},(_,index)=>line(index));
  assert.equal(upsertCartLine(cart,line(25)).error,'cart_line_limit');
  assert.equal(upsertCartLine(cart,line(0)).items.length,25);
  assert.equal(upsertCartLine(cart,line(0)).items[0].quantity,2);
  assert.equal(upsertCartLine(cart,line(25),'line-0').items.length,25);
  assert.equal(upsertCartLine(cart.slice(0,24),line(25)).items.length,25);
});
test('New checkout recovery messages are available in English', () => {
  for (const copy of ['Shporta pranon deri në 25 konfigurime. Hiqni një artikull për të shtuar një tjetër.','Çmimi ose oferta ndryshoi. Kontrolloni totalin e përditësuar dhe konfirmoni përsëri; kërkesa nuk u regjistrua.','Kontrolloni sasitë: lejohen nga 1 deri në 10 copë për konfigurim.','Një artikull nuk është i vlefshëm. Hiqeni dhe shtojeni përsëri.']) assert.notEqual(translate(copy,'en'),copy);
});
test('A fresh account checkout respects profile country and contact preference; an edited draft wins', () => {
  const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
  const profile={firstName:'Synthetic',country:'Shqipëri',contactPreference:'Email',password:'NEVER_COPY',note:'NEVER_COPY'};
  const fresh=readCheckoutDraft(storage,'customer',profile);
  assert.equal(fresh.country,'Shqipëri');assert.equal(fresh.contactPreference,'Email');
  assert.equal(fresh.note,'');assert.equal(fresh.password,undefined);
  saveCheckoutDraft(storage,'customer',{...fresh,country:'Mal i Zi',contactPreference:'Telefon'});
  const restored=readCheckoutDraft(storage,'customer',profile);
  assert.equal(restored.country,'Mal i Zi');assert.equal(restored.contactPreference,'Telefon');
  assert.equal(readCheckoutDraft(storage,'another',profile).country,'Shqipëri');
});
test('Mobile catalogue filters, counts and product previews have complete English labels', () => {
  assert.equal(translate('1 modele · 3 variante','en'),'1 frame · 3 variants');
  assert.equal(translate('Hiq filtrin Kërkimi: Vortex','en'),'Remove filter Search: Vortex');
  assert.equal(translate('Shiko shpejt Vortex X1','en'),'Quick view Vortex X1');
  assert.equal(translate('Fotografitë e Vortex X1','en'),'Photos of Vortex X1');
  assert.equal(translate('Ruaj Vortex X1 te të preferuarat','en'),'Save Vortex X1 to favourites');
  assert.equal(translate('Titan beta','en'),'Beta titanium');
});
