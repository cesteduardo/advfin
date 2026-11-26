#!/usr/bin/env bash
# Gera a landing estática e publica no branch gh-pages (GitHub Pages servindo de branch, sem Actions).
# Domínio próprio no Pages: DOMINIO=advfin.com.br BASE_PATH= npm run pages
set -euo pipefail
source "$(dirname "$0")/_estatico.sh"
construir_estatico env GITHUB_PAGES=1
origem=$(git remote get-url origin); versao=$(git rev-parse --short HEAD)
rm -f out/.htaccess out/_headers
touch out/.nojekyll
if [ -n "${DOMINIO:-}" ]; then echo "$DOMINIO" > out/CNAME; fi
cd out
git init -q -b gh-pages
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-AdvFin}" -c user.email="${GIT_AUTHOR_EMAIL:-noreply@users.noreply.github.com}" commit -q -m "Landing estática $versao"
git push -qf "$origem" gh-pages
rm -rf .git
