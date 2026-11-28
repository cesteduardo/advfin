"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, useTransition, type CSSProperties, type ReactNode } from "react";
import type { DesfechoPesquisa } from "@/lib/pesquisa/tipos";
import type { Trecho } from "@/lib/pesquisa/tipos";
import { normalizar, normalizarComMapa } from "@/lib/pesquisa/verificador";
import { createPortal, flushSync } from "react-dom";
import { Icone } from "./Icone";
import { Simbolo } from "./Marca";
import { RelatarCitacao, type EnviarRelato } from "./RelatarCitacao";
import { Seletor } from "@/components/ui/Seletor";
import { CampoData } from "@/components/ui/CampoData";
import { lerAnexo, TIPOS_ACEITOS } from "@/lib/anexos/ler";
import { calar, falar, falaSuportada, useDitado, type Transcrever } from "@/lib/anexos/voz";
import type { DocumentoAnexo, TurnoAnterior } from "@/lib/pesquisa/geracao";

const MAX_ANEXOS = 3;

interface Anexo {
  id: string;
  nome: string;
  imagem: boolean;
  estado: "lendo" | "pronto" | "erro";
  etapa: string;
  texto?: string;
  cortado?: boolean;
  usouOcr?: boolean;
  erro?: string;
}

const SUGESTOES = [
  "Qual a alíquota da CBS e do IBS em 2026?",
  "Quando o ICMS e o ISS deixam de existir?",
  "Quais serviços têm redução de 60% nas alíquotas?",
  "O que acontece com PIS e Cofins a partir de 2027?",
];

export type Desfecho = DesfechoPesquisa | { status: "invalida"; mensagem: string };

const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const hora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/** Destaca no texto do dispositivo o trecho citado (comparação normalizada, posição no original). */
function Destaque({ texto, trechos }: { texto: string; trechos: string[] }) {
  const { norm, mapa } = normalizarComMapa(texto);
  const faixas: [number, number][] = [];
  for (const t of trechos) {
    const alvo = normalizar(t.replace(/^["'“]|["'”]$/g, ""));
    const p = norm.indexOf(alvo);
    if (p >= 0 && alvo) faixas.push([mapa[p], mapa[p + alvo.length - 1] + 1]);
  }
  if (!faixas.length) return <>{texto}</>;
  faixas.sort((a, b) => a[0] - b[0]);
  const partes: React.ReactNode[] = [];
  let pos = 0;
  faixas.forEach(([a, b], i) => {
    if (a < pos) return;
    partes.push(texto.slice(pos, a), <mark key={i}>{texto.slice(a, b)}</mark>);
    pos = b;
  });
  partes.push(texto.slice(pos));
  return <>{partes}</>;
}

function vigente(t: Trecho, data: string) {
  return t.vigenciaInicio <= data && (!t.vigenciaFim || t.vigenciaFim > data);
}

/** Cartão de fonte, igual ao da demonstração: número e dispositivo, selo de vigência, norma e trecho. */
function CartaoFonte({
  t,
  data,
  citados,
  ativa,
  aoClicar,
  ordem: i = 0,
  relatar,
}: {
  t: Trecho;
  data: string;
  citados: string[];
  ativa: boolean;
  aoClicar: () => void;
  ordem?: number;
  relatar?: EnviarRelato;
}) {
  return (
    <section id={`fonte-${t.ref}`} className="cartao-fonte mesa-entra" style={{ "--i": i + 1 } as CSSProperties} data-ativa={ativa ? "" : undefined} onClick={aoClicar}>
      <div className="cartao-fonte-topo">
        <strong>
          {t.ref.slice(1)} · {t.rotulo}
        </strong>
        {vigente(t, data) && <span className="selo vigente">Vigente em {dataBR(data)}</span>}
      </div>
      <span className="cartao-fonte-sub">
        {t.norma} ·{" "}
        <a href={t.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          texto oficial
        </a>
      </span>
      <blockquote>
        <Destaque texto={t.texto} trechos={citados} />
      </blockquote>
      {t.origem === "semente" ? (
        <span className="selo semente">Texto provisório, não conferido pelo curador</span>
      ) : t.curadoria === "publicado" ? (
        <span className="selo publicado">Conferido pelo curador</span>
      ) : (
        <span className="selo em_revisao">Aguardando o curador</span>
      )}
      {relatar && citados.length > 0 && <RelatarCitacao dispositivo={t.id} trecho={citados.join(" … ")} enviar={relatar} />}
    </section>
  );
}

/** Régua de vigência do dispositivo em foco, de 2023 a 2033, com a data de referência marcada. */
function Regua({ t, data }: { t: Trecho; data: string }) {
  const ini = Date.UTC(2023, 0, 1);
  const fim = Date.UTC(2034, 0, 1);
  const pos = (iso: string) => Math.min(100, Math.max(0, ((Date.parse(iso) - ini) / (fim - ini)) * 100));
  const a = pos(t.vigenciaInicio);
  const b = t.vigenciaFim ? pos(t.vigenciaFim) : 100;
  return (
    <div className="mesa-vigencia">
      <p className="mesa-rotulo">Vigência do dispositivo {t.ref.slice(1)}</p>
      <div className="regua" role="img" aria-label={`Vigente desde ${dataBR(t.vigenciaInicio)}${t.vigenciaFim ? ` até ${dataBR(t.vigenciaFim)}` : ", sem data final"}; consulta em ${dataBR(data)}`}>
        <b style={{ left: `${a}%`, width: `${b - a}%` }} />
        <i style={{ left: `${pos(data)}%` }} />
      </div>
      <div className="regua-anos">
        <span>2023</span>
        <span>{dataBR(data)}</span>
        <span>2033</span>
      </div>
      <p className="mesa-nota">
        Desde {dataBR(t.vigenciaInicio)}
        {t.vigenciaFim ? ` até ${dataBR(t.vigenciaFim)}` : ", sem revogação registrada"}.
      </p>
    </div>
  );
}

const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const movimentoReduzido = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Ordem de entrada em cascata: cada parte entra 60 ms depois da anterior. */
const ordem = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * A mesa da pesquisa, sem saber de onde vem a resposta: no app, de uma ação do servidor;
 * na demonstração estática, do laboratório que roda no navegador.
 */
export function PesquisaMesa({
  executar,
  aoConcluir,
  falhaRede = "Não foi possível falar com o servidor.",
  dataInicial,
  casos,
  casoInicial = "",
  exportar,
  relatar,
  nome,
  opcoesCampo,
  abaixoDoCampo,
  notaAnexos,
  transcrever,
}: {
  executar: (pergunta: string, data: string, caso?: string | null, documentos?: DocumentoAnexo[], historico?: TurnoAnterior[]) => Promise<Desfecho>;
  aoConcluir?: () => void;
  falhaRede?: string;
  /** Data de vigência ao abrir (preferência do perfil); sem ela, hoje. */
  dataInicial?: string;
  /** Casos em que a consulta pode entrar (só no app). */
  casos?: { id: string; titulo: string }[];
  casoInicial?: string;
  /** No app, a resposta vira parecer em página própria; na demonstração, imprime direto. */
  exportar?: (id: string) => ReactNode;
  /** No app: envia o relato de citação errada, ligado à consulta. */
  relatar?: (consulta: string, r: Parameters<EnviarRelato>[0]) => ReturnType<EnviarRelato>;
  /** Primeiro nome para a saudação da tela inicial. */
  nome?: string;
  /** Controles extras no pé do campo (ex.: quem redige a resposta, na demonstração). */
  opcoesCampo?: ReactNode;
  /** Algo logo abaixo do campo (ex.: a chave da Anthropic, quando escolhida). */
  abaixoDoCampo?: ReactNode;
  /** Aviso curto sobre o uso dos anexos (ex.: no modo sem IA, eles não entram na resposta). */
  notaAnexos?: string;
  /** Transcrição da fala gravada, para navegadores sem ditado próprio (Whisper do Groq). */
  transcrever?: Transcrever;
}) {
  const [pergunta, setPergunta] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [arrastando, setArrastando] = useState(false);
  const seletorArquivo = useRef<HTMLInputElement>(null);
  // Modo voz: a pergunta falada vai sozinha ao terminar, e a resposta é lida em voz alta.
  const modoVoz = useRef(false);
  const [falando, setFalando] = useState(false);
  const enviarRef = useRef<(q?: string) => void>(() => {});
  const ditado = useDitado({
    aoParcial: (t) => setPergunta(t),
    aoFim: (t) => {
      if (modoVoz.current && t.trim().length >= 8) enviarRef.current(t);
      else modoVoz.current = false;
    },
    transcrever,
  });
  const [podeFalar, setPodeFalar] = useState(false);
  useEffect(() => setPodeFalar(falaSuportada()), []);
  useEffect(() => () => void calar(), []);

  const anexar = (lista: FileList | File[]) => {
    const livres = MAX_ANEXOS - anexos.length;
    [...lista].slice(0, Math.max(0, livres)).forEach((f) => {
      const id = novoId();
      const imagem = f.type.startsWith("image/");
      setAnexos((a) => [...a, { id, nome: f.name || (imagem ? "imagem colada" : "documento"), imagem, estado: "lendo", etapa: "Abrindo o arquivo" }]);
      const mudar = (x: Partial<Anexo>) => setAnexos((a) => a.map((y) => (y.id === id ? { ...y, ...x } : y)));
      lerAnexo(f, (etapa) => mudar({ etapa }))
        .then((r) => mudar({ estado: "pronto", texto: r.texto, cortado: r.cortado, usouOcr: r.usouOcr, etapa: r.usouOcr ? "Lido com OCR" : r.paginas ? `${r.paginas} ${r.paginas === 1 ? "página" : "páginas"}` : "Lido" }))
        .catch((e: Error) => mudar({ estado: "erro", erro: e.message || "Não consegui ler o arquivo." }));
    });
  };
  const lendo = anexos.some((a) => a.estado === "lendo");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [data, setData] = useState(dataInicial ?? hoje);
  const [caso, setCaso] = useState(casoInicial);
  const [ativa, setAtiva] = useState<{ turno: string; ref: string } | null>(null);
  const [emFoco, setEmFoco] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const [etapa, setEtapa] = useState(0);
  const [digitando, setDigitando] = useState<string | null>(null);
  // No celular as fontes ficam num painel que sobe do rodapé, como os anexos de um chat.
  const [painel, setPainel] = useState(false);
  const fechar = useRef<HTMLButtonElement>(null);
  // O pop-up de fontes é montado dentro da .mesa (para herdar os estilos), fora de qualquer animação que prenda o position: fixed.
  const [destino, setDestino] = useState<HTMLElement | null>(null);
  useEffect(() => setDestino(document.querySelector<HTMLElement>(".mesa") ?? document.body), []);
  useEffect(() => {
    if (!painel) return;
    requestAnimationFrame(() => fechar.current?.focus());
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPainel(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [painel]);
  const campo = useRef<HTMLTextAreaElement>(null);
  const fim = useRef<HTMLDivElement>(null);
  // A conversa reserva embaixo a altura do campo fixo, que muda com anexos e avisos.
  const chat = useRef<HTMLDivElement>(null);
  const rodapeRef = useRef<HTMLDivElement>(null);
  const emConversa = turnos.length > 0;
  useEffect(() => {
    const r = rodapeRef.current;
    if (!emConversa || !r || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => chat.current?.style.setProperty("--rodape-h", `${Math.ceil(r.offsetHeight)}px`));
    ro.observe(r);
    return () => ro.disconnect();
  }, [emConversa, destino]);
  // A saudação depende da hora local; calculada só no navegador para não divergir do HTML estático.
  const [saudacao, setSaudacao] = useState("Olá");
  useEffect(() => {
    const h = Number(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).slice(0, 2));
    setSaudacao(h >= 5 && h < 12 ? "Bom dia" : h >= 12 && h < 18 ? "Boa tarde" : "Boa noite");
  }, []);

  // As etapas do "pensando" trocam enquanto a resposta não chega.
  useEffect(() => {
    if (!pendente) return setEtapa(0);
    const t = [setTimeout(() => setEtapa(1), 800), setTimeout(() => setEtapa(2), 1600)];
    return () => t.forEach(clearTimeout);
  }, [pendente]);

  // A conversa acompanha o fim, como num chat, a cada pergunta e enquanto a resposta é digitada.
  const rolarAoFim = (suave = true) => fim.current?.scrollIntoView({ behavior: suave && !movimentoReduzido() ? "smooth" : "auto", block: "end" });

  const [aviso, setAviso] = useState<string | null>(null);
  const enviar = (q = pergunta) => {
    if (pendente) return;
    if (lendo) return setAviso("Espere o anexo terminar de ser lido e envie de novo.");
    if (q.trim().length < 8) {
      setAviso(q.trim() ? "Escreva um pouco mais: a pergunta precisa de pelo menos 8 letras para a busca nas normas." : "Escreva a pergunta antes de enviar.");
      campo.current?.focus();
      return;
    }
    setAviso(null);
    ditado.parar();
    calar();
    setFalando(false);
    const prontos = anexos.filter((a) => a.estado === "pronto" && a.texto);
    const documentos: DocumentoAnexo[] = prontos.map((a) => ({ nome: a.nome, texto: a.texto! }));
    const lerEmVoz = modoVoz.current;
    modoVoz.current = false;
    const turno: Turno = { id: novoId(), texto: q.trim(), data, hora: hora(), desfecho: null, anexos: prontos.map((a) => ({ nome: a.nome, imagem: a.imagem })), documentos };
    const aplicar = () => {
      setTurnos((t) => [...t, turno]);
      setPergunta("");
      setAnexos([]);
      setAtiva(null);
      setEmFoco(turno.id);
    };
    // Da tela inicial para a conversa, o campo desce ao rodapé numa transição contínua (onde o navegador permite).
    type Transicao = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> };
    const doc = document as Document & { startViewTransition?: (f: () => void) => Transicao };
    if (!turnos.length && doc.startViewTransition && !movimentoReduzido()) {
      // Se o navegador interromper a transição (ex.: a tela girou), a mudança acontece igual, sem erro.
      const vt = doc.startViewTransition(() => flushSync(aplicar));
      [vt.ready, vt.finished, vt.updateCallbackDone].forEach((p) => p?.catch(() => {}));
    } else aplicar();
    requestAnimationFrame(() => rolarAoFim());
    rodar(turno, historicoDe(turnos), lerEmVoz);
  };

  /** Perguntas e respostas anteriores a um turno, para o modelo entender o seguimento. */
  const historicoDe = (lista: Turno[]): TurnoAnterior[] =>
    lista
      .filter((x) => x.desfecho)
      .slice(-3)
      .map((x) => ({ pergunta: x.texto, resposta: x.desfecho?.status === "respondida" ? x.desfecho.paragrafos.join(" ") : "" }));

  /** Pede a resposta de um turno já na conversa (novo, editado ou gerado de novo). */
  const rodar = (turno: Turno, historico: TurnoAnterior[], lerEmVoz = false) => {
    iniciar(async () => {
      const inicio = performance.now();
      let r: Desfecho;
      try {
        r = await executar(turno.texto, turno.data, caso || null, turno.documentos, historico);
      } catch {
        r = { status: "erro", id: "", mensagem: falhaRede, fontes: [] };
      }
      // A resposta nunca cai de uma vez: o "pensando" mostra o que está sendo feito, depois o texto é digitado.
      await espera(Math.max(0, (movimentoReduzido() ? 400 : 1900) - (performance.now() - inicio)));
      setTurnos((t) => t.map((x) => (x.id === turno.id ? { ...x, desfecho: r } : x)));
      setDigitando(r.status === "respondida" && !movimentoReduzido() ? turno.id : null);
      if (lerEmVoz && podeFalar) {
        const texto = r.status === "respondida" ? r.paragrafos.join(" ") : "mensagem" in r ? r.mensagem : "Não encontrei dispositivos vigentes para essa pergunta.";
        setFalando(true);
        falar(texto, () => setFalando(false));
      }
      aoConcluir?.();
    });
  };
  enviarRef.current = enviar;

  /** Editar uma pergunta substitui ela e tudo o que veio depois, como nos chats de IA. */
  const reenviar = (id: string, texto: string, editada: boolean) => {
    if (pendente || texto.trim().length < 8) return;
    calar();
    setFalando(false);
    const i = turnos.findIndex((x) => x.id === id);
    if (i < 0) return;
    const antigo = turnos[i];
    const novo: Turno = { ...antigo, id: novoId(), texto: texto.trim(), hora: hora(), desfecho: null, editada: antigo.editada || editada };
    setTurnos((t) => [...t.slice(0, i), novo]);
    setAtiva(null);
    setEmFoco(novo.id);
    setPainel(false);
    requestAnimationFrame(() => rolarAoFim());
    rodar(novo, historicoDe(turnos.slice(0, i)));
  };


  const focar = (turno: string, ref: string) => {
    setEmFoco(turno);
    setAtiva({ turno, ref });
    setPainel(true);
    requestAnimationFrame(() => document.getElementById(`fonte-${ref}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  // Fontes ao lado: as do turno em foco (o mais recente, ou aquele cuja citação foi clicada).
  const turnoFoco = turnos.find((t) => t.id === emFoco) ?? turnos[turnos.length - 1];
  const desfechoFoco = turnoFoco?.desfecho ?? null;
  const dataRef = turnoFoco?.data ?? data;
  const fontes = desfechoFoco && "fontes" in desfechoFoco ? desfechoFoco.fontes : [];
  const citados = new Map<string, string[]>();
  if (desfechoFoco?.status === "respondida") {
    for (const c of desfechoFoco.citacoes) citados.set(c.ref, [...(citados.get(c.ref) ?? []), c.trecho]);
  }
  const exibidas = desfechoFoco?.status === "respondida" ? fontes.filter((f) => citados.has(f.ref)) : fontes;
  const refAtiva = ativa && ativa.turno === turnoFoco?.id ? ativa.ref : null;
  const foco = exibidas.find((f) => f.ref === refAtiva) ?? exibidas[0];

  const temTexto = pergunta.trim().length > 0 || anexos.length > 0;
  const formulario = (
    <form
      className="mesa-campo compositor"
      data-arrastando={arrastando ? "" : undefined}
      data-ouvindo={ditado.ouvindo ? "" : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setArrastando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastando(false);
        if (e.dataTransfer.files.length) anexar(e.dataTransfer.files);
      }}
    >
      {anexos.length > 0 && (
        <ul className="compositor-anexos" aria-label="Anexos">
          {anexos.map((a) => (
            <li key={a.id} className="anexo" data-estado={a.estado}>
              <span className="anexo-ico">{a.estado === "lendo" ? <span className="anexo-gira" aria-hidden="true" /> : <Icone nome={a.imagem ? "imagem" : "documento"} />}</span>
              <span className="anexo-texto">
                <strong>{a.nome}</strong>
                <span role={a.estado === "erro" ? "alert" : "status"}>{a.estado === "erro" ? a.erro : a.cortado ? `${a.etapa} · texto cortado em 12 mil caracteres` : a.etapa}</span>
              </span>
              <button type="button" className="anexo-tirar" onClick={() => setAnexos((x) => x.filter((y) => y.id !== a.id))} aria-label={`Tirar ${a.nome}`}>
                <Icone nome="fechar" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <label htmlFor="pergunta" className="so-leitor">
        Pergunta
      </label>
      <textarea
        id="pergunta"
        ref={campo}
        rows={turnos.length ? 1 : 2}
        value={pergunta}
        onChange={(e) => {
          setPergunta(e.target.value);
          if (aviso) setAviso(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            enviar();
          }
        }}
        onPaste={(e) => {
          const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
          if (imgs.length) {
            e.preventDefault();
            anexar(imgs);
          }
        }}
        placeholder={ditado.transcrevendo ? "Transcrevendo o que você disse…" : ditado.ouvindo ? "Pode falar, estou ouvindo…" : turnos.length ? "Responder ou perguntar outra coisa…" : "Pergunte sobre a transição…"}
        maxLength={2000}
      />
      <div className="mesa-campo-pe">
        <span className="compositor-esq">
          <input
            ref={seletorArquivo}
            type="file"
            accept={TIPOS_ACEITOS}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) anexar(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="compositor-botao"
            onClick={() => seletorArquivo.current?.click()}
            disabled={anexos.length >= MAX_ANEXOS}
            aria-label="Anexar PDF ou imagem"
            title={anexos.length >= MAX_ANEXOS ? "Até 3 anexos por pergunta" : "Anexar PDF ou imagem (o texto é lido com OCR)"}
          >
            <Icone nome="mais" />
          </button>
        </span>
        <span className="compositor-dir">
          {ditado.suportado && (
            <button
              type="button"
              className="compositor-botao"
              data-ligado={ditado.ouvindo && !modoVoz.current ? "" : undefined}
              aria-pressed={ditado.ouvindo && !modoVoz.current}
              aria-busy={ditado.transcrevendo || undefined}
              disabled={ditado.transcrevendo}
              onClick={() => {
                if (ditado.ouvindo) return ditado.parar();
                modoVoz.current = false;
                ditado.iniciar(pergunta);
              }}
              aria-label={ditado.transcrevendo ? "Transcrevendo" : ditado.ouvindo ? "Parar a gravação" : "Ditar a pergunta"}
              title={ditado.transcrevendo ? "Transcrevendo…" : ditado.ouvindo ? "Parar a gravação" : "Ditar a pergunta"}
            >
              <Icone nome={ditado.ouvindo ? "parar" : "microfone"} />
            </button>
          )}
          <button className="app-enviar compositor-enviar" data-vazio={temTexto ? undefined : ""} disabled={pendente} aria-label="Enviar a pergunta" title="Enviar (Enter)">
            <Icone nome="enviar" />
          </button>
        </span>
      </div>
      {arrastando && <div className="compositor-solte" aria-hidden="true">Solte o PDF ou a imagem para ler o texto</div>}
    </form>
  );
  const textoAviso = aviso ?? ditado.erro ?? (notaAnexos && anexos.length > 0 ? notaAnexos : null);
  const avisos = textoAviso && (
    <p className="compositor-aviso" role={aviso || ditado.erro ? "alert" : undefined}>
      {textoAviso}
    </p>
  );
  const opcoes = (
    <div className="mesa-campo-opcoes compositor-opcoes">
      <span className="app-data">
        <span className="app-data-rotulo">Vigência em</span>
        <CampoData value={data} onChange={setData} min="2023-12-21" rotulo="Vigência em" compacto />
      </span>
      {casos && casos.length > 0 && (
        <span className="app-data">
          <span className="app-data-rotulo">Caso</span>
          <Seletor
            value={caso}
            onChange={setCaso}
            rotulo="Caso"
            compacto
            opcoes={[{ valor: "", rotulo: "Nenhum" }, ...casos.map((c) => ({ valor: c.id, rotulo: c.titulo }))]}
          />
        </span>
      )}
      {opcoesCampo}
    </div>
  );

  // Tela inicial: saudação, campo grande no centro e sugestões logo abaixo. A conversa só ocupa a tela depois do primeiro envio.
  if (!turnos.length) {
    return (
      <div className="pesquisa-inicio">
        <div className="pesquisa-inicio-cabeca">
          <Simbolo />
          <h2>
            {saudacao}
            {nome ? `, ${nome}` : ""}.
          </h2>
        </div>
        {formulario}
        {avisos}
        {opcoes}
        {abaixoDoCampo}
        <div className="pesquisa-sugestoes" role="list" aria-label="Sugestões de pergunta">
          {SUGESTOES.map((sug, i) => (
            <button type="button" role="listitem" key={sug} className="pesquisa-sugestao" style={{ "--i": i } as CSSProperties} onClick={() => enviar(sug)}>
              <Icone nome="pesquisa" />
              <span>{sug}</span>
            </button>
          ))}
        </div>
        <p className="pesquisa-inicio-nota">Só dispositivos vigentes na data escolhida, com o trecho original a um toque. Se uma citação não existir na base, a resposta é bloqueada.</p>
      </div>
    );
  }

  const rodape = (
    <div className="pesquisa-rodape" ref={rodapeRef}>
      {formulario}
      {avisos}
      {opcoes}
      {abaixoDoCampo}
      <p className="pesquisa-rodape-nota">Respostas só com dispositivos vigentes em {dataBR(data)}. Toque no número da citação para ver a fonte.</p>
    </div>
  );

  return (
    <div className="pesquisa-chat" ref={chat}>
      <section className="mesa-conversa" aria-live="polite">
        {turnos.map((t) => (
          <TurnoChat
            key={t.id}
            t={t}
            etapa={etapa}
            digitar={digitando === t.id}
            aoDigitar={() => rolarAoFim(false)}
            aoTerminar={() => {
              setDigitando((d) => (d === t.id ? null : d));
              requestAnimationFrame(() => rolarAoFim());
            }}
            ativa={ativa?.turno === t.id ? ativa.ref : null}
            focar={(ref) => focar(t.id, ref)}
            exportar={exportar}
            novaPergunta={() => campo.current?.focus()}
            ultimo={t.id === turnos[turnos.length - 1].id}
            dicaSemIa={!!opcoesCampo}
            ocupado={pendente}
            reenviar={(texto, editada) => reenviar(t.id, texto, editada)}
            verFontes={() => {
              setEmFoco(t.id);
              setPainel(true);
            }}
          />
        ))}
        <div ref={fim} className="pesquisa-fim" aria-hidden="true" />
      </section>

      {/* O campo fica fixo no pé da tela, fora de qualquer animação que prenderia o position: fixed. */}
      {destino ? createPortal(rodape, destino) : rodape}
      {destino &&
        createPortal(
          <>
            <div className="fontes-veu" data-aberto={painel ? "" : undefined} aria-hidden="true" onClick={() => setPainel(false)} />
            <div className="fontes-pop mesa-fontes" role="dialog" aria-modal="true" aria-labelledby="fontes-titulo" data-aberto={painel ? "" : undefined} inert={!painel}>
              <span className="fontes-alca" aria-hidden="true" />
              <div className="fontes-pop-topo">
                <div>
                  <p className="mesa-rotulo" id="fontes-titulo">{desfechoFoco?.status === "respondida" ? "Fontes conferidas" : "Dispositivos encontrados"}</p>
                  {turnoFoco && <p className="fontes-pop-pergunta">{turnoFoco.texto}</p>}
                </div>
                <button type="button" ref={fechar} className="fontes-pop-fechar" onClick={() => setPainel(false)} aria-label="Fechar fontes">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <div className="fontes-pop-corpo">
                {exibidas.length === 0 && <p className="mesa-vazio-cartao">Nenhum dispositivo para mostrar.</p>}
                {exibidas.map((f, i) => (
                  <CartaoFonte key={`${turnoFoco?.id}-${f.id}`} ordem={i} t={f} data={dataRef} citados={citados.get(f.ref) ?? []} ativa={foco?.ref === f.ref && exibidas.length > 1} aoClicar={() => turnoFoco && setAtiva({ turno: turnoFoco.id, ref: f.ref })}
                    relatar={relatar && desfechoFoco?.status === "respondida" ? (r) => relatar(desfechoFoco.id, r) : undefined}
                  />
                ))}
                {foco && <Regua t={foco} data={dataRef} />}
              </div>
            </div>
          </>,
          destino,
        )}
    </div>
  );
}

interface Turno {
  id: string;
  texto: string;
  data: string;
  hora: string;
  desfecho: Desfecho | null;
  anexos: { nome: string; imagem: boolean }[];
  /** Texto dos anexos, para reenviar ou gerar de novo com os mesmos documentos. */
  documentos: DocumentoAnexo[];
  editada?: boolean;
}

let seq = 0;
const novoId = () => `t${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Quebra um parágrafo em palavras, espaços e marcas de citação [Dn], para digitar sem cortar uma marca ao meio. */
const tokens = (p: string) => p.split(/(\[D\d{1,2}\]|\s+)/).filter(Boolean);

/**
 * Digitação da resposta, como nos assistentes de conversa: as palavras surgem em ritmo de leitura,
 * com um cursor no fim. Respostas longas aceleram para não passar de uns 3,5 segundos.
 */
function useDigitacao(paragrafos: string[], ligado: boolean, aoAvancar: () => void, aoTerminar: () => void) {
  const total = paragrafos.reduce((n, p) => n + tokens(p).length, 0);
  const [mostrados, setMostrados] = useState(ligado ? 0 : total);
  const avancar = useRef(aoAvancar);
  const terminar = useRef(aoTerminar);
  avancar.current = aoAvancar;
  terminar.current = aoTerminar;
  useEffect(() => {
    if (!ligado) return setMostrados(total);
    const porSegundo = Math.max(48, total / 3.5);
    const inicio = performance.now();
    let quadro = 0;
    let ultimo = 0;
    const passo = (agora: number) => {
      const n = Math.min(total, Math.floor(((agora - inicio) / 1000) * porSegundo));
      if (n !== ultimo) {
        ultimo = n;
        setMostrados(n);
        avancar.current();
      }
      if (n < total) quadro = requestAnimationFrame(passo);
      else terminar.current();
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [ligado, total]);
  return { mostrados, total };
}

function TurnoChat({
  t,
  etapa,
  digitar,
  aoDigitar,
  aoTerminar,
  ativa,
  focar,
  exportar,
  novaPergunta,
  verFontes,
  ultimo,
  ocupado,
  reenviar,
  dicaSemIa,
}: {
  t: Turno;
  etapa: number;
  digitar: boolean;
  aoDigitar: () => void;
  aoTerminar: () => void;
  ativa: string | null;
  focar: (ref: string) => void;
  exportar?: (id: string) => ReactNode;
  novaPergunta: () => void;
  verFontes: () => void;
  ultimo: boolean;
  dicaSemIa: boolean;
  ocupado: boolean;
  reenviar: (texto: string, editada: boolean) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(t.texto);
  const caixa = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!editando) return;
    const c = caixa.current;
    if (c) {
      c.focus();
      c.setSelectionRange(c.value.length, c.value.length);
    }
  }, [editando]);
  const d = t.desfecho;
  const paragrafos = d?.status === "respondida" ? d.paragrafos : [];
  const { mostrados, total } = useDigitacao(paragrafos, digitar, aoDigitar, aoTerminar);
  const terminou = mostrados >= total;
  const provisorio = d?.status === "respondida" && d.fontes.some((f) => f.origem === "semente" || f.curadoria !== "publicado");

  let resta = mostrados;
  const corpo = paragrafos.map((p, i) => {
    if (resta <= 0) return null;
    const tk = tokens(p);
    const vis = tk.slice(0, resta);
    resta -= tk.length;
    const ultimoVisivel = resta <= 0 && !terminou;
    return (
      <p key={i}>
        {vis.map((parte, j) => {
          const m = /^\[(D\d{1,2})\]$/.exec(parte);
          return m ? (
            <sup key={j} className="cit">
              <button type="button" aria-pressed={ativa === m[1]} onClick={() => focar(m[1])} aria-label={`Ver fonte ${m[1].slice(1)}`}>
                {m[1].slice(1)}
              </button>
            </sup>
          ) : (
            <Fragment key={j}>{parte}</Fragment>
          );
        })}
        {ultimoVisivel && <span className="pesquisa-cursor" aria-hidden="true" />}
      </p>
    );
  });

  const textoResposta =
    d?.status === "respondida"
      ? [
          ...d.paragrafos.map((p) => p.replace(/\[D(\d{1,2})\]/g, "[$1]")),
          "",
          "Fontes:",
          ...[...new Set(d.citacoes.map((c) => c.ref))].map((ref) => {
            const f = d.fontes.find((x) => x.ref === ref);
            return `[${ref.slice(1)}] ${f ? `${f.norma}, ${f.rotulo}` : ref}`;
          }),
        ].join("\n")
      : d && "mensagem" in d
        ? d.mensagem
        : "";
  const acoesResposta = d && (d.status !== "respondida" || terminou) && (
    <div className="pesquisa-msg-acoes pesquisa-surge">
      {textoResposta && <BotaoCopiar texto={textoResposta} rotulo="Copiar a resposta" />}
      {ultimo && (
        <button type="button" className="pesquisa-msg-botao" disabled={ocupado} onClick={() => reenviar(t.texto, false)} aria-label="Gerar a resposta de novo" title="Gerar de novo">
          <Icone nome="refazer" />
        </button>
      )}
    </div>
  );

  const etapas = [`Buscando dispositivos vigentes em ${dataBR(t.data)}`, "Conferindo cada citação na base versionada", "Confirmando a vigência das fontes"];

  return (
    <div className="pesquisa-turno">
      {t.anexos.length > 0 && (
        <ul className="pesquisa-bolha-anexos" aria-label="Anexos da pergunta">
          {t.anexos.map((a, i) => (
            <li key={i}>
              <Icone nome={a.imagem ? "imagem" : "documento"} />
              {a.nome}
            </li>
          ))}
        </ul>
      )}
      {editando ? (
        <form
          className="pesquisa-editar"
          onSubmit={(e) => {
            e.preventDefault();
            if (rascunho.trim().length < 8 || ocupado) return;
            setEditando(false);
            reenviar(rascunho, rascunho.trim() !== t.texto);
          }}
        >
          <label className="so-leitor" htmlFor={`editar-${t.id}`}>
            Editar a pergunta
          </label>
          <textarea
            id={`editar-${t.id}`}
            ref={caixa}
            rows={2}
            value={rascunho}
            maxLength={2000}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setEditando(false);
                setRascunho(t.texto);
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <p className="pesquisa-editar-nota">Ao enviar, esta pergunta e o que veio depois dela são substituídos.</p>
          <div className="pesquisa-editar-pe">
            <button
              type="button"
              className="mesa-botao secundario"
              onClick={() => {
                setEditando(false);
                setRascunho(t.texto);
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="mesa-botao" disabled={rascunho.trim().length < 8 || ocupado}>
              Enviar
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="mesa-pergunta pesquisa-bolha">{t.texto}</p>
          <div className="pesquisa-msg-acoes pesquisa-msg-acoes-pergunta">
            {t.editada && <span className="pesquisa-msg-editada">Editada</span>}
            <BotaoCopiar texto={t.texto} rotulo="Copiar a pergunta" />
            <button
              type="button"
              className="pesquisa-msg-botao"
              disabled={ocupado}
              onClick={() => {
                setRascunho(t.texto);
                setEditando(true);
              }}
              aria-label="Editar a pergunta"
              title="Editar a pergunta"
            >
              <Icone nome="editar" />
            </button>
          </div>
        </>
      )}

      {!d && (
        <div className="pesquisa-pensando" role="status">
          <span className="pesquisa-pensando-simbolo"><Simbolo /></span>
          <span className="pesquisa-pensando-texto" key={etapa}>{etapas[etapa]}…</span>
        </div>
      )}

      {d?.status === "respondida" && (
        <>
          <article className="mesa-resposta pesquisa-resposta" aria-busy={!terminou}>
            <p className="mesa-autor">
              <Simbolo /> AdvFin · {d.redigida ? "revisão pendente" : "trechos literais, sem redação"}
            </p>
            {provisorio && <p className="alerta aviso pesquisa-surge">Fontes ainda não conferidas pelo tributarista curador. Use como ponto de partida, não em peça.</p>}
            {corpo}
            {terminou && !d.redigida && dicaSemIa && (
              <p className="mesa-nota pesquisa-surge pesquisa-sem-ia">Sem IA conectada, mostro só os trechos literais das normas. Para uma resposta redigida, que conversa e responde a perguntas de seguimento, escolha uma IA em Resposta, logo abaixo do campo.</p>
            )}
            {terminou && (
              <p className="mesa-aviso-ia pesquisa-surge">
                Ferramenta de apoio para advogados. Não é parecer e não substitui a análise do profissional, que confere as fontes e
                responde pelo que assina.
              </p>
            )}
            {terminou && (
              <div className="mesa-acoes pesquisa-surge">
                {exportar ? (
                  exportar(d.id)
                ) : (
                  <button type="button" className="primaria" onClick={() => window.print()}>
                    Imprimir ou salvar PDF
                  </button>
                )}
                <button type="button" className="pesquisa-ver-fontes" onClick={verFontes}>
                  Fontes · {d.citacoes.length ? new Set(d.citacoes.map((c) => c.ref)).size : d.fontes.length}
                </button>
                <Link href="/app/calculo">Simular a transição</Link>
                <button type="button" onClick={novaPergunta}>
                  Nova pergunta
                </button>
              </div>
            )}
          </article>
          {terminou && (
            <div className="mesa-auditoria pesquisa-surge" style={ordem(1)}>
              <p className="mesa-rotulo">Trilha de auditoria</p>
              <ul>
                <li>
                  <i className="ok" />
                  {d.citacoes.length === 1 ? "Citação conferida" : `${d.citacoes.length} citações conferidas`} na base versionada
                  <span>{t.hora}</span>
                </li>
                <li>
                  <i className="ok" />
                  Vigência confirmada em {dataBR(t.data)}
                  <span>{t.hora}</span>
                </li>
                <li>
                  <i />
                  Aguardando revisão do advogado<span>agora</span>
                </li>
              </ul>
            </div>
          )}
        </>
      )}

      {d?.status === "bloqueada_citacao" && (
        <>
          <article className="mesa-resposta pesquisa-resposta pesquisa-surge">
            <p className="mesa-autor">
              <Simbolo /> AdvFin · resposta bloqueada
            </p>
            <p>A resposta não foi exibida porque não se sustenta inteiramente na base. Reformule a pergunta ou leia os dispositivos encontrados.</p>
            <div className="mesa-acoes">
              <button type="button" onClick={verFontes}>Ver dispositivos · {d.fontes.length}</button>
            </div>
          </article>
          <div className="mesa-auditoria pesquisa-surge" style={ordem(1)}>
            <p className="mesa-rotulo">Trilha de auditoria</p>
            <ul>
              {d.motivos.map((m, i) => (
                <li key={i}>
                  <i className="falha" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {d?.status === "sem_resultado" && (
        <article className="mesa-resposta pesquisa-resposta pesquisa-surge">
          <p className="mesa-autor">
            <Simbolo /> AdvFin · sem dispositivos
          </p>
          <p>
            Nenhum dispositivo vigente em {dataBR(t.data)} trata disso na base atual, que ainda cobre só o núcleo da Reforma (EC 132/2023 e LC
            214/2025).
          </p>
        </article>
      )}

      {(d?.status === "erro" || d?.status === "invalida") && (
        <p className="alerta erro pesquisa-surge" role="alert">
          {d.mensagem}
        </p>
      )}
      {acoesResposta}
    </div>
  );
}

/** Copia para a área de transferência e confirma no próprio botão. */
function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [feito, setFeito] = useState(false);
  useEffect(() => {
    if (!feito) return;
    const t = setTimeout(() => setFeito(false), 1600);
    return () => clearTimeout(t);
  }, [feito]);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const a = document.createElement("textarea");
      a.value = texto;
      a.style.position = "fixed";
      a.style.opacity = "0";
      document.body.appendChild(a);
      a.select();
      document.execCommand("copy");
      a.remove();
    }
    setFeito(true);
  };
  return (
    <button type="button" className="pesquisa-msg-botao" data-feito={feito ? "" : undefined} onClick={copiar} aria-label={feito ? "Copiado" : rotulo} title={feito ? "Copiado" : rotulo}>
      <Icone nome={feito ? "ok" : "copiar"} />
      <span className="pesquisa-msg-dica" aria-hidden="true">{feito ? "Copiado" : ""}</span>
    </button>
  );
}
