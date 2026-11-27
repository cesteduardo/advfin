# Uso interno: gera out/ estático no próprio repositório. Tira do caminho tudo o que exige servidor
# (API, área logada, proxy) e devolve ao fim, mesmo se o build falhar. No lugar da área logada entra
# a demonstração estática de src/estatico/app (servida em /app), removida ao fim.
SO_SERVIDOR=("src/app/api" "src/app/(app)" "src/proxy.ts" "src/instrumentation.ts")

construir_estatico() {
  local raiz; raiz=$(git rev-parse --show-toplevel)
  cd "$raiz"
  if [ -e src/app/app ]; then echo "src/app/app já existe; abortando para não apagar nada." >&2; exit 1; fi
  ESTATICO_GUARDA=$(mktemp -d)
  ESTATICO_RAIZ=$raiz
  local i=0
  for p in "${SO_SERVIDOR[@]}"; do
    if [ -e "$p" ]; then mkdir -p "$ESTATICO_GUARDA/$i"; mv "$p" "$ESTATICO_GUARDA/$i/"; echo "$p" > "$ESTATICO_GUARDA/$i.caminho"; fi
    i=$((i + 1))
  done
  cp -R src/estatico/app src/app/app
  trap devolver_servidor EXIT
  rm -rf .next out
  "$@" npx next build
}

devolver_servidor() {
  local f p
  rm -rf "$ESTATICO_RAIZ/src/app/app"
  for f in "$ESTATICO_GUARDA"/*.caminho; do
    [ -e "$f" ] || continue
    p=$(cat "$f")
    mv "${f%.caminho}/$(basename "$p")" "$ESTATICO_RAIZ/$p"
  done
}
