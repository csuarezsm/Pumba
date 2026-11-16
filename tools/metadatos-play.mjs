// Prepara la carpeta que se sube a Google Play (textos, imágenes, vídeo y notas de versión) a partir de play-store/.
// Uso: node tools/metadatos-play.mjs [carpeta de salida]   (la usan los flujos de GitHub Actions)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url)), PS = ROOT + 'play-store/';
const OUT = (process.argv[2] || ROOT + 'build/play-metadata') + '/', IDIOMA = process.env.PLAY_IDIOMA || 'es-ES';
const D = OUT + IDIOMA + '/'; rmSync(OUT, { recursive: true, force: true }); mkdirSync(D + 'changelogs', { recursive: true });
const md = readFileSync(PS + 'FICHA-GOOGLE-PLAY.md', 'utf8');
const trozo = (desde, hasta) => { const i = md.indexOf(desde); if (i < 0) throw new Error('Falta en la ficha: ' + desde); const j = md.indexOf(hasta, i + desde.length); return md.slice(md.indexOf('\n', i) + 1, j).trim(); };
const titulo = trozo('**Nombre de la aplicación**', '**Descripción breve**'), breve = trozo('**Descripción breve**', '**Descripción completa**'), completa = trozo('**Descripción completa**', '## Datos de la ficha');
if (titulo.length > 30 || breve.length > 80 || completa.length > 4000) throw new Error(`Textos demasiado largos: nombre ${titulo.length}/30, breve ${breve.length}/80, completa ${completa.length}/4000`);
writeFileSync(D + 'title.txt', titulo); writeFileSync(D + 'short_description.txt', breve); writeFileSync(D + 'full_description.txt', completa);
const fv = PS + 'video-url.txt', video = existsSync(fv) ? readFileSync(fv, 'utf8').trim() : '';
if (video) writeFileSync(D + 'video.txt', video);
// imágenes, con los nombres que espera Google Play
mkdirSync(D + 'images', { recursive: true });
copyFileSync(PS + 'icono-512.png', D + 'images/icon.png'); copyFileSync(PS + 'grafico-destacado-1024x500.png', D + 'images/featureGraphic.png');
for (const [pre, dir] of [['movil-', 'phoneScreenshots'], ['tablet7-', 'sevenInchScreenshots'], ['tablet10-', 'tenInchScreenshots']]) {
  const fs = readdirSync(PS).filter(f => f.startsWith(pre) && f.endsWith('.png')).sort(); if (fs.length > 8 || (!fs.length && pre === 'movil-')) throw new Error(`Capturas ${pre}: ${fs.length} (de móvil tiene que haber de 2 a 8; las de tablet son opcionales)`);
  if (fs.length) mkdirSync(D + 'images/' + dir, { recursive: true });
  fs.forEach((f, i) => copyFileSync(PS + f, `${D}images/${dir}/${i + 1}_${f}`));
}
// notas de la versión: la primera línea del último commit (es lo que lee el jugador)
const code = readFileSync(ROOT + 'android/app/build.gradle', 'utf8').match(/versionCode (\d+)/)[1];
let nota = ''; try { nota = execSync('git log -1 --pretty=%s', { cwd: ROOT }).toString().trim(); } catch (e) {}
writeFileSync(`${D}changelogs/${code}.txt`, (nota || 'Mejoras y correcciones.').slice(0, 500));
console.log(`Ficha lista en ${OUT}: «${titulo}», ${completa.length} caracteres, versión ${code}${video ? ', con vídeo' : ', sin vídeo (falta play-store/video-url.txt)'}`);
