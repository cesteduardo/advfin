import { NextResponse, type NextRequest } from "next/server";

/**
 * Checagem otimista: sem cookie de sessão, nem chega a renderizar a área logada.
 * A validação real (sessão no banco, vínculo e nível no escritório) acontece em
 * exigirSessao(), no servidor, a cada página e ação.
 *
 * O caminho vai num cabeçalho da requisição para o layout saber onde está (por exemplo,
 * para levar ao perfil quem precisa ativar a verificação em duas etapas).
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has("advfin_sessao")) {
    const url = new URL("/entrar", req.url);
    url.searchParams.set("volta", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  const cabecalhos = new Headers(req.headers);
  cabecalhos.set("x-advfin-caminho", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: cabecalhos } });
}

export const config = { matcher: ["/app", "/app/:path*", "/admin", "/admin/:path*"] };
