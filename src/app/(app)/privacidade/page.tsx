import { PaginaLegal } from "@/components/legal/PaginaLegal";
import { PrivacidadePlataforma, SECOES_PRIVACIDADE } from "@/components/legal/TextosPlataforma";

export const metadata = { title: "Política de Privacidade — AdvFin", robots: { index: true, follow: true } };

export default function Privacidade() {
  return (
    <PaginaLegal atual="privacidade" secoes={SECOES_PRIVACIDADE}>
      <PrivacidadePlataforma />
    </PaginaLegal>
  );
}
