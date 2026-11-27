import { PaginaLegal } from "@/components/legal/PaginaLegal";
import { SECOES_TERMOS, TermosPlataforma } from "@/components/legal/TextosPlataforma";

export const metadata = { title: "Termos de Uso — AdvFin", robots: { index: true, follow: true } };

export default function Termos() {
  return (
    <PaginaLegal atual="termos" secoes={SECOES_TERMOS}>
      <TermosPlataforma />
    </PaginaLegal>
  );
}
