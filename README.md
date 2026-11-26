# AdvFin

A IA do tributarista brasileiro: pesquisa, cálculo e redação com fonte verificável, começando pela Reforma Tributária (EC 132/2023 e LC 214/2025).

Este repositório contém a landing com calculadora IBS/CBS gratuita e o app do advogado: login por escritório, pesquisa fundamentada com verificador de citações, cálculo da transição (linha do tempo, comparador de regimes, apuração com créditos) e classificação NCM/NBS, tudo sobre um motor determinístico e uma base normativa versionada com isolamento por escritório. A arquitetura completa está em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Rodar localmente

Requisitos: Node 22+ e PostgreSQL 16 (com pgvector em produção).

```bash
npm install
npm run dev            # http://localhost:3000 (landing)
npm test               # motor, verificador de citações, leitura do Planalto
```

### App do advogado (/entrar, /app)

Precisa de PostgreSQL. Com um superusuário em `ADMIN_URL`:

```bash
psql "$ADMIN_URL" -f db/migrations/001_init.sql
psql "$ADMIN_URL" -f db/migrations/002_app.sql
psql "$ADMIN_URL" -f db/seeds/semente_reforma.sql
psql "$ADMIN_URL" -c "create role advfin_web login password 'dev' in role app_user"
cp .env.example .env.local   # ajuste DATABASE_URL; LLM_CHAVE é opcional
npm run dev                  # http://localhost:3000/cadastro
```

Sem `LLM_CHAVE`, a pesquisa roda no modo extrativo: devolve os dispositivos mais relevantes, literalmente, pelo mesmo verificador. Deploy: [docs/DEPLOY.md](docs/DEPLOY.md).

Sem `DATABASE_URL`, a lista de espera grava em `data/lista-espera.jsonl` (só em desenvolvimento).

### Testes de isolamento (RLS)

Precisam de um PostgreSQL acessível como superusuário; o teste cria e apaga um banco descartável.

```bash
TEST_DATABASE_ADMIN_URL=postgres://postgres@localhost:5432/postgres npm run test:db
```

## Landing no GitHub Pages

A landing também roda como site estático, com a calculadora inteira no navegador:
`https://cesteduardo.github.io/advfin/`.

- **Publicar:** `npm run pages` gera a versão estática e envia para o branch `gh-pages`.
  Em *Settings → Pages*, a fonte deve ser *Deploy from a branch → gh-pages / (root)*.
- **Automático:** o workflow `.github/workflows/pages.yml` faz o mesmo a cada push na `main`
  (fonte *GitHub Actions*), quando o GitHub Actions estiver disponível na conta.
- **Lista de espera:** o site estático não tem servidor. Defina a variável de repositório
  `LISTA_ESPERA_URL` (por exemplo, um endpoint Formspree) ou exporte-a antes de `npm run pages`
  como `NEXT_PUBLIC_LISTA_ESPERA_URL`. Sem ela, o formulário avisa que as inscrições ainda não estão abertas.

## Deploy da aplicação

1. **Banco:** PostgreSQL 16 gerenciado em região brasileira (AWS RDS `sa-east-1` ou Cloud SQL `southamerica-east1`), com a extensão `vector` habilitada e criptografia em repouso.
2. **Migração:** `psql "$ADMIN_URL" -f db/migrations/001_init.sql`.
3. **Usuário da aplicação:** crie um login que herde `app_user` e use-o em `DATABASE_URL`. Nunca conecte a aplicação com o dono das tabelas, senão o RLS deixa de valer.
   ```sql
   create role advfin_web login password '...' in role app_user;
   ```
4. **Aplicação:** `npm run build && npm start`, em contêiner na mesma região (ECS/Fargate, Cloud Run ou similar). Variáveis: `DATABASE_URL`.
5. **TLS e cabeçalhos:** HSTS e demais cabeçalhos de segurança já vêm de `next.config.ts`.

## Estrutura

```
src/lib/tax/        motor determinístico (money, cronograma, engine, apuracao, classificacao) + testes
src/lib/pesquisa/   recuperação, geração, verificador de citações, orquestrador + testes
src/lib/llm/        camada de modelo (Anthropic, compatível OpenAI, extrativo)
src/lib/auth/       senha (scrypt), sessão em cookie httpOnly, ações de login e cadastro
src/components/     landing; components/app: telas do app
src/app/            landing e API da lista de espera; (app)/: entrar, cadastro e área logada
src/proxy.ts        barra /app sem cookie de sessão
db/seeds/           semente provisória da base (não conferida)
scripts/            publicação da landing e ingestão do Planalto
db/migrations/      esquema, RLS e permissões
db/tests/           portão de segurança: isolamento entre escritórios, login, sessões e pesquisa
docs/               arquitetura e decisões
```

## Aviso

Ferramenta de apoio a profissionais. Não presta serviço jurídico nem promete resultado. Os dispositivos citados no cronograma estão marcados como pendentes de conferência até a revisão do tributarista curador.
