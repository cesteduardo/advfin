/**
 * Gravação de uma norma lida do Planalto na base versionada (usada pelos scripts
 * ingerir-planalto.mjs e carregar-reforma.mjs, e testada em db/tests/ingestao.test.ts).
 *
 * Regras:
 *   - cada artigo entra como status 'em_revisao' e origem 'ingestao': vai direto para a
 *     fila do curador em /admin. Em produção, nada aparece ao advogado antes de publicado;
 *   - vigência provisória a partir da publicação, com nota apontando o artigo de vigência
 *     da norma e as notas de alteração do Planalto, para o curador datar a versão;
 *   - mesma redação já carregada não duplica; redação diferente vira nova versão, e a
 *     anterior continua valendo até o curador fechar a vigência dela.
 */
import { artigoDeVigencia, artigos, textoLimpo } from "./planalto.mjs";

const NOME = { EC: "EC", LC: "LC", LEI: "Lei", DECRETO: "Decreto" };

export function lerNorma(html) {
  const lista = artigos(textoLimpo(html, { manterNotas: true }));
  return { lista, vigencia: artigoDeVigencia(lista) };
}

function notaDe(meta, item, vigencia, versaoNova) {
  const norma = `${NOME[meta.tipo] ?? meta.tipo} ${meta.numero}/${meta.ano}`;
  const partes = [];
  if (item.citado) partes.push(`Texto que a ${norma} insere em ${item.destino ?? "outra norma (identificar)"}.`);
  partes.push(
    vigencia
      ? `Vigência provisória: publicação. Conferir a produção de efeitos no ${vigencia.rotulo} da ${norma}.`
      : `Vigência provisória: publicação. Conferir a produção de efeitos na ${norma}.`,
  );
  if (item.notas?.length) partes.push(`Planalto: ${item.notas.join(" ")}`);
  if (versaoNova) partes.push("Nova redação no Planalto: fechar a vigência da versão anterior.");
  return partes.join(" ").slice(0, 1000);
}

/**
 * @param db  cliente pg conectado como dono das tabelas
 * @param meta { tipo, numero, ano, ementa, url, publicada }
 * @param html página do Planalto já decodificada
 */
export async function ingerirNorma(db, meta, html) {
  const { lista, vigencia } = lerNorma(html);
  if (lista.length === 0) throw new Error(`nenhum artigo lido em ${meta.tipo} ${meta.numero}/${meta.ano}: a página mudou?`);
  const relatorio = { norma: `${meta.tipo} ${meta.numero}/${meta.ano}`, lidos: lista.length, introducoes: 0, novos: 0, versoesNovas: 0, iguais: 0, sementesAposentadas: 0, vigencia: vigencia?.rotulo ?? null };
  await db.query("begin");
  try {
    const {
      rows: [n],
    } = await db.query(
      `insert into normas (tipo, numero, ano, ementa, url_oficial, publicada_em) values ($1,$2,$3,$4,$5,$6)
       on conflict (tipo, numero, ano) do update set ementa = excluded.ementa, url_oficial = excluded.url_oficial
       returning id`,
      [meta.tipo, meta.numero, Number(meta.ano), meta.ementa, meta.url, meta.publicada],
    );
    // Rótulo repetido na mesma página (raro: artigo citado duas vezes) fica com a última redação.
    const porRotulo = new Map(lista.map((x) => [x.rotulo, x]));
    for (const x of porRotulo.values()) {
      if (x.introducao) {
        relatorio.introducoes++;
        continue;
      }
      const { rows: atuais } = await db.query(
        `select texto from dispositivos where norma_id = $1 and rotulo = $2 and origem = 'ingestao' and status_curadoria <> 'rejeitado'`,
        [n.id, x.rotulo],
      );
      if (atuais.some((a) => a.texto === x.texto)) {
        relatorio.iguais++;
        continue;
      }
      const versaoNova = atuais.length > 0;
      await db.query(
        `insert into dispositivos (norma_id, rotulo, texto, vigencia_inicio, status_curadoria, origem, nota_curadoria)
         values ($1, $2, $3, $4, 'em_revisao', 'ingestao', $5)`,
        [n.id, x.rotulo, x.texto, meta.publicada, notaDe(meta, x, vigencia, versaoNova)],
      );
      if (versaoNova) relatorio.versoesNovas++;
      else relatorio.novos++;
    }
    const temAposentar = (await db.query(`select to_regprocedure('app.aposentar_semente(uuid)') is not null ok`)).rows[0].ok;
    if (temAposentar) relatorio.sementesAposentadas = (await db.query(`select app.aposentar_semente($1) n`, [n.id])).rows[0].n;
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
  return relatorio;
}
