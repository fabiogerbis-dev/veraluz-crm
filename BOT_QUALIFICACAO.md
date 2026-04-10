# Bot de Atendimento Automático Inicial — Veraluz CRM

## Visão Geral

O bot de qualificação automática é acionado quando um **novo contato** envia a primeira mensagem por **WhatsApp**, **Instagram** ou **Facebook Messenger** via ZapResponder. Ele conduz uma conversa estruturada para coletar dados do lead e, ao final, cria automaticamente o registro no CRM.

**Arquivo-fonte:** `server/src/services/inboxService.js`

---

## Condições de Ativação

O bot inicia quando **TODAS** as condições são verdadeiras:

| Condição | Descrição |
|---|---|
| `conversation.lead_id` é `NULL` | A conversa ainda não tem lead vinculado |
| `knownContact` é `false` | O contato **não** está salvo/é seguidor no canal |
| Canal é suportado | `whatsapp`, `instagram` ou `messenger` |
| Direção é `inbound` | Mensagem recebida do cliente |
| Mensagem é persistível | Possui corpo de texto, mídia ou ID externo |

Se qualquer condição falha, a qualificação é ignorada.

---

## Mensagem de Boas-Vindas (Introdução)

Quando o bot inicia (`status = NOT_STARTED`), a **primeira pergunta** é precedida por:

> *"Seja bem-vindo à Veraluz, especialista em planos de saúde há 23 anos. Antes que nosso consultor prepare sua cotação personalizada, por gentileza, responda a algumas perguntas importantes."*

---

## Fluxo Completo de Perguntas

O fluxo é **sequencial** — cada pergunta só aparece após a anterior ser respondida corretamente. Algumas perguntas são **condicionais** (aparecem apenas em certos cenários).

### Etapa 1 — Nome Completo
| Campo | Valor |
|---|---|
| **Chave** | `fullName` |
| **Pergunta** | "Qual é o seu nome completo?" |
| **Condição** | Sempre ativa |
| **Validação** | Texto obrigatório (máx. 190 caracteres) |
| **Erro** | "Preciso do campo \"Nome completo\" para continuar o cadastro." |

### Etapa 2 — Telefone / WhatsApp
| Campo | Valor |
|---|---|
| **Chave** | `phone` |
| **Pergunta** | "Qual é o seu telefone / WhatsApp com DDD?" |
| **Condição** | Só aparece se o telefone **não** foi detectado automaticamente (ex: já extraído do chatId ou do contato) |
| **Validação** | Mínimo 10 dígitos (com DDD) |
| **Erro** | "Informe um telefone com DDD para continuar." |

### Etapa 3 — Possui WhatsApp?
| Campo | Valor |
|---|---|
| **Chave** | `hasWhatsapp` |
| **Pergunta** | "Esse telefone possui WhatsApp?\n1. Sim\n2. Não" |
| **Condição** | Só aparece se o canal **NÃO** é WhatsApp (ex: Instagram, Messenger) |
| **Opções** | `1` = Sim · `2` = Não · Aceita: sim, s, yes, tenho, quero / não, n, nao, no, sem |
| **Erro** | "Responda com 1 para sim ou 2 para não em \"Telefone com WhatsApp\"." |

### Etapa 4 — E-mail
| Campo | Valor |
|---|---|
| **Chave** | `email` |
| **Pergunta** | "Qual é o seu e-mail?" |
| **Condição** | Sempre ativa |
| **Validação** | Formato de e-mail válido (`x@x.x`) |
| **Erro** | "Informe um e-mail válido para continuar o cadastro." |

### Etapa 5 — CPF
| Campo | Valor |
|---|---|
| **Chave** | `cpf` |
| **Pergunta** | "Qual é o seu CPF?" |
| **Condição** | Sempre ativa |
| **Validação** | Exatamente 11 dígitos |
| **Erro** | "Informe um CPF com 11 dígitos para continuar o cadastro." |

### Etapa 6 — Cidade
| Campo | Valor |
|---|---|
| **Chave** | `city` |
| **Pergunta** | "Em qual cidade você mora?" |
| **Condição** | Sempre ativa |
| **Validação** | Texto obrigatório (máx. 120 caracteres) |
| **Erro** | "Preciso do campo \"Cidade\" para continuar o cadastro." |

### Etapa 7 — Estado (UF)
| Campo | Valor |
|---|---|
| **Chave** | `state` |
| **Pergunta** | "Qual é o seu estado? Ex: SP, RJ, MG." |
| **Condição** | Sempre ativa |
| **Validação** | Aceita sigla de 2 letras ou nome completo do estado (converte automaticamente para UF) |
| **Erro** | "Informe o seu estado para continuar o cadastro." |

### Etapa 8 — Tipo de Plano ⭐ (Ramificação Principal)
| Campo | Valor |
|---|---|
| **Chave** | `planType` |
| **Pergunta** | "Qual tipo de plano você procura?\n1. Individual\n2. Familiar\n3. Empresarial\n4. MEI\n5. Entidade de classe / sindicato" |
| **Condição** | Sempre ativa |
| **Opções** | Aceita número (1-5), nome ou palavras-chave: "individual", "familiar/familia", "empresa/empresarial/pj", "mei", "entidade/sindicato/classe" |
| **Erro** | "Escolha um tipo de plano válido de 1 a 5 ou responda com o nome da opção." |

> **Esta etapa define o fluxo condicional das próximas perguntas:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TIPO DE PLANO ESCOLHIDO                          │
├──────────────┬──────────────┬──────────────┬────────────┬───────────┤
│  Individual  │   Familiar   │ Empresarial  │    MEI     │ Entidade  │
├──────────────┼──────────────┼──────────────┼────────────┼───────────┤
│ → Faixa      │ → Nº vidas   │ → Nº vidas   │ → Nº vidas │ → Faixa  │
│   etária     │   (mín. 2)   │   (mín. 2)   │   (mín. 2) │   etária │
│   (1 vida)   │ → Se >1:     │ → Se >1:     │ → Se >1:   │ (1 vida) │
│              │   faixa por  │   faixa por  │   faixa por│          │
│              │   vida       │   vida       │   vida     │          │
│              │              │ → CNPJ       │ → CNPJ     │ → Nome   │
│              │              │              │            │ entidade  │
└──────────────┴──────────────┴──────────────┴────────────┴───────────┘
```

### Etapa 9 — Faixa Etária (titular)
| Campo | Valor |
|---|---|
| **Chave** | `ageRange` |
| **Pergunta** | "Qual é a sua faixa etária? Você pode responder com uma idade ou escolher uma opção:\n1) 0 a 18\n2) 19 a 23\n3) 24 a 33\n4) 34 a 43\n5) 44 a 53\n6) 54 a 58\n7) 59+" |
| **Condição** | **Individual**: sempre · **Familiar/Empresarial/MEI**: somente se beneficiários ≤ 1 · **Entidade**: sempre |
| **Validação** | Número 1-7, texto da faixa, ou idade numérica (converte automaticamente para faixa) |
| **Erro** | "Informe a sua faixa etária usando uma idade ou escolha uma das opções de 1 a 7." |

**Mapeamento automático de idades:**
| Idade informada | Faixa atribuída |
|---|---|
| 0–18 | 0 a 18 |
| 19–23 | 19 a 23 |
| 24–33 | 24 a 33 |
| 34–43 | 34 a 43 |
| 44–53 | 44 a 53 |
| 54–58 | 54 a 58 |
| 59+ | 59+ |

### Etapa 10 — Quantidade de Vidas (Beneficiários)
| Campo | Valor |
|---|---|
| **Chave** | `beneficiaries` |
| **Pergunta** | "Quantas vidas deseja incluir no plano?" (ou com aviso de mínimo) |
| **Condição** | Somente se tipo ≠ Individual (Familiar, Empresarial, MEI, Entidade) |
| **Validação** | Número inteiro > 0. Para Familiar/Empresarial/MEI: mínimo 2 |
| **Erro Individual** | "Informe um número válido para \"Quantidade de vidas\"." |
| **Erro Mínimo** | "Para plano [tipo], informe no mínimo 2 vidas." |

**Mensagem dinâmica para planos com mínimo:**
> "Quantas vidas deseja incluir no plano? Para [familiar/empresarial/mei] informe no mínimo 2 vidas."

### Etapa 11 — Faixa Etária de Cada Beneficiário (Loop)
| Campo | Valor |
|---|---|
| **Chave** | `beneficiaryAgeRanges` |
| **Pergunta** | "Qual é a faixa etária da vida [N] de [total]?" (mesmas opções da etapa 9) |
| **Condição** | Somente se Familiar/Empresarial/MEI **E** beneficiários > 1 |
| **Loop** | Repete para cada vida (1 até N). A primeira iteração tem introdução extra: "Agora preciso registrar a faixa etária de cada vida incluída no plano." |
| **Validação** | Mesma da faixa etária (número 1-7 ou idade) |

**Exemplo com 3 vidas:**
1. "Agora preciso registrar a faixa etária de cada vida incluída no plano.\n\nQual é a faixa etária da vida 1 de 3?"
2. "Qual é a faixa etária da vida 2 de 3?"
3. "Qual é a faixa etária da vida 3 de 3?"

### Etapa 12 — Tipo de Contrato
| Campo | Valor |
|---|---|
| **Chave** | `contractType` |
| **Pergunta** | "O seu caso é:\n1. Primeiro plano\n2. Trocar de plano" |
| **Condição** | Sempre ativa |
| **Opções** | `1` = Primeiro plano · `2` = Trocar de plano · Aceita: "primeiro/novo/primeira vez" → Primeiro plano · "trocar/troca/renov/migr/portabilidade" → Trocar de plano |
| **Erro** | "Responda com 1 para Primeiro plano ou 2 para Trocar de plano." |

### Etapa 13 — Plano Atual (condicional)
| Campo | Valor |
|---|---|
| **Chave** | `currentPlan` |
| **Pergunta** | "Qual plano possui atualmente? Digite o nome da operadora." |
| **Condição** | Somente se `contractType` = "Trocar de plano" |
| **Validação** | Texto obrigatório (máx. 120 caracteres) |

### Etapa 14 — Vencimento do Plano Atual (condicional)
| Campo | Valor |
|---|---|
| **Chave** | `currentPlanExpiry` |
| **Pergunta** | "Qual é o vencimento do plano atual? Envie em DD/MM/AAAA, YYYY-MM-DD ou MM/AAAA." |
| **Condição** | Somente se `contractType` = "Trocar de plano" |
| **Validação** | Formatos aceitos: `DD/MM/AAAA`, `YYYY-MM-DD`, `MM/AAAA` |
| **Erro** | "Informe a data em DD/MM/AAAA, YYYY-MM-DD ou MM/AAAA." |

### Etapa 15 — Operadora de Preferência
| Campo | Valor |
|---|---|
| **Chave** | `operatorInterest` |
| **Pergunta** | "Qual operadora você prefere?" + lista numerada |
| **Condição** | Sempre ativa |
| **Opções padrão** | 1. Bradesco Saúde · 2. Unimed · 3. Amil · 4. SulAmérica · 5. Humana Saúde · 6. Notre Dame Intermédica · 7. Paraná Clínicas · 8. MedSenior · 9. Select · 10. MedSul · 11. Dentaluni · 12. Odontoprev · 13. Sem preferência |
| **Configurável** | A lista pode ser customizada via setting `operatorInterests` no banco de dados |
| **Validação** | Aceita número, nome exato ou parcial da operadora |
| **Erro** | "Responda com um número de 1 a [N] ou informe o nome da operadora desejada." |

### Etapa 16 — Coparticipação
| Campo | Valor |
|---|---|
| **Chave** | `coparticipation` |
| **Pergunta** | "Você prefere:\n1. Com coparticipação\n2. Sem coparticipação" |
| **Condição** | Sempre ativa |
| **Opções** | `1` = Com coparticipação · `2` = Sem coparticipação · Aceita: "com" / "sem" |
| **Erro** | "Responda com 1 para Com coparticipação ou 2 para Sem coparticipação." |

### Etapa 17 — Cobertura
| Campo | Valor |
|---|---|
| **Chave** | `coverage` |
| **Pergunta** | "A cobertura desejada é:\n1. Regional\n2. Nacional" |
| **Condição** | Sempre ativa |
| **Opções** | `1` = Regional · `2` = Nacional · Aceita: "regional" / "nacional" |
| **Erro** | "Responda com 1 para Regional ou 2 para Nacional." |

### Etapa 18 — Urgência
| Campo | Valor |
|---|---|
| **Chave** | `urgency` |
| **Pergunta** | "Qual é a urgência?\n1. Baixa\n2. Média\n3. Alta" |
| **Condição** | Sempre ativa |
| **Opções** | `1` = Baixa · `2` = Média · `3` = Alta · Aceita: "baixa", "media/média", "alta/urgente" |
| **Erro** | "Responda com 1 para Baixa, 2 para Média ou 3 para Alta." |

### Etapa 19 — CNPJ (condicional)
| Campo | Valor |
|---|---|
| **Chave** | `cnpj` |
| **Pergunta** | "Qual é o CNPJ?" |
| **Condição** | Somente se `planType` = "Empresarial" ou "MEI" |
| **Validação** | Exatamente 14 dígitos |
| **Erro** | "Informe um CNPJ com 14 dígitos para continuar o cadastro." |

### Etapa 20 — Nome da Entidade (condicional)
| Campo | Valor |
|---|---|
| **Chave** | `entityName` |
| **Pergunta** | "Qual é o nome da entidade, associação ou sindicato?" |
| **Condição** | Somente se `planType` = "Entidade de classe / sindicato" |
| **Validação** | Texto obrigatório (máx. 190 caracteres) |

### Etapa 21 — Observação Inicial
| Campo | Valor |
|---|---|
| **Chave** | `initialNotes` |
| **Pergunta** | "Existe alguma observação inicial importante sobre a sua necessidade? Se não houver, responda \"Nenhuma\"." |
| **Condição** | Sempre ativa |
| **Validação** | Texto obrigatório (máx. 1200 caracteres) |

---

## Etapas Desativadas (código presente mas `isActive: () => false`)

| Chave | Pergunta | Status |
|---|---|---|
| `companyName` | "Qual é o nome da empresa ou do MEI?" | **Desativada** |
| `hasActiveCnpj` | "A empresa possui CNPJ ativo? 1. Sim / 2. Não" | **Desativada** |
| `hasActiveMei` | "Você possui MEI ativo? 1. Sim / 2. Não" | **Desativada** |

---

## Mensagem de Finalização

Quando todas as etapas são respondidas:

> *"Cadastro concluído. Nosso time vai continuar seu atendimento por aqui em seguida."*

**Ações automáticas ao finalizar:**
1. Cria o registro de **lead** no CRM com todos os dados coletados
2. Vincula a conversa ao lead
3. Define `pipelineStage = "Novo lead"` e `status = "Novo lead"`
4. Calcula `temperature` com base na urgência: Alta → Quente · Média → Morno · Baixa → Frio
5. Gera tags automáticas: `urgente`, `mei`, `familiar`, `sindicato` (conforme respostas)
6. Define `origin` como WhatsApp/Instagram/Facebook conforme o canal
7. Envia broadcast de atualização para o dashboard do CRM

---

## Controle de Inatividade

| Parâmetro | Valor |
|---|---|
| **Intervalo de verificação** | A cada 15 segundos |
| **Lembrete após inatividade** | 2 minutos sem resposta |
| **Mensagem de lembrete** | "Quando puder, me envie a próxima resposta para continuarmos seu cadastro." |
| **Fechamento após lembrete** | 3 minutos adicionais sem resposta |
| **Mensagem de fechamento** | "Como não houve resposta, encerrei este cadastro por agora. Se quiser continuar, é só me mandar uma nova mensagem." |
| **Batch de processamento** | 25 conversas por ciclo |

**Fluxo de inatividade:**
```
Última pergunta enviada
       │
       ▼ (2 min sem resposta)
   Lembrete enviado
       │
       ▼ (3 min sem resposta)
   Conversa fechada
   (status = closed, qualification resetada)
```

---

## Contato Conhecido (Known Contact)

Se o webhook indica que o contato é **conhecido** (salvo, seguidor, amigo), a qualificação é marcada como `ignored_known_contact` e **nenhuma pergunta é enviada**. O contato pode ser atendido diretamente por um agente humano.

---

## Detecção de Estado Corrompido

O bot possui proteção contra estados corrompidos: se alguma resposta salva contiver texto que pareça ser uma **pergunta do próprio bot** (detectado via `QUALIFICATION_PROMPT_MARKERS`), o estado é resetado e a qualificação recomeça do zero.

---

## Fluxos por Tipo de Plano

### Individual (mínimo de perguntas)
```
Nome → [Telefone] → [WhatsApp?] → Email → CPF → Cidade → Estado
→ Tipo: Individual → Faixa etária → Contrato → [Plano atual] → [Vencimento]
→ Operadora → Coparticipação → Cobertura → Urgência → Observação → FIM
```
**Total: 14–16 perguntas**

### Familiar
```
Nome → [Telefone] → [WhatsApp?] → Email → CPF → Cidade → Estado
→ Tipo: Familiar → Nº vidas (mín. 2) → Faixa etária por vida (loop)
→ Contrato → [Plano atual] → [Vencimento] → Operadora → Coparticipação
→ Cobertura → Urgência → Observação → FIM
```
**Total: 15–17 + N perguntas (N = número de vidas)**

### Empresarial
```
Nome → [Telefone] → [WhatsApp?] → Email → CPF → Cidade → Estado
→ Tipo: Empresarial → Nº vidas (mín. 2) → Faixa etária por vida (loop)
→ Contrato → [Plano atual] → [Vencimento] → Operadora → Coparticipação
→ Cobertura → Urgência → CNPJ → Observação → FIM
```
**Total: 16–18 + N perguntas**

### MEI
```
Nome → [Telefone] → [WhatsApp?] → Email → CPF → Cidade → Estado
→ Tipo: MEI → Nº vidas (mín. 2) → Faixa etária por vida (loop)
→ Contrato → [Plano atual] → [Vencimento] → Operadora → Coparticipação
→ Cobertura → Urgência → CNPJ → Observação → FIM
```
**Total: 16–18 + N perguntas**

### Entidade de Classe / Sindicato
```
Nome → [Telefone] → [WhatsApp?] → Email → CPF → Cidade → Estado
→ Tipo: Entidade → Faixa etária → Contrato → [Plano atual] → [Vencimento]
→ Operadora → Coparticipação → Cobertura → Urgência → Nome da entidade
→ Observação → FIM
```
**Total: 15–17 perguntas**

---

## Diagrama de Fluxo Geral

```
                        ┌──────────────────────┐
                        │  Novo contato envia   │
                        │  mensagem (inbound)   │
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │  É contato conhecido? │
                        └──────┬───────┬───────┘
                           SIM │       │ NÃO
                               │       │
                    ┌──────────▼──┐ ┌──▼──────────────────┐
                    │   IGNORADO  │ │ Boas-vindas +       │
                    │ (sem bot)   │ │ Pergunta 1 (nome)   │
                    └─────────────┘ └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │  Aguarda resposta    │
                                    │  (status: PENDING)   │
                                    └──┬──────────┬───────┘
                                       │          │
                              Resposta │          │ Sem resposta
                              válida   │          │
                                       │   ┌──────▼──────┐
                                       │   │  2 min:     │
                                       │   │  Lembrete   │
                                       │   └──────┬──────┘
                                       │          │
                                       │   ┌──────▼──────┐
                                       │   │  +3 min:    │
                                       │   │  Fecha conv.│
                                       │   └─────────────┘
                                       │
                            ┌──────────▼──────────┐
                            │  Resposta inválida?  │
                            └──┬──────────┬───────┘
                           SIM │          │ NÃO
                               │          │
                    ┌──────────▼──┐ ┌─────▼───────────────┐
                    │  Reenvia    │ │  Salva resposta,    │
                    │  pergunta   │ │  avança p/ próxima  │
                    │  + erro     │ └──────────┬──────────┘
                    └─────────────┘            │
                                    ┌──────────▼──────────┐
                                    │  Há mais perguntas? │
                                    └──┬──────────┬───────┘
                                   SIM │          │ NÃO
                                       │          │
                            ┌──────────▼──┐ ┌─────▼───────────────┐
                            │  Envia      │ │  Finaliza:          │
                            │  próxima    │ │  • Cria lead        │
                            │  pergunta   │ │  • Vincula conversa │
                            └─────────────┘ │  • "Cadastro        │
                                            │    concluído..."    │
                                            └─────────────────────┘
```
