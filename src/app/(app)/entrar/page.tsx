import { redirect } from "next/navigation";
import { FormEntrar } from "@/components/app/FormAcesso";
import { LadoAcesso } from "@/components/app/LadoAcesso";
import { sessaoAtual } from "@/lib/auth/sessao";

export const metadata = { title: "Entrar — AdvFin" };

const AVISOS: Record<string, string> = {
  sem: "Sua conta não tem acesso ativo a nenhum escritório. Peça um convite a quem administra o seu.",
  saiu: "Você saiu do escritório. A conta continua sua.",
  excluida: "Conta excluída. Os dados pessoais são apagados em até 15 dias.",
  email: "E-mail confirmado. Entre com o endereço novo.",
};

export default async function Entrar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await searchParams;
  // Só caminhos da área logada: "//outro-site" não pode virar redirecionamento aberto.
  if (await sessaoAtual()) redirect(p.volta && /^\/(app|admin)(\/|\?|$)/.test(p.volta) ? p.volta : "/app");
  const aviso = Object.keys(AVISOS).find((k) => p[k] === "1");
  return (
    <main className="acesso">
      <LadoAcesso />
      <div className="acesso-form">
        <FormEntrar volta={p.volta} aviso={aviso ? AVISOS[aviso] : undefined} />
      </div>
    </main>
  );
}
