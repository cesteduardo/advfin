import Link from "next/link";
import { LadoAcesso } from "@/components/app/LadoAcesso";
import { mensagemDeErro } from "@/lib/auth/erros";
import { hashToken } from "@/lib/auth/senha";
import { consultar } from "@/lib/db";

export const metadata = { title: "Confirmar e-mail — AdvFin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Abrir o link enviado ao endereço novo é a prova de que ele é da pessoa. */
export default async function ConfirmarEmail({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let novo: string | null = null;
  let erro: string | null = null;
  try {
    [{ e: novo }] = await consultar(`select app.confirmar_troca_email($1) e`, [hashToken(token)]);
  } catch (e) {
    erro = mensagemDeErro(e);
  }
  return (
    <main className="acesso">
      <LadoAcesso />
      <div className="acesso-form">
        <div className="painel">
          <h2>{novo ? "E-mail confirmado" : "Link indisponível"}</h2>
          <p className="lead">{novo ? `A partir de agora, a conta usa ${novo}.` : erro}</p>
          <Link className="botao" href="/app/perfil">Abrir o perfil</Link>
        </div>
      </div>
    </main>
  );
}
