import { redirect } from "next/navigation";
import { FormEntrar } from "@/components/app/FormAcesso";
import { LadoAcesso } from "@/components/app/LadoAcesso";
import { sessaoAtual } from "@/lib/auth/sessao";

export const metadata = { title: "Entrar — AdvFin" };

export default async function Entrar() {
  if (await sessaoAtual()) redirect("/app");
  return (
    <main className="acesso">
      <LadoAcesso />
      <div className="acesso-form">
        <FormEntrar />
      </div>
    </main>
  );
}
