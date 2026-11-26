import { Calculo } from "@/components/app/Calculo";
import { exigirSessao } from "@/lib/auth/sessao";

export const metadata = { title: "Cálculo — AdvFin" };

export default async function PaginaCalculo() {
  const s = await exigirSessao();
  return <Calculo trilha={`${s.escritorio} / Calculadora`} />;
}
