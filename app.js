/* Bass Assembly: bassline generator and step sequencer. MIT License. */
"use strict";
(function () {
  var NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
  var SCALES = {
    minpent: { label: "Minor pentatonic", iv: [0,3,5,7,10] },
    minor:   { label: "Natural minor",    iv: [0,2,3,5,7,8,10] },
    dorian:  { label: "Dorian",           iv: [0,2,3,5,7,9,10] },
    phryg:   { label: "Phrygian",         iv: [0,1,3,5,7,8,10] },
    blues:   { label: "Blues",            iv: [0,3,5,6,7,10] },
    harm:    { label: "Harmonic minor",   iv: [0,2,3,5,7,8,11] },
    majpent: { label: "Major pentatonic", iv: [0,2,4,7,9] },
    major:   { label: "Major",            iv: [0,2,4,5,7,9,11] }
  };
  var P = {
    roll: [1,.5,.7,.5,.85,.5,.7,.55,.9,.5,.7,.5,.85,.55,.7,.6],
    acid: [1,.4,.6,.7,.5,.7,.6,.5,.9,.4,.6,.7,.5,.8,.6,.7]
  };
  // Delay time: Off, 1/8, 3/16 and 1/4 of a beat. Spoken labels for screen readers.
  var DTIMES = [0, .5, .75, 1], DTIME_LABELS = ["Off", "1/8", "3/16", "1/4"],
      DTIME_SPOKEN = ["Off", "Eighth, 1/8", "Dotted eighth, 3/16", "Quarter, 1/4"];
  var DEF = { dens: 55, vel: [80, 105], gate: [.45, .8], wave: "square", q: 6, cut: 1500, dec: .22, bpm: [90, 125], drive: 0, sub: 0, glide: 50, delay: 15, dtime: .75, dfb: 35, rev: 10, rsize: 2, scale: null, w: null, reach: 5, accBeat: false, acc: .15, tie: .05, force0: true };
  var STYLES = {
    acid:  { label: "Acid", p: P.acid, dens: 62, acc: .3, tie: .3, vel: [75, 110], gate: [.5, .95], q: 14, cut: 2600, dec: .2, drive: 25, glide: 70, delay: 30, dtime: .75, dfb: 40, rev: 12, bpm: [120, 138], scale: "minpent", w: { 0: 5, 3: 2, 7: 2, 10: 2 } },
    ebm:   { label: "EBM", p: [1,.8,.9,.8,1,.8,.9,.8,1,.8,.9,.8,1,.8,.9,.85], dens: 62, acc: .1, tie: 0, accBeat: true, vel: [90, 100], gate: [.3, .45], q: 3, cut: 900, dec: .12, drive: 40, delay: 12, dtime: .5, dfb: 25, rev: 8, rsize: 1.2, bpm: [118, 135], scale: "minor", w: { 0: 8, 7: 1.5, 3: .6, 10: .6, 5: .5 }, reach: 9 },
    indus: { label: "Industrial", p: [1,0,.3,.5,0,.4,.3,0,.8,0,.5,.3,.2,.6,0,.5], dens: 50, acc: .2, tie: .15, vel: [55, 127], gate: [.35, 1], wave: "square", q: 2, cut: 700, dec: .35, drive: 65, delay: 25, dtime: 1, dfb: 50, rev: 35, rsize: 3.5, bpm: [95, 125], scale: "phryg", w: { 0: 7, 1: 3, 7: 2, 8: 1.5, 10: 1, 3: 1, 5: .7 }, reach: 8 },
    roll:  { label: "Rolling", p: P.roll, dens: 58, sub: 30 },
    dark:  { label: "Dark Wave", p: [1,.15,.9,.2,.9,.15,.85,.25,1,.15,.9,.2,.9,.15,.85,.35], dens: 45, acc: .1, tie: .05, vel: [82, 100], gate: [.5, .8], q: 4, cut: 1100, dec: .25, drive: 10, sub: 15, glide: 40, delay: 35, dtime: .75, dfb: 45, rev: 40, rsize: 3, bpm: [105, 135], scale: "minor", w: { 0: 5, 7: 3, 3: 2.5, 10: 2.5, 5: 2, 8: 1.5, 2: 1 }, reach: 6 }
  };
  Object.keys(STYLES).forEach(function (k) { STYLES[k] = Object.assign({}, DEF, STYLES[k]); });
  var S = { root: 0, scale: "minpent", oct: 2, n: 16, style: "acid", dens: 0, rep: true, bpm: 100, swing: 0, hum: 0, steps: [] };
  S.dens = STYLES[S.style].dens;
  // Humanize: a small random drift, between -1 and 1.
  function jit() { return Math.random() + Math.random() - 1; }
  // Swing: every second step comes a little later.
  function swingOf(k, dur) { return k % 2 ? dur * S.swing / 100 * .66 : 0; }
  var $ = function (id) { return document.getElementById(id); };
  // Own keys only, so names like "toString" never count.
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  // Rebuild a box and give the focus back to the same button (keyboard users stay in place).
  function setHTML(box, html) {
    var a = document.activeElement, sel = "";
    if (a && a !== box && box.contains(a)) {
      Array.prototype.forEach.call(a.attributes, function (at) {
        if (at.name.indexOf("data-") === 0) sel += "[" + at.name + '="' + at.value + '"]';
      });
    }
    box.innerHTML = html;
    var e = sel && box.querySelector(sel);
    if (e) e.focus({ preventScroll: true });
  }
  // Radio groups (Style, Octave, Steps, Half loop): read and set the checked value.
  function getR(id) { var c = $(id).querySelector("input:checked"); return c ? c.value : ""; }
  function setR(id, v) { var c = $(id).querySelector('input[value="' + v + '"]'); if (c) c.checked = true; }
  var saved = [];
  try { saved = JSON.parse(localStorage.getItem("bassassembly-ideas") || "[]"); } catch (e) { saved = []; }
  // V1 saved a theme. V2 has one theme, so remove it.
  try { localStorage.removeItem("bassassembly-theme"); } catch (e) {}
  // Keep only valid saved ideas.
  if (!Array.isArray(saved)) saved = [];
  saved = saved.filter(function (x) { return x && typeof x === "object" && typeof x.label === "string" && x.state && typeof x.state === "object"; });

  function blank() { var a = []; for (var i = 0; i < 16; i++) a.push({ on: false, m: 0, acc: false, tie: false, vel: 100, gate: .6 }); return a; }
  S.steps = blank();
  function rootMidi() { return 12 + 12 * S.oct + S.root; }
  function noteName(m) { return NAMES[m % 12] + (Math.floor(m / 12) - 1); }
  function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rv(r) { return Math.round(r[0] + Math.random() * (r[1] - r[0])); }
  function pool(span) {
    var out = [], r = rootMidi(), iv = SCALES[S.scale].iv;
    for (var o = 0; o < 3; o++) for (var k = 0; k < iv.length; k++) { var m = r + 12 * o + iv[k]; if (m <= r + span) out.push(m); }
    return out;
  }

  /* ---------- Generation ---------- */
  function weightFor(m, prev, i) {
    var st = STYLES[S.style], d = (m - rootMidi()) % 12, w = 1;
    if (st.w) w = st.w[d] !== undefined ? st.w[d] : .5;
    else if (d === 0) w = 5; else if (d === 7) w = 3; else if (d === 3 || d === 10) w = 1.8;
    if (i % 4 === 0 && (d === 0 || d === 7)) w *= 1.6;
    if (prev != null) w *= 1 / (1 + Math.abs(m - prev) / st.reach);
    return w;
  }
  function pickNote(pl, prev, i) {
    var ws = pl.map(function (m) { return weightFor(m, prev, i); });
    var t = ws.reduce(function (a, b) { return a + b; }, 0), x = Math.random() * t;
    for (var k = 0; k < pl.length; k++) { x -= ws[k]; if (x <= 0) return pl[k]; }
    return pl[0];
  }
  function prob(st, i, n) {
    if (n === 16) return st.p[i];
    return Math.max(st.p[i * 2], st.p[i * 2 + 1] * .8);
  }
  function fixTies(n) {
    for (var i = 0; i < n; i++) {
      var s = S.steps[i], nx = S.steps[(i + 1) % n];
      if (!s.on || !nx.on) s.tie = false;
    }
  }
  /* Locks: what Generate bassline, New pattern and Vary steps must not change.
     Rhythm, Notes, Sound, Style and Octave. Not saved with the ideas. */
  var LOCK = { rhythm: false, notes: false, sound: false, style: false, oct: false };
  function bothLocked() { return LOCK.rhythm && LOCK.notes; }
  // Returns false when there is nothing to change.
  // prevN: the step count before the change.
  // genInfo, for the status line: "silent" (rhythm locked, no step plays) or "nonotes"
  // (notes locked, but no note to keep).
  var genInfo = "";
  function generate(prevN) {
    if (bothLocked()) return false;
    var old = S.steps, plays = old.slice(0, prevN || S.n).some(function (s) { return s.on; });
    genInfo = plays ? "" : LOCK.rhythm ? "silent" : LOCK.notes ? "nonotes" : "";
    fresh();
    if (LOCK.rhythm) keepRhythm(old); else if (LOCK.notes) keepNotes(old, prevN || S.n);
    fixTies(S.n);
    return true;
  }
  // Rhythm locked: keep the old steps, give them new pitches.
  function keepRhythm(old) {
    var pl = pool(19), prev = null, nw = S.steps;
    S.steps = old.map(function (s, i) {
      var c = Object.assign({}, s);
      if (c.on) { c.m = nw[i].on ? nw[i].m : pickNote(pl, prev, i); prev = c.m; }
      return c;
    });
  }
  // Notes locked: the new rhythm plays the old notes in order.
  function keepNotes(old, prevN) {
    var mel = [], k = 0;
    old.slice(0, prevN).forEach(function (s) { if (s.on) mel.push(s.m); });
    if (!mel.length) return;
    S.steps.forEach(function (s, i) { if (s.on && i < S.n) s.m = mel[k++ % mel.length]; });
  }
  // Empty steps 9-16 copy steps 1-8.
  function copyFirstHalf() {
    var top = S.steps.slice(8, 16), low = S.steps.slice(0, 8);
    if (top.some(function (s) { return s.on; }) || !low.some(function (s) { return s.on; })) return false;
    for (var i = 0; i < 8; i++) S.steps[i + 8] = Object.assign({}, S.steps[i]);
    return true;
  }
  // Note of the nearest playing step.
  function nearNote(i) {
    for (var d = 1; d < S.n; d++) {
      var a = S.steps[(i - d + S.n) % S.n], b = S.steps[(i + d) % S.n];
      if (a.on) return a.m;
      if (b.on) return b.m;
    }
    return rootMidi();
  }
  function fresh() {
    var n = S.n, st = STYLES[S.style], pl = pool(19), steps = blank(), prev = null;
    var half = S.rep ? n / 2 : n;
    var factor = .35 + (S.dens / 100) * 1.25;
    for (var i = 0; i < half; i++) {
      var on = Math.random() < Math.min(1, prob(st, i, n) * factor);
      if (i === 0 && st.force0) on = true;
      if (on) {
        var m = (i === 0 && st.force0) ? rootMidi() : pickNote(pl, prev, i);
        var acc = Math.random() < st.acc || (st.accBeat && i % 4 === 0), tie = Math.random() < st.tie;
        steps[i] = { on: true, m: m, acc: acc, tie: tie, vel: Math.min(127, rv(st.vel) + (acc ? 12 : 0)), gate: +(st.gate[0] + Math.random() * (st.gate[1] - st.gate[0])).toFixed(2) };
        prev = m;
      }
    }
    if (S.rep) for (var j = 0; j < half; j++) steps[half + j] = Object.assign({}, steps[j]);
    S.steps = steps;
    if (S.rep) mutate(2, true, true);
  }
  // Vary steps: change a few steps. "free" ignores the locks.
  function mutate(count, keepRoots, free) {
    var lr = !free && LOCK.rhythm, ln = !free && LOCK.notes;
    if (lr && ln) return false;
    var n = S.n, pl = pool(19), start = keepRoots && S.rep ? n / 2 : 0;
    var on = S.steps.slice(0, n).filter(function (x) { return x.on; });
    // Rhythm locked and nothing plays: nothing to change.
    if (lr && !on.length) return "silent";
    // Notes locked: never leave every step silent.
    var keep = ln && on.length ? on[0].m : rootMidi();
    for (var c = 0; c < count; c++) {
      var i = start + Math.floor(Math.random() * (n - start)), s = S.steps[i], r = Math.random();
      if (lr) {
        var heard = [];
        for (var k = start; k < n; k++) if (S.steps[k].on) heard.push(k);
        if (!heard.length) break;
        i = rnd(heard); S.steps[i].m = pickNote(pl, null, i);
        continue;
      }
      if (ln) r = .55 + Math.random() * .45;
      if (r < .55) {
        if (!s.on) { s.on = true; }
        s.m = pickNote(pl, null, i);
      } else if (r < .75) { s.on = !s.on; if (s.on) s.m = ln ? nearNote(i) : pickNote(pl, null, i); }
      else if (r < .8) { s.acc = !s.acc; }
      else if (r < .9) { var stt = STYLES[S.style]; s.vel = rv(stt.vel); s.gate = +(stt.gate[0] + Math.random() * (stt.gate[1] - stt.gate[0])).toFixed(2); }
      else { s.tie = !s.tie; }
      if (!s.on) { s.acc = false; s.tie = false; }
    }
    if (!S.steps.slice(0, n).some(function (x) { return x.on; })) { S.steps[0] = { on: true, m: keep, acc: false, tie: false }; }
    fixTies(n);
    return true;
  }

  /* ---------- Rendering ---------- */
  var cur = -1, selStep = 0;
  // Phones show 8 steps at a time (steps 1-8 or 9-16).
  var phone = window.matchMedia ? window.matchMedia("(max-width: 560px)") : { matches: false };
  var seqPage = 0, gridStale = false;
  function seqPaged() { return phone.matches && S.n === 16; }
  function render() {
    drawGrid();
    table();
    kbRender();
    savedList();
    lcdRender();
    mark(cur);
  }
  // Redraw the sequencer grid only.
  function drawGrid() {
    var rows = pool(24).slice().reverse(), g = $("grid");
    var paged = seqPaged(), from = paged ? seqPage * 8 : 0, n = paged ? from + 8 : S.n;
    $("seqpages").hidden = !paged;
    $("seqpages").querySelectorAll("[data-page]").forEach(function (b) { b.setAttribute("aria-pressed", +b.dataset.page === seqPage); });
    // Phones: the grid fits the screen, with 8 or 16 steps.
    g.classList.toggle("fit", phone.matches);
    g.style.gridTemplateColumns = "46px repeat(" + (n - from) + ", minmax(26px, 1fr))";
    var h = '<div class="lbl"></div>';
    for (var i = from; i < n; i++) h += '<div class="hd' + (i % 4 === 0 ? " beat" : "") + '" data-hd="' + i + '">' + (i + 1) + "</div>";
    rows.forEach(function (m) {
      var isRoot = (m - rootMidi()) % 12 === 0;
      h += '<div class="lbl' + (isRoot ? " root" : "") + '">' + noteName(m) + "</div>";
      for (var i = from; i < n; i++) {
        var s = S.steps[i], on = s.on && s.m === m;
        // Every other group of 4 steps is a bit darker.
        h += '<button class="c' + (on ? " on" : "") + (isRoot ? " r" : "") + (Math.floor(i / 4) % 2 ? " alt" : "") + '" data-i="' + i + '" data-m="' + m + '" aria-label="Step ' + (i + 1) + ", " + noteName(m) + (on ? ", active" : "") + '"></button>';
      }
    });
    // Accent and Tie: grey when off, black when on.
    h += '<div class="lbl">Accent</div>';
    for (var a = from; a < n; a++) h += '<button class="c flag' + (S.steps[a].acc ? " on" : "") + '" data-acc="' + a + '" aria-pressed="' + !!S.steps[a].acc + '" aria-label="Accent step ' + (a + 1) + '">A</button>';
    h += '<div class="lbl">Tie</div>';
    for (var t = from; t < n; t++) h += '<button class="c flag tie' + (S.steps[t].tie ? " on" : "") + '" data-tie="' + t + '" aria-pressed="' + !!S.steps[t].tie + '" aria-label="Tie step ' + (t + 1) + '">~</button>';
    h += '<div class="lbl">Vel</div>';
    for (var v = from; v < n; v++) h += barHtml(v, true);
    h += '<div class="lbl">Gate</div>';
    for (var q = from; q < n; q++) h += barHtml(q, false);
    setHTML(g, h);
  }
  function gridView() {
    // Wait for a Vel or Gate drag to end before redrawing.
    if (drag) { gridStale = true; return; }
    drawGrid(); mark(cur);
  }

  /* Sequence preview: one column per step, a bar at the height of its note.
     Notes changed by the last generate are orange. */
  var changed = [];
  function snap() { return S.steps.map(function (s) { return Object.assign({}, s); }); }
  function markChanged(before) {
    var list = [], same = 0;
    for (var i = 0; i < S.n; i++) {
      var s = S.steps[i], o = before[i];
      if (!s.on) continue;
      if (o.on && o.m === s.m) same++; else list.push(i);
    }
    changed = same ? list : [];
  }
  function lcdRender() {
    var n = S.n, r = rootMidi(), h = "";
    for (var i = 0; i < n; i++) {
      var s = S.steps[i], f = n > 1 ? i / (n - 1) : 0;
      var rgb = [9 + f * 216, 10 + f * 215, 12 + f * 215].map(Math.round).join(",");
      h += '<span class="col' + (f >= .5 ? " lt" : "") + '" style="background:rgb(' + rgb + ')">';
      if (s.on) {
        var top = 88.3 - Math.max(0, Math.min(24, s.m - r)) / 24 * 72;
        h += '<i class="nt' + (changed.indexOf(i) >= 0 ? " new" : "") + '" style="top:' + top.toFixed(1) + '%"></i>';
      }
      h += '<i class="num">' + (i + 1) + '</i><i class="ph"></i></span>';
    }
    $("lcdscreen").innerHTML = h;
  }
  // Velocity and gate of a step. A tied step has a 100% gate.
  function velOf(s) { return s.vel || 100; }
  function gateRaw(s) { return s.gate || .6; }
  function gateOf(s) { return s.tie ? 1 : gateRaw(s); }
  function gatePct(s) { return Math.round(gateOf(s) * 100); }

  // Vel and Gate bars. Rest steps have none. A tied step shows "tie".
  function barKey(isV) { return isV ? "vel" : "gate"; }
  function barState(i, isV) {
    var s = S.steps[i], now = isV ? velOf(s) : gatePct(s), tied = !isV && s.on && s.tie;
    var txt = s.on ? (isV ? String(now) : tied ? "tie" : now + "%") : "";
    return {
      on: s.on, now: now, txt: txt,
      aria: tied ? "100%, tied to the next step" : txt,
      pct: s.on ? (isV ? Math.round(now / 127 * 100) : now) : 0
    };
  }
  function barHtml(i, isV) {
    var b = barState(i, isV), cls = "c bar" + (isV ? "" : " g") + (b.on ? "" : " off"), attr;
    if (!b.on) attr = ' aria-hidden="true"';
    else attr = ' role="slider" tabindex="0" aria-label="' + (isV ? "Velocity" : "Gate") + " step " + (i + 1) + '"' +
      ' aria-valuemin="' + (isV ? 10 : 5) + '" aria-valuemax="' + (isV ? 127 : 100) + '" aria-valuenow="' + b.now + '"' +
      ' aria-valuetext="' + b.aria + '"';
    return '<div class="' + cls + '" data-' + barKey(isV) + '="' + i + '"' + attr + "><span>" + b.txt + '</span><b><i style="height:' + b.pct + '%"></i></b></div>';
  }
  // Update a bar in place (keeps focus, drag stays fast).
  function paintBar(el, i, isV) {
    var b = barState(i, isV);
    el.firstChild.textContent = b.txt;
    el.querySelector("i").style.height = b.pct + "%";
    el.setAttribute("aria-valuenow", b.now);
    el.setAttribute("aria-valuetext", b.aria);
  }
  function setBar(i, isV, y) {
    var s = S.steps[i];
    if (!s.on) return false;
    y = Math.max(0, Math.min(1, y));
    if (isV) { s.vel = Math.max(10, Math.round(y * 127)); return true; }
    var g = Math.max(.05, +y.toFixed(2));
    if (s.tie) {
      // Lowering the gate of a tied step removes the tie.
      if (g >= 1) return false;
      s.tie = false;
      var flag = $("grid").querySelector('[data-tie="' + i + '"]');
      if (flag) { flag.classList.remove("on"); flag.setAttribute("aria-pressed", "false"); }
    }
    s.gate = g;
    return true;
  }
  var PADS_TOP = [["C#", 1], ["D#", 3], ["", -1], ["F#", 6], ["G#", 8], ["A#", 10], ["", -1], ["", -1]];
  var PADS_BOT = [["C", 0], ["D", 2], ["E", 4], ["F", 5], ["G", 7], ["A", 9], ["B", 11], ["C", 12]];
  // Play it on your gear: what the step keys, pads and keyboard show.
  var BLACK = { 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 };
  function kbInfo() {
    var n = S.n, used = {}, usedM = {}, low = null;
    if (selStep >= n) selStep = 0;
    var high = -1;
    S.steps.slice(0, n).forEach(function (x) {
      if (x.on) { used[x.m % 12] = 1; usedM[x.m] = 1; high = Math.max(high, x.m); var bl = Math.floor(x.m / 12); if (low === null || bl < low) low = bl; }
    });
    if (low === null) low = Math.floor(rootMidi() / 12);
    var sel = S.steps[selStep];
    return { n: n, sel: sel, used: used, usedM: usedM, low: low, high: high, selPc: sel.on ? sel.m % 12 : -1, rel: sel.on ? Math.floor(sel.m / 12) - low : 0 };
  }
  // Pads: empty, plain, used (dot) or selected (orange).
  function padCls(v, k) {
    if (v === -1) return "pd hw-slot";
    if (v === 12) return "pd hw-pad" + (k.used[0] ? " used" : "");
    return "pd hw-pad" + (v === k.selPc ? " sel" : k.used[v] ? " used" : "");
  }
  function keyCls(m, k) { return (BLACK[m % 12] ? "bk" : "wk") + (k.sel.on && m === k.sel.m ? " sel" : (k.usedM[m] ? " used" : "")); }
  // Fixed layout: only the values change while playing.
  function kbFill(k) {
    var sel = k.sel, on = sel.on, pc = on ? sel.m % 12 : 0;
    var v = {
      step: (selStep + 1) + "/" + k.n,
      note: on ? noteName(sel.m) : "rest",
      row: on ? (BLACK[pc] ? "top" : "bottom") : "-",
      oct: on ? "+" + k.rel : "-",
      vel: on ? String(velOf(sel)) : "-",
      gate: on ? gatePct(sel) + "%" : "-",
      acc: on ? (sel.acc ? "yes" : "no") : "-",
      tie: on ? (sel.tie ? "yes" : "no") : "-"
    };
    Object.keys(v).forEach(function (f) { $("ki-" + f).textContent = v[f]; });
  }
  // Full rebuild, when the notes change.
  function kbRender() {
    var k = kbInfo(), h = "", i;
    $("stepsel").style.setProperty("--n", k.n);
    // Step keys: note name above, orange when selected.
    for (i = 0; i < k.n; i++) {
      var st = S.steps[i];
      h += '<div class="stp"><small>' + (st.on ? noteName(st.m) : "") + '</small>' +
           '<button class="key chip' + (st.on ? "" : " off") + (i === selStep ? " sel" : "") + '" data-sel="' + i + '" aria-pressed="' + (i === selStep) + '" aria-label="Step ' + (i + 1) + (st.on ? ", " + noteName(st.m) : ", rest") + '">' + (i + 1) + "</button></div>";
    }
    setHTML($("stepsel"), h);
    // Two rows of 8 pads, plus Oct + and Oct -.
    function pad(p) { return '<div class="' + padCls(p[1], k) + '" data-v="' + p[1] + '"><i></i>' + p[0] + "</div>"; }
    $("pads").innerHTML = PADS_TOP.map(pad).join("") + PADS_BOT.map(pad).join("") +
      '<div class="pd hw-pad oct up">Oct +</div><div class="pd hw-pad oct down">Oct −</div>';
    // Keyboard: from the lowest C needed, at least two octaves.
    var kb = "", wi = 0, base = k.low * 12, top = base + Math.max(24, Math.ceil((k.high - base) / 12) * 12);
    for (var m = base; m <= top; m++) {
      var pc = m % 12;
      if (BLACK[pc]) kb += '<div class="' + keyCls(m, k) + '" data-m="' + m + '" style="--i:' + wi + '"><span><i></i></span></div>';
      else { kb += '<div class="' + keyCls(m, k) + '" data-m="' + m + '" style="--i:' + wi + '"><span><i></i>' + (pc === 0 ? "C" + (Math.floor(m / 12) - 1) : "") + "</span></div>"; wi++; }
    }
    $("kb").style.setProperty("--nw", wi);
    $("kb").innerHTML = kb;
    kbReveal();
    kbFill(k);
  }
  // Light update during playback: only classes change.
  function kbSelect() {
    var k = kbInfo();
    Array.prototype.forEach.call($("stepsel").querySelectorAll(".chip"), function (c) {
      var on = +c.dataset.sel === selStep;
      c.classList.toggle("sel", on); c.setAttribute("aria-pressed", on);
    });
    Array.prototype.forEach.call($("pads").querySelectorAll("[data-v]"), function (p) { p.className = padCls(+p.dataset.v, k); });
    Array.prototype.forEach.call($("kb").children, function (key) { key.className = keyCls(+key.dataset.m, k); });
    kbReveal();
    kbFill(k);
  }
  // Scroll the selected key into view if the keyboard is too wide.
  function kbReveal() {
    var key = $("kb").querySelector(".sel"), wrap = $("kb").parentNode;
    if (!key || wrap.scrollWidth <= wrap.clientWidth) return;
    var r = key.getBoundingClientRect(), w = wrap.getBoundingClientRect();
    if (r.left < w.left || r.right > w.right) wrap.scrollLeft += r.left - w.left - (w.width - r.width) / 2;
  }
  // The cells of a step, shared by the tables, the copied text and the .txt file.
  function stepCells(i) {
    var s = S.steps[i];
    if (!s.on) return [String(i + 1), "rest"];
    var fl = [];
    if (s.acc) fl.push("accent");
    if (s.tie) fl.push("tie");
    var d = s.m - rootMidi();
    return [String(i + 1), noteName(s.m), String(s.m), (d < 0 ? "" : "+") + d, String(velOf(s)), gatePct(s) + "%", fl.join(", ")];
  }
  // Steps 1-8 in the first table, 9-16 in the second.
  function table() {
    var h = ["", ""];
    for (var i = 0; i < S.n; i++) {
      var c = stepCells(i);
      while (c.length < 7) c.push("");
      h[i < 8 ? 0 : 1] += "<tr><td>" + c.join("</td><td>") + "</td></tr>";
    }
    $("tbody1").innerHTML = h[0];
    $("tbody2").innerHTML = h[1];
    $("table2").hidden = S.n <= 8;
    copySeq++; // ignore a late clipboard answer
    // Old download links are removed.
    if ($("copyout").firstElementChild) copyOut("", true);
    if ($("midiout").firstElementChild) dropFile("midiout");
  }
  // The pattern as plain text, aligned for a monospace font.
  function notesText() {
    var head = ["Step", "Note", "MIDI", "Semitones", "Vel", "Gate", "Notes"], rows = [head], w = [], i, lines = [];
    for (i = 0; i < S.n; i++) rows.push(stepCells(i));
    rows.forEach(function (r) { r.forEach(function (c, k) { w[k] = Math.max(w[k] || 0, c.length); }); });
    rows.forEach(function (r) {
      lines.push(r.map(function (c, k) { return k < r.length - 1 ? c + new Array(w[k] - c.length + 3).join(" ") : c; }).join("").replace(/\s+$/, ""));
    });
    return "Bass Assembly bassline (bassassembly.app)\n" +
      STYLES[S.style].label + ", " + NAMES[S.root] + " " + SCALES[S.scale].label.toLowerCase() + ", " + S.n + " steps, " + S.bpm + " bpm" + (S.swing ? ", swing " + S.swing + "%" : "") + "\n\n" +
      lines.join("\n") + "\n\n" +
      "Semitones: distance from the root note. Vel: 0 to 127. Gate: % of the step.\n" +
      "Tie: turn on glide on your synth and lengthen the note.\n";
  }
  function mark(i) {
    var g = $("grid"), lcd = $("lcdscreen"), was = lcd.querySelector(".now");
    g.querySelectorAll(".now").forEach(function (e) { e.classList.remove("now"); });
    if (was) was.classList.remove("now");
    // Phones: light the page key of the half being played.
    $("seqpages").querySelectorAll("[data-page]").forEach(function (b) { b.classList.toggle("now", i >= 0 && +b.dataset.page === Math.floor(i / 8)); });
    if (i < 0) return;
    if (lcd.children[i]) lcd.children[i].classList.add("now");
    if (i !== selStep) { selStep = i; kbSelect(); }
    // Current step turns orange.
    g.querySelectorAll('[data-hd="' + i + '"], [data-i="' + i + '"].on, [data-vel="' + i + '"]:not(.off), [data-gate="' + i + '"]:not(.off)').forEach(function (e) {
      e.classList.add("now");
    });
  }
  function status(t) { $("status").textContent = t; }

  /* ---------- Saved ideas ---------- */
  function persist() { try { localStorage.setItem("bassassembly-ideas", JSON.stringify(saved)); } catch (e) {} }
  // Saved ideas list, hidden when empty. A new idea flashes once.
  function savedList(justSaved) {
    $("ideas").hidden = !saved.length;
    $("ideascount").textContent = "(" + saved.length + ")";
    var h = "";
    saved.forEach(function (x, k) {
      h += '<div class="item' + (justSaved && k === 0 ? " new" : "") + '"><button class="load" data-load="' + k + '" title="Load this idea">' + esc(x.label) +
        '</button><button class="key x" data-del="' + k + '" aria-label="Delete the idea ' + esc(x.label) + '">×</button></div>';
    });
    setHTML($("saved"), h);
  }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  // Saved ideas come from browser storage: keep only valid keys and values.
  function num(v, lo, hi, d) { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }
  function cleanState(st) {
    var c = {}, i;
    c.style = has(STYLES, st.style) ? st.style : "acid";
    c.scale = has(SCALES, st.scale) ? st.scale : "minpent";
    c.root = Math.round(num(st.root, 0, 11, 0));
    c.oct = [1, 2, 3].indexOf(+st.oct) >= 0 ? +st.oct : 2;
    c.n = +st.n === 8 ? 8 : 16;
    // Density: no control any more, still read from old saved ideas.
    c.dens = Math.round(num(st.dens, 10, 100, STYLES[c.style].dens));
    c.rep = st.rep !== false;
    c.bpm = Math.round(num(st.bpm, 60, 170, 100));
    c.swing = Math.round(num(st.swing, 0, 60, 0));
    c.hum = Math.round(num(st.hum, 0, 100, 0));
    c.steps = blank();
    if (Array.isArray(st.steps)) for (i = 0; i < 16; i++) {
      var s = st.steps[i];
      if (!s || typeof s !== "object") continue;
      c.steps[i] = { on: !!s.on, m: Math.round(num(s.m, 0, 127, 36)), acc: !!s.acc, tie: !!s.tie,
                     vel: Math.round(num(s.vel, 10, 127, 100)), gate: num(s.gate, .05, 1, .6) };
    }
    if (st.snd && typeof st.snd === "object") {
      var d = st.snd;
      c.snd = { wave: ["square", "sawtooth", "triangle"].indexOf(d.wave) >= 0 ? d.wave : "square",
                cut: num(d.cut, 200, 6000, 1500), q: num(d.q, 1, 20, 6), dec: num(d.dec, .05, .6, .22),
                drive: num(d.drive, 0, 100, 0), sub: num(d.sub, 0, 100, 0), glide: num(d.glide, 10, 200, 50),
                delay: num(d.delay, 0, 100, 15), dtime: DTIMES.indexOf(+d.dtime) >= 0 ? +d.dtime : .75,
                dfb: num(d.dfb, 0, 85, 35), rev: num(d.rev, 0, 100, 10), rsize: num(d.rsize, .5, 4, 2) };
    }
    return c;
  }
  var STATE_KEYS = ["root", "scale", "oct", "n", "dens", "rep", "steps", "style", "bpm", "swing", "hum", "snd"];
  // Load a state (saved idea or undo step) into S and the controls.
  function loadState(st) {
    STATE_KEYS.forEach(function (k) { if (st[k] !== undefined) S[k] = st[k]; });
    fixTies(S.n);
    changed = [];
    $("root").value = S.root; $("scale").value = S.scale; setR("oct", S.oct); setR("n", S.n); setR("rep", S.rep ? 1 : 0);
    setR("style", S.style); $("bpm").value = S.bpm; $("swing").value = S.swing; $("hum").value = S.hum || 0;
    readControls();
    // Fewer steps: restart the loop.
    if (playing && pos >= S.n) pos = 0;
    if (S.snd) setSound(Object.assign(styleSound(STYLES[S.style]), S.snd));
    render();
  }
  function applySaved(e) {
    if (drag) endDrag();
    var before = stateNow();
    loadState(cleanState(e.state));
    if (playing) pos = 0;
    remember("Load idea", before);
    status("Idea loaded.");
  }

  /* ---------- Audio ---------- */
  var ctx = null, playing = false, nextT = 0, pos = 0, timer = null, run = 0;
  // The note still sounding (held by a tie).
  var live = { voice: null };
  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var bus = null, irSize = 0;
  function makeIR(ac, sec) {
    var rate = ac.sampleRate, len = Math.floor(rate * sec), buf = ac.createBuffer(2, len, rate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }
  // Effects: dry, delay and reverb. Used by the player and the .wav export.
  function wireBus(ac) {
    var inp = ac.createGain(), dry = ac.createGain(), dl = ac.createDelay(2), fb = ac.createGain(), tone = ac.createBiquadFilter();
    var dsend = ac.createGain(), conv = ac.createConvolver(), rsend = ac.createGain(), master = ac.createGain();
    tone.type = "lowpass"; tone.frequency.value = 2800; master.gain.value = .9;
    inp.connect(dry); dry.connect(master);
    inp.connect(dsend); dsend.connect(dl); dl.connect(tone); tone.connect(fb); fb.connect(dl); tone.connect(master);
    inp.connect(rsend); rsend.connect(conv); conv.connect(master);
    master.connect(ac.destination);
    return { ctx: ac, inp: inp, dl: dl, fb: fb, dsend: dsend, conv: conv, rsend: rsend };
  }
  // Effect levels from the Sound settings.
  function fxLevels(sd) {
    return { dsend: sd.dtime ? sd.delay / 100 * .7 : 0, fb: Math.min(.85, sd.dfb / 100), dtime: sd.dtime * 60 / S.bpm, rsend: sd.rev / 100 * .9 };
  }
  function ensureBus() {
    if (bus && bus.ctx === ctx) return bus;
    bus = wireBus(ctx);
    bus.an = ctx.createAnalyser();
    bus.an.fftSize = 4096; // about 90 ms
    bus.inp.connect(bus.an); // before delay and reverb
    live.ac = ctx; live.out = bus.inp;
    irSize = 0; applyFx();
    return bus;
  }
  function applyFx() {
    if (!bus || !S.snd) return;
    var fx = fxLevels(S.snd), t = ctx.currentTime;
    // Delay Off: let the echoes fade out.
    bus.dsend.gain.setTargetAtTime(fx.dsend, t, .03);
    bus.fb.gain.setTargetAtTime(fx.fb, t, .03);
    if (fx.dtime) bus.dl.delayTime.setTargetAtTime(fx.dtime, t, .05);
    bus.rsend.gain.setTargetAtTime(fx.rsend, t, .03);
    if (Math.abs(S.snd.rsize - irSize) > .05) {
      // The reverb is heavy to build: rebuild it only once the knob stops.
      clearTimeout(irTimer);
      if (!irSize) setIR(); else irTimer = setTimeout(setIR, 150);
    }
  }
  var irTimer = null;
  function setIR() {
    if (!bus || !S.snd) return;
    bus.conv.buffer = makeIR(ctx, S.snd.rsize); irSize = S.snd.rsize;
  }
  var curves = {};
  function curve(d) {
    if (curves[d]) return curves[d];
    var n = 1024, c = new Float32Array(n), a = 1 + d / 8;
    for (var i = 0; i < n; i++) { var x = i / (n / 2) - 1; c[i] = Math.tanh(a * x); }
    return (curves[d] = c);
  }
  function startVoice(eng, m, t, acc, vel) {
    var sd = S.snd, k = Math.pow((vel || 100) / 127, 1.4), ac = eng.ac;
    var o = ac.createOscillator(), o2 = ac.createOscillator(), sg = ac.createGain();
    var f = ac.createBiquadFilter(), g = ac.createGain(), sh = ac.createWaveShaper();
    o.type = sd.wave; o.frequency.setValueAtTime(freq(m), t);
    o2.type = "sine"; o2.frequency.setValueAtTime(freq(m) / 2, t); sg.gain.value = sd.sub / 100;
    f.type = "lowpass"; f.Q.value = sd.q;
    var peak = sd.cut * (acc ? 2 : 1) * (.5 + k);
    f.frequency.setValueAtTime(peak, t); f.frequency.exponentialRampToValueAtTime(Math.max(120, sd.cut * .15), t + sd.dec);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((.08 + .38 * k * (acc ? 1.25 : 1)) * (1 - sd.drive / 400), t + .005);
    if (sd.drive > 0) sh.curve = curve(sd.drive);
    o.connect(f); o2.connect(sg); sg.connect(f); f.connect(sh); sh.connect(g); g.connect(eng.out);
    o.start(t); o2.start(t);
    return { o: o, o2: o2, g: g, f: f, m: m };
  }
  function endVoice(v, t) {
    v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0.0001, t, .015); v.o.stop(t + .15); v.o2.stop(t + .15);
  }
  // Play step i at time t0. Used by the player and the .wav export.
  function playStep(eng, i, t0, dur, floor) {
    var s = S.steps[i], h = (S.hum || 0) / 100, t = t0, voice = eng.voice, drift = eng.jit || jit;
    if (h) t = Math.max(floor, t0 + drift() * h * dur * .2);
    if (s.on) {
      var vel = h ? Math.max(1, Math.min(127, Math.round(velOf(s) + drift() * h * 14))) : velOf(s);
      var gate = h ? Math.max(.05, Math.min(1, gateRaw(s) * (1 + drift() * h * .25))) : gateRaw(s);
      if (voice && voice.tied) {
        // Slide: glide from the previous pitch.
        var gl = Math.max(.02, S.snd.glide / 1000);
        voice.o.frequency.cancelScheduledValues(t); voice.o.frequency.setValueAtTime(freq(voice.m), t);
        voice.o.frequency.exponentialRampToValueAtTime(freq(s.m), t + gl);
        voice.o2.frequency.cancelScheduledValues(t); voice.o2.frequency.setValueAtTime(freq(voice.m) / 2, t);
        voice.o2.frequency.exponentialRampToValueAtTime(freq(s.m) / 2, t + gl);
        voice.m = s.m;
      } else {
        if (voice) endVoice(voice, t);
        voice = startVoice(eng, s.m, t, s.acc, vel);
      }
      voice.tied = s.tie && S.steps[(i + 1) % S.n].on;
      if (!voice.tied) { endVoice(voice, t + dur * gate); voice = null; }
    } else if (voice) { endVoice(voice, t); voice = null; }
    eng.voice = voice;
  }
  function schedule(i, t0, dur) {
    ensureBus();
    playStep(live, i, t0, dur, ctx.currentTime + .005);
    // Move the playhead, unless playback stopped or the step is gone.
    var delay = Math.max(0, (t0 - ctx.currentTime) * 1000), r = run;
    setTimeout(function () { if (playing && r === run && i < S.n) { cur = i; mark(i); } }, delay);
  }
  // Metronome: a click on every beat, higher on step 1. Not in the exports.
  var metroOn = false;
  function metroClick(t, accent) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    // Triangle wave: the click cuts through the bass.
    o.type = "triangle"; o.frequency.value = accent ? 1760 : 1320;
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? .8 : .55, t + .002);
    g.gain.exponentialRampToValueAtTime(.0001, t + .07);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + .08);
  }
  function tick() {
    var dur = 60 / S.bpm / 4;
    while (nextT < ctx.currentTime + .15) {
      if (metroOn && pos % 4 === 0) metroClick(nextT, pos === 0);
      schedule(pos, nextT + swingOf(pos, dur), dur);
      nextT += dur; pos = (pos + 1) % S.n;
    }
  }
  // All Play keys show the same state: Play or Stop.
  function updatePlay() {
    Array.prototype.forEach.call(document.querySelectorAll("button.play"), function (b) {
      var txt = b.querySelector(".ptxt"), label = playing ? "Stop" : "Play";
      b.classList.toggle("is-pressed", playing);
      if (txt) txt.textContent = label; else b.setAttribute("aria-label", label);
    });
  }
  // iOS mutes Web Audio when the silent switch is on. Fix: audio session and a silent looping <audio>.
  var IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var silence = null;
  function silentWav() {
    var n = 4000, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    function str(o, s) { for (var i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); }
    str(0, "RIFF"); v.setUint32(4, 36 + n, true); str(8, "WAVEfmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true);
    v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, "data"); v.setUint32(40, n, true);
    b.fill(128, 44); // 8-bit PCM silence
    return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
  }
  function unmuteIOS() {
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    if (!IOS) return;
    try {
      if (!silence) { silence = new Audio(silentWav()); silence.loop = true; silence.setAttribute("playsinline", ""); }
      var p = silence.play(); if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function play() {
    unmuteIOS();
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) { status("Sound is blocked in this browser. The notes can still be copied."); return; }
    playing = true; run++; pos = 0; nextT = ctx.currentTime + .08; live.voice = null;
    timer = setInterval(tick, 25); tick();
    updatePlay();
    ensureBus(); scopeStart();
  }
  function stop() {
    if (silence) silence.pause();
    playing = false; run++; clearInterval(timer);
    if (live.voice && ctx) { endVoice(live.voice, ctx.currentTime); live.voice = null; }
    cur = -1; mark(-1);
    updatePlay();
    scopeStop();
  }

  /* ---------- Scope ----------
     Stopped: the shape of the sound from the settings.
     Playing: the live sound. Still when reduced motion is on. */
  var SCOPE_W = 173, SCOPE_MID = 41.22, SCOPE_AMP = 30;
  var scopeRaf = 0, scopeBuf = null, scopePeak = .05, scopeM = 0, scopeSeen = true;
  // at(f): the signal at fraction f of the window. scale: to pixels.
  function scopeDraw(at, scale) {
    var d = "", pts = SCOPE_W * 2;
    for (var j = 0; j <= pts; j++) {
      var y = SCOPE_MID - Math.max(-40, Math.min(40, at(j / pts) * scale));
      d += (j ? "L" : "M") + (j / 2).toFixed(1) + " " + y.toFixed(1);
    }
    $("scopetrace").setAttribute("d", d);
  }
  function scopeWave(w, ph) { // one cycle, ph from 0 to 1
    if (w === "sawtooth") return 2 * ph - 1;
    if (w === "triangle") return ph < .25 ? 4 * ph : ph < .75 ? 2 - 4 * ph : 4 * ph - 4;
    return ph < .5 ? 1 : -1;
  }
  function scopeStatic() {
    var sd = S.snd; if (!sd) return;
    var rate = 44100, f0 = 220, per = rate / f0, warm = 4, cycles = 2.5;
    // Low-pass filter, same as Web Audio.
    var w0 = 2 * Math.PI * Math.min(sd.cut, rate * .45) / rate, cw = Math.cos(w0);
    var al = Math.sin(w0) / (2 * Math.pow(10, sd.q / 20)), a0 = 1 + al;
    var b0 = (1 - cw) / 2 / a0, b1 = (1 - cw) / a0, a1 = -2 * cw / a0, a2 = (1 - al) / a0;
    var x1 = 0, x2 = 0, y1 = 0, y2 = 0, drv = 1 + sd.drive / 8, out = [];
    var start = Math.round(per * warm), n = Math.round(per * (warm + cycles)); // let the filter settle first
    for (var i = 0; i <= n; i++) {
      var x = scopeWave(sd.wave, (i / per) % 1) + Math.sin(Math.PI * i / per) * sd.sub / 100;
      var y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      // Drive: tanh curve.
      if (i >= start) out.push(sd.drive > 0 ? Math.tanh(drv * Math.max(-1, Math.min(1, y))) : y);
    }
    var pk = out.reduce(function (a, v) { return Math.max(a, Math.abs(v)); }, 0);
    scopeDraw(function (f) { return out[Math.round(f * (out.length - 1))]; }, SCOPE_AMP / Math.max(1, pk));
  }
  function scopeLive() {
    scopeRaf = 0;
    if (!playing || !bus || bus.ctx !== ctx) return;
    var an = bus.an, n = an.fftSize;
    if (!scopeBuf) scopeBuf = new Float32Array(n);
    an.getFloatTimeDomainData(scopeBuf);
    var st = cur >= 0 ? S.steps[cur] : null;
    if (st && st.on) scopeM = st.m;
    var per = ctx.sampleRate / freq(scopeM || rootMidi()), span = Math.min(n - 1, Math.round(per * 2.5));
    var s0 = 0, lim = Math.min(n - 1 - span, per * 1.5);
    for (var i = 1; i < lim; i++) if (scopeBuf[i - 1] < 0 && scopeBuf[i] >= 0) { s0 = i; break; }
    var pk = 0;
    for (i = s0; i <= s0 + span; i++) pk = Math.max(pk, Math.abs(scopeBuf[i]));
    // Auto scale: follows the loudest peak, slowly.
    scopePeak = Math.max(pk, scopePeak * .97, .02);
    scopeDraw(function (f) { return scopeBuf[s0 + Math.round(f * span)]; }, SCOPE_AMP / scopePeak);
    if (scopeSeen) scopeRaf = requestAnimationFrame(scopeLive);
  }
  function scopeStart() {
    if (scopeRaf || !playing || !scopeSeen || (reduceMotion && reduceMotion.matches)) return;
    scopeRaf = requestAnimationFrame(scopeLive);
  }
  function scopeStop() {
    if (scopeRaf) cancelAnimationFrame(scopeRaf);
    scopeRaf = 0; scopePeak = .05; scopeStatic();
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      scopeSeen = entries[entries.length - 1].isIntersecting;
      scopeStart();
    }).observe(document.querySelector(".scope"));
  }

  /* ---------- Events ---------- */
  function fillSelect(id, obj, key) {
    $(id).innerHTML = Object.keys(obj).map(function (k) { return '<option value="' + k + '">' + (key ? obj[k][key] : obj[k]) + "</option>"; }).join("");
  }
  $("root").innerHTML = NAMES.map(function (n, i) { return '<option value="' + i + '">' + n + "</option>"; }).join("");
  fillSelect("scale", SCALES, "label");

  function readSound() {
    S.snd = { wave: getR("wave"), cut: +$("cut").value, q: +$("q").value, dec: +$("dec").value / 100, drive: +$("drive").value, sub: +$("sub").value, glide: +$("glide").value,
              delay: +$("delay").value, dtime: DTIMES[+$("dtime").value], dfb: +$("dfb").value, rev: +$("rev").value, rsize: +$("rsize").value / 10 };
    knobValue("cut", S.snd.cut + " Hz"); knobValue("q", String(S.snd.q)); knobValue("dec", Math.round(S.snd.dec * 1000) + " ms");
    knobValue("drive", S.snd.drive + "%"); knobValue("sub", S.snd.sub + "%"); knobValue("glide", S.snd.glide + " ms");
    knobValue("delay", S.snd.delay + "%"); knobValue("dtime", DTIME_LABELS[+$("dtime").value], DTIME_SPOKEN[+$("dtime").value]);
    knobValue("dfb", S.snd.dfb + "%"); knobValue("rev", S.snd.rev + "%"); knobValue("rsize", S.snd.rsize.toFixed(1) + " s");
    // Wave name in the corner of the scope.
    $("scopename").textContent = S.snd.wave;
    if (!scopeRaf) scopeStatic();
    applyFx();
  }
  function setSound(sd) {
    setR("wave", sd.wave); $("cut").value = sd.cut; $("q").value = sd.q; $("dec").value = Math.round(sd.dec * 100);
    $("drive").value = sd.drive; $("sub").value = sd.sub; $("glide").value = sd.glide;
    $("delay").value = sd.delay; $("dtime").value = DTIMES.indexOf(sd.dtime) >= 0 ? DTIMES.indexOf(sd.dtime) : DTIMES.indexOf(.75); $("dfb").value = sd.dfb; $("rev").value = sd.rev; $("rsize").value = Math.round(sd.rsize * 10);
    readSound();
  }
  function styleSound(st) { return { wave: st.wave, cut: st.cut, q: st.q, dec: st.dec, drive: st.drive, sub: st.sub, glide: st.glide, delay: st.delay, dtime: st.dtime, dfb: st.dfb, rev: st.rev, rsize: st.rsize }; }
  ["wave", "cut", "q", "dec", "drive", "sub", "glide", "delay", "dtime", "dfb", "rev", "rsize"].forEach(function (id) { $(id).addEventListener("input", readSound); });

  /* ---------- Knobs ----------
     A range input under a drawn dial, so the keyboard and screen readers work.
     Drag up or right, Shift for fine steps, or tap the arc. */
  // Focus ring for keyboard users only.
  var rootEl = document.documentElement;
  document.addEventListener("pointerdown", function () { rootEl.classList.add("by-pointer"); }, true);
  document.addEventListener("keydown", function () { rootEl.classList.remove("by-pointer"); }, true);

  var KNOB_DOTS = 19, DETENTS = [-120, -60, 0, 60], SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    parent.appendChild(e);
    return e;
  }
  function initKnob(input) {
    var dial = input.parentNode, detent = dial.classList.contains("detent"), angles = detent ? DETENTS : [];
    for (var i = 0; !detent && i < KNOB_DOTS; i++) angles.push(-135 + i * 270 / (KNOB_DOTS - 1));
    var svg = svgEl("svg", { viewBox: "0 0 80 80", "aria-hidden": "true", focusable: "false" }, dial);
    var dots = angles.map(function (deg) {
      var a = deg * Math.PI / 180;
      return svgEl("circle", { "class": "d", cx: (40 + 39.13 * Math.sin(a)).toFixed(2), cy: (40 - 39.13 * Math.cos(a)).toFixed(2), r: .913 }, svg);
    });
    // The knob: shadow, body, well and bar.
    var cast = document.createElement("span"), cap = document.createElement("span");
    cast.className = "cast"; cap.className = "cap";
    cap.innerHTML = '<span class="well"></span><span class="bar"></span>';
    dial.appendChild(cast); dial.appendChild(cap);
    input.knob = { dots: dots, cap: cap, angles: angles, detent: detent };
    input.addEventListener("input", function () { paintKnob(input); });

    function set(v) {
      var min = +input.min, max = +input.max, step = +input.step || 1;
      v = Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step));
      if (v !== +input.value) { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); }
    }
    // A tap sets the value where the arc was touched.
    function setAt(e) {
      var r = dial.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      if (Math.sqrt(dx * dx + dy * dy) < r.width * .2) return; // the centre has no direction
      var deg = Math.atan2(dx, -dy) * 180 / Math.PI; // 0 at the top, clockwise
      if (detent) { // the nearest detent
        var best = 0;
        angles.forEach(function (x, j) { if (Math.abs(x - deg) < Math.abs(angles[best] - deg)) best = j; });
        return set(+input.min + best);
      }
      var f = Math.abs(deg) > 135 ? (deg > 0 ? 1 : 0) : (deg + 135) / 270; // gap at the bottom: nearest end
      set(+input.min + f * (input.max - input.min));
    }

    // Only the first finger turns a knob. A bubble shows the value.
    var drag = null, lab = dial.parentNode.querySelector("label"), val = dial.parentNode.querySelector(".val");
    function tipText() { return (lab ? lab.textContent + " " : "") + (val ? val.textContent : input.value); }
    dial.addEventListener("pointerdown", function (e) {
      if (e.button > 0 || drag) return;
      e.preventDefault();
      input.focus({ preventScroll: true });
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, v: +input.value, moved: false, touch: e.pointerType === "touch" };
      try { dial.setPointerCapture(e.pointerId); } catch (err) {}
    });
    dial.addEventListener("pointermove", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var min = +input.min, max = +input.max;
      if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) > 3) drag.moved = true;
      // 200 px for the full range, 800 px with Shift.
      drag.v += ((drag.y - e.clientY) + (e.clientX - drag.x)) / (e.shiftKey ? 800 : 200) * (max - min);
      drag.v = Math.min(max, Math.max(min, drag.v));
      drag.x = e.clientX; drag.y = e.clientY;
      set(drag.v);
      if (drag.touch && drag.moved) showTip(tipText(), e.clientX, e.clientY);
    });
    dial.addEventListener("pointerup", function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      if (!drag.moved) setAt(e);
      if (drag.touch) {
        if (drag.moved) hideTip();
        else { var r = dial.getBoundingClientRect(); flashTip(tipText(), r.left + r.width / 2, r.top + 30); }
      }
      drag = null;
    });
    dial.addEventListener("pointercancel", function (e) {
      if (drag && e.pointerId === drag.id) { if (drag.touch) hideTip(); drag = null; }
    });
  }
  function paintKnob(input) {
    var k = input.knob; if (!k) return;
    var pos = input.value - input.min, f = pos / (input.max - input.min), deg, lit;
    // At the minimum the knob stays black.
    if (k.detent) { deg = k.angles[pos]; lit = function (i) { return pos > 0 && i === pos; }; }
    else {
      var last = Math.round(f * (k.dots.length - 1));
      deg = -135 + f * 270; lit = function (i) { return f > 0 && i <= last; };
    }
    k.dots.forEach(function (d, i) { d.classList.toggle("on", lit(i)); });
    k.cap.classList.toggle("on", f > 0);
    k.cap.style.setProperty("--a", deg.toFixed(1) + "deg");
  }
  // Show the value and redraw the dial (also when set from code).
  function knobValue(id, txt, spoken) {
    $(id + "v").textContent = txt;
    $(id).setAttribute("aria-valuetext", spoken || txt);
    paintKnob($(id));
  }
  Array.prototype.forEach.call(document.querySelectorAll(".dial input[type=range]"), initKnob);

  /* ---------- Slide switches ----------
     Radio inputs. A click in the slot picks the nearest position. */
  function initSlide(slide) {
    var slot = slide.querySelector(".slot"), inputs = slide.querySelectorAll("input[type=radio]");
    if (!slot || !inputs.length) return;
    slot.addEventListener("click", function (e) {
      var r = slot.getBoundingClientRect(), vert = slide.classList.contains("vert");
      var f = vert ? (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
      var input = inputs[Math.min(inputs.length - 1, Math.max(0, Math.floor(f * inputs.length)))];
      input.focus({ preventScroll: true });
      if (input.checked) return;
      input.checked = true;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll(".slide"), initSlide);
  // Style and Wave selectors: a click turns to the next notch.
  Array.prototype.forEach.call(document.querySelectorAll(".selknob"), function (sel) {
    sel.querySelector(".sk").addEventListener("click", function () {
      var inputs = sel.querySelectorAll("input"), i = Array.prototype.indexOf.call(inputs, sel.querySelector("input:checked"));
      var next = inputs[(i + 1) % inputs.length];
      next.focus({ preventScroll: true });
      next.checked = true;
      next.dispatchEvent(new Event("input", { bubbles: true }));
      next.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  function readControls() {
    S.root = +$("root").value; S.scale = $("scale").value; S.oct = +getR("oct");
    S.n = +getR("n"); S.style = getR("style");
    S.bpm = +$("bpm").value; S.swing = +$("swing").value; S.hum = +$("hum").value; S.rep = getR("rep") === "1";
    knobValue("bpm", S.bpm + " bpm"); knobValue("swing", S.swing + "%"); knobValue("hum", S.hum + "%");
    applyFx();
  }
  ["root", "scale", "oct"].forEach(function (id) {
    $(id).addEventListener("change", undoable("Change " + { root: "the note", scale: "the scale", oct: "the octave" }[id], function () {
      var oldRoot = rootMidi();
      readControls();
      var shift = rootMidi() - oldRoot, set = pool(24);
      S.steps.forEach(function (s) {
        if (!s.on) return;
        var m = s.m + shift;
        if (set.indexOf(m) < 0) m = set.reduce(function (b, x) { return Math.abs(x - m) < Math.abs(b - m) ? x : b; }, set[0]);
        s.m = m;
      });
      changed = [];
      render();
    }));
  });
  ["n", "style", "rep"].forEach(function (id) {
    $(id).addEventListener("change", undoable("Change " + { n: "the steps", style: "the style", rep: "Half loop" }[id], function () {
      if (id === "style") {
        var stl = STYLES[getR("style")], sc = stl.scale;
        if (sc && !LOCK.notes) $("scale").value = sc;
        if (!LOCK.rhythm) { $("bpm").value = Math.round((stl.bpm[0] + stl.bpm[1]) / 2); S.dens = stl.dens; }
        readControls();
        if (!LOCK.sound) setSound(styleSound(stl));
        var before = snap();
        var kept = LOCK.sound ? " Sound kept." : "";
        if (generate()) { markChanged(before); status("Style " + stl.label + ": " + newWhat() + "." + kept); }
        else status("Style " + stl.label + ". Rhythm and notes are locked: the steps stay as they are." + kept);
      } else {
        var oldN = S.n, copied = false;
        readControls();
        if (id === "n") {
          // 8 to 16 steps: empty steps 9-16 repeat steps 1-8.
          if (oldN === 8 && S.n === 16) copied = copyFirstHalf();
          // New step count: remove ties into a rest.
          fixTies(S.n); changed = []; if (playing) pos = 0;
        }
      }
      render();
      if (id === "n") status(copied ? "16 steps: steps 1-8 copied to 9-16." : S.n + " steps.");
    }));
  });
  ["bpm", "swing", "hum"].forEach(function (id) { $(id).addEventListener("input", readControls); });

  // What a new pattern changed, for the status line.
  function newWhat() {
    if (genInfo === "silent") return "no step plays and the rhythm is locked, so nothing changed";
    if (genInfo === "nonotes") return "new rhythm, and new notes since there were none to keep";
    return LOCK.rhythm ? "new notes, same rhythm" : LOCK.notes ? "new rhythm, same notes" : "new notes generated";
  }
  var BOTH_LOCKED = "Rhythm and notes are locked: unlock one to change the steps.";
  $("gen").addEventListener("click", undoable("New pattern", function () {
    readControls();
    var before = snap();
    if (!generate()) { status(BOTH_LOCKED); return; }
    markChanged(before); render();
    status(LOCK.rhythm || LOCK.notes ? newWhat().charAt(0).toUpperCase() + newWhat().slice(1) + "." : "New pattern, same settings and sound.");
  }));
  $("rand").addEventListener("click", undoable("Generate bassline", function () {
    // Locked parts keep their settings.
    var k = LOCK.style || bothLocked() ? getR("style") : rnd(Object.keys(STYLES)), st = STYLES[k];
    setR("style", k);
    if (!LOCK.notes) {
      $("root").value = Math.floor(Math.random() * 12);
      $("scale").value = (st.scale && Math.random() < .7) ? st.scale : rnd(Object.keys(SCALES));
      if (!LOCK.oct) setR("oct", rnd([1, 2, 2]));
    }
    if (!LOCK.rhythm) {
      setR("n", rnd([16, 16, 8]));
      // Density: the style's own, give or take 8.
      S.dens = Math.min(90, Math.max(20, st.dens + Math.round(Math.random() * 16 - 8)));
      setR("rep", Math.random() < .7 ? 1 : 0);
      $("swing").value = rnd([0, 0, 0, 10, 20]);
      $("bpm").value = st.bpm[0] + Math.floor(Math.random() * (st.bpm[1] - st.bpm[0] + 1));
    }
    var sd = styleSound(st);
    sd.cut = Math.min(6000, Math.max(200, Math.round(sd.cut * (.7 + Math.random() * .7))));
    sd.drive = Math.min(100, Math.round(sd.drive * (.5 + Math.random())));
    sd.delay = Math.min(60, Math.max(0, sd.delay + Math.round(Math.random() * 30 - 10)));
    sd.rev = Math.min(70, Math.max(0, sd.rev + Math.round(Math.random() * 30 - 10)));
    sd.dtime = rnd(DTIMES.slice(1)); // never Off
    var oldN = S.n;
    readControls();
    if (!LOCK.sound) setSound(sd);
    // The step count may have changed: fix ties, restart the loop.
    if (S.n !== oldN) { fixTies(S.n); if (playing) pos = 0; }
    var before = snap(), done = generate(oldN);
    if (done) markChanged(before);
    render();
    if (!done) { status("Rhythm and notes are locked: " + (LOCK.sound ? "nothing changed." : "only the sound changed.")); return; }
    status("New bassline: " + st.label + ", " + NAMES[S.root] + " " + SCALES[S.scale].label.toLowerCase() + ", " + S.n + " steps, " + S.bpm + " bpm." + (genInfo === "silent" ? " No step plays: the rhythm is locked." : "") + (LOCK.oct && !LOCK.notes ? " Octave kept." : "") + (LOCK.sound ? " Sound kept." : ""));
  }));
  $("mut").addEventListener("click", undoable("Vary steps", function () {
    readControls();
    var before = snap();
    var r = mutate(3, false);
    if (!r) { status(BOTH_LOCKED); return; }
    if (r === "silent") { status("No step plays and the rhythm is locked: nothing to vary."); return; }
    markChanged(before); render(); status("A few steps changed.");
  }));
  $("clr").addEventListener("click", undoable("Clear", function () {
    S.steps = blank(); changed = []; render(); status("Sequence cleared.");
  }));
  // Lock keys. Style and Sound have two keys each, always in sync.
  var LOCK_KEYS = { rhythm: ["lock-rhythm"], notes: ["lock-notes"], sound: ["lock-sound", "soundlock"], style: ["lock-style", "stylelock"], oct: ["octlock"] };
  Object.keys(LOCK_KEYS).forEach(function (k) {
    LOCK_KEYS[k].forEach(function (id) {
      $(id).addEventListener("click", function () {
        LOCK[k] = !LOCK[k];
        LOCK_KEYS[k].forEach(function (o) { $(o).setAttribute("aria-pressed", LOCK[k] ? "true" : "false"); });
      });
    });
  });

  // Tap tempo: average of the last 5 taps. A 2 second pause starts over.
  var taps = [];
  function tapTempo() {
    var t = performance.now();
    if (taps.length && t - taps[taps.length - 1] > 2000) taps = [];
    taps.push(t);
    if (taps.length > 5) taps.shift();
    if (taps.length < 2) return;
    var bpm = Math.round(60000 * (taps.length - 1) / (t - taps[0]));
    $("bpm").value = Math.min(170, Math.max(60, bpm));
    readControls();
  }
  $("tap").addEventListener("pointerdown", function (e) { if (e.button === 0) tapTempo(); });
  $("tap").addEventListener("click", function (e) {
    if (e.detail !== 0) return;
    var b = this;
    tapTempo();
    b.classList.add("is-pressed");
    setTimeout(function () { b.classList.remove("is-pressed"); }, 120);
  });
  $("metro").addEventListener("click", function () {
    metroOn = !metroOn;
    this.setAttribute("aria-pressed", metroOn ? "true" : "false");
  });
  Array.prototype.forEach.call(document.querySelectorAll("button.play"), function (b) {
    b.addEventListener("click", function () { if (playing) stop(); else play(); });
  });
  $("keep").addEventListener("click", function () {
    readControls();
    var label = STYLES[S.style].label + ", " + NAMES[S.root] + " " + SCALES[S.scale].label.toLowerCase() + ", " + S.n + " steps, " + S.bpm + " bpm";
    saved.unshift({ label: label, state: stateNow() });
    // Open the list so people see where the idea went.
    saved = saved.slice(0, 30); persist(); savedList(true); $("ideas").open = true; status("Idea saved.");
  });

  /* ---------- Undo / Redo ----------
     Each change keeps the values before and after. Undo only restores values
     not changed since. 30 steps, in memory. Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Ctrl+Y. */
  var undoStack = [], redoStack = [], HISTORY = 30;
  function stateNow() { return JSON.parse(JSON.stringify(S)); }
  // Every value of a state as a path: "bpm", "snd.cut"...
  function paths(st) {
    var out = [];
    STATE_KEYS.forEach(function (k) {
      if (k === "snd" && st.snd) Object.keys(st.snd).forEach(function (sk) { out.push("snd." + sk); });
      else out.push(k);
    });
    return out;
  }
  function getP(st, p) { var a = p.split("."); return a.length > 1 ? (st[a[0]] || {})[a[1]] : st[p]; }
  function setP(st, p, v) { var a = p.split("."); if (a.length > 1) { st[a[0]] = st[a[0]] || {}; st[a[0]][a[1]] = v; } else st[p] = v; }
  function same(x, y) { return JSON.stringify(x) === JSON.stringify(y); }
  function copy(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
  // Record a change. Same tag within 1.5 s: merged. "only": limit to some values.
  function remember(label, before, tag, only) {
    var now = Date.now(), all = paths(S);
    if (only) all = all.filter(function (p) { return only.indexOf(p.split(".")[0]) >= 0; });
    var changedP = all.filter(function (p) { return !same(getP(before, p), getP(S, p)); });
    if (!changedP.length) return;
    var last = undoStack[undoStack.length - 1];
    if (tag && last && last.tag === tag && now - last.t < 1500 && !redoStack.length) {
      changedP.forEach(function (p) { if (!(p in last.before)) last.before[p] = copy(getP(before, p)); last.after[p] = copy(getP(S, p)); });
      last.t = now;
      return;
    }
    var h = { label: label, tag: tag, t: now, before: {}, after: {} };
    changedP.forEach(function (p) { h.before[p] = copy(getP(before, p)); h.after[p] = copy(getP(S, p)); });
    undoStack.push(h);
    if (undoStack.length > HISTORY) undoStack.shift();
    redoStack = [];
    updateUndo();
  }
  // Make a handler undoable. An unfinished bar drag is recorded first.
  function undoable(label, fn) {
    return function (e) { if (drag) endDrag(); var before = stateNow(); fn.call(this, e); remember(label, before); };
  }
  function travel(back) {
    var from = back ? undoStack : redoStack, to = back ? redoStack : undoStack;
    if (drag || !from.length) return;
    var h = from.pop(), target = back ? h.before : h.after, expect = back ? h.after : h.before;
    var st = stateNow(), steps = false, done = { label: h.label, tag: h.tag, t: h.t, before: {}, after: {} }, n = 0;
    Object.keys(target).forEach(function (p) {
      if (!same(getP(st, p), expect[p])) return; // changed since by hand: left as it is
      setP(st, p, copy(target[p]));
      done.before[p] = h.before[p]; done.after[p] = h.after[p]; n++;
      if (p === "n") steps = true;
    });
    updateUndo();
    if (!n) { status("Nothing to " + (back ? "undo" : "redo") + ": what " + h.label.charAt(0).toLowerCase() + h.label.slice(1) + " changed was changed again by hand."); return; }
    // A value changed by hand stays.
    to.push(done);
    loadState(st);
    // Like a new step count: restart the loop.
    if (steps && playing) pos = 0;
    updateUndo();
    status((back ? "Undone: " : "Redone: ") + h.label.charAt(0).toLowerCase() + h.label.slice(1) + ".");
  }
  function updateUndo() {
    $("undo").setAttribute("aria-disabled", undoStack.length ? "false" : "true");
    $("redo").setAttribute("aria-disabled", redoStack.length ? "false" : "true");
  }
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  $("undo").title = "Undo the last change (" + (MAC ? "⌘Z" : "Ctrl+Z") + ")";
  $("redo").title = "Redo (" + (MAC ? "⇧⌘Z" : "Ctrl+Y") + ")";
  $("undo").addEventListener("click", function () { travel(true); });
  $("redo").addEventListener("click", function () { travel(false); });
  document.addEventListener("keydown", function (e) {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^textarea$/i.test(t.tagName) || (/^input$/i.test(t.tagName) && !/^(range|checkbox|radio)$/i.test(t.type)))) return;
    // The letter typed (QWERTZ, AZERTY...). Non-Latin layouts: the physical key.
    var k = (e.key || "").toLowerCase();
    if (!/^[a-z]$/.test(k)) k = e.code === "KeyZ" ? "z" : e.code === "KeyY" ? "y" : k;
    var back = k === "z" && !e.shiftKey, fwd = (k === "z" && e.shiftKey) || (k === "y" && !MAC && e.ctrlKey);
    if (!back && !fwd) return;
    // Nothing to undo: let the browser handle it.
    if (!(back ? undoStack : redoStack).length) return;
    e.preventDefault();
    travel(back);
  });

  /* ---------- Floating bar ---------- */
  // Shown once the page scrolls, hidden while the header keys are visible.
  $("fgen").addEventListener("click", function () { $("rand").click(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      $("fbar").classList.toggle("is-hidden", entries[0].isIntersecting);
    }).observe(document.querySelector("header .acts"));
  } else $("fbar").classList.remove("is-hidden");

  /* ---------- MIDI export ---------- */
  function vlq(n) { var b = [n & 127]; n >>= 7; while (n > 0) { b.unshift((n & 127) | 128); n >>= 7; } return b; }
  function trk(events) {
    events.sort(function (a, b) { return a.t - b.t || a.o - b.o; });
    var out = [], last = 0;
    events.forEach(function (e) { out = out.concat(vlq(e.t - last), e.b); last = e.t; });
    return out;
  }
  function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
  function chunk(id, data) { return [id.charCodeAt(0), id.charCodeAt(1), id.charCodeAt(2), id.charCodeAt(3)].concat(u32(data.length), data); }
  function nameEv(text) {
    var bytes = [];
    for (var i = 0; i < text.length; i++) bytes.push(text.charCodeAt(i) & 127);
    return { t: 0, o: 0, b: [0xFF, 0x03, bytes.length].concat(bytes) };
  }
  function buildMidi() {
    var n = S.n, bars = +$("midibars").value, STEP = 120, steps = bars * 16, total = steps * STEP;
    var h = (S.hum || 0) / 100, tempo = Math.round(60000000 / S.bpm);
    var END = { t: total, o: 9, b: [0xFF, 0x2F, 0x00] };
    var meta = [nameEv("Bass Assembly"), { t: 0, o: 0, b: [0xFF, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] }, { t: 0, o: 0, b: [0xFF, 0x58, 0x04, 4, 2, 24, 8] }, END];
    var bass = [nameEv("Bass"), END];
    function note(list, ch, m, t, dur, vel) {
      var end = Math.min(total, t + dur);
      if (t >= total || end <= t) return;
      list.push({ t: t, o: 1, b: [0x90 | ch, m, vel] }, { t: end, o: 0, b: [0x80 | ch, m, 0] });
    }
    // Start time of each step, with swing and humanize. T[steps]: end of the loop.
    var T = [];
    for (var k = 0; k < steps; k++) {
      var t0 = k * STEP + Math.round(swingOf(k, STEP));
      T.push(h ? Math.max(0, t0 + Math.round(jit() * h * STEP * .2)) : t0);
    }
    T.push(total);
    function tiedAt(k) { return S.steps[k % n].tie && S.steps[(k + 1) % n].on; }
    for (k = 0; k < steps; k++) {
      var s = S.steps[k % n];
      if (!s.on) continue;
      // Skip a step held by a tie.
      if (k > 0 && tiedAt(k - 1) && S.steps[(k - 1) % n].m === s.m) continue;
      var vel = Math.max(1, Math.min(127, s.acc ? Math.max(velOf(s), 112) : velOf(s)));
      if (h) vel = Math.max(1, Math.min(127, Math.round(vel + jit() * h * 14)));
      // Ties to the same pitch: one long note.
      var j = k;
      while (j + 1 < steps && tiedAt(j) && S.steps[(j + 1) % n].m === s.m) j++;
      var end;
      if (tiedAt(j)) end = T[j + 1] + 24; // legato into a different pitch: overlap for the slide
      else {
        var dur = Math.max(6, Math.round(STEP * gateRaw(S.steps[j % n])));
        if (h) dur = Math.max(6, Math.round(dur * (1 + jit() * h * .25)));
        end = T[j] + dur;
      }
      note(bass, 0, s.m, T[k], end - T[k], vel);
    }
    var tracks = [trk(meta), trk(bass)];
    var all = chunk("MThd", [0, 1, 0, tracks.length, 0x01, 0xE0]);
    tracks.forEach(function (tk) { all = all.concat(chunk("MTrk", tk)); });
    return new Uint8Array(all);
  }
  // Export keys and their shortcuts.
  Array.prototype.forEach.call(document.querySelectorAll("#midi, button.midi-btn"), function (b) { b.addEventListener("click", exportMidi); });
  Array.prototype.forEach.call(document.querySelectorAll("#wav, button.wav-btn"), function (b) { b.addEventListener("click", exportWav); });
  function fileName(ext) {
    return "bassassembly-" + STYLES[S.style].label.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + NAMES[S.root].replace("#", "s") + "-" + S.bpm + "bpm." + ext;
  }
  // Start the download and keep a link in case the browser blocks it.
  var lastUrl = {};
  function offerFile(bytes, type, name, outId) {
    outId = outId || "midiout";
    try {
      var url = URL.createObjectURL(new Blob([bytes], { type: type })), a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      var out = $(outId), old = lastUrl[outId];
      lastUrl[outId] = url;
      if (old) setTimeout(function () { URL.revokeObjectURL(old); }, 1000);
      out.innerHTML = "";
      out.appendChild(document.createTextNode("File ready. If it did not download, click here: "));
      var l = document.createElement("a"); l.href = url; l.download = name; l.textContent = name; l.style.textDecoration = "underline";
      out.appendChild(l);
      return true;
    } catch (e) { return false; }
  }
  // Remove a download link and free its file.
  function dropFile(outId) {
    var old = lastUrl[outId];
    if (old) { lastUrl[outId] = null; setTimeout(function () { URL.revokeObjectURL(old); }, 1000); }
    $(outId).textContent = "";
  }
  function exportMidi() {
    readControls();
    var name = fileName("mid");
    status(offerFile(buildMidi(), "audio/midi", name) ? "MIDI exported: " + name : "Export is not possible in this browser. Try another one.");
  }

  /* ---------- Audio export (.wav) ----------
     Rendered offline: 44.1 kHz, 16 bit, stereo, no metronome. Loops cleanly. */
  var WAV_RATE = 44100, WAV_FADE = 441, wavBusy = false; // fade at the loop point: 10 ms
  function renderWav(bars) {
    var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return Promise.reject(new Error("No OfflineAudioContext"));
    var sd = S.snd, fx = fxLevels(sd), dur = 60 / S.bpm / 4, steps = bars * 16, loop = steps * dur;
    // Warm-up passes, so the echoes and reverb are already there (20 s max).
    var tail = fx.rsend ? sd.rsize : 0;
    if (fx.dsend) tail = Math.max(tail, fx.dtime * (fx.fb > .001 ? Math.log(.001) / Math.log(fx.fb) : 1));
    var warm = Math.max(1, Math.ceil(Math.min(20, tail + .3) / loop));
    var from = Math.round(warm * loop * WAV_RATE), len = Math.round(loop * WAV_RATE);
    var ac = new OAC(2, from + len + WAV_FADE, WAV_RATE), b = wireBus(ac);
    b.dsend.gain.value = fx.dsend; b.fb.gain.value = fx.fb; b.rsend.gain.value = fx.rsend;
    if (fx.dtime) b.dl.delayTime.value = fx.dtime;
    if (fx.rsend) b.conv.buffer = makeIR(ac, sd.rsize);
    // Humanize is drawn once per step, so every pass is the same.
    var J = [], r, used, eng = { ac: ac, out: b.inp, voice: null, jit: function () { return r[used++]; } };
    for (var k = 0; k < steps; k++) J.push([jit(), jit(), jit()]);
    for (k = 0; k <= (warm + 1) * steps; k++) {
      var t0 = k * dur + swingOf(k, dur);
      r = J[k % steps]; used = 0;
      playStep(eng, k % S.n, t0, dur, Math.floor(k / steps) * loop);
    }
    return new Promise(function (res, rej) {
      ac.oncomplete = function (e) { res(e.renderedBuffer); }; // older Safari: no promise
      var p = ac.startRendering();
      if (p && p.then) p.then(res, rej);
    }).then(function (buf) { return wavBytes(loopSlice(buf, from, len)); });
  }
  // Fade the loop end into its start over 10 ms: no click.
  function loopSlice(buf, from, len) {
    return [0, 1].map(function (c) {
      var x = buf.getChannelData(c), y = x.slice(from, from + len);
      for (var i = 0; i < WAV_FADE; i++) { var f = i / WAV_FADE; y[i] = y[i] * f + x[from + len + i] * (1 - f); }
      return y;
    });
  }
  // 16 bit PCM .wav, turned down only if it would clip.
  function wavBytes(ch) {
    var len = ch[0].length, peak = 0, c, i;
    for (c = 0; c < 2; c++) for (i = 0; i < len; i++) peak = Math.max(peak, Math.abs(ch[c][i]));
    var gain = peak > .98 ? .98 / peak : 1, out = new ArrayBuffer(44 + len * 4), v = new DataView(out);
    function str(o, t) { for (var j = 0; j < t.length; j++) v.setUint8(o + j, t.charCodeAt(j)); }
    str(0, "RIFF"); v.setUint32(4, 36 + len * 4, true); str(8, "WAVEfmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, WAV_RATE, true); v.setUint32(28, WAV_RATE * 4, true);
    v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, len * 4, true);
    for (i = 0; i < len; i++) for (c = 0; c < 2; c++) {
      var x = Math.max(-1, Math.min(1, ch[c][i] * gain));
      v.setInt16(44 + i * 4 + c * 2, Math.round(x * 32767), true);
    }
    return new Uint8Array(out);
  }
  function exportWav() {
    if (wavBusy) return;
    readControls();
    var keys = document.querySelectorAll("#wav, button.wav-btn"), name = fileName("wav");
    function busy(on) {
      wavBusy = on;
      Array.prototype.forEach.call(keys, function (k) { if (on) k.setAttribute("aria-busy", "true"); else k.removeAttribute("aria-busy"); });
    }
    busy(true); status("Rendering the audio...");
    var p;
    try { p = renderWav(+$("midibars").value); } catch (e) { p = Promise.reject(e); }
    p.then(function (bytes) {
      busy(false);
      status(offerFile(bytes, "audio/wav", name) ? "Audio exported: " + name : "Export is not possible in this browser. Try another one.");
    }, function () {
      busy(false);
      status("Audio export is not possible in this browser. The MIDI export still works.");
    });
  }
  // Copy as text and Download .txt. copySeq ignores late clipboard answers.
  var copyTimer = 0, copySeq = 0;
  function copyOut(t, stay) {
    clearTimeout(copyTimer);
    dropFile("copyout");
    $("copyout").textContent = t;
    if (!stay) copyTimer = setTimeout(function () { $("copyout").textContent = ""; }, 4000);
  }
  $("copy").addEventListener("click", function () {
    var seq = ++copySeq;
    var answer = function (t, stay) { return function () { if (seq === copySeq) copyOut(t, stay); }; };
    var blocked = answer("Copy is blocked in this browser: use Download .txt instead.", true);
    try { navigator.clipboard.writeText(notesText()).then(answer("Copied."), blocked); } catch (e) { blocked(); }
  });
  $("txt").addEventListener("click", function () {
    copySeq++;
    clearTimeout(copyTimer);
    if (!offerFile(notesText(), "text/plain;charset=utf-8", fileName("txt"), "copyout")) copyOut("Download is not possible in this browser. Try Copy as text.", true);
  });

  /* ---------- Help bubbles (INFO tags) ----------
     Hover opens, click pins. One bubble at a time. */
  var openInfo = null, infoTimer = 0;
  function setInfo(box, on, pin) {
    clearTimeout(infoTimer);
    if (on && openInfo && openInfo !== box) setInfo(openInfo, false);
    box.querySelector(".infotag").setAttribute("aria-expanded", on ? "true" : "false");
    box.querySelector(".bubble").hidden = !on;
    box.classList.toggle("pinned", !!(on && pin));
    openInfo = on ? box : (openInfo === box ? null : openInfo);
  }
  Array.prototype.forEach.call(document.querySelectorAll(".info"), function (box) {
    var tag = box.querySelector(".infotag");
    tag.addEventListener("click", function () {
      var open = tag.getAttribute("aria-expanded") === "true";
      // Hover open: click pins. Pinned: click closes.
      if (open && !box.classList.contains("pinned")) setInfo(box, true, true); // also cancels a pending close
      else setInfo(box, !open, true);
    });
    box.addEventListener("pointerenter", function (e) {
      if (e.pointerType !== "mouse" || openInfo === box) { clearTimeout(infoTimer); return; }
      // A pinned bubble stays until closed.
      if (!(openInfo && openInfo.classList.contains("pinned"))) setInfo(box, true);
    });
    // Keyboard: close when the focus leaves.
    box.addEventListener("focusout", function (e) { if (e.relatedTarget && !box.contains(e.relatedTarget) && openInfo === box) setInfo(box, false); });
    box.addEventListener("pointerleave", function (e) {
      if (e.pointerType !== "mouse" || box.classList.contains("pinned")) return;
      // Stays open while the keyboard focus is inside (the link in a bubble).
      infoTimer = setTimeout(function () { if (!box.contains(document.activeElement)) setInfo(box, false); }, 200);
    });
  });
  document.addEventListener("pointerdown", function (e) { if (openInfo && !openInfo.contains(e.target)) setInfo(openInfo, false); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !openInfo) return;
    var box = openInfo, back = box.contains(document.activeElement);
    setInfo(box, false);
    if (back) box.querySelector(".infotag").focus();
  });

  $("grid").addEventListener("click", undoable("Edit a step", function (e) {
    // Ignore the click after a bar drag.
    if (performance.now() - dragEndAt < 400) return;
    var b = e.target.closest("button"); if (!b) return;
    var s;
    if (b.dataset.i != null) {
      s = S.steps[+b.dataset.i]; var m = +b.dataset.m;
      if (s.on && s.m === m) { s.on = false; s.acc = false; s.tie = false; } else { s.on = true; s.m = m; s.vel = velOf(s); s.gate = gateRaw(s); }
      var ci = +b.dataset.i;
      changed = changed.filter(function (x) { return x !== ci; }); // edited by hand: no longer "new"
      fixTies(S.n);
    } else if (b.dataset.acc != null) {
      s = S.steps[+b.dataset.acc]; if (s.on) s.acc = !s.acc;
    } else if (b.dataset.tie != null) {
      s = S.steps[+b.dataset.tie]; if (s.on && S.steps[(+b.dataset.tie + 1) % S.n].on) s.tie = !s.tie;
    }
    render();
  }));

  /* Vel and Gate bars: drag to set. Mouse: drag sideways over several steps.
     Touch: drag up or down, swipe sideways to scroll. */
  var drag = null, dragEndAt = 0, TOUCH_TRAVEL = 180, tip = null, tipW = 0, tipTimer = 0;
  // Value bubble above the finger (bars and knobs).
  function showTip(text, x, y) {
    if (!tip) {
      tip = document.createElement("div"); tip.className = "bartip"; tip.setAttribute("aria-hidden", "true"); tip.hidden = true;
      document.body.appendChild(tip);
    }
    clearTimeout(tipTimer);
    tip.textContent = text;
    if (tip.hidden) { tip.hidden = false; tipW = tip.offsetWidth; }
    tip.style.left = Math.max(8, Math.min(innerWidth - tipW - 8, x - tipW / 2)) + "px";
    tip.style.top = Math.max(8, y - 76) + "px";
  }
  function hideTip() { if (tip) tip.hidden = true; }
  function flashTip(text, x, y) { showTip(text, x, y); tipTimer = setTimeout(hideTip, 1200); }
  function barTip(i, isV) { return (isV ? "Vel " : "Gate ") + barState(i, isV).txt; }
  function startTouchDrag(t, e) {
    var isV = t.el.dataset.vel != null, i = +t.el.dataset[barKey(isV)], s = S.steps[i];
    // v: value from 0 to 1. y: last finger position.
    drag = { rel: true, isV: isV, i: i, el: t.el, y: t.y, v: isV ? velOf(s) / 127 : gateOf(s), min: isV ? 10 / 127 : .05, moved: false, id: e.pointerId, before: stateNow() };
    try { $("grid").setPointerCapture(e.pointerId); } catch (err) {}
  }
  function startDrag(el, e) {
    var isV = el.dataset.vel != null, bars = $("grid").querySelectorAll("[data-" + barKey(isV) + "]"), cols = [];
    for (var k = 0; k < bars.length; k++) cols.push({ el: bars[k], i: +bars[k].dataset[barKey(isV)] });
    drag = { isV: isV, cols: cols, track: el.querySelector("b"), moved: false, id: e.pointerId, before: stateNow() };
    try { $("grid").setPointerCapture(e.pointerId); } catch (err) {}
  }
  function dragAt(e) {
    if (drag.rel) {
      drag.v = Math.min(1, Math.max(drag.min, drag.v + (drag.y - e.clientY) / TOUCH_TRAVEL)); drag.y = e.clientY;
      if (setBar(drag.i, drag.isV, drag.v)) paintBar(drag.el, drag.i, drag.isV);
      showTip(barTip(drag.i, drag.isV), e.clientX, e.clientY);
      return;
    }
    // The layout can still move: measure at every move.
    var best = null, d = Infinity;
    for (var k = 0; k < drag.cols.length; k++) {
      var r = drag.cols[k].el.getBoundingClientRect(), dk = Math.abs(e.clientX - (r.left + r.width / 2));
      if (dk < d) { d = dk; best = drag.cols[k]; }
    }
    var track = drag.track.getBoundingClientRect();
    if (best && setBar(best.i, drag.isV, 1 - (e.clientY - track.top) / track.height)) paintBar(best.el, best.i, drag.isV);
  }
  function endDrag() {
    if (!drag) return;
    if (drag.moved) dragEndAt = performance.now();
    if (drag.rel) hideTip();
    remember(drag.isV ? "Edit the velocity" : "Edit the gate", drag.before, null, ["steps"]);
    drag = null; touch = null; table(); kbRender();
    if (gridStale) { gridStale = false; drawGrid(); mark(cur); }
  }
  // Only the first finger counts.
  var touch = null;
  $("grid").addEventListener("pointerdown", function (e) {
    var el = e.target.closest(".bar"); if (!el || e.button > 0 || touch || drag) return;
    if (e.pointerType === "touch") {
      // Rest steps have no value to set.
      if (el.classList.contains("off")) return;
      touch = { el: el, x: e.clientX, y: e.clientY, id: e.pointerId }; return;
    }
    e.preventDefault();
    startDrag(el, e); dragAt(e);
  });
  $("grid").addEventListener("pointermove", function (e) {
    if (touch && !drag && e.pointerId === touch.id) {
      var dx = Math.abs(e.clientX - touch.x), dy = Math.abs(e.clientY - touch.y);
      if (dy > 6 && dy > dx) startTouchDrag(touch, e);
      else if (dx > 6) { touch = null; return; }
    }
    if (drag && e.pointerId === drag.id) { drag.moved = true; dragAt(e); }
  });
  $("grid").addEventListener("pointerup", function (e) {
    if (touch && !drag) {
      if (e.pointerId !== touch.id) return;
      // A tap only shows the value.
      var isV = touch.el.dataset.vel != null, r = touch.el.getBoundingClientRect();
      flashTip(barTip(+touch.el.dataset[barKey(isV)], isV), r.left + r.width / 2, r.top + 40);
      touch = null; return;
    }
    if (drag && e.pointerId === drag.id) endDrag();
  });
  $("grid").addEventListener("pointercancel", function (e) {
    if (touch && e.pointerId === touch.id) touch = null;
    if (drag && e.pointerId === drag.id) endDrag();
  });
  $("grid").addEventListener("keydown", function (e) {
    var el = e.target.closest(".bar"); if (!el || el.getAttribute("role") !== "slider") return;
    // Mouse drag: recorded as one change at the end.
    if (drag || e.metaKey || e.ctrlKey || e.altKey) return;
    var isV = el.dataset.vel != null, i = +el.dataset[barKey(isV)], s = S.steps[i];
    var max = isV ? 127 : 100, cur = isV ? velOf(s) : gatePct(s), big = e.shiftKey ? 10 : 1;
    var next = { ArrowUp: cur + big, ArrowRight: cur + big, ArrowDown: cur - big, ArrowLeft: cur - big, PageUp: cur + 10, PageDown: cur - 10, Home: 0, End: max }[e.key];
    if (next == null) return;
    e.preventDefault();
    var before = stateNow();
    if (setBar(i, isV, next / max)) { paintBar(el, i, isV); table(); kbRender(); remember(isV ? "Edit the velocity" : "Edit the gate", before, (isV ? "vel" : "gate") + i, ["steps"]); }
  });
  $("stepsel").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b || b.dataset.sel == null) return;
    selStep = +b.dataset.sel; kbRender();
    // Phones: show the page that holds the picked step.
    if (seqPaged() && Math.floor(selStep / 8) !== seqPage) { seqPage = Math.floor(selStep / 8); gridView(); }
  });
  $("saved").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.del != null) {
      saved.splice(+b.dataset.del, 1); persist(); savedList();
      // Move the focus after deleting a row.
      (saved.length ? $("ideas").querySelector("summary") : $("keep")).focus();
      return;
    }
    if (b.dataset.load != null) applySaved(saved[+b.dataset.load]);
  });

  // Step pages on phones: steps 1-8 or 9-16.
  $("seqpages").addEventListener("click", function (e) {
    var b = e.target.closest("[data-page]"); if (!b || +b.dataset.page === seqPage) return;
    seqPage = +b.dataset.page; gridView();
  });
  if (phone.addEventListener) phone.addEventListener("change", gridView);
  else if (phone.addListener) phone.addListener(gridView);

  // FAQ: one answer open at a time, smooth open and close (not with reduced motion).
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  var faqs = Array.prototype.map.call(document.querySelectorAll(".about details"), function (d) {
    var summary = d.querySelector("summary"), anim = null;
    function slide(closing) {
      var body = Array.prototype.filter.call(d.children, function (c) { return c !== summary; });
      // Start from the current height.
      var from = d.offsetHeight;
      if (anim) anim.cancel();
      body.forEach(function (c) { c.getAnimations().forEach(function (a) { a.cancel(); }); });
      // Measure, then animate.
      d.classList.toggle("closing", closing);
      d.open = !closing;
      var to = d.offsetHeight;
      d.open = true;
      d.style.overflow = "hidden";
      anim = d.animate({ height: [from + "px", to + "px"] }, { duration: 260, easing: "cubic-bezier(.2, .7, .2, 1)" });
      body.forEach(function (c) {
        c.animate({ opacity: closing ? [1, 0] : [0, 1] }, { duration: closing ? 160 : 260, easing: "ease-out", fill: closing ? "forwards" : "none" });
      });
      anim.onfinish = function () {
        anim = null;
        d.style.overflow = "";
        if (closing) {
          d.open = false;
          d.classList.remove("closing");
          body.forEach(function (c) { c.getAnimations().forEach(function (a) { a.cancel(); }); });
        }
      };
    }
    // Other open answers.
    function others() {
      return faqs.filter(function (f) { return f.d !== d && f.d.open && !f.d.classList.contains("closing"); });
    }
    summary.addEventListener("click", function (e) {
      if ((reduceMotion && reduceMotion.matches) || !d.animate) return;
      e.preventDefault();
      var closing = d.open && !d.classList.contains("closing");
      if (!closing) others().forEach(function (f) { f.slide(true); });
      slide(closing);
    });
    d.addEventListener("toggle", function () {
      if (d.open && !d.classList.contains("closing")) others().forEach(function (f) { f.d.open = false; });
    });
    return { d: d, slide: slide };
  });

  readControls();
  setSound(styleSound(STYLES[S.style]));
  generate();
  render();

  // Back from the payment page (Mollie redirects to ?thanks): say thank you once,
  // then clean the address so a reload or a shared link does not show it again.
  var back = null;
  try { back = new URL(location.href); } catch (e) {}
  if (back && back.searchParams.has("thanks")) {
    $("thanks").hidden = false;
    // Text set after the bar shows, so screen readers announce it.
    setTimeout(function () { $("thanks").querySelector("p").textContent = "Thank you for the coffee and for supporting Bass Assembly!"; }, 300);
    back.searchParams.delete("thanks");
    try { history.replaceState(null, "", back.pathname + back.search + back.hash); } catch (e) {}
  }
  $("thanks-close").addEventListener("click", function () {
    $("thanks").hidden = true;
    // Keyboard: go on from the first header key, not from the top of the page.
    document.querySelector("header .acts .key").focus();
  });
})();
