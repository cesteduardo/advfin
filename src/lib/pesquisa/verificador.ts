/**
 * Verificador de citações.
 *
 * Função pura. Recebe a resposta do modelo e os trechos que o sistema recuperou;
 * aprova só se cada afirmação marcada se apoia num trecho real, citado literalmente.
 * Uma única falha bloqueia a resposta inteira: o advogado vê o motivo, não o texto.
 */
import type { CitacaoVerificada, RespostaModelo, ResultadoVerificacao, Trecho } from "./tipos";

/** Normalização de um caractere: caixa, acentos, aspas, travessões, ordinais. Espaços viram " ". */
function normChar(c: string): string {
  if (/\s/.test(c)) return " ";
  if (/[“”«»"]/.test(c)) return '"';
  if (/[‘’`´]/.test(c)) return "'";
  if (/[–—‑]/.test(c)) return "-";
  if (c === "º" || c === "°") return "o";
  if (c === "ª") return "a";
  return c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Normaliza para comparação literal e devolve, para cada caractere normalizado,
 * a posição no texto original (usada para destacar o trecho citado na tela).
 */
export function normalizarComMapa(s: string): { norm: string; mapa: number[] } {
  let norm = "";
  const mapa: number[] = [];
  for (let i = 0; i < s.length; i++) {
    for (const ch of normChar(s[i])) {
      if (ch === " " && (norm === "" || norm.endsWith(" "))) continue;
      norm += ch;
      mapa.push(i);
    }
  }
  if (norm.endsWith(" ")) {
    norm = norm.slice(0, -1);
    mapa.pop();
  }
  return { norm, mapa };
}

export function normalizar(s: string): string {
  return normalizarComMapa(s).norm;
}

const MARCA = /\[(D\d{1,2})\]/g;
const TEM_MARCA = /\[D\d{1,2}\]/;
/** Trecho citado precisa ter substância: evita "citar" uma palavra solta. */
export const MIN_CARACTERES_CITACAO = 20;

export function marcasNoTexto(paragrafos: string[]): string[] {
  const refs = new Set<string>();
  for (const p of paragrafos) for (const m of p.matchAll(MARCA)) refs.add(m[1]);
  return [...refs];
}

export function verificarCitacoes(resposta: RespostaModelo, recuperados: Trecho[]): ResultadoVerificacao {
  const motivos: string[] = [];
  const porRef = new Map(recuperados.map((t) => [t.ref, t]));
  const paragrafos = resposta.paragrafos.map((p) => p.trim()).filter(Boolean);

  if (resposta.semBase) {
    return { ok: false, motivos: ["Os dispositivos encontrados na base não bastam para responder a esta pergunta."] };
  }
  if (paragrafos.length === 0) motivos.push("A resposta veio vazia.");
  if (resposta.citacoes.length === 0) motivos.push("A resposta não trouxe nenhuma citação.");

  const verificadas: CitacaoVerificada[] = [];
  const citadas = new Set<string>();

  resposta.citacoes.forEach((c, i) => {
    const n = i + 1;
    const d = porRef.get(c.ref);
    if (!d) {
      motivos.push(`Citação ${n} aponta para ${c.ref}, que não está entre os dispositivos recuperados.`);
      return;
    }
    if (d.curadoria === "rejeitado") {
      motivos.push(`Citação ${n} usa ${d.norma}, ${d.rotulo}, que o curador rejeitou.`);
      return;
    }
    const trecho = normalizar(c.trecho.replace(/^["'“]|["'”]$/g, ""));
    if (trecho.length < MIN_CARACTERES_CITACAO) {
      motivos.push(`Citação ${n} (${d.rotulo}) é curta demais para ser conferida.`);
      return;
    }
    if (!normalizar(d.texto).includes(trecho)) {
      motivos.push(`Citação ${n} atribui a ${d.norma}, ${d.rotulo}, um trecho que não está no texto do dispositivo.`);
      return;
    }
    citadas.add(c.ref);
    verificadas.push({ ref: c.ref, trecho: c.trecho, dispositivo: d });
  });

  for (const ref of marcasNoTexto(paragrafos)) {
    if (!porRef.has(ref)) motivos.push(`O texto menciona [${ref}], que não existe entre os dispositivos recuperados.`);
    else if (!citadas.has(ref)) motivos.push(`O texto menciona [${ref}] sem trazer o trecho literal que o sustenta.`);
  }

  // Todo parágrafo precisa se apoiar em ao menos uma fonte.
  paragrafos.forEach((p, i) => {
    if (!TEM_MARCA.test(p)) motivos.push(`O parágrafo ${i + 1} faz afirmações sem indicar a fonte.`);
  });

  return motivos.length ? { ok: false, motivos } : { ok: true, citacoes: verificadas };
}
