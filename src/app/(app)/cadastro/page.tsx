import { redirect } from "next/navigation";
import { FormCadastro } from "@/components/app/FormAcesso";
import { LadoAcesso } from "@/components/app/LadoAcesso";
import { Legal } from "@/components/Legal";
import { sessaoAtual } from "@/lib/auth/sessao";

export const metadata = { title: "Criar conta — AdvFin" };

export default async function Cadastro() {
  if (await sessaoAtual()) redirect("/app");
  return (
    <main className="acesso">
      <LadoAcesso />
      <div className="acesso-form">
        <FormCadastro />
      </div>
      <Legal />
    </main>
  );
}
