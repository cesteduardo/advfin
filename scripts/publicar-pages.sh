#!/usr/bin/env bash
# Gera a landing estática e publica no branch gh-pages (GitHub Pages servindo de branch, sem Actions).
set -euo pipefail
raiz=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
cp -r "$raiz"/. "$tmp/src-copia"
cd "$tmp/src-copia"
rm -rf src/app/api .next out
GITHUB_PAGES=1 npx next build
touch out/.nojekyll
cd out
git init -q -b gh-pages
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-AdvFin}" -c user.email="${GIT_AUTHOR_EMAIL:-noreply@users.noreply.github.com}" commit -q -m "Landing estática $(git -C "$raiz" rev-parse --short HEAD)"
git push -f "$(git -C "$raiz" remote get-url origin)" gh-pages
