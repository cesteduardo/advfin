# Avaliação da pesquisa fundamentada

`perguntas.json` tem 100 perguntas com gabarito; `npm run avaliar` roda todas pelo mesmo caminho do app (busca → seleção → IA → verificador) e mede a **precisão de citação**: citações corretas ÷ citações entregues. Meta do plano: **≥ 98%**.

Uma citação é correta quando o dispositivo estava vigente na data da pergunta, é de uma norma do gabarito e tem o rótulo do gabarito (ou, nas perguntas marcadas `conferir_numeracao`, contém o termo esperado). Pergunta fora do escopo que recebe resposta conta todas as citações como erradas.

Como rodar: ver [docs/TESTE-PUBLICO.md](../docs/TESTE-PUBLICO.md#3-avaliação-precisão-de-citação--98). Os relatórios saem em `resultados/` (só a linha de base é versionada).

Para o curador: conferir cada gabarito e marcar `gabarito_conferido: true`; nas perguntas da LC 214, trocar o termo pelo artigo certo depois da carga oficial. Pergunta nova: copie uma existente, mantenha o `id` sequencial.
