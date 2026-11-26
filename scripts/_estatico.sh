# Uso interno: gera out/ estático no próprio repositório, tirando a rota de API do caminho e devolvendo-a ao fim.
construir_estatico() {
  local raiz; raiz=$(git rev-parse --show-toplevel)
  cd "$raiz"
  local guarda; guarda=$(mktemp -d)
  if [ -d src/app/api ]; then mv src/app/api "$guarda/api"; fi
  trap 'if [ -d "'"$guarda"'/api" ]; then mv "'"$guarda"'/api" "'"$raiz"'/src/app/api"; fi' EXIT
  rm -rf .next out
  "$@" npx next build
}
