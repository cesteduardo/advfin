import Link from "next/link";
import { FormCadastroConvite, FormEntrar } from "@/components/app/FormAcesso";
import { LadoAcesso } from "@/components/app/LadoAcesso";
import { Legal } from "@/components/Legal";
import { aceitarConviteLogado, sair } from "@/lib/auth/acoes";
import { ROTULO_NIVEL, type Nivel } from "@/lib/auth/niveis";
import { sessaoAtual } from "@/lib/auth/sessao";
import { hashToken } from "@/lib/auth/senha";
import { consultar } from "@/lib/db";

export const metadata = { title: "Convite — AdvFin", robots: { index: false, follow: false } };

/**
 * Página do convite. Três caminhos: já logado com o e-mail convidado (aceita com um clique),
 * tem conta mas não está logado (entra e aceita), ou ainda não tem conta (cria pelo convite).
 */
export default async function Convite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [c] = /^[\w-]{20,100}$/.test(token) ? await consultar(`select * from app.convite_por_token($1)`, [hashToken(token)]) : [];
  const s = await sessaoAtual();

  let corpo: React.ReactNode;
  if (!c) {
    corpo = (
      <div className="painel">
        <h2>Convite indisponível</h2>
        <p className="lead">Este convite foi usado, cancelado ou venceu (vale 7 dias). Peça um novo a quem convidou você.</p>
        <Link className="botao" href={s ? "/app" : "/entrar"}>{s ? "Voltar ao AdvFin" : "Entrar"}</Link>
      </div>
    );
  } else {
    const resumo = (
      <div className="acesso-convite">
        <span>
          <strong>{c.convidado_por}</strong> convidou <strong>{c.email}</strong> para <strong>{c.escritorio}</strong>.
        </span>
        <span>
          Nível {ROTULO_NIVEL[c.nivel as Nivel]}
          {c.cargo ? ` · ${c.cargo}` : ""} · vale até {new Date(c.expira_em).toLocaleDateString("pt-BR")}
        </span>
      </div>
    );
    if (s && s.email === c.email) {
      corpo = (
        <form action={aceitarConviteLogado} className="painel">
          <h2>Aceitar convite</h2>
          {resumo}
          <input type="hidden" name="convite" value={token} />
          <button className="botao">Entrar em {c.escritorio}</button>
        </form>
      );
    } else if (s) {
      corpo = (
        <form action={sair} className="painel">
          <h2>Convite para outro e-mail</h2>
          {resumo}
          <p className="lead">Você está conectado como {s.email}. Saia e entre com {c.email} para aceitar.</p>
          <button className="botao secundario">Sair</button>
        </form>
      );
    } else if (c.tem_conta) {
      corpo = (
        <div>
          <FormEntrar convite={token} emailFixo={c.email} />
          <div style={{ marginTop: 16 }}>{resumo}</div>
        </div>
      );
    } else {
      corpo = (
        <div>
          <FormCadastroConvite convite={token} email={c.email} escritorio={c.escritorio} />
          <div style={{ marginTop: 16 }}>{resumo}</div>
        </div>
      );
    }
  }

  return (
    <main className="acesso">
      <LadoAcesso />
      <div className="acesso-form">{corpo}</div>
      <Legal />
    </main>
  );
}
