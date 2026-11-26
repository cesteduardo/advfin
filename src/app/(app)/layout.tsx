import type { Metadata } from "next";
import "@/styles/mesa.css";

export const metadata: Metadata = {
  title: "AdvFin — área do advogado",
  robots: { index: false, follow: false },
};

export default function LayoutApp({ children }: { children: React.ReactNode }) {
  return <div className="app-corpo">{children}</div>;
}
