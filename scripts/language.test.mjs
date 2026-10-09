import test from 'node:test';
import assert from 'node:assert/strict';
import { translate, localizeProps, setLanguage, getLanguage, subscribeLanguage } from '../src/i18n/locale.js';
import { products, blogPosts } from '../src/data/catalog.js';
import { guideDetails } from '../src/guideContent.js';
import { translatedGuideSlugs } from '../src/i18n/articles-en.js';
import { searchProducts } from '../src/catalogSearch.js';

test('product name is distinct from a customer first name', () => {
  assert.equal(translate('Emri i produktit', 'en'), 'Product name');
  assert.equal(translate('Emri', 'en'), 'First name');
});

test('language switching is reversible and subscribers receive changes', () => {
  let calls = 0; const stop = subscribeLanguage(()=>calls++);
  setLanguage('en'); assert.equal(getLanguage(),'en');
  setLanguage('invalid'); assert.equal(getLanguage(),'en');
  setLanguage('en'); assert.equal(calls,1);
  setLanguage('sq'); assert.equal(calls,2); stop();
});
test('host props translate display only, preserving form data and handlers', () => {
  setLanguage('en');
  const handler = () => {};
  const props = localizeProps('input',{value:'Emri',name:'emri',id:'emri',placeholder:'Emri',onChange:handler});
  assert.equal(props.value,'Emri'); assert.equal(props.name,'emri'); assert.equal(props.id,'emri'); assert.equal(props.onChange,handler);
  assert.notEqual(props.placeholder,'Emri');
  const option=localizeProps('option',{children:'Shqipëri'});
  assert.equal(option.value,'Shqipëri'); assert.notEqual(option.children,'Shqipëri');
  assert.equal(localizeProps('textarea',{children:'Emri'}).children,'Emri');
  assert.notEqual(localizeProps(Symbol.for('react.fragment'),{children:'Emri'}).children,'Emri');
  assert.equal(localizeProps('span',{children:'Emri',translate:'no'}).children,'Emri');
  assert.equal(localizeProps('a',{href:'/shop?f_search=titan#results'}).href,'/shop?f_search=titan&lang=en#results');
  assert.equal(localizeProps('a',{href:'/api/file.php?id=12'}).href,'/api/file.php?id=12');
  setLanguage('sq'); assert.equal(translate('Emri'),'Emri');
});
test('all 40 guide titles, excerpts, checklists and article bodies have English copy', () => {
  assert.equal(translatedGuideSlugs.length,40);
  assert.deepEqual(new Set(translatedGuideSlugs),new Set(blogPosts.map(p=>p.slug)));
  for(const p of blogPosts) for(const value of [p.title,p.excerpt,...p.points,...guideDetails[p.slug]]) assert.notEqual(translate(value,'en'),value,`${p.slug}: ${value}`);
});
test('all catalogue product descriptions and care information have English copy', () => {
  for(const p of products) for(const field of ['description','technical','delivery','returns','care','seoTitle','metaDescription']) {
    assert.equal(typeof translate(p[field],'en'),'string');
    assert.notEqual(translate(p[field],'en'),p[field],`${p.id}: ${field}`);
    assert.ok(!translate(p[field],'en').includes('undefined'),`${p.id}: ${field}`);
  }
});
test('English and Albanian catalogue queries find the same sunglasses', () => {
  assert.ok(searchProducts(products,'sunglasses').length>0);
  assert.deepEqual(searchProducts(products,'sunglasses').map(p=>p.id),searchProducts(products,'syze dielli').map(p=>p.id));
});
test('dynamic accessible labels translate while product names remain intact', () => {
  assert.equal(translate('Provo Vortex X1 në 3D','en'),'Try Vortex X1 in 3D');
  assert.equal(translate('Shiko pamjen 2','en'),'View image 2');
  assert.equal(translate('Vortex X1, syze dielli, pamja e zgjedhur','en'),'Vortex X1, sunglasses, selected image');
  assert.equal(translate('Sasia për Vortex X1','en'),'Quantity for Vortex X1');
  assert.equal(translate('2 artikuj','en'),'2 items');
  assert.equal(translate('Vortex X1','en'),'Vortex X1');
  assert.ok(!/[ëç]/.test(translate(products[0].seoTitle+' | Optika Miftari','en')));
  assert.ok(!/[ëç]/.test(translate(products[0].description+' Ky variant vjen në ngjyrën e zezë me ar, me lente qelibar.','en')));
});
