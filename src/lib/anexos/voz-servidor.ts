import "server-only";

/** Chave do Groq para a voz: a própria, ou a do provedor quando ele já é o Groq. */
export function chaveVozServidor(): string {
  const propria = process.env.GROQ_CHAVE_VOZ?.trim();
  if (propria) return propria;
  return (process.env.LLM_PROVEDOR ?? "").toLowerCase() === "groq" ? (process.env.LLM_CHAVE ?? "").trim() : "";
}
