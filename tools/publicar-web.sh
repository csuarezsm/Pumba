#!/usr/bin/env bash
# Copia la app (www/) a docs/app/ para la versión web instalable (iPhone y navegadores),
# que GitHub Pages publica en https://csuarezsm.github.io/Pumba/app/
# Hay que ejecutarlo antes de cada commit que cambie www/ (las pruebas y el workflow lo comprueban).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf docs/app && cp -r www docs/app
echo "docs/app actualizado"
