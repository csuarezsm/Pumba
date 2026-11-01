/* Sonidos de los juegos de cartas (IT Canarias). © 2026 IT Canarias. Todos los derechos reservados.
   El mismo archivo en Chinchón y Pumba. Sonidos sintetizados (sin archivos de audio): repartir, robar,
   echar carta, fin de mano y fin de partida. Se quitan en ⋮ → Colores… → «Sonidos» (S.sound = false).
   SonidoCartas.mesa(sig) compara el estado de la mesa con el anterior y suena lo que haya pasado:
   sig = { mano, turnos, fase, mazo, fin }. */
(function (root) {
'use strict';
let ctx = null;
const ac = () => {
  if (!ctx) { const C = root.AudioContext || root.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};
if (typeof document !== 'undefined') document.addEventListener('pointerdown', function prep() { ac(); document.removeEventListener('pointerdown', prep); }, { passive: true });
const activo = () => typeof S === 'undefined' || !S || S.sound !== false;
// roce de papel: ruido corto filtrado
function roce(c, t, freq, vol, dur) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8; g.gain.value = vol;
  src.buffer = buf; src.connect(f); f.connect(g); g.connect(c.destination); src.start(t);
}
function tono(c, t, freq, dur, vol, type) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function play(kind) {
  if (!activo()) return false;
  const c = ac(); if (!c) return false;
  const t = c.currentTime + 0.01;
  try {
    if (kind === 'carta') { roce(c, t, 2600, 0.7, 0.07); roce(c, t + 0.03, 900, 0.5, 0.05); }
    else if (kind === 'robar') roce(c, t, 1800, 0.5, 0.12);
    else if (kind === 'repartir') { for (let k = 0; k < 5; k++) roce(c, t + k * 0.06, 2200 + k * 80, 0.45, 0.05); }
    else if (kind === 'mano') { [659, 523].forEach((f, i) => tono(c, t + i * 0.12, f, 0.3, 0.1, 'triangle')); }
    else if (kind === 'fin') { [523, 659, 784, 1047].forEach((f, i) => tono(c, t + i * 0.12, f, 0.5, 0.12, 'triangle')); }
    else if (kind === 'aviso') tono(c, t, 880, 0.18, 0.1, 'sine');
  } catch (e) { return false; }
  root.SonidoCartas.veces++;
  return true;
}
let prev = null;
// Suena lo que ha cambiado en la mesa desde la última vez.
// robarYEchar: en el chinchón un turno es robar y echar (si los dos pasan a la vez, suenan los dos)
function mesa(sig, robarYEchar) {
  const p = prev; prev = sig ? Object.assign({}, sig) : null;
  if (!sig || !p) return null;
  let k = null;
  const robo = sig.mazo < p.mazo, turno = sig.turnos !== p.turnos;
  if (sig.fin && !p.fin) k = 'fin';
  else if (sig.mano !== p.mano) k = 'repartir';
  else if (sig.fase === 'over' && p.fase !== 'over') k = 'mano';
  else if (robo && turno && robarYEchar) { play('robar'); setTimeout(() => play('carta'), 160); return 'robar+carta'; }
  else if (robo) k = 'robar';
  else if (turno) k = 'carta';
  else if (sig.mesa !== p.mesa) k = robarYEchar ? 'robar' : 'carta';
  if (k) play(k);
  return k;
}
const reiniciar = () => { prev = null; };
root.SonidoCartas = { play, mesa, reiniciar, activo, veces: 0 };
})(typeof self !== 'undefined' ? self : globalThis);
