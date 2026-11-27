"use client";

import { useEffect, useRef, useState } from "react";

/** Tipos mínimos da Web Speech API (o TypeScript não traz o reconhecimento de voz). */
interface ResultadoFala {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventoFala {
  resultIndex: number;
  results: ArrayLike<ResultadoFala>;
}
interface Reconhecedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: EventoFala) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type Construtor = new () => Reconhecedor;

const construtor = (): Construtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Construtor; webkitSpeechRecognition?: Construtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const ERROS: Record<string, string> = {
  "not-allowed": "O navegador não deu acesso ao microfone. Libere nas permissões do site.",
  "service-not-allowed": "O navegador não deu acesso ao microfone. Libere nas permissões do site.",
  "no-speech": "Não ouvi nada. Toque no microfone e fale de novo.",
  "audio-capture": "Nenhum microfone encontrado.",
  network: "O ditado precisa de internet neste navegador.",
};

/**
 * Ditado em português: o texto entra no campo enquanto a pessoa fala (parcial em cinza, final
 * fixado). `aoFim` recebe o texto completo quando o reconhecimento termina.
 */
export function useDitado({ aoParcial, aoFim }: { aoParcial: (texto: string) => void; aoFim?: (texto: string) => void }) {
  const [suportado, setSuportado] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<Reconhecedor | null>(null);
  const cb = useRef({ aoParcial, aoFim });
  cb.current = { aoParcial, aoFim };
  useEffect(() => setSuportado(!!construtor()), []);
  useEffect(() => () => rec.current?.abort(), []);

  const iniciar = (prefixo = "") => {
    const C = construtor();
    if (!C || rec.current) return;
    setErro(null);
    const r = new C();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = true;
    let final = "";
    const juntar = (...p: string[]) => p.map((x) => x.trim()).filter(Boolean).join(" ");
    r.onresult = (e) => {
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final = juntar(final, res[0].transcript);
        else parcial = juntar(parcial, res[0].transcript);
      }
      cb.current.aoParcial(juntar(prefixo, final, parcial));
    };
    r.onerror = (e) => e.error !== "aborted" && setErro(ERROS[e.error] ?? "O ditado parou. Tente de novo.");
    r.onend = () => {
      rec.current = null;
      setOuvindo(false);
      cb.current.aoFim?.(juntar(prefixo, final));
    };
    rec.current = r;
    try {
      r.start();
      setOuvindo(true);
    } catch {
      rec.current = null;
      setErro("Não consegui ligar o microfone.");
    }
  };
  const parar = () => rec.current?.stop();
  return { suportado, ouvindo, erro, iniciar, parar, limparErro: () => setErro(null) };
}

/** Leitura em voz alta, em português, de um texto sem as marcas de citação. */
export function falar(texto: string, aoTerminar?: () => void) {
  if (typeof speechSynthesis === "undefined") return aoTerminar?.();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto.replace(/\[D\d{1,2}\]/g, "").replace(/\s+/g, " ").trim());
  u.lang = "pt-BR";
  const voz = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt-br")) ?? speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("pt"));
  if (voz) u.voice = voz;
  u.rate = 1.02;
  u.onend = () => aoTerminar?.();
  u.onerror = () => aoTerminar?.();
  speechSynthesis.speak(u);
}
export const calar = () => typeof speechSynthesis !== "undefined" && speechSynthesis.cancel();
export const falaSuportada = () => typeof speechSynthesis !== "undefined";
