'use strict';
/* =====================================================================
   Pumba · Jugar en línea
   Salas con código en el servidor común de IT Canarias (juegos.itcanarias.com,
   repo csuarezsm/juegos-servidor). El servidor reparte y comprueba las jugadas;
   aquí solo se dibuja la mesa.
   © 2026 IT Canarias. Todos los derechos reservados.
   ===================================================================== */
const ONLINE_URL = () => (window.ONLINE_URL !== undefined ? window.ONLINE_URL : 'wss://juegos.itcanarias.com/ws');
const ON = { ws: null, estado: 'desconectado', sala: null, sel: null, say: false, quiere: false, intentos: 0, timer: null, ping: null, ultimoTurno: null, listo: null };

function onToken() {
  S.online = S.online || {};
  if (!S.online.token) {
    const a = new Uint8Array(18); crypto.getRandomValues(a);
    S.online.token = Array.from(a, b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b & 63]).join('');
    save();
  }
  return S.online.token;
}
const onNombre = () => (S.online && S.online.nombre) || '';
const onDisponible = () => !!ONLINE_URL();

/* ---------- Conexión (se reconecta sola) ---------- */
function onConectar() {
  if (!onDisponible()) return;
  ON.quiere = true;
  if (ON.ws && (ON.ws.readyState === 0 || ON.ws.readyState === 1)) return;
  clearTimeout(ON.timer);
  onSetEstado('conectando');
  let ws;
  try { ws = new WebSocket(ONLINE_URL()); } catch (e) { onReintentar(); return; }
  ON.ws = ws;
  ws.onopen = () => {
    ON.intentos = 0; onSetEstado('conectado');
    ws.send(JSON.stringify({ t: 'hola', token: onToken(), nombre: onNombre() }));
    clearInterval(ON.ping); ON.ping = setInterval(() => onEnviar({ t: 'ping' }), 25000);
  };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.t === 'hola') {
      // un servidor que aún no tiene el Pumba: se avisa y se vuelve a probar en un minuto
      if (!Array.isArray(m.juegos) || !m.juegos.includes('pumba')) { ON.listo = false; onSetEstado('preparando'); ON.ws = null; ws.close(); clearTimeout(ON.timer); if (ON.quiere) ON.timer = setTimeout(onConectar, 60000); return; }
      ON.listo = true; onSetEstado('conectado');
      return;
    }
    if (m.t === 'sala') { ON.listo = true; onRecibirSala(m.sala); }
    else if (m.t === 'error') toast(m.msg);
    else if (m.t === 'fuera') { toast(m.motivo || 'Has salido de la partida'); onRecibirSala(null); }
  };
  ws.onclose = () => { if (ON.ws !== ws) return; clearInterval(ON.ping); ON.ws = null; onSetEstado('desconectado'); if (ON.quiere) onReintentar(); };
  ws.onerror = () => {};
}
function onReintentar() {
  clearTimeout(ON.timer);
  const ms = Math.min(15000, 1000 * 2 ** ON.intentos++);
  ON.timer = setTimeout(onConectar, ms);
}
function onEnviar(m) {
  if (!ON.ws || ON.ws.readyState !== 1) { if (m.t !== 'ping') toast('Sin conexión con el servidor. Reintentando…'); onConectar(); return false; }
  ON.ws.send(JSON.stringify(m)); return true;
}
function onSetEstado(e) {
  if (e === 'desconectado' && ON.listo === false) e = 'preparando';
  ON.estado = e;
  document.querySelectorAll('#onJoin, #onCreate').forEach(b => { b.disabled = e === 'preparando'; });
  const el = $('#onStatus'); if (el) el.innerHTML = onEstadoHtml();
}
const onEstadoHtml = () => ({ conectado: '🟢 Conectado', conectando: '🟡 Conectando…', desconectado: '🔴 Sin conexión · reintentando', preparando: '🛠 El Pumba en línea estará disponible muy pronto' })[ON.estado];
document.addEventListener('visibilitychange', () => { if (!document.hidden && ON.quiere && ON.estado !== 'conectado') { ON.intentos = 0; onConectar(); } });

function onRecibirSala(sala) {
  const antes = ON.sala;
  ON.sala = sala;
  S.online = S.online || {}; S.online.enSala = !!sala; save();
  if (sala && sala.partida) {
    const p = sala.partida;
    const miTurno = sala.estado === 'jugando' && p.turno === sala.yo && p.fase === 'play';
    const clave = p.mano + '|' + p.turnos;
    if (miTurno && ON.ultimoTurno !== clave) { ON.ultimoTurno = clave; AvisoTurno.sonar(); }   // sonido y vibración (se quita en ajustes)
    if (!miTurno || (ON.sel && !(p.jugables || []).includes(ON.sel))) ON.sel = null;
    if (!miTurno || !p.miMano || p.miMano.length !== 2) ON.say = false;
    if (p.olvido && p.olvido !== sala.yo && p.miMano && (!antes || !antes.partida || antes.partida.olvido !== p.olvido)) vibrate([20, 40, 20]);
    if (sala.estado === 'fin') onArchivar(p);
  }
  if (!sala && !antes) return;
  if (!S.game) render();
}

/* ---------- Al terminar: la partida pasa al historial y al ranking ---------- */
function onArchivar(p) {
  if (!p.partida) return;
  const g = p.partida, id = 'on-' + g.id;
  if (S.archive.some(a => a.id === id)) return;
  const R = compute(g);
  S.archive.unshift({ id, created: g.created, cfg: g.cfg, players: g.players, firstDealer: g.firstDealer, events: g.events, online: true,
    finished: Date.now(), hands: R.hand, winnerName: R.ended ? pname(g, R.ended.winner) : '(sin terminar)' });
  if (S.archive.length > MAX_ARCHIVE) S.archive.length = MAX_ARCHIVE;
  save();
}

/* ---------- Pantallas ---------- */
function renderOnline() {
  S.online = S.online || {};
  if (S.draft.mode === 'online' || ON.sala) { if (!ON.quiere) onConectar(); }
  const s = ON.sala;
  if (!s) return onRenderInicio();
  if (s.estado === 'espera') return onRenderEspera(s);
  return onRenderMesa(s);
}

function onRenderInicio() {
  $('#subtitle').textContent = 'Jugar en línea';
  const o = Object.assign({ limite: 100, reenganches: 1, figuras: 'cara', sotaLibre: true, cierreCastigo: true, nivel: 'normal' }, (S.online && S.online.opciones) || {});
  const seg = (id, val, opts) => `<span class="kinds" data-on="${id}" style="flex:none;width:58%;margin:0">${opts.map(([v, t]) => `<button data-v="${v}" class="${String(v) === String(val) ? 'on' : ''}">${t}</button>`).join('')}</span>`;
  $('#app').innerHTML = `${modeToggleHtml()}
    <div class="sec"><h2>Tu nombre</h2>
      <input id="onName" maxlength="20" placeholder="Cómo te verán los demás" value="${esc(onNombre())}" autocomplete="off" style="width:100%">
    </div>
    <div class="sec"><h2>Unirse a una partida</h2>
      <div class="mut" style="margin-bottom:8px">Pide el código a quien la ha creado.</div>
      <div class="row" style="gap:8px"><input id="onCode" maxlength="4" placeholder="Código" autocomplete="off" autocapitalize="characters" style="flex:1;min-width:0;width:0;text-transform:uppercase;letter-spacing:4px;font-weight:700;text-align:center">
      <button class="btn-gold" id="onJoin" style="flex:1;min-width:0" ${ON.estado === 'preparando' ? 'disabled' : ''}>Unirse</button></div>
    </div>
    <div class="sec"><h2>Crear una partida</h2>
      <label class="f"><span>Eliminado al pasar de</span><input type="number" inputmode="numeric" id="onLim" value="${o.limite}"></label>
      <label class="f"><span>Reenganches por jugador</span>${seg('reenganches', o.reenganches, [[0, '0'], [1, '1'], [2, '2'], [3, '3']])}</label>
      <label class="f"><span>Valor de las figuras</span>${seg('figuras', o.figuras, [['cara', '10 · 11 · 12'], ['diez', 'Todas 10']])}</label>
      <label class="f"><span>🎨 La sota</span>${seg('sotaLibre', o.sotaLibre, [[true, 'Se echa siempre'], [false, 'Palo o número']])}</label>
      <label class="f"><span>Cerrar con un 2<em>¿El siguiente roba antes de contar?</em></span>${seg('cierreCastigo', o.cierreCastigo, [[true, 'Sí'], [false, 'No']])}</label>
      <label class="f"><span>Nivel de la máquina<em>Si rellenas sillas con la máquina</em></span>${seg('nivel', o.nivel, [['facil', 'Fácil'], ['normal', 'Normal'], ['dificil', 'Difícil']])}</label>
      <button class="btn-gold" id="onCreate" style="width:100%;margin-top:8px" ${ON.estado === 'preparando' ? 'disabled' : ''}>Crear partida</button>
    </div>
    <div class="mut" style="text-align:center;margin:0 0 4px">De 2 a 6 jugadores; las sillas libres las puede ocupar la máquina.</div>
    <div class="mut" id="onStatus" style="text-align:center;margin:6px 0 20px">${onEstadoHtml()}</div>`;
  bindModeToggle();
  const nameOk = () => { const n = $('#onName').value.trim().slice(0, 20); if (!n) { toast('Escribe tu nombre'); $('#onName').focus(); return null; } S.online.nombre = n; save(); return n; };
  $('#onName').onchange = () => { S.online.nombre = $('#onName').value.trim().slice(0, 20); save(); };
  document.querySelectorAll('[data-on]').forEach(g => g.querySelectorAll('button').forEach(b => b.onclick = () => {
    g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  }));
  const val = id => { const b = document.querySelector(`[data-on="${id}"] .on`); return b ? b.dataset.v : null; };
  $('#onCode').oninput = e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  $('#onJoin').onclick = () => {
    const n = nameOk(); if (!n) return;
    const c = $('#onCode').value.trim().toUpperCase(); if (c.length !== 4) { toast('El código tiene 4 letras o números'); return; }
    onEnviar({ t: 'unirse', codigo: c, nombre: n });
  };
  $('#onCreate').onclick = () => {
    const n = nameOk(); if (!n) return;
    const opciones = { limite: Math.max(50, Math.min(500, parseInt($('#onLim').value, 10) || 100)), reenganches: +val('reenganches'), figuras: val('figuras'),
      sotaLibre: val('sotaLibre') === 'true', cierreCastigo: val('cierreCastigo') === 'true', nivel: val('nivel') };
    S.online.opciones = opciones; save();
    onEnviar({ t: 'crear', juego: 'pumba', opciones, nombre: n });
  };
}

function onRenderEspera(s) {
  $('#subtitle').textContent = 'Partida en línea · esperando';
  const host = s.asientos.find(a => a.anfitrion);
  $('#app').innerHTML = `
    <div class="sec" style="text-align:center"><div class="mut">Código de la partida</div>
      <div class="on-code" id="onCodeBig">${esc(s.codigo)}</div>
      <button class="btn-gold" id="onInvite" style="width:100%">📲 Enviar el código (WhatsApp…)</button>
      <div class="mut" style="margin-top:8px">Los demás abren Pumba → <b>En línea</b> → <b>Unirse</b> y ponen el código.</div></div>
    <div class="sec"><h2>Jugadores (${s.asientos.length}/${s.max})</h2>
      ${s.asientos.map(a => `<div class="on-seat"><span class="on-dot ${a.conectado ? 'ok' : ''}"></span><span class="n">${esc(a.nombre)}${a.id === s.yo ? ' <small>(tú)</small>' : ''}${a.anfitrion ? ' 👑' : ''}</span>
        ${s.anfitrion && a.id !== s.yo ? `<button class="btn-ghost sm" data-quitar="${a.id}" aria-label="Quitar">✕</button>` : ''}</div>`).join('')}
      ${s.anfitrion && s.asientos.length < s.max ? '<button class="btn-ghost" id="onBot" style="width:100%;margin-top:8px">🤖 Añadir a la máquina</button>' : ''}
    </div>
    ${s.anfitrion
      ? `<button class="btn-gold" id="onStart" style="width:100%" ${s.asientos.length >= s.min ? '' : 'disabled'}>Empezar la partida</button>
         <div class="mut" style="text-align:center;margin-top:6px">${s.asientos.length < s.min ? 'Espera a que entre alguien o añade a la máquina.' : 'Cuando estéis todos, pulsa Empezar.'}</div>`
      : `<div class="sec" style="text-align:center">⏳ Esperando a que ${esc(host ? host.nombre : 'el anfitrión')} empiece la partida…</div>`}
    <button class="btn-ghost" id="onLeave" style="width:100%;margin-top:12px">Salir</button>
    <div class="mut" id="onStatus" style="text-align:center;margin:10px 0 20px">${onEstadoHtml()}</div>`;
  $('#onInvite').onclick = () => onInvitar(s.codigo);
  const b = $('#onBot'); if (b) b.onclick = () => onEnviar({ t: 'bot' });
  const st = $('#onStart'); if (st) st.onclick = () => onEnviar({ t: 'empezar' });
  document.querySelectorAll('[data-quitar]').forEach(x => x.onclick = () => onEnviar({ t: 'quitar', asiento: x.dataset.quitar }));
  $('#onLeave').onclick = () => confirmBox('Salir', 'Saldrás de esta partida.', 'Salir', () => { onEnviar({ t: 'salir' }); });
}

async function onInvitar(codigo) {
  const enlace = (typeof isPlay === 'function' && isPlay()) ? '🤖 Android: ' + PLAY_URL + '\n🍏 iPhone: ' + WEB_URL : DESCARGA_URL;
  const text = `🃏 ¡Juega al Pumba conmigo!\n\nAbre la app Pumba → En línea → Unirse y pon el código:\n\n*${codigo}*\n\n¿No tienes la app? Es gratis, para Android e iPhone:\n${enlace}`;
  try {
    if (isNative()) { await window.Capacitor.Plugins.Share.share({ title: 'Partida de Pumba', text, dialogTitle: 'Invitar' }); return; }
    if (navigator.share) { await navigator.share({ title: 'Partida de Pumba', text }); return; }
    await navigator.clipboard.writeText(text); toast('Invitación copiada');
  } catch (e) { if (!/cancel|abort/i.test(String(e && (e.message || e.name)))) toast('No se pudo compartir'); }
}

function onRenderMesa(s) {
  const p = s.partida, yo = s.yo;
  const nombre = id => { const j = p.jugadores.find(x => x.id === id); return j ? j.nombre : '?'; };
  const asiento = id => s.asientos.find(a => a.id === id) || {};
  FIG_TEN = p.reglas && p.reglas.figuras === 'diez';
  $('#subtitle').textContent = s.estado === 'fin' ? 'Partida en línea · terminada' : 'Mano ' + p.mano + ' · en línea · ' + s.codigo;
  const cs = CARD_SIZES.find(x => x[0] === String(S.cardScale || '1')) || CARD_SIZES[0];
  const over = p.fase === 'over';
  const miTurno = s.estado === 'jugando' && p.turno === yo && !over;
  const mine = p.miMano ? arrangeHand(p.miMano) : null;
  const ok = miTurno ? (p.jugables || []) : [];
  const mustDraw = miTurno && (!ok.length || p.castigo > 0);
  const needSay = miTurno && mine && mine.length === 2;
  const canClaim = p.olvido && p.olvido !== yo && !!p.miMano && !over;
  const rivales = p.jugadores.filter(j => j.id !== yo);
  const yoJ = p.jugadores.find(j => j.id === yo);

  let centro = '';
  if (s.estado === 'fin') centro = onFinHtml(s, p, nombre);
  else if (over) centro = onResultadoHtml(s, p, nombre);

  let hint = '';
  if (!p.miMano) hint = 'Estás eliminado: mirando la partida.';
  else if (!miTurno) hint = 'Juega ' + esc(nombre(p.turno)) + (asiento(p.turno).conectado === false ? ' (sin conexión: si tarda, juega la máquina por él)' : '') + '…';
  else if (p.castigo) hint = ok.length ? `Te toca robar <b>${p.castigo}</b> o responder con un <b>2</b>.` : `No tienes un 2: roba <b>${p.castigo}</b> y pierdes el turno.`;
  else if (!ok.length) hint = 'No tienes jugada: <b>roba</b> una carta y pasa el turno.';
  else hint = ON.sel ? 'Pulsa <b>Echar</b>.' : 'Elige una carta que coincida en <b>palo</b> o en <b>número</b>, o <b>roba</b> y pasa.';
  if (needSay && !mustDraw) hint += ON.say ? ' <b>¡Pumba! dicho.</b>' : ' Si echas la penúltima, di <b>«¡Pumba!»</b>.';
  const dirTxt = p.jugadores.filter(j => j.enMano).length > 2 ? (p.sentido > 0 ? '↻ Sentido horario' : '↺ Sentido contrario') : '';

  $('#app').innerHTML = `<div class="on-bar"><span>Partida <b>${esc(s.codigo)}</b></span><span id="onStatus">${onEstadoHtml()}</span></div>
    ${centro || `<div class="pt-table" style="--cs:${cs[0]}"><div class="pt-l">
    <div class="pt-opps">${rivales.map(j => `<div class="pt-opp ${p.turno === j.id && !over ? 'turn' : ''}">
        <div class="pt-on">${asiento(j.id).conectado === false ? '📵 ' : ''}${esc(j.nombre)}${j.cartas === 1 ? ' <span class="pt-pb">¡1!</span>' : ''}</div>
        <div class="pt-ot">${j.fuera ? 'eliminado' : j.total + ' pts · ' + j.cartas + ' carta' + (j.cartas === 1 ? '' : 's')}</div>
        <div class="pt-ob">${'<i></i>'.repeat(Math.min(10, j.cartas))}</div></div>`).join('')}</div>
    <div class="pt-mid">
      <div class="pt-pile"><button class="pt-btn ${mustDraw ? 'go' : ''}" id="pDeck" ${miTurno ? '' : 'disabled'}>${backHtml(p.mazo)}</button><small>Mazo</small></div>
      <div class="pt-pile"><div class="pt-top">${cardHtml(p.mesa)}${p.castigo ? `<span class="pt-pen">+${p.castigo}</span>` : ''}</div><small>Mesa</small></div>
    </div>
    <div class="pt-state">${p.palo ? suitBadge(p.palo) : ''}${dirTxt ? `<span class="pt-dir">${dirTxt}</span>` : ''}</div>
    <div class="pt-log">${esc(p.log || '')}</div></div><div class="pt-r">
    ${canClaim ? `<button class="btn-red pt-claim" id="pClaim">📣 ¡${esc(nombre(p.olvido))} no ha dicho Pumba!</button>` : ''}
    <div class="pt-hint">${hint}</div>
    ${mine ? `<div class="pt-hand ${cs[0] !== '1' ? 'big' : ''} ${mine.length > 8 ? 'many' : ''}">${mine.map(id => cardHtml(id, { sel: id === ON.sel, ok: miTurno && ok.includes(id), dim: miTurno && !ok.includes(id), isNew: (p.nueva || []).includes(id), data: `data-card="${id}"` })).join('')}</div>
    <div class="pt-info">Llevas <b>${yoJ ? yoJ.total : 0}</b> · en la mano <b>${handPoints(p.miMano)}</b> pts · ${p.mazo} en el mazo · <button class="pt-learn" id="pSize">🔍 Cartas: ${cs[1]}</button></div>
    <div class="pt-acts">
      <button class="btn-ghost" id="pScore">📋 Puntos</button>
      <button class="${ON.say ? 'btn-gold' : 'btn-ghost'} pt-say" id="pSay" ${needSay && !mustDraw ? '' : 'disabled'}>${ON.say ? '✓ ¡Pumba!' : '📣 ¡Pumba!'}</button>
      ${miTurno ? `<button class="${mustDraw ? 'btn-gold' : 'btn-ghost'}" id="pDraw">${p.castigo ? 'Robar ' + p.castigo : 'Robar'}</button>` : ''}
      <button class="btn-gold" id="pPlay" ${miTurno && ON.sel ? '' : 'disabled'}>Echar</button>
    </div>` : `<div class="pt-acts"><button class="btn-ghost" id="pScore">📋 Puntos</button><button class="btn-ghost" id="onLeave2">Salir</button></div>`}</div></div>`}`;

  const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
  const robar = () => { if (mustDraw) return onEnviar({ t: 'jugada', a: { tipo: 'robar' } });
    confirmBox('Robar y pasar', 'Tienes carta para echar. Si robas, coges una carta y pasas el turno.', 'Robar', () => onEnviar({ t: 'jugada', a: { tipo: 'robar' } })); };
  on('pDeck', robar); on('pDraw', robar);
  document.querySelectorAll('[data-card]').forEach(b => b.onclick = () => {
    if (!miTurno) return;
    const id = b.dataset.card;
    if (!ok.includes(id)) { toast(p.castigo ? 'Solo puedes responder con un 2' : 'Esa carta no coincide en palo ni en número'); return; }
    ON.sel = ON.sel === id ? null : id; vibrate(8); render();
  });
  on('pSay', () => { ON.say = true; vibrate([20, 30, 20]); toast('📣 ¡Pumba!'); render(); });
  on('pClaim', () => { onEnviar({ t: 'jugada', a: { tipo: 'reclamar' } }); vibrate(40); });
  on('pPlay', () => {
    const c = ON.sel; if (!c) return;
    const go = palo => { ON.sel = null; const say = ON.say; ON.say = false; onEnviar({ t: 'jugada', a: { tipo: 'echar', carta: c, palo, pumba: say } }); };
    if (card(c).r === 10 && !p.castigo && p.miMano.length > 1) {
      openModal(`<h3>🎨 ¿Qué palo pides?</h3><div class="sub">Con la sota eliges el palo que hay que seguir.</div>
        <div class="pt-suits">${SUITS.map(x => `<button data-suit="${x}">${SUIT_SVG[x]}<b>${SUIT_NAME[x]}</b></button>`).join('')}</div>
        <div class="acts"><button class="btn-ghost" id="suC">Cancelar</button></div>`);
      $('#suC').onclick = closeModal;
      document.querySelectorAll('[data-suit]').forEach(b => b.onclick = () => { closeModal(); go(b.dataset.suit); });
      return;
    }
    go(null);
  });
  on('pSize', () => { const i = CARD_SIZES.indexOf(cs); S.cardScale = CARD_SIZES[(i + 1) % CARD_SIZES.length][0]; save(); render(); });
  on('pScore', () => onPuntos(p, nombre));
  on('prNext', () => onEnviar({ t: 'jugada', a: { tipo: 'listo' } }));
  on('prRebuy', () => onEnviar({ t: 'jugada', a: { tipo: 'reenganche' } }));
  on('onLeave2', () => confirmBox('Salir', 'Saldrás de la partida en línea.', 'Salir', () => onEnviar({ t: 'salir' })));
  on('onAgain', () => { onEnviar({ t: 'salir' }); S.draft.mode = 'online'; save(); });
}

function onResultadoHtml(s, p, nombre) {
  const r = p.resultado, yo = s.yo;
  const titulo = r.cierra ? (r.cierra === yo ? '¡Te has quedado sin cartas!' : esc(nombre(r.cierra)) + ' cierra la mano') : 'Mano terminada';
  const rows = Object.keys(r.manos).sort((a, b) => r.puntos[a] - r.puntos[b]).map(pid => {
    const cards = r.manos[pid], pts = r.puntos[pid], j = p.jugadores.find(x => x.id === pid);
    return `<div class="hrow"><div class="top"><div class="n">${r.cierra === pid ? '✓ ' : ''}${esc(nombre(pid))}<small>${r.cierra === pid ? 'Se quedó sin cartas' : cards.length + ' carta' + (cards.length === 1 ? '' : 's')}${r.victima === pid ? ' · robó ' + r.extra + ' por el 2' : ''} · total ${j.total}${j.fuera ? ' · eliminado' : ''}</small></div>
      <b style="color:${pts ? 'var(--gold)' : 'var(--ok)'};font-size:calc(20px * var(--fs, 1))">+${pts}</b></div>
      ${cards.length ? `<div class="pt-hand mini">${arrangeHand(cards).map(id => cardHtml(id, { small: true })).join('')}</div>` : ''}</div>`;
  }).join('');
  const listo = p.listos.includes(yo);
  const humanos = s.asientos.filter(a => !a.bot && a.conectado);
  const faltan = humanos.filter(a => !p.listos.includes(a.id)).map(a => a.nombre);
  return `<div class="sec"><h2 style="margin-bottom:4px">${titulo}</h2><div class="mut" style="margin-bottom:10px">Mano ${p.mano} anotada.${p.puedeReenganchar ? ' Has pasado de ' + p.limite + ': puedes reengancharte si quieres.' : ''}</div>${rows}
    <div class="on-acts">${p.puedeReenganchar ? `<button class="btn-ghost" id="prRebuy">Reenganchar (${p.puntosReenganche})</button>` : ''}
      ${listo ? `<div class="mut" style="flex:1;text-align:center">⏳ Esperando a ${esc(faltan.join(', ') || 'los demás')}…</div>` : '<button class="btn-gold" id="prNext">Seguir</button>'}</div></div>`;
}

function onFinHtml(s, p, nombre) {
  const orden = p.jugadores.slice().sort((a, b) => (a.fuera - b.fuera) || (a.total - b.total));
  return `<div class="sec" style="text-align:center"><div style="font-size:48px">🏆</div><h2>${p.fin.ganador === s.yo ? '¡Has ganado!' : esc(nombre(p.fin.ganador)) + ' gana la partida'}</h2>
    <div class="mut">${p.mano} manos jugadas. Guardada en tu historial y en el ranking.</div></div>
    <div class="sec">${orden.map(j => `<div class="top" style="padding:6px 0"><div class="n">${j.id === p.fin.ganador ? '🏆 ' : ''}${esc(j.nombre)}${j.reenganches ? ' <small style="display:inline">↻' + j.reenganches + '</small>' : ''}</div><b style="${j.fuera ? 'color:var(--red)' : ''}">${j.total}</b></div>`).join('')}</div>
    <button class="btn-gold" id="onAgain" style="width:100%">Otra partida en línea</button>`;
}

function onPuntos(p, nombre) {
  const ids = p.jugadores.map(j => j.id);
  openModal(`<h3>📋 Puntuaciones</h3><div class="tbl-wrap"><table><thead><tr><th>#</th>${ids.map(id => `<th>${esc(nombre(id))}</th>`).join('')}</tr></thead><tbody>
    ${p.historial.map(h => `<tr><td>${h.n}</td>${ids.map(id => `<td>${h.puntos[id] == null ? '' : (h.cierra === id ? '✓' : '') + h.puntos[id]}</td>`).join('')}</tr>`).join('')}
    <tr><td><b>Σ</b></td>${p.jugadores.map(j => `<td><b>${j.total}</b></td>`).join('')}</tr></tbody></table></div>
    <div class="mut" style="margin-top:6px">Límite: ${p.limite} puntos · reenganches por jugador: ${p.reglas ? p.reglas.reenganches : 1}.</div>
    <div class="acts">${ON.sala && ON.sala.estado === 'jugando' ? '<button class="btn-ghost" id="onLeave3">Abandonar</button>' : ''}<button class="btn-gold" id="psOk">Volver a la mesa</button></div>`);
  $('#psOk').onclick = closeModal;
  const l = $('#onLeave3'); if (l) l.onclick = () => { closeModal(); confirmBox('Abandonar la partida', 'Tu silla la ocupará la máquina hasta el final.', 'Abandonar', () => onEnviar({ t: 'salir' })); };
}

// Al abrir la app: si estabas en una partida en línea, vuelve a ella
document.addEventListener('DOMContentLoaded', () => { try { if (S.online && S.online.enSala) onConectar(); } catch (e) {} });
