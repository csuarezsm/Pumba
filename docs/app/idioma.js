/* Idioma de la app (IT Canarias). © 2026 IT Canarias. Todos los derechos reservados.
   El mismo archivo en todas las apps. Las apps están escritas en español; si se elige otro idioma, este archivo
   traduce lo que se ve en pantalla con el diccionario de i18n-<idioma>.js:
   - textos de la página (y los atributos placeholder, aria-label y title) en cuanto aparecen (MutationObserver);
   - textos con datos dentro (nombres, números): plantillas con {1}, {2}… y, si no, por trozos (« · », «: », prefijos);
   - lo que no es página: compartir (navigator.share, portapapeles, Capacitor Share), imágenes dibujadas (canvas),
     fechas y números (toLocale…).
   El idioma se guarda en localStorage («idioma»). La primera vez se usa el del móvil (español si empieza por «es»).
   Idiomas: español (el original), inglés, francés, alemán e italiano.
   Para añadir un idioma: un i18n-<código>.js con window.I18N['<código>'] = { 'texto en español': 'traducción', … } y su nombre en IDIOMAS. */
(function (root) {
'use strict';
const IDIOMAS = { es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano' };
const CLAVE = 'idioma';
function detectar() {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return 'es';      // pruebas automáticas: siempre en español
  const l = String((navigator.languages && navigator.languages[0]) || navigator.language || 'es').slice(0, 2).toLowerCase();
  return IDIOMAS[l] ? l : 'en';
}
let lang = 'es';
try { lang = localStorage.getItem(CLAVE) || detectar(); if (!IDIOMAS[lang]) lang = 'es'; localStorage.setItem(CLAVE, lang); } catch (e) {}

const DIC = (root.I18N && root.I18N[lang]) || {};
const EXTRA = (root.I18N && root.I18N[lang + ':' + (root.APP_ID || '')]) || {};   // cambios para una app concreta
const MAPA = new Map(), PATRONES = [];
const norm = s => String(s).replace(/\s+/g, ' ').trim();
const escRe = s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
function cargar(d) {
  for (const k in d) {
    const t = d[k], kk = norm(k);
    if (/\{\d+\}/.test(kk)) {
      const letras = kk.replace(/\{\d+\}/g, '').replace(/[^A-Za-zÁÉÍÓÚáéíóúñÑüÜ]/g, '');
      if (letras.length < 4) continue;                          // demasiado genérico para usarlo como plantilla
      const nums = []; const re = '^' + escRe(kk).replace(/\\?\{(\d+)\\?\}/g, (_, n) => { nums.push(n); return '(.*?)'; }) + '$';
      try { const i = PATRONES.findIndex(p => p[4] === kk); const p = [new RegExp(re), t, nums, /\. /.test(kk), kk]; if (i >= 0) PATRONES[i] = p; else PATRONES.push(p); } catch (e) {}   // la versión de la app manda sobre la común
    } else MAPA.set(kk, t);
  }
}
if (lang !== 'es') { cargar(DIC); cargar(EXTRA); }
// las plantillas más concretas primero («… Sale Tú.» antes que «… Sale {2}.»)
const letras = re => String(re[0].source).replace(/\(\.\*\?\)/g, '').replace(/[^A-Za-zÁÉÍÓÚáéíóúñÑ]/g, '').length;
PATRONES.sort((a, b) => letras(b) - letras(a));
const MEMO = new Map();
// Traduce un texto (ya normalizado). Devuelve null si no sabe.
function tr(s) {
  if (lang === 'es' || !s) return null;
  if (MEMO.has(s)) return MEMO.get(s);
  let r = trSin(s, 0);
  if (MEMO.size > 5000) MEMO.clear();
  MEMO.set(s, r);
  return r;
}
const otra = (s, d) => { const t = trSin(norm(s), d + 1); return t == null ? s : t; };
function trSin(s, d) {
  if (!s || d > 6) return null;
  if (MAPA.has(s)) return MAPA.get(s);
  if (!/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(s)) return null;
  const c = carta(s); if (c) return c;
  for (const [re, t, nums, frases] of PATRONES) {
    const m = re.exec(s);
    if (m && !frases && m.slice(1).some(g => g && g.includes('. '))) continue;   // una plantilla de una frase no se traga la siguiente
    if (m) return t.replace(/\{(\d+)\}/g, (_, n) => { const i = nums.indexOf(n); const g = i >= 0 ? m[i + 1] : ''; return g ? otra(g, d) : ''; });
  }
  // un símbolo delante (📖, 🏆, •…): se traduce el resto
  { const w0 = s.split(' '); if (w0.length > 1 && !/[A-Za-zÁÉÍÓÚáéíóúñÑ0-9]/.test(w0[0])) { const t = trSin(w0.slice(1).join(' '), d + 1); if (t != null) return w0[0] + ' ' + t; } }
  // por trozos: «A · B», «A: B», «A — B»
  for (const sep of [' · ', ' — ', ' – ', ': ', ' | ', ' / ', '. ', ', ']) {   // también frases encadenadas («A juega X. B roba 2») y listas
    if (!s.includes(sep)) continue;
    const ps = s.split(sep), ts = ps.map(p => { const t = trSin(norm(p), d + 1); return t == null ? p : t; });
    if (ts.some((t, i) => t !== ps[i])) return ts.join(sep);
  }
  const w = s.split(' ');
  // el principio es un texto conocido («😔 Gana Carlos», «Juegan blancas»…)
  for (let i = w.length - 1; i >= 1; i--) {
    const a = w.slice(0, i).join(' ');
    if (MAPA.has(a)) { const b = w.slice(i).join(' '); return MAPA.get(a) + ' ' + otra(b, d); }
  }
  // el final es un texto conocido («Carlos (blancas)»)
  for (let i = 1; i < w.length; i++) {
    const b = w.slice(i).join(' ');
    if (MAPA.has(b)) return w.slice(0, i).join(' ') + ' ' + MAPA.get(b);
  }
  return null;
}
// Cartas de la baraja española: «el 7 de oros», «la sota de copas»
const PALOS = { en: { oros: 'Coins', copas: 'Cups', espadas: 'Swords', bastos: 'Clubs' }, fr: { oros: 'deniers', copas: 'coupes', espadas: 'épées', bastos: 'bâtons' },
  de: { oros: 'Münzen', copas: 'Kelche', espadas: 'Schwerter', bastos: 'Stäbe' }, it: { oros: 'denari', copas: 'coppe', espadas: 'spade', bastos: 'bastoni' } };
const FIG = { en: { as: 'Ace', '1': 'Ace', sota: 'Jack', '10': 'Jack', caballo: 'Knight', '11': 'Knight', rey: 'King', '12': 'King' },
  fr: { as: 'as', '1': 'as', sota: 'valet', '10': 'valet', caballo: 'cavalier', '11': 'cavalier', rey: 'roi', '12': 'roi' },
  de: { as: 'Ass', '1': 'Ass', sota: 'Bube', '10': 'Bube', caballo: 'Reiter', '11': 'Reiter', rey: 'König', '12': 'König' },
  it: { as: 'asso', '1': 'asso', sota: 'fante', '10': 'fante', caballo: 'cavallo', '11': 'cavallo', rey: 're', '12': 're' } };
// «el 7 de oros» en cada idioma
const CARTA = { en: (a, f, p) => (a ? 'the ' : '') + f + ' of ' + p, fr: (a, f, p) => (a ? (/^[aeiou]/i.test(f) ? "l'" : 'le ') : '') + f + ' de ' + p,
  de: (a, f, p) => p + '-' + f, it: (a, f, p) => (a ? (/^[aeiou]/i.test(f) ? "l'" : f === 're' ? 'il ' : 'il ') : '') + f + ' di ' + p };
function carta(s) {
  const m = /^(el |la )?(as|[1-9]|1[0-2]|sota|caballo|rey) de (oros|copas|espadas|bastos)([.,!:;]?)$/i.exec(s);
  if (!m || !PALOS[lang]) return null;
  const r = m[2].toLowerCase(), f = FIG[lang][r] || r;
  return CARTA[lang](!!m[1], f, PALOS[lang][m[3].toLowerCase()]) + m[4];
}
// Para textos con varias líneas (mensajes para compartir)
function trTexto(txt) {
  if (lang === 'es' || txt == null) return txt;
  return String(txt).split('\n').map(l => { const n = norm(l); if (!n) return l; const t = tr(n); return t == null ? l : l.match(/^\s*/)[0] + t + l.match(/\s*$/)[0]; }).join('\n');
}

/* ---------- La página ---------- */
const HECHO = new WeakMap();
const FALTAN = new Set();
const pareceEsp = s => /[áéíóúñ¿¡]|\b(de|la|el|los|las|una?|que|para|con|por|sin|partida|jugada|turno|juega|mano|puntos|toca)\b/i.test(s);
function texto(n) {
  const v = n.nodeValue;
  if (!v || HECHO.get(n) === v || !/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(v)) return;
  const p = n.parentNode; if (p && /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) return;
  const s = norm(v), t = tr(s);
  if (t != null && t !== s) { const nv = v.match(/^\s*/)[0] + t + v.match(/\s*$/)[0]; HECHO.set(n, nv); n.nodeValue = nv; }
  else { HECHO.set(n, v); if (t == null && pareceEsp(s) && FALTAN.size < 2000) FALTAN.add(s); }
}
const ATRS = ['placeholder', 'aria-label', 'title'];
function atributos(el) {
  for (const a of ATRS) {
    const v = el.getAttribute && el.getAttribute(a); if (!v) continue;
    const t = tr(norm(v)); if (t != null && t !== v) el.setAttribute(a, t);
  }
}
function recorrer(raiz) {
  if (!raiz) return;
  if (raiz.nodeType === 3) return texto(raiz);
  if (raiz.nodeType !== 1 && raiz.nodeType !== 11) return;
  if (raiz.nodeType === 1) { if (/^(SCRIPT|STYLE)$/.test(raiz.nodeName)) return; atributos(raiz); }
  const tw = document.createTreeWalker(raiz, 5 /* elementos y textos */);
  let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) texto(n); else atributos(n); }
}
function vigilar() {
  if (lang === 'es' || typeof MutationObserver === 'undefined') return;
  document.documentElement.lang = lang;
  recorrer(document.body || document.documentElement);
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') texto(m.target);
      else if (m.type === 'attributes') atributos(m.target);
      else m.addedNodes.forEach(recorrer);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRS });
}

/* ---------- Fuera de la página ---------- */
function parches() {
  if (lang === 'es') return;
  const loc = l => (typeof l === 'string' && /^es/i.test(l)) || l === undefined ? (lang === 'en' ? 'en-GB' : lang) : l;
  for (const [P, fs] of [[Date.prototype, ['toLocaleDateString', 'toLocaleTimeString', 'toLocaleString']], [Number.prototype, ['toLocaleString']]]) {
    for (const f of fs) { const o = P[f]; P[f] = function (l, opt) { return o.call(this, loc(l), opt); }; }
  }
  if (typeof CanvasRenderingContext2D !== 'undefined') {
    const ft = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { const r = tr(norm(t)); return ft.call(this, r == null ? t : r, ...a); };
    const mt = CanvasRenderingContext2D.prototype.measureText;
    CanvasRenderingContext2D.prototype.measureText = function (t) { const r = tr(norm(t)); return mt.call(this, r == null ? t : r); };
  }
  const envolver = (obj, f) => { if (!obj || typeof obj[f] !== 'function' || obj[f].__i18n) return; const o = obj[f]; const w = function (d, ...a) { if (typeof d === 'string') d = trTexto(d); else if (d && typeof d === 'object') { d = Object.assign({}, d); for (const k of ['text', 'title', 'dialogTitle']) if (typeof d[k] === 'string') d[k] = trTexto(d[k]); } return o.call(this, d, ...a); }; w.__i18n = true; obj[f] = w; };
  envolver(navigator, 'share');
  if (navigator.clipboard) envolver(navigator.clipboard, 'writeText');
  const cap = () => { try { envolver(root.Capacitor.Plugins.Share, 'share'); } catch (e) {} };
  cap(); setTimeout(cap, 0); setTimeout(cap, 1500);
  // ajedrez: notación con letras inglesas (K, Q, R, B, N)
  if (root.Ajedrez && root.Ajedrez.sanEs) root.Ajedrez.sanEs = s => String(s);
}

/* ---------- Elegir idioma (menú) ---------- */
function elegir() {
  openModal(`<h3>🌐 Idioma · Language</h3><div class="menu">${Object.entries(IDIOMAS).map(([k, n]) => `<button data-lang="${k}" class="${k === lang ? 'btn-gold' : ''}">${k === lang ? '✓ ' : ''}${n}</button>`).join('')}</div>
    <div class="acts"><button class="btn-ghost" id="lgX">${{ es: 'Cerrar', en: 'Close', fr: 'Fermer', de: 'Schließen', it: 'Chiudi' }[lang] || 'Close'}</button></div>`);
  document.getElementById('lgX').onclick = closeModal;
  document.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => {
    const l = b.dataset.lang; if (l === lang) { closeModal(); return; }
    try { localStorage.setItem(CLAVE, l); } catch (e) {}
    location.reload();
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { parches(); vigilar(); });
  else { parches(); vigilar(); }
}
root.Idioma = { lang: () => lang, tr: s => { const t = tr(norm(s)); return t == null ? s : t; }, trTexto, elegir, faltan: () => [...FALTAN], IDIOMAS };
})(typeof self !== 'undefined' ? self : globalThis);
