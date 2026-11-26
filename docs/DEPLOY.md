# Pôr o app no ar: Vercel + Supabase, em São Paulo

Decisão de 26/11/2026: aplicação na Vercel (região `gru1`, São Paulo), banco no Supabase (região São Paulo), modelo de linguagem via API da Anthropic. A landing continua no GitHub Pages; o app vive num endereço próprio (ex.: `app.advfin.com.br`).

O que só o Eduardo pode fazer está marcado com **[Eduardo]**. O resto é comando.

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

3. *Deploy*. Testar: `/cadastro`, criar conta, `/app/pesquisa`.
4. **[Eduardo]** Domínio: em *Settings → Domains*, adicionar `app.advfin.com.br` (ou outro) e criar o CNAME indicado no seu provedor de DNS.

## 4. Carregar o texto oficial

Do seu computador (o servidor de testes não alcança o Planalto):

```bash
ADMIN_DATABASE_URL="$ADMIN_URL" node scripts/ingerir-planalto.mjs \
  --tipo LC --numero 214 --ano 2025 --publicada 2025-01-16 \
  --ementa "Institui o IBS, a CBS e o Imposto Seletivo" \
  --url https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm
```

Os artigos entram como `rascunho`. O curador revisa rótulo, texto e vigência, e muda para `publicado`. Quando o texto oficial de um dispositivo for publicado, remova a linha correspondente da semente (`origem = 'semente'`).

Atenção na EC 132/2023: os artigos do ADCT aparecem dentro do art. 2º da emenda. O script os separa pelo número, mas o rótulo precisa de ajuste do curador (ex.: `art. 125` → `ADCT, art. 125, caput`).

## 5. Depois do primeiro deploy

- Link "Entrar" na landing apontando para o domínio do app.
- Monitorar `consultas.custo_microreais` (com `LLM_PRECO_*` configurados) contra a meta de inferência abaixo de 25% da receita por usuário.
