// Pruebas automáticas de Pumba (IT Canarias)
// Se ejecutan en GitHub antes de compilar: si alguna falla, no se publica la versión.
// Uso local: node tests/app.test.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../www/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  try { const f = await readFile(join(ROOT, path === '/' ? 'index.html' : path)); res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' }); res.end(f); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, r));
const URL_APP = `http://localhost:${server.address().port}/`;

let passed = 0, failed = 0;
const check = (name, cond, extra = '') => { if (cond) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); if (process.env.GITHUB_ACTIONS) console.log('::error::' + (name + (extra ? ' → ' + extra : '')).replace(/\n/g, ' ').slice(0, 900)); } };
// En GitHub, cualquier fallo inesperado sale también como aviso en la ejecución
for (const ev of ['uncaughtException', 'unhandledRejection']) process.on(ev, e => { if (process.env.GITHUB_ACTIONS) console.log('::error::' + String(e && e.stack || e).replace(/\n/g, ' ').slice(0, 900)); console.error(e); process.exit(1); });

const browser = await chromium.launch();
async function fresh(state) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', acceptDownloads: true });
  await ctx.route('https://api.github.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ tag_name: 'v0.0.1', assets: [] }) }));
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(st => { if (st && !sessionStorage.getItem('seeded')) { localStorage.setItem('pumba.v1', JSON.stringify(st)); sessionStorage.setItem('seeded', '1'); } }, state || { onboarded: true });
  await p.goto(URL_APP);
  return { p, ctx, errors };
}
const totals = p => p.evaluate(() => { const R = compute(S.game); return Object.fromEntries(S.game.players.map(x => [x.name, R.st[x.id].total])); });
const keys = async (p, s) => { for (const ch of s) await p.click(`[data-k="${ch}"]`); };
async function startGame(p, names, dealer = 0) {
  for (const [i, n] of names.entries()) { if (!(await p.$(`[data-name="${i}"]`))) await p.click('#addP'); await p.fill(`[data-name="${i}"]`, n); }
  if (dealer) await p.click(`[data-deal="${dealer}"]`);
  await p.click('#start');
}
async function hand(p, pts, closer, kind) {
  await p.click('#addHand');
  if (closer) { await p.click(`[data-close="${await p.evaluate(n => S.game.players.find(x => x.name === n).id, closer)}"]`); if (kind) await p.click(`[data-kind="${kind}"]`); }
  for (const [name, v] of Object.entries(pts)) {
    const id = await p.evaluate(n => S.game.players.find(x => x.name === n).id, name);
    await p.click(`[data-sc="${id}"]`);
    await keys(p, String(v));
  }
  await p.click('#hSave');
  await p.waitForTimeout(50);
}


console.log('Puntuación, eliminación, reparto y reenganche');
{
  const { p, ctx, errors } = await fresh();
  await startGame(p, ['Carlos', 'Ana', 'Pepe', 'Lola'], 1);
  await hand(p, { Carlos: 12, Pepe: 40, Lola: 25 }, 'Ana');
  await hand(p, { Ana: 8, Pepe: 50, Lola: 20 }, 'Carlos');
  await hand(p, { Carlos: 20, Ana: 45, Pepe: 15 }, 'Lola');
  const t = await totals(p);
  check('quien cierra no suma y los demás sí', t.Carlos === 32 && t.Ana === 53 && t.Pepe === 105 && t.Lola === 45, JSON.stringify(t));
  const st = await p.evaluate(() => { const R = compute(S.game); return { out: S.game.players.filter(x => R.st[x.id].out).map(x => x.name), next: S.game.players.find(x => x.id === R.next).name }; });
  check('Pepe eliminado al pasar de 100', st.out.join() === 'Pepe', st.out.join());
  check('el reparto pasa al siguiente (Ana → Pepe → Lola → Carlos)', st.next === 'Carlos', st.next);
  check('el reenganche es opcional: la partida sigue sin él', await p.evaluate(() => !compute(S.game).ended && !!document.querySelector('[data-rebuy]')));
  const pepe = await p.evaluate(() => S.game.players.find(x => x.name === 'Pepe').id);
  await p.click(`[data-rebuy="${pepe}"]`); await p.click('#cOk');
  check('reenganche con la puntuación más alta de los que siguen', (await totals(p)).Pepe === 53);
  check('no se puede reenganchar dos veces (límite 1)', await p.evaluate(id => { S.game.events.push({ t: 'hand', dealer: S.game.players[0].id, closer: null, kind: 'normal', scores: Object.fromEntries(S.game.players.map(x => [x.id, x.id === id ? 60 : 0])) }); const R = compute(S.game); const r = canRebuy(S.game, R, id); S.game.events.pop(); return !r; }, pepe));
  await hand(p, { Carlos: 68, Ana: 0, Pepe: 0 }, 'Lola');
  check('con 100 justos se sigue jugando', await p.evaluate(() => { const R = compute(S.game); const c = S.game.players.find(x => x.name === 'Carlos').id; return R.st[c].total === 100 && !R.st[c].out; }));
  check('sin errores de JavaScript', !errors.length, errors.join(' | '));
  await ctx.close();
}

console.log('Varios pasan de 100 en la misma mano');
{
  const { p, ctx, errors } = await fresh();
  await startGame(p, ['A', 'B', 'C', 'D']);
  await hand(p, { A: 95, B: 90, C: 40 }, 'D');
  await hand(p, { A: 10, B: 20, C: 30 }, 'D');
  const r = await p.evaluate(() => { const g = S.game, R = compute(g), id = n => g.players.find(x => x.name === n).id;
    return { out: g.players.filter(x => R.st[x.id].out).map(x => x.name).join(), canA: canRebuy(g, R, id('A')), canB: canRebuy(g, R, id('B')), score: rebuyScore(g, R), ended: !!R.ended }; });
  check('los dos quedan eliminados a la vez', r.out === 'A,B', JSON.stringify(r));
  check('los dos pueden reengancharse con el máximo de los que siguen (70)', r.canA && r.canB && r.score === 70, JSON.stringify(r));
  await hand(p, { C: 40 }, 'D');
  check('si no se reenganchan y queda uno, la partida termina', await p.evaluate(() => { const R = compute(S.game); return R.ended && pname(S.game, R.ended.winner) === 'D'; }));
  check('el número máximo de reenganches se puede configurar', await p.evaluate(() => { S.game.cfg.maxRebuys = 3; const R = compute(S.game); return /Reenganches por jugador/.test(cfgFields(S.game.cfg, 'x_')); }));
  check('sin errores de JavaScript', !errors.length, errors.join(' | '));
  await ctx.close();
}

console.log('Teclado, deshacer y corrección');
{
  const { p, ctx, errors } = await fresh();
  await startGame(p, ['A', 'B', 'C']);
  await p.click('#addHand'); await keys(p, '12'); await p.click('#kNext'); await keys(p, '7'); await p.click('#kNext'); await keys(p, '459'); await p.click('[data-k="del"]');
  check('máximo 3 cifras y borrar', (await p.$$eval('[data-sc]', e => e.map(x => x.textContent))).join() === '12,7,45');
  await p.click('#hSave'); await p.waitForTimeout(50);
  check('aparece «Deshacer»', await p.$eval('#undoBar', b => b.classList.contains('on')));
  await p.click('#undoBtn');
  check('deshacer quita la mano', await p.evaluate(() => S.game.events.length === 0));
  await p.click('#addHand'); await keys(p, '5'); await p.click('#hSave');
  check('avisa si falta una puntuación', /Falta/.test(await p.textContent('#hErr')));
  await p.click('#hCancel');
  await hand(p, { A: 10, B: 20, C: 30 });
  await p.click('tr.hand'); const cId = await p.evaluate(() => S.game.players[2].id);
  await p.click(`[data-sc="${cId}"]`); await p.click('[data-k="del"]'); await p.click('[data-k="del"]'); await keys(p, '31'); await p.click('#hSave');
  check('corregir una mano recalcula', (await totals(p)).C === 31);
  check('sin errores de JavaScript', !errors.length, errors.join(' | '));
  await ctx.close();
}

// genera un historial de ejemplo determinista
const seedArchive = () => {
  const names = ['Carlos', 'Tere', 'Aitor', 'Lola']; let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const mk = (ts, players) => { const ps = players.map(n => ({ id: uid(), name: n })); const g = { id: uid(), created: ts, cfg: Object.assign({}, DEF_CFG), players: ps, firstDealer: ps[0].id, events: [] };
    let guard = 0; while (!compute(g).ended && guard++ < 80) { const R = compute(g); const act = R.active; const closer = act[Math.floor(rnd() * act.length)].id; const sc = {}; act.forEach(p => sc[p.id] = p.id === closer ? Math.floor(rnd() * 5) : Math.floor(rnd() * 45)); g.events.push({ t: 'hand', dealer: R.next, closer, kind: 'normal', scores: sc }); }
    const R = compute(g); return { ...g, finished: ts, hands: R.hand, winnerName: pname(g, R.ended.winner) }; };
  const base = new Date(2026, 8, 1, 21).getTime();
  for (let d = 0; d < 30; d += 3) for (let i = 0; i < 4; i++) S.archive.unshift(mk(base + d * 864e5 + i * 40 * 60e3, names));
  S.archive.unshift(mk(base + 31 * 864e5, ['Carlos', 'Pepe']));
  save(); render();
};

console.log('Clasificación, ficha, récords y jugadores');
{
  const { p, ctx, errors } = await fresh();
  await p.evaluate(seedArchive);
  const rank = await p.evaluate(() => aggregate(S.archive.map(gameResult).filter(Boolean)).sort((a, b) => b.rating - a.rating).map(o => [o.name, o.pj]));
  check('ranking con todos los jugadores', rank.length === 5, JSON.stringify(rank));
  check('quien juega 1 partida no lidera', rank[0][0] !== 'Pepe');
  check('jornadas agrupadas (de 6:00 a 6:00)', await p.evaluate(() => new Set(S.archive.map(a => jornadaKey(a.finished))).size === 11));
  await p.click('#menuBtn'); await p.click('#mArch');
  await p.click('#modal [data-player="Tere"]');
  check('ficha del jugador', /Cara a cara/.test(await p.textContent('#modal')));
  await p.click('#pfBack'); await p.click('#modal [data-tab="records"]');
  check('récords', (await p.$$('#modal .hrow')).length >= 6);
  await p.click('#modal [data-tab="jornadas"]'); await p.click('#modal [data-tab="partidas"]'); await p.click('#aC');
  await p.evaluate(() => { S.archive[0].players[0].name = 'carlos '; S.roster = ['Carlos', 'Tere', 'Aitor', 'Lola', 'Teresa']; S.archive[1].players.find(x => x.name === 'Tere').name = 'Teresa'; save(); render(); });
  await p.click('#manageRoster'); await p.fill('[data-orig="Teresa"]', 'Tere'); await p.click('#roS'); await p.click('#cOk');
  check('unir «Teresa» con «Tere»', await p.evaluate(() => !S.archive.some(a => a.players.some(x => x.name === 'Teresa')) && !S.roster.includes('Teresa')));
  check('nombres con mayúsculas o espacios cuentan como el mismo jugador', await p.evaluate(() => aggregate(S.archive.map(gameResult).filter(Boolean)).filter(o => nkey(o.name) === 'carlos').length === 1));
  check('sin errores de JavaScript', !errors.length, errors.join(' | '));
  await ctx.close();
}

console.log('Copias, grupo y borrar datos');
{
  const { p, ctx, errors } = await fresh();
  await p.evaluate(seedArchive);
  const json = await p.evaluate(() => backupJSON());
  const { p: p2, ctx: ctx2, errors: e2 } = await fresh();
  const n1 = await p2.evaluate(j => { const n = mergeBackup(JSON.parse(j)); save(); return n; }, json);
  const n2 = await p2.evaluate(j => mergeBackup(JSON.parse(j)), json);
  check('recibir partidas del grupo', n1 === 41, String(n1));
  check('recibir dos veces no duplica', n2 === 0 && (await p2.evaluate(() => S.archive.length)) === 41);
  check('se recuperan los jugadores habituales', await p2.evaluate(() => S.roster.includes('Tere')));
  check('rechaza archivos que no son copias', await p2.evaluate(() => !validBackup({ foo: 1 })));
  const evil = JSON.stringify({ app: 'pumba-marcador', archive: [{ id: 'x"><img src=x onerror=window.__pwn=1>', created: 1, finished: 1, cfg: { limit: '<b>', closeBonus: '"><svg onload=window.__pwn=1>' },
    players: [{ id: '"><img src=x onerror=window.__pwn=1>', name: '<img src=x onerror=window.__pwn=1>' }, { id: 'b', name: 'B' }],
    firstDealer: 'b', events: [{ t: 'hand', dealer: 'b', closer: 'b', kind: 'x', scores: { b: 0, '"><img src=x onerror=window.__pwn=1>': '<img src=x onerror=window.__pwn=1>' } }] }],
    game: { id: 'g', players: [{ id: '"><b>', name: '<script>window.__pwn=1</script>' }, { id: 'c', name: 'C' }], events: [], cfg: { limit: '"><img src=x onerror=window.__pwn=1>' } } });
  const { p: p3, ctx: ctx3 } = await fresh();
  await p3.evaluate(j => { mergeBackup(JSON.parse(j)); save(); render(); }, evil);
  await p3.click('#menuBtn'); await p3.click('#mArch'); await p3.click('#modal [data-tab="partidas"]'); await p3.click('#modal [data-arch]'); await p3.waitForTimeout(150);
  await p3.click('#arClose'); await p3.click('#aC'); await p3.click('#addHand'); await p3.waitForTimeout(150);
  check('un archivo manipulado no puede inyectar código', await p3.evaluate(() => !window.__pwn && !document.querySelector('#app img, #modal img, #app svg[onload]')));
  check('los datos manipulados se limpian', await p3.evaluate(() => S.game && typeof S.game.cfg.limit === 'number' && S.archive[0].players.every(x => /^[A-Za-z0-9_-]+$/.test(x.id)) && !/[<>]/.test(S.archive[0].players.map(x => x.name).join(''))));
  await ctx3.close();
  await p2.click('#menuBtn'); await p2.click('#mWipe'); await p2.click('#wHist'); await p2.click('#cOk');
  check('borrar solo el historial', await p2.evaluate(() => S.archive.length === 0 && S.roster.length > 0));
  await p2.click('#menuBtn'); await p2.click('#mWipe'); await p2.click('#wAll'); await p2.click('#cOk'); await p2.click('#cOk');
  await p2.waitForLoadState('load'); await p2.waitForTimeout(200);
  check('borrar todo deja la app como nueva', await p2.evaluate(() => !S.archive.length && !S.game && !S.roster.length));
  check('sin errores de JavaScript', !errors.length && !e2.length, errors.concat(e2).join(' | '));
  await ctx.close(); await ctx2.close();
}

console.log('Bienvenida, actualizaciones y tamaño de letra');
{
  const { p, ctx, errors } = await fresh({});
  await p.waitForTimeout(600);
  check('bienvenida la primera vez', /Bienvenido/.test(await p.textContent('#modal')));
  for (let i = 0; i < 5; i++) await p.click('#wbNext');
  await p.click('#wbNext');
  check('la bienvenida no vuelve a salir', await p.evaluate(() => S.onboarded === true));
  check('comparar versiones', await p.evaluate(() => cmpVer('1.10.0', '1.9.9') > 0 && cmpVer('2.0.0', '2.0.0') === 0 && cmpVer('1.4.2', '1.5.0') < 0));
  await p.evaluate(() => { S.fontScale = '1.3'; applyFont(); render(); });
  check('con letra muy grande no se sale de la pantalla', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('sin errores de JavaScript', !errors.length, errors.join(' | '));
  await ctx.close();
}


console.log('Reglas del Pumba');
{
  const { p, ctx, errors } = await fresh();
  // Mesa preparada a mano: jugadores a, b, c… con las cartas que se indiquen
  await p.evaluate(() => {
    window.mk = (hands, top, opts) => {
      const ids = Object.keys(hands), players = ids.map(id => ({ id, name: id.toUpperCase() }));
      const g = { id: uid(), created: 1, cfg: Object.assign({}, DEF_CFG), players, firstDealer: ids[ids.length - 1], events: [], play: Object.assign(newPlay({}, ids.slice(1)), opts || {}) };
      const used = new Set([...Object.values(hands).flat(), top]);
      g.play.hand = { dealer: ids[ids.length - 1], order: ids, dir: 1, hands: JSON.parse(JSON.stringify(hands)), deck: newDeck().filter(x => !used.has(x)), pile: [top], suit: top[0], penalty: 0, turn: ids[0], phase: 'play', turns: 0, passes: 0, said: {}, forgot: null, lacks: {}, log: '', result: null };
      return g;
    };
  });
  const r = await p.evaluate(() => {
    const out = {};
    let g = mk({ a: ['o5', 'c4', 'e12', 'b10', 'c2'], b: ['o1', 'o2', 'o3'], c: ['e1', 'e3', 'e4'] }, 'o4');
    out.valid = ['o5', 'c4', 'e12', 'b10', 'c2'].filter(id => canPlay(g, g.play.hand, id)).join();
    g.play.sotaFree = false; out.validStrict = ['o5', 'c4', 'e12', 'b10', 'c2'].filter(id => canPlay(g, g.play.hand, id)).join();
    const g2 = mk({ a: ['o5', 'c4'], b: ['o1', 'c7'] }, 'o4'); out.drawAnyway = drawTurn(g2, 'a') && g2.play.hand.hands.a.length === 3 && g2.play.hand.turn === 'b' && !(g2.play.hand.lacks.a || []).length;
    // 2 + 2 acumulados: c no tiene 2, roba 4 y pierde el turno
    g = mk({ a: ['o2', 'o5', 'o6'], b: ['c2', 'c5', 'c6'], c: ['e1', 'e3', 'e4'] }, 'o4');
    playCard(g, 'a', 'o2', null, false); out.pen1 = g.play.hand.penalty + g.play.hand.turn;
    out.only2 = !canPlay(g, g.play.hand, 'c5') && canPlay(g, g.play.hand, 'c2');
    playCard(g, 'b', 'c2', null, false); out.pen2 = g.play.hand.penalty + g.play.hand.turn;
    out.sotaNoSalva = !canPlay(g, g.play.hand, 'e10');
    drawTurn(g, 'c'); out.after = g.play.hand.hands.c.length + g.play.hand.turn + g.play.hand.penalty;
    // 3: cambia el sentido con 3 jugadores; con 2 no
    g = mk({ a: ['o3', 'o5', 'o6'], b: ['o1', 'c5', 'c6'], c: ['e1', 'o7', 'e4'] }, 'o4');
    playCard(g, 'a', 'o3', null, false); out.rev = g.play.hand.turn + g.play.hand.dir;
    g = mk({ a: ['o3', 'o5', 'o6'], b: ['o1', 'c5', 'c6'] }, 'o4');
    playCard(g, 'a', 'o3', null, false); out.rev2 = g.play.hand.turn + g.play.hand.dir;
    // caballo: salta al siguiente
    g = mk({ a: ['o11', 'o5', 'o6'], b: ['o1', 'c5', 'c6'], c: ['e1', 'o7', 'e4'] }, 'o4');
    playCard(g, 'a', 'o11', null, false); out.skip = g.play.hand.turn;
    // sota: elige el palo
    g = mk({ a: ['c10', 'o5', 'o6'], b: ['o1', 'c5', 'b6'], c: ['e1', 'o7', 'e4'] }, 'o4');
    playCard(g, 'a', 'c10', 'b', false); out.suit = g.play.hand.suit + canPlay(g, g.play.hand, 'b6') + canPlay(g, g.play.hand, 'o1');
    // si no puede jugar, roba una y pasa aunque le sirva
    g = mk({ a: ['c5', 'c6'], b: ['o1', 'c7'] }, 'o4'); g.play.hand.deck.unshift('o12');
    drawTurn(g, 'a'); out.drawPass = g.play.hand.hands.a.includes('o12') && g.play.hand.turn === 'b';
    return out;
  });
  check('se echa carta del mismo palo o número; la sota se echa siempre', r.valid === 'o5,c4,b10', JSON.stringify(r));
  check('opción: la sota también tiene que cumplir palo o número', r.validStrict === 'o5,c4', r.validStrict);
  check('se puede robar y pasar aunque se tenga jugada', r.drawAnyway);
  check('el 2 obliga al siguiente a robar dos o responder con otro 2', r.pen1 === '2b' && r.only2, JSON.stringify(r));
  check('los doses se acumulan', r.pen2 === '4c', r.pen2);
  check('la sota no libra del castigo del 2', r.sotaNoSalva);
  check('quien roba el castigo pierde el turno', r.after === '7a0', r.after);
  check('el 3 cambia el sentido', r.rev === 'c-1', r.rev);
  check('con dos jugadores el 3 no tiene efecto', r.rev2 === 'b1', r.rev2);
  check('el caballo salta al siguiente', r.skip === 'c', r.skip);
  check('la sota cambia el palo', r.suit === 'btruefalse', r.suit);
  check('si no puede jugar, roba una y pasa aunque le sirva', r.drawPass);

  const q = await p.evaluate(() => {
    const out = {};
    // ¡Pumba! olvidado: se reclama y roba dos
    let g = mk({ a: ['o5', 'o6'], b: ['c1', 'c5', 'c6'], c: ['e1', 'e3', 'e4'] }, 'o4');
    playCard(g, 'a', 'o5', null, false); out.forgot = !!g.play.hand.forgot;
    out.claim = claimPumba(g, 'b') && g.play.hand.hands.a.length === 3;
    g = mk({ a: ['o5', 'o6'], b: ['c1', 'c5', 'o7'], c: ['e1', 'e3', 'e4'] }, 'o4');
    playCard(g, 'a', 'o5', null, true); out.said = !g.play.hand.forgot;
    // plazo: cuando el siguiente echa carta, ya no se puede reclamar
    g = mk({ a: ['o5', 'o6'], b: ['c1', 'c5', 'o7'], c: ['e1', 'e3', 'e4'] }, 'o4', { level: 'facil' });
    playCard(g, 'a', 'o5', null, false); const rnd = Math.random; Math.random = () => 0.99;
    playCard(g, 'b', 'o7', null, true); Math.random = rnd; out.late = !claimPumba(g, 'c') && g.play.hand.hands.a.length === 1;
    // cierre: quien se queda sin cartas no suma; los demás suman sus cartas (sota 10, caballo 11, rey 12)
    g = mk({ a: ['o5'], b: ['c1', 'c10', 'c11', 'c12'], c: ['e7', 'e3'] }, 'o4');
    playCard(g, 'a', 'o5', null, false); const ev = g.events[0];
    out.scores = [ev.closer, ev.scores.a, ev.scores.b, ev.scores.c].join();
    g = mk({ a: ['o5'], b: ['c1', 'c10', 'c11', 'c12'], c: ['e7', 'e3'] }, 'o4', { figures: 'ten' });
    playCard(g, 'a', 'o5', null, false); out.ten = g.events[0].scores.b;
    // la última carta tiene que cumplir
    g = mk({ a: ['c5'], b: ['c1'], c: ['e7'] }, 'o4'); out.mustMatch = !playCard(g, 'a', 'c5', null, false) && !g.events.length;
    // cerrar con un 2: el siguiente roba el castigo antes de contar (opción)
    g = mk({ a: ['o2'], b: ['c1', 'c3'], c: ['e7'] }, 'o4'); g.play.hand.deck = ['b4', 'b5', 'b6'].concat(g.play.hand.deck.filter(x => !['b4', 'b5', 'b6'].includes(x)));
    playCard(g, 'a', 'o2', null, false); out.closePen = g.events[0].scores.b;
    g = mk({ a: ['o2'], b: ['c1', 'c3'], c: ['e7'] }, 'o4', { closePenalty: false });
    playCard(g, 'a', 'o2', null, false); out.closeNoPen = g.events[0].scores.b;
    // la primera carta de la mesa nunca es especial
    const gg = { id: 'x', created: 1, cfg: Object.assign({}, DEF_CFG), players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], firstDealer: 'c', events: [], play: newPlay({}, ['b', 'c']) };
    let special = 0, bad = 0;
    for (let k = 0; k < 300; k++) { dealHand(gg); const h = gg.play.hand; if (SPECIAL.includes(card(h.pile[0]).r)) special++; const all = [...h.deck, ...h.pile, ...Object.values(h.hands).flat()]; if (all.length !== 40 || new Set(all).size !== 40 || Object.values(h.hands).some(x => x.length !== 5)) bad++; }
    out.first = special; out.dealBad = bad;
    out.starts = gg.play.hand.turn === 'a' && gg.play.hand.dealer === 'c';
    // mazo agotado: se barajan las de la mesa menos la última
    g = mk({ a: ['c5', 'c6'], b: ['o1'] }, 'o4'); g.play.hand.pile = g.play.hand.deck.concat('o4'); g.play.hand.deck = [];
    drawTurn(g, 'a'); const h = g.play.hand; out.reshuffle = h.pile.length === 1 && h.pile[0] === 'o4' && h.hands.a.length === 3 && h.deck.length === 40 - 3 - 1 - 1;
    return out;
  });
  check('si olvida decir «¡Pumba!» y se lo reclaman, roba dos', q.forgot && q.claim, JSON.stringify(q));
  check('si lo dice, no hay nada que reclamar', q.said);
  check('solo se puede reclamar antes de que el siguiente juegue', q.late);
  check('quien cierra no suma; sota 10, caballo 11 y rey 12', q.scores === 'a,0,34,10', q.scores);
  check('opción: figuras a 10', q.ten === 31, String(q.ten));
  check('la última carta tiene que cumplir palo o número', q.mustMatch);
  check('cerrar con un 2: el siguiente roba dos antes de contar', q.closePen === 4 + 4 + 5, String(q.closePen));
  check('opción: cerrar con un 2 sin castigo', q.closeNoPen === 4, String(q.closeNoPen));
  check('la primera carta de la mesa nunca es especial', q.first === 0, String(q.first));
  check('reparto de 5 cartas sin repetir ni perder ninguna', q.dealBad === 0, String(q.dealBad));
  check('empieza el siguiente al que reparte', q.starts);
  check('mazo agotado: se barajan las de la mesa menos la última', q.reshuffle);

  // Partidas completas entre máquinas (2 a 6 jugadores, los tres niveles)
  const sim = await p.evaluate(() => {
    let games = 0, ended = 0, hands = 0, bad = 0, noCloser = 0, steps = 0;
    for (let k = 0; k < 150; k++) {
      const n = 2 + (k % 5), ps = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: '🤖 ' + i }));
      const g = { id: uid(), created: 1, cfg: Object.assign({}, DEF_CFG, { maxRebuys: k % 3 }), players: ps, firstDealer: ps[0].id, events: [], play: newPlay({ level: ['facil', 'normal', 'dificil'][k % 3], figures: k % 4 ? 'face' : 'ten', sotaFree: k % 5 !== 1, closePenalty: k % 2 === 0 }, ps.map(x => x.id)) };
      let guard = 0;
      while (!compute(g).ended && guard++ < 400) {
        botRebuys(g); if (compute(g).ended) break;
        dealHand(g); const h = g.play.hand;
        let s = 0;
        while (h.phase !== 'over' && s++ < 3000) {
          botStep(g); steps++;
          const all = [...h.deck, ...h.pile, ...Object.values(h.hands).flat()];
          if (all.length !== 40 || new Set(all).size !== 40) { bad++; break; }
          if (h.penalty % 2 || h.penalty < 0) bad++;
        }
        if (h.phase !== 'over') bad++;
        hands++;
        const e = g.events[g.events.length - 1];
        if (!e.closer) noCloser++;
        else if (e.scores[e.closer] !== 0 || h.hands[e.closer].length) bad++;
        for (const pid of h.order) if (pid !== e.closer && e.scores[pid] !== handPoints(h.hands[pid])) bad++;
      }
      games++; if (compute(g).ended) ended++;
    }
    return { games, ended, hands, bad, noCloser, steps };
  });
  check(`150 partidas simuladas sin errores (${sim.hands} manos, ${sim.steps} jugadas)`, sim.bad === 0, JSON.stringify(sim));
  check('todas las partidas simuladas terminan', sim.ended === sim.games, JSON.stringify(sim));
  check('las manos acaban con alguien sin cartas', sim.noCloser <= sim.hands * 0.01, JSON.stringify(sim));
  const duel = await p.evaluate(() => {
    const play = (la, lb, N) => { let wa = 0;
      for (let k = 0; k < N; k++) { const ps = [{ id: 'a' + k, name: 'A' }, { id: 'b' + k, name: 'B' }, { id: 'c' + k, name: 'C' }]; if (k % 2) ps.reverse();
        const g = { id: uid(), created: 1, cfg: Object.assign({}, DEF_CFG, { rebuyMode: 'none' }), players: ps, firstDealer: ps[0].id, events: [], play: newPlay({ level: 'normal' }, ps.map(x => x.id)) };
        let guard = 0;
        while (!compute(g).ended && guard++ < 400) { dealHand(g); const h = g.play.hand; while (h.phase !== 'over') { const pid = h.turn; g.play.level = pid[0] === 'a' ? la : lb; botStep(g); } }
        if (compute(g).ended.winner.startsWith('a')) wa++; }
      return Math.round(wa / N * 1000) / 10; };
    const duel2 = (N) => { let wa = 0;
      for (let k = 0; k < N; k++) { const ps = [{ id: 'a' + k, name: 'A' }, { id: 'b' + k, name: 'B' }]; if (k % 2) ps.reverse();
        const g = { id: uid(), created: 1, cfg: Object.assign({}, DEF_CFG, { rebuyMode: 'none' }), players: ps, firstDealer: ps[0].id, events: [], play: newPlay({ level: 'normal' }, ps.map(x => x.id)) };
        let guard = 0;
        while (!compute(g).ended && guard++ < 400) { dealHand(g); const h = g.play.hand; while (h.phase !== 'over') { g.play.level = h.turn[0] === 'a' ? 'dificil' : 'normal'; botStep(g); } }
        if (compute(g).ended.winner.startsWith('a')) wa++; }
      return Math.round(wa / N * 1000) / 10; };
    return { normal: play('normal', 'facil', 400), hard: play('dificil', 'facil', 400), hardVsNormal: duel2(600) };
  });
  check(`la máquina en normal gana más que en fácil (${duel.normal} % frente a 2 rivales; al azar sería 33 %)`, duel.normal > 36, JSON.stringify(duel));
  check(`la máquina en difícil gana más que en fácil (${duel.hard} %)`, duel.hard > 36, JSON.stringify(duel));
  check(`el nivel difícil gana al normal (${duel.hardVsNormal} % de 600 partidas)`, duel.hardVsNormal > 50, JSON.stringify(duel));
  check('sin errores de JavaScript', !errors.length, errors.join(' | '));
  await ctx.close();
}

console.log('Jugar contra la máquina desde la pantalla');
{
  const { p, ctx, errors } = await fresh();
  await p.evaluate(() => { window.PLAY_DELAY = 10; });
  await p.click('[data-mode="play"]');
  check('sin nombres por defecto', await p.evaluate(() => [...document.querySelectorAll('#plName, [data-botname]')].every(i => i.value === '')));
  check('hasta 5 rivales (6 jugadores)', await p.evaluate(() => document.querySelectorAll('[data-bots]').length === 5));
  await p.fill('#plName', 'Carlos'); await p.click('[data-bots="2"]');
  await p.fill('[data-botname="0"]', 'Chano'); await p.fill('[data-botname="1"]', 'carlos');
  await p.click('#plStart');
  let guard = 0, said = 0, suits = 0;
  while (guard++ < 6000) {
    const st = await p.evaluate(() => { const g = S.game; if (!g || !g.play) return 'nogame'; if (compute(g).ended) return 'ended'; const h = g.play.hand; if (!h) return 'nohand';
      if (h.phase === 'over') return document.querySelector('#prNext') ? 'over' : 'wait';
      if (h.turn !== me(g)) return 'bot';
      return (!playable(g, h, me(g)).length || h.penalty) ? 'draw' : 'play'; });
    if (st === 'ended' || st === 'nogame') break;
    if (st === 'over') { if (await p.$('#prRebuy')) await p.click('#prRebuy'); else await p.click('#prNext'); continue; }
    if (st === 'bot' || st === 'wait' || st === 'nohand') { await p.waitForTimeout(15); continue; }
    if (st === 'draw') { await p.click(guard % 2 ? '#pDraw' : '#pDeck'); continue; }
    const ch = await p.evaluate(() => botChoose(S.game, me(S.game)));
    await p.click(`[data-card="${ch.play}"]`);
    if (await p.evaluate(() => S.game.play.hand.hands[me(S.game)].length === 2)) { await p.click('#pSay'); said++; }
    await p.click('#pPlay');
    if (await p.$('[data-suit]')) { await p.click('[data-suit="c"]'); suits++; }
  }
  const fin = await p.evaluate(() => ({ ended: !!(S.game && compute(S.game).ended), hands: S.game ? compute(S.game).hand : 0 }));
  check(`partida completa jugando desde la pantalla (${fin.hands} manos)`, fin.ended, JSON.stringify(fin));
  check('el botón «¡Pumba!» se usa al quedarse con dos cartas', said > 0, String(said));
  await p.click('#newGame');
  // reclamar un «¡Pumba!» olvidado por la máquina
  await p.click('[data-mode="play"]'); await p.fill('#plName', 'Carlos'); await p.click('[data-bots="1"]'); await p.click('#plStart');
  check('un rival sin nombre se llama «Rival 1»', await p.evaluate(() => S.game.players[1].name === '🤖 Rival 1'), await p.evaluate(() => S.game.players.map(x => x.name).join()));
  await p.evaluate(() => { window.PLAY_DELAY = 100000; const g = S.game, h = g.play.hand, my = me(g), bot = g.play.bots[0];
    h.hands[bot] = h.hands[bot].slice(0, 1); h.forgot = { pid: bot }; h.turn = my; render(); });
  check('aparece el botón para reclamar el «¡Pumba!» olvidado', !!(await p.$('#pClaim')));
  await p.click('#pClaim');
  check('al reclamarlo, el rival roba dos', await p.evaluate(() => S.game.play.hand.hands[S.game.play.bots[0]].length === 3 && !document.querySelector('#pClaim')));
  // modo aprendizaje
  check('por defecto la mesa no sugiere jugadas', await p.evaluate(() => !/💡/.test(document.querySelector('.pt-hint').textContent) && !document.querySelector('.pc-card.tip')));
  await p.evaluate(() => { const g = S.game, h = g.play.hand; h.hands[me(g)] = ['c5', 'c6', 'o1']; h.pile.push('c4'); h.suit = 'c'; h.penalty = 0; render(); });
  await p.click('#pLearn');
  check('con aprendizaje sugiere qué echar', await p.evaluate(() => /💡/.test(document.querySelector('.pt-hint').textContent) && document.querySelector('.pc-card.tip')?.dataset.card === botChoose(S.game, me(S.game)).play));
  await p.click('[data-card="o1"]');
  check('avisa si la carta no vale', await p.evaluate(() => /no coincide/.test(document.querySelector('#toast').textContent)));
  await p.click('#pDraw');
  check('robar teniendo jugada pide confirmación', /Tienes carta para echar/.test(await p.textContent('#modal')));
  await p.click('#cNo');
  check('si se cancela, no roba', await p.evaluate(() => S.game.play.hand.hands[me(S.game)].length === 3));
  await p.click('[data-card="c6"]'); await p.click('#pPlay');
  await p.evaluate(() => { const g = S.game, h = g.play.hand; h.saved = h.hands[me(g)]; h.hands[me(g)] = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o10', 'o11', 'o12', 'c1', 'c3', 'c5', 'c7']; render(); });
  check('con 14 cartas la mano cabe en dos filas', await p.evaluate(() => { const cs = [...document.querySelectorAll('.pt-hand .pc-card')]; const tops = new Set(cs.map(c => Math.round(c.getBoundingClientRect().top))); return cs.length === 14 && tops.size === 2 && cs[0].getBoundingClientRect().width >= 40 && document.documentElement.scrollWidth <= innerWidth; }));
  await p.evaluate(() => { const g = S.game, h = g.play.hand; h.hands[me(g)] = h.saved; delete h.saved; render(); });
  check('echar una carta válida la pone en la mesa', await p.evaluate(() => S.game.play.hand.pile.at(-1) === 'c6'));
  await p.click('#menuBtn'); await p.click('#mEnd'); await p.click('#cOk');
  check('nombres de rivales personalizados y sin repetir', await p.evaluate(() => S.archive[0].players.map(x => x.name).join() === 'Carlos,🤖 Chano,🤖 carlos 2'), await p.evaluate(() => S.archive.map(a => a.players.map(x => x.name).join()).join(' | ')));
  check('las partidas contra la máquina quedan en el historial', await p.evaluate(() => S.archive.length === 1 && S.archive.every(a => a.players.some(x => x.name.startsWith('🤖')))));
  check('los rivales de la máquina no se añaden a jugadores habituales', await p.evaluate(() => !S.roster.some(n => n.startsWith('🤖')) && S.roster.includes('Carlos')));
  // reglas del juego en el menú
  await p.click('#menuBtn'); await p.click('#mGameRules');
  check('las reglas del Pumba están en el menú', /Cartas especiales/.test(await p.textContent('#modal')));
  await p.click('#grOk');
  check('sin errores de JavaScript', !errors.length, errors.join(' | '));
  await ctx.close();
}

// Jugar en línea: dos personas en dos móviles + la máquina, contra una copia local del servidor común
{
  console.log('Jugar en línea');
  const { createRequire } = await import('node:module');
  const os = await import('node:os'); const fs = await import('node:fs');
  const SERV = process.env.JUEGOS_SERVIDOR || fileURLToPath(new URL('../../juegos-servidor/', import.meta.url));
  const motores = fs.mkdtempSync(join(os.tmpdir(), 'motores-'));
  fs.mkdirSync(join(motores, 'pumba'));
  for (const f of ['marcador.js', 'juego.js']) fs.copyFileSync(join(ROOT, f), join(motores, 'pumba', f));   // las reglas de ESTA versión de la app
  for (const j of ['chinchon', 'ajedrez']) fs.cpSync(join(SERV, 'motores', j), join(motores, j), { recursive: true });
  Object.assign(process.env, { PASO_BOT_MS: '30', SEGUIR_MS: '6000', AUSENTE_MS: '800', PAUSA_RECLAMAR_MS: '1500', MOTORES_DIR: motores, DATA_DIR: fs.mkdtempSync(join(os.tmpdir(), 'juegos-')) });
  const req = createRequire(join(SERV, 'package.json'));
  const { crearServidor } = req('./src/server.js');
  const Salas = req('./src/salas.js');
  const { server: js } = crearServidor();
  await new Promise(r => js.listen(0, '127.0.0.1', r));
  const WS = `ws://127.0.0.1:${js.address().port}/ws`;
  const abrir = async () => {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.route('https://api.github.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ tag_name: 'v0.0.1', assets: [] }) }));
    await ctx.addInitScript(u => { window.ONLINE_URL = u; window.PLAY_DELAY = 10; if (!localStorage.getItem('pumba.v1')) localStorage.setItem('pumba.v1', JSON.stringify({ onboarded: true })); }, WS);
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(URL_APP); return { p, ctx, errors };
  };
  const A = await abrir(), B = await abrir();
  await A.p.click('[data-mode="online"]');
  await A.p.waitForSelector('#onStatus:has-text("Conectado")');
  check('el modo en línea conecta con el servidor', true);
  await A.p.click('#onCreate');
  check('pide el nombre antes de crear', await A.p.evaluate(() => !ON.sala));
  await A.p.fill('#onName', 'Carlos'); await A.p.click('[data-on="figuras"] [data-v="diez"]'); await A.p.click('#onCreate');
  await A.p.waitForSelector('#onCodeBig');
  const codigo = (await A.p.textContent('#onCodeBig')).trim();
  check('crea la partida y enseña el código', /^[A-Z2-9]{4}$/.test(codigo), codigo);
  check('las opciones de la partida llegan al servidor', await A.p.evaluate(() => ON.sala.opciones.figuras === 'diez' && ON.sala.max === 6));
  await B.p.click('[data-mode="online"]'); await B.p.fill('#onName', 'Mari'); await B.p.fill('#onCode', codigo.toLowerCase()); await B.p.click('#onJoin');
  await B.p.waitForSelector('text=Esperando a que Carlos empiece');
  check('el segundo móvil entra con el código', true);
  await A.p.waitForSelector('.on-seat >> nth=1');
  await A.p.click('#onBot'); await A.p.waitForSelector('.on-seat >> nth=2');
  check('se añade a la máquina', (await A.p.textContent('.sec:has(.on-seat)')).includes('🤖'));
  await A.p.click('#onStart');
  await A.p.waitForSelector('.pt-table'); await B.p.waitForSelector('.pt-table');
  const manos = await Promise.all([A, B].map(x => x.p.evaluate(() => ON.sala.partida.miMano)));
  check('cada móvil ve sus 5 cartas y no las del otro', manos[0].length === 5 && manos[1].length === 5 && !manos[0].some(c => manos[1].includes(c)));
  // «¡Pumba!» olvidado por Carlos: Mari ve el botón y se lo reclama
  const s = Salas._salas.get(codigo), h = s.estadoJuego.play.hand;
  clearTimeout(s.timer);
  const top = h.pile[h.pile.length - 1];
  h.hands.p1 = [top[0] + (top.slice(1) === '4' ? '5' : '4'), 'b12']; h.turn = 'p1'; h.penalty = 0; h.suit = top[0];
  Salas.jugada(s.asientos.find(x => x.id === 'p1').token, { tipo: 'listo' });   // sin efecto en juego: solo reenvía la vista a todos
  await A.p.waitForFunction(() => ON.sala.partida.turno === ON.sala.yo && ON.sala.partida.miMano.length >= 2).catch(() => {});
  const mia = await A.p.evaluate(() => ON.sala.partida.jugables[0]);
  if (mia) { await A.p.click(`[data-card="${mia}"]`); if (await A.p.$('[data-suit]')) await A.p.click('[data-suit="o"]'); await A.p.click('#pPlay'); if (await A.p.$('[data-suit]')) await A.p.click('[data-suit="o"]'); }
  const vioBoton = await B.p.waitForSelector('#pClaim', { timeout: 4000 }).then(() => true).catch(() => false);
  check('si alguien olvida el «¡Pumba!», los demás ven el botón para reclamarlo', vioBoton, await B.p.evaluate(() => JSON.stringify({ olvido: ON.sala.partida.olvido, log: ON.sala.partida.log })));
  if (vioBoton) {
    const antes = await A.p.evaluate(() => ON.sala.partida.miMano.length);
    await B.p.click('#pClaim');
    await A.p.waitForFunction(n => ON.sala.partida.miMano.length === n + 2, antes, { timeout: 4000 }).catch(() => {});
    check('al reclamarlo, el despistado roba dos', await A.p.evaluate(n => ON.sala.partida.miMano.length === n + 2, antes));
  }
  // juegan los dos desde la pantalla hasta terminar una mano
  const paso = async x => {
    const st = await x.p.evaluate(() => { const s = ON.sala; if (!s || !s.partida) return 'nada'; const p = s.partida; if (p.fase === 'over') return document.querySelector('#prNext') ? 'seguir' : 'nada';
      if (p.olvido && p.olvido !== s.yo && document.querySelector('#pClaim')) return 'reclamar';
      return p.turno === s.yo ? (p.jugables.length && !p.castigo ? 'echar' : 'robar') : 'nada'; });
    const c = { timeout: 500 };
    if (st === 'robar') await x.p.click('#pDraw', c).catch(() => {});
    else if (st === 'reclamar') await x.p.click('#pClaim', c).catch(() => {});
    else if (st === 'echar') {
      const id = await x.p.evaluate(() => ON.sala.partida.jugables[0]);
      await x.p.click(`[data-card="${id}"]`, c).catch(() => {});
      if (await x.p.evaluate(() => ON.sala.partida.miMano.length === 2)) await x.p.click('#pSay', c).catch(() => {});
      await x.p.click('#pPlay:not([disabled])', c).catch(() => {});
      if (await x.p.$('[data-suit]')) await x.p.click('[data-suit="c"]', c).catch(() => {});
    } else if (st === 'seguir') { await x.p.click('#prNext', c).catch(() => {}); return 'seguir'; }
    return st;
  };
  let vista = false, siguientes = 0;
  for (let i = 0; i < 800 && siguientes < 2; i++) {
    for (const x of [A, B]) { if (await x.p.$('#prNext') && (await x.p.textContent('.sec')).includes('anotada')) vista = true; const r = await paso(x); if (r === 'seguir') siguientes++; }
    await A.p.waitForTimeout(20);
  }
  check('al terminar la mano se ven las cartas de todos y los puntos', vista);
  await A.p.waitForFunction(() => ON.sala.partida.fase !== 'over' || ON.sala.estado === 'fin', null, { timeout: 8000 }).catch(() => {});
  check('se reparte la siguiente mano', await A.p.evaluate(() => ON.sala.estado === 'fin' || (ON.sala.partida.mano >= 2 && ON.sala.partida.fase !== 'over')));
  // Mari cierra la app y vuelve: recupera la partida
  const B2 = { p: await B.ctx.newPage(), errors: [] };
  B2.p.on('pageerror', e => B2.errors.push(e.message));
  await B.p.close(); await B2.p.goto(URL_APP);
  await B2.p.waitForSelector('.pt-table, #prNext, #onAgain', { timeout: 8000 }).catch(() => {});
  check('al volver a abrir la app, vuelve a la partida', await B2.p.evaluate(() => !!(ON.sala && ON.sala.codigo)) && (await B2.p.textContent('#subtitle')).includes(codigo));
  // Carlos abandona: su silla la ocupa la máquina
  await A.p.click('#pScore'); await A.p.click('#onLeave3'); await A.p.click('#cOk');
  await A.p.waitForSelector('#onCreate');
  check('al abandonar vuelve a la pantalla de inicio en línea', await A.p.evaluate(() => !ON.sala));
  await B2.p.waitForFunction(() => ON.sala && ON.sala.asientos.find(a => a.id === 'p1').bot, null, { timeout: 5000 }).catch(() => {});
  check('la máquina ocupa la silla de quien abandona', await B2.p.evaluate(() => !!(ON.sala && ON.sala.asientos.find(a => a.id === 'p1').bot)));
  // Mari termina la partida contra la máquina y queda en su historial
  for (let i = 0; i < 2500; i++) {
    if (await B2.p.evaluate(() => !!(ON.sala && ON.sala.estado === 'fin'))) break;
    await paso(B2); await B2.p.waitForTimeout(15);
  }
  check('la partida en línea termina y queda en el historial', await B2.p.evaluate(() => ON.sala && ON.sala.estado === 'fin' && S.archive.some(a => a.online)));
  check('en línea, sin errores de JavaScript', !A.errors.length && !B.errors.length && !B2.errors.length, [...A.errors, ...B.errors, ...B2.errors].join(' | '));
  await A.ctx.close(); await B.ctx.close(); js.close();
  // servidor que aún no tiene el Pumba: la app avisa de que estará disponible pronto y no deja crear
  const { WebSocketServer } = req('ws');
  const viejo = new WebSocketServer({ port: 0 });
  viejo.on('connection', w => w.send(JSON.stringify({ t: 'hola', version: '2.0.0' })));
  await new Promise(r => viejo.on('listening', r));
  const ctxV = await browser.newContext({ viewport: { width: 412, height: 860 }, serviceWorkers: 'block' });
  await ctxV.addInitScript(u => { window.ONLINE_URL = u; localStorage.setItem('pumba.v1', JSON.stringify({ onboarded: true })); }, `ws://127.0.0.1:${viejo.address().port}`);
  const pv = await ctxV.newPage(); await pv.goto(URL_APP); await pv.click('[data-mode="online"]');
  await pv.waitForSelector('#onStatus:has-text("muy pronto")', { timeout: 5000 }).catch(() => {});
  check('con un servidor sin Pumba avisa y no deja crear', /muy pronto/.test(await pv.textContent('#onStatus')) && await pv.$eval('#onCreate', b => b.disabled));
  await ctxV.close(); viejo.close();
}

console.log('Horizontal, tablet y barras de Android');
{
  for (const [w, h, name] of [[860, 400, 'móvil en horizontal'], [800, 1280, 'tablet'], [1280, 800, 'tablet en horizontal']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.addInitScript(() => localStorage.setItem('pumba.v1', JSON.stringify({ onboarded: true })));
    await p.goto(URL_APP); await p.evaluate(() => { window.PLAY_DELAY = 100000; });
    await p.click('[data-mode="play"]'); await p.click('[data-bots="5"]'); await p.click('#plStart');
    const ok = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && !!document.querySelector('.pt-hand') && document.querySelectorAll('.pt-opp').length === 5);
    check(`la mesa cabe en ${name} con 6 jugadores`, ok && !errors.length, errors.join(' | '));
    await ctx.close();
  }
  const html = await (await import('node:fs/promises')).readFile(new URL('../www/index.html', import.meta.url), 'utf8');
  check('márgenes para las barras de Android (safe-area)', /viewport-fit=cover/.test(html) && /env\(safe-area-inset-bottom\)/.test(html) && /env\(safe-area-inset-top\)/.test(html));
}

// Versión de Google Play: sin actualizador propio ni donativos
{
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.addInitScript(() => { localStorage.setItem('pumba.v1', JSON.stringify({ onboarded: true, updAvail: { v: '99.0.0', url: 'x' } }));
    window.Capacitor = { isNativePlatform: () => false, Plugins: { AppUpdater: { info: async () => ({ store: 'play' }), setSystemBars: async () => {} } } }; });
  await p.goto(URL_APP); await p.waitForTimeout(200);
  await p.click('#menuBtn');
  check('Play: el menú no ofrece actualizar', !(await p.$('#mUpd')));
  await p.click('#mAbout');
  check('Play: sin donativo en Acerca de', !(await p.$('#donate')) && /Google Play/.test(await p.textContent('#modal')));
  check('Play: compartir enlaza a Google Play', await p.evaluate(() => isPlay() && !hasUpd()));
  check('© IT Canarias, todos los derechos reservados', /Todos los derechos reservados/.test(await p.textContent('#modal')));
  check('Play: sin errores de JavaScript', !errors.length, errors.join(' | '));
  await ctx.close();
}

await browser.close(); server.close();
console.log(`\n${passed} correctas, ${failed} fallidas`);
process.exit(failed ? 1 : 0);
