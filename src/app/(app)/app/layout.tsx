import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Navegacao } from "@/components/app/Navegacao";
import type { LinkExtra } from "@/components/app/NavegacaoMesa";
import { acimaOuIgual } from "@/lib/auth/niveis";
import { exigirSessao } from "@/lib/auth/sessao";
import { noEscritorio } from "@/lib/db";
import { podeUsarDev } from "@/lib/pesquisa/acao";

const dataBR = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default async function LayoutLogado({ children }: { children: React.ReactNode }) {
  const s = await exigirSessao();
  const caminho = (await headers()).get("x-advfin-caminho") ?? "";

  // O escritório exige 2FA para o nível da pessoa: até ativar, só o perfil abre.
  if (s.precisa2fa && !caminho.startsWith("/app/perfil")) redirect("/app/perfil?aba=seguranca&exigido=1");

  const { recentes, revisoes } = await noEscritorio(s, async (c) => ({
    recentes: (await c.query(`select id, pergunta from consultas where usuario_id = $1 order by criado_em desc limit 5`, [s.usuarioId])).rows,
    revisoes: acimaOuIgual(s.nivel, "membro")
      ? Number((await c.query(`select count(*) n from revisoes where status = 'pendente' and solicitante <> $1`, [s.usuarioId])).rows[0].n)
      : 0,
  }));

  const extras: LinkExtra[] = [{ href: "/app/casos", nome: "Casos", icone: "casos", conta: revisoes }];
  if (s.pode.has("gerir_pessoas") || s.pode.has("configurar_escritorio")) extras.push({ href: "/app/escritorio", nome: "Escritório", icone: "escritorio" });
  if (s.plataforma) extras.push({ href: "/admin", nome: "Plataforma", icone: "plataforma" });

  return (
    <div className="mesa">
      <Navegacao nome={s.nome} escritorio={s.escritorio} foto={s.foto} recentes={recentes} dev={await podeUsarDev(s)} extras={extras} />
      <main className="mesa-principal" id="conteudo">
        {s.encerradoEm && (
          <p className="alerta erro" role="status">
            Conta do escritório encerrada em {dataBR(s.encerradoEm)}. Só você entra até{" "}
            {dataBR(new Date(s.encerradoEm.getTime() + 30 * 86_400_000))}; depois disso os dados são apagados.{" "}
            <Link href="/app/escritorio?aba=dados">Exportar ou reabrir</Link>
          </p>
        )}
        {children}
        <footer className="mesa-rodape-legal">
          <p>
            Ferramenta de apoio para advogados e profissionais de tributação, em teste público. As respostas não são parecer e
            não substituem a análise do profissional, que confere as fontes no texto oficial e responde pelo que assina.
          </p>
          <nav aria-label="Documentos legais">
            <Link href="/termos">Termos de Uso</Link>
            <Link href="/privacidade">Privacidade</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
}
