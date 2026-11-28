"use server";

import { exigirSessao } from "@/lib/auth/sessao";
import { MAX_AUDIO, transcreverNoGroq } from "@/lib/llm/whisper";
import { chaveVozServidor } from "./voz-servidor";

/** Transcreve a fala gravada no navegador, para quem usa um navegador sem ditado próprio. */
export async function acaoTranscrever(form: FormData): Promise<{ texto: string } | { erro: string }> {
  await exigirSessao();
  const chave = chaveVozServidor();
  if (!chave) return { erro: "A transcrição de voz não está ligada neste servidor." };
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return { erro: "Não recebi o áudio. Tente de novo." };
  if (audio.size > MAX_AUDIO) return { erro: "A gravação ficou longa demais. Fale em trechos menores." };
  try {
    return { texto: await transcreverNoGroq(chave, audio) };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}
