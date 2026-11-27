"use client";

/**
 * Leitura de anexos no navegador: o arquivo não sai do aparelho; só o texto extraído segue
 * com a pergunta. PDF com camada de texto é lido direto pelo pdf.js; página sem texto
 * (digitalizada) e imagem passam pelo OCR do Tesseract, em português. Tudo servido pelo
 * próprio site, em /vendor (ver scripts/copiar-ocr.mjs).
 */
import type { Worker as TesseractWorker } from "tesseract.js";

export const LIMITE_TEXTO = 12000;
export const LIMITE_ARQUIVO = 15 * 1024 * 1024;
export const MAX_PAGINAS = 20;
export const TIPOS_ACEITOS = "application/pdf,image/png,image/jpeg,image/webp";

const base = () => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/vendor`;

export type Progresso = (etapa: string, fracao: number) => void;

let ocr: Promise<TesseractWorker> | null = null;
function workerOcr() {
  ocr ??= import("tesseract.js").then(({ createWorker }) =>
    createWorker("por", 1, {
      workerPath: `${base()}/tesseract/worker.min.js`,
      corePath: `${base()}/tesseract/core`,
      langPath: `${base()}/tesseract/lang`,
      gzip: true,
      workerBlobURL: false,
    }),
  );
  ocr.catch(() => (ocr = null));
  return ocr;
}

async function reconhecer(imagem: HTMLCanvasElement | File | Blob) {
  const w = await workerOcr();
  const { data } = await w.recognize(imagem);
  return data.text;
}

/** Junta as linhas soltas e tira espaços repetidos, sem desfazer parágrafos. */
const limpar = (t: string) =>
  t
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

async function lerPdf(arquivo: File, progresso: Progresso) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${base()}/pdf.worker.min.mjs`;
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
  const doc = await tarefa.promise;
  const total = Math.min(doc.numPages, MAX_PAGINAS);
  const partes: string[] = [];
  let usouOcr = false;
  for (let n = 1; n <= total; n++) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    let texto = conteudo.items.map((i) => ("str" in i ? i.str + (i.hasEOL ? "\n" : " ") : "")).join("");
    // Página digitalizada: quase nenhum caractere na camada de texto. Renderiza e passa no OCR.
    if (texto.replace(/\s/g, "").length < 20) {
      usouOcr = true;
      progresso(`Lendo a página ${n} de ${total} com OCR`, (n - 1) / total);
      const vp = pagina.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = vp.width;
      canvas.height = vp.height;
      await pagina.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
      texto = await reconhecer(canvas);
    } else progresso(`Lendo a página ${n} de ${total}`, (n - 1) / total);
    partes.push(texto);
    if (partes.join("\n").length > LIMITE_TEXTO) break;
  }
  const paginas = doc.numPages;
  await tarefa.destroy();
  return { texto: partes.join("\n\n"), paginas, usouOcr };
}

export interface Leitura {
  texto: string;
  /** O texto passou do limite e foi cortado. */
  cortado: boolean;
  usouOcr: boolean;
  paginas?: number;
}

export async function lerAnexo(arquivo: File, progresso: Progresso = () => {}): Promise<Leitura> {
  if (arquivo.size > LIMITE_ARQUIVO) throw new Error("Arquivo acima de 15 MB.");
  let bruto: string;
  let usouOcr = true;
  let paginas: number | undefined;
  if (arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)) {
    const r = await lerPdf(arquivo, progresso);
    ({ usouOcr, paginas } = r);
    bruto = r.texto;
  } else if (arquivo.type.startsWith("image/")) {
    progresso("Lendo a imagem com OCR", 0);
    bruto = await reconhecer(arquivo);
  } else throw new Error("Use PDF, PNG, JPG ou WebP.");
  const texto = limpar(bruto);
  if (!texto) throw new Error("Não encontrei texto legível no arquivo.");
  progresso("Pronto", 1);
  return { texto: texto.slice(0, LIMITE_TEXTO), cortado: texto.length > LIMITE_TEXTO, usouOcr, paginas };
}
