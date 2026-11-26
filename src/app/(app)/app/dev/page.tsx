import { notFound } from "next/navigation";
import { Cabeca } from "@/components/app/Cabeca";
import { DevChat } from "@/components/app/DevChat";
import { exigirSessao } from "@/lib/auth/sessao";
import { provedor } from "@/lib/llm/provedores";
import { podeUsarDev } from "@/lib/pesquisa/acao";

export const metadata = { title: "Laboratório do chat — AdvFin", robots: { index: false, follow: false } };

/**
 * Laboratório do desenvolvedor: testa o chat da IA mostrando os bastidores
 * (saída bruta, verificador, tempos, tokens e custo). Em produção, só para os
 * e-mails listados em DEV_EMAILS; para os demais, a página não existe.
 */
export default async function PaginaDev() {
  const s = await exigirSessao();
  if (!(await podeUsarDev(s.email))) notFound();
  const llm = provedor();
  return (
    <>
      <Cabeca
        trilha={`${s.escritorio} / Desenvolvedor`}
        titulo="Laboratório do chat"
        descricao="Testes do chat da IA com os bastidores à vista. Nada daqui aparece ao advogado."
      />
      <DevChat provedor={llm.nome} redige={llm.redige} />
    </>
  );
}
