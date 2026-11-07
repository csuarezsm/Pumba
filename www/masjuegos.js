/* Más juegos de IT Canarias — enlaces entre las apps. © 2026 IT Canarias. Todos los derechos reservados.
   El mismo archivo en todas las apps (Ajedrez, Chinchón, Pumba, Damas, Parchís, Póker, UNO, Invasores…). Cada app pone window.APP_ID.
   - Lleva dentro una lista de los juegos, para que funcione sin conexión.
   - Con internet, descarga el catálogo común (juegos-servidor/docs/juegos.json en GitHub Pages) como mucho
     cada 12 horas y lo guarda en el móvil: un juego nuevo aparece en todas las apps sin actualizarlas.
   - En Android, si el otro juego ya está instalado, el botón lo abre; si no, lleva a su página de descarga.
     En iPhone lleva a su versión web. */
(function (root) {
'use strict';
const CATALOGO_URL = 'https://csuarezsm.github.io/juegos-servidor/juegos.json';
const CADA_MS = 12 * 3600e3;
const BASE = [
  { id: 'ajedrez', nombre: 'Ajedrez', emoji: '♞', descripcion: 'Contra la máquina (6 niveles), con un amigo o en línea, y problemas de mate.', android: 'com.itcanarias.ajedrez', descarga: 'https://csuarezsm.github.io/Ajedrez/', web: 'https://csuarezsm.github.io/Ajedrez/app/', icono: 'https://csuarezsm.github.io/Ajedrez/icon.png' },
  { id: 'damas', nombre: 'Damas', emoji: '⛀', descripcion: 'Damas españolas contra la máquina, con un amigo o en línea, y problemas.', android: 'com.itcanarias.damas', descarga: 'https://csuarezsm.github.io/Damas/', web: 'https://csuarezsm.github.io/Damas/app/', icono: 'https://csuarezsm.github.io/Damas/icon.png' },
  { id: 'chinchon', nombre: 'Chinchón', emoji: '🃏', descripcion: 'Marcador de puntos del chinchón y partidas contra la máquina o en línea.', android: 'com.itcanarias.chinchon', descarga: 'https://csuarezsm.github.io/chinchon-marcador/', web: 'https://csuarezsm.github.io/chinchon-marcador/app/', icono: 'https://csuarezsm.github.io/chinchon-marcador/icon.png' },
  { id: 'pumba', nombre: 'Pumba', emoji: '🎴', descripcion: 'El juego de cartas Pumba contra la máquina o en línea, y los puntos de vuestras partidas.', android: 'com.itcanarias.pumba', descarga: 'https://csuarezsm.github.io/Pumba/', web: 'https://csuarezsm.github.io/Pumba/app/', icono: 'https://csuarezsm.github.io/Pumba/icon.png' },
  { id: 'parchis', nombre: 'Parchís', emoji: '🎲', descripcion: 'El parchís de siempre, de 2 a 4: contra la máquina, con amigos en el mismo móvil o en línea.', android: 'com.itcanarias.parchis', descarga: 'https://csuarezsm.github.io/Parchis/', web: 'https://csuarezsm.github.io/Parchis/app/', icono: 'https://csuarezsm.github.io/Parchis/icon.png' },
  { id: 'poker', nombre: 'Póker', emoji: '♠️', descripcion: "Texas Hold'em: torneo con fichas ficticias contra la máquina o en línea, con modo aprendizaje.", android: 'com.itcanarias.poker', descarga: 'https://csuarezsm.github.io/Poker/', web: 'https://csuarezsm.github.io/Poker/app/', icono: 'https://csuarezsm.github.io/Poker/icon.png' },
  { id: 'uno', nombre: 'UNO', emoji: '🃏', descripcion: 'Cartas de colores contra la máquina o en línea con amigos, con modo aprendizaje.', android: 'com.itcanarias.uno', descarga: 'https://csuarezsm.github.io/Uno/', web: 'https://csuarezsm.github.io/Uno/app/', icono: 'https://csuarezsm.github.io/Uno/icon.png' },
  { id: 'invasores', nombre: 'Invasores espaciales', emoji: '👾', descripcion: 'Arcade retro: defiende la Tierra de los invasores o compite en línea con tus amigos por la mejor puntuación.', android: 'com.itcanarias.invasores', descarga: 'https://csuarezsm.github.io/Invasores/', web: 'https://csuarezsm.github.io/Invasores/app/', icono: 'https://csuarezsm.github.io/Invasores/icon.png' },
  { id: 'martin', nombre: 'Martín: Los Caminos del Volcán', emoji: '🌋', descripcion: 'Lleva el agua por los caminos de Lanzarote: 6 niveles de plataformas y un desafío diario con clasificación.', android: 'com.itcanarias.martin', descarga: 'https://csuarezsm.github.io/Martin/', web: 'https://csuarezsm.github.io/Martin/app/', icono: 'https://csuarezsm.github.io/Martin/icon.png' }
];
// Iconos que lleva la app dentro (www/juegos/<id>.png)
const LOCALES = new Set(BASE.map(j => j.id));

/* ---------- Validación del catálogo (viene de internet: solo datos limpios) ---------- */
const txt = (v, n) => String(v == null ? '' : v).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, n);
const url = v => { const s = String(v || ''); return /^https:\/\/[^\s"'<>]+$/.test(s) && s.length < 300 ? s : ''; };
function limpiar(j) {
  if (!j || typeof j !== 'object' || !/^[a-z0-9-]{2,30}$/.test(String(j.id))) return null;
  const o = { id: String(j.id), nombre: txt(j.nombre, 30), emoji: txt(j.emoji, 4), descripcion: txt(j.descripcion, 140),
    android: /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(String(j.android || '')) ? String(j.android) : '',
    descarga: url(j.descarga), web: url(j.web), play: url(j.play), icono: url(j.icono) };
  if (!o.nombre || !(o.descarga || o.web)) return null;
  return o;
}
function validar(c) {
  if (!c || !Array.isArray(c.juegos)) return null;
  const out = [], vistos = new Set();
  for (const j of c.juegos.slice(0, 30)) { const o = limpiar(j); if (o && !vistos.has(o.id)) { vistos.add(o.id); out.push(o); } }
  return out.length ? out : null;
}

const yo = () => root.APP_ID || '';
function juegos() {
  const guardados = S.masJuegos && validar({ juegos: S.masJuegos.juegos });
  return (guardados || BASE).filter(j => j.id !== yo());
}
// Descarga el catálogo común (como mucho cada 12 h, o siempre si force)
async function actualizar(force) {
  if (!force && S.masJuegos && Date.now() - (S.masJuegos.at || 0) < CADA_MS) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
  try {
    const r = await fetch(root.MAS_JUEGOS_URL || CATALOGO_URL, { cache: 'no-cache' });
    if (!r.ok) return false;
    const list = validar(await r.json());
    if (!list) return false;
    S.masJuegos = { at: Date.now(), juegos: list }; save();
    return true;
  } catch (e) { return false; }
}

/* ---------- Apps instaladas (solo en la app Android) ---------- */
const plugin = () => { try { return isNative() && root.Capacitor.Plugins.OtrasApps; } catch (e) { return null; } };
async function instaladas(list) {
  const P = plugin(); if (!P) return new Set();
  try { const r = await P.instaladas({ ids: list.map(j => j.android).filter(Boolean) }); return new Set((r && r.ids) || []); } catch (e) { return new Set(); }
}
// A dónde lleva cada juego en este dispositivo
function destino(j, inst) {
  if (inst.has(j.android)) return { tipo: 'abrir', label: 'Abrir' };
  if (isIOS()) return { tipo: 'url', url: j.web || j.descarga, label: 'Abrir' };
  if (isNative()) return { tipo: 'url', url: (isPlay() && j.play) || j.descarga || j.web, label: 'Descargar' };
  return { tipo: 'url', url: j.descarga || j.web, label: 'Ver' };
}
const icono = j => LOCALES.has(j.id) ? 'juegos/' + j.id + '.png' : j.icono;

async function abrir() {
  const list = juegos();
  const pintar = inst => {
    openModal(`<h3>🎲 Más juegos de IT Canarias</h3><div class="sub">Gratis y sin anuncios, como este. Para Android y iPhone.</div>
      <div class="mj">${list.map((j, i) => { const d = destino(j, inst); return `<button class="mjc" data-mj="${i}">
        <span class="mji">${icono(j) ? `<img src="${esc(icono(j))}" alt="" onerror="this.replaceWith(document.createTextNode('${esc(j.emoji || '🎲')}'))">` : esc(j.emoji || '🎲')}</span>
        <span class="mjt"><b>${esc(j.nombre)}</b><small>${esc(j.descripcion)}</small></span>
        <em class="${d.tipo === 'abrir' ? 'on' : ''}">${esc(d.label)}</em></button>`; }).join('')}</div>
      <div class="acts"><button class="btn-ghost" id="mjX">Cerrar</button></div>`);
    $('#mjX').onclick = closeModal;
    document.querySelectorAll('[data-mj]').forEach(b => b.onclick = async () => {
      const j = list[+b.dataset.mj], d = destino(j, inst);
      if (d.tipo === 'abrir') { try { await plugin().abrir({ id: j.android }); return; } catch (e) {} }
      const u = d.url || j.descarga || j.web; if (u) openExternal(u);
    });
  };
  pintar(new Set());
  const inst = await instaladas(list);
  if (inst.size && document.querySelector('.mj')) pintar(inst);
  // de paso, mira si hay juegos nuevos (para la próxima vez)
  actualizar(false);
}

// Estilos del apartado (iguales en todas las apps; usan los colores del tema)
function estilos() {
  if (typeof document === 'undefined' || document.getElementById('mjCss')) return;
  const st = document.createElement('style'); st.id = 'mjCss';
  st.textContent = `.mj{display:flex;flex-direction:column;gap:8px;margin:4px 0 6px}
.mjc{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:var(--card);padding:10px 12px}
.mji{flex:0 0 auto;width:52px;height:52px;border-radius:13px;overflow:hidden;display:grid;place-items:center;font-size:28px;background:var(--card2)}
.mji img{width:100%;height:100%;display:block}
.mjt{flex:1;min-width:0;display:flex;flex-direction:column}
.mjt small{color:var(--mut);font-size:calc(13px * var(--fs, 1));line-height:1.3;margin-top:2px}
.mjc em{flex:0 0 auto;font-style:normal;font-weight:700;font-size:calc(14px * var(--fs, 1));padding:6px 10px;border-radius:10px;background:var(--card2);color:var(--gold)}
.mjc em.on{background:var(--gold);color:var(--on-gold)}`;
  document.head.appendChild(st);
}
estilos();
// al arrancar, con calma, mira si hay juegos nuevos
if (typeof setTimeout !== 'undefined' && typeof document !== 'undefined') setTimeout(() => { try { actualizar(false); } catch (e) {} }, 4000);

root.MasJuegos = { abrir, actualizar, juegos, validar, BASE, CATALOGO_URL };
})(typeof self !== 'undefined' ? self : globalThis);
