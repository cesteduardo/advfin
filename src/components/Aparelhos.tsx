/**
 * Vitrine do herói com as molduras do GR Frames (cesteduardo/gr-frames):
 * MacBook Pro 14" prateado, iPhone Duo fechado (Night Sky) e iPhone 18 Pro (Deep Blue).
 * Cada tela é uma captura do app de demonstração no tamanho exato da moldura
 * (scripts/capturar-vitrine.cjs), então a landing mostra o sistema como ele é hoje:
 * o Mac a pesquisa em conversa, o Duo a calculadora e o iPhone um caso com notas.
 */

import { linhaDoTempo } from "@/lib/tax/engine";
import { formatarReais } from "@/lib/tax/money";
import { EscalaAparelhos } from "./EscalaAparelhos";
import { IPhone, IPhoneDuo, MacBook } from "./Molduras";


/* O mesmo exemplo da captura da calculadora: serviço de R$ 100.000,00, PIS/Cofins 9,25% e ISS 5%, regime padrão. */
const EXEMPLO = linhaDoTempo({ valor: 10_000_000, regime: "padrao", atual: { pisCofins: 925_000, icms: 0, iss: 500_000 } });
const ANO_EM_FOCO = 2027;

/* ---------- As telas são capturas do próprio app (scripts/capturar-vitrine.cjs) ---------- */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
function Tela({ nome, classe, largura, altura, prioridade = false }: { nome: string; classe: string; largura: number; altura: number; prioridade?: boolean }) {
  return (
    <div className={`viewport tela-captura ${classe}`}>
      <img src={`${BASE}/vitrine/${nome}.jpg`} alt="" width={largura} height={altura} decoding="async" fetchPriority={prioridade ? "high" : "auto"} />
    </div>
  );
}

export function Aparelhos() {
  const foco = EXEMPLO.find((r) => r.ano === ANO_EM_FOCO)!;
  return (
    <figure className="vitrine">
      <div className="vitrine-palco">
        <MacBook><Tela nome="mac" classe="tela-mac" largura={1512} altura={893} prioridade /></MacBook>
        <IPhoneDuo><Tela nome="duo" classe="tela-duo" largura={760} altura={1364} /></IPhoneDuo>
        <IPhone><Tela nome="iphone" classe="tela-iphone" largura={804} altura={1624} /></IPhone>
      </div>
      <EscalaAparelhos />
      <figcaption className="so-leitor">
        O AdvFin em três telas, como ele é hoje. No computador, a pesquisa em conversa: em 2026 a CBS é cobrada a
        0,9% e o IBS a 0,1%, e o valor recolhido compensa PIS/Cofins, com as citações conferidas e a trilha de
        auditoria. No iPhone Duo, a calculadora da transição: um serviço de R$ 100.000,00 paga {formatarReais(foco.ano_.total)} em {ANO_EM_FOCO}.
        No iPhone, o caso da Clínica Aurora, com a barra de pergunta, a conversa guardada e as notas da equipe.
      </figcaption>
      <p className="vitrine-nota" aria-hidden="true">Telas reais do AdvFin, com dados fictícios. No produto, o texto vem da base oficial versionada.</p>
    </figure>
  );
}
