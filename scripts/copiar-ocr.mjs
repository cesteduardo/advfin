// Copia para public/vendor/ os arquivos que o navegador baixa ao ler anexos: o worker do
// pdf.js, o worker e o núcleo WebAssembly do Tesseract e o modelo de português. Ficam no
// próprio site (nada de CDN): o anexo é lido no navegador e não sai dele até a pergunta.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (p) => join(raiz, "node_modules", p);
const destino = join(raiz, "public", "vendor");
const arquivos = [
  [nm("pdfjs-dist/build/pdf.worker.min.mjs"), "pdf.worker.min.mjs"],
  [nm("tesseract.js/dist/worker.min.js"), "tesseract/worker.min.js"],
  [nm("tesseract.js-core/tesseract-core-lstm.wasm.js"), "tesseract/core/tesseract-core-lstm.wasm.js"],
  [nm("tesseract.js-core/tesseract-core-simd-lstm.wasm.js"), "tesseract/core/tesseract-core-simd-lstm.wasm.js"],
  [nm("tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js"), "tesseract/core/tesseract-core-relaxedsimd-lstm.wasm.js"],
  [nm("@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz"), "tesseract/lang/por.traineddata.gz"],
];
for (const [de, para] of arquivos) {
  const alvo = join(destino, para);
  mkdirSync(dirname(alvo), { recursive: true });
  cpSync(de, alvo);
}
console.log(`OCR: ${arquivos.length} arquivos em public/vendor/`);
