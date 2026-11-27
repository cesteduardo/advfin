/**
 * Pontuação do banco de avaliação (avaliacao/perguntas.json). Pura: recebe a pergunta
 * com o gabarito e o que a pesquisa entregou, devolve a nota.
 *
 * Precisão de citação = citações corretas ÷ citações entregues ao advogado.
 * Uma citação é correta quando o dispositivo:
 *   1. estava vigente na data da pergunta;
 *   2. é de uma das normas do gabarito;
 *   3. tem o rótulo do gabarito (ou é parte dele: "ADCT, art. 125, § 1º" conta como
 *      "ADCT, art. 125"), ou, nas perguntas com gabarito por termo, contém o termo.
 * Pergunta fora do escopo que recebe resposta: todas as citações contam como erradas,
 * porque o advogado leria norma real apresentada como resposta ao que ela não responde.
 * A fidelidade literal é conferida à parte pelo verificador: resposta com citação não
 * literal nem chega a ser entregue.
 */
import type { CitacaoVerificada } from "./tipos";
import { normalizar } from "./verificador";

export interface PerguntaAvaliacao {
  id: string;
  categoria: string;
  pergunta: string;
  data: string;
  esperado: "responder" | "sem_base";
  gabarito: { normas: string[]; rotulos: string[]; termos: string[] } | null;
  gabarito_conferido: boolean;
  conferir_numeracao: boolean;
  nota?: string;
}

export type Entrega =
  | { status: "respondida"; citacoes: CitacaoVerificada[] }
  | { status: "bloqueada_citacao" | "sem_resultado" | "erro"; motivo?: string };

export interface NotaPergunta {
  id: string;
  categoria: string;
  status: Entrega["status"];
  citadas: number;
  corretas: number;
  /** Respondeu com ao menos uma citação correta (esperado = responder) ou se absteve (sem_base). */
  acerto: boolean;
  erradas: { rotulo: string; norma: string; motivo: string }[];
}

const normRotulo = (r: string) => normalizar(r).replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();

export function rotuloConfere(citado: string, esperado: string): boolean {
  const c = normRotulo(citado);
  const e = normRotulo(esperado);
  return c === e || c.startsWith(`${e}, `);
}

export function vigenteEm(c: CitacaoVerificada, data: string): boolean {
  const d = c.dispositivo;
  return d.vigenciaInicio <= data && (!d.vigenciaFim || d.vigenciaFim > data);
}

/** Por que a citação está errada; null quando está correta. */
export function motivoDoErro(p: PerguntaAvaliacao, c: CitacaoVerificada): string | null {
  if (p.esperado === "sem_base" || !p.gabarito) return "pergunta fora do escopo recebeu citação";
  if (!vigenteEm(c, p.data)) return "dispositivo fora de vigência na data";
  const g = p.gabarito;
  if (g.normas.length && !g.normas.includes(c.dispositivo.norma)) return `norma fora do gabarito (${g.normas.join(" ou ")})`;
  const porRotulo = g.rotulos.some((r) => rotuloConfere(c.dispositivo.rotulo, r));
  const texto = normalizar(c.dispositivo.texto);
  const porTermo = g.termos.some((t) => texto.includes(normalizar(t)));
  if (g.rotulos.length === 0 && g.termos.length === 0) return null; // só a norma importa
  if (porRotulo || porTermo) return null;
  return g.rotulos.length ? `dispositivo fora do gabarito (${g.rotulos.join(" ou ")})` : `não contém ${g.termos.map((t) => `"${t}"`).join(" ou ")}`;
}

export function pontuar(p: PerguntaAvaliacao, e: Entrega): NotaPergunta {
  const nota: NotaPergunta = { id: p.id, categoria: p.categoria, status: e.status, citadas: 0, corretas: 0, acerto: false, erradas: [] };
  if (e.status !== "respondida") {
    nota.acerto = p.esperado === "sem_base" && e.status !== "erro";
    return nota;
  }
  // Duas marcas para o mesmo dispositivo contam uma vez: o advogado vê uma fonte.
  const porDispositivo = new Map(e.citacoes.map((c) => [c.dispositivo.id, c]));
  for (const c of porDispositivo.values()) {
    nota.citadas++;
    const m = motivoDoErro(p, c);
    if (m) nota.erradas.push({ rotulo: c.dispositivo.rotulo, norma: c.dispositivo.norma, motivo: m });
    else nota.corretas++;
  }
  nota.acerto = p.esperado === "responder" && nota.corretas > 0;
  return nota;
}

export interface Resumo {
  perguntas: number;
  citadas: number;
  corretas: number;
  precisao: number | null;
  respondidas: number;
  bloqueadas: number;
  semResultado: number;
  erros: number;
  cobertura: number | null; // das que deviam ser respondidas, quantas tiveram citação correta
  abstencao: number | null; // das fora do escopo, quantas não receberam resposta
  porCategoria: Record<string, { perguntas: number; citadas: number; corretas: number; acertos: number }>;
}

export function resumir(perguntas: PerguntaAvaliacao[], notas: NotaPergunta[]): Resumo {
  const r: Resumo = {
    perguntas: notas.length, citadas: 0, corretas: 0, precisao: null, respondidas: 0, bloqueadas: 0, semResultado: 0, erros: 0,
    cobertura: null, abstencao: null, porCategoria: {},
  };
  const esperado = new Map(perguntas.map((p) => [p.id, p.esperado]));
  let devem = 0, cobertas = 0, fora = 0, abstidas = 0;
  for (const n of notas) {
    r.citadas += n.citadas;
    r.corretas += n.corretas;
    if (n.status === "respondida") r.respondidas++;
    else if (n.status === "bloqueada_citacao") r.bloqueadas++;
    else if (n.status === "sem_resultado") r.semResultado++;
    else r.erros++;
    if (esperado.get(n.id) === "responder") { devem++; if (n.acerto) cobertas++; }
    else { fora++; if (n.acerto) abstidas++; }
    const c = (r.porCategoria[n.categoria] ??= { perguntas: 0, citadas: 0, corretas: 0, acertos: 0 });
    c.perguntas++; c.citadas += n.citadas; c.corretas += n.corretas; if (n.acerto) c.acertos++;
  }
  r.precisao = r.citadas ? r.corretas / r.citadas : null;
  r.cobertura = devem ? cobertas / devem : null;
  r.abstencao = fora ? abstidas / fora : null;
  return r;
}
