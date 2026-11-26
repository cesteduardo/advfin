import { Navegacao } from "@/components/app/Navegacao";
import { exigirPlataforma } from "@/lib/auth/sessao";

export const metadata = { title: "Plataforma — AdvFin", robots: { index: false, follow: false } };

/** Área da equipe AdvFin. Para quem não é da equipe, a página não existe (404). */
export default async function LayoutPlataforma({ children }: { children: React.ReactNode }) {
  const s = await exigirPlataforma(["curador", "suporte"]);
  return (
    <div className="mesa">
      <Navegacao
        nome={s.nome}
        escritorio="Equipe AdvFin"
        foto={s.foto}
        recentes={[]}
        dev={s.plataforma === "admin" || s.plataforma === "curador"}
        extras={[{ href: "/app/casos", nome: "Casos", icone: "casos" }, { href: "/admin", nome: "Plataforma", icone: "plataforma" }]}
      />
      <main className="mesa-principal" id="conteudo">
        {children}
      </main>
    </div>
  );
}
