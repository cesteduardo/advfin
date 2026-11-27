import type { NextConfig } from "next";

/**
 * Três formas de gerar o site:
 *  - padrão:          servidor Next completo (API, banco, cabeçalhos de segurança);
 *  - ESTATICO=1:      site estático na pasta out/, para qualquer hospedagem na raiz do domínio;
 *  - GITHUB_PAGES=1:  site estático servido em /advfin (cesteduardo.github.io/advfin).
 * BASE_PATH sobrescreve o caminho (ex.: BASE_PATH=/lp para um subdiretório).
 */
const pages = process.env.GITHUB_PAGES === "1";
const estatico = pages || process.env.ESTATICO === "1";
const base = process.env.BASE_PATH ?? (pages ? "/advfin" : "");

const seguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const config: NextConfig = {
  poweredByHeader: false,
  ...(estatico
    ? { output: "export", basePath: base, images: { unoptimized: true }, trailingSlash: true, env: { NEXT_PUBLIC_ESTATICO: "1", NEXT_PUBLIC_BASE_PATH: base } }
    : {
        env: { NEXT_PUBLIC_BASE_PATH: base },
        async headers() {
          return [{ source: "/:path*", headers: seguranca }];
        },
      }),
};

export default config;
