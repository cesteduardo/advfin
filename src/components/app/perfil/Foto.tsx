"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar } from "../NavegacaoMesa";

/** Reduz a imagem no navegador (quadrado de até 256 px, WebP) antes de enviar. */
export async function reduzirImagem(arquivo: File, lado = 256, quadrada = true): Promise<string> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error("imagem"));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    if (quadrada) {
      const m = Math.min(img.width, img.height);
      canvas.width = canvas.height = Math.min(lado, m);
      canvas.getContext("2d")!.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, canvas.width, canvas.height);
    } else {
      const k = Math.min(1, lado / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
    const webp = canvas.toDataURL("image/webp", 0.86);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SeletorImagem({
  atual,
  nome,
  salvar,
  quadrada = true,
  lado = 256,
  rotulo,
}: {
  atual: string | null;
  nome: string;
  salvar: (dataUrl: string | null) => Promise<{ erro?: string; ok?: string }>;
  quadrada?: boolean;
  lado?: number;
  rotulo: string;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ erro?: string; ok?: string }>({});
  const [pendente, iniciar] = useTransition();
  const escolher = (f: File | undefined) => {
    if (!f) return;
    iniciar(async () => {
      try {
        setMsg(await salvar(await reduzirImagem(f, lado, quadrada)));
      } catch {
        setMsg({ erro: "Não consegui ler esta imagem." });
      }
    });
  };
  return (
    <div className="mesa-perfil-topo">
      {quadrada ? <Avatar nome={nome} foto={atual} grande /> : atual ? <img src={atual} alt="" style={{ maxHeight: 64, maxWidth: 220 }} /> : null}
      <div>
        <div className="mesa-acoes">
          <button type="button" className="primaria" disabled={pendente} onClick={() => campo.current?.click()}>
            {pendente ? "Enviando…" : atual ? `Trocar ${rotulo}` : `Enviar ${rotulo}`}
          </button>
          {atual && (
            <button type="button" disabled={pendente} onClick={() => iniciar(async () => setMsg(await salvar(null)))}>
              Remover
            </button>
          )}
        </div>
        <input ref={campo} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => escolher(e.target.files?.[0])} />
        {msg.erro && <p className="alerta erro" role="alert" style={{ marginTop: 10 }}>{msg.erro}</p>}
        {msg.ok && <p className="mesa-nota" role="status" style={{ marginTop: 8 }}>{msg.ok}</p>}
      </div>
    </div>
  );
}
