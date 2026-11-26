import { NextResponse } from "next/server";
import { z } from "zod";
import { registrarInscricao } from "@/lib/lista-espera";

const Inscricao = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  perfil: z.enum(["tributarista_pequeno", "escritorio_medio", "juridico_interno", "contador"]),
  consentimento: z.literal(true),
  origem: z.string().max(40).optional(),
  site: z.string().max(0).optional(), // armadilha anti-robô: precisa vir vazio
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const r = Inscricao.safeParse(json);
  if (!r.success) {
    const consent = r.error.issues.some((i) => i.path[0] === "consentimento");
    return NextResponse.json(
      { erro: consent ? "É preciso autorizar o contato para entrar na lista." : "Revise nome e e-mail." },
      { status: 400 },
    );
  }
  const { site: _ignorado, ...dados } = r.data;
  try {
    await registrarInscricao(dados);
  } catch (e) {
    console.error("lista-espera", (e as Error).message);
    return NextResponse.json({ erro: "Não foi possível registrar agora. Tente em instantes." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
