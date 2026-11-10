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
  var DEF = { vel: [80, 105], gate: [.45, .8], wave: "square", q: 6, cut: 1500, dec: .22, bpm: [90, 125], drive: 0, sub: 0, glide: 50, delay: 15, dtime: .75, dfb: 35, rev: 10, rsize: 2, scale: null, w: null, reach: 5, accBeat: false, acc: .15, tie: .05, force0: true };
  var STYLES = {
    acid:  { label: "Acid", p: P.acid, acc: .3, tie: .3, vel: [75, 110], gate: [.5, .95], q: 14, cut: 2600, dec: .2, drive: 25, glide: 70, delay: 30, dtime: .75, dfb: 40, rev: 12, bpm: [120, 138], scale: "minpent", w: { 0: 5, 3: 2, 7: 2, 10: 2 } },
    ebm:   { label: "EBM", p: [1,.8,.9,.8,1,.8,.9,.8,1,.8,.9,.8,1,.8,.9,.85], acc: .1, tie: 0, accBeat: true, vel: [90, 100], gate: [.3, .45], q: 3, cut: 900, dec: .12, drive: 40, delay: 12, dtime: .5, dfb: 25, rev: 8, rsize: 1.2, bpm: [118, 135], scale: "minor", w: { 0: 8, 7: 1.5, 3: .6, 10: .6, 5: .5 }, reach: 9 },
    indus: { label: "Industrial", p: [1,0,.3,.5,0,.4,.3,0,.8,0,.5,.3,.2,.6,0,.5], acc: .2, tie: .15, vel: [55, 127], gate: [.35, 1], wave: "square", q: 2, cut: 700, dec: .35, drive: 65, delay: 25, dtime: 1, dfb: 50, rev: 35, rsize: 3.5, bpm: [95, 125], scale: "phryg", w: { 0: 7, 1: 3, 7: 2, 8: 1.5, 10: 1, 3: 1, 5: .7 }, reach: 8 },
    roll:  { label: "Rolling", p: P.roll, sub: 30 },
    dark:  { label: "Dark Wave", p: [1,.15,.9,.2,.9,.15,.85,.25,1,.15,.9,.2,.9,.15,.85,.35], acc: .1, tie: .05, vel: [82, 100], gate: [.5, .8], q: 4, cut: 1100, dec: .25, drive: 10, sub: 15, glide: 40, delay: 35, dtime: .75, dfb: 45, rev: 40, rsize: 3, bpm: [105, 135], scale: "minor", w: { 0: 5, 7: 3, 3: 2.5, 10: 2.5, 5: 2, 8: 1.5, 2: 1 }, reach: 6 }
  };
  Object.keys(STYLES).forEach(function (k) { STYLES[k] = Object.assign({}, DEF, STYLES[k]); });
  var S = { root: 0, scale: "minpent", oct: 2, n: 16, style: "acid", dens: 55, rep: true, bpm: 100, swing: 0, hum: 0, steps: [] };
  /* Humanize: small random drift (sum of two draws, more natural than a flat draw), between -1 and 1 */
  function jit() { return Math.random() + Math.random() - 1; }
  var $ = function (id) { return document.getElementById(id); };
  var saved = [];
  try { saved = JSON.parse(localStorage.getItem("bassassembly-ideas") || "[]"); } catch (e) { saved = []; }
  // Browser storage may hold damaged data: keep only entries that look like saved ideas.
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
  function generate() {
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
    if (S.rep) mutate(2, true);
    fixTies(n);
  }
  function mutate(count, keepRoots) {
    var n = S.n, pl = pool(19), start = keepRoots && S.rep ? n / 2 : 0;
    for (var c = 0; c < count; c++) {
      var i = start + Math.floor(Math.random() * (n - start)), s = S.steps[i], r = Math.random();
      if (r < .55) {
        if (!s.on) { s.on = true; }
        s.m = pickNote(pl, null, i);
      } else if (r < .75) { s.on = !s.on; if (s.on) s.m = pickNote(pl, null, i); }
      else if (r < .8) { s.acc = !s.acc; }
      else if (r < .9) { var stt = STYLES[S.style]; s.vel = rv(stt.vel); s.gate = +(stt.gate[0] + Math.random() * (stt.gate[1] - stt.gate[0])).toFixed(2); }
      else { s.tie = !s.tie; }
      if (!s.on) { s.acc = false; s.tie = false; }
    }
    if (!S.steps.slice(0, n).some(function (x) { return x.on; })) { S.steps[0] = { on: true, m: rootMidi(), acc: false, tie: false }; }
    fixTies(n);
  }

  /* ---------- Rendering ---------- */
  var cur = -1, selStep = 0;
  function render() {
    var n = S.n, rows = pool(24).slice().reverse(), g = $("grid");
    g.style.gridTemplateColumns = "46px repeat(" + n + ", minmax(26px, 1fr))";
    var h = '<div class="lbl"></div>';
    for (var i = 0; i < n; i++) h += '<div class="hd' + (i % 4 === 0 ? " beat" : "") + '" data-hd="' + i + '">' + (i + 1) + "</div>";
    rows.forEach(function (m) {
      var isRoot = (m - rootMidi()) % 12 === 0;
      h += '<div class="lbl' + (isRoot ? " root" : "") + '">' + noteName(m) + "</div>";
      for (var i = 0; i < n; i++) {
        var s = S.steps[i], on = s.on && s.m === m;
        h += '<button class="c' + (on ? " on" : "") + (isRoot ? " r" : "") + (Math.floor(i / 4) % 2 === 0 && !isRoot ? " b" : "") + '" data-i="' + i + '" data-m="' + m + '" aria-label="Step ' + (i + 1) + ", " + noteName(m) + (on ? ", active" : "") + '"></button>';
      }
    });
    h += '<div class="lbl">Accent</div>';
    for (var a = 0; a < n; a++) h += '<button class="c flag' + (S.steps[a].acc ? " on" : "") + '" data-acc="' + a + '" aria-label="Accent step ' + (a + 1) + '">' + (S.steps[a].acc ? "A" : "") + "</button>";
    h += '<div class="lbl">Tie</div>';
    for (var t = 0; t < n; t++) h += '<button class="c flag tie' + (S.steps[t].tie ? " on" : "") + '" data-tie="' + t + '" aria-label="Tie step ' + (t + 1) + '">' + (S.steps[t].tie ? "~" : "") + "</button>";
    h += '<div class="lbl">Vel</div>';
    for (var v = 0; v < n; v++) h += barHtml(v, true);
    h += '<div class="lbl">Gate</div>';
    for (var q = 0; q < n; q++) h += barHtml(q, false);
    g.innerHTML = h;
    table();
    kbRender();
    savedList();
    mark(cur);
  }
  /* Velocity and gate of a step, with their defaults. Gate is 100% on a tied step. */
  function velOf(s) { return s.vel || 100; }
  function gateRaw(s) { return s.gate || .6; }
  function gateOf(s) { return s.tie ? 1 : gateRaw(s); }
  function gatePct(s) { return Math.round(gateOf(s) * 100); }

  /* Velocity and gate bars: sliders that show their value and can be dragged.
     Rest steps are plain, hidden boxes: there is nothing to set on them.
     A tied step plays its full length: its gate bar reads "tie" instead of 100%. */
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
  /* Update a bar in place, so it keeps keyboard focus and the drag stays cheap. */
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
      // Lowering the gate of a tied step unties it from the next step.
      if (g >= 1) return false;
      s.tie = false;
      var flag = $("grid").querySelector('[data-tie="' + i + '"]');
      if (flag) { flag.classList.remove("on"); flag.textContent = ""; }
    }
    s.gate = g;
    return true;
  }
  var PADS_TOP = [["C#", 1], ["D#", 3], ["", -1], ["F#", 6], ["G#", 8], ["A#", 10], ["", -1], ["", -1]];
  var PADS_BOT = [["C", 0], ["D", 2], ["E", 4], ["F", 5], ["G", 7], ["A", 9], ["B", 11], ["C", 12]];
  /* Which key for each step: what the step chips, pads and keyboard show for the selected step. */
  var BLACK = { 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 };
  function kbInfo() {
    var n = S.n, used = {}, usedM = {}, low = null;
    if (selStep >= n) selStep = 0;
    S.steps.slice(0, n).forEach(function (x) {
      if (x.on) { used[x.m % 12] = 1; usedM[x.m] = 1; var bl = Math.floor(x.m / 12); if (low === null || bl < low) low = bl; }
    });
    if (low === null) low = Math.floor(rootMidi() / 12);
    var sel = S.steps[selStep];
    return { n: n, sel: sel, used: used, usedM: usedM, low: low, selPc: sel.on ? sel.m % 12 : -1, rel: sel.on ? Math.floor(sel.m / 12) - low : 0 };
  }
  function padCls(v, k) {
    if (v === -1) return "pd none";
    if (v === 12) return "pd" + (k.used[0] ? " used" : "");
    return "pd" + (v === k.selPc ? " sel" : k.used[v] ? " used" : "");
  }
  function keyCls(m, k) { return (BLACK[m % 12] ? "bk" : "wk") + (k.sel.on && m === k.sel.m ? " sel" : (k.usedM[m] ? " used" : "")); }
  function kbText(k) {
    var sel = k.sel;
    if (!sel.on) return "Step " + (selStep + 1) + ": rest. Leave this step empty.";
    var pc = sel.m % 12;
    return "Step " + (selStep + 1) + ": " + noteName(sel.m) + ". Play " + NAMES[pc] + " on the " + (BLACK[pc] ? "top" : "bottom") + " pad row, or on the keyboard. Octave: " +
      (k.rel === 0 ? "the lowest octave of your sequence" : k.rel + (k.rel === 1 ? " octave" : " octaves") + " above the lowest octave of your sequence") +
      ". Velocity " + velOf(sel) + ", gate " + gatePct(sel) + "%" + (sel.acc ? ", accent" : "") + (sel.tie ? ", tied to the next step" : "") + ".";
  }
  // Full rebuild, when the notes change.
  function kbRender() {
    var k = kbInfo(), h = "", i;
    $("stepsel").style.setProperty("--n", k.n);
    for (i = 0; i < k.n; i++) {
      var st = S.steps[i];
      h += '<div class="stp"><small>' + (st.on ? noteName(st.m) : "") + '</small>' +
           '<button class="chip' + (st.on ? " on" : "") + (i === selStep ? " sel" : "") + '" data-sel="' + i + '" aria-label="Step ' + (i + 1) + '">' + (i + 1) + "</button></div>";
    }
    $("stepsel").innerHTML = h;
    function pad(p) { return '<div class="' + padCls(p[1], k) + '" data-v="' + p[1] + '">' + p[0] + "</div>"; }
    $("pads").innerHTML = PADS_TOP.map(pad).join("") + PADS_BOT.map(pad).join("");
    var kb = "", wi = 0, W = 26, BW = 16, base = k.low * 12;
    for (var m = base; m <= base + 36; m++) {
      var pc = m % 12;
      if (BLACK[pc]) kb += '<div class="' + keyCls(m, k) + '" data-m="' + m + '" style="left:' + (wi * W - BW / 2) + 'px"></div>';
      else { kb += '<div class="' + keyCls(m, k) + '" data-m="' + m + '" style="left:' + (wi * W) + 'px;width:' + (W - 1) + 'px">' + (pc === 0 ? "C" + (Math.floor(m / 12) - 1) : "") + "</div>"; wi++; }
    }
    $("kb").style.width = (wi * W) + "px";
    $("kb").innerHTML = kb;
    $("kbtxt").textContent = kbText(k);
  }
  // Light update when only the selected step moves (playback): change classes in place.
  function kbSelect() {
    var k = kbInfo();
    Array.prototype.forEach.call($("stepsel").querySelectorAll(".chip"), function (c) { c.classList.toggle("sel", +c.dataset.sel === selStep); });
    Array.prototype.forEach.call($("pads").children, function (p) { p.className = padCls(+p.dataset.v, k); });
    Array.prototype.forEach.call($("kb").children, function (key) { key.className = keyCls(+key.dataset.m, k); });
    $("kbtxt").textContent = kbText(k);
  }
  function table() {
    var n = S.n, h = "";
    for (var i = 0; i < n; i++) {
      var s = S.steps[i];
      if (s.on) {
        var fl = [];
        if (s.acc) fl.push("accent");
        if (s.tie) fl.push("tie");
        h += "<tr><td>" + (i + 1) + "</td><td><strong>" + noteName(s.m) + "</strong></td><td>" + s.m + "</td><td>+" + (s.m - rootMidi()) + "</td><td>" + velOf(s) + "</td><td>" + gatePct(s) + "%</td><td>" + fl.join(", ") + "</td></tr>";
      } else {
        h += '<tr><td class="off">' + (i + 1) + '</td><td class="off">rest</td><td class="off"></td><td class="off"></td><td class="off"></td><td class="off"></td><td class="off"></td></tr>';
      }
    }
    $("tbody").innerHTML = h;
  }
  function mark(i) {
    var g = $("grid");
    g.querySelectorAll(".now").forEach(function (e) { e.classList.remove("now"); });
    if (i < 0) return;
    if (i !== selStep) { selStep = i; kbSelect(); }
    g.querySelectorAll('[data-i="' + i + '"], [data-hd="' + i + '"]').forEach(function (e) {
      if (e.classList.contains("hd") || e.classList.contains("on")) e.classList.add("now");
    });
  }
  function status(t) { $("status").textContent = t; }

  /* ---------- Saved ideas ---------- */
  function persist() { try { localStorage.setItem("bassassembly-ideas", JSON.stringify(saved)); } catch (e) {} }
  function savedList() {
    var el = $("saved");
    if (!saved.length) { el.innerHTML = '<div class="empty">Nothing yet. Generate, then keep what you like.</div>'; return; }
    var h = "";
    saved.forEach(function (x, k) {
      h += '<div class="item"><button data-load="' + k + '">' + esc(x.label) + '</button><button class="x" data-del="' + k + '" aria-label="Delete">×</button></div>';
    });
    el.innerHTML = h;
  }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  /* A saved idea comes from browser storage: it may be damaged or made by an older version.
     Keep only known keys and values in range, so loading it can never break the page. */
  function num(v, lo, hi, d) { v = +v; return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; }
  function cleanState(st) {
    var c = {}, i;
    c.style = STYLES[st.style] ? st.style : "acid";
    c.scale = SCALES[st.scale] ? st.scale : "minpent";
    c.root = Math.round(num(st.root, 0, 11, 0));
    c.oct = [1, 2, 3].indexOf(+st.oct) >= 0 ? +st.oct : 2;
    c.n = +st.n === 8 ? 8 : 16;
    c.dens = Math.round(num(st.dens, 10, 100, 55));
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
                delay: num(d.delay, 0, 100, 15), dtime: [.5, .75, 1].indexOf(+d.dtime) >= 0 ? +d.dtime : .75,
                dfb: num(d.dfb, 0, 85, 35), rev: num(d.rev, 0, 100, 10), rsize: num(d.rsize, .5, 4, 2) };
    }
    return c;
  }
  function applySaved(e) {
    var st = cleanState(e.state);
    ["root", "scale", "oct", "n", "dens", "rep", "steps", "style", "bpm", "swing", "hum", "snd"].forEach(function (k) { if (st[k] !== undefined) S[k] = st[k]; });
    fixTies(S.n);
    $("root").value = S.root; $("scale").value = S.scale; $("oct").value = S.oct; $("n").value = S.n; $("dens").value = S.dens; $("rep").checked = S.rep;
    $("style").value = S.style; $("bpm").value = S.bpm; $("swing").value = S.swing; $("hum").value = S.hum || 0;
    readControls();
    // The loaded idea may have fewer steps: restart the loop so no hidden step plays.
    if (playing) pos = 0;
    if (S.snd) setSound(Object.assign(styleSound(STYLES[S.style]), S.snd));
    render();
    status("Idea loaded.");
  }

  /* ---------- Audio ---------- */
  var ctx = null, playing = false, nextT = 0, pos = 0, timer = null, voice = null, run = 0;
  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var bus = null, irSize = 0;
  function makeIR(sec) {
    var rate = ctx.sampleRate, len = Math.floor(rate * sec), buf = ctx.createBuffer(2, len, rate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }
  function ensureBus() {
    if (bus && bus.ctx === ctx) return bus;
    var inp = ctx.createGain(), dry = ctx.createGain(), dl = ctx.createDelay(2), fb = ctx.createGain(), tone = ctx.createBiquadFilter();
    var dsend = ctx.createGain(), conv = ctx.createConvolver(), rsend = ctx.createGain(), master = ctx.createGain();
    tone.type = "lowpass"; tone.frequency.value = 2800; master.gain.value = .9;
    inp.connect(dry); dry.connect(master);
    inp.connect(dsend); dsend.connect(dl); dl.connect(tone); tone.connect(fb); fb.connect(dl); tone.connect(master);
    inp.connect(rsend); rsend.connect(conv); conv.connect(master);
    master.connect(ctx.destination);
    bus = { ctx: ctx, inp: inp, dl: dl, fb: fb, dsend: dsend, conv: conv, rsend: rsend };
    irSize = 0; applyFx();
    return bus;
  }
  function applyFx() {
    if (!bus || !S.snd) return;
    var sd = S.snd, t = ctx.currentTime;
    bus.dsend.gain.setTargetAtTime(sd.delay / 100 * .7, t, .03);
    bus.fb.gain.setTargetAtTime(Math.min(.85, sd.dfb / 100), t, .03);
    bus.dl.delayTime.setTargetAtTime(sd.dtime * 60 / S.bpm, t, .05);
    bus.rsend.gain.setTargetAtTime(sd.rev / 100 * .9, t, .03);
    if (Math.abs(sd.rsize - irSize) > .05) {
      // Building the reverb is heavy: do it at once the first time, then only once the
      // Reverb size slider has stopped moving, so dragging it does not stall playback.
      clearTimeout(irTimer);
      if (!irSize) setIR(); else irTimer = setTimeout(setIR, 150);
    }
  }
  var irTimer = null;
  function setIR() {
    if (!bus || !S.snd) return;
    bus.conv.buffer = makeIR(S.snd.rsize); irSize = S.snd.rsize;
  }
  var curves = {};
  function curve(d) {
    if (curves[d]) return curves[d];
    var n = 1024, c = new Float32Array(n), a = 1 + d / 8;
    for (var i = 0; i < n; i++) { var x = i / (n / 2) - 1; c[i] = Math.tanh(a * x); }
    return (curves[d] = c);
  }
  function startVoice(m, t, acc, vel) {
    var sd = S.snd, k = Math.pow((vel || 100) / 127, 1.4);
    var o = ctx.createOscillator(), o2 = ctx.createOscillator(), sg = ctx.createGain();
    var f = ctx.createBiquadFilter(), g = ctx.createGain(), sh = ctx.createWaveShaper();
    o.type = sd.wave; o.frequency.setValueAtTime(freq(m), t);
    o2.type = "sine"; o2.frequency.setValueAtTime(freq(m) / 2, t); sg.gain.value = sd.sub / 100;
    f.type = "lowpass"; f.Q.value = sd.q;
    var peak = sd.cut * (acc ? 2 : 1) * (.5 + k);
    f.frequency.setValueAtTime(peak, t); f.frequency.exponentialRampToValueAtTime(Math.max(120, sd.cut * .15), t + sd.dec);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((.08 + .38 * k * (acc ? 1.25 : 1)) * (1 - sd.drive / 400), t + .005);
    if (sd.drive > 0) sh.curve = curve(sd.drive);
    o.connect(f); o2.connect(sg); sg.connect(f); f.connect(sh); sh.connect(g); g.connect(ensureBus().inp);
    o.start(t); o2.start(t);
    return { o: o, o2: o2, g: g, f: f, m: m };
  }
  function endVoice(v, t) {
    v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0.0001, t, .015); v.o.stop(t + .15); v.o2.stop(t + .15);
  }
  function schedule(i, t0, dur) {
    var s = S.steps[i], h = (S.hum || 0) / 100, t = t0;
    if (h) t = Math.max(ctx.currentTime + .005, t0 + jit() * h * dur * .2);
    if (s.on) {
      var vel = h ? Math.max(1, Math.min(127, Math.round(velOf(s) + jit() * h * 14))) : velOf(s);
      var gate = h ? Math.max(.05, Math.min(1, gateRaw(s) * (1 + jit() * h * .25))) : gateRaw(s);
      if (voice && voice.tied) {
        // Slide: hold the previous pitch until this step, then glide to the new one.
        var gl = Math.max(.02, S.snd.glide / 1000);
        voice.o.frequency.cancelScheduledValues(t); voice.o.frequency.setValueAtTime(freq(voice.m), t);
        voice.o.frequency.exponentialRampToValueAtTime(freq(s.m), t + gl);
        voice.o2.frequency.cancelScheduledValues(t); voice.o2.frequency.setValueAtTime(freq(voice.m) / 2, t);
        voice.o2.frequency.exponentialRampToValueAtTime(freq(s.m) / 2, t + gl);
        voice.m = s.m;
      } else {
        if (voice) endVoice(voice, t);
        voice = startVoice(s.m, t, s.acc, vel);
      }
      voice.tied = s.tie && S.steps[(i + 1) % S.n].on;
      if (!voice.tied) { endVoice(voice, t + dur * gate); voice = null; }
    } else if (voice) { endVoice(voice, t); voice = null; }
    // Move the playhead when the step sounds. Skip it if playback was stopped or restarted
    // since, or if the step no longer exists after the step count changed.
    var delay = Math.max(0, (t0 - ctx.currentTime) * 1000), r = run;
    setTimeout(function () { if (playing && r === run && i < S.n) { cur = i; mark(i); } }, delay);
  }
  function tick() {
    var dur = 60 / S.bpm / 4;
    while (nextT < ctx.currentTime + .15) {
      var off = (pos % 2 === 1) ? dur * (S.swing / 100) * .66 : 0;
      schedule(pos, nextT + off, dur);
      nextT += dur; pos = (pos + 1) % S.n;
    }
  }
  function updatePlay() {
    var b = $("play");
    b.classList.toggle("on", playing);
    b.setAttribute("aria-pressed", playing ? "true" : "false");
    b.textContent = playing ? "Stop" : "Play";
  }
  // iOS mutes Web Audio when the ring/silent switch is on. Every iPhone browser (Safari, Chrome,
  // Firefox...) runs on WebKit, so all of them are affected. Two fixes: ask for playback audio
  // where the Audio Session API exists, and play a silent looping <audio> element on iOS, which
  // switches the page to media playback in every iOS browser.
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
    playing = true; run++; pos = 0; nextT = ctx.currentTime + .08; voice = null;
    timer = setInterval(tick, 25); tick();
    updatePlay();
  }
  function stop() {
    if (silence) silence.pause();
    playing = false; run++; clearInterval(timer);
    if (voice && ctx) { endVoice(voice, ctx.currentTime); voice = null; }
    cur = -1; mark(-1);
    updatePlay();
  }

  /* ---------- Events ---------- */
  function fillSelect(id, obj, key) {
    $(id).innerHTML = Object.keys(obj).map(function (k) { return '<option value="' + k + '">' + (key ? obj[k][key] : obj[k]) + "</option>"; }).join("");
  }
  $("root").innerHTML = NAMES.map(function (n, i) { return '<option value="' + i + '">' + n + "</option>"; }).join("");
  fillSelect("scale", SCALES, "label");
  fillSelect("style", STYLES, "label");

  function readSound() {
    S.snd = { wave: $("wave").value, cut: +$("cut").value, q: +$("q").value, dec: +$("dec").value / 100, drive: +$("drive").value, sub: +$("sub").value, glide: +$("glide").value,
              delay: +$("delay").value, dtime: +$("dtime").value, dfb: +$("dfb").value, rev: +$("rev").value, rsize: +$("rsize").value / 10 };
    $("cutv").textContent = S.snd.cut + " Hz"; $("qv").textContent = S.snd.q; $("decv").textContent = Math.round(S.snd.dec * 1000) + " ms";
    $("drivev").textContent = S.snd.drive + "%"; $("subv").textContent = S.snd.sub + "%"; $("glidev").textContent = S.snd.glide + " ms";
    $("delayv").textContent = S.snd.delay + "%"; $("dfbv").textContent = S.snd.dfb + "%"; $("revv").textContent = S.snd.rev + "%"; $("rsizev").textContent = S.snd.rsize.toFixed(1) + " s";
    applyFx();
  }
  function setSound(sd) {
    $("wave").value = sd.wave; $("cut").value = sd.cut; $("q").value = sd.q; $("dec").value = Math.round(sd.dec * 100);
    $("drive").value = sd.drive; $("sub").value = sd.sub; $("glide").value = sd.glide;
    $("delay").value = sd.delay; $("dtime").value = String(sd.dtime); $("dfb").value = sd.dfb; $("rev").value = sd.rev; $("rsize").value = Math.round(sd.rsize * 10);
    readSound();
  }
  function styleSound(st) { return { wave: st.wave, cut: st.cut, q: st.q, dec: st.dec, drive: st.drive, sub: st.sub, glide: st.glide, delay: st.delay, dtime: st.dtime, dfb: st.dfb, rev: st.rev, rsize: st.rsize }; }
  ["wave", "cut", "q", "dec", "drive", "sub", "glide", "delay", "dtime", "dfb", "rev", "rsize"].forEach(function (id) { $(id).addEventListener("input", readSound); });

  function readControls() {
    S.root = +$("root").value; S.scale = $("scale").value; S.oct = +$("oct").value;
    S.n = +$("n").value; S.style = $("style").value; S.dens = +$("dens").value;
    S.bpm = +$("bpm").value; S.swing = +$("swing").value; S.hum = +$("hum").value; S.rep = $("rep").checked;
    $("densv").textContent = S.dens + "%"; $("bpmv").textContent = S.bpm + " bpm"; $("swingv").textContent = S.swing + "%"; $("humv").textContent = S.hum + "%";
    applyFx();
  }
  ["root", "scale", "oct"].forEach(function (id) {
    $(id).addEventListener("change", function () {
      var oldRoot = rootMidi();
      readControls();
      var shift = rootMidi() - oldRoot, set = pool(24);
      S.steps.forEach(function (s) {
        if (!s.on) return;
        var m = s.m + shift;
        if (set.indexOf(m) < 0) m = set.reduce(function (b, x) { return Math.abs(x - m) < Math.abs(b - m) ? x : b; }, set[0]);
        s.m = m;
      });
      render();
    });
  });
  ["n", "style", "rep"].forEach(function (id) {
    $(id).addEventListener("change", function () {
      if (id === "style") {
        var stl = STYLES[$("style").value], sc = stl.scale;
        if (sc) $("scale").value = sc;
        $("bpm").value = Math.round((stl.bpm[0] + stl.bpm[1]) / 2);
        readControls(); setSound(styleSound(stl)); generate(); status("Style " + stl.label + ": new notes generated.");
      } else {
        readControls();
        // A new step count changes which step follows the last one: drop ties into a rest.
        if (id === "n") { fixTies(S.n); if (playing) pos = 0; }
      }
      render();
    });
  });
  ["dens", "bpm", "swing", "hum"].forEach(function (id) { $(id).addEventListener("input", readControls); });

  $("gen").addEventListener("click", function () {
    readControls(); generate(); render(); status("New notes, same settings.");
  });
  $("rand").addEventListener("click", function () {
    var k = rnd(Object.keys(STYLES)), st = STYLES[k];
    $("style").value = k;
    $("root").value = Math.floor(Math.random() * 12);
    $("scale").value = (st.scale && Math.random() < .7) ? st.scale : rnd(Object.keys(SCALES));
    $("oct").value = rnd(["1", "2", "2"]);
    $("n").value = rnd(["16", "16", "8"]);
    $("dens").value = 40 + Math.floor(Math.random() * 45);
    $("rep").checked = Math.random() < .7;
    $("bpm").value = st.bpm[0] + Math.floor(Math.random() * (st.bpm[1] - st.bpm[0] + 1));
    $("swing").value = rnd([0, 0, 0, 10, 20]);
    var sd = styleSound(st);
    sd.cut = Math.min(6000, Math.max(200, Math.round(sd.cut * (.7 + Math.random() * .7))));
    sd.drive = Math.min(100, Math.round(sd.drive * (.5 + Math.random())));
    sd.delay = Math.min(60, Math.max(0, sd.delay + Math.round(Math.random() * 30 - 10)));
    sd.rev = Math.min(70, Math.max(0, sd.rev + Math.round(Math.random() * 30 - 10)));
    sd.dtime = rnd([.5, .75, 1]);
    readControls(); setSound(sd); generate(); render();
    status("New bassline: " + st.label + ", " + NAMES[S.root] + " " + SCALES[S.scale].label.toLowerCase() + ", " + S.n + " steps, " + S.bpm + " bpm.");
  });
  $("mut").addEventListener("click", function () {
    readControls(); mutate(3, false); render(); status("A few steps changed.");
  });
  $("clr").addEventListener("click", function () {
    S.steps = blank(); render(); status("Sequence cleared.");
  });
  $("play").addEventListener("click", function () { if (playing) stop(); else play(); });
  $("keep").addEventListener("click", function () {
    readControls();
    var label = STYLES[S.style].label + ", " + NAMES[S.root] + " " + SCALES[S.scale].label.toLowerCase() + ", " + S.n + " steps, " + S.bpm + " bpm";
    saved.unshift({ label: label, state: JSON.parse(JSON.stringify(S)) });
    saved = saved.slice(0, 30); persist(); savedList(); status("Idea saved.");
  });

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
    // Start time of every step, with swing and humanize, so tied notes can end exactly
    // where the next note really starts. T[steps] is the end of the loop.
    var T = [];
    for (var k = 0; k < steps; k++) {
      var t0 = k * STEP + (k % 2 ? Math.round(STEP * S.swing / 100 * .66) : 0);
      T.push(h ? Math.max(0, t0 + Math.round(jit() * h * STEP * .2)) : t0);
    }
    T.push(total);
    function tiedAt(k) { return S.steps[k % n].tie && S.steps[(k + 1) % n].on; }
    for (k = 0; k < steps; k++) {
      var s = S.steps[k % n];
      if (!s.on) continue;
      // Skip a step already held by a same-pitch tie from the step before.
      if (k > 0 && tiedAt(k - 1) && S.steps[(k - 1) % n].m === s.m) continue;
      var vel = Math.max(1, Math.min(127, s.acc ? Math.max(velOf(s), 112) : velOf(s)));
      if (h) vel = Math.max(1, Math.min(127, Math.round(vel + jit() * h * 14)));
      // Follow ties to the same pitch: one held note, not several.
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
  $("midi").addEventListener("click", function () {
    readControls();
    var out = $("midiout");
    var bytes = buildMidi(), ok = false;
    var name = "bassassembly-" + STYLES[S.style].label.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + NAMES[S.root].replace("#", "s") + "-" + S.bpm + "bpm.mid";
    try {
      var url = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" })), a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      ok = true;
      out.innerHTML = "";
      out.appendChild(document.createTextNode("File ready. If it did not download, click here: "));
      var l = document.createElement("a"); l.href = url; l.download = name; l.textContent = name; l.style.textDecoration = "underline";
      out.appendChild(l);
    } catch (e) {}
    status(ok ? "MIDI exported: " + name : "Export is not possible in this browser. Try another one.");
  });
  $("copy").addEventListener("click", function () {
    var n = S.n, lines = ["Bass Assembly bassline " + NAMES[S.root] + " " + SCALES[S.scale].label.toLowerCase() + ", " + n + " steps, " + S.bpm + " bpm"];
    for (var i = 0; i < n; i++) {
      var s = S.steps[i];
      lines.push((i + 1) + ": " + (s.on ? noteName(s.m) + " (+" + (s.m - rootMidi()) + ")" + " vel " + velOf(s) + " gate " + gatePct(s) + "%" + (s.acc ? " accent" : "") + (s.tie ? " tie" : "") : "-"));
    }
    var txt = lines.join("\n");
    try {
      navigator.clipboard.writeText(txt).then(function () { status("Copied."); }, function () { status(txt.replace(/\n/g, " | ")); });
    } catch (e) { status(txt.replace(/\n/g, " | ")); }
  });

  $("grid").addEventListener("click", function (e) {
    // Ignore the click some browsers fire where a bar drag was released.
    if (performance.now() - dragEndAt < 400) return;
    var b = e.target.closest("button"); if (!b) return;
    var s;
    if (b.dataset.i != null) {
      s = S.steps[+b.dataset.i]; var m = +b.dataset.m;
      if (s.on && s.m === m) { s.on = false; s.acc = false; s.tie = false; } else { s.on = true; s.m = m; s.vel = velOf(s); s.gate = gateRaw(s); }
      fixTies(S.n);
    } else if (b.dataset.acc != null) {
      s = S.steps[+b.dataset.acc]; if (s.on) s.acc = !s.acc;
    } else if (b.dataset.tie != null) {
      s = S.steps[+b.dataset.tie]; if (s.on && S.steps[(+b.dataset.tie + 1) % S.n].on) s.tie = !s.tie;
    }
    render();
  });

  /* Drag on a Vel or Gate bar to set it. With a mouse or pen, keep dragging sideways
     to draw over several steps. On a touch screen, a sideways swipe scrolls the grid
     (touch-action: pan-x), a vertical drag or a tap sets the bar under the finger. */
  var drag = null, dragEndAt = 0;
  function startDrag(el, e) {
    var isV = el.dataset.vel != null, bars = $("grid").querySelectorAll("[data-" + barKey(isV) + "]"), cols = [];
    // Read the layout once per drag: the centre of each column and the track of the row.
    for (var k = 0; k < bars.length; k++) { var r = bars[k].getBoundingClientRect(); cols.push({ el: bars[k], i: k, mid: r.left + r.width / 2 }); }
    var track = el.querySelector("b").getBoundingClientRect();
    drag = { isV: isV, cols: cols, top: track.top, h: track.height, moved: false, id: e.pointerId };
    try { $("grid").setPointerCapture(e.pointerId); } catch (err) {}
  }
  function dragAt(e) {
    var best = null, d = Infinity;
    for (var k = 0; k < drag.cols.length; k++) { var dk = Math.abs(e.clientX - drag.cols[k].mid); if (dk < d) { d = dk; best = drag.cols[k]; } }
    if (best && setBar(best.i, drag.isV, 1 - (e.clientY - drag.top) / drag.h)) paintBar(best.el, best.i, drag.isV);
  }
  function endDrag() {
    if (!drag) return;
    if (drag.moved) dragEndAt = performance.now();
    drag = null; touch = null; table(); kbRender();
  }
  var touch = null;
  $("grid").addEventListener("pointerdown", function (e) {
    var el = e.target.closest(".bar"); if (!el || e.button > 0) return;
    if (e.pointerType === "touch") { touch = { el: el, x: e.clientX, y: e.clientY, id: e.pointerId }; return; }
    e.preventDefault();
    startDrag(el, e); dragAt(e);
  });
  $("grid").addEventListener("pointermove", function (e) {
    if (touch && !drag && e.pointerId === touch.id) {
      var dx = Math.abs(e.clientX - touch.x), dy = Math.abs(e.clientY - touch.y);
      if (dy > 6 && dy > dx) startDrag(touch.el, e);
      else if (dx > 6) { touch = null; return; }
    }
    if (drag && e.pointerId === drag.id) { drag.moved = true; dragAt(e); }
  });
  $("grid").addEventListener("pointerup", function (e) {
    if (touch && !drag && e.pointerId === touch.id) { startDrag(touch.el, e); dragAt(e); }
    endDrag();
  });
  $("grid").addEventListener("pointercancel", function () { touch = null; endDrag(); });
  $("grid").addEventListener("keydown", function (e) {
    var el = e.target.closest(".bar"); if (!el || el.getAttribute("role") !== "slider") return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var isV = el.dataset.vel != null, i = +el.dataset[barKey(isV)], s = S.steps[i];
    var max = isV ? 127 : 100, cur = isV ? velOf(s) : gatePct(s), big = e.shiftKey ? 10 : 1;
    var next = { ArrowUp: cur + big, ArrowRight: cur + big, ArrowDown: cur - big, ArrowLeft: cur - big, PageUp: cur + 10, PageDown: cur - 10, Home: 0, End: max }[e.key];
    if (next == null) return;
    e.preventDefault();
    if (setBar(i, isV, next / max)) { paintBar(el, i, isV); table(); kbRender(); }
  });
  $("stepsel").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b || b.dataset.sel == null) return;
    selStep = +b.dataset.sel; kbRender();
  });
  $("saved").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.del != null) { saved.splice(+b.dataset.del, 1); persist(); savedList(); return; }
    if (b.dataset.load != null) applySaved(saved[+b.dataset.load]);
  });

  var skin = "black";
  try { skin = localStorage.getItem("bassassembly-theme") === "white" ? "white" : "black"; } catch (e) {}
  function applySkin() {
    document.documentElement.setAttribute("data-skin", skin);
    // Browser bar color follows the page background of the theme.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#121212");
    // Visible label DK or LT, the accessible name starts with it (WCAG 2.5.3).
    $("skin").innerHTML = skin === "black" ? 'DK<span class="sr"> dark theme, switch to light</span>' : 'LT<span class="sr"> light theme, switch to dark</span>';
  }
  $("skin").addEventListener("click", function () {
    skin = skin === "black" ? "white" : "black";
    try { localStorage.setItem("bassassembly-theme", skin); } catch (e) {}
    applySkin();
  });
  applySkin();

  // FAQ: smooth height and fade when a question opens or closes.
  // Skipped when the user asks for reduced motion; the native toggle then works as is.
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  Array.prototype.forEach.call(document.querySelectorAll(".about details"), function (d) {
    var summary = d.querySelector("summary"), anim = null;
    summary.addEventListener("click", function (e) {
      if ((reduceMotion && reduceMotion.matches) || !d.animate) return;
      e.preventDefault();
      var closing = d.open && !d.classList.contains("closing");
      var body = Array.prototype.filter.call(d.children, function (c) { return c !== summary; });
      // Start from the current height, even mid-animation, so a second tap reverses smoothly.
      var from = d.offsetHeight;
      if (anim) anim.cancel();
      body.forEach(function (c) { c.getAnimations().forEach(function (a) { a.cancel(); }); });
      // Measure the target height before any paint, then animate between the two.
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
    });
  });

  readControls();
  setSound(styleSound(STYLES[S.style]));
  generate();
  render();
})();
