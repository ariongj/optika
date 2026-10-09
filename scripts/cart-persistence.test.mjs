import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { persistableCart, selectedCatalogProduct, createLatestUpload } from '../src/cartPersistence.js';
const line = {lineId:'line-1',productId:'frame',name:'Frame',price:100,quantity:1,signature:'secret-token',configuration:{purchaseMode:'prescription',lensPackage:'Single',rxMode:'Shkruaje manualisht',manualRx:{odSph:'-2.00'},manualPrescription:'private-values',prescriptionToken:'secret-token',prescriptionFile:'private-name.pdf'}};
test('cart saves retail choices but strips all medical fields and embedded signature',()=>{
  const saved=persistableCart([line]); const text=JSON.stringify(saved);
  for(const secret of ['-2.00','private-values','secret-token','private-name.pdf']) assert.equal(text.includes(secret),false);
  assert.equal(saved[0].configuration.lensPackage,'Single');
  assert.equal(saved[0].configuration.prescriptionNeedsReentry,true);
  assert.equal(line.configuration.manualRx.odSph,'-2.00');
  assert.deepEqual(persistableCart(saved),saved);
});
test('normal ready frames retain quantity and do not request a prescription',()=>{
  const saved=persistableCart([{...line,configuration:{purchaseMode:'ready'}}]);
  assert.equal(saved[0].configuration.prescriptionNeedsReentry,undefined);
  assert.equal(saved[0].quantity,1);
});
test('invalid persisted shapes cannot crash the cart',()=>{
  assert.deepEqual(persistableCart({items:[line]}),[]);
  assert.deepEqual(persistableCart([null,{...line,quantity:-1},{...line,price:'invalid'}]),[]);
});
test('missing and archived products do not substitute a different frame',()=>{
  assert.equal(selectedCatalogProduct([{id:'one'}],'missing'),null);
  assert.equal(selectedCatalogProduct([],'one'),null);
  assert.equal(selectedCatalogProduct([{id:'one'}],'one').id,'one');
});
test('only the newest upload response can update the selected file',()=>{
  const uploads=createLatestUpload(), a=uploads.begin(), b=uploads.begin();
  assert.equal(a.signal.aborted,true); assert.equal(a.current(),false); assert.equal(b.current(),true);
  uploads.cancel(); assert.equal(b.signal.aborted,true); assert.equal(b.current(),false);
});

test('application wires privacy storage and exact catalogue lookup, including empty responses',async()=>{
  const app=await readFile(new URL('../src/App.jsx',import.meta.url),'utf8');
  assert.match(app,/import \{ persistableCart, selectedCatalogProduct, createLatestUpload \} from '\.\/cartPersistence.js'/);
  assert.match(app,/persistableCart\(readStorage\("visionaire-cart", \[\]\)\)/);
  assert.match(app,/writeStorage\("visionaire-cart", persistableCart\(cart\)\)/);
  assert.match(app,/selectedCatalogProduct\(products, selectedProductId\)/);
  assert.match(app,/if \(Array.isArray\(payload.products\)\) setProducts\(payload.products\)/);
  assert.match(app,/page === "product" && selectedProduct.id &&/);
});
