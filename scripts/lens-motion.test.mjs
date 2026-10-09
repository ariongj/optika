import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/crafted-lens/index.html', import.meta.url), 'utf8');
const logic = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const engine = fs.readFileSync(new URL('../public/crafted-lens/lens3d.js', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/LensFocusPage.jsx', import.meta.url), 'utf8');

function fixture() {
  let now = 1000;
  let next = 1;
  const scheduled = new Map();
  const events = [];
  const document = { hidden: false, documentElement: { dataset: {} } };
  const window = { __CRAFTED_BOOT_START: 0, dispatchEvent: (event) => events.push(event), location: { origin: 'http://localhost' } };
  const context = vm.createContext({
    DCLogic: class {}, document, window,
    performance: { now: () => now },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    requestAnimationFrame: (fn) => { const id = next++; scheduled.set(id, fn); return id; },
    cancelAnimationFrame: (id) => scheduled.delete(id),
  });
  const Component = vm.runInContext(`${logic}\nComponent`, context);
  const instance = new Component();
  let renders = 0;
  instance.hero = { frame: () => { renders++; return { bgLum: 0.7 }; } };
  instance._prepared = true;
  instance._visible = true;
  instance._p = 0;
  instance._prevP = 0;
  instance._target = 0;
  instance._last = now;
  instance._loop = instance._loop.bind(instance);
  instance.updateOverlays = () => {};
  instance.fireEvents = () => {};
  instance.audioUpdate = () => {};
  const tick = (ms = 1000 / 60) => {
    now += ms;
    const pending = [...scheduled.values()]; scheduled.clear();
    pending.forEach((callback) => callback(now));
  };
  return { instance, document, window, scheduled, events, tick, get renders() { return renders; }, get now() { return now; } };
}

test('eight named beats are ordered, continuous and cover the entire sequence', () => {
  const { instance } = fixture();
  assert.equal(instance.BEATS.length, 8);
  assert.equal(instance.BEATS[0][0], 0);
  assert.equal(instance.BEATS.at(-1)[1], 1);
  for (let i = 1; i < 8; i++) assert.equal(instance.BEATS[i][0], instance.BEATS[i - 1][1]);
  assert.equal(instance.NAMES.length, 8);
});

test('first frame paints once; idle settles without a permanent GPU loop', () => {
  const f = fixture();
  f.instance.requestFrame(); f.tick();
  assert.equal(f.renders, 1);
  assert.equal(f.events[0].type, 'crafted-lens-first-frame');
  assert.equal(f.scheduled.size, 0);
});

test('scroll follows every native frame instead of quantizing 40/45fps to 30fps', () => {
  const f = fixture();
  f.instance._target = 0.5;
  f.instance._lastInputAt = f.now;
  f.instance.requestFrame();
  for (let i = 0; i < 6; i++) f.tick();
  assert.equal(f.renders, 6);
  assert.ok(f.instance._p > 0.45, 'at least 90% of the new position follows within 100ms');
  for (let i = 0; i < 60; i++) f.tick();
  assert.equal(f.instance._p, 0.5);
  assert.equal(f.scheduled.size, 0);
});

test('reverse scrolling converges without negative progress or lingering work', () => {
  const f = fixture();
  f.instance._p = 1; f.instance._target = 0; f.instance._lastInputAt = f.now;
  f.instance.requestFrame();
  for (let i = 0; i < 80; i++) f.tick();
  assert.equal(f.instance._p, 0);
  assert.equal(f.scheduled.size, 0);
});

test('hidden documents stop rendering and resume with one fresh frame', () => {
  const f = fixture();
  f.instance.requestFrame();
  f.document.hidden = true; f.instance.syncActivity();
  assert.equal(f.scheduled.size, 0);
  f.document.hidden = false; f.instance.syncActivity(); f.tick();
  assert.equal(f.renders, 1);
});

test('an offscreen parent prevents a new render loop', () => {
  const f = fixture();
  f.instance._parentVisible = false;
  f.instance.requestFrame();
  assert.equal(f.scheduled.size, 0);
  f.instance._parentVisible = true; f.instance.syncActivity(); f.tick();
  assert.equal(f.renders, 1);
});

test('reduced motion shows a static stage pose without interpolating camera sweeps', () => {
  const f = fixture();
  f.instance._reduced = true; f.instance._target = 0.4; f.instance._lastInputAt = f.now;
  f.instance.requestFrame(); f.tick();
  assert.equal(f.instance._p, 0.365);
  assert.equal(f.scheduled.size, 0);
});

test('stage buttons go forwards, backwards and respect reduced motion', () => {
  const f = fixture();
  let destination;
  f.instance._scroller = { scrollHeight: 10800, clientHeight: 800, scrollTo: (options) => { destination = options; } };
  f.instance.goToStage(1);
  assert.equal(destination.top, 1120);
  assert.equal(destination.behavior, 'smooth');
  f.instance._target = 0.155; f.instance._reduced = true; f.instance.goToStage(-1);
  assert.equal(destination.top, 0);
  assert.equal(destination.behavior, 'auto');
});

test('rapid stage presses retain requested destinations before smooth scroll settles', () => {
  const f = fixture();
  let destination;
  f.instance._scroller = { scrollHeight: 10800, clientHeight: 800, scrollTo: (options) => { destination = options; } };
  for (let i = 0; i < 7; i++) f.instance.goToStage(1);
  assert.equal(f.instance._requestedStage, 7);
  assert.equal(destination.top, 9280);
  f.instance.goToStage(-1);
  assert.equal(f.instance._requestedStage, 6);
  assert.equal(destination.top, 7150);
});

test('chapter stops have visible copy rather than landing in a subscene gap', () => {
  const { instance } = fixture();
  const captions = [...html.matchAll(/data-ov data-a="(-?[\d.]+)" data-b="(-?[\d.]+)" data-c="(-?[\d.]+)" data-d="(-?[\d.]+)"/g)];
  for (const progress of instance.STAGE_STOPS) {
    assert.ok(captions.some((caption) => progress >= Number(caption[2]) && progress <= Number(caption[3])), `caption is fully visible at ${progress}`);
  }
  assert.match(html, /\.lens-mobile-intro > \[data-ov\]/);
});

test('illustrative story publishes no unsupported specifications or certification badges', () => {
  const beforeLogic = html.split('<script type="text/x-dc"')[0];
  const copy = beforeLogic.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]*>/g, ' ');
  assert.doesNotMatch(copy, /ISO|UV400|B270|1064|12312|99\s*%|62%|88%|12%|24%|58\.5|1\.523|9H|2,000|0\.2nm|30s|4min|&lambda;|VLT|2\.9\s*(?:mm|milimetra)/);
  assert.match(copy, /Ilustrim · specifikat e lentes konfirmohen me optikun/);
  assert.match(copy, /Sipas lentes/);
  assert.match(copy, /Verifikim në laborator/);
});

test('scroll progress is clamped and zero-length tracks remain usable', () => {
  const f = fixture();
  f.instance._scroller = { scrollHeight: 800, clientHeight: 800, scrollTop: 99 };
  f.instance.measureScroll(); assert.equal(f.instance._target, 0);
  f.instance._scroller.scrollHeight = 1800;
  f.instance._scroller.scrollTop = -4; f.instance.measureScroll(); assert.equal(f.instance._target, 0);
  f.instance._scroller.scrollTop = 3000; f.instance.measureScroll(); assert.equal(f.instance._target, 1);
});

test('fallback reveals a recovery action even when boot started but a frame never arrived', () => {
  const f = fixture();
  const panel = { style: {} };
  f.instance._booted = true;
  f.instance._ov = { parentNode: { querySelector: () => panel } };
  f.instance.showFallback();
  assert.equal(panel.style.display, 'flex');
  assert.equal(f.events[0].type, 'crafted-lens-error');
});

test('scroll does not automatically build an audio graph', () => {
  assert.doesNotMatch(logic, /armAutoSound/);
  assert.match(logic, /if \(on\).*ensureAudio/);
  assert.match(html, /aria-pressed="false"/);
});

test('performance and accessibility guards are present on the active iframe path', () => {
  assert.match(engine, /await renderer\.compileAsync\(scene, camera\)/);
  assert.match(engine, /webglcontextlost/);
  assert.match(logic, /el\.inert = !on/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(app, /event\.source !== frame\?\.contentWindow/);
  assert.match(app, /lang=\$\{language\}&v=20261004-language/);
  assert.doesNotMatch(logic, /frameInterval|1000 \/ 40|1000 \/ 45/);
  assert.match(html, /data-mobile-legend="layers"/);
  assert.match(logic, /legend\.hidden = !this\._mob \|\| amt < 0\.5/);
});

test('guided story advances without consuming a page scroll track and settles at readable captions', () => {
  const f = fixture();
  f.instance._guided = true;
  f.instance._scroller = { scrollHeight: 800, clientHeight: 800, scrollTop: 0, scrollTo: () => assert.fail('guided mode must not scroll') };
  f.instance.goToStage(1);
  assert.equal(f.instance._target, 0.112);
  f.instance.measureScroll();
  assert.equal(f.instance._target, 0.112, 'resize does not reset the selected phase');
  for (let i = 0; i < 100; i++) f.tick();
  assert.equal(f.instance._p, 0.112);
  assert.equal(f.scheduled.size, 0);
  for (let i = 0; i < 10; i++) f.instance.goToStage(1);
  assert.equal(f.instance._target, 0.928);
  f.instance.goToStage(-1);
  assert.equal(f.instance._target, 0.715);
});
