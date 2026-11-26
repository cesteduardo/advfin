import Link from "next/link";
import { decidirRevisao } from "@/lib/casos/acoes";
import { FormAcao } from "../FormAcao";

export interface RevisaoLinha {
  id: string;
  acao: "exportar_parecer" | "incluir_colega";
  status: "pendente" | "aprovada" | "recusada";
  solicitante: string;
  nomeSolicitante: string;
  descricao: string;
  href: string | null;
  nota: string | null;
  criado_em: string;
}

const dia = (d: string) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const STATUS = { pendente: "Aguardando", aprovada: "Aprovada", recusada: "Recusada" };

/** Pedidos do Supervisionado: quem é Membro para cima aprova ou recusa; quem pediu acompanha. */
export function Revisoes({ linhas, decide, euId }: { linhas: RevisaoLinha[]; decide: boolean; euId: string }) {
  if (!linhas.length) return null;
  return (
    <section className="bloco" aria-labelledby="revisoes">
      <p className="mesa-rotulo" id="revisoes">{decide ? "Revisões para decidir" : "Meus pedidos de revisão"}</p>
      {linhas.map((r) => (
        <div key={r.id} className="mesa-revisao">
          <p>
            <strong>{r.solicitante === euId ? "Você" : r.nomeSolicitante}</strong> pediu para {r.descricao}
            {r.href && (
              <>
                {" · "}
                <Link href={r.href}>abrir</Link>
              </>
            )}
            <span className="mesa-nota"> · {dia(r.criado_em)}</span>
          </p>
          {decide && r.status === "pendente" && r.solicitante !== euId ? (
            <div className="mesa-acoes">
              <FormAcao acao={decidirRevisao} botao="Aprovar" pendente="…" classe="mesa-form-linha">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="aprovar" value="1" />
                <input name="nota" placeholder="Nota para quem pediu (opcional)" maxLength={500} aria-label="Nota" />
              </FormAcao>
              <FormAcao acao={decidirRevisao} botao="Recusar" pendente="…" classe="mesa-form-linha" secundario>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="aprovar" value="0" />
              </FormAcao>
            </div>
          ) : (
            <p>
              <span className={`selo ${r.status === "aprovada" ? "publicado" : r.status === "recusada" ? "rejeitado" : "em_revisao"}`}>{STATUS[r.status]}</span>
              {r.nota && <span className="mesa-nota"> “{r.nota}”</span>}
            </p>
          )}
        </div>
      ))}
    </section>
  );
}
