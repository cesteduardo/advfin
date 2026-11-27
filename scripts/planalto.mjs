/**
 * Leitura de normas publicadas no Planalto (planalto.gov.br/ccivil_03).
 *
 * Puro: recebe o HTML, devolve os artigos vigentes no texto compilado.
 * Remove o que o Planalto mostra tachado (redação revogada ou alterada) e as
 * notas entre parênteses de alteração. O resultado entra na base como
 * 'rascunho': quem decide o rótulo final e a vigência de cada artigo é o curador.
 */

/** Decodifica respeitando o charset declarado (o Planalto ainda usa windows-1252 em muitas páginas). */
export function decodificar(bytes, contentType = "") {
  const doCabecalho = /charset=([\w-]+)/i.exec(contentType)?.[1];
  const ascii = new TextDecoder("latin1").decode(bytes.slice(0, 2048));
  const doHtml = /<meta[^>]+charset=["']?([\w-]+)/i.exec(ascii)?.[1];
  const charset = (doCabecalho || doHtml || "utf-8").toLowerCase();
  return new TextDecoder(charset === "iso-8859-1" ? "windows-1252" : charset).decode(bytes);
}

const ENTIDADES = { nbsp: " ", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", hellip: "…", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "º", ordf: "ª", sect: "§", ndash: "–", mdash: "—", laquo: "«", raquo: "»" };

const DIACRITICOS = { acute: "\u0301", grave: "\u0300", circ: "\u0302", tilde: "\u0303", cedil: "\u0327", uml: "\u0308" };

/** Notas de alteração do Planalto: "(Redação dada pela Lei Complementar nº 227, de 2026)". */
export const NOTA = /\((?:Reda[cç][aã]o dada|Inclu[ií]d[oa]|Revogad[oa]|Vide|Regulamento|Vig[eê]ncia|Produ[cç][aã]o de efeitos?)[^)]*\)/gi;

/**
 * HTML do Planalto em texto corrido. Com manterNotas, as notas de alteração ficam no
 * texto para que artigos() as guarde à parte (o curador usa a nota para datar a versão).
 */
export function textoLimpo(html, { manterNotas = false } = {}) {
  const t = html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(strike|s|del)\b[\s\S]*?<\/\1>/gi, " ") // redação revogada
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z])(acute|grave|circ|tilde|cedil|uml);/g, (_, l, d) => (l + DIACRITICOS[d]).normalize("NFC"))
    .replace(/&(\w+);/g, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
  ;
  return (manterNotas ? t : t.replace(NOTA, " "))
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * Norma de destino de uma alteração, lida na frase que abre o artigo: "A Constituição
 * Federal passa a vigorar...", "O Ato das Disposições... passa a vigorar acrescido...",
 * "A Lei Complementar nº 87, de 13 de setembro de 1996, passa a vigorar...".
 */
export function destinoDaAlteracao(texto) {
  if (/Ato das Disposi[cç][oõ]es Constitucionais Transit[oó]rias/i.test(texto)) return "ADCT";
  if (/Constitui[cç][aã]o Federal/i.test(texto) && /passa(?:m)? a vigorar|com as seguintes altera/i.test(texto)) return "CF";
  const m = /(Lei Complementar|Decreto-Lei|Lei)\s+n[ºo°.]*\s*([\d.]+)\s*,\s*de\s+[^,]*?(\d{4})/i.exec(texto);
  if (m && /passa(?:m)? a vigorar|alterad|acrescid/i.test(texto)) {
    const sigla = /complementar/i.test(m[1]) ? "LC" : /decreto/i.test(m[1]) ? "DL" : "Lei";
    return `${sigla} ${m[2]}/${m[3]}`;
  }
  return null;
}

/**
 * Quebra em artigos. Cada artigo leva seus parágrafos, incisos e alíneas até o
 * próximo "Art. N". Rótulo: "art. 125", "art. 9º", "art. 156-A".
 *
 * Artigo entre aspas é texto que a norma insere em OUTRA norma (a EC 132 reescreve a
 * Constituição e acrescenta artigos ao ADCT; a LC 214 altera leis antigas). Ele ganha o
 * prefixo do destino, lido no artigo que o introduz: "CF, art. 156-A", "ADCT, art. 125",
 * "LC 87/1996, art. 12". Sem destino reconhecível, fica "alteração, art. N" para o curador.
 *
 * Cada item traz as notas de alteração do Planalto quando o texto veio com manterNotas.
 */
export function artigos(texto) {
  const re = /(?:^|\n)\s*(["“]?)\s*Art\.\s*(\d+)\s*([º°o])?(-[A-Z])?\.?\s+/g;
  const marcas = [...texto.matchAll(re)];
  let destino = null;
  const lista = [];
  marcas.forEach((m, i) => {
    const ini = m.index + m[0].length;
    const fim = i + 1 < marcas.length ? marcas[i + 1].index : texto.length;
    const n = Number(m[2]);
    const citado = Boolean(m[1]);
    const bruto = texto.slice(ini, fim);
    const notas = [...bruto.matchAll(NOTA)].map((x) => x[0].replace(/\s+/g, " ").trim());
    const corpo = bruto
      .replace(NOTA, " ")
      .replace(/\s*\n\s*/g, " ")
      .replace(/\s+/g, " ")
      .replace(/["”]\s*\(NR\)\s*$/, "")
      .replace(/\s*\(NR\)\s*$/, "")
      .replace(/["”]\s*$/, "")
      .trim();
    const base = `art. ${n}${n < 10 ? "º" : ""}${m[4] ?? ""}`;
    if (!citado) destino = destinoDaAlteracao(corpo);
    const rotulo = citado ? `${destino ?? "alteração"}, ${base}` : base;
    if (corpo.length > 0) lista.push({ rotulo, texto: corpo, notas, citado, destino: citado ? destino : null, introducao: false });
  });
  // "A Constituição Federal passa a vigorar com as seguintes alterações:" só anuncia o que vem
  // entre aspas. Não serve de fonte; a ingestão pula.
  lista.forEach((a, i) => {
    a.introducao = !a.citado && Boolean(lista[i + 1]?.citado) && /:\s*$/.test(a.texto);
  });
  return lista;
}

/** O artigo de vigência da própria norma ("Esta Lei entra em vigor..."), para orientar o curador. */
export function artigoDeVigencia(lista) {
  return [...lista].reverse().find((a) => !a.citado && /entra(?:m)? em vigor/i.test(a.texto)) ?? null;
}

/**
 * Baixa uma página do Planalto, com nova tentativa em falha de rede. O Planalto às vezes
 * recusa clientes sem cara de navegador; o cabeçalho abaixo resolve na maioria das vezes.
 * Se continuar recusando, salve a página pelo navegador e use --arquivo / --pasta.
 */
export async function baixar(url, tentativas = 3) {
  let ultimo;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 advfin-ingestao/1.1",
          accept: "text/html,application/xhtml+xml",
        },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return decodificar(new Uint8Array(await r.arrayBuffer()), r.headers.get("content-type") ?? "");
    } catch (e) {
      ultimo = e;
      await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
    }
  }
  throw new Error(`não consegui baixar ${url}: ${ultimo?.message}`);
}
