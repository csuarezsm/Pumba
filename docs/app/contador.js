/* Contador anónimo de instalaciones (IT Canarias). © 2026 IT Canarias. Todos los derechos reservados.
   El mismo archivo en todas las apps. Una sola vez al instalar, y una vez por cada versión nueva, la app avisa al
   servidor de juegos con: el juego, el tipo de app (Android de GitHub, Google Play, iPhone o web) y la versión.
   Nada más: ni nombre, ni identificador, ni datos del móvil. El servidor solo suma.
   En las pruebas automáticas (navegador controlado) no avisa. */
(function (root) {
'use strict';
const URL_DEF = 'https://juegos.itcanarias.com/contar';
async function avisar() {
  const url = root.CONTADOR_URL != null ? root.CONTADOR_URL : URL_DEF;
  if (!url || (navigator.webdriver && !root.CONTADOR_FORZAR)) return false;
  if (typeof storeReady !== 'undefined') { try { await storeReady; } catch (e) {} }
  if (S.contadoVer === APP_VERSION || (navigator.onLine === false)) return false;
  const plataforma = isNative() ? (isPlay() ? 'play' : 'android') : (isIOS() ? 'ios' : 'web');
  const d = { juego: root.APP_ID, plataforma, version: APP_VERSION, evento: S.contadoVer ? 'actualizacion' : 'instalacion' };
  if (S.contadoVer) d.de = S.contadoVer;
  try {
    const r = await fetch(url, { method: 'POST', body: JSON.stringify(d) });   // texto: sin petición previa de CORS
    if (r.ok || r.status === 400) { S.contadoVer = APP_VERSION; save(); return true; }
  } catch (e) {}
  return false;
}
if (typeof setTimeout !== 'undefined') setTimeout(() => { avisar(); }, 6000);
root.Contador = { avisar };
})(typeof self !== 'undefined' ? self : globalThis);
