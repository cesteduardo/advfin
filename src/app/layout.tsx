import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

const serif = Newsreader({ subsets: ["latin"], variable: "--fonte-serif", display: "swap", weight: ["400", "500"], style: ["normal", "italic"] });
const sans = Inter({ subsets: ["latin"], variable: "--fonte-sans", display: "swap" });

export const metadata: Metadata = {
  title: "AdvFin — a IA do tributarista",
  description:
    "Pesquisa tributária com a norma ao lado e a data em que vale. Copiloto da Reforma Tributária (IBS/CBS) para advogados.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f8f6f1" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
