import { Navegacao } from "@/components/app/Navegacao";
import { exigirSessao } from "@/lib/auth/sessao";

export default async function LayoutLogado({ children }: { children: React.ReactNode }) {
  const s = await exigirSessao();
  return (
    <div className="casca">
      <Navegacao nome={s.nome} escritorio={s.escritorio} />
      <main className="palco" id="conteudo">
        {children}
      </main>
    </div>
  );
}
