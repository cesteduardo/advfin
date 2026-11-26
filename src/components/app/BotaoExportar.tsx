"use client";

import { useState, useTransition } from "react";
import { pedirExportacao } from "@/lib/casos/acoes";

/**
 * Exportar o parecer em PDF (pela impressão do navegador). A exportação passa pelo banco:
 * fica na auditoria e, para o Supervisionado, vira pedido de revisão até um Membro aprovar.
 */
export function BotaoExportar({ consulta, estadoInicial }: { consulta: string; estadoInicial: "livre" | "revisao" | "pendente" | "aprovada" }) {
  const [estado, setEstado] = useState(estadoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const exportar = () =>
    iniciar(async () => {
      setErro(null);
      const r = await pedirExportacao(consulta, "pdf");
      if ("erro" in r) return setErro(r.erro);
      if (r.estado === "liberado") {
        // Dá tempo ao React de terminar a renderização antes de abrir a impressão.
        requestAnimationFrame(() => window.print());
      } else {
        setEstado("pendente");
      }
    });

  return (
    <div className="mesa-acoes parecer-barra">
      {estado === "pendente" ? (
        <p className="alerta aviso" role="status" style={{ margin: 0 }}>
          Pedido de revisão enviado. Assim que um Membro aprovar, a exportação fica liberada aqui.
        </p>
      ) : (
        <button type="button" className="primaria" onClick={exportar} disabled={pendente}>
          {pendente ? "Conferindo…" : estado === "revisao" ? "Pedir revisão para exportar" : "Imprimir ou salvar PDF"}
        </button>
      )}
      {erro && <p className="alerta erro" role="alert" style={{ margin: 0 }}>{erro}</p>}
    </div>
  );
}
