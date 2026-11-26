import { Navegacao } from "@/components/app/Navegacao";
import { exigirSessao } from "@/lib/auth/sessao";
import { noEscritorio } from "@/lib/db";
import { podeUsarDev } from "@/lib/pesquisa/acao";

export default async function LayoutLogado({ children }: { children: React.ReactNode }) {
  const s = await exigirSessao();
  const recentes = await noEscritorio(s, async (c) =>
    (await c.query(`select id, pergunta from consultas where usuario_id = $1 order by criado_em desc limit 5`, [s.usuarioId])).rows,
  );
  return (
    <div className="mesa">
      <Navegacao nome={s.nome} escritorio={s.escritorio} recentes={recentes} dev={await podeUsarDev(s.email)} />
      <main className="mesa-principal" id="conteudo">
        {children}
      </main>
    </div>
  );
}
