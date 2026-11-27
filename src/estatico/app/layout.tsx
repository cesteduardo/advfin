import type { Metadata } from "next";
import Link from "next/link";
import { NavegacaoDemo } from "@/components/demo/NavegacaoDemo";
import { Portao } from "@/components/demo/Portao";
import "@/styles/mesa.css";
import "@/styles/celular.css";
import "@/styles/tema.css";
import { TemaApp } from "@/components/app/Tema";

/*
 * Demonstração estática do app, publicada no GitHub Pages em /app/.
 * Só entra no build estático: scripts/_estatico.sh copia esta pasta para src/app/app
 * depois de tirar a área logada de verdade. Nada aqui fala com servidor: o escritório
 * inteiro fica no localStorage do navegador (components/demo/estado.ts).
 */
export const metadata: Metadata = {
  title: "Demonstração — AdvFin",
  robots: { index: false, follow: false },
};

export default function LayoutDemo({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-corpo">
      <TemaApp />
      <div className="mesa">
        <NavegacaoDemo />
        <main className="mesa-principal" id="conteudo">
          <p className="alerta aviso demo-faixa">
            <strong>Demonstração.</strong>{" "}
            <span className="demo-faixa-longa">
              Você entra como Titular, com acesso de administrador. Tudo fica salvo só neste navegador, e a base tem 9 dispositivos
              ainda não conferidos: nada aqui serve para parecer.
            </span>
            <span className="demo-faixa-curta">Salva só neste navegador; não serve para parecer.</span>{" "}
            <Link href="/lab">Laboratório do chat</Link>
          </p>
          <Portao>{children}</Portao>
        </main>
      </div>
    </div>
  );
}
