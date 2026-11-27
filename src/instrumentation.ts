import type { Instrumentation } from "next";

/** Todo erro que o Next captura no servidor vai para registro_erros (lido em /admin, aba Erros). */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registrarErro } = await import("./lib/registro-erros");
  await registrarErro("servidor", err, {
    rota: request.path,
    detalhes: { metodo: request.method, tipo: context.routeType, rotaArquivo: context.routePath },
  });
};
