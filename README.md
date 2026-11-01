# Pumba

Juego de cartas Pumba para Android: partida contra la máquina y marcador de puntos para jugar con baraja de verdad.
App Capacitor + web (`www/`). No usa servidor: todos los datos se guardan en el móvil.
Paquete: `com.itcanarias.pumba` · versión 1.4.3

**iPhone y navegadores**: la misma app se publica como versión web instalable en https://csuarezsm.github.io/Pumba/app/ (GitHub Pages, carpeta `docs/app`, copia de `www/`). En Safari: Compartir → «Añadir a pantalla de inicio». Tras cambiar `www/`, ejecuta `npm run web` antes del commit: las pruebas y el workflow comprueban que `docs/app` está al día. La página de descarga (https://csuarezsm.github.io/Pumba/) ofrece Android e iPhone, y el mensaje de «Compartir la app» enlaza a ella.

© 2026 IT Canarias. Todos los derechos reservados.

## Qué hace

- **Jugar en línea**: salas con código para 2 a 6 jugadores en el servidor común de IT Canarias (`wss://juegos.itcanarias.com/ws`, repo `csuarezsm/juegos-servidor`), con la máquina en las sillas libres. El servidor reparte y comprueba cada jugada con el mismo motor que la app; «¡Pumba!» se puede reclamar fuera de turno. El cliente está en `www/online.js`.
- **Jugar contra la máquina**: de 1 a 5 rivales (de 2 a 6 jugadores) y tres niveles (fácil, normal y difícil). Tiene modo aprendizaje y botón «¡Pumba!», y puedes reclamar a un rival que no lo ha dicho.
- **Llevar los puntos**: anotas cada mano. Quien se queda sin cartas no suma y los demás suman lo que tienen en la mano. Se lleva quién da y quién sale.
- **Eliminación y reenganche**: queda eliminado quien pasa de 100 (con 100 justos sigue). El reenganche es opcional: el eliminado vuelve con la puntuación más alta de los que siguen. El límite de reenganches se configura (1 por defecto).
- **Clasificación**: ranking, jornadas, récords, ficha de cada jugador, partidas compartidas con el grupo y copia de seguridad automática.
- **Pantalla**: temas de colores, tamaño de letra y de cartas, uso en horizontal y en tablet, y márgenes para las barras de Android.

## Reglas del juego (`www/juego.js`)

Se basan en «Pumba – Normas» v0.1 y en las decisiones que cerramos después:

| | |
|---|---|
| Baraja | Española de 40 cartas (sin 8, 9 ni comodines), 5 cartas por jugador |
| Primera carta | Si es especial (2, 3, sota o caballo), vuelve al mazo y se saca otra |
| Quién empieza | El siguiente al que reparte, en sentido horario. El reparto rota en cada mano |
| Turno | Echas una carta del mismo palo o número, o robas una y pasas (también si tienes jugada; la app pide confirmación). La carta robada no se puede echar en ese turno |
| 2 | El siguiente roba 2 o responde con otro 2. Los doses se acumulan y quien roba pierde el turno. El 2 se echa cumpliendo palo o número |
| 3 | Cambia el sentido. Con 2 jugadores no hace nada |
| Sota | Eliges el palo. No libra del castigo del 2. *Opción*: se echa siempre (por defecto) o solo cumpliendo palo o número |
| Caballo | Salta al siguiente |
| Rey | Sin efecto |
| ¡Pumba! | Hay que decirlo al echar la penúltima. Se puede reclamar hasta que el siguiente eche carta o robe, y vale la primera reclamación. Quien lo olvidó roba 2 |
| Cierre | La última carta tiene que cumplir. *Opción*: si se cierra con un 2, el siguiente roba el castigo antes de contar (por defecto sí) |
| Puntos | Cada carta vale su número; sota 10, caballo 11 y rey 12. *Opción*: todas las figuras valen 10 |
| Mazo agotado | Se barajan las cartas de la mesa menos la última |

Si cambia una regla, hay que tocar `www/juego.js` (motor y máquina) y `openGameRules()` en `www/index.html` (texto de ayuda). **Para el juego en línea**, copia `www/marcador.js` y `www/juego.js` a `motores/pumba/` de `csuarezsm/juegos-servidor` y reinstala el servidor en el VPS (`cd /opt/juegos-servidor && git pull && bash despliegue/instalar-vps.sh`). Las pruebas de la app juegan en línea contra una copia local de ese servidor con las reglas de la app. Las pruebas de `tests/app.test.mjs` comprueban cada regla.

## Publicar una versión

1. Sube `versionCode` y `versionName` en `android/app/build.gradle`.
2. Pon el mismo número en `APP_VERSION` (`www/index.html`) y en `CACHE` (`www/sw.js`).
3. Haz push a `main`. El workflow `.github/workflows/android.yml`:
   - pasa las **pruebas automáticas** (`npm test`); si alguna falla, no se publica nada;
   - compila el **APK** (`pumba.apk`, sabor `github`, con actualizador) y el **AAB** para Google Play (`pumba-play.aab`, sabor `play`, sin actualizador ni donativo, Android 16 / API 36);
   - los firma con la clave fija y crea la Release `vX.Y.Z`. La app instalada la detecta y se actualiza sola.

### Secretos del repositorio (Settings → Secrets and variables → Actions)

- `ANDROID_KEYSTORE_BASE64`: el archivo `pumba-release.jks` en base64.
- `ANDROID_KEYSTORE_PASSWORD`: su contraseña (alias de la clave: `pumba`).

**Guarda el `.jks` y la contraseña en un lugar seguro.** Si se pierden, las versiones de GitHub ya instaladas no podrán actualizarse sin desinstalar la app.

## Desarrollo local

```bash
npm install
npm test                  # pruebas (Playwright 1.63 + Chromium)
npx cap sync android
npx cap open android      # Android Studio
npm run icons             # iconos y splash a partir de assets/
```

## Google Play

`play-store/` tiene la ficha (`FICHA-GOOGLE-PLAY.md`), el icono de 512, el gráfico destacado y las capturas de móvil y de tablet de 7" y 10". Para regenerarlas: `node play-store/capturas.mjs`.

## Web

- `docs/index.html`: página de descarga (GitHub Pages).
- `docs/privacidad.html`: política de privacidad (la pide Google Play).
- `docs/descargas.html`: contador de descargas del APK.

## Más juegos de IT Canarias

En el menú ⋮ → «🎲 Más juegos de IT Canarias» y en la página de descarga aparecen los otros juegos (Ajedrez, Damas, Chinchón, Pumba). El código es `www/masjuegos.js`, **el mismo archivo en todas las apps**, con la lista y los iconos (`www/juegos/`) dentro para que funcione sin conexión. Con internet, la app lee como mucho cada 12 horas el catálogo común `https://csuarezsm.github.io/juegos-servidor/juegos.json` (repo `juegos-servidor`, carpeta `docs/`): un juego nuevo añadido allí aparece en todas las apps sin actualizarlas. En Android, si el otro juego está instalado, el botón lo abre (plugin `OtrasApps` y `<queries>` del manifiesto); si no, lleva a su página de descarga, o a Google Play si el catálogo tiene su enlace `play` y esta es la versión de Play. En iPhone abre su versión web.

## Aviso de turno en línea

En una partida en línea, cuando pasa a ser tu turno suena un «ding-dong» corto y el móvil vibra (`www/turno.js`, el mismo archivo en todas las apps; sonido sintetizado). Se quita en ⋮ → Colores… → «🔔 Aviso de turno en línea». Suena con la app abierta; con la app en segundo plano el sistema puede pausarla.

## Idiomas (español e inglés)

⋮ → «🌐 Idioma · Language». La primera vez se usa el idioma del móvil (español si empieza por «es»; si no, inglés). La app está escrita en español y `www/idioma.js` traduce lo que se ve con el diccionario `www/i18n-en.js` (los dos, **los mismos archivos en todas las apps**): textos, plantillas con datos ({1}, {2}…), mensajes para compartir, imágenes, fechas y números. Cuando se añade o cambia un texto en español, hay que añadir su traducción al diccionario común (`comun/` en el chat de desarrollo) y copiarlo a todas las apps. Para otro idioma: un `i18n-<código>.js` y su nombre en `IDIOMAS` de `idioma.js`.

## Idiomas, invitaciones y avisos (noviembre 2026)

- **Idiomas**: español, inglés, francés, alemán e italiano (`www/i18n-*.js`, comunes a todas las apps). La primera vez se usa el del móvil.
- **Invitar con enlace** (`www/invitacion.js`, común): el mensaje lleva `https://csuarezsm.github.io/<repo>/unirse.html?c=CÓDIGO` (`docs/unirse.html`). En Android abre la app en la partida (`itc<juego>://unirse/CÓDIGO`, filtro en `AndroidManifest.xml`) o, si no está instalada, la página de descarga; en iPhone y ordenador abre la versión web ya dentro de la partida (`app/?unirse=CÓDIGO`).
- **Aviso de turno** (`www/turno.js`, común): sonido y vibración cuando te toca, en línea y contra la máquina. Se quita en ⋮ → Colores… → «🔔 Aviso de turno».
- **Nombre de la máquina**: al jugar contra la máquina se le puede poner nombre o elegir uno al azar (🎲).
- **Sonidos** de cartas (`www/sonidos-cartas.js`, común con Chinchón) y **velocidad de la máquina** en ⋮ → Colores…; en línea, si no pulsas «Seguir» al acabar una mano, te lo recuerda con un aviso. Al eliminado que no se reengancha no se le espera.
