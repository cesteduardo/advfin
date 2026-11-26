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

const ENTIDADES = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ordm: "º", ordf: "ª", sect: "§", ndash: "–", mdash: "—", laquo: "«", raquo: "»" };

const DIACRITICOS = { acute: "\u0301", grave: "\u0300", circ: "\u0302", tilde: "\u0303", cedil: "\u0327", uml: "\u0308" };

export function textoLimpo(html) {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(strike|s|del)\b[\s\S]*?<\/\1>/gi, " ") // redação revogada
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-zA-Z])(acute|grave|circ|tilde|cedil|uml);/g, (_, l, d) => (l + DIACRITICOS[d]).normalize("NFC"))
    .replace(/&(\w+);/g, (m, n) => ENTIDADES[n.toLowerCase()] ?? m)
    .replace(/\((?:Reda[cç][aã]o dada|Inclu[ií]d[oa]|Revogad[oa]|Vide|Regulamento|Vig[eê]ncia)[^)]*\)/gi, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

/**
 * Quebra em artigos. Cada artigo leva seus parágrafos, incisos e alíneas até o
 * próximo "Art. N". Rótulo: "art. 125", "art. 9º", "art. 156-A".
 */
export function artigos(texto) {
  const re = /(?:^|\n)\s*["“]?Art\.\s*(\d+)\s*([º°o])?(-[A-Z])?\.?\s+/g;
  const marcas = [...texto.matchAll(re)];
  return marcas
    .map((m, i) => {
      const ini = m.index + m[0].length;
      const fim = i + 1 < marcas.length ? marcas[i + 1].index : texto.length;
      const n = Number(m[1]);
      const rotulo = `art. ${n}${n < 10 ? "º" : ""}${m[3] ?? ""}`;
      const corpo = texto
        .slice(ini, fim)
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s+/g, " ")
        .replace(/["”]\s*\(NR\)\s*$/, "")
        .trim();
      return { rotulo, texto: corpo };
    })
    .filter((a) => a.texto.length > 0);
}
