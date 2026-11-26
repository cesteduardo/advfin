import { NextResponse, type NextRequest } from "next/server";

/**
 * Checagem otimista: sem cookie de sessão, nem chega a renderizar a área logada.
 * A validação real (sessão no banco, vínculo com o escritório) acontece em
 * exigirSessao(), no servidor, a cada página e ação.
 */
export function proxy(req: NextRequest) {
  if (!req.cookies.has("advfin_sessao")) {
    const url = new URL("/entrar", req.url);
    url.searchParams.set("volta", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/app", "/app/:path*"] };
