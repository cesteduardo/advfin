import type { Trecho } from "./tipos";

const iso = (d: Date | string) => (typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10));

/** Uma linha de pesquisar_dispositivos() como o modelo e a tela a recebem, numerada D1, D2… */
export function paraTrecho(l: any, i: number): Trecho {
  return {
    ref: `D${i + 1}`,
    id: l.id,
    norma: l.norma_apelido || `${l.norma_tipo} ${l.norma_numero}/${l.norma_ano}`,
    ementa: l.norma_ementa,
    url: l.url_oficial,
    rotulo: l.rotulo,
    texto: l.texto,
    vigenciaInicio: iso(l.vigencia_inicio),
    vigenciaFim: l.vigencia_fim ? iso(l.vigencia_fim) : null,
    curadoria: l.status_curadoria,
    origem: l.origem,
  };
}
