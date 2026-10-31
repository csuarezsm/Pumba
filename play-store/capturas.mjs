// Genera las capturas y gráficos para la ficha de Google Play.
// Uso (desde la raíz del repo): node play-store/capturas.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUT = ROOT + 'play-store/';
const APP = 'file://' + ROOT + 'www/index.html';
const b = await chromium.launch();

// Datos de ejemplo: partidas terminadas para el ranking y una mano en juego
const seed = () => {
  const names = ['Carlos', 'Tere', 'Aitor', 'Lola', 'Domingo']; let s = 11; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const mk = (ts, pl) => { const ps = pl.map(n => ({ id: uid(), name: n })); const g = { id: uid(), created: ts, cfg: Object.assign({}, DEF_CFG), players: ps, firstDealer: ps[0].id, events: [] };
    let k = 0; while (!compute(g).ended && k++ < 80) { const R = compute(g); const act = R.active; const cl = act[Math.floor(rnd() * act.length)].id; const sc = {}; act.forEach(p => sc[p.id] = p.id === cl ? 0 : Math.floor(rnd() * 38)); g.events.push({ t: 'hand', dealer: R.next, closer: cl, kind: 'normal', scores: sc });
      const R2 = compute(g); R2.active.length && g.players.forEach(p => { if (R2.st[p.id].out && canRebuy(g, R2, p.id) && rnd() < .5) g.events.push({ t: 'rebuy', p: p.id, score: rebuyScore(g, R2) }); }); }
    const R = compute(g); return { ...g, finished: ts, hands: R.hand, winnerName: pname(g, R.ended.winner) }; };
  const base = new Date(2026, 9, 1, 21).getTime();
  for (let d = 0; d < 30; d += 3) for (let i = 0; i < 3; i++) S.archive.unshift(mk(base + d * 864e5 + i * 50 * 60e3, names.slice(0, 3 + (i % 3))));
  S.roster = names.slice(); save();
};
// Prepara cada pantalla dentro de la app (se ejecuta en el navegador)
const setup = (name) => {
  const table = () => {
    S.draft.mode = 'play'; S.draft.play = Object.assign(S.draft.play || {}, { name: 'Carlos', bots: 3, botNames: ['Tere', 'Aitor', 'Lola'] }); render();
    document.querySelector('#plStart').click(); window.PLAY_DELAY = 1e9;
    const g = S.game, h = g.play.hand, my = me(g), [b1, b2, b3] = g.play.bots;
    h.hands[my] = ['o5', 'c5', 'c10', 'e2', 'c12', 'b11']; h.hands[b1] = ['o1', 'o3', 'e4', 'b6']; h.hands[b2] = ['c1']; h.hands[b3] = ['e5', 'e6', 'b1'];
    h.pile = ['b4', 'c7', 'c4']; h.suit = 'c'; h.turn = my; h.log = '🤖 Lola echa el 4 de copas.';
    g.events.push({ t: 'hand', dealer: g.players[3].id, closer: b1, kind: 'normal', scores: { [my]: 14, [b1]: 0, [b2]: 31, [b3]: 22 } });
    return { g, h, my, b2 };
  };
  if (name === '1-mesa') { table(); render(); }
  if (name === '2-pumba') { const { h, b2 } = table(); h.forgot = { pid: b2 }; h.pile.push('c1'); h.log = '🤖 Aitor echa el as de copas.'; h.hands[b2] = ['c3']; render(); }
  if (name === '3-sota') { table(); render(); document.querySelector('[data-card="c10"]').click(); document.querySelector('#pPlay').click(); }
  if (name === '4-marcador') {
    S.game = null; S.draft.mode = 'score'; S.draft.names = ['Carlos', 'Tere', 'Aitor', 'Lola']; render(); document.querySelector('#start').click();
    const g = S.game, id = n => g.players.find(p => p.name === n).id;
    [[{ Carlos: 12, Aitor: 31, Lola: 8 }, 'Tere'], [{ Tere: 22, Aitor: 40, Lola: 15 }, 'Carlos'], [{ Carlos: 18, Tere: 9, Aitor: 35 }, 'Lola']].forEach(([sc, cl]) => {
      const R = compute(g); const s = { [id(cl)]: 0 }; for (const n in sc) s[id(n)] = sc[n]; g.events.push({ t: 'hand', dealer: R.next, closer: id(cl), kind: 'normal', scores: s }); });
    render();
  }
  if (name === '5-ranking') { S.game = null; render(); openArchive('ranking'); }
  if (name === '6-reglas') { S.game = null; render(); openGameRules(); }
};
const SHOTS = ['1-mesa', '2-pumba', '3-sota', '4-marcador', '5-ranking', '6-reglas'];
const SIZES = [
  ['movil', 405, 720, 1080 / 405],
  ['tablet7', 450, 720, 1200 / 450],
  ['tablet10', 1280, 800, 1.5],
];
for (const [dev, w, h, dsf] of SIZES) {
  for (const name of SHOTS) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf, isMobile: dev === 'movil', hasTouch: true });
    const p = await ctx.newPage();
    await p.addInitScript(() => { if (!sessionStorage.s) { localStorage.setItem('pumba.v1', JSON.stringify({ onboarded: true, theme: 'pumba' })); sessionStorage.s = 1; } });
    await p.goto(APP); await p.evaluate(seed); await p.evaluate(setup, name); await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}${dev}-${name}.png` });
    await ctx.close();
  }
}
// Icono 512 y gráfico destacado 1024×500
const p = await b.newPage({ viewport: { width: 1024, height: 500 } });
await p.goto('file://' + ROOT + 'assets/icon-only.png');
await p.setViewportSize({ width: 512, height: 512 });
await p.screenshot({ path: OUT + 'icono-512.png', clip: { x: 0, y: 0, width: 512, height: 512 } });
const q = await b.newPage({ viewport: { width: 1024, height: 500 } });
await q.setContent(`<html><body style="margin:0;width:1024px;height:500px;background:radial-gradient(circle at 30% 50%,#264d78,#10233d 70%);font-family:system-ui,Roboto,sans-serif;display:flex;align-items:center;gap:56px;padding:0 70px;box-sizing:border-box;color:#f2f5fa">
  <img src="data:image/png;base64,${readFileSync(ROOT + 'assets/icon-only.png').toString('base64')}" style="width:300px;height:300px;border-radius:64px;box-shadow:0 18px 50px rgba(0,0,0,.45)">
  <div><div style="font-size:112px;font-weight:900;letter-spacing:2px;color:#ff9f1c;line-height:1">PUMBA</div>
  <div style="font-size:36px;font-weight:600;margin-top:18px;line-height:1.25">Juega contra la máquina<br>y lleva los puntos</div>
  <div style="font-size:24px;color:#a5b6cc;margin-top:18px">Baraja española · Sin anuncios</div></div></body></html>`, { waitUntil: 'domcontentloaded' });
await q.waitForTimeout(500);
await q.screenshot({ path: OUT + 'grafico-destacado-1024x500.png' });
await b.close();
console.log('Listo: play-store/');
