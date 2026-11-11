/* 病房普通話 Ward Putonghua v2 — two ways to practise: Listen & pick, and Conversations.
   No build step, no dependencies. Progress is kept in localStorage on this device. */
(() => {
'use strict';
const CATS = window.CATS;
const nInCat = {};
const TERMS = window.TERMS.map((t, i) => ({ ...t, i, n: (nInCat[t.k] = (nInCat[t.k] || 0) + 1) - 1 }));
const catOf = id => CATS.find(c => c.id === id);
const GROUPS = [['t', '醫護用語', 'Terms'], ['p', '程序', 'Procedures'], ['i', '對話句子', 'Phrases'], ['x', '易混音', 'Sound-alikes']];
const KEY = 'wardpth.v3';
const $ = s => document.querySelector(s);
const view = $('#view'), overlay = $('#overlay'), sheet = $('#sheet');

/* ---------- state ---------- */
const DEF = { it: {}, trap: {}, scen: {}, day: {}, grp: 't', slow: false, script: 't', lang: null, sfx: true };
let S = JSON.parse(JSON.stringify(DEF));
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
if (!S.lang) S.lang = /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
const L = (zh, en) => S.lang === 'zh' ? zh : en;
const today = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
const bump = () => { S.day[today()] = (S.day[today()] || 0) + 1; };
let tab = 'listen';

/* An item counts as known once it has been answered right and the latest answer was not wrong. */
const known = t => { const r = S.it[t.i]; return !!r && r[0] > 0 && !r[2]; };
const inCat = id => TERMS.filter(t => t.k === id);
const knownIn = id => inCat(id).filter(known).length;

/* ---------- text helpers ---------- */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TONE = [/[āēīōūǖ]/, /[áéíóúǘ]/, /[ǎěǐǒǔǚ]/, /[àèìòùǜ]/];
const toneOf = s => TONE.findIndex(r => r.test(s)) + 1;
const pinyinHTML = p => p.split(' ').map(s => `<span class="t${toneOf(s)}">${s}</span>`).join(' ');
const jyutHTML = j => j.replace(/([a-z]+)([1-6])/g, '$1<sup>$2</sup>');
const hanzi = t => S.script === 's' ? t.s : t.m;
const sc = () => S.script === 's' ? 'sc' : '';
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const IC = {
  spk: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a4.5 4.5 0 010 7M18.6 6a8 8 0 010 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  ear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0116 0v2M4 14h3v6H5a1 1 0 01-1-1zM20 14h-3v6h2a1 1 0 001-1z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H10l-5 4v-4a2 2 0 01-1-2z"/><path d="M8 9h8M8 12.5h5"/></svg>',
};
function audioBtns(i, k) {
  return `<div class="aud"><button data-a="say" data-i="${i}" data-k="${k}" aria-label="${L('播放', 'Play')}">${IC.spk}</button>` +
    `<button data-a="say" data-i="${i}" data-k="${k}" data-slow="1" aria-label="${L('慢速播放', 'Play slowly')}">${L('慢', 'Slow')}</button>` +
    `<button data-a="say" data-i="${i}" data-k="${k}" data-n="3" aria-label="${L('重複三次', 'Repeat three times')}">×3</button></div>`;
}
const sideYue = (t, audio = true) => `<div class="side yue"><span class="lab">${L('廣東話', 'CANTONESE')} · Jyutping</span>${audio ? audioBtns(t.i, 'yue') : ''}<div class="hz" lang="zh-HK">${t.c}</div><div class="rom">${jyutHTML(t.j)}</div></div>`;
const sidePth = (t, audio = true) => `<div class="side pth"><span class="lab">${L('普通話', 'PUTONGHUA')} · Pinyin</span>${audio ? audioBtns(t.i, 'pth') : ''}<div class="hz ${sc()}" lang="zh-CN">${hanzi(t)}</div><div class="rom">${pinyinHTML(t.p)}</div></div>`;
const pair = t => `<div class="pair">${sideYue(t)}${sidePth(t)}</div>`;

/* ---------- audio: recordings are stored per topic and fetched only when that topic is practised ---------- */
const AUD = {}, player = new Audio();
let speakToken = 0;
async function loadAudio(k, cat) {
  const key = k + '-' + cat;
  if (AUD[key]) return;
  if (window.AUDIO && window.AUDIO[key]) { AUD[key] = window.AUDIO[key]; return; }
  const r = await fetch('audio/' + key + '.json'); if (!r.ok) throw new Error(key);
  AUD[key] = await r.json();
}
/* Phones only let a page play sound after a tap, so the tap that starts a round plays a moment of silence first. */
function unlockAudio() {
  try {
    const n = 800, b = new Uint8Array(44 + n), dv = new DataView(b.buffer);
    [[0, 0x52494646], [8, 0x57415645], [12, 0x666d7420], [36, 0x64617461]].forEach(([o, v]) => dv.setUint32(o, v));
    dv.setUint32(4, 36 + n, true); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); dv.setUint32(40, n, true);
    b.fill(128, 44);
    player.src = 'data:audio/wav;base64,' + btoa(String.fromCharCode(...b));
    const p = player.play(); if (p && p.catch) p.catch(() => {});
  } catch (e) {}
}
const wait = ms => new Promise(r => setTimeout(r, ms));
function stopSpeech() { speakToken++; try { player.pause(); } catch (e) {} document.querySelectorAll('.playing').forEach(b => b.classList.remove('playing')); }
function playClip(t, k, slow, token) {
  return new Promise(res => {
    const set = AUD[(k === 'pth' ? 'p' : 'y') + '-' + t.k];
    if (!set || !set[t.n]) return res(false);
    let done = false; const fin = ok => { if (!done) { done = true; player.onended = player.onerror = null; res(ok); } };
    player.src = 'data:audio/mpeg;base64,' + set[t.n];
    player.preservesPitch = true; player.defaultPlaybackRate = player.playbackRate = slow ? 0.62 : 1;
    player.onended = () => fin(true); player.onerror = () => fin(false);
    const p = player.play(); if (p && p.catch) p.catch(() => fin(false));
    setTimeout(() => fin(true), 20000);
    if (token !== speakToken) { player.pause(); fin(true); }
  });
}
async function speak(t, k, { slow = S.slow, times = 1, btn = null } = {}) {
  stopSpeech(); const token = speakToken;
  if (btn) btn.classList.add('playing');
  if (!AUD[(k === 'pth' ? 'p' : 'y') + '-' + t.k]) { try { await loadAudio(k === 'pth' ? 'p' : 'y', t.k); } catch (e) {} }
  for (let n = 0; n < times && token === speakToken; n++) { await playClip(t, k, slow, token); if (n < times - 1) await wait(450); }
  if (btn) btn.classList.remove('playing');
}
let actx;
function tone(ok) {
  if (navigator.vibrate) try { navigator.vibrate(ok ? 20 : [30, 40, 30]); } catch (e) {}
  if (!S.sfx) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const now = actx.currentTime;
    (ok ? [660, 880] : [220, 180]).forEach((f, n) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = ok ? 'sine' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + n * 0.1); g.gain.exponentialRampToValueAtTime(0.1, now + n * 0.1 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + n * 0.1 + 0.18);
      o.connect(g).connect(actx.destination); o.start(now + n * 0.1); o.stop(now + n * 0.1 + 0.2);
    });
  } catch (e) {}
}
/* Show a loading card, fetch the recordings a round needs, then run it. */
async function withAudio(keys, run) {
  unlockAudio();
  overlay.hidden = false; document.body.style.overflow = 'hidden';
  overlay.innerHTML = `<div class="sess"><div class="sess-body done"><div class="spin" aria-hidden="true"></div><p class="note">${L('載入聲音…', 'Loading audio…')}</p></div></div>`;
  try { await Promise.all(keys.map(k => loadAudio(k[0], k.slice(2)))); }
  catch (e) {
    overlay.innerHTML = `<div class="sess"><div class="sess-body done"><p class="q">${L('聲音載入唔到', 'The audio did not load')}</p><p class="note">${L('請檢查網絡，然後再試。', 'Check your connection, then try again.')}</p></div><div class="sess-foot"><button class="cta" data-a="close">${L('返回', 'Back')}</button></div></div>`;
    return;
  }
  run();
}
const sessTop = (pos, len) => `<div class="sess-top"><button class="iconbtn" data-a="close" aria-label="${L('離開', 'Close')}">${IC.x}</button><div class="bar"><i style="width:${pos / len * 100}%"></i></div><span>${Math.min(pos + 1, len)}/${len}</span><button class="pill" data-a="slowtoggle" aria-pressed="${S.slow}">${L('慢速', 'Slow')}</button></div>`;

/* ---------- how alike two terms sound (used to pick confusable wrong answers) ---------- */
const plain = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
TERMS.forEach(t => { t.syl = t.p.split(' '); t.ps = t.syl.map(plain); });
function lev(a, b, cost) {
  const m = a.length, n = b.length, d = [...Array(m + 1)].map((_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost(a[i - 1], b[j - 1]));
  return d[m][n];
}
const sylDist = (a, b) => a === b ? 0 : lev([...a], [...b], (x, y) => x === y ? 0 : 1) / Math.max(a.length, b.length);
const soundDist = (a, b) => lev(a.ps, b.ps, sylDist) / Math.max(a.ps.length, b.ps.length) + Math.abs(a.ps.length - b.ps.length) * 0.15;

/* ---------- Listen & pick ---------- */
let D = null;
function pickItems(pool, n) {
  const rank = t => { const r = S.it[t.i]; return (!r ? 1 : r[2] ? 0 : 2 + r[0]) + Math.random() * 0.9; };   // missed first, then new, then least practised
  return pool.map(t => [rank(t), t]).sort((a, b) => a[0] - b[0]).slice(0, n).map(x => x[1]);
}
function startDrill(cat) {
  const pool = inCat(cat);
  withAudio(['p-' + cat, 'y-' + cat], () => {
    D = { cat, pool, qs: shuffle(pickItems(pool, Math.min(10, pool.length))), pos: 0, ok: 0, miss: [], answered: false };
    renderDrill();
  });
}
function renderDrill() {
  const t = D.qs[D.pos]; D.answered = false;
  const near = D.pool.filter(x => x.i !== t.i && x.c !== t.c && x.e !== t.e).map(x => [soundDist(t, x), x]).sort((a, b) => a[0] - b[0]).slice(0, 6).map(x => x[1]);
  D.opts = shuffle([t, ...shuffle(near).slice(0, 3)]);
  const c = catOf(D.cat);
  overlay.innerHTML = `<div class="sess">${sessTop(D.pos, D.qs.length)}<div class="sess-body">
    <span class="kicker">${L(c.zh, c.en)}</span><p class="q">${c.id === 'hear' ? L('病人講咩？聽完揀意思', 'What is the patient saying? Listen and pick') : L('聽普通話，揀返意思', 'Listen to the Putonghua and pick the meaning')}</p>
    <button class="bigplay" data-a="say" data-i="${t.i}" data-k="pth" aria-label="${L('再聽', 'Play again')}">${IC.spk}</button>
    <div class="mini"><button class="pill" data-a="say" data-i="${t.i}" data-k="pth" data-slow="1">${L('慢速再聽', 'Play slowly')}</button></div>
    <div class="opts">${D.opts.map(o => `<button class="opt" data-a="opt" data-i="${o.i}"><b lang="zh-HK">${o.c}</b><small>${esc(o.e)}</small></button>`).join('')}</div><div id="fb"></div></div>
    <div class="sess-foot" id="foot"><button class="cta ghost" data-a="dunno">${L('唔識，睇答案', "I don't know. Show me")}</button></div></div>`;
  overlay.scrollTop = 0; speak(t, 'pth');
}
function drillAnswer(i) {
  if (D.answered) return; D.answered = true;
  const t = D.qs[D.pos], ok = i === t.i, r = S.it[t.i] || (S.it[t.i] = [0, 0, 0]);
  if (ok) { r[0]++; r[2] = 0; D.ok++; bump(); } else { r[1]++; r[2] = 1; D.miss.push(t); }
  save(); if (i !== null) tone(ok);
  overlay.querySelectorAll('.opt').forEach(b => { const bi = +b.dataset.i; b.classList.add(bi === t.i ? 'right' : bi === i ? 'wrong' : 'heard'); b.setAttribute('aria-label', L('播放', 'Play') + ' ' + b.textContent); });
  $('#fb').innerHTML = `<div class="fb ${ok ? 'good' : 'bad'}">${ok ? L('啱晒！', 'Correct!') : i === null ? L('答案係：', 'The answer is:') : L('今次唔啱，答案係：', 'Not this time. The answer is:')}</div>${pair(t)}
    <p class="note">${L('撳上面任何一個選項，聽吓佢嘅普通話，比較一下。', 'Tap any option above to hear how it sounds in Putonghua, and compare.')}</p>`;
  $('#foot').innerHTML = `<button class="cta" data-a="dnext">${L('繼續', 'Continue')}</button>`;
  if (!ok) speak(t, 'pth');
  overlay.scrollTo({ top: overlay.scrollHeight, behavior: 'smooth' });
}
function drillNext() {
  stopSpeech(); D.pos++;
  if (D.pos < D.qs.length) return renderDrill();
  const c = catOf(D.cat), tot = D.pool.length, k = knownIn(D.cat);
  overlay.innerHTML = `<div class="sess"><div class="sess-body done"><div class="burst">${IC.check}</div>
    <p class="q">${L(`${D.qs.length} 題答啱 ${D.ok} 題`, `${D.ok} of ${D.qs.length} correct`)}</p>
    <div class="sec full"><div class="sec-h"><h2>${L(c.zh, c.en)}</h2><span>${L(`已掌握 ${k}/${tot}`, `${k}/${tot} known`)}</span></div><div class="bar tall"><i style="width:${k / tot * 100}%"></i></div></div>
    ${D.miss.length ? `<div class="sec full"><h2>${L('呢幾個再聽多次', 'Listen to these once more')}</h2>${D.miss.map(t => `<p class="en">${esc(t.e)} · <span lang="zh-HK">${t.c}</span></p>${sidePth(t)}`).join('')}<p class="note">${L('答錯嘅下一round會再出。', 'Missed items come back first in the next round.')}</p></div>` : ''}</div>
    <div class="sess-foot"><button class="cta ghost" data-a="drill" data-k="${D.cat}">${L('再嚟十題', 'Ten more')}</button><button class="cta" data-a="close">${L('完成', 'Done')}</button></div></div>`;
  tone(true);
}

/* ---------- Sound-alikes: pairs that differ by one sound, found automatically across the whole list ---------- */
const TRAPG = { r: ['捲舌同平舌 zh ch sh', 'zh ch sh against z c s j q x'], v: ['韻母', 'Vowels and endings'], c: ['聲母', 'Opening consonants'], t: ['聲調', 'Tones'] };
const INIT = ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'];
const splitSyl = s => { const i = INIT.find(x => s.startsWith(x)) || ''; return [i, s.slice(i.length)]; };
let PAIRS = null;
function buildPairs() {
  if (PAIRS) return PAIRS;
  PAIRS = []; const W = TERMS.filter(t => catOf(t.k).g !== 'i' && t.syl.length <= 4 && !/[A-Z]/.test(t.p));
  for (let a = 0; a < W.length; a++) for (let b = a + 1; b < W.length; b++) {
    const A = W[a], B = W[b]; if (A.syl.length !== B.syl.length || A.s === B.s || A.e === B.e) continue;
    let d = -1, n = 0; for (let k = 0; k < A.syl.length; k++) if (A.syl[k] !== B.syl[k]) { d = k; n++; }
    if (n !== 1) continue;
    const x = A.ps[d], y = B.ps[d]; let g;
    if (x === y) g = 't';
    else { const [xi, xf] = splitSyl(x), [yi, yf] = splitSyl(y); if ((xi !== yi && xf !== yf) || sylDist(x, y) > 0.5) continue; g = xf !== yf ? 'v' : /^(zh|ch|sh|z|c|s|r|j|q|x)$/.test(xi) || /^(zh|ch|sh|z|c|s|r|j|q|x)$/.test(yi) ? 'r' : 'c'; }
    PAIRS.push({ g, a: A, b: B });
  }
  return PAIRS;
}
const VOW = ['āáǎà', 'ēéěè', 'īíǐì', 'ōóǒò', 'ūúǔù', 'ǖǘǚǜ'];
function retone(s, n) { for (const set of VOW) for (const ch of set) if (s.includes(ch)) return s.replace(ch, set[n - 1]); return s; }
function contour(p) {
  const syl = p.split(' ');
  return `<svg viewBox="0 0 ${syl.length * 40} 40" aria-hidden="true">${syl.map((s, n) => { const x = n * 40, t = toneOf(s);
    const d = [null, `M${x + 6} 9H${x + 34}`, `M${x + 6} 28L${x + 34} 8`, `M${x + 6} 14Q${x + 19} 44 ${x + 34} 14`, `M${x + 6} 6L${x + 34} 32`][t];
    return d ? `<path d="${d}" fill="none" stroke="var(--t${t})" stroke-width="4" stroke-linecap="round"/>` : `<circle cx="${x + 20}" cy="24" r="4" fill="var(--t0)"/>`; }).join('')}</svg>`;
}
const trapAcc = g => { const r = S.trap[g]; return r && r[1] ? r[0] / r[1] : null; };
function weakPanel() {
  const rows = Object.keys(TRAPG).filter(g => trapAcc(g) !== null);
  if (!rows.length) return '';
  return `<div class="weak"><h3>${L('你嘅弱點音', 'Your weak sounds')}</h3>${rows.sort((a, b) => trapAcc(a) - trapAcc(b)).map(g => { const a = Math.round(trapAcc(g) * 100); return `<div class="wrow"><span>${L(...TRAPG[g])}</span><div class="bar ${a < 75 ? 'lo' : ''}"><i style="width:${a}%"></i></div><span>${a}%</span></div>`; }).join('')}</div>`;
}
let Z = null;
function startTrap() {
  const pool = shuffle(buildPairs().slice()).map(p => { const flip = Math.random() < .5, t = flip ? p.b : p.a, o = flip ? p.a : p.b; return { g: p.g, t, opts: shuffle([{ p: t.p, it: t, ok: true }, { p: o.p, it: o }]) }; });
  shuffle(TERMS.filter(t => catOf(t.k).g !== 'i' && t.syl.length >= 2 && t.syl.length <= 3 && !/[A-Z]/.test(t.p))).slice(0, 14).forEach(t => {
    const idx = shuffle(t.syl.map((s, n) => toneOf(s) ? n : -1).filter(n => n >= 0))[0]; if (idx === undefined) return;
    const alt = shuffle({ 1: [2, 4], 2: [3, 1], 3: [2, 4], 4: [1, 3] }[toneOf(t.syl[idx])])[0], w = t.syl.slice(); w[idx] = retone(w[idx], alt);
    pool.push({ g: 't', t, opts: shuffle([{ p: t.p, it: t, ok: true }, { p: w.join(' '), it: t, fake: true }]) });
  });
  const byG = {}; pool.forEach(q => (byG[q.g] = byG[q.g] || []).push(q));
  const order = Object.keys(byG).sort((a, b) => (trapAcc(a) === null ? .5 : trapAcc(a)) - (trapAcc(b) === null ? .5 : trapAcc(b)));
  const qs = []; const quota = [4, 3, 2, 1];   // weakest sound type gets the most questions
  order.forEach((g, n) => qs.push(...byG[g].slice(0, quota[n] || 1)));
  for (const q of pool) { if (qs.length >= 10) break; if (!qs.includes(q)) qs.push(q); }
  const keys = [...new Set(qs.slice(0, 10).flatMap(q => q.opts.map(o => 'p-' + o.it.k)))];
  withAudio(keys, () => { Z = { qs: shuffle(qs.slice(0, 10)), pos: 0, ok: 0, answered: false }; renderTrap(); });
}
function renderTrap() {
  const q = Z.qs[Z.pos]; Z.answered = false;
  overlay.innerHTML = `<div class="sess">${sessTop(Z.pos, Z.qs.length)}<div class="sess-body">
    <span class="kicker">${L('易混音', 'SOUND-ALIKES')} · ${L(...TRAPG[q.g])}</span><p class="q">${q.opts[0].it === q.opts[1].it ? L('聽聲調，邊個拼音啱？', 'Listen to the tones. Which pinyin is right?') : L('你聽到邊個？', 'Which one did you hear?')}</p>
    <button class="bigplay" data-a="say" data-i="${q.t.i}" data-k="pth" aria-label="${L('再聽', 'Play again')}">${IC.spk}</button>
    <div class="mini"><button class="pill" data-a="say" data-i="${q.t.i}" data-k="pth" data-slow="1">${L('慢速再聽', 'Play slowly')}</button></div>
    <div class="duo">${q.opts.map((o, n) => `<button class="trapc" data-a="topt" data-n="${n}"><span class="hz ${sc()}" lang="zh-CN">${hanzi(o.it)}</span><span class="rom">${pinyinHTML(o.p)}</span>${contour(o.p)}<span class="en">${q.opts[0].it === q.opts[1].it ? '&nbsp;' : `<span lang="zh-HK">${o.it.c}</span> · ${esc(o.it.e)}`}</span></button>`).join('')}</div>
    <div id="fb"></div></div><div class="sess-foot" id="foot"></div></div>`;
  overlay.scrollTop = 0; speak(q.t, 'pth');
}
function trapAnswer(n) {
  const q = Z.qs[Z.pos], o = q.opts[n];
  if (Z.answered) { if (!o.fake) speak(o.it, 'pth'); return; }
  Z.answered = true; const ok = !!o.ok;
  const r = S.trap[q.g] || (S.trap[q.g] = [0, 0]); r[1]++; if (ok) { r[0]++; Z.ok++; bump(); }
  save(); tone(ok);
  overlay.querySelectorAll('.trapc').forEach((b, m) => b.classList.add(q.opts[m].ok ? 'right' : m === n ? 'wrong' : 'heard'));
  const A = q.opts[0].p.split(' '), B = q.opts[1].p.split(' '), d = A.findIndex((s, m) => s !== B[m]);
  $('#fb').innerHTML = `<div class="fb ${ok ? 'good' : 'bad'}">${ok ? L('啱晒！', 'Correct!') : L('今次聽錯咗。', 'Not this time.')}</div>
    <p class="tip">${d >= 0 ? L('分別喺呢度：', 'The difference is here: ') + `<b>${pinyinHTML(A[d])}</b> ≠ <b>${pinyinHTML(B[d] || '')}</b>. ` : ''}${q.opts[0].it === q.opts[1].it ? L('再聽一次，跟住條音高線。', 'Play it again and follow the pitch line.') : L('撳兩張卡輪流聽，比較一下。', 'Tap each card to hear them side by side.')}</p>`;
  $('#foot').innerHTML = `<button class="cta" data-a="tnext">${L('繼續', 'Continue')}</button>`;
  overlay.scrollTo({ top: overlay.scrollHeight, behavior: 'smooth' });
}
function trapNext() {
  stopSpeech(); Z.pos++;
  if (Z.pos < Z.qs.length) return renderTrap();
  overlay.innerHTML = `<div class="sess"><div class="sess-body done"><div class="burst">${IC.check}</div><p class="q">${L(`${Z.qs.length} 題答啱 ${Z.ok} 題`, `${Z.ok} of ${Z.qs.length} correct`)}</p>${weakPanel()}
    <p class="note">${L('弱嘅音之後會出多啲。', 'Sounds you miss will come up more often next time.')}</p></div>
    <div class="sess-foot"><button class="cta ghost" data-a="trap">${L('再嚟十題', 'Ten more')}</button><button class="cta" data-a="close">${L('完成', 'Done')}</button></div></div>`;
  tone(true);
}

/* ---------- Conversations ---------- */
const ln = s => TERMS.find(t => (t.k === 'say' || t.k === 'hear') && t.s === s);
const SCEN = [
  ['分流站', 'Triage', '一位病人行埋嚟分流站', 'A patient walks up to the triage desk', 'n你好，我是护士|p我很不舒服|n哪里不舒服？|p我这里很疼|n从零到十分，有多疼？|p八分|n医生马上就来'],
  ['心口痛', 'Chest pain', '六十幾歲嘅伯伯揸住心口', 'A man in his sixties is holding his chest', 'p我胸口很闷|n什么时候开始的？|p今天早上开始的|p我喘不过气|n放松，深呼吸|n我帮你量血压'],
  ['問病歷', 'Taking a history', '新症入院，你要問基本資料', 'A new admission. You need the basics', 'n有没有慢性病？|p我有高血压和糖尿病|n平时吃什么药？|p我每天吃降压药|n有没有药物过敏？|p我对青霉素过敏'],
  ['抽血', 'Taking blood', '朝早抽血，病人有啲緊張', 'Morning bloods, and the patient is nervous', 'n我要给你抽血|p会疼吗？|n会有一点疼|n请握紧拳头|p我头很晕|n请躺下'],
  ['手術前', 'Before surgery', '聽朝做手術，今晚交代禁食', 'Surgery is tomorrow morning. Explain fasting tonight', 'n今晚十二点以后不要吃东西喝水|p我可以吃东西吗？|n现在不可以，要禁食|p手术要多久？|n大概两个小时'],
  ['派藥', 'Medication round', '派新藥畀病人', 'You are giving a new medicine', 'n这个药一天吃三次|p这个药有没有副作用？|n可能会头晕|p我想吐|n医生马上就来'],
  ['夜更', 'Night shift', '凌晨三點，病人㩒鐘', 'Three in the morning. The call bell rings', 'p我整晚睡不着|n哪里不舒服？|p我发烧了|n我帮你量体温|p我想喝水|n有事就按铃'],
  ['聽唔明', 'Language barrier', '病人聽唔明廣東話', 'The patient does not follow Cantonese', 'p我听不懂广东话|n明白吗？我说慢一点|n你叫什么名字？|p我叫王明|p可以叫我家人来吗？|n可以，请等一下'],
  ['出院', 'Discharge', '病人問幾時可以走', 'The patient asks when they can leave', 'p我什么时候可以出院？|n明天可以出院|p要付多少钱？|n请到一楼缴费|n下星期回来复诊|p谢谢你'],
  ['去廁所', 'Help to the toilet', '行得唔穩嘅婆婆要去廁所', 'An unsteady elderly lady needs the toilet', 'p我想上厕所|n我扶你去|n慢慢来，小心摔倒|p我头很晕|n请坐下休息|n有事就按铃'],
  ['吊鹽水', 'IV drip trouble', '病人隻手吊緊鹽水', 'A patient on a drip calls you over', 'p打点滴的手肿了|n请把手伸出来|p打针的地方很疼|n我给你换药|n忍一下，马上就好|n做好了'],
  ['傷口痛', 'Wound pain', '手術後第一晚', 'The first night after surgery', 'p我伤口很疼|n请指给我看哪里疼|n从零到十分，有多疼？|p八分|p我想要止痛药|n我给你打针|n会有一点疼'],
  ['登記', 'Registration', '新病人嚟到登記處', 'A new patient arrives at registration', 'n请问您贵姓？|p我叫王明|n请出示您的证件|p我没带身份证|n有没有药物过敏？|p我没有药物过敏|n请在外面等'],
  ['肚痛', 'Stomach upset', '後生仔揸住個肚入嚟', 'A young man comes in holding his stomach', 'p我肚子疼|n什么时候开始的？|p今天早上开始的|n有没有呕吐？|p我拉肚子|n你吃东西了吗？|p我吃不下|n要多喝水'],
  ['出院藥物', 'Going home with medicines', '出院前解釋點食藥', 'Explaining medicines before discharge', 'p这个药怎么吃？|n这个药饭后吃|p这些药要吃多久？|n不要自己停药|p要不要忌口？|n不要吃生冷的东西|n记得回来复诊'],
  ['照X光', 'X-ray', '醫生安排病人照肺', 'The doctor has ordered a chest X-ray', 'n你需要拍X光|p严重吗？|n不用担心|n请脱衣服|n吸气，呼气|n做好了|p报告出来了吗？|n报告明天才出来'],
  ['防跌', 'Fall risk', '病人想自己落床', 'A patient tries to get up alone', 'p我想起来|n不要下床|n下床要叫我们|p我要小便|n我扶你起来|n慢慢来，小心摔倒'],
  ['好凍', 'Feeling cold', '病人話病房好凍', 'A patient complains the ward is cold', 'p空调太冷了|p可以给我一条被子吗？|n可以，请等一下|p我很冷|n我帮你量体温|n有没有咳嗽？|p我咳得很厉害'],
  ['手術同意', 'Consent for surgery', '病人要做手術，好擔心', 'A worried patient needs an operation', 'n你需要做手术|p手术有没有风险？|n医生会跟你解释|p我很害怕|n不用担心|n请在这里签字|p我什么时候做手术？'],
  ['搵傳譯', 'Finding an interpreter', '你同病人都聽唔明對方', 'Neither of you can follow the other', 'p可以说慢一点吗？|n我没听懂，请再说一遍|p我不明白|n你会写字吗？请写下来|n我帮你找翻译|p谢谢你，护士'],
].map(([zh, en, szh, sen, tr]) => ({ zh, en, szh, sen, turns: tr.split('|').map(x => ({ who: x[0], t: ln(x.slice(1)), raw: x })) }));
window.__scenMissing = SCEN.flatMap(s => s.turns.filter(x => !x.t).map(x => x.raw));
const SCENOK = SCEN.filter(s => s.turns.every(x => x.t));
const NURSE_LINES = TERMS.filter(t => t.k === 'say');
let X = null;
function startScen(n) { withAudio(['p-say', 'p-hear'], () => { X = { n, pos: 0, miss: 0 }; renderScen(); }); }
function bubble(x, full) {
  const t = x.t, me = x.who === 'n';
  return `<div class="bub ${me ? 'me' : 'pt'}"><span class="who">${me ? L('你', 'YOU') : L('病人', 'PATIENT')}<button class="mini-play" data-a="say" data-i="${t.i}" data-k="pth" aria-label="${L('播放', 'Play')}">${IC.spk}</button></span>
    ${full ? `<span class="hz ${sc()}" lang="zh-CN">${hanzi(t)}</span><span class="rom">${pinyinHTML(t.p)}</span><span class="en">${L(t.c, esc(t.e))}</span>` : `<button class="hide" data-a="scenshow">${L('聽唔明？撳呢度睇文字', 'Did not catch it? Tap to show the words')}</button>`}</div>`;
}
function renderScen() {
  const s = SCENOK[X.n], x = s.turns[X.pos]; X.answered = false;
  let cur = '', foot = '';
  if (x.who === 'p') { cur = bubble(x, X.shown); foot = `<button class="cta" data-a="snext">${L('明白，繼續', 'Understood, continue')}</button>`; }
  else {
    X.opts = X.opts || shuffle([x.t, ...shuffle(NURSE_LINES.filter(t => !s.turns.some(y => y.t === t))).slice(0, 2)]);
    cur = `<p class="q">${L('你應該點講？', 'What do you say?')}</p><div class="opts">${X.opts.map(t => `<button class="opt" data-a="sopt" data-i="${t.i}"><b class="${sc()}" lang="zh-CN">${hanzi(t)}</b><small>${pinyinHTML(t.p)}</small></button>`).join('')}</div><div id="fb"></div>`;
  }
  overlay.innerHTML = `<div class="sess">${sessTop(X.pos, s.turns.length)}<div class="sess-body"><span class="kicker">${L('對話', 'CONVERSATION')} · ${L(s.zh, s.en)}</span><p class="note">${L(s.szh, s.sen)}</p>
    <div class="chat">${s.turns.slice(0, X.pos).map(y => bubble(y, true)).join('')}${x.who === 'p' ? cur : ''}</div>${x.who === 'n' ? cur : ''}</div><div class="sess-foot" id="foot">${foot}</div></div>`;
  overlay.scrollTop = overlay.scrollHeight;
  if (x.who === 'p' && !X.shown) speak(x.t, 'pth');
}
function scenAnswer(i) {
  if (X.answered) return; X.answered = true;
  const x = SCENOK[X.n].turns[X.pos], ok = i === x.t.i;
  if (ok) bump(); else X.miss++;
  save(); tone(ok);
  overlay.querySelectorAll('.opt').forEach(b => { b.disabled = true; const bi = +b.dataset.i; if (bi === x.t.i) b.classList.add('right'); else if (bi === i) b.classList.add('wrong'); });
  $('#fb').innerHTML = `<div class="fb ${ok ? 'good' : 'bad'}">${ok ? L('啱！跟住大聲講一次。', 'Right. Now say it aloud.') : L('呢度應該講：', 'The fitting reply is: ') + `<span lang="zh-HK">${x.t.c}</span>`}</div>`;
  $('#foot').innerHTML = `<button class="cta" data-a="snext">${L('繼續', 'Continue')}</button>`;
  speak(x.t, 'pth'); overlay.scrollTo({ top: overlay.scrollHeight, behavior: 'smooth' });
}
function scenNext() {
  stopSpeech(); const s = SCENOK[X.n]; X.pos++; X.shown = false; X.opts = null;
  if (X.pos < s.turns.length) return renderScen();
  const stars = Math.max(1, 3 - X.miss); S.scen[X.n] = Math.max(S.scen[X.n] || 0, stars); save();
  const nxt = SCENOK.findIndex((_, n) => S.scen[n] == null);
  overlay.innerHTML = `<div class="sess"><div class="sess-body done"><div class="burst">${IC.check}</div><p class="q">${L(s.zh, s.en)} ${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
    <p class="note">${X.miss ? L(`答錯 ${X.miss} 次。再做一次攞三粒星。`, `${X.miss} wrong ${X.miss === 1 ? 'reply' : 'replies'}. Run it again for three stars.`) : L('全部答啱，成段對話你都應付到。', 'Every reply right. You can handle this whole exchange.')}</p>
    <div class="chat full">${s.turns.map(y => bubble(y, true)).join('')}</div></div>
    <div class="sess-foot">${nxt >= 0 ? `<button class="cta ghost" data-a="scen" data-n="${nxt}">${L('下一個對話', 'Next conversation')}</button>` : `<button class="cta ghost" data-a="scen" data-n="${X.n}">${L('再做一次', 'Run it again')}</button>`}<button class="cta" data-a="close">${L('完成', 'Done')}</button></div></div>`;
  tone(true);
}

/* ---------- select, then check ---------- */
function choose(el) {
  el.parentElement.querySelectorAll('.sel').forEach(b => { b.classList.remove('sel'); b.setAttribute('aria-pressed', 'false'); });
  el.classList.add('sel'); el.setAttribute('aria-pressed', 'true');
  if (!$('#foot .cta[data-a=check]')) $('#foot').innerHTML = `<button class="cta" data-a="check">${L('檢查答案', 'Check')}</button>`;
}
function check() {
  const el = overlay.querySelector('.sel'); if (!el) return;
  el.classList.remove('sel'); el.removeAttribute('aria-pressed');
  ({ opt: () => drillAnswer(+el.dataset.i), topt: () => trapAnswer(+el.dataset.n), sopt: () => scenAnswer(+el.dataset.i) })[el.dataset.a]();
}

/* ---------- screens ---------- */
function renderListen() {
  const g = S.grp, total = TERMS.length, k = TERMS.filter(known).length, td = S.day[today()] || 0;
  const seg = `<div class="seg4" role="tablist">${GROUPS.map(([id, zh, en]) => `<button role="tab" data-a="grp" data-k="${id}" aria-selected="${g === id}">${L(zh, en)}</button>`).join('')}</div>`;
  let body;
  if (g === 'x') {
    const n = buildPairs().length;
    body = `<button class="cta" data-a="trap">${L('開始 10 題', 'Start 10 questions')}<small>${L(`由成個詞庫搵出 ${n} 對易混音`, `${n} sound-alike pairs found across the whole list`)}</small></button>
      <p class="note">${L('聽一個詞，喺兩個讀音差一啲嘅詞之間揀，例如抽血同出血。亦會考聲調。', 'Hear one term and choose between two that sound almost the same, such as 抽血 and 出血. Tones are tested too.')}</p>${weakPanel()}`;
  } else {
    const cs = CATS.filter(c => c.g === g), next = cs.slice().sort((a, b) => knownIn(a.id) / inCat(a.id).length - knownIn(b.id) / inCat(b.id).length)[0];
    body = `<button class="cta" data-a="drill" data-k="${next.id}">${L('開始 10 題', 'Start 10 questions')}<small>${L(next.zh, next.en)} · ${L('進度最低嘅主題', 'your least-practised topic')}</small></button>
      <div class="sec"><div class="sec-h"><h2>${L('或者自己揀主題', 'Or choose a topic')}</h2><span>${L('已掌握／總數', 'known / total')}</span></div>
      <div class="cats">${cs.map(c => { const tot = inCat(c.id).length, kn = knownIn(c.id); return `<button class="cat" data-a="drill" data-k="${c.id}"><b>${L(c.zh, c.en)}</b><div class="bar"><i style="width:${kn / tot * 100}%"></i></div><small><span>${L(c.en, c.zh)}</span><span>${kn}/${tot}</span></small></button>`; }).join('')}</div></div>`;
  }
  view.innerHTML = `<div class="strip"><div><b>${td}</b><span>${L('今日答啱', 'correct today')}</span></div><div><b>${k}<i>/${total}</i></b><span>${L('已掌握', 'known')}</span></div></div>${seg}${body}`;
}
function renderTalk() {
  const done = Object.keys(S.scen).length;
  view.innerHTML = `<div class="sec"><div class="sec-h"><h2>${L('床邊對話', 'Bedside conversations')}</h2><span>${done}/${SCENOK.length}</span></div>
    <p class="note">${L('聽病人講，再揀你應該點答。全部用普通話。', 'Hear the patient, then choose what you should say. All in Putonghua.')}</p>
    ${SCENOK.map((s, n) => `<button class="scen-row" data-a="scen" data-n="${n}"><span><b>${n + 1}. ${L(s.zh, s.en)}</b><small>${L(s.szh, s.sen)}</small></span><span class="st">${S.scen[n] != null ? '★'.repeat(S.scen[n]) + '☆'.repeat(3 - S.scen[n]) : L('未做', 'New')}</span></button>`).join('')}</div>`;
}
let resetArmed = false;
function openSettings() {
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, name]) => `<button data-a="set" data-key="${key}" data-v="${v}" aria-pressed="${String(S[key]) === String(v)}">${name}</button>`).join('')}</div>`;
  const row = (title, sub, ctl) => `<div class="set"><div><b>${title}</b><small>${sub}</small></div>${ctl}</div>`;
  sheet.hidden = false;
  sheet.innerHTML = `<div class="sheet" role="dialog" aria-label="${L('設定', 'Settings')}"><div class="sheet-h"><h2>${L('設定', 'Settings')}</h2><button class="pill" data-a="closesheet">${L('完成', 'Done')}</button></div>
    ${row(L('預設慢速', 'Slow speech by default'), L('啱啱開始學建議開', 'Helpful when you are starting out'), seg('slow', [[false, L('正常', 'Normal')], [true, L('慢', 'Slow')]]))}
    ${row(L('普通話字體', 'Putonghua script'), L('病人多數睇簡體', 'Most mainland patients read Simplified'), seg('script', [['t', '繁體'], ['s', '简体']]))}
    ${row(L('音效同震動', 'Sound effects'), L('答啱答錯嘅提示聲', 'Chimes for right and wrong answers'), seg('sfx', [[true, L('開', 'On')], [false, L('關', 'Off')]]))}
    ${row(L('介面語言', 'App language'), 'Interface language', seg('lang', [['zh', '中文'], ['en', 'English']]))}
    <div class="set block"><b>${L('普通話聲調顏色', 'Putonghua tone colours')}</b><div class="legend"><span class="t1">mā ${L('一聲', '1st')}</span><span class="t2">má ${L('二聲', '2nd')}</span><span class="t3">mǎ ${L('三聲', '3rd')}</span><span class="t4">mà ${L('四聲', '4th')}</span><span class="t0">ma ${L('輕聲', 'neutral')}</span></div></div>
    <p class="note">${L('聲音係內置錄音。聽唔到？請檢查手機靜音掣同媒體音量。進度只儲存喺呢部裝置。內容只供語言學習，唔可以取代專業傳譯。', 'Audio is built-in recordings. No sound? Check the phone\'s silent switch and media volume. Progress is stored on this device only. This is a language-learning aid and does not replace a professional interpreter.')}</p>
    <button class="danger" data-a="reset">${resetArmed ? L('再㩒一次確認：刪除全部進度', 'Tap again to confirm: erase all progress') : L('重設全部進度', 'Reset all progress')}</button></div>`;
}
function render() {
  document.documentElement.lang = S.lang === 'zh' ? 'zh-HK' : 'en';
  $('#tagline').textContent = L(`${TERMS.length} 個醫護用語同句子 · 粵 → 普`, `${TERMS.length} medical terms and phrases`);
  $('#langbtn').textContent = S.lang === 'zh' ? 'EN' : '中文';
  $('#tabs').innerHTML = [['listen', L('聽辨', 'Listen & pick'), IC.ear], ['talk', L('對話', 'Conversations'), IC.chat]].map(([id, name, ic]) => `<button data-a="tab" data-k="${id}" ${tab === id ? 'aria-current="page"' : ''}>${ic}${name}</button>`).join('');
  (tab === 'listen' ? renderListen : renderTalk)();
}
function closeOverlay() { stopSpeech(); D = Z = X = null; overlay.hidden = true; overlay.innerHTML = ''; document.body.style.overflow = ''; render(); }
const ACT = {
  tab: el => { tab = el.dataset.k; render(); window.scrollTo(0, 0); },
  grp: el => { S.grp = el.dataset.k; save(); render(); },
  lang: () => { S.lang = S.lang === 'zh' ? 'en' : 'zh'; save(); render(); },
  settings: () => { resetArmed = false; openSettings(); },
  closesheet: () => { sheet.hidden = true; sheet.innerHTML = ''; render(); },
  set: el => { let v = el.dataset.v; v = v === 'true' ? true : v === 'false' ? false : v; S[el.dataset.key] = v; save(); openSettings(); },
  reset: () => { if (!resetArmed) { resetArmed = true; return openSettings(); } S = Object.assign(JSON.parse(JSON.stringify(DEF)), { lang: S.lang }); save(); resetArmed = false; sheet.hidden = true; render(); },
  close: () => closeOverlay(),
  slowtoggle: el => { S.slow = !S.slow; save(); el.setAttribute('aria-pressed', S.slow); },
  say: el => speak(TERMS[+el.dataset.i], el.dataset.k, { slow: el.dataset.slow ? true : S.slow, times: +(el.dataset.n || 1), btn: el }),
  drill: el => startDrill(el.dataset.k), dnext: () => drillNext(), dunno: () => drillAnswer(null),
  opt: el => { if (D && D.answered) speak(TERMS[+el.dataset.i], 'pth'); else choose(el); },
  trap: () => startTrap(), tnext: () => trapNext(), topt: el => (Z && Z.answered) ? trapAnswer(+el.dataset.n) : choose(el),
  scen: el => startScen(+el.dataset.n), snext: () => scenNext(), sopt: el => { if (X && !X.answered) choose(el); }, scenshow: () => { X.shown = true; renderScen(); },
  check: () => check(),
};
document.addEventListener('click', e => {
  if (e.target === sheet) return ACT.closesheet();
  const el = e.target.closest('[data-a]'); if (el && ACT[el.dataset.a]) ACT[el.dataset.a](el);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (!sheet.hidden) ACT.closesheet(); else if (!overlay.hidden) closeOverlay(); }
  if ((D || Z || X) && /^[1-4]$/.test(e.key)) { const b = overlay.querySelectorAll('.opt, .trapc')[+e.key - 1]; if (b && !b.disabled) b.click(); }
  if ((D || Z || X) && e.key === 'Enter' && document.activeElement.tagName !== 'BUTTON') { const b = overlay.querySelector('#foot .cta:last-child'); if (b) b.click(); }
});
render();
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && document.querySelector('link[rel="manifest"]')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
