# Teste público: o passo a passo

Cinco frentes antes de abrir o AdvFin ao público. O código das cinco está pronto; o que falta são as contas e os comandos que só podem rodar com as suas mãos (marcados **[Eduardo]**). Siga na ordem: cada passo depende do anterior.

| # | Frente | O que já está no código | O que falta |
|---|---|---|---|
| 1 | App no ar | Vercel em São Paulo, banco com isolamento por escritório | Criar as contas, colar o SQL, configurar as variáveis |
| 2 | Base normativa real | `scripts/carregar-base.mjs` lê do Planalto a Reforma e a legislação federal (CF, CTN, PIS/Cofins, IPI, IRPJ/CSLL, regulamentos, LCs 87, 116 e 123); Receita e São Paulo por páginas salvas; tudo na fila do curador | Rodar os comandos do seu computador; o curador revisar |
| 3 | Avaliação | 100 perguntas em `avaliacao/perguntas.json` e `npm run avaliar` | Rodar com a base real e a IA; o curador conferir os gabaritos |
| 4 | Termos e privacidade | `/termos`, `/privacidade`, aceite com versão no cadastro, aviso da OAB em toda resposta | Advogado revisar; preencher CNPJ e encarregado |
| 5 | Limites, erros, relatos | Cotas por pessoa e escritório, registro de erros, botão "Relatar citação errada", abas novas em `/admin` | Só configurar os limites, se quiser outros |

---

## 1. Pôr o app no ar

### 1.1 Supabase (banco, em São Paulo) **[Eduardo]**

1. Em [supabase.com](https://supabase.com), *New project*: nome `advfin`, região **South America (São Paulo)**. Guarde a senha do banco num gerenciador de senhas.
2. Abra *SQL Editor* → *New query* e rode esta conferência. As duas colunas precisam vir `true` (ou ao menos uma):
   ```sql
   select rolbypassrls, rolsuper from pg_roles where rolname = current_user;
   ```
3. Ainda no *SQL Editor*, cole e rode **um arquivo por vez, nesta ordem** (abra cada um no GitHub, botão *Raw*, copie tudo):
   1. `db/migrations/001_init.sql`
   2. `db/migrations/002_app.sql`
   3. `db/migrations/003_perfis.sql`
   4. `db/migrations/004_teste_publico.sql`
   5. `db/migrations/005_base_ampliada.sql` (normas estaduais e municipais, apelidos como "CTN")
   6. `db/seeds/semente_reforma.sql` (textos provisórios; saem sozinhos quando o texto oficial entra no passo 2)

   Cada um termina com `Success. No rows returned`. Se algum der erro, pare e me mande a mensagem.
4. Crie o login da aplicação (troque a senha por uma longa, gerada no gerenciador):
   ```sql
   create role advfin_web login password 'TROQUE-POR-UMA-SENHA-LONGA' in role app_user;
   ```
5. Em *Project Settings → Data API*, tire `public` e `app` dos *Exposed schemas*. O app fala com o banco só pelo servidor.
6. Em *Database → Extensions*, ligue `pg_cron` e agende o expurgo diário da LGPD (3h da manhã de Brasília):
   ```sql
   select cron.schedule('expurgo-diario', '0 6 * * *', $$ select app.expurgar(); select app.expurgar_registros(); $$);
   ```
7. Em *Connect* (botão no topo), copie duas *connection strings*:
   - **Transaction pooler** (porta 6543): troque o usuário `postgres.xxxx` por `advfin_web.xxxx` e a senha pela do item 4. Esta é a `DATABASE_URL` da Vercel.
   - **Session pooler** (porta 5432), com o usuário `postgres.xxxx` e a senha do banco. Esta é a `ADMIN_DATABASE_URL`, só para o seu computador (passo 2). Nunca vai para a Vercel.

### 1.2 Anthropic (a IA) **[Eduardo]**

1. Em [console.anthropic.com](https://console.anthropic.com), crie a conta e cadastre o cartão.
2. *Settings → Limits*: defina um teto mensal (sugestão para o teste: US$ 50). É a segunda trava de custo, além dos limites do app.
3. *API Keys → Create Key*, nome `advfin-producao`. Copie a chave **direto para a Vercel** (item 1.3). Não cole em chat, e-mail ou documento.

Os termos comerciais da API não usam os dados enviados para treinar modelos; isso está dito na Política de Privacidade.

### 1.3 Vercel (a aplicação) **[Eduardo]**

1. Em [vercel.com](https://vercel.com), entre com o GitHub, *Add New → Project*, importe `cesteduardo/advfin`. O `vercel.json` já fixa a região São Paulo (`gru1`).
2. *Settings → Environment Variables*, ambiente *Production*:

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | Transaction pooler com `advfin_web` (1.1, item 7) |
   | `LLM_PROVEDOR` | `anthropic` |
   | `LLM_CHAVE` | a chave da Anthropic (marque *Sensitive*) |
   | | Para testar sem custo, use `LLM_PROVEDOR` = `groq` e a chave grátis do Groq (`gsk_…`, em console.groq.com/keys) |
   | `BASE_INCLUIR_NAO_REVISADOS` | `1` enquanto o curador não publicar a base; depois, apague |
   | `APP_URL` | o endereço do app, ex.: `https://app.advfin.com.br` |
   | `CHAVE_CIFRA` | 32 bytes aleatórios em base64. No Terminal do Mac: `openssl rand -base64 32` |
   | `LIMITE_CONSULTAS_DIA` | opcional, padrão `30` por pessoa |
   | `LIMITE_CONSULTAS_MES` | opcional, padrão `300` por pessoa |
   | `LIMITE_CONSULTAS_ESCRITORIO` | opcional, padrão `1500` por escritório no mês |
   | `LIMITE_CONSULTAS_MINUTO` | opcional, padrão `6` por pessoa |
   | `NEXT_PUBLIC_CONTROLADOR_CNPJ` | CNPJ da GR Brands, aparece na Política de Privacidade |
   | `NEXT_PUBLIC_ENCARREGADO_NOME` | nome do encarregado (DPO); sem ele, a política mostra só o e-mail |
   | `LLM_PRECO_ENTRADA`, `LLM_PRECO_SAIDA` | opcional: R$ por milhão de tokens, para medir o custo por consulta |

3. *Deployments → Redeploy*. Abra o endereço, entre em `/cadastro`, crie a **sua** conta e faça uma pergunta em `/app/pesquisa`.
4. Faça-se administrador da plataforma (uma vez, no *SQL Editor* do Supabase):
   ```sql
   insert into equipe_plataforma (usuario_id, papel)
   select id, 'admin' from usuarios where email = 'SEU-EMAIL';
   ```
   A aba **Plataforma** aparece no menu. O curador entra pela aba *Equipe* depois que criar a conta dele.
5. Domínio: *Settings → Domains*, adicione `app.advfin.com.br` e crie o CNAME que a Vercel indicar no seu DNS.

**Conferência do passo 1:** cadastro funciona, a pesquisa responde com o selo "Texto provisório", `/termos` e `/privacidade` abrem, e `/admin` mostra as abas Curadoria, Relatos, Escritórios, Limites, Erros.

---

## 2. Base normativa real **[Eduardo, no seu computador]**

O servidor de testes não alcança os sites do governo, então o carregamento sai do seu Mac. Precisa do Node 22 (o mesmo do `npm run pages`). Um só carregador, por grupos; o catálogo completo está em `scripts/catalogo-normas.mjs`.

```bash
cd advfin && git pull && npm install
export ADMIN_DATABASE_URL="cole-a-session-pooler-aqui"
node scripts/carregar-base.mjs --grupo reforma --simular   # só lê e mostra; não grava nada
node scripts/carregar-base.mjs --grupo reforma             # EC 132/2023 e LC 214/2025
node scripts/carregar-base.mjs --grupo federal             # o restante da legislação federal
```

| Grupo | O que entra | De onde vem |
|---|---|---|
| `reforma` | EC 132/2023, LC 214/2025 | Planalto, automático |
| `federal` | CF (arts. 145 a 162), CTN, PAF (Dec. 70.235), LEF, Leis 9.718, 10.637, 10.833 e 10.865 (PIS/Cofins), Lei 4.502 e RIPI (IPI), Leis 7.689, 9.249 e 9.430 e RIR/2018 (IRPJ/CSLL), LCs 87, 116 e 123 | Planalto, automático |
| `receita` | INs RFB 2.121/2022 (PIS/Cofins), 1.700/2017 (IRPJ/CSLL), 2.055/2021 (restituição e compensação) | Sijut, página salva |
| `sp` | Lei 6.374/1989 e RICMS/2000 (ICMS paulista); Lei 13.701/2003 e regulamento do ISS da capital | Portais da Sefaz-SP e da Prefeitura, página salva |
| `solucoes` | Soluções de consulta da Receita, pela ementa | Sijut, uma página salva por solução |

O que acontece em cada norma:

- separa por artigo (aceita "Art." e "Artigo") e, na CF, guarda só o Sistema Tributário Nacional;
- dá o rótulo certo ao que uma norma insere em outra: `CF, art. 156-A`, `ADCT, art. 125`, `LC 87/1996, art. 12`;
- grava tudo como **em revisão**, com a vigência provisória na data de publicação e uma nota para o curador;
- aposenta as linhas da semente provisória cobertas pelo texto oficial;
- pode rodar de novo quando a fonte atualizar: o que não mudou é ignorado, e redação nova vira versão nova na fila;
- se uma norma falhar, diz qual e por quê e segue com as outras.

**Páginas salvas.** A Receita e os portais de São Paulo não têm endereço fixo por ato, então o carregador pede o arquivo. Abra o ato no portal, *Arquivo → Salvar como → Página HTML*, com o nome que o carregador indica (o `--simular` lista todos), ponha numa pasta e rode com `--pasta`:

```bash
node scripts/carregar-base.mjs --grupo receita --pasta ~/Downloads/receita
node scripts/carregar-base.mjs --grupo sp --pasta ~/Downloads/sp
node scripts/carregar-base.mjs --grupo solucoes --pasta ~/Downloads/solucoes   # sc-cosit-99-2023.html, sc-disit08-12-2024.html…
```

O mesmo `--pasta` serve para o Planalto, se ele recusar o download: salve a página com o nome do catálogo (ex.: `emc132.htm`, `l5172compilado.htm`).

**Curadoria.** O curador entra em `/admin → Curadoria`, confere cada artigo com a fonte, ajusta a vigência quando a norma der efeitos em datas diferentes e clica *Aprovar e publicar*. A ordem sugerida é a da pesquisa: Reforma, depois CF e CTN, depois o resto. Quando a base estiver publicada, apague `BASE_INCLUIR_NAO_REVISADOS` na Vercel: a partir daí só o conferido chega ao advogado.

---

## 3. Avaliação: precisão de citação ≥ 98%

O banco tem **100 perguntas** em `avaliacao/perguntas.json`: 33 de transição, 19 de regimes diferenciados, 20 da LC 214, 9 de instituição e competência, 3 de vigência e 16 fora do escopo (o produto precisa se abster). O script roda cada uma pelo mesmo caminho do app e mede a precisão de citação.

```bash
npm run avaliar                                                     # base embutida, sem IA
AVALIAR_BASE=banco DATABASE_URL="..." npm run avaliar               # base real, sem IA
AVALIAR_BASE=banco AVALIAR_LLM=anthropic DATABASE_URL="..." LLM_CHAVE="..." npm run avaliar   # produto completo
```

O relatório sai em `avaliacao/resultados/`. A linha de base de hoje (`linha-de-base-2026-11-27-local-extrativo.md`, só com a semente de 9 artigos e sem IA) deu **50,9%**: a semente não cobre a LC 214, e o modo sem IA cita o que a busca acha. A meta de 98% vale para o produto completo, com a base oficial carregada e a IA ligada. Cada rodada completa com a IA custa poucos reais.

Duas tarefas do curador: conferir os gabaritos (marcar `gabarito_conferido: true`) e fixar os artigos das perguntas da LC 214, que hoje são julgadas por termo.

---

## 4. Termos, privacidade e avisos

- `/termos` e `/privacidade` são páginas próprias da plataforma, separadas dos textos da landing (que tratam só da lista de espera).
- O cadastro registra a versão aceita (`aceites_termos`). Mudou o texto de forma relevante? Troque `VERSAO_TERMOS` em `src/lib/legal/versao.ts`.
- Toda resposta e todo rodapé do app dizem que é ferramenta para advogados e não substitui parecer; o parecer exportado declara o apoio de IA e a responsabilidade do signatário.
- A política diz com clareza que a pergunta vai à Anthropic, nos Estados Unidos (transferência internacional, art. 33 da LGPD), e pede que o advogado não identifique o cliente na pergunta.

**Antes de abrir [Eduardo + advogado]:** um advogado revisa os dois textos; preencha CNPJ e encarregado nas variáveis da Vercel. Pontos para a revisão: o Marco Civil (art. 15) pede guarda de registros de acesso por 6 meses, e o app ainda não guarda IP; e o foro de eleição.

---

## 5. Limites, erros e relatos

- **Limites:** por pessoa (minuto, dia e mês) e por escritório (mês), com a cota virando à meia-noite de Brasília. Consultas que deram erro não contam. Exceções por escritório em `/admin → Limites` (ex.: programa fundador).
- **Erros:** todo erro do servidor e toda falha da IA vão para `/admin → Erros`, com rota e mensagem técnica, nunca com a pergunta. Apagados em 90 dias.
- **Relatos:** cada fonte citada tem *Relatar citação errada*. O relato chega em `/admin → Relatos` com o dispositivo, o trecho e o motivo, sem a pergunta. *Procedente* com "tirar da pesquisa" devolve o dispositivo à curadoria.

---

## Checklist final, antes de liberar

- [ ] Passo 1 conferido: cadastro, pesquisa, termos e `/admin` funcionando no domínio
- [ ] Texto oficial carregado (passo 2) e publicado pelo curador
- [ ] `BASE_INCLUIR_NAO_REVISADOS` apagada da Vercel
- [ ] Avaliação completa com IA ≥ 98% de precisão de citação
- [ ] Termos e política revisados por advogado; CNPJ e encarregado preenchidos
- [ ] Teto de gasto definido na Anthropic
- [ ] Link "Entrar" da landing apontando para o domínio do app
