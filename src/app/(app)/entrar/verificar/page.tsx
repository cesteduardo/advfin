import { redirect } from "next/navigation";
import { FormVerificar } from "@/components/app/FormAcesso";
import { LadoAcesso } from "@/components/app/LadoAcesso";
import { hashDesafio } from "@/lib/auth/sessao";

export const metadata = { title: "Código de verificação — AdvFin" };

export default async function Verificar({ searchParams }: { searchParams: Promise<{ volta?: string }> }) {
  if (!(await hashDesafio())) redirect("/entrar");
  const { volta } = await searchParams;
  return (
    <main className="acesso">
      <LadoAcesso />
      <div className="acesso-form">
        <FormVerificar volta={volta} />
      </div>
    </main>
  );
}
