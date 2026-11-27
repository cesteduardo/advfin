import type { Metadata } from "next";
import "@/styles/mesa.css";
import "@/styles/celular.css";
import "@/styles/tema.css";
import { TemaApp } from "@/components/app/Tema";

export const metadata: Metadata = {
  title: "AdvFin — área do advogado",
  robots: { index: false, follow: false },
};

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-corpo">
      <TemaApp />
      {children}
    </div>
  );
}
