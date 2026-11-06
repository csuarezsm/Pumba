/* Invitaciones con enlace (IT Canarias). © 2026 IT Canarias. Todos los derechos reservados.
   El mismo archivo en todas las apps. El mensaje de invitación lleva un enlace a la página «unirse.html» del juego
   (GitHub Pages). Al tocarlo:
   - en Android, si la app está instalada se abre directamente en la partida (enlace itc<juego>://unirse/CÓDIGO);
     si no, lleva a la página de descarga;
   - en iPhone y en el ordenador, abre la versión web ya dentro de la partida (app/?unirse=CÓDIGO).
   Cada app define window.unirseDesdeEnlace(codigo), que lleva a la pantalla de «En línea» y entra en la sala. */
(function (root) {
'use strict';
const REPOS = { ajedrez: 'Ajedrez', damas: 'Damas', chinchon: 'chinchon-marcador', pumba: 'Pumba', parchis: 'Parchis', poker: 'Poker' };
const id = () => root.APP_ID || '';
const limpio = c => { const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return s.length === 4 ? s : null; };
// Enlace para el mensaje de invitación
const enlace = codigo => 'https://csuarezsm.github.io/' + (REPOS[id()] || '') + '/unirse.html?c=' + encodeURIComponent(codigo);
// Código que viene en una dirección (web: ?unirse=ABCD · Android: itcparchis://unirse/ABCD)
function deUrl(url) {
  try {
    const u = new URL(url);
    return limpio(u.searchParams.get('unirse') || u.searchParams.get('c') || (/unirse\/([A-Za-z0-9]{4})/.exec(url) || [])[1]);
  } catch (e) { return null; }
}
// El código se guarda un rato por si la app aún no está lista (o se recarga al actualizarse)
const CLAVE = 'invitacionPendiente', VALIDO_MS = 15 * 60e3;
const guardar = c => { try { localStorage.setItem(CLAVE, JSON.stringify({ c, t: Date.now() })); } catch (e) {} };
function guardado() {
  try { const o = JSON.parse(localStorage.getItem(CLAVE) || 'null'); if (o && Date.now() - o.t < VALIDO_MS) return limpio(o.c); } catch (e) {}
  return null;
}
const olvidar = () => { try { localStorage.removeItem(CLAVE); } catch (e) {} };
function entregar(c) {
  c = limpio(c); if (!c) return;
  guardar(c);
  if (typeof root.unirseDesdeEnlace === 'function') { try { olvidar(); root.unirseDesdeEnlace(c); } catch (e) {} }
}
// La app ya está lista para unirse (por si el enlace llegó antes)
function listo() { const c = guardado(); if (c && typeof root.unirseDesdeEnlace === 'function') { olvidar(); root.unirseDesdeEnlace(c); } }
function arrancar() {
  // versión web: ?unirse=ABCD (se quita de la barra para no volver a entrar al recargar)
  try {
    const c = deUrl(location.href);
    if (c && /[?&]unirse=/.test(location.search)) { history.replaceState(null, '', location.pathname); setTimeout(() => entregar(c), 300); }
  } catch (e) {}
  // app Android: abierta con el enlace, o recibiendo el enlace con la app ya abierta
  try {
    const A = root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins.App;
    if (A) {
      if (A.addListener) A.addListener('appUrlOpen', e => entregar(deUrl(e && e.url)));
      if (A.getLaunchUrl) A.getLaunchUrl().then(r => { if (r && r.url) setTimeout(() => entregar(deUrl(r.url)), 300); }).catch(() => {});
    }
  } catch (e) {}
  setTimeout(listo, 900);
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else setTimeout(arrancar, 0);
}
// Mensaje de invitación (WhatsApp…)
const texto = (emoji, nombre, codigo) => `${emoji} ¡Te invito a una partida de ${nombre}!\n\n👉 Toca para entrar: ${enlace(codigo)}\n\nCódigo: *${codigo}*\n(Si no tienes la app, el enlace te lleva a descargarla gratis, para Android e iPhone.)`;
root.Invitacion = { enlace, texto, deUrl, listo, entregar };
})(typeof self !== 'undefined' ? self : globalThis);
