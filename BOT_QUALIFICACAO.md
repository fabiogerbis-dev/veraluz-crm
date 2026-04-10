# Bot de Atendimento Automatico Inicial (Qualificacao)

## Objetivo deste documento

Este arquivo descreve o fluxo **real em producao** do bot de qualificacao inicial de leads, sem suposicoes.
Fonte principal validada: `server/src/services/inboxService.js` da VPS de producao (espelho local: `.tmp/inboxService.vps.js`).

## Escopo tecnico atual

- Canais suportados para qualificacao: `whatsapp`, `instagram`, `messenger`.
- Status de qualificacao:
  - `not_started`
  - `pending`
  - `completed`
  - `ignored_known_contact`
- Temporizadores de inatividade:
  - lembrete: `2 minutos` apos a ultima pergunta enviada
  - encerramento: `3 minutos` apos o lembrete
  - varredura: a cada `15 segundos`
  - lote maximo por ciclo: `25 conversas`

## Condicoes para o bot rodar

O processamento da qualificacao acontece somente quando:

- a conversa **nao** tem `lead_id`
- o contato **nao** foi marcado como conhecido (`knownContact = false`)
- o canal e suportado (`whatsapp|instagram|messenger`)
- a mensagem e `inbound`
- a mensagem e persistivel (`body`, `media`, `externalMessageId` ou tipo nao-texto)

Se o contato vier como conhecido, a conversa e marcada como `ignored_known_contact` e o bot nao pergunta nada.

## Mensagens fixas em producao

### Introducao (antes da primeira pergunta)

> Seja bem-vindo à Veraluz, especialista em planos de saúde há 23 anos. Antes que nosso consultor prepare sua cotação personalizada, por gentileza, responda a algumas perguntas importantes.

### Lembrete de inatividade

> Quando puder, me envie a próxima resposta para continuarmos seu cadastro.

### Encerramento por inatividade

> Como não houve resposta, encerrei este cadastro por agora. Se quiser continuar, é só me mandar uma nova mensagem.

### Conclusao de cadastro

> Cadastro concluído. Nosso time vai continuar seu atendimento por aqui em seguida.

## Fluxo completo de perguntas (ordem real)

Observacao importante:

- `phone` e `hasWhatsapp` podem vir preenchidos automaticamente.
- se o canal for WhatsApp, `hasWhatsapp = true` ja entra no estado inicial.
- perguntas com `isActive: false` existem no codigo, mas **nao entram no fluxo atual**.

### 1) `fullName`

- Prompt: `Qual é o seu nome completo?`
- Regra: obrigatorio, texto ate 190 caracteres.
- Retry:
  - `Preciso do campo "Nome completo" para continuar o cadastro.`

### 2) `phone` (condicional)

- Prompt: `Qual é o seu telefone / WhatsApp com DDD?`
- Aparece quando `answers.phone` ainda nao existe e nao foi inferido no contexto.
- Regra: minimo 10 digitos (com DDD), normalizado.
- Retry:
  - `Informe um telefone com DDD para continuar.`

### 3) `hasWhatsapp` (condicional)

- Prompt:
  - `Esse telefone possui WhatsApp?`
  - `1. Sim`
  - `2. Não`
- Aparece somente quando o canal **nao** e `whatsapp`.
- Aceita:
  - `1/2`
  - tokens de sim: `sim`, `s`, `yes`, `tenho`, `possuo`, `quero`, `ativo`
  - tokens de nao: `nao`, `não`, `n`, `no`, `nao tenho`, `não tenho`, `sem`, `inativo`
- Retry:
  - `Responda com 1 para sim ou 2 para não em "Telefone com WhatsApp".`

### 4) `email`

- Prompt: `Qual é o seu e-mail?`
- Regra: formato valido (`x@y.z`).
- Retry:
  - `Informe um e-mail válido para continuar o cadastro.`

### 5) `cpf`

- Prompt: `Qual é o seu CPF?`
- Regra: 11 digitos.
- Retry:
  - `Informe um CPF com 11 dígitos para continuar o cadastro.`

### 6) `city`

- Prompt: `Em qual cidade você mora?`
- Regra: obrigatorio, ate 120 caracteres.
- Retry:
  - `Preciso do campo "Cidade" para continuar o cadastro.`

### 7) `state`

- Prompt: `Qual é o seu estado? Ex: SP, RJ, MG.`
- Regra:
  - aceita UF com 2 letras
  - aceita nome de estado e converte para UF quando mapeado
  - se nao mapear, salva texto (cortado em 60)
- Retry:
  - `Informe o seu estado para continuar o cadastro.`

### 8) `planType`

- Prompt:
  - `Qual tipo de plano você procura?`
  - `1. Individual`
  - `2. Familiar`
  - `3. Empresarial`
  - `4. MEI`
  - `5. Entidade de classe / sindicato`
- Aceita:
  - numero `1..5`
  - texto equivalente (`individual`, `familiar/familia`, `empresa/empresarial/pj`, `mei`, `entidade/sindicato/classe`)
- Retry (vazio):
  - `Escolha um tipo de plano válido de 1 a 5 ou responda com o nome da opção.`
- Retry (invalido):
  - `Responda com 1, 2, 3, 4 ou 5, ou informe o nome do tipo de plano desejado.`

### 9) `ageRange` (condicional)

- Prompt dinamico:
  - `Qual é a sua faixa etária? Você pode responder com uma idade ou escolher uma opção:`
  - `1) 0 a 18`
  - `2) 19 a 23`
  - `3) 24 a 33`
  - `4) 34 a 43`
  - `5) 44 a 53`
  - `6) 54 a 58`
  - `7) 59+`
- Aparece quando:
  - `planType = Individual`, ou
  - plano nao-individual com `beneficiaries` respondido e **sem** necessidade de coletar faixa por vida.
- Regra:
  - aceita `1..7`
  - aceita texto da faixa
  - aceita idade numerica e converte para faixa
- Retry:
  - `Informe a sua faixa etária usando uma idade ou escolha uma das opções de 1 a 7.`

### 10) `beneficiaries` (condicional)

- Prompt dinamico:
  - padrao: `Quantas vidas deseja incluir no plano?`
  - com minimo (Familiar, Empresarial, MEI):
    - `Quantas vidas deseja incluir no plano? Para {planType em minusculo} informe no mínimo 2 vidas.`
- Aparece quando `planType != Individual`.
- Regra:
  - inteiro positivo
  - para `Familiar/Empresarial/MEI`: minimo 2
- Retry:
  - `Informe um número válido para "Quantidade de vidas".`
  - `Para plano {planType em minusculo}, informe no mínimo 2 vidas.`

### 11) `beneficiaryAgeRanges` (condicional com loop)

- Prompt dinamico por iteracao:
  - primeira vez:
    - `Agora preciso registrar a faixa etária de cada vida incluída no plano.`
    - `Qual é a faixa etária da vida 1 de {N}? Você pode responder com uma idade ou escolher uma opção:`
    - lista `1..7` igual a `ageRange`
  - proximas iteracoes:
    - `Qual é a faixa etária da vida {i} de {N}? Você pode responder com uma idade ou escolher uma opção:`
    - lista `1..7`
- Aparece quando:
  - `planType` exige minimo de 2 vidas (`Familiar`, `Empresarial`, `MEI`)
  - e `beneficiaries > 1`
- Regra:
  - mesma validacao de `ageRange`
  - acumula no array ate atingir a quantidade de vidas
- Retry:
  - `Informe a sua faixa etária usando uma idade ou escolha uma das opções de 1 a 7.`

### 12) `contractType`

- Prompt:
  - `O seu caso é:`
  - `1. Primeiro plano`
  - `2. Trocar de plano`
- Aceita:
  - `1/2`
  - texto: `primeiro`, `novo`, `primeira vez` => Primeiro plano
  - texto: `trocar`, `renov`, `troca`, `migr`, `portabilidade` => Trocar de plano
- Retry:
  - `Responda com 1 para Primeiro plano ou 2 para Trocar de plano.`

### 13) `currentPlan` (condicional)

- Prompt: `Qual plano possui atualmente? Digite o nome da operadora.`
- Aparece somente quando `contractType = Trocar de plano`.
- Regra: obrigatorio, ate 120 caracteres.
- Retry:
  - `Preciso do campo "Plano atual" para continuar o cadastro.`

### 14) `currentPlanExpiry` (condicional)

- Prompt: `Qual é o vencimento do plano atual? Envie em DD/MM/AAAA, YYYY-MM-DD ou MM/AAAA.`
- Aparece somente quando `contractType = Trocar de plano`.
- Regra:
  - aceita `YYYY-MM-DD`
  - aceita `DD/MM/AAAA` (normaliza para ISO)
  - aceita `MM/AAAA` (normaliza para dia `01`)
- Retry:
  - `Informe a data em DD/MM/AAAA, YYYY-MM-DD ou MM/AAAA.`

### 15) `operatorInterest`

- Prompt dinamico:
  - `Qual operadora você prefere?`
  - seguido de lista numerada.
- Fonte da lista:
  - setting `operatorInterests` (quando valido), senao lista padrao:
    - Bradesco Saúde
    - Unimed
    - Amil
    - SulAmérica
    - Humana Saúde
    - Notre Dame Intermédica
    - Paraná Clínicas
    - MedSenior
    - Select
    - MedSul
    - Dentaluni
    - Odontoprev
    - Sem preferência
- Regra:
  - aceita numero valido da lista
  - aceita correspondencia por nome (exata, parcial, bidirecional)
- Retry:
  - `Responda com um número de 1 a {N} ou informe o nome da operadora desejada.`

### 16) `coparticipation`

- Prompt:
  - `Você prefere:`
  - `1. Com coparticipação`
  - `2. Sem coparticipação`
- Aceita:
  - `1/2`
  - texto contendo `com` ou `sem`
- Retry:
  - `Responda com 1 para Com coparticipação ou 2 para Sem coparticipação.`

### 17) `coverage`

- Prompt:
  - `A cobertura desejada é:`
  - `1. Regional`
  - `2. Nacional`
- Aceita:
  - `1/2`
  - texto contendo `regional` ou `nacional`
- Retry:
  - `Responda com 1 para Regional ou 2 para Nacional.`

### 18) `urgency`

- Prompt:
  - `Qual é a urgência?`
  - `1. Baixa`
  - `2. Média`
  - `3. Alta`
- Aceita:
  - `1/2/3`
  - texto contendo `baixa`, `media`, `alta`, `urgente`
- Retry:
  - `Responda com 1 para Baixa, 2 para Média ou 3 para Alta.`

### 19) `companyName` (inativa no fluxo atual)

- Prompt: `Qual é o nome da empresa ou do MEI?`
- `isActive: false` (nao aparece para o lead no estado atual de producao).

### 20) `cnpj` (condicional)

- Prompt: `Qual é o CNPJ?`
- Aparece quando `planType = Empresarial` ou `planType = MEI`.
- Regra: 14 digitos.
- Retry:
  - `Informe um CNPJ com 14 dígitos para continuar o cadastro.`

### 21) `entityName` (condicional)

- Prompt: `Qual é o nome da entidade, associação ou sindicato?`
- Aparece quando `planType = Entidade de classe / sindicato`.
- Regra: obrigatorio, ate 190 caracteres.
- Retry:
  - `Preciso do campo "Entidade ou sindicato" para continuar o cadastro.`

### 22) `hasActiveCnpj` (inativa no fluxo atual)

- Prompt:
  - `A empresa possui CNPJ ativo?`
  - `1. Sim`
  - `2. Não`
- `isActive: false` (nao aparece para o lead no estado atual de producao).

### 23) `hasActiveMei` (inativa no fluxo atual)

- Prompt:
  - `Você possui MEI ativo?`
  - `1. Sim`
  - `2. Não`
- `isActive: false` (nao aparece para o lead no estado atual de producao).

### 24) `initialNotes`

- Prompt:
  - `Existe alguma observação inicial importante sobre a sua necessidade? Se não houver, responda "Nenhuma".`
- Regra: obrigatorio, ate 1200 caracteres.
- Retry:
  - `Preciso do campo "Observação inicial" para continuar o cadastro.`

## Comportamento de inatividade

Quando a conversa esta `pending`:

1. Se ficou sem resposta por 2 minutos desde a ultima pergunta enviada:
   - envia lembrete de continuidade
   - grava `inactivityReminderSentAt`
2. Se, apos o lembrete, passar mais 3 minutos sem resposta:
   - envia mensagem de encerramento
   - conversa vira `closed`
   - qualificacao e resetada para `not_started`
   - limpa `step`, payload e datas da qualificacao

## Finalizacao e criacao de lead

Quando nao ha mais etapas pendentes:

- monta payload do lead com respostas coletadas
- cria lead (ou vincula duplicado quando houver conflito)
- vincula `lead_id` na conversa
- marca qualificacao como `completed`
- envia mensagem final de conclusao

Campos relevantes enviados na criacao:

- dados pessoais: nome, telefone, email, CPF, cidade, estado
- dados do plano: tipo, contrato, operadora, coparticipacao, cobertura, urgencia
- vidas/faixas: `beneficiaries`, `ageRange`, `beneficiaryAgeRanges`
- campos condicionais: `cnpj`, `entityName`, `currentPlan`, `currentPlanExpiry`
- origem:
  - `origin`: WhatsApp / Instagram / Facebook (conforme canal)
  - `sourceCampaign`: `Zap Responder - {Canal}`
- metadados:
  - `pipelineStage`: `Novo lead`
  - `status`: `Novo lead`
  - `temperature`: derivada da urgencia (`Alta=Quente`, `Média=Morno`, `Baixa=Frio`)
  - tags automaticas (`urgente`, `mei`, `familiar`, `sindicato` quando aplicavel)

## Observacoes de integridade de estado

- Se estado `pending` vier corrompido (respostas contendo texto de prompts do proprio bot), o fluxo e resetado para `not_started`.
- Existe deduplicacao de inbound para evitar processar a mesma mensagem duas vezes (`lastInboundMessageToken`).

## Resumo executivo

O fluxo em producao hoje e um roteiro unico (nao segmentado por canal) com 24 chaves no array, sendo 3 chaves inativas (`companyName`, `hasActiveCnpj`, `hasActiveMei`). A qualificacao so roda para novos contatos nao conhecidos, inicia com mensagem de boas-vindas fixa, percorre etapas condicionais conforme `planType/contractType`, finaliza com criacao/vinculo de lead e possui politica de inatividade com lembrete e encerramento automatico.
