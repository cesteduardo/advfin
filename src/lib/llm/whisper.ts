/**
 * Transcrição de voz pelo Whisper do Groq (plano gratuito). Serve ao navegador, na
 * demonstração com a chave da própria pessoa, e ao servidor, com a chave do ambiente.
 */
export const URL_TRANSCRICAO_GROQ = "https://api.groq.com/openai/v1/audio/transcriptions";
export const MODELO_WHISPER = "whisper-large-v3-turbo";
export const MAX_AUDIO = 20 * 1024 * 1024;

const extensao = (tipo: string) => (tipo.includes("mp4") ? "m4a" : tipo.includes("ogg") ? "ogg" : tipo.includes("wav") ? "wav" : "webm");

export async function transcreverNoGroq(chave: string, audio: Blob): Promise<string> {
  if (audio.size > MAX_AUDIO) throw new Error("A gravação ficou longa demais. Fale em trechos menores.");
  const f = new FormData();
  f.append("file", audio, `fala.${extensao(audio.type)}`);
  f.append("model", MODELO_WHISPER);
  f.append("language", "pt");
  f.append("response_format", "json");
  f.append("temperature", "0");
  let r: Response;
  try {
    r = await fetch(URL_TRANSCRICAO_GROQ, { method: "POST", headers: { authorization: `Bearer ${chave}` }, body: f });
  } catch {
    throw new Error("Não consegui falar com o Groq para transcrever. Confira a conexão.");
  }
  if (r.status === 401) throw new Error("O Groq recusou a chave. Confira se ela foi colada inteira (começa com gsk_).");
  if (r.status === 429) throw new Error("O limite gratuito do Groq foi atingido por agora. Espere um minuto e tente de novo.");
  if (!r.ok) throw new Error(`O Groq não transcreveu o áudio (erro ${r.status}). Tente de novo.`);
  const j = (await r.json()) as { text?: string };
  return j.text ?? "";
}
