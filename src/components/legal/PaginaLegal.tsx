import Link from "next/link";
import type { ReactNode } from "react";
import { CreditoGR } from "@/components/CreditoGR";
import { Marca } from "@/components/app/Marca";

/**
 * Página de documento legal: sumário fixo à esquerda (usa a lateral da tela larga)
 * e o texto numa medida confortável de leitura à direita. No celular, sumário recolhido.
 */
export function PaginaLegal({
  atual,
  secoes,
  children,
}: {
  atual: "termos" | "privacidade";
  secoes: readonly (readonly [string, string])[];
  children: ReactNode;
}) {
  return (
    <div className="legal-pagina">
      <header className="legal-pagina-topo">
        <Marca href="/app" />
        <nav aria-label="Documentos legais" className="legal-pagina-abas">
          <Link href="/termos" aria-current={atual === "termos" ? "page" : undefined}>
            Termos de Uso
          </Link>
          <Link href="/privacidade" aria-current={atual === "privacidade" ? "page" : undefined}>
            Privacidade
          </Link>
        </nav>
      </header>
      <div className="legal-pagina-grade">
        <details className="legal-sumario" open>
          <summary>Nesta página</summary>
          <ol>
            {secoes.map(([id, nome]) => (
              <li key={id}>
                <a href={`#${id}`}>{nome}</a>
              </li>
            ))}
          </ol>
        </details>
        <main className="legal-corpo legal-pagina-texto" id="conteudo">
          {children}
          <p className="legal-assinatura">
            AdvFin é um projeto feito por <CreditoGR id="gr-legal-pagina" />
          </p>
        </main>
      </div>
    </div>
  );
}
