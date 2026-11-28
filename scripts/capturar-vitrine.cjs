/**
 * Telas da vitrine da landing (herói): capturas do próprio app de demonstração, no tamanho exato
 * de cada moldura do GR Frames. Assim a landing mostra o sistema como ele é hoje.
 *
 * Uso: gere o site estático (GITHUB_PAGES=1), sirva a pasta pai de out/ como /advfin e rode
 *   node scripts/capturar-vitrine.cjs http://localhost:8106/advfin
 * Saída: public/vitrine/{mac,duo,iphone}.jpg
 *
 * Dados fictícios. A resposta do chat é montada por um modelo simulado que cita os trechos
 * literais da base (o verificador do app confere as citações como em produção).
 */
const { chromium } = require("playwright");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");

const base = (process.argv[2] ?? "http://localhost:8106/advfin").replace(/\/$/, "");
const saida = join(__dirname, "..", "public", "vitrine");
mkdirSync(saida, { recursive: true });

const PERGUNTA = "Em 2026, a CBS e o IBS destacados na nota são devidos ou compensados com o PIS e a Cofins?";
const CASO = "Clínica Aurora Ltda.";
const NOTAS = [
  "Pedi ao cliente as notas fiscais de serviço de março, já com o destaque da CBS.",
  "Conferido: em 2026 o valor recolhido compensa PIS/Cofins. Falta revisar o contrato de locação.",
];

const sleep = (p, ms) => p.waitForTimeout(ms);

/** Modelo simulado: responde citando o trecho literal dos dispositivos que recebeu. */
async function modeloSimulado(ctx) {
  await ctx.route("https://openrouter.ai/api/v1/**", async (route) => {
    const cabecalhos = { "access-control-allow-origin": "*" };
    const u = route.request().url();
    if (!u.endsWith("/chat/completions")) return route.fulfill({ status: 200, contentType: "application/json", headers: cabecalhos, body: '{"data":{}}' });
    const corpo = JSON.parse(route.request().postData());
    const msg = corpo.messages[1].content;
    const disp = [...msg.matchAll(/<dispositivo ref="(D\d+)"[^>]*>\n([\s\S]*?)\n<\/dispositivo>/g)].map((m) => ({ ref: m[1], texto: m[2] }));
    const achar = (re) => disp.find((d) => re.test(d.texto));
    const aliq = achar(/0,1% \(um décimo/);
    const comp = achar(/será compensado/);
    let conteudo;
    if (aliq && !comp) {
      conteudo = {
        paragrafos: [`Sim, mas em 2026 o recolhimento é simbólico: a CBS é cobrada a 0,9% e o IBS a 0,1% [${aliq.ref}].`],
        citacoes: [{ ref: aliq.ref, trecho: aliq.texto.split(", e a contribuição")[0] }],
        semBase: false,
      };
    } else if (aliq && comp) {
      conteudo = {
        paragrafos: [
          `Sim, mas em 2026 o recolhimento é simbólico: a CBS é cobrada a 0,9% e o IBS a 0,1% [${aliq.ref}].`,
          `O valor recolhido é compensado com o PIS e a Cofins devidos, então o ano funciona como teste da apuração [${comp.ref}].`,
        ],
        citacoes: [
          { ref: aliq.ref, trecho: aliq.texto.split(", e a contribuição")[0] },
          { ref: comp.ref, trecho: comp.texto.split(" com o valor devido")[0] },
        ],
        semBase: false,
      };
    } else conteudo = { paragrafos: ["Boa tarde! Em que posso ajudar?"] };
    route.fulfill({ status: 200, contentType: "application/json", headers: cabecalhos, body: JSON.stringify({ model: corpo.model, choices: [{ message: { content: JSON.stringify(conteudo) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) });
  });
}

/** Esconde o que é só da demonstração (faixa, chave, seletor de quem responde). */
const LIMPAR = `
  .demo-faixa, .lab-config, .demo-ia-desligada, .demo-origem { display: none !important; }
  .app-data:has(.app-data-rotulo + .seletor), .app-data:has([aria-label^="Quem redige"]) { display: none !important; }
  *, *::before, *::after { caret-color: transparent !important; }
`;

async function preparar(ctx) {
  await modeloSimulado(ctx);
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("advfin-lab-chave-openrouter", "sk-or-v1-demonstracao");
      localStorage.setItem("advfin-demo-resposta", "openrouter");
      localStorage.setItem("advfin-tema", "claro");
    } catch {}
  });
}

async function entrar(p) {
  await p.goto(base + "/app/", { waitUntil: "networkidle" });
  if (await p.$("#d-nome")) {
    await p.fill("#d-nome", "Marina Duarte");
    await p.fill("#d-escritorio", "Duarte & Lemos Advocacia");
    await p.$eval(".demo-cadastro form", (f) => f.requestSubmit());
    await sleep(p, 800);
  }
}

async function criarCasoComConversa(p) {
  await p.goto(base + "/app/casos/", { waitUntil: "networkidle" });
  await sleep(p, 500);
  for (const t of ["Transportes Vale S.A.", "Grupo Horizonte", CASO]) {
    await p.fill("input[name=titulo]", t);
    await p.$eval("input[name=titulo]", (i) => i.form.requestSubmit());
    await sleep(p, 500);
    if (t !== CASO) {
      await p.goto(base + "/app/casos/", { waitUntil: "networkidle" });
      await sleep(p, 400);
    }
  }
  for (const n of NOTAS) {
    await p.fill("#nota", n);
    await p.click(".caso-nota-nova .mesa-botao");
    await sleep(p, 350);
  }
  await p.fill("#caso-q", PERGUNTA);
  await p.keyboard.press("Enter");
  await p.waitForURL(/pesquisa/);
  await p.waitForSelector(".pesquisa-resposta", { timeout: 15000 });
  await sleep(p, 4000);
}

(async () => {
  const b = await chromium.launch();
  const comum = { colorScheme: "light", reducedMotion: "reduce", locale: "pt-BR", timezoneId: "America/Sao_Paulo" };

  // Mac: a pesquisa em conversa, com o campo fixo embaixo.
  {
    const ctx = await b.newContext({ ...comum, viewport: { width: 1512, height: 893 }, deviceScaleFactor: 1 });
    await preparar(ctx);
    const p = await ctx.newPage();
    await entrar(p);
    await criarCasoComConversa(p);
    await p.addStyleTag({ content: LIMPAR });
    await sleep(p, 300);
    await p.screenshot({ path: join(saida, "mac.jpg"), type: "jpeg", quality: 88 });
    await ctx.close();
  }

  // iPhone: o caso, com a barra de pergunta, a conversa guardada e as notas da equipe.
  {
    const ctx = await b.newContext({ ...comum, viewport: { width: 402, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await preparar(ctx);
    const p = await ctx.newPage();
    await entrar(p);
    await criarCasoComConversa(p);
    await p.goto(base + "/app/casos/", { waitUntil: "networkidle" });
    await sleep(p, 500);
    await p.click(`text=${CASO}`);
    await sleep(p, 700);
    await p.addStyleTag({ content: LIMPAR });
    await sleep(p, 300);
    await p.screenshot({ path: join(saida, "iphone.jpg"), type: "jpeg", quality: 86 });
    await ctx.close();
  }

  // iPhone Duo: a calculadora da transição, com a dock das seções.
  {
    const ctx = await b.newContext({ ...comum, viewport: { width: 380, height: 682 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await preparar(ctx);
    const p = await ctx.newPage();
    await entrar(p);
    await p.goto(base + "/app/calculo/", { waitUntil: "networkidle" });
    await sleep(p, 900);
    // O resultado (valor do ano e gráfico) é a parte que conta: rola até ele.
    await p.evaluate(() => {
      const g = document.querySelector(".mesa-grafico");
      if (g) window.scrollTo(0, g.getBoundingClientRect().top + scrollY - 76);
    });
    await sleep(p, 500);
    await p.addStyleTag({ content: LIMPAR });
    await sleep(p, 300);
    await p.screenshot({ path: join(saida, "duo.jpg"), type: "jpeg", quality: 86 });
    await ctx.close();
  }

  await b.close();
  console.log("Vitrine: mac.jpg, iphone.jpg e duo.jpg em public/vitrine/");
})();
