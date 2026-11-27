/**
 * Avaliação da pesquisa fundamentada: roda o banco de perguntas pelo mesmo caminho do
 * app (recuperar → gerar → verificar) e mede a precisão de citação. Meta do plano: ≥ 98%.
 *
 *   npm run avaliar                                   base embutida, sem IA (roda em qualquer lugar)
 *   AVALIAR_BASE=banco DATABASE_URL=... npm run avaliar               base real, modo extrativo
 *   AVALIAR_BASE=banco AVALIAR_LLM=anthropic LLM_CHAVE=... npm run avaliar   produto completo
 *
 * Outras variáveis: AVALIAR_LIMITE=10 (só as N primeiras), AVALIAR_CATEGORIA=transicao,
 * AVALIAR_EXIGIR=1 (falha abaixo da meta), BASE_INCLUIR_NAO_REVISADOS=0 (só o publicado).
 * O relatório vai para avaliacao/resultados/, em Markdown e JSON.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { expect, it } from "vitest";
import { ProvedorExtrativo, provedor } from "@/lib/llm/provedores";
import { pontuar, resumir, type Entrega, type NotaPergunta, type PerguntaAvaliacao } from "@/lib/pesquisa/avaliacao";
import { recuperarLocal } from "@/lib/pesquisa/base-local";
import { responder } from "@/lib/pesquisa/responder";
import { expandirPergunta, selecionarFontes } from "@/lib/pesquisa/termos";
import { paraTrecho } from "@/lib/pesquisa/trecho";
import type { Trecho } from "@/lib/pesquisa/tipos";

const META = 0.98;
const BASE = process.env.AVALIAR_BASE === "banco" ? "banco" : "local";
const LLM = process.env.AVALIAR_LLM === "anthropic" || process.env.AVALIAR_LLM === "configurado" ? "configurado" : "extrativo";
const dir = join(__dirname);

const banco = JSON.parse(readFileSync(join(dir, "perguntas.json"), "utf8")) as { versao: string; perguntas: PerguntaAvaliacao[] };
let perguntas = banco.perguntas;
if (process.env.AVALIAR_CATEGORIA) perguntas = perguntas.filter((p) => p.categoria === process.env.AVALIAR_CATEGORIA);
if (process.env.AVALIAR_LIMITE) perguntas = perguntas.slice(0, Number(process.env.AVALIAR_LIMITE));

const pct = (x: number | null) => (x === null ? "—" : `${(x * 100).toFixed(1).replace(".", ",")}%`);

it(`avaliação: ${perguntas.length} perguntas, base ${BASE}, ${LLM}`, async () => {
  if (LLM === "configurado") process.env.LLM_PROVEDOR ??= "anthropic";
  const llm = LLM === "extrativo" ? new ProvedorExtrativo() : provedor();
  const pool = BASE === "banco" ? new Pool({ connectionString: process.env.DATABASE_URL, max: 2 }) : null;
  const incluir = process.env.BASE_INCLUIR_NAO_REVISADOS !== "0";

  const recuperar = async (p: PerguntaAvaliacao): Promise<Trecho[]> => {
    if (!pool) return recuperarLocal(p.pergunta, p.data);
    const { rows } = await pool.query(`select * from pesquisar_dispositivos($1, $2::date, 8, $3)`, [expandirPergunta(p.pergunta), p.data, incluir]);
    return selecionarFontes(p.pergunta, rows.map(paraTrecho));
  };

  const notas: NotaPergunta[] = [];
  let custo = 0;
  const inicio = Date.now();
  for (const p of perguntas) {
    let entrega: Entrega;
    try {
      const fontes = await recuperar(p);
      if (fontes.length === 0) entrega = { status: "sem_resultado" };
      else {
        const { resultado, bastidores } = await responder(llm, p.pergunta, p.data, fontes);
        custo += bastidores.tokens.custo ?? 0;
        entrega = resultado.status === "respondida" ? { status: "respondida", citacoes: resultado.citacoes } : { status: "bloqueada_citacao", motivo: resultado.motivos[0] };
      }
    } catch (e) {
      entrega = { status: "erro", motivo: (e as Error).message };
    }
    notas.push(pontuar(p, entrega));
  }
  await pool?.end();

  const r = resumir(perguntas, notas);
  const quando = new Date().toISOString();
  const nome = `${quando.slice(0, 16).replace(/[:T]/g, "-")}-${BASE}-${LLM === "extrativo" ? "extrativo" : llm.nome}`;
  const linhas = [
    `# Avaliação da pesquisa fundamentada`,
    ``,
    `${quando.slice(0, 10)} · base **${BASE}** · ${LLM === "extrativo" ? "modo extrativo (sem IA)" : `IA: ${llm.nome}`} · banco de perguntas ${banco.versao}${incluir ? "" : " · só dispositivos publicados"}`,
    ``,
    `| Métrica | Resultado |`,
    `|---|---|`,
    `| **Precisão de citação** (meta ≥ ${pct(META)}) | **${pct(r.precisao)}** (${r.corretas} de ${r.citadas}) ${r.precisao !== null && r.precisao >= META ? "✓" : "✗"} |`,
    `| Cobertura: perguntas do escopo com citação correta | ${pct(r.cobertura)} |`,
    `| Abstenção: perguntas fora do escopo sem resposta | ${pct(r.abstencao)} |`,
    `| Respondidas · bloqueadas · sem resultado · erro | ${r.respondidas} · ${r.bloqueadas} · ${r.semResultado} · ${r.erros} |`,
    `| Tempo total | ${((Date.now() - inicio) / 1000).toFixed(1)} s${custo ? ` · custo R$ ${(custo / 1e6).toFixed(2)}` : ""} |`,
    ``,
    `## Por categoria`,
    ``,
    `| Categoria | Perguntas | Acertos | Citações corretas |`,
    `|---|---|---|---|`,
    ...Object.entries(r.porCategoria).map(([c, v]) => `| ${c} | ${v.perguntas} | ${v.acertos} | ${v.corretas} de ${v.citadas} |`),
    ``,
    `## Citações erradas`,
    ``,
    ...(notas.some((n) => n.erradas.length)
      ? notas.flatMap((n) => n.erradas.map((e) => `- ${n.id} · ${e.norma}, ${e.rotulo}: ${e.motivo} — “${perguntas.find((p) => p.id === n.id)!.pergunta}”`))
      : ["Nenhuma."]),
    ``,
    `## Perguntas do escopo sem citação correta`,
    ``,
    ...notas
      .filter((n) => !n.acerto && perguntas.find((p) => p.id === n.id)!.esperado === "responder")
      .map((n) => `- ${n.id} (${n.status}): ${perguntas.find((p) => p.id === n.id)!.pergunta}`),
    ``,
    `Gabaritos ainda não conferidos pelo curador: ${perguntas.filter((p) => !p.gabarito_conferido).length} de ${perguntas.length}.`,
  ];
  mkdirSync(join(dir, "resultados"), { recursive: true });
  writeFileSync(join(dir, "resultados", `${nome}.md`), linhas.join("\n") + "\n");
  writeFileSync(join(dir, "resultados", `${nome}.json`), JSON.stringify({ quando, base: BASE, llm: llm.nome, resumo: r, notas }, null, 1));
  console.log(linhas.slice(0, 12).join("\n"));
  console.log(`\nRelatório: avaliacao/resultados/${nome}.md`);

  if (process.env.AVALIAR_EXIGIR === "1") expect(r.precisao ?? 0).toBeGreaterThanOrEqual(META);
});
