import type { Metadata } from "next";
import "@/styles/mesa.css";
import "@/styles/celular.css";
import "@/styles/tema.css";
import { TemaApp } from "@/components/app/Tema";

export const metadata: Metadata = {
  title: "Laboratório do chat — AdvFin",
  robots: { index: false, follow: false },
};

export default function LayoutLab({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-corpo">
      <TemaApp />
      {children}
    </div>
  );
}
