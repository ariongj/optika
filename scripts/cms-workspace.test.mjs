import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCatalogueCsv,catalogueCsv,canCms,canOpenCmsSection,cmsSearch,cmsStatus,productEditorMeasurements} from '../src/cmsWorkspace.js';

test('optional product measurements reopen as blank, not invalid zero',()=>{
  assert.deepEqual(productEditorMeasurements({frameWidth:0,lensWidth:'0',lensHeight:null}),{frameWidth:'',lensWidth:'',lensHeight:'',bridgeWidth:'',templeLength:''});
  const measured={frameWidth:138,lensWidth:51,lensHeight:42,bridgeWidth:20,templeLength:145};
  assert.deepEqual(productEditorMeasurements(measured),measured);
});
test('Dashboard shortcuts cannot bypass module permissions',()=>{assert.equal(canOpenCmsSection(['catalog.read'],'Content'),false);assert.equal(canOpenCmsSection(['catalog.read'],'Products'),true);assert.equal(canOpenCmsSection(['content.read'],'Staff'),false);assert.equal(canOpenCmsSection(['*'],'Unknown'),false);});
test('CSV accepts quoted commas, embedded newlines and BOM',()=>assert.deepEqual(parseCatalogueCsv('\uFEFFsku,name,price,stock\r\nA,"One, two\nthree",12,4'),[{sku:'A',name:'One, two\nthree',price:'12',stock:'4'}]));
test('CSV rejects incomplete quotes and duplicate columns',()=>{assert.throws(()=>parseCatalogueCsv('sku,name,price,stock\nA,"bad,1,2'));assert.throws(()=>parseCatalogueCsv('sku,name,price,stock,stock\nA,a,1,2,2'));});
test('CSV export neutralizes formulas',()=>assert.ok(catalogueCsv([{sku:'=1+1',name:'@formula',price:1,stock:2}]).includes("'=1+1")));
test('Permissions default deny with explicit owner override',()=>{assert.equal(canCms([], 'staff.manage'),false);assert.equal(canCms(['*'],'staff.manage'),true);assert.equal(canCms(['catalog.read'],'catalog.write'),false);});
test('Search uses available records only',()=>{assert.equal(cmsSearch({products:[{name:'Frame A',sku:'S001'}]},'s001')[0].section,'Products');assert.deepEqual(cmsSearch({},'customer'),[]);});
test('Scheduling labels distinguish planned and expired',()=>{assert.equal(cmsStatus({status:'Published',startsAt:'2099-01-01'}),'Planifikuar');assert.equal(cmsStatus({status:'Published',endsAt:'2020-01-01'}),'Skaduar');});
