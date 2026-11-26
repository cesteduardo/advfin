import type { NextConfig } from "next";

/**
 * GITHUB_PAGES=1 gera a versão estática (pasta out/) servida em /advfin.
 * Sem a variável, roda como servidor Next completo (API, banco, cabeçalhos de segurança).
 */
const pages = process.env.GITHUB_PAGES === "1";
const base = pages ? (process.env.BASE_PATH ?? "/advfin") : "";

const seguranca = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const config: NextConfig = {
  poweredByHeader: false,
  ...(pages
    ? { output: "export", basePath: base, images: { unoptimized: true }, trailingSlash: true, env: { NEXT_PUBLIC_ESTATICO: "1" } }
    : {
        async headers() {
          return [{ source: "/:path*", headers: seguranca }];
        },
      }),
};

export default config;
