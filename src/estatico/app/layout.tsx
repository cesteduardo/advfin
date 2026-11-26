import type { Metadata } from "next";
import Link from "next/link";
import { NavegacaoDemo } from "@/components/demo/NavegacaoDemo";
import "@/styles/mesa.css";

/*
 * Demonstração estática do app, publicada no GitHub Pages em /app/.
 * Só entra no build estático: scripts/_estatico.sh copia esta pasta para src/app/app
 * depois de tirar a área logada de verdade. Nada aqui fala com servidor.
 */
export const metadata: Metadata = {
  title: "Demonstração — AdvFin",
  robots: { index: false, follow: false },
};

export default function LayoutDemo({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-corpo">
      <div className="mesa">
        <NavegacaoDemo />
        <main className="mesa-principal" id="conteudo">
          <p className="alerta aviso demo-faixa">
            <strong>Demonstração.</strong> Dados de exemplo e uma base de 9 dispositivos ainda não conferidos. Nada é salvo, e
            nada aqui serve para parecer. <Link href="/lab">Abrir o laboratório do chat</Link>
          </p>
          {children}
        </main>
      </div>
    </div>
  );
}
