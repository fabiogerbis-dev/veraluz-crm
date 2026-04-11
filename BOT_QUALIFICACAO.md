# Bot de Atendimento Automático — Qualificação por Canal

## Objetivo deste documento

Este arquivo especifica o **novo fluxo profissional** do bot de qualificação inicial de leads,
segmentado por canal (WhatsApp, Instagram Direct, Facebook Messenger).

Referência de produção anterior: commit `1755b75` (10/abr/2026) — roteiro único para todos os canais.
Este documento substitui o fluxo antigo e serve como especificação para implementação.

---

## Princípios de design

1. **Valor primeiro, dados depois** — qualificar interesse e urgência antes de pedir dados pessoais.
2. **Menos é mais** — Instagram máx. 6-7 trocas; WhatsApp máx. 10-12; Messenger intermediário.
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
Cooldown de 30 minutos entre repetições.

---

## Arquitetura de fases

O fluxo é dividido em 4 fases, com etapas condicionais por canal:

```
FASE 1 — Rapport + Interesse
  fullName          → Introdução + nome (todas)
  planType          → Tipo de plano (todas)
  agesBundle        → Idade individual OU idades CSV (todas)
  contractType      → Primeiro plano ou troca (WhatsApp e Messenger)

FASE 2 — Qualificação comercial
  currentPlan       → Operadora atual, se trocar (WhatsApp e Messenger)
  operatorInterest  → Preferência de operadora (WhatsApp e Messenger)
  urgency           → Nível de urgência (todas)

FASE 3 — Dados de contato
  phone             → WhatsApp com DDD (Instagram e Messenger)
  cityState         → Cidade e estado consolidados (todas)

FASE 4 — Dados complementares
  cnpj              → Se Empresarial ou MEI (WhatsApp e Messenger)
  entityName        → Se Entidade/sindicato (WhatsApp e Messenger)
```

### Resumo de etapas por canal

| Canal | Etapas mín. | Etapas máx. | Etapas removidas do bot |
|-------|------------|------------|------------------------|
| WhatsApp | 7 | 12 | email, cpf, hasWhatsapp, coparticipação, cobertura, initialNotes |
| Instagram | 6 | 6 | contractType, currentPlan, operatorInterest, cnpj, entityName + todos acima |
| Messenger | 7 | 9 | email, cpf, hasWhatsapp, coparticipação, cobertura, initialNotes |

---

## Fluxo detalhado — WhatsApp

Máximo: 10-12 trocas de mensagem. Bold habilitado. Emojis numéricos.

### Introdução + 1) `fullName`

- Mensagem enviada (introdução + pergunta na mesma bolha):

> Olá! 😊 Bem-vindo à *Veraluz*!
> Sou a assistente virtual e vou te ajudar a encontrar o plano de saúde ideal.
>
> São poucas perguntas rápidas e logo um consultor entra em contato com você aqui mesmo pelo WhatsApp.
>
> Pra começar, qual o seu *nome completo*?

- Regra: obrigatório, texto até 190 caracteres.
- Retry: `Não consegui entender. Pode digitar seu nome completo?`

### 2) `planType`

- Prompt:

> Prazer, *{nome}*! Que tipo de plano você está buscando?
> 1️⃣ Individual
> 2️⃣ Familiar
> 3️⃣ Empresarial
> 4️⃣ MEI
> 5️⃣ Entidade / sindicato

- Aceita: número `1..5` ou texto equivalente (`individual`, `familiar`, `empresa/empresarial/pj`, `mei`, `entidade/sindicato/classe`).
- Retry (vazio): `Escolha um tipo de plano válido de 1 a 5 ou responda com o nome da opção.`
- Retry (inválido): `Responda com 1, 2, 3, 4 ou 5, ou informe o nome do tipo de plano desejado.`

### 3) `agesBundle`

- Prompt dinâmico conforme `planType`:
  - **Individual ou Entidade**: `Qual a sua idade?`
  - **Familiar, Empresarial ou MEI**: `Quantas pessoas e a idade de cada uma? (ex: 35, 33, 8)`
- Regra:
  - Individual/Entidade: aceita número inteiro (idade) e converte para faixa etária internamente.
  - Grupo: aceita lista de idades separadas por vírgula. Deduz automaticamente `beneficiaries` (quantidade) e `beneficiaryAgeRanges` (faixas).
  - Mínimo de 2 vidas para Familiar, Empresarial e MEI.
- Retry (individual): `Informe a sua idade com um número. Ex: 35`
- Retry (grupo — formato): `Informe as idades separadas por vírgula. Ex: 35, 33, 8`
- Retry (grupo — mínimo): `Para plano {planType}, informe no mínimo 2 idades.`

### 4) `contractType`

- Prompt:

> Seu caso é:
> 1️⃣ Primeiro plano
> 2️⃣ Trocar de plano

- Aceita: `1/2` ou texto (`primeiro`, `novo`, `primeira vez` → Primeiro plano; `trocar`, `troca`, `migrar`, `portabilidade` → Trocar de plano).
- Retry: `Responda com 1 para Primeiro plano ou 2 para Trocar de plano.`

### 5) `currentPlan` (condicional)

- Aparece somente quando `contractType = Trocar de plano`.
- Prompt: `Qual operadora você tem hoje?`
- Regra: obrigatório, até 120 caracteres.
- Retry: `Preciso saber qual operadora você tem hoje para continuar.`

### 6) `operatorInterest`

- Prompt:

> Tem preferência por alguma operadora?
> 1️⃣ Bradesco Saúde
> 2️⃣ Unimed
> 3️⃣ Amil
> …
> {N}️⃣ Sem preferência

- Fonte da lista: configuração `operatorInterests` do sistema, ou lista padrão.
- Aceita: número válido da lista ou correspondência por nome (exata, parcial, bidirecional).
- Retry: `Responda com um número de 1 a {N} ou informe o nome da operadora desejada.`

### 7) `urgency`

- Prompt:

> Qual a urgência?
> 1️⃣ Baixa — estou pesquisando
> 2️⃣ Média — quero resolver este mês
> 3️⃣ Alta — preciso urgente

- Aceita: `1/2/3` ou texto contendo `baixa`, `média`, `alta`, `urgente`.
- Retry: `Responda com 1 para Baixa, 2 para Média ou 3 para Alta.`

### 8) `cityState`

- Prompt: `Quase lá! Em qual cidade e estado você mora? (ex: Curitiba - PR)`
- Regra: parser tenta separar cidade e UF. Aceita formatos como `Curitiba - PR`, `Curitiba/PR`, `Curitiba PR`, `Curitiba, Paraná`.
- Retry: `Informe sua cidade e estado. Ex: Curitiba - PR`

### 9) `cnpj` (condicional)

- Aparece quando `planType = Empresarial` ou `planType = MEI`.
- Prompt: `Qual o CNPJ?`
- Regra: 14 dígitos numéricos.
- Retry: `Informe um CNPJ com 14 dígitos para continuar.`

### 10) `entityName` (condicional)

- Aparece quando `planType = Entidade de classe / sindicato`.
- Prompt: `Qual o nome da entidade ou sindicato?`
- Regra: obrigatório, até 190 caracteres.
- Retry: `Preciso do nome da entidade ou sindicato para continuar.`

### Conclusão WhatsApp

> Pronto, *{nome}*! ✅
>
> 📋 Resumo do que anotei:
>
> • Plano: {planType}
> • Idade(s): {idades}
> • Operadora preferida: {operatorInterest}
> • Urgência: {urgency}
> • Cidade: {cityState}
>
> Um consultor *Veraluz* vai entrar em contato com você por aqui em breve. Obrigada! 💚

---

## Fluxo detalhado — Instagram Direct

Máximo: 6-7 trocas de mensagem. Sem bold. Sem emojis numéricos. Tom direto e curto.

### Introdução + 1) `fullName`

- Mensagem enviada:

> Oi! Bem-vindo à Veraluz! 😊
>
> Vou te ajudar a encontrar o plano de saúde ideal. São perguntas rápidas!
>
> Qual o seu nome completo?

- Regra: obrigatório, até 190 caracteres.
- Retry: `Não consegui entender. Pode digitar seu nome?`

### 2) `planType`

- Prompt:

> Que tipo de plano você busca?
> 1 - Individual
> 2 - Familiar
> 3 - Empresarial
> 4 - MEI
> 5 - Entidade / sindicato

- Aceita: número `1..5` ou texto equivalente.
- Retry: `Responda com um número de 1 a 5.`

### 3) `agesBundle`

- Prompt dinâmico:
  - **Individual ou Entidade**: `Qual a sua idade?`
  - **Grupo**: `Quantas pessoas e a idade de cada uma? (ex: 35, 33, 8)`
- Regras: idênticas ao WhatsApp.
- Retry (individual): `Informe a sua idade com um número. Ex: 35`
- Retry (grupo): `Informe as idades separadas por vírgula. Ex: 35, 33, 8`

### 4) `urgency`

- Prompt:

> Qual a urgência?
> 1 - Baixa
> 2 - Média
> 3 - Alta

- Aceita: `1/2/3` ou texto.
- Retry: `Responda com 1 para Baixa, 2 para Média ou 3 para Alta.`

### 5) `phone`

- Prompt: `Me passa seu WhatsApp com DDD? (ex: 41999998888)`
- Regra: mínimo 10 dígitos (com DDD), normalizado.
- Retry: `Não consegui entender o número. Pode enviar com DDD? Ex: 41999998888`

### 6) `cityState`

- Prompt: `Cidade e estado? (ex: Curitiba - PR)`
- Regras: idênticas ao WhatsApp.
- Retry: `Informe sua cidade e estado. Ex: Curitiba - PR`

### Conclusão Instagram

> Anotado, {nome}! ✅
> Um consultor Veraluz vai te chamar no WhatsApp em breve.
> Obrigada! 💚

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

Máximo: 8-9 trocas de mensagem. Sem bold. Tom intermediário e cordial.

### Introdução + 1) `fullName`

- Mensagem enviada:

> Olá! Bem-vindo à Veraluz! 😊
> Sou a assistente virtual e vou te ajudar a encontrar o plano de saúde ideal.
>
> Qual o seu nome completo?

- Regra: obrigatório, até 190 caracteres.
- Retry: `Não consegui entender. Pode digitar seu nome completo?`

### 2) `planType`

- Prompt:

> Prazer, {nome}! Que tipo de plano você busca?
> 1 - Individual
> 2 - Familiar
> 3 - Empresarial
> 4 - MEI
> 5 - Entidade / sindicato

- Aceita: número `1..5` ou texto equivalente.
- Retry: `Escolha um tipo de plano válido de 1 a 5 ou responda com o nome da opção.`

### 3) `agesBundle`

- Prompt dinâmico (sem bold):
  - **Individual ou Entidade**: `Qual a sua idade?`
  - **Grupo**: `Quantas pessoas e a idade de cada uma? (ex: 35, 33, 8)`
- Regras: idênticas ao WhatsApp.

### 4) `contractType`

- Prompt:

> Seu caso é:
> 1 - Primeiro plano
> 2 - Trocar de plano

- Aceita: `1/2` ou texto equivalente.
- Retry: `Responda com 1 para Primeiro plano ou 2 para Trocar de plano.`

### 5) `currentPlan` (condicional)

- Aparece somente quando `contractType = Trocar de plano`.
- Prompt: `Qual operadora você tem hoje?`
- Regra: obrigatório, até 120 caracteres.
- Retry: `Preciso saber qual operadora você tem hoje para continuar.`

### 6) `operatorInterest`

- Prompt:

> Tem preferência por alguma operadora?
> 1 - Bradesco Saúde
> 2 - Unimed
> …
> {N} - Sem preferência

- Regras: idênticas ao WhatsApp.

### 7) `urgency`

- Prompt:

> Qual a urgência?
> 1 - Baixa
> 2 - Média
> 3 - Alta

- Aceita: `1/2/3` ou texto.
- Retry: `Responda com 1 para Baixa, 2 para Média ou 3 para Alta.`

### 8) `phone`

- Prompt: `Me passa seu WhatsApp com DDD? (ex: 41999998888)`
- Regra: mínimo 10 dígitos (com DDD), normalizado.
- Retry: `Não consegui entender o número. Pode enviar com DDD? Ex: 41999998888`

### 9) `cityState`

- Prompt: `Em qual cidade e estado você mora? (ex: Curitiba - PR)`
- Regras: idênticas ao WhatsApp.
- Retry: `Informe sua cidade e estado. Ex: Curitiba - PR`

### Conclusão Messenger

> Pronto, {nome}!
>
> Resumo:
> • Plano: {planType}
> • Idade(s): {idades}
> • Urgência: {urgency}
>
> Um consultor Veraluz vai entrar em contato em breve, preferencialmente pelo WhatsApp informado. Obrigada! 💚

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

**Cooldown**: 30 minutos entre repetições (evita spam se o lead enviar várias mensagens seguidas).

### WhatsApp

- **Com corretor atribuído**:

> Olá{, *{nome}*}! 😊 Que bom ter você de volta. Já identifiquei seu cadastro e estou avisando seu consultor *{corretor}*. Ele vai te responder por aqui em breve!

- **Sem corretor**:

> Olá{, *{nome}*}! 😊 Que bom ter você de volta. Já identifiquei seu cadastro e estou encaminhando para um de nossos consultores. Ele vai te responder por aqui em breve!

### Instagram

> Oi{, {nome}}! Já te encontrei aqui 😊 Vou avisar seu consultor e ele te responde rapidinho!

### Messenger

- **Com corretor**:

> Olá{, {nome}}! Já localizei seu cadastro aqui. Seu consultor {corretor} vai continuar o atendimento em breve. Se preferir, ele também pode te chamar pelo WhatsApp.

- **Sem corretor**:

> Olá{, {nome}}! Já localizei seu cadastro aqui. Um de nossos consultores vai continuar o atendimento em breve.

---

## Finalização e criação de lead

Quando não há mais etapas pendentes:

1. Monta payload do lead com respostas coletadas.
2. Atribui o lead via **round-robin** entre corretores ativos (não mais `ownerUserId: null`).
3. Cria lead (ou vincula duplicado quando houver conflito de dados).
4. Vincula `lead_id` na conversa.
5. Marca qualificação como `completed`.
6. Envia mensagem de conclusão do respectivo canal (com resumo visual).

### Campos enviados na criação do lead

**Sempre presentes**:

- `fullName` — nome completo
- `phone` — telefone (inferido no WhatsApp, perguntado nos demais)
- `city` e `state` — extraídos de `cityState`
- `planType` — tipo de plano
- `urgency` — nível de urgência
- `ageRange` — faixa etária (individual) ou principal
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
- Tags automáticas: `urgente`, `mei`, `familiar`, `sindicato` (quando aplicável)

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

---

## Tabela comparativa: produção atual vs. novo fluxo

| Aspecto | Produção (commit `1755b75`) | Novo fluxo |
|---------|---------------------------|------------|
| Etapas WhatsApp | ~21 ativas | 7-12 |
| Etapas Instagram | ~21 ativas (iguais ao WA) | 6 |
| Etapas Messenger | ~21 ativas (iguais ao WA) | 7-9 |
| Mensagens | Genéricas para todos os canais | Por canal, tom nativo |
| Timers | 2 min + 3 min (todos) | WA: 15+60 min / IG: 20+120 min / FB: 15+90 min |
| Coleta de dados | CPF, email, coparticipação, cobertura no bot | Removidos — corretor coleta |
| Vidas/idades | beneficiaries + loop vida por vida | 1 pergunta CSV |
| Known contact IG/FB | Qualifica igual a WA | Skip followers |
| Retorno de lead | Silêncio | Mensagem personalizada com cooldown |
| Auto-assignment | `ownerUserId: null` | Round-robin entre corretores ativos |

---

## Resumo executivo

O novo fluxo profissional segmenta a experiência por canal: **WhatsApp** (10-12 trocas, bold,
emojis numéricos, tom acolhedor), **Instagram Direct** (6 trocas, sem bold, tom direto e breve)
e **Facebook Messenger** (8-9 trocas, sem bold, tom intermediário). A filosofia central é que o
**bot é um qualificador rápido, não um formulário completo** — dados sensíveis e técnicos
(CPF, email, coparticipação, cobertura) ficam para o corretor.

Principais ganhos em relação à produção atual:

- Consolidação de idades em uma única pergunta (CSV em vez de loop vida por vida)
- Inversão da ordem (interesse antes de dados pessoais)
- Mensagens de retorno personalizadas para leads existentes com cooldown de 30 minutos
- Skip de seguidores no Instagram e Messenger
- Round-robin para atribuição automática de corretores
- Timers realistas por canal (até 140 min no Instagram vs. 5 min fixos na produção)
- Redução de ~21 etapas para 6-12 conforme o canal
