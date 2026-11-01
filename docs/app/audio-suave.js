/* Salida de sonido suave (IT Canarias). © 2026 IT Canarias. Todos los derechos reservados.
   El mismo archivo en todas las apps. Todos los sonidos (sintetizados) pasan por aquí antes de llegar al altavoz:
   volumen general (⋮ → Colores… → «Volumen»: bajo, medio o alto), un filtro que quita los agudos
   que molestan y un compresor que iguala los golpes fuertes. */
(function (root) {
'use strict';
const NIVELES = { bajo: 0.22, medio: 0.45, alto: 0.8 };
const nivel = () => { const v = typeof S !== 'undefined' && S && S.volumen; return NIVELES[v] ? v : 'medio'; };
const cadenas = new WeakMap();
// Nodo al que conectar los sonidos de este AudioContext (en vez de ctx.destination)
function salida(c) {
  let k = cadenas.get(c);
  if (!k) {
    try {
      const g = c.createGain(), f = c.createBiquadFilter(), comp = c.createDynamicsCompressor();
      f.type = 'lowpass'; f.frequency.value = 3200; f.Q.value = 0.5;
      comp.threshold.value = -26; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      g.connect(f); f.connect(comp); comp.connect(c.destination);
      k = { g };
    } catch (e) { return c.destination; }
    cadenas.set(c, k);
  }
  k.g.gain.value = NIVELES[nivel()];
  return k.g;
}
// Opción para la ventana de ajustes (va junto al aviso de turno)
const opcionHtml = () => `<label class="f" style="margin-bottom:10px"><span>🔉 Volumen<em>De los sonidos y del aviso de turno</em></span>
  <span class="kinds" id="thVolumen" style="flex:none;width:58%;margin:0">${[['bajo', 'Bajo'], ['medio', 'Medio'], ['alto', 'Alto']].map(([v, t]) => `<button type="button" data-volumen="${v}" class="${nivel() === v ? 'on' : ''}">${t}</button>`).join('')}</span></label>`;
function enlazar(probar) {
  document.querySelectorAll('[data-volumen]').forEach(b => b.onclick = e => {
    e.preventDefault();
    S.volumen = b.dataset.volumen; if (typeof save === 'function') save();
    document.querySelectorAll('[data-volumen]').forEach(x => x.classList.toggle('on', x === b));
    if (probar) try { probar(); } catch (er) {}
  });
}
root.AudioSuave = { salida, nivel, opcionHtml, enlazar, NIVELES };
})(typeof self !== 'undefined' ? self : globalThis);
