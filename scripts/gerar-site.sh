#!/usr/bin/env bash
# Gera a landing estática para a raiz de um domínio próprio e empacota em advfin-site.zip.
# Uso: npm run site                 (domínio na raiz, ex.: advfin.com.br)
#      BASE_PATH=/lp npm run site   (em subdiretório, ex.: grbrands.com.br/lp)
set -euo pipefail
source "$(dirname "$0")/_estatico.sh"
construir_estatico env ESTATICO=1
rm -f advfin-site.zip
(cd out && zip -qr ../advfin-site.zip .)
echo "Pronto: advfin-site.zip. Envie o conteúdo para a pasta pública do domínio (ex.: public_html)."
