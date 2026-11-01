/* Aviso de turno en el juego en línea (IT Canarias). © 2026 IT Canarias. Todos los derechos reservados.
   El mismo archivo en todas las apps. Cuando pasa a ser tu turno (en línea o después de jugar la máquina), suena un aviso
   corto y vibra. Se puede quitar en ⋮ → Colores… → «Aviso de turno» (S.avisoTurno = false).
   recordar(): un aviso más suave para cuando falta que pulses «Seguir».
   El sonido se sintetiza (sin archivos de audio). */
(function (root) {
'use strict';
let ctx = null;
const ac = () => {
  if (!ctx) { const C = root.AudioContext || root.webkitAudioContext; if (!C) return null; try { ctx = new C(); } catch (e) { return null; } }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
};
// iPhone y algunos Android solo dejan sonar después de un toque: se prepara en el primer toque
if (typeof document !== 'undefined') document.addEventListener('pointerdown', function prep() { ac(); document.removeEventListener('pointerdown', prep); }, { passive: true });
const activo = () => typeof S === 'undefined' || !S || S.avisoTurno !== false;
function campanita() {
  const c = ac(); if (!c) return false;
  const t = c.currentTime + 0.02;
  // dos notas suaves, como un «ding-dong» corto
  [[880, 0], [1318.5, 0.16]].forEach(([f, d]) => {
    const o = c.createOscillator(), g = c.createGain(), o2 = c.createOscillator(), g2 = c.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2;
    g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.22, t + d + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.55);
    g2.gain.setValueAtTime(0.0001, t + d); g2.gain.exponentialRampToValueAtTime(0.05, t + d + 0.015); g2.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.3);
    o.connect(g); g.connect(c.destination); o2.connect(g2); g2.connect(c.destination);
    o.start(t + d); o.stop(t + d + 0.6); o2.start(t + d); o2.stop(t + d + 0.35);
  });
  return true;
}
let ultimo = 0;
// Avisa de que te toca (no repite si se llama varias veces seguidas)
function sonar() {
  if (!activo()) return false;
  const now = Date.now(); if (now - ultimo < 1500) return false; ultimo = now;
  root.AvisoTurno.veces++;
  try { navigator.vibrate && navigator.vibrate([40, 60, 40]); } catch (e) {}
  try { campanita(); } catch (e) {}
  return true;
}
// Contra la máquina: suena cuando vuelve a ser tu turno después de jugar ella (no al seguir tú, por ejemplo con un 6)
let fuera = false, ultimaClave = null;
function local(miTurno, clave) {
  if (!miTurno) { fuera = true; return false; }
  const toca = fuera && clave !== ultimaClave;
  fuera = false; ultimaClave = clave;
  return toca ? sonar() : false;
}
// Recordatorio (por ejemplo, «pulsa Seguir»): aviso aunque haya sonado hace poco
function recordar() { ultimo = 0; return sonar(); }
// Opción para la ventana de ajustes
const opcionHtml = () => `<label class="f" style="margin-bottom:10px"><span>🔔 Aviso de turno<em>Sonido y vibración cuando te toca, en línea y contra la máquina</em></span><input type="checkbox" class="tg" id="thTurno" ${activo() ? 'checked' : ''}></label>`;
function enlazar() {
  const el = document.getElementById('thTurno'); if (!el) return;
  el.onchange = e => { S.avisoTurno = e.target.checked; save(); if (S.avisoTurno) { ultimo = 0; sonar(); } };
}
root.AvisoTurno = { sonar, local, recordar, activo, opcionHtml, enlazar, veces: 0 };
})(typeof self !== 'undefined' ? self : globalThis);
