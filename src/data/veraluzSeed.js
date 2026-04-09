export const DEFAULT_PASSWORD_HINT = "";

export const ROLE_OPTIONS = [
  { value: "admin", label: "Administrador" },
  { value: "manager", label: "Gerente" },
  { value: "broker", label: "Corretor" },
];

export const ORIGIN_OPTIONS = ["Site", "Instagram", "Facebook", "WhatsApp", "Cadastro manual"];

export const PIPELINE_STAGES = [
  "Novo lead",
  "Em contato",
  "Cotação",
  "Proposta enviada",
  "Negociação",
  "Fechado",
  "Perdido",
  "Pós-venda",
];

export const STATUS_OPTIONS = [
  "Novo lead",
  "Em contato",
  "Cotação em andamento",
  "Proposta enviada",
  "Aguardando retorno",
  "Em negociação",
  "Venda fechada",
  "Perdido",
  "Pós-venda",
];

export const PLAN_TYPE_OPTIONS = [
  "Individual",
  "Familiar",
  "Empresarial",
  "MEI",
  "Entidade de classe / sindicato",
];

export const OPERATOR_INTEREST_OPTIONS = [
  "Bradesco Saúde",
  "Unimed",
  "Amil",
  "SulAmérica",
  "Humana Saúde",
  "Notre Dame Intermédica",
  "Paraná Clínicas",
  "MedSenior",
  "Select",
  "MedSul",
  "Dentaluni",
  "Odontoprev",
  "Sem preferência",
];

export const TEMPERATURE_OPTIONS = ["Frio", "Morno", "Quente"];

export const COPARTICIPATION_OPTIONS = ["Com coparticipação", "Sem coparticipação"];

export const COVERAGE_OPTIONS = ["Regional", "Nacional"];

export const URGENCY_OPTIONS = ["Baixa", "Média", "Alta"];

export const CONTRACT_OPTIONS = ["Primeiro plano", "Trocar de plano"];

export const AGE_RANGE_OPTIONS = [
  "0 a 18",
  "19 a 23",
  "24 a 33",
  "34 a 43",
  "44 a 53",
  "54 a 58",
  "59+",
];

export const TAG_OPTIONS = [
  "urgente",
  "retorno",
  "mei",
  "familiar",
  "sindicato",
  "alto valor",
  "premium",
  "concorrente",
  "cotação rápida",
];

export const LOSS_REASON_OPTIONS = [
  "Preço",
  "Sem interesse",
  "Fechou com concorrente",
  "Sem retorno",
  "Fora do perfil",
];

export const INTERACTION_CHANNEL_OPTIONS = [
  "Ligação",
  "WhatsApp",
  "E-mail",
  "Reunião",
  "Observação",
];

export const TASK_TYPE_OPTIONS = [
  "Ligação",
  "WhatsApp",
  "E-mail",
  "Reunião",
  "Follow-up",
  "Pendência",
];

export const DOCUMENT_TYPE_OPTIONS = [
  "RG",
  "CPF",
  "CNPJ",
  "Comprovante",
  "Proposta",
  "Contrato",
  "Outros",
];

export const ROLE_PERMISSIONS = [
  {
    id: "perm-1",
    title: "Visualizar todos os leads",
    admin: true,
    manager: true,
    broker: false,
  },
  {
    id: "perm-2",
    title: "Editar pipeline e responsável",
    admin: true,
    manager: true,
    broker: true,
  },
  {
    id: "perm-3",
    title: "Gerenciar usuários",
    admin: true,
    manager: true,
    broker: false,
  },
  {
    id: "perm-4",
    title: "Editar configurações e integrações",
    admin: true,
    manager: true,
    broker: false,
  },
];

export function createSeedUsers() {
  return [
    {
      id: "user-admin",
      name: "Administrador Veraluz",
      email: "contato@veraluz.net.br",
      password: "Vera3636#",
      role: "admin",
      active: true,
      onlyOwnLeads: false,
      phone: "",
      avatar: "VZ",
      city: "",
      lastLogin: "",
    },
  ];
}

export function createSeedLeads() {
  return [];
}

export function createSeedIntegrations() {
  return [];
}

export function createSeedFormSubmissions() {
  return [];
}

export function createSeedSettings() {
  return {
    pipelineStages: PIPELINE_STAGES,
    planTypes: PLAN_TYPE_OPTIONS,
    operatorInterests: OPERATOR_INTEREST_OPTIONS,
    tags: TAG_OPTIONS,
    lossReasons: LOSS_REASON_OPTIONS,
    origins: ORIGIN_OPTIONS,
    brokerage: {
      name: "Veraluz CRM",
      cnpj: "",
      city: "",
      state: "",
      supportPhone: "",
      supportEmail: "contato@veraluz.net.br",
    },
    notifications: {
      browser: true,
      overdueFollowUps: true,
      dailyAgenda: true,
    },
  };
}

export function createInitialCRMState() {
  return {
    leads: createSeedLeads(),
    users: createSeedUsers(),
    integrations: createSeedIntegrations(),
    formSubmissions: createSeedFormSubmissions(),
    settings: createSeedSettings(),
  };
}
