# Plano: perfis, permissões e administração do escritório

> Status: **plano, não implementado.** Escrito em 26/11/2026 a pedido de Eduardo; quatro decisões tomadas no mesmo dia (seção 8).
> Parte do que já existe no PR #2 (cadastro, login, sessões, RLS por escritório, auditoria append-only, tabelas de LGPD)
> e propõe o que falta para um escritório de verdade usar o AdvFin com várias pessoas.

## 1. Ponto de partida

O que o banco e o app já têm hoje:

| Peça | Situação |
|---|---|
| `usuarios` (e-mail, nome, OAB opcional, `excluido_em`) | existe, sem tela de perfil |
| `escritorios` (nome, `plano`) | existe; o plano é só um texto, sem cobrança |
| `membros` com `papel_escritorio` = `socio`, `associado`, `estagiario` | existe; quem cadastra vira `socio`, e ninguém mais entra |
| RLS com FORCE em tudo o que é do escritório | existe; isola **escritórios**, mas não distingue papéis dentro dele |
| `auditoria` append-only | existe; registra cadastro e consultas |
| `pedidos_exclusao`, `registro_tratamento` (LGPD) | tabelas existem, sem fluxo |
| Acesso ao laboratório `/app/dev` | por lista `DEV_EMAILS` em variável de ambiente |

O que falta, em uma frase: **hoje cada escritório tem uma pessoa só, e todas as pessoas podem tudo.**

## 2. O princípio do desenho

Separar três coisas que costumam se misturar:

1. **Cargo** é a função jurídica da pessoa no escritório: sócio, associado, estagiário, paralegal. Ele aparece no
   perfil e na assinatura das peças, mas **não dá permissão nenhuma por si só**.
2. **Nível de acesso** é o que a pessoa pode fazer no AdvFin. São quatro níveis, descritos abaixo, e é isso que o
   banco confere.
3. **Papel na plataforma** vale só para a equipe do AdvFin: administrador da plataforma e curador da base normativa.
   Fica fora dos escritórios, e nenhum cliente o vê.

Com essa separação, um sócio pode não querer mexer em faturamento, e uma gerente administrativa sem OAB pode
administrar o escritório sem fazer consultas jurídicas. Hoje o `papel_escritorio` mistura as duas coisas.

## 3. Níveis de acesso no escritório

| Nível | Para quem | Resumo |
|---|---|---|
| **Titular** | uma pessoa por escritório, quem contratou | tudo, inclusive faturamento, transferir a titularidade e encerrar a conta |
| **Administrador** | sócios ou gestão | gente, papéis, convites, auditoria, configurações; não encerra a conta |
| **Membro** | advogados | usa as ferramentas, cria casos, inclui colegas, exporta |
| **Supervisionado** | estagiários, paralegais | usa as ferramentas; exportar ou incluir pessoas pede revisão de um membro |

Há também um nível opcional, **Leitura**, para clientes ou auditores externos que só veem os casos compartilhados com
eles. Fica para a etapa 5, se Eduardo quiser.

### Matriz de permissões

✓ pode · ◐ pode com revisão · — não pode

| Ação | Titular | Admin | Membro | Supervisionado |
|---|:-:|:-:|:-:|:-:|
| Pesquisa, cálculo e NCM/NBS | ✓ | ✓ | ✓ | ✓ |
| Ver as próprias consultas e simulações | ✓ | ✓ | ✓ | ✓ |
| Ver casos e consultas dos colegas | todos | todos | os de Membros e Supervisionados, e os seus | só os seus e aqueles em que foi incluído |
| Criar caso | ✓ | ✓ | ✓ | ✓ |
| Incluir um colega num caso | ✓ | ✓ | ✓ | ◐ |
| Exportar parecer (PDF/DOCX) | ✓ | ✓ | ✓ | ◐ |
| Enviar documentos privados do escritório | ✓ | ✓ | ✓ | — |
| Ver a trilha de auditoria do escritório | ✓ | ✓ | — (só a própria) | — (só a própria) |
| Convidar pessoas | ✓ | ✓ | — | — |
| Mudar o nível de alguém | ✓ | ✓ (até Admin) | — | — |
| Remover alguém | ✓ | ✓ (exceto Titular) | — | — |
| Configurações do escritório (nome, logo, domínio de e-mail, 2FA obrigatório) | ✓ | ✓ | — | — |
| Plano, assentos, cartão e notas fiscais | ✓ | — | — | — |
| Ver consumo (consultas e custo de IA) | ✓ | ✓ | — | — |
| Transferir titularidade | ✓ | — | — | — |
| Exportar todos os dados do escritório (LGPD/portabilidade) | ✓ | — | — | — |
| Encerrar a conta do escritório | ✓ | — | — | — |

Regras que a matriz não mostra:

- **Visibilidade por nível** (decisão 2): um caso nasce visível ao autor e a quem tem nível igual ou superior ao dele,
  com piso em Membro. O caso de um Membro é visto pelos Membros, pelos Admins e pelo Titular. O de um Supervisionado
  é visto por ele e pelos Membros para cima, e não pelos outros estagiários. O de um Admin só é visto por Admins e pelo
  Titular. Para mostrar um caso a quem está abaixo, a pessoa é incluída nele. O Titular e os Admins veem tudo,
  porque respondem pelo escritório.

- Sempre existe **exatamente um Titular**. Ele não pode sair nem ser removido sem antes transferir a titularidade.
- Um Admin **não promove ninguém acima de si** e não rebaixa outro Admin. Só o Titular rebaixa Admins.
- Ninguém altera o próprio nível.

## 4. Telas

### 4.1 Perfil (`/app/perfil`), para todos

- **Dados:** nome, e-mail (a troca exige confirmar no novo endereço), foto, cargo e OAB (número e UF).
  A OAB aparece marcada como "declarada" até ser verificada (ver decisão 6).
- **Segurança:** trocar a senha, ativar a verificação em duas etapas (TOTP, por aplicativo), ver as sessões
  abertas com aparelho, cidade e último uso, e encerrar qualquer uma.
- **Preferências:** data de vigência padrão (hoje, ou uma data fixa para casos antigos), modelo de IA
  (quando houver opção) e avisos por e-mail.
- **Meus escritórios:** a lista e um seletor, para quem atua em mais de um (o esquema já permite).
- **Privacidade (LGPD):** baixar os meus dados, ver o registro do que foi feito com eles e pedir a exclusão da
  conta, com explicação do que acontece com as consultas feitas para o escritório (ver decisão 8).

### 4.2 Administração do escritório (`/app/escritorio`), só para Titular e Admin

Abas em pílula, no mesmo padrão da calculadora:

1. **Pessoas:** a lista com nome, cargo, nível, último acesso e 2FA. Ações: convidar, mudar o nível, suspender
   e remover. Os convites pendentes ficam no topo, com reenviar e cancelar.
2. **Convites:** por e-mail, com nível e cargo já escolhidos. O link vale 7 dias e serve uma vez. Opção de
   **domínio do escritório**: quem se cadastra com `@escritorio.adv.br` pede para entrar, e um Admin aprova.
3. **Auditoria:** a trilha filtrável por pessoa, ação e período, com exportação em CSV. Ela mostra consultas,
   exportações, mudanças de papel, logins e convites, e nunca o conteúdo das consultas de casos que o leitor não pode ver.
4. **Consumo:** consultas por mês e por pessoa, custo de IA, e limite do plano.
5. **Configurações:** nome e logo (para o cabeçalho do parecer exportado), 2FA obrigatório para todos ou só para
   Admins, tempo da sessão, domínio de e-mail.
6. **Plano e cobrança** (só Titular): cobrança **por pessoa** no **Stripe**. Mostra o plano, os assentos em uso,
   o cartão, as faturas e as notas fiscais, e permite trocar ou cancelar o plano. Convidar alguém acima dos assentos
   contratados pede confirmação do Titular e ajusta a assinatura com valor proporcional. Pessoas suspensas não contam.
7. **Dados e encerramento** (só Titular): exportar tudo, transferir a titularidade e encerrar a conta, com
   prazo de carência de 30 dias antes do expurgo.

### 4.3 Plataforma (`/admin`), só para a equipe AdvFin

- Escritórios e assinaturas, para atender o suporte sem ler o conteúdo das consultas.
- **Curadoria da base normativa:** a fila de dispositivos em `rascunho` e `em_revisao`, com o texto do Planalto ao lado,
  e as ações aprovar, rejeitar e anotar. É aqui que o tributarista curador trabalha.
- O laboratório do chat, hoje liberado por `DEV_EMAILS`, passa a exigir o papel de plataforma.
- Pedidos de exclusão LGPD, com prazo e status.

## 5. Mudanças de esquema (migração `003_perfis.sql`)

```sql
-- Nível de acesso, separado do cargo.
create type nivel_acesso as enum ('supervisionado', 'membro', 'admin', 'titular');  -- em ordem crescente
alter table membros add column nivel nivel_acesso;
update membros set nivel = case papel when 'socio' then 'titular' when 'associado' then 'membro' else 'supervisionado' end;
alter table membros alter column nivel set not null;
alter table membros rename column papel to cargo;            -- vira texto livre do perfil
alter table membros alter column cargo type text;
alter table membros add column suspenso_em timestamptz;
create unique index um_titular on membros (escritorio_id) where nivel = 'titular';

-- Perfil.
alter table usuarios add column foto_url text,
                     add column oab_verificada_em timestamptz,
                     add column totp_segredo_cifrado bytea,      -- cifrado na aplicação
                     add column preferencias jsonb not null default '{}';

-- Convites.
create table convites (
  id uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  email text not null check (email = lower(email)),
  nivel nivel_acesso not null check (nivel <> 'titular'),
  cargo text,
  token_hash text not null unique,
  convidado_por uuid not null references usuarios(id),
  expira_em timestamptz not null,
  aceito_em timestamptz, cancelado_em timestamptz
);

-- Configurações e plataforma.
alter table escritorios add column logo_url text, add column dominio_email text,
                        add column exige_2fa text not null default 'nao' check (exige_2fa in ('nao','admins','todos')),
                        add column encerrado_em timestamptz;
create table equipe_plataforma (usuario_id uuid primary key references usuarios(id),
                                papel text not null check (papel in ('admin', 'curador', 'suporte')));

-- Casos: privado (só quem criou e os convidados) ou do escritório.
-- Casos: visíveis ao autor, aos incluídos e a quem tem nível >= nivel_minimo = max(nível do autor, 'membro').
alter table casos add column nivel_minimo nivel_acesso not null default 'membro';
create table casos_membros (caso_id uuid references casos(id) on delete cascade, usuario_id uuid references usuarios(id),
                            primary key (caso_id, usuario_id));
```

**RLS por nível.** As políticas atuais só perguntam "é membro deste escritório?". Elas ganham duas funções:
`app.nivel_atual()`, que devolve o nível do usuário no escritório atual, e `app.pode(acao text)`, que consulta uma tabela
fixa de permissões (a matriz da seção 3, em dados, não espalhada pelo código). Por exemplo:

- `membros`: todos leem, e só `app.pode('gerir_pessoas')` escreve. As regras de "não acima de si" e de "um Titular"
  ficam numa função `security definer` `app.mudar_nivel()`, porque a RLS sozinha não expressa comparação entre linhas.
- `auditoria`: Admin e Titular leem tudo; os demais leem só as linhas com `usuario_id = app.usuario_atual()`.
- `casos`: `app.nivel_atual() >= nivel_minimo` (a ordem do enum é supervisionado < membro < admin < titular),
  ou o usuário está em `casos_membros`, ou é o autor.
- `consultas` e `simulacoes`: as próprias, mais as de casos visíveis ao usuário.
- `convites`: só quem pode gerir pessoas; a aceitação passa por `app.aceitar_convite(token)`.

A aplicação também confere a permissão antes de cada ação do servidor, para dar uma mensagem clara.
Mas **quem garante é o banco**: um erro no app não abre o que a RLS fecha. Cada regra nova ganha teste em `db/tests`,
como os 38 de hoje.

## 6. Segurança e LGPD

- **2FA** com TOTP, e códigos de recuperação mostrados uma vez. Pode ser exigido pelo escritório.
- **Sessões:** ao mudar a senha, ao remover ou suspender alguém, ou ao rebaixar um nível, todas as sessões da pessoa
  naquele escritório caem na hora.
- **Auditoria** de toda ação administrativa: convite, aceite, mudança de nível, remoção, exportação, troca de titular e mudança de plano.
- **Saída de membro:** a conta continua dele. O vínculo com o escritório acaba, e as consultas feitas pelo escritório
  ficam com o escritório, que é o controlador desses dados.
- **Exclusão de conta (art. 18 da LGPD):** é lógica na hora (`excluido_em`) e física pelo job de expurgo em até 15 dias.
  Nas consultas que pertencem ao escritório, o nome é trocado por "ex-membro".
- **Portabilidade:** o Titular exporta tudo do escritório em JSON e CSV, e cada pessoa exporta o próprio perfil.
- O `registro_tratamento` ganha as linhas de convites, 2FA, cobrança e auditoria administrativa.

## 7. Etapas

| # | Entrega | Depende de |
|---|---|---|
| 1 | Migração 003, funções `nivel_atual`/`pode`/`mudar_nivel`, RLS por nível e testes de banco | — |
| 2 | Tela de perfil: dados, senha, sessões e preferências | 1 |
| 3 | Administração: Pessoas, Convites e Auditoria; e-mail transacional para os convites | 1, provedor de e-mail |
| 4 | 2FA, configurações do escritório e visibilidade dos casos por nível | 2, 3 |
| 5 | Cobrança no Stripe por pessoa (assento), consumo, nível Leitura (opcional) | conta Stripe |
| 6 | Plataforma `/admin`: curadoria, suporte e LGPD; o laboratório passa a usar o papel de plataforma | 1 |
| 7 | Dados e encerramento: exportação completa, transferência de titularidade e carência de 30 dias | 3 |

As etapas 1 a 3 já fazem do AdvFin um produto para escritórios com várias pessoas. A etapa 6 é a que desbloqueia o
curador, então pode vir antes da 5, se o curador chegar antes da cobrança.

## 8. Decisões

### Tomadas por Eduardo em 26/11/2026

1. **Quatro níveis:** Titular, Administrador, Membro e Supervisionado.
2. **Visibilidade do caso por nível de acesso:** o caso novo aparece para quem tem nível igual ou superior ao de quem
   o criou, e para quem for incluído nele (regra na seção 3).
3. **Cobrança no Stripe.**
4. **Cobrança por pessoa** (assento).

Consequências no esquema: `casos.nivel_minimo` no lugar de "privado ou escritório", e `escritorios` ganha
`stripe_cliente_id`, `stripe_assinatura_id` e `assentos`. Os eventos do Stripe chegam por webhook, que só
atualiza a assinatura. O Stripe guarda os cartões, então o AdvFin não guarda nenhum.

### Ainda em aberto

1. **Revisão do Supervisionado:** exportar e incluir pessoas pedem aprovação de um Membro, ou só ficam marcados como
   "não revisado"? *Recomendação: aprovação.*
2. **Um advogado em vários escritórios** (sócio num, consultor noutro): entra já no lançamento?
   *Recomendação: sim; o banco já permite, falta só o seletor.*
3. **Entrar com Google ou Microsoft** além de e-mail e senha? E o 2FA, é obrigatório para Admins desde o início?
4. **Verificação da OAB:** só declarada, conferida à mão pela equipe, ou pelo Cadastro Nacional dos Advogados?
5. **Formas de pagamento no Stripe:** só cartão, ou também boleto e PIX, que o Stripe oferece no Brasil?
   E há período de teste grátis?
6. **Saída e exclusão:** as consultas de quem sai ficam com o escritório (proposta da seção 6) ou saem com a pessoa?
7. **Nível Leitura** para clientes do escritório verem casos compartilhados: entra no plano ou fica para depois?
