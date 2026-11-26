# Arquitetura do AdvFin

A confiança do produto vem de uma separação: **o que o modelo escreve, o sistema confere e calcula.** Cada camada abaixo existe para sustentar essa frase.

## Prioridades (em conflito, nesta ordem)

1. Precisão e rastreabilidade das fontes
2. Segurança e sigilo dos dados
3. Clareza e qualidade da interface
4. Custo de inferência por consulta

## Visão geral

```
┌──────────────────────────── Next.js (App Router, TypeScript) ────────────────────────────┐
│ Landing + calculadora (estática, cálculo no navegador)                                   │
│ App: pesquisa · copiloto da Reforma · exportação · painel do curador                    │
└───────────────┬───────────────────────────────┬──────────────────────────────────────────┘
                │                               │
   ┌────────────▼────────────┐     ┌────────────▼─────────────┐     ┌───────────────────────┐
   │ Orquestrador de pesquisa│     │ Motor determinístico      │     │ Exportação .docx/PDF  │
   │ (código explícito)      │     │ src/lib/tax  (sem LLM)    │     │ com aviso de uso de IA│
   │ 1 recuperar por vigência│     └──────────────────────────┘     └───────────────────────┘
   │ 2 gerar com citações    │
   │ 3 verificar citações ───┼──► bloqueia se alguma não existir na base
   │ 4 registrar auditoria   │
   └──────┬──────────┬───────┘
          │          │
┌─────────▼───┐  ┌───▼──────────────────────────┐   ┌───────────────────────────────┐
│ Camada LLM  │  │ PostgreSQL + pgvector         │◄──┤ Fila de ingestão               │
│ provedores  │  │ base normativa versionada     │   │ DOU, Planalto, CARF, Datajud…  │
│ trocáveis   │  │ dados do escritório com RLS   │   │ → rascunho → curadoria → publ. │
└─────────────┘  └───────────────────────────────┘   └───────────────────────────────┘
```

## Decisões

| Decisão | Escolha | Por quê |
|---|---|---|
| Cálculo | Motor puro em TypeScript, inteiros (centavos e ppm), BigInt nos produtos | Nenhum float e nenhum LLM em valor fiscal. Roda igual no servidor e no navegador. |
| Origem de cada número | Toda alíquota vive em `cronograma.ts` com `status` (norma, estimativa, premissa) e `conferido` | A interface mostra de onde vem cada número. Nada é apresentado como norma sem o curador conferir. |
| Vigência | `dispositivos` com intervalo `[vigencia_inicio, vigencia_fim)` e função `dispositivos_vigentes_em(data)` | Responde “o que valia em DD/MM/AAAA”, essencial em sete anos de transição. |
| Curadoria | Só `status_curadoria = 'publicado'` entra na pesquisa e no verificador | Rascunho de ingestão nunca chega ao advogado. |
| Isolamento | RLS com `FORCE` em todas as tabelas de escritório; papel `app_user` sem posse das tabelas; contexto por transação (`app.escritorio_id`, `app.usuario_id`) e checagem de pertencimento | Um contexto forjado não basta: o usuário precisa ser membro do escritório declarado. |
| Auditoria | `auditoria` append-only (sem `update`/`delete` para a aplicação) | Trilha de tudo o que a IA produziu, exigida pelas recomendações do CFOAB. |
| LLM | Interface `ProvedorLLM` própria; roteamento por tarefa (ponta para redação, menor para classificação) | Troca de fornecedor sem reescrever; controle do custo por consulta. |
| Orquestração | Funções explícitas, sem framework de agente | Cada passo testável e auditável. |
| Hospedagem | Região brasileira (ex.: AWS `sa-east-1` ou GCP `southamerica-east1`) | LGPD e promessa de sigilo. |
| Landing | Página estática; calculadora no cliente | LCP baixo e nenhum dado de simulação sai do navegador. |

## Verificador de citações (a implementar na fase seguinte)

1. O modelo recebe apenas trechos recuperados de `dispositivos_vigentes_em(data_referencia)` e devolve citações estruturadas: `{norma, dispositivo, trecho}`.
2. Cada citação é resolvida contra a base: a norma existe, o dispositivo existe, estava vigente na data, e o trecho citado é substring normalizada do texto oficial.
3. Uma única falha muda a consulta para `bloqueada_citacao`; o advogado vê o motivo, não a resposta.
4. A resposta exibida carrega, por citação, trecho original, link oficial, status e data de vigência.

## O que já está no repositório

- `src/lib/tax`: motor IBS/CBS da transição 2026–2033, regimes (padrão, redução de 30%, redução de 60%, alíquota zero) e linha do tempo. 25 testes.
- `db/migrations/001_init.sql`: escritórios, membros e papéis, casos, consultas com métricas de custo e latência, base normativa versionada, curadoria, auditoria, lista de espera, registro de tratamento e pedidos de exclusão (LGPD).
- `db/tests`: 28 testes provando que um escritório não lê, não grava, não altera e não move dados de outro, que a auditoria é append-only e que a consulta por data devolve a redação certa.
- Landing de conversão com calculadora, planos e lista de espera.

## O que depende de pessoas ou contratos

- **Tributarista curador:** conferir cada dispositivo de `cronograma.ts` (hoje todos marcados `conferido: false`), as regras de redução em 2026 e o gabarito das 60 perguntas de avaliação.
- **Alíquotas de referência:** hoje são estimativa editável (CBS 8,8% + IBS 17,7%). Substituir pelos valores fixados em resolução do Senado assim que publicados.
- **Fornecedor de LLM e chave de API:** com contrato que vede uso dos dados para treino.
- **Base normativa:** cotar fontes (Planalto, DOU, CARF, soluções de consulta) e definir a rotina de ingestão.
