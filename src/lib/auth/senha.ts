import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** scrypt com sal aleatório. Formato: scrypt$N$r$p$sal$hash (base64url). */
const N = 16384, R = 8, P = 1, TAMANHO = 32;

function derivar(senha: string, sal: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((ok, falha) =>
    scrypt(senha.normalize("NFKC"), sal, TAMANHO, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? falha(e) : ok(k))),
  );
}

export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const k = await derivar(senha, sal);
  return ["scrypt", N, R, P, sal.toString("base64url"), k.toString("base64url")].join("$");
}

export async function conferirSenha(senha: string, guardado: string | null | undefined): Promise<boolean> {
  if (!guardado) {
    // Gasta o mesmo tempo quando o usuário não existe, para não revelar quais e-mails têm conta.
    await derivar(senha, Buffer.alloc(16));
    return false;
  }
  const [alg, n, r, p, sal, hash] = guardado.split("$");
  if (alg !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64url");
  const k = await derivar(senha, Buffer.from(sal, "base64url"), Number(n), Number(r), Number(p));
  return k.length === esperado.length && timingSafeEqual(k, esperado);
}

export function novoToken(): string {
  return randomBytes(32).toString("base64url");
}

/** No banco vai só o sha256 do token: um vazamento da tabela não abre sessões. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Regras mínimas, ditas em linguagem clara na tela de cadastro. */
export function senhaFraca(senha: string): string | null {
  if (senha.length < 10) return "Use ao menos 10 caracteres.";
  if (senha.length > 200) return "Senha longa demais.";
  if (/^(.)\1+$/.test(senha)) return "Evite repetir o mesmo caractere.";
  return null;
}
