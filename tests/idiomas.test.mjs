// Idiomas: recorre la app en inglés, francés, alemán e italiano (bienvenida, menú ⋮ con todas sus pantallas y una partida
// jugada a toques al azar) y comprueba que no queda ningún texto en español. Común a todos los juegos de IT Canarias.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../www/', import.meta.url));
const MONO = +(process.env.IDIOMAS_MS || 30000);
// nombres propios que no se traducen (jugadores de la máquina, lugares…)
const PROPIOS = ['Pancho', 'Chano', 'Candelaria', 'Tomasa', 'Juanillo', 'Nieves', 'Pepito', 'Carmela', 'Domingo', 'Fefa', 'Agustín', 'Chona', 'Ramón', 'Pino', 'Chicho', 'Luci', 'Martín', 'Español', 'Póker', 'Parchís', 'Chinchón',
  // lugares y personas de Lanzarote (Martín)
  'La Voz de Lanzarote', 'La Geria', 'Los Hervideros', 'El Golfo', 'Charco de los Clicos', 'Laguna de los Clicos', 'Los Volcanes', 'Peñas del Chache', 'Caleta de Famara', 'El Jable', 'Casa del Palmeral',
  'Mirador de los Helechos', 'Mirador del Río', 'Batería del Río', 'Salinas del Río', 'El Río', 'La Graciosa', 'Risco de Famara', 'Andrés Lorenzo Curbelo', 'Maciot de Béthencourt', 'José María Gil', 'El Patio',
  'San Bartolomé', 'Eduardo Cáceres', 'Jesús Soto', 'César Manrique', 'Ruppia maritima', 'Dunaliella salina', 'Los Caminos del Volcán']
  .concat(process.env.IDIOMAS_PROPIOS ? process.env.IDIOMAS_PROPIOS.split('|') : []);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = http.createServer(async (req, res) => {
  const p0 = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, ''), p = p0 === '/' || p0 === '.' ? '/index.html' : p0;
  try { const f = await readFile(join(ROOT, p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(f); } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const URL_APP = `http://localhost:${server.address().port}/`;
let browser;
try { browser = await chromium.launch(); } catch (e) { browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' }); }
let passed = 0, failed = 0;
const check = (n, c, x = '') => { if (c) { passed++; console.log('  ✓ ' + n); } else { failed++; console.log('  ✗ ' + n + (x ? ' → ' + x : '')); if (process.env.GITHUB_ACTIONS) console.log('::error::' + n); } };
const sinPropios = t => PROPIOS.reduce((a, n) => a.split(n).join(' '), t);
const RESTO = /(^|[\s«(¿¡])(de|del|la|las|los|el|que|para|con|una|por|sin|más|y|tu|tus|se)(?=[\s.,:;!?»)]|$)/i;
console.log('Idiomas (sin textos sueltos en español)');
for (const lang of ['en', 'fr', 'de', 'it']) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  const p = await ctx.newPage(); const errores = [];
  p.on('pageerror', e => errores.push(e.message));
  await p.addInitScript(l => { if (!sessionStorage.getItem('sembrado')) { localStorage.clear(); localStorage.setItem('idioma', l); sessionStorage.setItem('sembrado', '1'); } window.alert = () => {}; window.confirm = () => false; window.prompt = () => null; }, lang);
  await p.goto(URL_APP); await p.waitForTimeout(1500);
  const cerrar = () => p.evaluate(() => { try { closeModal(); } catch (e) {} }).catch(() => {});
  const resto = new Set();
  const mira = async () => { if (lang !== 'en' && lang !== 'de') return; (await p.evaluate(() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const t = n.nodeValue.replace(/\s+/g, ' ').trim(); if (t.length > 3 && n.parentElement && n.parentElement.offsetParent !== null) out.push(t); } return out; }).catch(() => [])).forEach(t => { if (RESTO.test(sinPropios(t).replace(lang === 'de' ? /\bLos geht/g : /^$/, ''))) resto.add(t); }); };
  // bienvenida
  for (let i = 0; i < 10; i++) { await mira(); const ok = await p.evaluate(() => { const m = document.getElementById('modal'); if (!m || m.classList.contains('hidden')) return false; const bs = [...m.querySelectorAll('button')].filter(b => b.offsetParent); const bt = bs.find(b => b.classList.contains('btn-gold')) || bs[bs.length - 1]; if (bt) { bt.click(); return true; } return false; }).catch(() => false); if (!ok) break; await p.waitForTimeout(250); }
  await cerrar();
  // todas las opciones del menú ⋮ (menos las que borran, salen o actualizan)
  const ids = await p.evaluate(() => [...document.querySelectorAll('button[id^="m"]')].map(e => e.id).filter(id => /^m[A-Z]/.test(id))).catch(() => []);
  for (const id of ids) {
    if (/Borr|Reset|Wipe|Clear|Delete|Salir|Exit|Quit|Upd|Actualiz/i.test(id)) continue;
    await p.evaluate(() => { const b = document.getElementById('menuBtn'); if (b) b.click(); }).catch(() => {}); await p.waitForTimeout(150);
    await p.evaluate(id => { const e = document.getElementById(id); if (e) e.click(); }, id).catch(() => {}); await p.waitForTimeout(350);
    await p.evaluate(() => { const m = document.getElementById('modal'); if (!m || m.classList.contains('hidden')) return; [...m.querySelectorAll('.tabs button,[data-tab],.kinds button')].slice(0, 8).forEach(b => { try { b.click(); } catch (e) {} }); }).catch(() => {});
    await p.waitForTimeout(200); await mira(); await cerrar(); await p.waitForTimeout(100);
  }
  // una partida a toques al azar (semilla fija)
  for (let k = 0; k < 3; k++) { await p.evaluate(() => { const a = document.getElementById('app'); const bt = a && [...a.querySelectorAll('button.btn-gold')].find(b => b.offsetParent); if (bt) bt.click(); }).catch(() => {}); await p.waitForTimeout(900);
    await p.evaluate(() => { const m = document.getElementById('modal'); if (!m || m.classList.contains('hidden')) return; const bt = [...m.querySelectorAll('button.btn-gold')].find(b => b.offsetParent); if (bt) bt.click(); }).catch(() => {}); await p.waitForTimeout(900); }
  const fin = Date.now() + MONO; let semilla = 7, vuelta = 0;
  while (Date.now() < fin) {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    await p.evaluate(r => { const m = document.getElementById('modal'); const raiz = m && !m.classList.contains('hidden') ? m : document.getElementById('app'); if (!raiz) return;
      const c = [...raiz.querySelectorAll('button,[data-i],[data-c],[data-card],.card,.carta,.cell,.sq,.casilla,canvas')].filter(b => b.offsetParent !== null && !b.disabled && !/salir|borrar|abandon|rendir|exit|quit|delete|compart|share|whats|copiar/i.test((b.textContent || '') + ' ' + (b.id || '') + ' ' + (b.className || '')));
      if (!c.length) return; const e = c[r % c.length]; const rc = e.getBoundingClientRect();
      ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(t => e.dispatchEvent(new MouseEvent(t, { bubbles: true, clientX: rc.left + rc.width * ((r % 97) / 97), clientY: rc.top + rc.height * ((r % 89) / 89) })));
    }, semilla).catch(() => {});
    await p.waitForTimeout(250);
    if (++vuelta % 4 === 0) await mira();
    if (!p.url().startsWith(URL_APP)) { await p.goto(URL_APP).catch(() => {}); await p.waitForTimeout(800); }
  }
  const falta = (await p.evaluate(() => Idioma.faltan()).catch(() => [])).filter(t => sinPropios(t).replace(/[^A-Za-zÁÉÍÓÚáéíóúñÑ]/g, '').length > 0);
  check(lang + ': todo lo que se ve está traducido', falta.length === 0, falta.slice(0, 8).join(' | '));
  if (lang === 'en' || lang === 'de') check(lang + ': sin trozos en español dentro de textos traducidos', resto.size === 0, [...resto].slice(0, 6).join(' | '));
  check(lang + ': sin errores de JavaScript', errores.length === 0, errores.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close(); server.close();
console.log(`\n${passed} correctas, ${failed} falladas`);
process.exit(failed ? 1 : 0);
