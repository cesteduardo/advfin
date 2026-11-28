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

## Primeira carga (28/11/2026)

Rodada no ambiente de nuvem **advfin**: 38 normas do Planalto, 8.287 dispositivos, 51 partes
(7,3 MB em `public/base/`). Todas "Aguardando o curador", com vigência provisória.

Conferência por amostragem: 64 artigos sorteados em 8 normas (CF, EC 132, LC 214, CTN, RIR,
Lei 9.430, Código Civil, CPC), comparados palavra por palavra, na ordem, com a página oficial.
Todos batem; o que falta em relação à página é só a redação tachada e as notas de alteração,
que o leitor tira de propósito.

Falhas do leitor achadas e corrigidas nesta carga (com testes em `planalto.test.ts`):

- páginas antigas sem charset declarado eram lidas como UTF-8 e viravam "�": agora caem em
  Windows-1252 quando os bytes não são UTF-8 válido (afetava todas as normas);
- `&#150;` virava caractere de controle em vez de travessão;
- o último artigo engolia o fecho, as assinaturas e o índice da página (CC, art. 2.046), e
  títulos como "CAPÍTULO V ..." colavam no fim do artigo anterior;
- redação revogada marcada por estilo (`text-decoration:line-through` ou a classe `msoDel`)
  entrava no texto como se estivesse em vigor;
- nota de alteração quebrada em duas linhas ficava no texto, e artigos só com a nota
  "(Revogado...)" ou "Vigência" entravam vazios.

Restam três notas com erro de digitação na própria página do Planalto ("Redação da pela",
parêntese sem fechar), que ficam no texto como estão: CTN art. 70, Lei 6.404 art. 124 e
Lei 8.212 art. 80.

Ficam para a próxima rodada: atos da Receita (INs, soluções de consulta), CARF, PGFN, ICMS e
ISS de São Paulo, e a jurisprudência do STF e do STJ.
