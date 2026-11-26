# Fase 2: o advogado calcula e consulta de verdade

**Atualização, 26/11/2026 (tarde):** as decisões foram tomadas (Anthropic; Vercel `gru1` + Supabase São Paulo; texto oficial do Planalto) e as etapas 1 a 5 estão implementadas, com o passo a passo de publicação em [DEPLOY.md](DEPLOY.md). Faltam: contas e chave (Eduardo), o tributarista curador, exportação em Word (hoje há impressão em PDF), salvar simulações por caso (a tabela já existe), convite da equipe e o banco de avaliação.

**Situação inicial em 26/11/2026.** O que está no ar é uma landing estática. A calculadora funciona, mas só no navegador e só para um cálculo isolado. A pesquisa fundamentada com citações **ainda não existe**: não há login, servidor, base normativa carregada nem modelo de linguagem ligado.

Este documento lista o que falta para o produto funcionar, em que ordem, e o que depende de decisões do Eduardo.

## Decisões pendentes (bloqueiam a publicação, não o código)

| Decisão | Recomendação | Por quê | Alternativas |
|---|---|---|---|
| Fornecedor de LLM | **Anthropic (Claude) via API**, com contrato comercial que veda treino com os dados. Modelo de ponta para pesquisa e redação; modelo menor para classificação. | Melhor desempenho em leitura de texto longo e citação literal; termos comerciais sem treino por padrão. | Maritaca (Sabiá, empresa brasileira, API compatível com OpenAI); OpenAI; AWS Bedrock. A camada de modelo será abstraída, então a troca é barata. |
| Hospedagem | **Vercel (região São Paulo, `gru1`) + Supabase (Postgres em São Paulo, com pgvector e RLS)**. | Deploy mais simples para Next.js; dados no Brasil (LGPD); plano gratuito suficiente no beta. | Fly.io (região GRU) + Postgres próprio; AWS `sa-east-1` (RDS + ECS), mais trabalho e mais custo fixo. GitHub Pages não serve: não executa servidor nem banco. |
| Fontes da base normativa | **Começar pelo texto oficial do Planalto** da EC 132/2023 e da LC 214/2025, carregado por script e conferido dispositivo a dispositivo pelo tributarista curador. Depois: soluções de consulta da Receita, CARF e Datajud (CNJ, gratuito). | Gratuito, oficial e cobre o núcleo da Reforma. A base paga pode esperar a validação. | APIs pagas de jurisprudência (cotar na fase 0). |
| Tributarista curador | Necessário antes do beta. | Nada pode ser apresentado como norma conferida sem ele. Hoje todo dispositivo está marcado `conferido: false`. | — |

## Etapas

Cada etapa pode ser feita e testada sem as decisões acima; elas só são exigidas na publicação.

### 1. Servidor, login e escritório
- Migração `002_app.sql`: `senha_hash` em `usuarios`; tabela `sessoes` (hash do token, expiração); funções `security definer` para cadastro, login e resolução de sessão, para que o papel `app_user` continue sem acesso direto a `usuarios`.
- Senha com scrypt (`node:crypto`), cookie `httpOnly` + `Secure` + `SameSite=Lax`, limite de tentativas no login.
- Telas `/entrar` e `/cadastro` (cria usuário, escritório e vínculo de sócio). `proxy.ts` (antigo middleware no Next 16) protege `/app`.
- Toda consulta ao banco roda numa transação com `app.escritorio_id` e `app.usuario_id`, como nos testes de RLS.

### 2. Cálculo completo sobre o motor determinístico
- **Simulador**: linha do tempo 2026–2033 com valores informados pelo advogado, salvo no caso do cliente.
- **Comparador de regimes**: padrão, redução de 30%, redução de 60% e alíquota zero lado a lado, no mesmo ano e na mesma operação.
- **Apuração com créditos**: débito de IBS/CBS sobre vendas menos crédito sobre compras, por ano, com saldo credor. Função pura nova em `src/lib/tax`, com testes.
- **Classificação NCM/NBS**: tabela versionada em código (como `cronograma.ts`), com código, descrição, regime e fundamento, todos `conferido: false` até o curador. Busca determinística por código e prefixo; o modelo, quando existir, só pode sugerir entre linhas da tabela, nunca uma alíquota.
- Cada número continua exibindo sua origem: norma, estimativa ou premissa.

### 3. Base normativa
- Coluna `tsvector` (português) e índice GIN em `dispositivos`; embeddings com pgvector numa segunda etapa.
- Coluna `origem` (`ingestao`, `semente`), para distinguir texto carregado de texto ainda não conferido.
- Script de ingestão: baixa o texto do Planalto, quebra por dispositivo, grava como `rascunho` com datas de vigência. O curador muda para `publicado` no painel.
- Enquanto não houver curadoria, a pesquisa só exibe o que não foi revisado com a faixa "texto não conferido pelo curador; não use em peça".

### 4. Pesquisa fundamentada
Orquestração em funções explícitas, sem framework de agente:
1. **Recuperar** os dispositivos vigentes na data de referência que respondem à pergunta (busca textual; depois híbrida).
2. **Gerar**: o modelo recebe só esses trechos, identificados (D1, D2…), e devolve JSON com a resposta e as citações `{ref, trecho}`.
3. **Verificar** (função pura, com testes): cada citação aponta para um trecho recuperado; o trecho citado é substring normalizada do texto oficial; toda marca [Dn] no texto tem citação correspondente; há ao menos uma citação. Uma falha bloqueia a resposta (`bloqueada_citacao`) e o advogado vê o motivo.
4. **Registrar** em `consultas` e `auditoria`: modelo, tokens, custo, tempo.

Interface: resposta à esquerda, painel de fontes à direita com trecho original, link oficial, status de curadoria e vigência. Seletor "o que valia em DD/MM/AAAA". Histórico de consultas por caso.

Sem chave de API, um provedor **extrativo** responde só com os trechos mais relevantes, passando pelo mesmo verificador. Assim a pesquisa funciona desde o primeiro dia, ainda que sem redação.

### 5. Camada de modelo
- Interface `ProvedorLLM` com implementações Anthropic, compatível com OpenAI (cobre Maritaca, OpenAI e Azure) e extrativa.
- Escolha por variável de ambiente e roteamento por tarefa (`pesquisa`, `classificacao`).
- Medição de custo por consulta, para a meta de inferência abaixo de 25% da receita por usuário.

### 6. Exportação e publicação
- Exportar resposta e simulação em Word e PDF com aviso de uso de IA (recomendação do CFOAB).
- `scripts/_estatico.sh` passa a retirar também `/app`, `/entrar`, `/cadastro` e `proxy.ts` da versão estática, para a landing seguir publicada no GitHub Pages.
- Deploy na hospedagem escolhida; papel de conexão herdando `app_user`; variáveis `DATABASE_URL`, `LLM_PROVEDOR`, `LLM_CHAVE`.
- Link "Entrar" na landing só depois do deploy (a outra frente cuida do visual).

### 7. Avaliação
- Banco de perguntas tributárias com gabarito do curador, rodado a cada troca de modelo ou de base.
- Metas da fase: precisão de citação ≥ 98% e 40% de uso semanal no beta.

### 8. Perfis, permissões e administração do escritório
- Planejado em [`PLANO-PERFIS-PERMISSOES.md`](PLANO-PERFIS-PERMISSOES.md): níveis de acesso separados do cargo, convites, painel do administrador, cobrança, curadoria e LGPD. Aguarda as decisões listadas no fim daquele documento.

## Cuidado permanente

Dispositivos citados de memória no código (cronograma, regimes, tabela NCM) são pontos de partida, não norma verificada. Até a conferência do curador, a interface deve dizer isso ao lado de cada número e de cada trecho.
