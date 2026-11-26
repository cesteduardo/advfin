# AdvFin

A IA do tributarista brasileiro: pesquisa, cálculo e redação com fonte verificável, começando pela Reforma Tributária (EC 132/2023 e LC 214/2025).

Este repositório contém a fase 1 do MVP: landing page com calculadora IBS/CBS gratuita, o motor determinístico de transição e o esquema do banco com base normativa versionada e isolamento por escritório. A arquitetura completa está em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Rodar localmente

Requisitos: Node 22+ e PostgreSQL 16 (com pgvector em produção).

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # motor de cálculo
```

Sem `DATABASE_URL`, a lista de espera grava em `data/lista-espera.jsonl` (só em desenvolvimento).

### Testes de isolamento (RLS)

Precisam de um PostgreSQL acessível como superusuário; o teste cria e apaga um banco descartável.

```bash
TEST_DATABASE_ADMIN_URL=postgres://postgres@localhost:5432/postgres npm run test:db
```

## Deploy

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
src/lib/tax/        motor determinístico (money, cronograma, engine) + testes
src/components/     calculadora e lista de espera
src/app/            landing e API da lista de espera
db/migrations/      esquema, RLS e permissões
db/tests/           portão de segurança: isolamento entre escritórios
docs/               arquitetura e decisões
```

## Aviso

Ferramenta de apoio a profissionais. Não presta serviço jurídico nem promete resultado. Os dispositivos citados no cronograma estão marcados como pendentes de conferência até a revisão do tributarista curador.
