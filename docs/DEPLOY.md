# Pôr o app no ar: Vercel + Supabase, em São Paulo

Decisão de 26/11/2026: aplicação na Vercel (região `gru1`, São Paulo), banco no Supabase (região São Paulo), modelo de linguagem via API da Anthropic. A landing continua no GitHub Pages; o app vive num endereço próprio (ex.: `app.advfin.com.br`).

O que só o Eduardo pode fazer está marcado com **[Eduardo]**. O resto é comando.

> Para o teste público, siga o roteiro mais completo em [TESTE-PUBLICO.md](TESTE-PUBLICO.md), que inclui a migração 004, a carga do texto oficial, a avaliação, os termos e os limites.

## 1. Banco no Supabase

1. **[Eduardo]** Criar o projeto em supabase.com, região **South America (São Paulo)**. Guardar a senha do banco.
2. Confirmar que o papel `postgres` ignora RLS (as funções de cadastro e login dependem disso):
   ```sql
   select rolbypassrls, rolsuper from pg_roles where rolname = current_user;
   ```
   Se as duas colunas vierem `false`, pare e avise: as migrações precisam de outro dono.
3. Aplicar o esquema e a semente (no *SQL Editor* ou com `psql` usando a *connection string* direta):
   ```bash
   psql "$ADMIN_URL" -f db/migrations/001_init.sql
   psql "$ADMIN_URL" -f db/migrations/002_app.sql
   psql "$ADMIN_URL" -f db/migrations/003_perfis.sql   # níveis, convites, 2FA, cobrança, plataforma
   psql "$ADMIN_URL" -f db/migrations/004_teste_publico.sql   # aceite, limites, erros, relatos de citação
   psql "$ADMIN_URL" -f db/migrations/005_base_ampliada.sql   # normas por esfera e ente, apelidos
   psql "$ADMIN_URL" -f db/seeds/semente_reforma.sql   # textos provisórios, marcados como não conferidos
   ```
4. Criar o login da aplicação, que herda `app_user` e por isso fica preso ao RLS:
   ```sql
   create role advfin_web login password 'SENHA-FORTE' in role app_user;
   ```
5. `DATABASE_URL` da aplicação: a string do *Transaction pooler* (porta 6543), trocando o usuário por `advfin_web.<ref-do-projeto>` e a senha pela do passo 4.

Não exponha a API REST do Supabase para essas tabelas: o app fala com o banco só pelo servidor. Em *Settings → API*, retire `public` e `app` dos *exposed schemas*.

## 2. Chave da Anthropic

1. **[Eduardo]** Criar a conta em console.anthropic.com, cadastrar o cartão e gerar uma chave de API.
2. Conferir nos termos comerciais que os dados enviados pela API não são usados para treinar modelos (é o padrão dos termos comerciais da Anthropic; vale registrar no contrato de operador da LGPD).

Sem a chave, o app já funciona: a pesquisa responde no modo extrativo, só com trechos literais.

## 3. Aplicação na Vercel

1. **[Eduardo]** Em vercel.com, *Add New → Project*, importar `cesteduardo/advfin`. O `vercel.json` já fixa a região `gru1`.
2. Variáveis de ambiente (*Settings → Environment Variables*):

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | do passo 1.5 |
   | `LLM_PROVEDOR` | `anthropic` |
   | `LLM_CHAVE` | do passo 2 |
   | `BASE_INCLUIR_NAO_REVISADOS` | `1` durante o beta sem curador; remover quando a base estiver conferida |
   | `APP_URL` | o endereço público do app (ex.: `https://app.advfin.com.br`), para os links dos e-mails |
   | `CHAVE_CIFRA` | 32 bytes em base64 que cifram os segredos do 2FA: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Trocar a chave desliga o 2FA de todos |
   | `EMAIL_PROVEDOR`, `EMAIL_CHAVE`, `EMAIL_REMETENTE` | opcional: `resend` e a chave do Resend. Sem eles, convites mostram o link para copiar, e a troca de e-mail fica indisponível |
   | `STRIPE_CHAVE`, `STRIPE_WEBHOOK_SEGREDO`, `STRIPE_PRECO_ESSENCIAL`, `STRIPE_PRECO_ESCRITORIO`, `STRIPE_PRECO_TRIBUTARIO_PRO` | opcional: cobrança por pessoa (seção 6). Sem eles, não há limite de assentos |

3. *Deploy*. Testar: `/cadastro`, criar conta, `/app/pesquisa`.
4. **[Eduardo]** Domínio: em *Settings → Domains*, adicionar `app.advfin.com.br` (ou outro) e criar o CNAME indicado no seu provedor de DNS.

## 4. Carregar o texto oficial

Do seu computador (o servidor de testes não alcança o Planalto), as duas normas da Reforma de uma vez:

```bash
ADMIN_DATABASE_URL="$ADMIN_URL" node scripts/carregar-base.mjs --grupo reforma   # depois: federal, receita, sp, solucoes; --simular só lê; --pasta usa páginas salvas
```

Os artigos entram como `em_revisao`, com nota para o curador, e a semente coberta sai da pesquisa sozinha. Os artigos que a EC 132 insere na Constituição e no ADCT já chegam rotulados (`CF, art. 156-A`, `ADCT, art. 125`). Para outra norma, `scripts/ingerir-planalto.mjs` com `--tipo --numero --ano --publicada --ementa --url`.

## 5. Equipe da plataforma e expurgo

1. O laboratório do chat (`/app/dev`) e a área `/admin` abrem pelo papel na tabela `equipe_plataforma`, não mais por `DEV_EMAILS`. Depois de criar a sua conta no app, entre como admin da plataforma (uma vez, no SQL Editor):
   ```sql
   insert into equipe_plataforma (usuario_id, papel)
   select id, 'admin' from usuarios where email = 'SEU-EMAIL';
   ```
   Os próximos (curador, suporte) entram pela aba Equipe em `/admin`.
2. Agendar o expurgo diário (LGPD), que precisa do dono das tabelas: `ADMIN_DATABASE_URL="$ADMIN_URL" node scripts/expurgo.mjs`. No Supabase, dá para usar o `pg_cron` com `select app.expurgar();` uma vez por dia.

## 6. Cobrança no Stripe (quando a conta existir)

1. **[Eduardo]** Criar a conta no Stripe e, em *Products*, um produto por plano com preço recorrente mensal **por unidade** (cada unidade é uma pessoa). Os IDs `price_...` vão para `STRIPE_PRECO_*`.
2. Em *Developers → Webhooks*, endpoint `https://SEU-APP/api/stripe/webhook` com os eventos `customer.subscription.created`, `customer.subscription.updated` e `customer.subscription.deleted`. O segredo `whsec_...` vai para `STRIPE_WEBHOOK_SEGREDO`.
3. Em *Settings → Billing → Customer portal*, ligar troca de plano, de cartão e cancelamento.
4. A NFS-e não sai pelo Stripe: falta escolher um emissor brasileiro.

## 7. Depois do primeiro deploy

- Link "Entrar" na landing apontando para o domínio do app.
- Monitorar `consultas.custo_microreais` (com `LLM_PRECO_*` configurados) contra a meta de inferência abaixo de 25% da receita por usuário.
