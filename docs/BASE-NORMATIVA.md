# Base normativa do AdvFin

O AdvFin é a IA do tributarista. A base cobre o Direito Tributário e, como apoio, o Código
Civil e o CPC, que o tributarista usa todos os dias. Outras áreas (penal, trabalhista) ficam
fora do escopo.

## Regras de fidelidade

- Texto literal da página oficial. Nada é transcrito de memória nem parafraseado.
- Sai só o que a página mostra tachado (redação revogada) e as notas de alteração, que ficam
  guardadas à parte em `notas` para o curador datar a versão.
- Tudo entra como **não conferido pelo curador** (`em_revisao`). Na tela: "Aguardando o curador".
- Vigência provisória: a data de publicação da norma, até o curador datar cada dispositivo.

## Escopo e ordem de carga

| Módulo | Conteúdo | Situação |
| --- | --- | --- |
| Reforma | EC 132/2023, LC 214/2025, ADCT da Reforma (arts. 124 a 138) | no catálogo, Planalto |
| Tributário federal | CF arts. 145 a 162, CTN, PAF, LEF, PIS/Cofins, IPI, IRPJ/CSLL, RIR, RIPI, LC 123, LC 87, LC 116, LC 24, LC 160, LC 105, mandado de segurança, CADIN, transação, crimes tributários, custeio previdenciário, IRPF, preços de transferência, Regulamento Aduaneiro, Lei das S.A. | no catálogo, Planalto |
| Apoio | Código Civil, CPC, Lei 9.784/1999 | no catálogo, Planalto |
| Receita | INs (PIS/Cofins, IRPJ/CSLL, compensação) e soluções de consulta | catálogo; páginas salvas do Sijut |
| CARF e PGFN | acórdãos e súmulas do CARF; portarias e pareceres da PGFN | a fazer: leitor próprio |
| São Paulo | Lei 6.374/1989, RICMS/2000, ISS da capital | catálogo; páginas salvas |
| Jurisprudência | STF e STJ em matéria tributária (dados abertos) | a fazer: leitor próprio |

O catálogo está em `scripts/catalogo-normas.mjs`. Cada grupo carrega com
`node scripts/carregar-base.mjs --grupo <grupo>` (banco) e
`npm run base-estatica -- --grupo <grupo>` (demonstração estática).

## Demonstração estática (GitHub Pages)

`npm run base-estatica` baixa as normas com URL oficial, separa por artigo e grava em
`public/base/`:

- `indice.json`: normas, partes e um índice invertido pequeno (radical → partes);
- `<norma>-<n>.json`: os artigos, em partes de até ~300 KB.

O navegador baixa o índice uma vez e, a cada pergunta, só as partes onde os termos aparecem
(`src/lib/pesquisa/base-ampliada.ts`). Sem `public/base`, a demonstração segue com a base
embutida de sempre.

## De onde dá para baixar

O Planalto e os demais portais oficiais recusam conexões do ambiente de nuvem padrão. Há
duas saídas:

1. o ambiente de nuvem **advfin** (Project settings, Cloud environment), que libera só os
   sites oficiais de legislação e jurisprudência;
2. o Mac do Eduardo, com `npm run base-estatica` ou `--pasta` apontando para páginas salvas.

Na nuvem, o `fetch` do Node só usa o proxy com `NODE_USE_ENV_PROXY=1`:
`NODE_USE_ENV_PROXY=1 npm run base-estatica`.
