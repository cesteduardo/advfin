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

/** Navegadores com o reconhecimento exposto mas sem o serviço de voz do Google por trás. */
function navegadorSemServico(): string | null {
  if (typeof navigator === "undefined") return null;
  const n = navigator as Navigator & { brave?: unknown };
  if (n.brave) return "o Brave";
  if (/\bOPR\//.test(n.userAgent)) return "o Opera";
  if (/Vivaldi/.test(n.userAgent)) return "o Vivaldi";
  return null;
}

const SEM_SERVICO = (quem: string | null) =>
  `${quem ? `Neste navegador (${quem.replace(/^o /, "")})` : "Neste navegador"}, o ditado não tem o serviço de voz por trás, mesmo com internet. ` +
  "Para ditar, abra no Google Chrome, no Edge ou no Safari. Digitar segue funcionando normalmente aqui.";

const ERROS: Record<string, string> = {
  "not-allowed": "O navegador não deu acesso ao microfone. Libere nas permissões do site.",
  "service-not-allowed": "O navegador não deu acesso ao microfone. Libere nas permissões do site.",
  "no-speech": "Não ouvi nada. Toque no microfone e fale de novo.",
  "audio-capture": "Nenhum microfone encontrado.",
};

/** Depois de uma falha do serviço do navegador, a aba passa a gravar e transcrever. */
const MARCA_FALHA = "advfin-ditado-sem-servico";
const falhou = () => {
  try {
    return sessionStorage.getItem(MARCA_FALHA) === "1";
  } catch {
    return false;
  }
};
const marcarFalha = () => {
  try {
    sessionStorage.setItem(MARCA_FALHA, "1");
  } catch {}
};

const tipoGravacao = () =>
  typeof MediaRecorder === "undefined" ? null : ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

export type Transcrever = (audio: Blob) => Promise<string>;

/**
 * Ditado em português. Primeiro tenta o reconhecimento do navegador (o texto entra no campo
 * enquanto a pessoa fala); se ele não existe ou o serviço falha, e houver `transcrever`, grava
 * o áudio e manda transcrever ao parar. `aoFim` recebe o texto completo ao terminar.
 */
export function useDitado({ aoParcial, aoFim, transcrever }: { aoParcial: (texto: string) => void; aoFim?: (texto: string) => void; transcrever?: Transcrever }) {
  const [temReconhecimento, setTemReconhecimento] = useState(false);
  const [temGravacao, setTemGravacao] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<Reconhecedor | null>(null);
  const grav = useRef<{ m: MediaRecorder; s: MediaStream } | null>(null);
  const cb = useRef({ aoParcial, aoFim, transcrever });
  cb.current = { aoParcial, aoFim, transcrever };
  useEffect(() => {
    setTemReconhecimento(!!construtor());
    setTemGravacao(tipoGravacao() !== null && !!navigator.mediaDevices?.getUserMedia);
  }, []);
  useEffect(
    () => () => {
      rec.current?.abort();
      grav.current?.s.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  const juntar = (...p: string[]) => p.map((x) => x.trim()).filter(Boolean).join(" ");

  const gravar = async (prefixo: string) => {
    if (grav.current) return;
    setErro(null);
    let s: MediaStream;
    try {
      s = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const nome = (e as DOMException).name;
      setErro(nome === "NotFoundError" ? ERROS["audio-capture"] : ERROS["not-allowed"]);
      return;
    }
    const tipo = tipoGravacao() || undefined;
    const m = new MediaRecorder(s, tipo ? { mimeType: tipo } : undefined);
    const partes: Blob[] = [];
    m.ondataavailable = (e) => e.data.size && partes.push(e.data);
    m.onstop = async () => {
      s.getTracks().forEach((t) => t.stop());
      grav.current = null;
      setOuvindo(false);
      const audio = new Blob(partes, { type: m.mimeType || tipo || "audio/webm" });
      const t = cb.current.transcrever;
      if (!t || audio.size < 1200) {
        if (t) setErro(ERROS["no-speech"]);
        cb.current.aoFim?.(prefixo);
        return;
      }
      setTranscrevendo(true);
      try {
        const texto = (await t(audio)).trim();
        if (!texto) setErro(ERROS["no-speech"]);
        const tudo = juntar(prefixo, texto);
        cb.current.aoParcial(tudo);
        cb.current.aoFim?.(tudo);
      } catch (e) {
        setErro((e as Error).message || "Não consegui transcrever o áudio. Tente de novo.");
        cb.current.aoFim?.(prefixo);
      } finally {
        setTranscrevendo(false);
      }
    };
    grav.current = { m, s };
    m.start();
    setOuvindo(true);
  };

  const reconhecer = (C: Construtor, prefixo: string) => {
    setErro(null);
    const r = new C();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = true;
    let final = "";
    let semServico = false;
    r.onresult = (e) => {
      let parcial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final = juntar(final, res[0].transcript);
        else parcial = juntar(parcial, res[0].transcript);
      }
      cb.current.aoParcial(juntar(prefixo, final, parcial));
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      if (e.error === "network" || (e.error === "service-not-allowed" && navegadorSemServico())) {
        semServico = true;
        marcarFalha();
        return;
      }
      setErro(ERROS[e.error] ?? "O ditado parou. Tente de novo.");
    };
    r.onend = () => {
      rec.current = null;
      if (semServico && cb.current.transcrever && temGravacao) {
        // O serviço do navegador não respondeu: segue gravando, sem a pessoa tocar de novo.
        void gravar(juntar(prefixo, final));
        return;
      }
      setOuvindo(false);
      if (semServico) setErro(SEM_SERVICO(navegadorSemServico()));
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

  const iniciar = (prefixo = "") => {
    if (rec.current || grav.current || transcrevendo) return;
    const C = construtor();
    const podeGravar = !!cb.current.transcrever && temGravacao;
    // Sem serviço conhecido (Brave e afins) ou depois de uma falha nesta aba, grava direto.
    if (podeGravar && (!C || falhou() || navegadorSemServico())) return void gravar(prefixo);
    if (C) return reconhecer(C, prefixo);
    setErro(SEM_SERVICO(null));
  };
  const parar = () => {
    if (grav.current) grav.current.m.stop();
    else rec.current?.stop();
  };
  const suportado = temReconhecimento || (!!transcrever && temGravacao);
  return { suportado, ouvindo, transcrevendo, erro, iniciar, parar, limparErro: () => setErro(null) };
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
