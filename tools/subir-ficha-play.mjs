// Sube la ficha (textos, vídeo, icono, gráfico destacado y capturas) a Google Play con la API oficial, sin depender de que haya una versión publicada.
// Uso: PLAY_JSON='{…clave de la cuenta de servicio…}' node tools/subir-ficha-play.mjs <paquete> <carpeta de metadatos> [idioma]
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createSign } from 'node:crypto';
const [pkg, dir, idioma = 'es-ES'] = process.argv.slice(2);
if (!pkg || !dir || !process.env.PLAY_JSON) { console.error('Faltan el paquete, la carpeta o PLAY_JSON'); process.exit(1); }
const key = JSON.parse(process.env.PLAY_JSON), D = `${dir}/${idioma}/`;
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
async function token() {
  const now = Math.floor(Date.now() / 1000), cab = b64({ alg: 'RS256', typ: 'JWT' }), cuerpo = b64({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3000 });
  const firma = createSign('RSA-SHA256').update(cab + '.' + cuerpo).sign(key.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${cab}.${cuerpo}.${firma}` });
  const j = await r.json(); if (!j.access_token) throw new Error('No se pudo iniciar sesión en Google: ' + (j.error_description || j.error || r.status)); return j.access_token;
}
const T = await token(), API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`, SUBE = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${pkg}`;
async function api(metodo, url, cuerpo, tipo) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { method: metodo, headers: { authorization: 'Bearer ' + T, ...(cuerpo ? { 'content-type': tipo || 'application/json' } : {}) }, body: cuerpo && !tipo ? JSON.stringify(cuerpo) : cuerpo });
    const txt = await r.text(); let j = {}; try { j = txt ? JSON.parse(txt) : {}; } catch (e) {}
    if (r.ok) return j;
    if (r.status >= 500 && i < 3) { await new Promise(s => setTimeout(s, 3000 * (i + 1))); continue; }
    const e = new Error(`Google Play (${r.status}): ${(j.error && j.error.message) || txt.slice(0, 300)}`); e.status = r.status; e.msg = (j.error && j.error.message) || ''; throw e;
  }
}
const lee = f => existsSync(D + f) ? readFileSync(D + f, 'utf8').trim() : '';
const edit = (await api('POST', `${API}/edits`, {})).id;
const ficha = { language: idioma, title: lee('title.txt'), shortDescription: lee('short_description.txt'), fullDescription: lee('full_description.txt') }; if (lee('video.txt')) ficha.video = lee('video.txt');
await api('PUT', `${API}/edits/${edit}/listings/${idioma}`, ficha); console.log(`Textos: «${ficha.title}»${ficha.video ? ' (con vídeo)' : ''}`);
const IM = [['icon', ['icon.png']], ['featureGraphic', ['featureGraphic.png']]];
for (const t of ['phoneScreenshots', 'sevenInchScreenshots', 'tenInchScreenshots']) if (existsSync(`${D}images/${t}`)) IM.push([t, readdirSync(`${D}images/${t}`).filter(f => f.endsWith('.png')).sort((a, b) => parseInt(a) - parseInt(b)).map(f => `${t}/${f}`)]);
for (const [tipo, archivos] of IM) {
  const hay = archivos.filter(f => existsSync(`${D}images/${f}`)); if (!hay.length) continue;
  await api('DELETE', `${API}/edits/${edit}/listings/${idioma}/${tipo}`);
  for (const f of hay) await api('POST', `${SUBE}/edits/${edit}/listings/${idioma}/${tipo}?uploadType=media`, readFileSync(`${D}images/${f}`), 'image/png');
  console.log(`${tipo}: ${hay.length}`);
}
try { await api('POST', `${API}/edits/${edit}:commit`); }
catch (e) { if (!/changesNotSentForReview/.test(e.msg)) throw e; await api('POST', `${API}/edits/${edit}:commit?changesNotSentForReview=true`); console.log('Guardado; Google pide enviar los cambios a revisión desde Play Console (Resumen de publicación).'); }
console.log('Ficha subida a Google Play.');
