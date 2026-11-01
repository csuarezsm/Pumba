/* Partidas públicas y «Jugar con cualquiera» (IT Canarias). © 2026 IT Canarias. Todos los derechos reservados.
   El mismo archivo en todas las apps. En la pantalla de «En línea»:
   - «🎲 Jugar con cualquiera»: el servidor te junta con otras personas que estén buscando partida
     (en los juegos con máquina, si no hay gente suficiente la mesa se completa con la máquina);
   - «Partidas abiertas»: las partidas públicas con sitio, para entrar con un toque;
   - al crear una partida, la casilla «Partida pública» la pone en esa lista.
   Cada app llama a Publicas.html() y Publicas.montar({…}) al dibujar la pantalla, Publicas.recibir(m) con los
   mensajes del servidor y Publicas.aviso(sala) en la sala de espera. */
(function (root) {
'use strict';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const $ = id => document.getElementById(id);
const CLAVE = 'partidaPublica';
let cfg = null, sondeo = null, ultima = null;
// noDisponible: el servidor aún no tiene partidas públicas (versión anterior); esperando: hay una petición sin respuesta
let noDisponible = false, esperando = false, ultimaPeticion = 0;

function html(conMaquina = true) {
  return `<div class="sec pub-sec"><h2>🌍 Partidas públicas</h2>
    <button class="btn-gold" id="pubBuscar" style="width:100%">🎲 Jugar con cualquiera</button>
    <div class="mut" style="margin:8px 0 12px">${!conMaquina
      ? 'Te junta con otra persona que esté buscando partida.'
      : 'Te junta con otras personas que estén buscando partida. Si no hay suficientes, la mesa se completa con la máquina.'}</div>
    <h2 style="font-size:1em;margin:4px 0 6px">Partidas abiertas</h2>
    <div id="pubLista">${listaHtml(ultima)}</div></div>`;
}
function listaHtml(salas) {
  if (noDisponible) return '<div class="mut">🛠 Las partidas públicas estarán disponibles muy pronto.</div>';
  if (salas == null) return '<div class="mut">Buscando partidas…</div>';
  if (!salas.length) return '<div class="mut">No hay partidas abiertas ahora mismo.</div>';
  return salas.map(s => `<div class="on-seat pub-fila" style="display:flex;align-items:center;gap:8px;padding:6px 0">
      <span class="n" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.auto ? '🎲 ' : '👑 '}<span>${esc(s.nombre)}</span></span>
      <span class="mut" style="flex:none">👥 ${s.jugadores}/${s.max}</span>
      <button class="btn-ghost sm" data-pubentrar="${esc(s.codigo)}" style="flex:none">Entrar</button></div>`).join('');
}
function pintarLista() {
  const el = $('pubLista'); if (!el) return;
  el.innerHTML = listaHtml(ultima);
  el.querySelectorAll('[data-pubentrar]').forEach(b => b.onclick = () => {
    const n = cfg.nombre(); if (n == null) return;
    cfg.enviar({ t: 'unirse', codigo: b.dataset.pubentrar, nombre: n });
  });
}
function pedir() {
  if (!cfg || !$('pubLista')) { clearInterval(sondeo); sondeo = null; return; }
  if (typeof document !== 'undefined' && document.hidden) return;
  if (noDisponible || Date.now() - ultimaPeticion < 3000) return;
  if (cfg.conectado && !cfg.conectado()) return;
  ultimaPeticion = Date.now(); esperando = true;
  cfg.enviar({ t: 'lista', juego: cfg.juego });
}
// opts: { juego, enviar(m), nombre() → nombre o null (si falta, ya avisa la app), opciones() → opciones de la partida,
//         conectado() → hay conexión, conMaquina (false en ajedrez y damas) }
function montar(opts) {
  cfg = Object.assign({ conMaquina: true }, opts);
  const b = $('pubBuscar');
  if (b) b.onclick = () => { const n = cfg.nombre(); if (n == null) return; if (noDisponible) { pintarLista(); return; } esperando = true; cfg.enviar({ t: 'buscar', juego: cfg.juego, opciones: cfg.opciones ? cfg.opciones() : {}, nombre: n }); };
  pintarLista();
  pedir();
  clearInterval(sondeo); sondeo = setInterval(pedir, 4000);
}
function recibir(m) {
  if (!m || m.t !== 'lista') return false;
  if (cfg && m.juego !== cfg.juego) return true;
  esperando = false;
  ultima = Array.isArray(m.salas) ? m.salas : [];
  pintarLista();
  return true;
}
// Error del servidor: si es que aún no conoce estas órdenes (servidor sin actualizar), se deja de preguntar
// y se avisa en la lista. Devuelve true si el error era de aquí (la app no tiene que enseñarlo).
function error(m) {
  if (!m || m.t !== 'error' || !esperando) return false;
  esperando = false;
  if (!/desconocida/i.test(String(m.msg || ''))) return false;
  noDisponible = true; pintarLista();
  return true;
}
// Casilla para «Crear una partida»
function casilla() {
  return `<label class="f pub-casilla" style="display:flex;align-items:center;gap:10px;margin:8px 0"><input type="checkbox" id="pubPublica" ${marcadaGuardada() ? 'checked' : ''} style="width:22px;height:22px;flex:none">
    <span>Partida pública<em style="display:block;font-style:normal;opacity:.75;font-size:.85em">Aparece en «Partidas abiertas» y puede entrar cualquiera</em></span></label>`;
}
function marcadaGuardada() { try { return localStorage.getItem(CLAVE) === '1'; } catch (e) { return false; } }
function marcada() {
  const c = $('pubPublica'); const v = !!(c && c.checked);
  try { localStorage.setItem(CLAVE, v ? '1' : '0'); } catch (e) {}
  return v;
}
// Aviso en la sala de espera (cuenta atrás de «Jugar con cualquiera»)
const METAS = new Map();
function meta(s) {
  if (!s || s.empiezaEn == null) return null;
  const k = s.codigo + ':' + s.empiezaEn;
  if (!METAS.has(k)) { if (METAS.size > 50) METAS.clear(); METAS.set(k, Date.now() + Math.max(0, s.faltaMs != null ? s.faltaMs : s.empiezaEn - Date.now())); }
  return METAS.get(k);
}
const quedan = t => Math.max(0, Math.ceil((t - Date.now()) / 1000));
function aviso(s) {
  if (!s || s.estado !== 'espera' || (!s.auto && !s.publica)) return '';
  if (!s.auto) return '<div class="mut pub-aviso" style="text-align:center;margin:6px 0">🌍 Partida pública: cualquiera puede entrar desde «Partidas abiertas».</div>';
  const t = meta(s);
  const humanos = (s.asientos || []).filter(a => !a.bot).length;
  return `<div class="sec pub-aviso" style="text-align:center"><b>🔎 Buscando jugadores…</b>
    <div class="mut" style="margin-top:4px">${t == null
      ? 'La partida empieza en cuanto entre otra persona.'
      : `<span>${humanos >= 2 ? 'Empieza en' : 'Si no llega nadie, juegas con la máquina en'}</span> <b data-pubcuenta="${t}">${quedan(t)}</b> s`}</div></div>`;
}
if (typeof setInterval !== 'undefined') setInterval(() => {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-pubcuenta]').forEach(el => { const v = String(quedan(+el.dataset.pubcuenta)); if (el.textContent !== v) el.textContent = v; });
}, 500);

root.Publicas = { html, montar, recibir, error, casilla, marcada, aviso, _listaHtml: listaHtml };
})(typeof self !== 'undefined' ? self : globalThis);
