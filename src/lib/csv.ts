/**
 * CSV que abre direto no Excel em português: separador ";", BOM UTF-8, aspas quando preciso.
 * Objetos e listas viram JSON na célula.
 */
export function paraCsv(linhas: Record<string, unknown>[], colunas?: string[]): string {
  const cols = colunas ?? [...new Set(linhas.flatMap((l) => Object.keys(l)))];
  const celula = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
    // Fórmulas não executam ao abrir: célula que começa com = + - @ ganha um apóstrofo.
    const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
  };
  return "﻿" + [cols.join(";"), ...linhas.map((l) => cols.map((c) => celula(l[c])).join(";"))].join("\r\n") + "\r\n";
}
