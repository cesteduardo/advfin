import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Verificação em duas etapas por aplicativo (TOTP, RFC 6238: SHA-1, 6 dígitos, 30 segundos).
 * O segredo vai ao banco cifrado com AES-256-GCM pela chave CHAVE_CIFRA (32 bytes em base64),
 * que fica só no servidor da aplicação: um vazamento do banco sozinho não gera códigos.
 */
const PASSO = 30;
const DIGITOS = 6;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32(buf: Buffer): string {
  let bits = 0, valor = 0, s = "";
  for (const b of buf) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      s += B32[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) s += B32[(valor << (5 - bits)) & 31];
  return s;
}

export function deBase32(s: string): Buffer {
  const limpo = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, valor = 0;
  const out: number[] = [];
  for (const c of limpo) {
    valor = (valor << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function novoSegredo(): string {
  return base32(randomBytes(20));
}

export function passoAtual(agora = Date.now()): number {
  return Math.floor(agora / 1000 / PASSO);
}

export function codigoNoPasso(segredo: string, passo: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(passo));
  const mac = createHmac("sha1", deBase32(segredo)).update(msg).digest();
  const o = mac[mac.length - 1] & 15;
  const n = ((mac[o] & 127) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return String(n % 10 ** DIGITOS).padStart(DIGITOS, "0");
}

/**
 * Confere o código com uma janela de um passo para cada lado (relógio do celular adiantado
 * ou atrasado). Devolve o passo aceito, que o banco guarda para o mesmo código não valer duas vezes.
 */
export function conferirCodigo(segredo: string, codigo: string, ultimoPasso: number | null, agora = Date.now()): number | null {
  const digitado = codigo.replace(/\D/g, "");
  if (digitado.length !== DIGITOS) return null;
  const p = passoAtual(agora);
  for (const passo of [p - 1, p, p + 1]) {
    if (ultimoPasso !== null && passo <= ultimoPasso) continue;
    const esperado = codigoNoPasso(segredo, passo);
    if (timingSafeEqual(Buffer.from(esperado), Buffer.from(digitado))) return passo;
  }
  return null;
}

export function uriOtpauth(segredo: string, email: string): string {
  const rotulo = encodeURIComponent(`AdvFin:${email}`);
  return `otpauth://totp/${rotulo}?secret=${segredo}&issuer=AdvFin&algorithm=SHA1&digits=${DIGITOS}&period=${PASSO}`;
}

/** Dez códigos de recuperação no formato XXXX-XXXX; no banco vai só o sha256 de cada um. */
export function novosCodigosRecuperacao(): string[] {
  return Array.from({ length: 10 }, () => {
    const s = base32(randomBytes(5)).slice(0, 8);
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

export function hashCodigoRecuperacao(c: string): string {
  return createHash("sha256").update(c.toUpperCase().replace(/[^A-Z2-7]/g, "")).digest("hex");
}

function chave(): Buffer {
  const k = process.env.CHAVE_CIFRA;
  if (k) {
    const b = Buffer.from(k, "base64");
    if (b.length !== 32) throw new Error("CHAVE_CIFRA precisa ter 32 bytes em base64");
    return b;
  }
  if (process.env.NODE_ENV === "production") throw new Error("CHAVE_CIFRA ausente: a verificação em duas etapas precisa dela");
  // Só em desenvolvimento: chave fixa, para o 2FA funcionar sem configuração.
  return createHash("sha256").update("advfin-desenvolvimento").digest();
}

export function verificacaoDisponivel(): boolean {
  return Boolean(process.env.CHAVE_CIFRA) || process.env.NODE_ENV !== "production";
}

/** iv (12) + tag (16) + texto cifrado. */
export function cifrar(segredo: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const corpo = Buffer.concat([c.update(segredo, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), corpo]);
}

export function decifrar(dados: Buffer): string {
  const d = createDecipheriv("aes-256-gcm", chave(), dados.subarray(0, 12));
  d.setAuthTag(dados.subarray(12, 28));
  return Buffer.concat([d.update(dados.subarray(28)), d.final()]).toString("utf8");
}
