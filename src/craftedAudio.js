/* ============================================================================
 * CraftedAudio — standalone Web Audio engine for the "Crafted Before Your
 * Eyes" scroll hero. Zero dependencies. Drop into any site.
 *
 * USAGE
 * -----
 *   <script src="crafted-audio.js"></script>   // or: import CraftedAudio from './crafted-audio.js'
 *
 *   const audio = new CraftedAudio();
 *
 *   // Browsers block audio until a user gesture. Either wire a button:
 *   myButton.addEventListener('click', () => audio.toggle());
 *   // ...or auto-start on the first scroll/touch/key:
 *   audio.armAutoStart();
 *
 *   // Then, in your scroll/animation loop, feed it scroll progress p ∈ [0,1]
 *   // (0 = top of the hero, 1 = end) and delta time in seconds:
 *   audio.update(p, dt);
 *
 *   // That's it. update() drives the continuous layers (laser, polish, x-ray,
 *   // riser, scroll whoosh) AND fires the one-shots (ignite, booms, clicks,
 *   // final chime) at the right thresholds.
 *
 *   // Optional API:
 *   audio.setEnabled(true|false)   // fade sound in/out
 *   audio.enabled                  // current state (bool)
 *   audio.onChange = (on) => {...} // called when sound turns on/off (update your UI)
 *   audio.masterVolume = 0.42      // 0..1, default 0.42
 *   audio.ignite(); audio.boom(0.8); audio.click(); audio.thunk(0.7); audio.chime();
 *   audio.dispose()                // tear down the AudioContext
 *
 * EVENT MAP (scroll progress thresholds — retune freely for your own timeline)
 *   0.088  ignite()        laser fires up
 *   0.2845 boom(0.8)       coatings fuse / sealed
 *   0.414  thunk(0.7)      lens seats into frame
 *   0.451  click()         left temple locks
 *   0.474  click()         right temple locks
 *   0.9    boom(1) + chime()  final reveal
 *
 * CONTINUOUS LAYERS (trapezoid windows over p — see update())
 *   0.09–0.157   laser cutting tone + sizzle
 *   0.155–0.19   diamond polish grind
 *   0.678–0.732  x-ray scanner shimmer
 *   0.82–0.905   tension riser into the reveal
 *   always       scroll-speed whoosh
 * ========================================================================== */

(function (global) {
  'use strict';

  // ---------- math helpers ----------
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  // trapezoid envelope: 0 before a, ramps to 1 by b, holds, falls to 0 by d
  function trap(p, a, b, c, d) {
    if (p <= a || p >= d) return 0;
    if (p < b) return smooth((p - a) / (b - a));
    if (p > c) return smooth(1 - (p - c) / (d - c));
    return 1;
  }

  class CraftedAudio {
    constructor(opts) {
      opts = opts || {};
      this.enabled = false;
      this.masterVolume = opts.masterVolume != null ? opts.masterVolume : 0.42;
      this.onChange = null;   // (on: boolean) => void
      this._a = null;         // audio graph, built lazily on first enable
      this._prevP = 0;
      this._userMuted = false;
      this._autoCleanup = null;

      // one-shot event thresholds: [p, fn]
      this._events = [
        [0.088, () => this.ignite()],
        [0.2845, () => this.boom(0.8)],
        [0.414, () => this.thunk(0.7)],
        [0.451, () => this.click()],
        [0.474, () => this.click()],
        [0.9, () => { this.boom(1.0); this.chime(); }],
      ];
    }

    // ---------- public API ----------

    toggle() {
      this.setEnabled(!this.enabled);
      this._userMuted = !this.enabled;
    }

    setEnabled(on) {
      this.enabled = Boolean(on);
      if (this.enabled) this._ensure();
      const a = this._a;
      if (a) {
        const now = a.ctx.currentTime;
        if (this.enabled && a.ctx.state === 'suspended') a.ctx.resume();
        a.master.gain.cancelScheduledValues(now);
        a.master.gain.setTargetAtTime(this.enabled ? this.masterVolume : 0.0, now, this.enabled ? 0.18 : 0.035);
      }
      if (this.onChange) this.onChange(this.enabled);
    }

    // Stops every continuous and one-shot voice by replacing the audio graph.
    // The next enable starts cleanly from the supplied timeline position.
    reset(progress) {
      this.enabled = false;
      this._prevP = clamp(progress == null ? 0 : progress, 0, 1);
      if (this._a) {
        const a = this._a;
        try {
          const now = a.ctx.currentTime;
          a.master.gain.cancelScheduledValues(now);
          a.master.gain.setValueAtTime(0, now);
          a.ctx.close();
        } catch (e) {}
        this._a = null;
      }
      if (this.onChange) this.onChange(false);
    }

    // Auto-enable on first user gesture (wheel/touch/pointer/key) unless the
    // user explicitly muted. Pass extra elements to also listen on (e.g. your
    // scroll container).
    armAutoStart() {
      if (this._autoArmed) return;
      this._autoArmed = true;
      const evs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
      const targets = [window];
      for (let i = 0; i < arguments.length; i++) if (arguments[i]) targets.push(arguments[i]);
      const start = () => {
        cleanup();
        if (this._userMuted || this.enabled) return;
        this.setEnabled(true);
      };
      const cleanup = () => { targets.forEach((t) => evs.forEach((e) => t.removeEventListener(e, start))); };
      this._autoCleanup = cleanup;
      targets.forEach((t) => evs.forEach((e) => t.addEventListener(e, start, { passive: true })));
    }

    // Call every frame with scroll progress p ∈ [0,1] and delta-time (seconds).
    // Drives continuous layers and fires threshold one-shots.
    update(p, dt) {
      if (this.enabled && this._a) this._continuous(p, dt);
      if (this.enabled && this._a) {
        for (const [th, fn] of this._events) {
          if (this._prevP < th && p >= th) fn();
        }
      }
      this._prevP = p;
    }

    dispose() {
      if (this._autoCleanup) this._autoCleanup();
      this.reset(0);
    }

    // ---------- graph construction ----------

    _ensure() {
      if (this._a) return;
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();

      // master -> compressor -> air shelf -> destination
      const master = ctx.createGain(); master.gain.value = 0;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 28; comp.ratio.value = 3.5;
      comp.attack.value = 0.005; comp.release.value = 0.3;
      const airShelf = ctx.createBiquadFilter(); airShelf.type = 'highshelf'; airShelf.frequency.value = 5000; airShelf.gain.value = -6;
      master.connect(comp); comp.connect(airShelf); airShelf.connect(ctx.destination);

      // convolution reverb (generated impulse) for cinematic space
      function makeIR(seconds, decay) {
        const len = Math.floor(ctx.sampleRate * seconds);
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const d = buf.getChannelData(ch);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
        return buf;
      }
      const conv = ctx.createConvolver(); conv.buffer = makeIR(3.6, 2.4);
      const revReturn = ctx.createGain(); revReturn.gain.value = 0.68; conv.connect(revReturn); revReturn.connect(master);
      const revSend = ctx.createGain(); revSend.gain.value = 1.0; revSend.connect(conv);
      const sendTo = (node, amt) => { const g = ctx.createGain(); g.gain.value = amt; node.connect(g); g.connect(revSend); };

      // shared pink-ish noise buffer (reused by every noise voice)
      const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = nb.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < nd.length; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        nd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.16;
      }
      const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(); return s; };

      // scroll-motion layer: responds to scroll speed
      const motion = ctx.createGain(); motion.gain.value = 0; motion.connect(master);
      const motBP = ctx.createBiquadFilter(); motBP.type = 'bandpass'; motBP.frequency.value = 600; motBP.Q.value = 1.5; motBP.connect(motion);
      noise().connect(motBP); sendTo(motion, 0.45);

      // laser bus: continuous tone + high sizzle while cutting
      const laser = ctx.createGain(); laser.gain.value = 0; laser.connect(master);
      const lbp = ctx.createBiquadFilter(); lbp.type = 'bandpass'; lbp.frequency.value = 1200; lbp.Q.value = 2; lbp.connect(laser);
      const lo = ctx.createOscillator(); lo.type = 'sine'; lo.frequency.value = 220; lo.connect(lbp); lo.start();
      const lo2 = ctx.createOscillator(); lo2.type = 'sine'; lo2.frequency.value = 660;
      const lo2g = ctx.createGain(); lo2g.gain.value = 0.25; lo2.connect(lo2g); lo2g.connect(lbp); lo2.start();
      const sizz = ctx.createGain(); sizz.gain.value = 0; sizz.connect(laser);
      const sizHP = ctx.createBiquadFilter(); sizHP.type = 'highpass'; sizHP.frequency.value = 3200; sizHP.connect(sizz);
      noise().connect(sizHP); sendTo(laser, 0.4);

      // diamond polish grind bus
      const polish = ctx.createGain(); polish.gain.value = 0; polish.connect(master);
      const polBP = ctx.createBiquadFilter(); polBP.type = 'bandpass'; polBP.frequency.value = 2500; polBP.Q.value = 1.3; polBP.connect(polish);
      noise().connect(polBP); sendTo(polish, 0.5);

      // x-ray scanner shimmer
      const xray = ctx.createGain(); xray.gain.value = 0; xray.connect(master);
      const xo = ctx.createOscillator(); xo.type = 'sine'; xo.frequency.value = 1760; xo.connect(xray); xo.start();
      const xo2 = ctx.createOscillator(); xo2.type = 'sine'; xo2.frequency.value = 2640;
      const xg2 = ctx.createGain(); xg2.gain.value = 0.4; xo2.connect(xg2); xg2.connect(xray); xo2.start();
      sendTo(xray, 0.6);

      // tension riser building into the final reveal
      const riser = ctx.createGain(); riser.gain.value = 0; riser.connect(master);
      const riserBP = ctx.createBiquadFilter(); riserBP.type = 'bandpass'; riserBP.frequency.value = 500; riserBP.Q.value = 1.8; riserBP.connect(riser);
      noise().connect(riserBP);
      const rTone = ctx.createOscillator(); rTone.type = 'sine'; rTone.frequency.value = 90;
      const rToneG = ctx.createGain(); rToneG.gain.value = 0.3; rTone.connect(rToneG); rToneG.connect(riser); rTone.start();
      sendTo(riser, 0.5);

      this._a = { ctx, master, revSend, nb, motion, motBP, laser, sizz, lo, polish, polBP, xray, riser, riserBP, rTone, spd: 0 };
    }

    // ---------- continuous layers (per-frame) ----------

    _continuous(p, dt) {
      const a = this._a;
      const now = a.ctx.currentTime;
      // normalized, smoothed scroll speed
      const dp = Math.abs(p - this._prevP) / Math.max(dt, 0.001);
      const raw = clamp(dp / 0.4, 0, 1);
      a.spd = a.spd * 0.82 + raw * 0.18;
      const spd = a.spd;

      // motion whoosh — gentle response to scrolling
      a.motion.gain.setTargetAtTime(spd * 0.12, now, 0.1);
      a.motBP.frequency.setTargetAtTime(240 + 700 * spd, now, 0.12);

      // laser cutting
      const cut = trap(p, 0.09, 0.108, 0.15, 0.157);
      a.laser.gain.setTargetAtTime(cut * 0.09, now, 0.08);
      a.sizz.gain.setTargetAtTime(cut * 0.1, now, 0.08);
      a.lo.frequency.setTargetAtTime(205 + 70 * Math.sin(now * 8.0), now, 0.05);

      // diamond polish grind
      const pol = trap(p, 0.155, 0.168, 0.185, 0.19);
      a.polish.gain.setTargetAtTime(pol * 0.025 * (0.55 + 0.45 * spd), now, 0.1);
      a.polBP.frequency.setTargetAtTime(2100 + 1000 * (0.5 + 0.5 * Math.sin(now * 2.6)), now, 0.08);

      // x-ray scanner shimmer
      const xr = trap(p, 0.678, 0.69, 0.722, 0.732);
      a.xray.gain.setTargetAtTime(xr * 0.018 * (0.6 + 0.4 * Math.sin(now * 5.0)), now, 0.1);

      // tension riser building into the final reveal (0.82 -> 0.9)
      const build = smooth(clamp(seg(p, 0.82, 0.9), 0, 1));
      const inBuild = (p > 0.8 && p < 0.905) ? 1 : 0;
      a.riser.gain.setTargetAtTime(inBuild * build * 0.045, now, 0.12);
      a.riserBP.frequency.setTargetAtTime(300 + 3200 * build, now, 0.08);
      a.rTone.frequency.setTargetAtTime(80 + 240 * build, now, 0.1);
    }

    // ---------- one-shots ----------

    // upward tonal whoosh + rising noise burst (laser fires up)
    ignite() {
      const a = this._a; if (!a) return;
      const t = a.ctx.currentTime;
      const o = a.ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.32);
      const bp = a.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 3;
      const g = a.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(bp); bp.connect(g); g.connect(a.master);
      const rs = a.ctx.createGain(); rs.gain.value = 0.4; g.connect(rs); rs.connect(a.revSend);
      o.start(t); o.stop(t + 0.52);
      const ns = a.ctx.createBufferSource(); ns.buffer = a.nb; ns.loop = true;
      const nhp = a.ctx.createBiquadFilter(); nhp.type = 'highpass';
      nhp.frequency.setValueAtTime(400, t); nhp.frequency.exponentialRampToValueAtTime(4200, t + 0.3);
      const ng = a.ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.06, t + 0.08); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      ns.connect(nhp); nhp.connect(ng); ng.connect(a.master); ns.start(t); ns.stop(t + 0.42);
    }

    // deep sine drop — soft cinematic impact. v = intensity 0..1
    boom(v) {
      const a = this._a; if (!a) return;
      v = v == null ? 1 : v;
      const t = a.ctx.currentTime;
      const o = a.ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.55);
      const g = a.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28 * v, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
      o.connect(g); g.connect(a.master);
      const rs = a.ctx.createGain(); rs.gain.value = 0.42; g.connect(rs); rs.connect(a.revSend);
      o.start(t); o.stop(t + 1.3);
      const ns = a.ctx.createBufferSource(); ns.buffer = a.nb; ns.loop = true;
      const lp = a.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(1500, t); lp.frequency.exponentialRampToValueAtTime(180, t + 0.45);
      const ng = a.ctx.createGain(); ng.gain.setValueAtTime(0.08 * v, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      ns.connect(lp); lp.connect(ng); ng.connect(a.master);
      const nrs = a.ctx.createGain(); nrs.gain.value = 0.3; ng.connect(nrs); nrs.connect(a.revSend);
      ns.start(t); ns.stop(t + 0.55);
    }

    // short mechanical click (temple locks)
    click() {
      const a = this._a; if (!a) return;
      const t = a.ctx.currentTime;
      const o = a.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(1900, t); o.frequency.exponentialRampToValueAtTime(520, t + 0.05);
      const g = a.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      o.connect(g); g.connect(a.master); o.start(t); o.stop(t + 0.11);
      const rs = a.ctx.createGain(); rs.gain.value = 0.3; g.connect(rs); rs.connect(a.revSend);
      const ns = a.ctx.createBufferSource(); ns.buffer = a.nb; ns.loop = true;
      const hp = a.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
      const ng = a.ctx.createGain(); ng.gain.setValueAtTime(0.1, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      ns.connect(hp); hp.connect(ng); ng.connect(a.master); ns.start(t); ns.stop(t + 0.05);
    }

    // low mechanical seat/thunk. v = intensity 0..1
    thunk(v) {
      const a = this._a; if (!a) return;
      v = v == null ? 1 : v;
      const t = a.ctx.currentTime;
      const o = a.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(66, t + 0.16);
      const g = a.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(g); g.connect(a.master); o.start(t); o.stop(t + 0.28);
      const rs = a.ctx.createGain(); rs.gain.value = 0.35; g.connect(rs); rs.connect(a.revSend);
    }

    // rich bell cascade + warm A-major pad swell (final reveal)
    chime() {
      const a = this._a; if (!a) return;
      const t = a.ctx.currentTime;
      const bells = [440, 554.37, 659.25, 880, 1108.73, 1318.5, 1760, 2637];
      bells.forEach((f, i) => {
        const o = a.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const g = a.ctx.createGain(); const st = t + i * 0.045;
        const peak = 0.16 / (1 + i * 0.32);
        g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(peak, st + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, st + 2.6);
        o.connect(g); g.connect(a.master);
        const rs = a.ctx.createGain(); rs.gain.value = 0.9; g.connect(rs); rs.connect(a.revSend);
        o.start(st); o.stop(st + 2.7);
      });
      const pg = a.ctx.createGain(); pg.gain.setValueAtTime(0.0001, t); pg.gain.exponentialRampToValueAtTime(0.2, t + 0.7); pg.gain.exponentialRampToValueAtTime(0.0001, t + 4.2); pg.connect(a.master);
      const prs = a.ctx.createGain(); prs.gain.value = 0.85; pg.connect(prs); prs.connect(a.revSend);
      [110, 220, 277.18, 329.63, 440, 554.37].forEach((f) => { const o = a.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(pg); o.start(t); o.stop(t + 4.3); });
    }
  }

  // UMD-ish export
  if (typeof module !== 'undefined' && module.exports) module.exports = CraftedAudio;
  global.CraftedAudio = CraftedAudio;
})(typeof window !== 'undefined' ? window : this);

export default globalThis.CraftedAudio;
