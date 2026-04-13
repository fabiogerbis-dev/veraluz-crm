# Bot de Atendimento Automático — Qualificação por Canal

## Objetivo deste documento

Este arquivo documenta o **fluxo em produção** do bot de qualificação inicial de leads,
segmentado por canal (WhatsApp, Instagram Direct, Facebook Messenger).

Versão de produção: commit `b5681e6` (11/abr/2026) — fluxo otimizado por canal,
sem menção a nome de atendente, referências a "equipe" em vez de "consultor".

---

## Princípios de design

1. **Valor primeiro, dados depois** — qualificar interesse e urgência antes de pedir dados pessoais.
2. **Menos é mais** — Instagram máx. 6 trocas; WhatsApp máx. 7-9; Messenger intermediário (7-10).
3. **Tom nativo por canal** — cada plataforma com voz própria, respeitando suas normas e limitações.
4. **Consolidação inteligente** — cidade + estado em uma pergunta; idades em uma pergunta (CSV).
5. **Bot é qualificador rápido, não formulário completo** — dados complementares ficam para o corretor.

---

## Escopo técnico

### Canais suportados

| Canal | Identificador | Suporta bold | Prefixo de opção | Tom |
|-------|--------------|-------------|-------------------|-----|
| WhatsApp | `whatsapp` | Sim (`*texto*`) | Emoji numérico (1️⃣ 2️⃣ …) | Acolhedor, profissional |
| Instagram Direct | `instagram` | Não | Traço (`1 -`) | Direto, informal, breve |
| Facebook Messenger | `messenger` | Não | Traço (`1 -`) | Intermediário, cordial |

### Status de qualificação

- `not_started` — conversa nova, bot ainda não iniciou
- `pending` — qualificação em andamento
- `completed` — todas as etapas respondidas, lead criado
- `ignored_known_contact` — contato conhecido, bot não interage

### Temporizadores de inatividade por canal

| Canal | Lembrete após | Encerramento após lembrete | Total máximo |
|-------|--------------|---------------------------|-------------|
| WhatsApp | 15 minutos | 60 minutos | 75 minutos |
| Instagram | 20 minutos | 120 minutos | 140 minutos |
| Messenger | 15 minutos | 90 minutos | 105 minutos |

Varredura: a cada `15 segundos`. Lote máximo por ciclo: `25 conversas`.

### Envio de mensagens automáticas

Mensagens do bot são enviadas via Zap Responder Chat API com `send_nome: "Veraluz"`.
O bot **não** deve exibir nenhum nome de atendente/operador sobre as mensagens enviadas ao lead.
Para garantir isso, o bot tenta enviar a mensagem **sem** assumir a conversa como admin no
Zap Responder (`assumeConversationAsAdmin`). Caso o envio direto falhe, faz fallback assumindo
como admin (com `showChatLogs: false`) e reenvia.

**Atenção**: caso o nome de algum atendente apareça nas mensagens do bot, verificar no
painel admin do Zap Responder (https://chat.zapresponder.com.br/) se o operador de chat
configurado em `ZAP_RESPONDER_CHAT_EMAIL` tem um nome genérico (como "Veraluz") e não
um nome pessoal (como "Fabio").

---

## Condições para o bot rodar

O processamento da qualificação acontece somente quando:

- a conversa **não** tem `lead_id`
- o contato **não** foi marcado como conhecido (`knownContact = false`)
- o canal é suportado (`whatsapp | instagram | messenger`)
- a mensagem é `inbound`
- a mensagem é persistível (`body`, `media`, `externalMessageId` ou tipo não-texto)

### Skip de seguidores (Instagram e Messenger)

Para Instagram e Messenger, seguidores da página (`knownContact = true`) são automaticamente
ignorados pelo bot (`skipFollowers: true`). Isso evita que seguidores recebam o fluxo de
qualificação ao enviar mensagens casuais.

No WhatsApp, `skipFollowers: false` — todo contato desconhecido inicia o fluxo normalmente.

### Quando a conversa já tem lead vinculado

Se `lead_id` já existe na conversa, o bot envia uma **mensagem de retorno personalizada**
(ver seção "Mensagens de retorno para leads existentes") em vez de silenciar.
Cooldown de 30 minutos entre repetições (baseado na última mensagem outbound na conversa).

---

## Arquitetura de fases

O fluxo é dividido em 4 fases, com etapas condicionais por canal:

```
FASE 1 — Rapport + Interesse
  fullName          → Introdução + nome (todos os canais)
  planType          → Tipo de plano (todos os canais)
  ageRange          → Idade individual (Individual ou Entidade — todos os canais)
  agesBundle        → Idades CSV para planos de grupo (Familiar/Empresarial/MEI — todos os canais)
  contractType      → Primeiro plano ou troca (WhatsApp e Messenger)

FASE 2 — Qualificação comercial
  currentPlan       → Operadora atual, se trocar (WhatsApp e Messenger)
  operatorInterest  → Preferência de operadora, texto livre (WhatsApp e Messenger)
  urgency           → Nível de urgência (todos os canais)

FASE 3 — Dados de contato
  phone             → WhatsApp com DDD (Instagram e Messenger — pulo se já tem phone real)
  cityState         → Cidade e estado consolidados (todos os canais)

FASE 4 — Dados complementares
  cnpj              → Se Empresarial ou MEI (WhatsApp e Messenger)
  entityName        → Se Entidade/sindicato (WhatsApp e Messenger)
```

**Nota**: `ageRange` e `agesBundle` são mutuamente exclusivos — apenas um é perguntado,
conforme o tipo de plano escolhido.

### Resumo de etapas por canal

| Canal | Etapas mín. | Etapas máx. | Etapas removidas do bot |
|-------|------------|------------|------------------------|
| WhatsApp | 7 | 9 | email, cpf, hasWhatsapp, coparticipação, cobertura, initialNotes |
| Instagram | 6 | 6 | contractType, currentPlan, operatorInterest, cnpj, entityName + todos acima |
| Messenger | 7 | 10 | email, cpf, hasWhatsapp, coparticipação, cobertura, initialNotes |

---

## Fluxo detalhado — WhatsApp

Máximo: 7-9 trocas de mensagem. Bold habilitado. Emojis numéricos.

### Introdução + 1) `fullName`

- Mensagem enviada (introdução + pergunta na mesma bolha):

> Olá! 😊 Bem-vindo à *Veraluz*!
> Sou a assistente virtual e vou te ajudar a encontrar o plano de saúde ideal.
>
> São poucas perguntas rápidas e logo a equipe entra em contato com você aqui mesmo pelo WhatsApp.
>
> Pra começar, qual o seu *nome completo*?

- Regra: obrigatório, texto até 190 caracteres.
- Retry: `Não consegui entender. Pode digitar seu nome completo?`

### 2) `planType`

- Prompt:

> Que tipo de plano você está buscando?
>
> 1️⃣ Individual
> 2️⃣ Familiar
> 3️⃣ Empresarial
> 4️⃣ MEI
> 5️⃣ Entidade / sindicato

- Aceita: número `1..5` ou texto equivalente (`individual`, `familiar`, `empresa/empresarial/pj`, `mei`, `entidade/sindicato/classe`).
- Retry (vazio): `Escolha um tipo de plano válido de 1 a 5 ou responda com o nome da opção.`
- Retry (inválido): `Responda com 1, 2, 3, 4 ou 5, ou informe o nome do tipo de plano desejado.`

### 3a) `ageRange` (Individual ou Entidade)

- Prompt: `Qual a sua idade?`
- Regra: aceita número inteiro (idade) e converte para faixa etária internamente.
- Também aceita faixa etária direta (ex: `24 a 33`) ou escolha numérica de 1 a 7.
- Retry: `Informe a sua faixa etária usando uma idade ou escolha uma das opções de 1 a 7.`

### 3b) `agesBundle` (Familiar, Empresarial ou MEI)

- Prompt: `Quantas pessoas e a idade de cada uma, separadas por vírgula? (ex: 35, 33, 8)`
- Regra:
  - Aceita lista de idades separadas por vírgula/espaço/ponto-e-vírgula.
  - Deduz automaticamente `beneficiaries` (quantidade), `rawAges` (idades brutas) e `ageRanges` (faixas).
  - Mínimo de 2 vidas para Familiar, Empresarial e MEI.
- Retry (formato): `Informe as idades separadas por vírgula. Ex: 35, 33, 8`
- Retry (mínimo): `Para plano {planType}, informe no mínimo 2 idades.`

### 4) `contractType`

- Prompt:

> Seu caso é:
>
> 1️⃣ Primeiro plano
> 2️⃣ Trocar de plano

- Aceita: `1/2` ou texto (`primeiro`, `novo`, `primeira vez` → Primeiro plano; `trocar`, `troca`, `migrar`, `portabilidade` → Trocar de plano).
- Retry: `Responda com 1 para Primeiro plano ou 2 para Trocar de plano.`

### 5) `currentPlan` (condicional)

- Aparece somente quando `contractType = Trocar de plano`.
- Prompt: `Qual operadora você tem hoje?`
- Regra: obrigatório, até 120 caracteres.
- Retry: `Preciso do campo "Plano atual" para continuar o cadastro.`

### 6) `operatorInterest`

- Prompt:

> Tem preferência por alguma operadora?
> Digite o nome ou responda *Sem preferência*.

- Aceita: texto livre, até 120 caracteres.
- Retry: `Digite o nome da operadora ou responda Sem preferência.`

### 7) `urgency`

- Prompt:

> Qual a urgência?
>
> 1️⃣ Baixa — estou pesquisando
> 2️⃣ Média — quero resolver este mês
> 3️⃣ Alta — preciso urgente

- Aceita: `1/2/3` ou texto contendo `baixa`, `média/media`, `alta`, `urgente`, `agora`, `rápido`, `calma`, `semana`, `breve`.
- Retry: `Responda com 1, 2 ou 3.`

### 8) `cityState`

- Prompt: `Quase lá! Em qual cidade e estado você mora? (ex: Curitiba - PR)`
- Regra: parser tenta separar cidade e UF. Aceita formatos como `Curitiba - PR`, `Curitiba/PR`, `Curitiba PR`, `Curitiba, Paraná`.
- Retry: `Informe sua cidade e estado. Ex: Curitiba - PR`

### 9) `cnpj` (condicional)

- Aparece quando `planType = Empresarial` ou `planType = MEI`.
- Prompt: `Qual o CNPJ?`
- Regra: 14 dígitos numéricos.
- Retry: `Informe um CNPJ com 14 dígitos para continuar o cadastro.`

### 10) `entityName` (condicional)

- Aparece quando `planType = Entidade de classe / sindicato`.
- Prompt: `Qual o nome da entidade ou sindicato?`
- Regra: obrigatório, até 190 caracteres.
- Retry: `Preciso do campo "Entidade ou sindicato" para continuar o cadastro.`

### Conclusão WhatsApp

> Pronto, *{nome}*! ✅
>
> 📋 Resumo do que anotei:
>
> • Plano: {planType}
> • Idade: {ageRange} *(ou)* • Idades: {rawAges}
> • Operadora: {operatorInterest}
> • Urgência: {urgency}
> • Cidade: {city} - {state}
>
> A equipe *Veraluz* vai entrar em contato com você por aqui em breve. Obrigada! 💚

---

## Fluxo detalhado — Instagram Direct

Máximo: 6 trocas de mensagem. Sem bold. Sem emojis numéricos. Tom direto e curto.

### Introdução + 1) `fullName`

- Mensagem enviada:

> Oi! Bem-vindo à Veraluz! 😊
>
> Vou te ajudar a encontrar o plano de saúde ideal. São perguntas rápidas!
>
> Qual o seu nome completo?

- Regra: obrigatório, até 190 caracteres.
- Retry: `Não consegui entender. Pode digitar seu nome completo?`

### 2) `planType`

- Prompt:

> Que tipo de plano você busca?
>
> 1 - Individual
> 2 - Familiar
> 3 - Empresarial
> 4 - MEI
> 5 - Entidade / sindicato

- Aceita: número `1..5` ou texto equivalente.
- Retry: `Escolha um tipo de plano válido de 1 a 5 ou responda com o nome da opção.`

### 3a) `ageRange` (Individual ou Entidade)

- Prompt: `Qual a sua idade?`
- Regras: idênticas ao WhatsApp.

### 3b) `agesBundle` (Familiar, Empresarial ou MEI)

- Prompt: `Quantas pessoas e a idade de cada uma? (ex: 35, 33, 8)`
- Regras: idênticas ao WhatsApp.

### 4) `urgency`

- Prompt:

> Qual a urgência?
>
> 1 - Baixa
> 2 - Média
> 3 - Alta

- Aceita: `1/2/3` ou texto.
- Retry: `Responda com 1, 2 ou 3.`

### 5) `phone`

- Prompt: `Me passa seu WhatsApp com DDD? (ex: 41999998888)`
- Regra: mínimo 10 dígitos (com DDD), normalizado.
- Condição: pulo se telefone já conhecido pelo contexto da conversa.
- Retry: `Não consegui entender o número. Pode enviar com DDD? Ex: 41999998888`

### 6) `cityState`

- Prompt: `Cidade e estado? (ex: Curitiba - PR)`
- Regras: idênticas ao WhatsApp.
- Retry: `Informe sua cidade e estado. Ex: Curitiba - PR`

### Conclusão Instagram

> Anotado, {nome}! ✅
>
> A equipe Veraluz vai te chamar no WhatsApp em breve.
>
> Obrigada! 💚

**Nota**: No Instagram a conclusão **não** inclui resumo dos dados coletados.

### Etapas removidas no Instagram

As seguintes etapas **não** são perguntadas no Instagram — o corretor coleta durante o atendimento via WhatsApp:

- `contractType` — primeiro plano ou trocar
- `currentPlan` — operadora atual
- `operatorInterest` — preferência de operadora
- `cnpj` — CNPJ empresarial/MEI
- `entityName` — nome da entidade/sindicato

**Motivo**: Instagram Direct é canal de descoberta; mensagens longas e muitas perguntas
geram alto abandono. O objetivo é capturar o lead rapidamente e migrar o atendimento para o WhatsApp.

---

## Fluxo detalhado — Facebook Messenger

Máximo: 7-10 trocas de mensagem. Sem bold. Tom intermediário e cordial.

### Introdução + 1) `fullName`

- Mensagem enviada:

> Olá! Bem-vindo à Veraluz! 😊
> Sou a assistente virtual e vou te ajudar a encontrar o plano de saúde ideal.
>
> Pra começar, qual o seu nome completo?

- Regra: obrigatório, até 190 caracteres.
- Retry: `Não consegui entender. Pode digitar seu nome completo?`

### 2) `planType`

- Prompt:

> Que tipo de plano você está buscando?
>
> 1 - Individual
> 2 - Familiar
> 3 - Empresarial
> 4 - MEI
> 5 - Entidade / sindicato

- Aceita: número `1..5` ou texto equivalente.
- Retry: `Escolha um tipo de plano válido de 1 a 5 ou responda com o nome da opção.`

### 3a) `ageRange` (Individual ou Entidade)

- Prompt: `Qual a sua idade?`
- Regras: idênticas ao WhatsApp.

### 3b) `agesBundle` (Familiar, Empresarial ou MEI)

- Prompt: `Quantas pessoas e a idade de cada uma, separadas por vírgula? (ex: 35, 33, 8)`
- Regras: idênticas ao WhatsApp.

### 4) `contractType`

- Prompt:

> Seu caso é:
>
> 1 - Primeiro plano
> 2 - Trocar de plano

- Aceita: `1/2` ou texto equivalente.
- Retry: `Responda com 1 para Primeiro plano ou 2 para Trocar de plano.`

### 5) `currentPlan` (condicional)

- Aparece somente quando `contractType = Trocar de plano`.
- Prompt: `Qual operadora você tem hoje?`
- Regra: obrigatório, até 120 caracteres.
- Retry: `Preciso do campo "Plano atual" para continuar o cadastro.`

### 6) `operatorInterest`

- Prompt:

> Tem preferência por alguma operadora?
> Digite o nome ou responda Sem preferência.

- Aceita: texto livre, até 120 caracteres.
- Retry: `Digite o nome da operadora ou responda Sem preferência.`

### 7) `urgency`

- Prompt:

> Qual a urgência?
>
> 1 - Baixa — estou pesquisando
> 2 - Média — quero resolver este mês
> 3 - Alta — preciso urgente

- Aceita: `1/2/3` ou texto.
- Retry: `Responda com 1, 2 ou 3.`

### 8) `phone`

- Prompt: `Me passa seu WhatsApp com DDD? (ex: 41999998888)`
- Regra: mínimo 10 dígitos (com DDD), normalizado.
- Condição: pulo se telefone já conhecido pelo contexto da conversa.
- Retry: `Não consegui entender o número. Pode enviar com DDD? Ex: 41999998888`

### 9) `cityState`

- Prompt: `Em qual cidade e estado você mora? (ex: Curitiba - PR)`
- Regras: idênticas ao WhatsApp.
- Retry: `Informe sua cidade e estado. Ex: Curitiba - PR`

### 10) `cnpj` (condicional)

- Aparece quando `planType = Empresarial` ou `planType = MEI`.
- Prompt: `Qual o CNPJ?`
- Regra: 14 dígitos numéricos.
- Retry: `Informe um CNPJ com 14 dígitos para continuar o cadastro.`

### 11) `entityName` (condicional)

- Aparece quando `planType = Entidade de classe / sindicato`.
- Prompt: `Qual o nome da entidade ou sindicato?`
- Regra: obrigatório, até 190 caracteres.
- Retry: `Preciso do campo "Entidade ou sindicato" para continuar o cadastro.`

### Conclusão Messenger

> Pronto, {nome}!
>
> Resumo:
> • Plano: {planType}
> • Idade: {ageRange} *(ou)* • Idades: {rawAges}
> • Operadora: {operatorInterest}
> • Urgência: {urgency}
> • Cidade: {city} - {state}
>
> A equipe Veraluz vai entrar em contato com você em breve, preferencialmente pelo WhatsApp informado. Obrigada! 💚

---

## Mensagens de inatividade por canal

### WhatsApp

- **Lembrete** (após 15 minutos):

> Oi{, *{nome}*}! Ainda estou por aqui 😊 Quando puder, me manda a próxima resposta pra gente continuar.

- **Encerramento** (após 60 minutos do lembrete):

> Tudo bem{, *{nome}*}! Vou encerrar por aqui, mas se quiser retomar é só mandar um oi que a gente continua de onde parou. 💚

### Instagram

- **Lembrete** (após 20 minutos):

> Oi! Ainda estou por aqui 😊 Quando puder, me responde pra gente continuar!

- **Encerramento** (após 120 minutos do lembrete):

> Sem problema! Se quiser retomar depois, é só mandar um oi aqui. 💚

### Messenger

- **Lembrete** (após 15 minutos):

> Oi{, {nome}}! Ainda estou por aqui. Quando puder, manda a próxima resposta pra gente continuar 😊

- **Encerramento** (após 90 minutos do lembrete):

> Tudo bem! Vou encerrar por aqui. Se quiser retomar, é só mandar uma mensagem que a gente continua de onde parou.

### Comportamento de encerramento (todos os canais)

Quando o timer de encerramento dispara:

1. Envia a mensagem de encerramento do respectivo canal.
2. Conversa muda para status `closed`.
3. Qualificação é resetada para `not_started`.
4. Limpa `step`, payload e datas da qualificação.

---

## Mensagens de retorno para leads existentes

Quando um contato que **já tem lead vinculado** envia uma nova mensagem, o bot responde
com uma saudação personalizada em vez de silenciar.

**Cooldown**: 30 minutos entre repetições, baseado no timestamp da última mensagem outbound
na conversa (evita spam se o lead enviar várias mensagens seguidas).

**Nota**: As mensagens de retorno **não** mencionam o nome do corretor — usam referência genérica
à "equipe Veraluz".

### WhatsApp

> Olá{, *{nome}*}! 😊 Que bom ter você de volta. Já identifiquei seu cadastro e a equipe *Veraluz* vai te responder por aqui em breve!

### Instagram

> Oi{, {nome}}! Já te encontrei aqui 😊 A equipe Veraluz vai te responder rapidinho!

### Messenger

> Olá{, {nome}}! Já localizei seu cadastro aqui. A equipe Veraluz vai continuar o atendimento em breve. Se preferir, também podemos te chamar pelo WhatsApp.

---

## Finalização e criação de lead

Quando não há mais etapas pendentes:

1. Monta payload do lead com respostas coletadas.
2. Atribui o lead via **round-robin** entre corretores ativos (ordenados pelo mais antigo assignment).
3. Cria lead (ou vincula duplicado quando houver conflito de dados por phone/email/CPF).
4. Vincula `lead_id` na conversa.
5. Marca qualificação como `completed`.
6. Envia mensagem de conclusão do respectivo canal (com resumo visual, exceto Instagram).
7. Envia push notification ao corretor atribuído.

### Campos enviados na criação do lead

**Sempre presentes**:

- `fullName` — nome completo
- `phone` — telefone (inferido no WhatsApp, perguntado nos demais)
- `city` e `state` — extraídos de `cityState`
- `planType` — tipo de plano
- `urgency` — nível de urgência
- `ageRange` — faixa etária (individual/entidade) ou principal (grupo, via `agesBundle.primaryAgeRange`)
- `ownerUserId` — corretor atribuído via round-robin

**Condicionais**:

- `beneficiaries` e `beneficiaryAgeRanges` — quando plano de grupo (deduzidos de `agesBundle`)
- `contractType` — quando perguntado (WhatsApp e Messenger)
- `currentPlan` — quando trocar de plano (WhatsApp e Messenger)
- `operatorInterest` — quando perguntado (WhatsApp e Messenger)
- `cnpj` — quando Empresarial ou MEI (WhatsApp e Messenger)
- `entityName` — quando Entidade/sindicato (WhatsApp e Messenger)

**Metadados**:

- `origin`: WhatsApp / Instagram / Facebook (conforme canal)
- `sourceCampaign`: `Zap Responder - {Canal}`
- `pipelineStage`: `Novo lead`
- `status`: `Novo lead`
- `temperature`: derivada da urgência (`Alta = Quente`, `Média = Morno`, `Baixa = Frio`)
- `hasWhatsapp`: `true` se canal é WhatsApp
- `hasCurrentPlan`: `true` se `contractType = Trocar de plano` ou se `currentPlan` foi preenchido
- `nextContactAt`: data/hora atual (retorno imediato)
- Tags automáticas: `urgente` (urgência Alta), `mei` (planType MEI), `familiar` (planType Familiar), `sindicato` (planType Entidade)
- `initialNotes`: nota automática com canal de origem e faixas etárias por vida

### Dados que o corretor coleta manualmente

Os seguintes campos foram **removidos do bot** para reduzir atrito e são preenchidos pelo corretor durante o atendimento humano:

| Campo | Motivo da remoção |
|-------|------------------|
| `email` | Gera desconfiança quando pedido por robô |
| `cpf` | Dado sensível; melhor coletar na conversa humana |
| `hasWhatsapp` | Redundante — se veio pelo WA, já tem; nos demais, pedimos o número |
| `coparticipation` | Decisão técnica que o corretor explica melhor |
| `coverage` | Depende de orientação do corretor |
| `currentPlanExpiry` | Detalhe que o corretor verifica com documento |
| `initialNotes` | Campo aberto que gera respostas vagas no bot |

---

## Observações de integridade de estado

- Se estado `pending` vier corrompido (respostas contendo texto de prompts do próprio bot), o fluxo é resetado para `not_started`.
- Existe deduplicação de inbound para evitar processar a mesma mensagem duas vezes (`lastInboundMessageToken`).
- Mensagens inbound com timestamp anterior ao `qualification_last_question_at` são ignoradas.
- Ao enviar mensagem automática, o bot tenta envio direto sem assumir como admin. Se falhar, faz fallback com `assumeConversationAsAdmin` + delay de ~2.2s antes de reenviar.
- IDs de plataforma (Instagram/Facebook) não são usados como telefone. Apenas `chatId` do WhatsApp (que é o próprio número) é aceito como fonte automática de telefone.

---

## Resumo operacional

O fluxo em produção segmenta a experiência por canal: **WhatsApp** (7-9 trocas, bold,
emojis numéricos, tom acolhedor), **Instagram Direct** (6 trocas, sem bold, tom direto e breve)
e **Facebook Messenger** (7-10 trocas, sem bold, tom intermediário). A filosofia central é que o
**bot é um qualificador rápido, não um formulário completo** — dados sensíveis e técnicos
(CPF, email, coparticipação, cobertura) ficam para o corretor.

Características operacionais:

- Consolidação de idades em uma única pergunta (CSV em vez de loop vida por vida)
- Interesse e urgência antes de dados pessoais
- Mensagens de retorno personalizadas para leads existentes com cooldown de 30 minutos
- Skip de seguidores no Instagram e Messenger
- Round-robin para atribuição automática de corretores
- Timers de inatividade por canal (até 140 min no Instagram)
- Operadora de interesse como texto livre (não mais lista numerada)
- Referências a "equipe" em vez de nome individual de atendente/consultor
- Push notification para corretor ao criar lead e ao receber retorno de lead existente
- Round-robin para atribuição automática de corretores
- Timers realistas por canal (até 140 min no Instagram vs. 5 min fixos na produção)
- Redução de ~21 etapas para 6-12 conforme o canal
