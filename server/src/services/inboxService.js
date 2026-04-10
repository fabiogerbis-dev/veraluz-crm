const crypto = require("node:crypto");
const { pool } = require("../db/pool");
const env = require("../config/env");
const { normalizePhone } = require("../utils/normalize");
const leadService = require("./leadService");
const { buildLeadVisibilityClause, findSetting } = require("./referenceService");
const zapResponderClient = require("./zapResponderClient");
const { broadcastCrmUpdate } = require("./realtimeService");
const pushNotificationService = require("./pushNotificationService");

const SYSTEM_SOURCE = "zap_responder";
const CONTACT_EMAIL = "contato@veraluz.net.br";

function readPath(value, path) {
  return path.split(".").reduce((current, segment) => current?.[segment], value);
}

function pickFirstValue(payload, paths = []) {
  for (const path of paths) {
    const value = readPath(payload, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

function pickFirstString(payload, paths = []) {
  for (const path of paths) {
    const value = readPath(payload, path);

    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
      continue;
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({ error: "payload_not_serializable" });
  }
}

function parseJson(value, fallbackValue) {
  if (!value) {
    return fallbackValue;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallbackValue;
  }
}

function toDateTime(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const normalized = value > 10_000_000_000 ? value : value * 1000;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && value.trim() !== "") {
      return toDateTime(numeric);
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function normalizeMessageStatus(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return "";
  }

  if (
    normalized.includes("delivered") ||
    normalized.includes("entregue") ||
    normalized === "2"
  ) {
    return "delivered";
  }

  if (normalized.includes("read") || normalized.includes("lida") || normalized === "3") {
    return "read";
  }

  if (
    normalized.includes("failed") ||
    normalized.includes("erro") ||
    normalized.includes("falh")
  ) {
    return "failed";
  }

  if (normalized.includes("sent") || normalized.includes("enviad") || normalized === "1") {
    return "sent";
  }

  if (normalized.includes("receb")) {
    return "received";
  }

  if (normalized.includes("close") || normalized.includes("encerr")) {
    return "closed";
  }

  return normalized;
}

function normalizeChannelKey(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return "whatsapp";
  }

  if (normalized.includes("insta")) {
    return "instagram";
  }

  if (normalized.includes("messenger") || normalized.includes("facebook")) {
    return "messenger";
  }

  if (normalized.includes("whatsapp")) {
    return "whatsapp";
  }

  return normalized;
}

function getChannelLabel(channelKey = "") {
  switch (normalizeChannelKey(channelKey)) {
    case "instagram":
      return "Instagram";
    case "messenger":
      return "Facebook";
    case "whatsapp":
    default:
      return "WhatsApp";
  }
}

function getOriginName(channelKey = "") {
  switch (normalizeChannelKey(channelKey)) {
    case "instagram":
      return "Instagram";
    case "messenger":
      return "Facebook";
    case "whatsapp":
    default:
      return "WhatsApp";
  }
}

const SUPPORTED_QUALIFICATION_CHANNELS = new Set(["whatsapp", "instagram", "messenger"]);
const QUALIFICATION_STATUS = {
  NOT_STARTED: "not_started",
  PENDING: "pending",
  COMPLETED: "completed",
  IGNORED: "ignored_known_contact",
};
const LEAD_QUALIFICATION_MONITOR_INTERVAL_MS = 15 * 1000;
const LEAD_QUALIFICATION_MONITOR_BATCH_SIZE = 25;
const CHANNEL_BOT_CONFIG = {
  whatsapp: {
    reminderDelayMs: 15 * 60 * 1000,
    closeAfterReminderMs: 60 * 60 * 1000,
    reminderText: (name) => `Oi${name ? `, *${name}*` : ""}! Ainda estou por aqui \u{1F60A} Quando puder, me manda a próxima resposta pra gente continuar.`,
    closedText: (name) => `Tudo bem${name ? `, *${name}*` : ""}! Vou encerrar por aqui, mas se quiser retomar é só mandar um oi que a gente continua de onde parou. \u{1F49A}`,
    intro: "Olá! \u{1F60A} Bem-vindo à *Veraluz*!\nSou a assistente virtual e vou te ajudar a encontrar o plano de saúde ideal.\n\nSão poucas perguntas rápidas e logo um consultor entra em contato com você aqui mesmo pelo WhatsApp.",
    skipFollowers: false,
    usesBold: true,
    optionPrefix: (n) => ["1\u{FE0F}\u{20E3}", "2\u{FE0F}\u{20E3}", "3\u{FE0F}\u{20E3}", "4\u{FE0F}\u{20E3}", "5\u{FE0F}\u{20E3}", "6\u{FE0F}\u{20E3}", "7\u{FE0F}\u{20E3}"][n - 1] || `${n}.`,
    completionMessage: (name, summary) => `Pronto${name ? `, *${name}*` : ""}! \u{2705}\n\nAqui está o resumo do que anotei:\n\n${summary}\n\nUm consultor *Veraluz* vai entrar em contato com você por aqui em breve. Obrigada! \u{1F49A}`,
    returningLeadMessage: (name, brokerName) => {
      const greeting = name ? `, *${name}*` : "";
      if (brokerName) {
        return `Olá${greeting}! \u{1F60A} Que bom ter você de volta. Já identifiquei seu cadastro e estou avisando seu consultor *${brokerName}*. Ele vai te responder por aqui em breve!`;
      }
      return `Olá${greeting}! \u{1F60A} Que bom ter você de volta. Já identifiquei seu cadastro e estou encaminhando para um de nossos consultores. Ele vai te responder por aqui em breve!`;
    },
  },
  messenger: {
    reminderDelayMs: 20 * 60 * 1000,
    closeAfterReminderMs: 2 * 60 * 60 * 1000,
    reminderText: (name) => `Oi${name ? `, ${name}` : ""}! Ainda estou por aqui. Quando puder, manda a próxima resposta pra gente continuar \u{1F60A}`,
    closedText: () => "Tudo bem! Vou encerrar por aqui. Se quiser retomar, é só mandar uma mensagem que a gente continua de onde parou.",
    intro: "Olá! Bem-vindo à Veraluz! \u{1F60A}\nSou a assistente virtual e vou te ajudar a encontrar o plano de saúde ideal.\n\nSão poucas perguntas e logo um consultor entra em contato com você.",
    skipFollowers: true,
    usesBold: false,
    optionPrefix: (n) => `${n} -`,
    completionMessage: (name, summary) => `Pronto${name ? `, ${name}` : ""}!\n\nResumo:\n${summary}\n\nUm consultor Veraluz vai entrar em contato com você em breve, preferencialmente pelo WhatsApp informado. Obrigada! \u{1F49A}`,
    returningLeadMessage: (name, brokerName) => {
      const greeting = name ? `, ${name}` : "";
      if (brokerName) {
        return `Olá${greeting}! Já localizei seu cadastro aqui. Seu consultor ${brokerName} vai continuar o atendimento em breve. Se preferir, ele também pode te chamar pelo WhatsApp.`;
      }
      return `Olá${greeting}! Já localizei seu cadastro aqui. Um de nossos consultores vai continuar o atendimento em breve.`;
    },
  },
  instagram: {
    reminderDelayMs: 10 * 60 * 1000,
    closeAfterReminderMs: 45 * 60 * 1000,
    reminderText: () => "Oi! Ainda to aqui \u{1F60A} Quando puder, me responde pra gente continuar!",
    closedText: () => "Sem problema! Se quiser retomar depois, e so mandar um oi aqui. \u{1F49A}",
    intro: "Oi! Bem-vindo a Veraluz! \u{1F60A}\n\nVou te ajudar a encontrar o plano de saude ideal. Sao perguntas rapidas!",
    skipFollowers: true,
    usesBold: false,
    optionPrefix: (n) => `${n} -`,
    completionMessage: (name) => `Anotado${name ? `, ${name}` : ""}! \u{2705}\n\nUm consultor Veraluz vai te chamar no WhatsApp em breve.\n\nObrigada! \u{1F49A}`,
    returningLeadMessage: (name) => {
      const greeting = name ? `, ${name}` : "";
      return `Oi${greeting}! Já te encontrei aqui \u{1F60A} Vou avisar seu consultor e ele te responde rapidinho!`;
    },
  },
};
const RETURNING_LEAD_GREETING_COOLDOWN_MS = 30 * 60 * 1000;
function getChannelBotConfig(channelKey) {
  return CHANNEL_BOT_CONFIG[normalizeChannelKey(channelKey)] || CHANNEL_BOT_CONFIG.whatsapp;
}
function getChannelReminderDelayMs(channelKey) {
  return getChannelBotConfig(channelKey).reminderDelayMs;
}
function getChannelCloseAfterReminderMs(channelKey) {
  return getChannelBotConfig(channelKey).closeAfterReminderMs;
}
const YES_ANSWER_TOKENS = new Set([
  "sim",
  "s",
  "yes",
  "tenho",
  "possuo",
  "quero",
  "ativo",
]);
const NO_ANSWER_TOKENS = new Set([
  "nao",
  "não",
  "n",
  "no",
  "nao tenho",
  "não tenho",
  "sem",
  "inativo",
]);
const PLAN_TYPE_CHOICES = [
  "Individual",
  "Familiar",
  "Empresarial",
  "MEI",
  "Entidade de classe / sindicato",
];
const DEFAULT_OPERATOR_INTEREST_CHOICES = [
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
const OPERATOR_INTEREST_SETTING_KEY = "operatorInterests";
const AGE_RANGE_CHOICES = ["0 a 18", "19 a 23", "24 a 33", "34 a 43", "44 a 53", "54 a 58", "59+"];
const MINIMUM_TWO_LIVES_PLAN_TYPES = new Set(["Familiar", "Empresarial", "MEI"]);
const STATE_NAME_TO_UF = new Map([
  ["acre", "AC"],
  ["alagoas", "AL"],
  ["amapa", "AP"],
  ["amazonas", "AM"],
  ["bahia", "BA"],
  ["ceara", "CE"],
  ["distrito federal", "DF"],
  ["espirito santo", "ES"],
  ["goias", "GO"],
  ["maranhao", "MA"],
  ["mato grosso", "MT"],
  ["mato grosso do sul", "MS"],
  ["minas gerais", "MG"],
  ["para", "PA"],
  ["paraiba", "PB"],
  ["parana", "PR"],
  ["pernambuco", "PE"],
  ["piaui", "PI"],
  ["rio de janeiro", "RJ"],
  ["rio grande do norte", "RN"],
  ["rio grande do sul", "RS"],
  ["rondonia", "RO"],
  ["roraima", "RR"],
  ["santa catarina", "SC"],
  ["sao paulo", "SP"],
  ["sergipe", "SE"],
  ["tocantins", "TO"],
]);
const QUALIFICATION_PROMPT_MARKERS = [
  "bem-vindo a veraluz",
  "bem-vindo à veraluz",
  "assistente virtual",
  "plano de saude ideal",
  "perguntas rapidas",
  "qual e o seu nome completo",
  "qual o seu nome completo",
  "qual e o seu e-mail",
  "qual e o seu cpf",
  "em qual cidade voce mora",
  "qual sua cidade e estado",
  "qual e a sua uf",
  "qual e o seu estado",
  "qual a sua idade",
  "qual e a sua faixa etaria",
  "quantas pessoas no total",
  "quantas vidas deseja incluir",
  "que tipo de plano voce",
  "qual tipo de plano voce procura",
  "primeiro plano ou troca",
  "o seu caso e primeiro plano",
  "qual operadora voce prefere",
  "tem preferencia por alguma operadora",
  "pra quando voce precisa",
  "pra quando precisa",
];
let leadQualificationInactivityMonitor = null;
let leadQualificationInactivityMonitorRunning = false;

async function getOperatorInterestChoices() {
  const configuredChoices = await findSetting(OPERATOR_INTEREST_SETTING_KEY);

  if (!Array.isArray(configuredChoices)) {
    return DEFAULT_OPERATOR_INTEREST_CHOICES;
  }

  const normalizedChoices = Array.from(
    new Set(
      configuredChoices
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );

  if (!normalizedChoices.length) {
    return DEFAULT_OPERATOR_INTEREST_CHOICES;
  }

  return normalizedChoices;
}

function buildOperatorInterestPrompt(choices) {
  return ["Qual operadora você prefere?", ...choices.map((choice, index) => `${index + 1}. ${choice}`)].join("\n");
}

function buildOperatorInterestRetryMessage(choices) {
  return `Responda com um número de 1 a ${choices.length} ou informe o nome da operadora desejada.`;
}

function buildAgeRangeChoicesText() {
  return AGE_RANGE_CHOICES.map((choice, index) => `${index + 1}) ${choice}`).join("\n");
}

function shouldAskBeneficiariesForPlan(planType = "") {
  return Boolean(planType) && planType !== "Individual";
}

function requiresMinimumTwoLives(planType = "") {
  return MINIMUM_TWO_LIVES_PLAN_TYPES.has(planType);
}

function normalizeBeneficiariesCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function getBeneficiaryAgeRanges(answers = {}) {
  // Support new agesBundle format from optimized bot
  if (answers.agesBundle && Array.isArray(answers.agesBundle.ageRanges)) {
    return answers.agesBundle.ageRanges.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (!Array.isArray(answers.beneficiaryAgeRanges)) {
    return [];
  }

  return answers.beneficiaryAgeRanges
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function shouldAskBeneficiaryAgeRanges(answers = {}) {
  return (
    requiresMinimumTwoLives(answers.planType) &&
    normalizeBeneficiariesCount(answers.beneficiaries) > 1
  );
}

function buildPrimaryAgeRangePrompt() {
  return `Qual é a sua faixa etária? Você pode responder com uma idade ou escolher uma opção:\n${buildAgeRangeChoicesText()}`;
}

function buildBeneficiariesPrompt(answers = {}) {
  if (requiresMinimumTwoLives(answers.planType)) {
    return `Quantas vidas deseja incluir no plano? Para ${String(answers.planType || "").toLowerCase()} informe no mínimo 2 vidas.`;
  }

  return "Quantas vidas deseja incluir no plano?";
}

function buildBeneficiaryAgeRangePrompt(state = {}) {
  const answers = state.answers || {};
  const currentRanges = getBeneficiaryAgeRanges(answers);
  const totalLives = normalizeBeneficiariesCount(answers.beneficiaries);
  const currentLife = Math.min(currentRanges.length + 1, totalLives);
  const intro =
    currentRanges.length === 0
      ? "Agora preciso registrar a faixa etária de cada vida incluída no plano.\n\n"
      : "";

  return `${intro}Qual é a faixa etária da vida ${currentLife} de ${totalLives}? Você pode responder com uma idade ou escolher uma opção:\n${buildAgeRangeChoicesText()}`;
}

function normalizeComparableText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isSupportedQualificationChannel(channelKey = "") {
  return SUPPORTED_QUALIFICATION_CHANNELS.has(normalizeChannelKey(channelKey));
}

function parseBooleanFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  const normalized = normalizeComparableText(value);

  if (!normalized) {
    return null;
  }

  if (
    [
      "true",
      "1",
      "sim",
      "yes",
      "saved",
      "is_saved",
      "friend",
      "follower",
      "known",
      "known_contact",
    ].includes(normalized)
  ) {
    return true;
  }

  if (["false", "0", "nao", "não", "no"].includes(normalized)) {
    return false;
  }

  return null;
}

function extractKnownContactFlag(payload) {
  const candidatePaths = [
    "knownContact",
    "isKnownContact",
    "contact.isKnown",
    "contact.known",
    "contact.isSaved",
    "contact.saved",
    "contact.isFollower",
    "contact.follower",
    "contact.isFriend",
    "contact.friend",
    "profile.isFollower",
    "profile.isFriend",
    "profile.isSaved",
    "raw_message.isSaved",
    "raw_message.contactSaved",
    "raw_message.isKnownContact",
    "raw_message.isFriend",
    "raw_message.isFollower",
    "conversation.contact.isKnown",
    "conversation.contact.isSaved",
    "conversation.contact.isFollower",
    "conversation.contact.isFriend",
    "data.contact.isKnown",
    "data.contact.isSaved",
    "data.contact.isFollower",
    "data.contact.isFriend",
    "data.raw_message.isSaved",
    "data.raw_message.isKnownContact",
  ];

  for (const path of candidatePaths) {
    const parsed = parseBooleanFlag(readPath(payload, path));

    if (parsed !== null) {
      return parsed;
    }
  }

  return false;
}

function parseRequiredTextAnswer(value, fieldLabel, { maxLength = 190 } = {}) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return {
      ok: false,
      retryMessage: `Preciso do campo "${fieldLabel}" para continuar o cadastro.`,
    };
  }

  return {
    ok: true,
    value: trimmed.slice(0, maxLength),
  };
}

function parseNumericChoice(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{1,2})(?:[.)\-\s]|$)/);

  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function parseEmailAnswer(value) {
  const trimmed = String(value || "").trim().toLowerCase();

  if (!trimmed) {
    return {
      ok: false,
      retryMessage: "Informe um e-mail válido para continuar o cadastro.",
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return {
      ok: false,
      retryMessage: "Informe um e-mail válido para continuar o cadastro.",
    };
  }

  return {
    ok: true,
    value: trimmed,
  };
}

function parseCpfAnswer(value) {
  const normalized = normalizePhone(String(value || ""));

  if (!normalized) {
    return {
      ok: false,
      retryMessage: "Informe um CPF com 11 dígitos para continuar o cadastro.",
    };
  }

  if (normalized.length !== 11) {
    return {
      ok: false,
      retryMessage: "Informe um CPF com 11 dígitos para continuar o cadastro.",
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

function parsePhoneAnswer(value) {
  const normalized = normalizePhone(String(value || ""));

  if (!normalized || normalized.length < 10) {
    return {
      ok: false,
      retryMessage: "Informe um telefone com DDD para continuar.",
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

function parsePositiveIntegerAnswer(value, fieldLabel) {
  const normalized = String(value || "").trim();
  const digits = normalized.replace(/\D/g, "");
  const parsed = Number.parseInt(digits || normalized, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return {
      ok: false,
      retryMessage: `Informe um número válido para "${fieldLabel}".`,
    };
  }

  return {
    ok: true,
    value: parsed,
  };
}

function parseStateAnswer(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return {
      ok: false,
      retryMessage: "Informe o seu estado para continuar o cadastro.",
    };
  }

  if (trimmed.length === 2) {
    return {
      ok: true,
      value: trimmed.toUpperCase(),
    };
  }

  const uf = STATE_NAME_TO_UF.get(normalizeComparableText(trimmed));

  if (uf) {
    return {
      ok: true,
      value: uf,
    };
  }

  return {
    ok: true,
    value: trimmed.slice(0, 60),
  };
}

function parseAgeRangeAnswer(value) {
  const trimmed = String(value || "").trim();
  const numericChoice = parseNumericChoice(trimmed);

  if (!trimmed) {
    return {
      ok: false,
      retryMessage:
        "Informe a sua faixa etária usando uma idade ou escolha uma das opções de 1 a 7.",
    };
  }

  if (numericChoice >= 1 && numericChoice <= AGE_RANGE_CHOICES.length) {
    return {
      ok: true,
      value: AGE_RANGE_CHOICES[numericChoice - 1],
    };
  }

  const normalized = normalizeComparableText(trimmed);
  const matchedOption = AGE_RANGE_CHOICES.find(
    (option) => normalizeComparableText(option) === normalized
  );

  if (matchedOption) {
    return {
      ok: true,
      value: matchedOption,
    };
  }

  if (normalized.includes("59")) {
    return {
      ok: true,
      value: "59+",
    };
  }

  const ageMatch = normalized.match(/\d{1,3}/);

  if (ageMatch) {
    const age = Number.parseInt(ageMatch[0], 10);

    if (age >= 0 && age <= 18) {
      return { ok: true, value: "0 a 18" };
    }

    if (age <= 23) {
      return { ok: true, value: "19 a 23" };
    }

    if (age <= 33) {
      return { ok: true, value: "24 a 33" };
    }

    if (age <= 43) {
      return { ok: true, value: "34 a 43" };
    }

    if (age <= 53) {
      return { ok: true, value: "44 a 53" };
    }

    if (age <= 58) {
      return { ok: true, value: "54 a 58" };
    }

    return { ok: true, value: "59+" };
  }

  return {
    ok: false,
    retryMessage:
      "Informe a sua faixa etária usando uma idade ou escolha uma das opções de 1 a 7.",
  };
}

function parseBeneficiariesAnswer(value, answers = {}) {
  const parsedAnswer = parsePositiveIntegerAnswer(value, "Quantidade de vidas");

  if (!parsedAnswer.ok) {
    return parsedAnswer;
  }

  if (requiresMinimumTwoLives(answers.planType) && parsedAnswer.value < 2) {
    return {
      ok: false,
      retryMessage: `Para plano ${String(answers.planType || "").toLowerCase()}, informe no mínimo 2 vidas.`,
    };
  }

  return parsedAnswer;
}

function parseBeneficiaryAgeRangesAnswer(value, state = {}) {
  const parsedAnswer = parseAgeRangeAnswer(value);

  if (!parsedAnswer.ok) {
    return parsedAnswer;
  }

  return {
    ok: true,
    value: [...getBeneficiaryAgeRanges(state.answers), parsedAnswer.value],
  };
}

function parseCityStateAnswer(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return {
      ok: false,
      retryMessage: "Informe sua cidade e estado. Ex: Curitiba - PR",
    };
  }

  const match = trimmed.match(/^(.+?)\s*[-\/,]\s*([A-Za-z]{2})\s*$/);

  if (match) {
    const city = match[1].trim().slice(0, 120);
    const uf = match[2].toUpperCase();
    return { ok: true, value: { city, state: uf } };
  }

  const ufMatch = trimmed.match(/^(.+?)\s+([A-Za-z]{2})\s*$/);

  if (ufMatch) {
    const potentialUf = ufMatch[2].toUpperCase();
    const knownUfs = new Set([...STATE_NAME_TO_UF.values()]);
    if (knownUfs.has(potentialUf)) {
      return { ok: true, value: { city: ufMatch[1].trim().slice(0, 120), state: potentialUf } };
    }
  }

  const stateFromName = STATE_NAME_TO_UF.get(normalizeComparableText(trimmed));

  if (stateFromName) {
    return { ok: true, value: { city: "", state: stateFromName } };
  }

  return { ok: true, value: { city: trimmed.slice(0, 120), state: "" } };
}

function ageToRange(age) {
  if (age >= 0 && age <= 18) return "0 a 18";
  if (age <= 23) return "19 a 23";
  if (age <= 33) return "24 a 33";
  if (age <= 43) return "34 a 43";
  if (age <= 53) return "44 a 53";
  if (age <= 58) return "54 a 58";
  return "59+";
}

function parseAgesListAnswer(value, state = {}) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return {
      ok: false,
      retryMessage: "Informe as idades separadas por vírgula. Ex: 35, 33, 8",
    };
  }

  const parts = trimmed.split(/[,;\/\s]+/).filter(Boolean);
  const ages = parts.map((p) => Number.parseInt(p.replace(/\D/g, ""), 10)).filter((n) => Number.isInteger(n) && n >= 0 && n <= 120);

  if (ages.length === 0) {
    return {
      ok: false,
      retryMessage: "Não consegui entender as idades. Informe separadas por vírgula. Ex: 35, 33, 8",
    };
  }

  const answers = state.answers || {};
  const minLives = requiresMinimumTwoLives(answers.planType) ? 2 : 1;

  if (ages.length < minLives) {
    return {
      ok: false,
      retryMessage: `Para plano ${String(answers.planType || "").toLowerCase()}, informe no mínimo ${minLives} idades.`,
    };
  }

  return {
    ok: true,
    value: {
      beneficiaries: ages.length,
      ageRanges: ages.map(ageToRange),
      primaryAgeRange: ageToRange(ages[0]),
    },
  };
}

function parseSingleAgeAnswer(value) {
  const trimmed = String(value || "").trim();
  const ageMatch = trimmed.match(/\d{1,3}/);

  if (!ageMatch) {
    return parseAgeRangeAnswer(value);
  }

  const age = Number.parseInt(ageMatch[0], 10);

  if (age < 0 || age > 120) {
    return { ok: false, retryMessage: "Informe uma idade valida." };
  }

  return { ok: true, value: ageToRange(age) };
}

function parsePlanTypeAnswer(value) {
  const normalized = normalizeComparableText(value);
  const numericChoice = parseNumericChoice(value);

  if (numericChoice >= 1 && numericChoice <= PLAN_TYPE_CHOICES.length) {
    return {
      ok: true,
      value: PLAN_TYPE_CHOICES[numericChoice - 1],
    };
  }

  if (!normalized) {
    return {
      ok: false,
      retryMessage:
        "Escolha um tipo de plano válido de 1 a 5 ou responda com o nome da opção.",
    };
  }

  if (normalized.includes("individual") || normalized.includes("pra mim") || normalized.includes("so pra mim") || normalized.includes("sozinho")) {
    return { ok: true, value: "Individual" };
  }

  if (normalized.includes("familiar") || normalized.includes("familia")) {
    return { ok: true, value: "Familiar" };
  }

  if (normalized === "mei") {
    return { ok: true, value: "MEI" };
  }

  if (normalized.includes("entidade") || normalized.includes("sindicato") || normalized.includes("classe")) {
    return { ok: true, value: "Entidade de classe / sindicato" };
  }

  if (normalized.includes("empresa") || normalized.includes("empresarial") || normalized === "pj") {
    return { ok: true, value: "Empresarial" };
  }

  const matchedOption = PLAN_TYPE_CHOICES.find(
    (option) => normalizeComparableText(option) === normalized
  );

  if (matchedOption) {
    return {
      ok: true,
      value: matchedOption,
    };
  }

  return {
    ok: false,
    retryMessage:
      "Responda com 1, 2, 3, 4 ou 5, ou informe o nome do tipo de plano desejado.",
  };
}

function parseContractTypeAnswer(value) {
  const normalized = normalizeComparableText(value);
  const numericChoice = parseNumericChoice(value);

  if (numericChoice === 1) {
    return {
      ok: true,
      value: "Primeiro plano",
    };
  }

  if (numericChoice === 2) {
    return {
      ok: true,
      value: "Trocar de plano",
    };
  }

  if (!normalized) {
    return {
      ok: false,
      retryMessage: "Responda com 1 para Primeiro plano ou 2 para Trocar de plano.",
    };
  }

  if (
    normalized.includes("primeiro") ||
    normalized.includes("novo") ||
    normalized.includes("primeira vez")
  ) {
    return {
      ok: true,
      value: "Primeiro plano",
    };
  }

  if (
    normalized.includes("trocar") ||
    normalized.includes("renov") ||
    normalized.includes("troca") ||
    normalized.includes("migr") ||
    normalized.includes("portabilidade")
  ) {
    return {
      ok: true,
      value: "Trocar de plano",
    };
  }

  return {
    ok: false,
    retryMessage: "Responda com 1 para Primeiro plano ou 2 para Trocar de plano.",
  };
}

async function parseOperatorInterestAnswer(value, choices) {
  const availableChoices = Array.isArray(choices) && choices.length ? choices : await getOperatorInterestChoices();
  const normalized = normalizeComparableText(value);
  const numericChoice = parseNumericChoice(value);

  if (numericChoice >= 1 && numericChoice <= availableChoices.length) {
    return {
      ok: true,
      value: availableChoices[numericChoice - 1],
    };
  }

  if (!normalized) {
    return {
      ok: false,
      retryMessage: buildOperatorInterestRetryMessage(availableChoices),
    };
  }

  const matchedOption = availableChoices.find((option) => {
    const normalizedOption = normalizeComparableText(option);

    return (
      normalizedOption === normalized ||
      normalized.includes(normalizedOption) ||
      normalizedOption.includes(normalized)
    );
  }
  );

  if (matchedOption) {
    return {
      ok: true,
      value: matchedOption,
    };
  }

  return {
    ok: false,
    retryMessage: buildOperatorInterestRetryMessage(availableChoices),
  };
}

function parseCoparticipationAnswer(value) {
  const normalized = normalizeComparableText(value);
  const numericChoice = parseNumericChoice(value);

  if (numericChoice === 1) {
    return {
      ok: true,
      value: "Com coparticipação",
    };
  }

  if (numericChoice === 2) {
    return {
      ok: true,
      value: "Sem coparticipação",
    };
  }

  if (!normalized) {
    return {
      ok: false,
      retryMessage: "Responda com 1 para Com coparticipação ou 2 para Sem coparticipação.",
    };
  }

  if (normalized.includes("sem")) {
    return {
      ok: true,
      value: "Sem coparticipação",
    };
  }

  if (normalized.includes("com")) {
    return {
      ok: true,
      value: "Com coparticipação",
    };
  }

  return {
    ok: false,
    retryMessage: "Responda com 1 para Com coparticipação ou 2 para Sem coparticipação.",
  };
}

function parseCoverageAnswer(value) {
  const normalized = normalizeComparableText(value);
  const numericChoice = parseNumericChoice(value);

  if (numericChoice === 1) {
    return {
      ok: true,
      value: "Regional",
    };
  }

  if (numericChoice === 2) {
    return {
      ok: true,
      value: "Nacional",
    };
  }

  if (!normalized) {
    return {
      ok: false,
      retryMessage: "Responda com 1 para Regional ou 2 para Nacional.",
    };
  }

  if (normalized.includes("regional")) {
    return {
      ok: true,
      value: "Regional",
    };
  }

  if (normalized.includes("nacional")) {
    return {
      ok: true,
      value: "Nacional",
    };
  }

  return {
    ok: false,
    retryMessage: "Responda com 1 para Regional ou 2 para Nacional.",
  };
}

function parseUrgencyAnswer(value) {
  const normalized = normalizeComparableText(value);
  const numericChoice = parseNumericChoice(value);

  if (numericChoice === 1) {
    return {
      ok: true,
      value: "Baixa",
    };
  }

  if (numericChoice === 2) {
    return {
      ok: true,
      value: "Média",
    };
  }

  if (numericChoice === 3) {
    return {
      ok: true,
      value: "Alta",
    };
  }

  if (!normalized) {
    return {
      ok: false,
      retryMessage: "Responda com 1 para Baixa, 2 para Média ou 3 para Alta.",
    };
  }

  if (normalized.includes("alta") || normalized.includes("urgente")) {
    return {
      ok: true,
      value: "Alta",
    };
  }

  if (normalized.includes("baixa")) {
    return {
      ok: true,
      value: "Baixa",
    };
  }

  if (normalized.includes("media")) {
    return {
      ok: true,
      value: "Média",
    };
  }

  return {
    ok: false,
    retryMessage: "Responda com 1 para Baixa, 2 para Média ou 3 para Alta.",
  };
}

function parseBooleanAnswer(value, fieldLabel) {
  const numericChoice = parseNumericChoice(value);
  const normalized = normalizeComparableText(value);

  if (numericChoice === 1) {
    return {
      ok: true,
      value: true,
    };
  }

  if (numericChoice === 2) {
    return {
      ok: true,
      value: false,
    };
  }

  if (!normalized) {
    return {
      ok: false,
      retryMessage: `Responda com 1 para sim ou 2 para não em "${fieldLabel}".`,
    };
  }

  if (YES_ANSWER_TOKENS.has(normalized)) {
    return {
      ok: true,
      value: true,
    };
  }

  if (NO_ANSWER_TOKENS.has(normalized)) {
    return {
      ok: true,
      value: false,
    };
  }

  return {
    ok: false,
    retryMessage: `Responda com 1 para sim ou 2 para não em "${fieldLabel}".`,
  };
}

function parseDateAnswer(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed) {
    return {
      ok: false,
      retryMessage: "Informe a data em DD/MM/AAAA, YYYY-MM-DD ou MM/AAAA.",
    };
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return {
      ok: true,
      value: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`,
    };
  }

  const dateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dateMatch) {
    return {
      ok: true,
      value: `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`,
    };
  }

  const monthMatch = trimmed.match(/^(\d{2})\/(\d{4})$/);
  if (monthMatch) {
    return {
      ok: true,
      value: `${monthMatch[2]}-${monthMatch[1]}-01`,
    };
  }

  return {
    ok: false,
    retryMessage: "Informe a data em DD/MM/AAAA, YYYY-MM-DD ou MM/AAAA.",
  };
}

function parseCnpjAnswer(value) {
  const normalized = normalizePhone(String(value || ""));

  if (!normalized || normalized.length !== 14) {
    return {
      ok: false,
      retryMessage: "Informe um CNPJ com 14 dígitos para continuar o cadastro.",
    };
  }

  return {
    ok: true,
    value: normalized,
  };
}

function buildChannelPlanTypePrompt(channelKey) {
  const cfg = getChannelBotConfig(channelKey);
  const labels = channelKey === "instagram"
    ? ["So pra mim", "Familiar", "Empresarial", "MEI", "Entidade/Sindicato"]
    : ["Individual", "Familiar", "Empresarial", "MEI", "Entidade de classe / sindicato"];
  const lines = labels.map((l, i) => `${cfg.optionPrefix(i + 1)} ${l}`);
  const question = channelKey === "instagram"
    ? "Que tipo de plano voce busca?"
    : "Que tipo de plano você está buscando?";
  return `${question}\n\n${lines.join("\n")}`;
}

function buildChannelContractTypePrompt(channelKey) {
  const cfg = getChannelBotConfig(channelKey);
  if (channelKey === "instagram") {
    return `Primeiro plano ou troca de operadora?\n\n${cfg.optionPrefix(1)} Primeiro plano\n${cfg.optionPrefix(2)} Trocar`;
  }
  return `Você está buscando o primeiro plano de saúde ou quer trocar de operadora?\n\n${cfg.optionPrefix(1)} Primeiro plano\n${cfg.optionPrefix(2)} Trocar de plano`;
}

function buildChannelUrgencyPrompt(channelKey) {
  const cfg = getChannelBotConfig(channelKey);
  if (channelKey === "instagram") {
    return `Pra quando precisa?\n\n${cfg.optionPrefix(1)} Sem pressa\n${cfg.optionPrefix(2)} Proximas semanas\n${cfg.optionPrefix(3)} Urgente`;
  }
  return `Para quando você precisa do plano?\n\n${cfg.optionPrefix(1)} Sem pressa\n${cfg.optionPrefix(2)} Próximas semanas\n${cfg.optionPrefix(3)} O mais rápido possível`;
}

function buildChannelAgesPrompt(channelKey, answers = {}) {
  const planType = String(answers.planType || "").toLowerCase();
  if (channelKey === "instagram") {
    return `Quantas pessoas no total?\nE a idade de cada uma:\n(ex: 35, 33, 8)`;
  }
  return `Quantas pessoas no total serão incluídas? E a idade de cada uma, separadas por vírgula.\n(ex: 35, 33, 8, 5)`;
}

function buildChannelPhonePrompt(channelKey) {
  if (channelKey === "instagram") {
    return "Me passa seu WhatsApp com DDD?\n(nosso consultor vai te chamar por la)";
  }
  return "Qual o seu telefone com DDD?\n(de preferência um WhatsApp, pra facilitar o contato do consultor)";
}

function buildChannelOperatorPrompt(channelKey) {
  if (channelKey === "instagram") {
    return null;
  }
  const bold = getChannelBotConfig(channelKey).usesBold;
  const pref = bold ? "*Sem preferência*" : "Sem preferência";
  return `Tem preferência por alguma operadora?\nDigite o nome ou responda ${pref}.`;
}

function parseSimpleOperatorAnswer(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return { ok: false, retryMessage: "Digite o nome da operadora ou responda Sem preferência." };
  }
  return { ok: true, value: trimmed.slice(0, 120) };
}

function parseUrgencyAnswerNew(value) {
  const normalized = normalizeComparableText(value);
  const numericChoice = parseNumericChoice(value);

  if (numericChoice === 1) return { ok: true, value: "Baixa" };
  if (numericChoice === 2) return { ok: true, value: "Média" };
  if (numericChoice === 3) return { ok: true, value: "Alta" };

  if (!normalized) {
    return { ok: false, retryMessage: "Responda com 1, 2 ou 3." };
  }

  if (normalized.includes("pressa") || normalized.includes("baixa") || normalized.includes("calma")) {
    return { ok: true, value: "Baixa" };
  }
  if (normalized.includes("semana") || normalized.includes("media") || normalized.includes("breve")) {
    return { ok: true, value: "Média" };
  }
  if (normalized.includes("rapido") || normalized.includes("urgente") || normalized.includes("alta") || normalized.includes("agora")) {
    return { ok: true, value: "Alta" };
  }

  return { ok: false, retryMessage: "Responda com 1, 2 ou 3." };
}

function getLeadQualificationStepsForChannel(channelKey) {
  const ch = normalizeChannelKey(channelKey);
  const cfg = getChannelBotConfig(ch);
  const needsPhone = ch !== "whatsapp";

  const steps = [
    {
      key: "fullName",
      prompt: () => ch === "instagram"
        ? "Qual o seu nome completo?"
        : "Pra começar, qual o seu *nome completo*?".replace(/\*/g, cfg.usesBold ? "*" : ""),
      parse: (value) => {
        const trimmed = String(value || "").trim();
        if (!trimmed) return { ok: false, retryMessage: "Não consegui entender. Pode digitar seu nome completo?" };
        return { ok: true, value: trimmed.slice(0, 190) };
      },
    },
  ];

  if (needsPhone) {
    steps.push({
      key: "phone",
      prompt: () => buildChannelPhonePrompt(ch),
      isActive: ({ context, answers }) => !answers.phone && !context.normalizedPhone,
      parse: (value) => {
        const result = parsePhoneAnswer(value);
        if (!result.ok) return { ok: false, retryMessage: "Hmm, não consegui entender o número. Pode enviar com DDD? Ex: 41999998888" };
        return result;
      },
    });
  }

  steps.push(
    {
      key: "cityState",
      prompt: ({ answers }) => {
        const name = answers.fullName ? answers.fullName.split(" ")[0] : "";
        if (ch === "instagram") {
          return `Qual sua cidade e estado?\n(ex: Curitiba - PR)`;
        }
        const greeting = name ? `Prazer, ${cfg.usesBold ? `*${name}*` : name}! ` : "";
        return `${greeting}Em qual cidade e estado você mora?\n(ex: Curitiba - PR)`;
      },
      parse: parseCityStateAnswer,
    },
    {
      key: "planType",
      prompt: () => buildChannelPlanTypePrompt(ch),
      parse: parsePlanTypeAnswer,
    },
    {
      key: "ageRange",
      prompt: () => ch === "instagram" ? "Qual sua idade?" : "Qual a sua idade?",
      isActive: ({ answers }) => {
        if (!answers.planType) return false;
        if (answers.planType === "Individual" || answers.planType === "Entidade de classe / sindicato") return true;
        return false;
      },
      parse: parseSingleAgeAnswer,
    },
    {
      key: "agesBundle",
      prompt: ({ answers }) => buildChannelAgesPrompt(ch, answers),
      isActive: ({ answers }) => shouldAskBeneficiariesForPlan(answers.planType),
      parse: (value, state) => parseAgesListAnswer(value, state),
    },
    {
      key: "contractType",
      prompt: () => buildChannelContractTypePrompt(ch),
      parse: parseContractTypeAnswer,
    },
    {
      key: "currentPlan",
      prompt: () => ch === "instagram" ? "Qual operadora voce tem hoje?" : "Qual operadora você tem hoje?",
      isActive: ({ answers }) => answers.contractType === "Trocar de plano",
      parse: (value) => parseRequiredTextAnswer(value, "Plano atual", { maxLength: 120 }),
    },
  );

  if (ch !== "instagram") {
    steps.push({
      key: "operatorInterest",
      prompt: () => buildChannelOperatorPrompt(ch),
      parse: parseSimpleOperatorAnswer,
    });
  }

  steps.push({
    key: "urgency",
    prompt: () => buildChannelUrgencyPrompt(ch),
    parse: parseUrgencyAnswerNew,
  });

  return steps;
}

const LEAD_QUALIFICATION_STEPS = getLeadQualificationStepsForChannel("whatsapp");

function inferDirection(payload, status, eventType = "") {
  const normalizedEventType = String(eventType || "")
    .trim()
    .toLowerCase();
  const rawDirection = pickFirstString(payload, [
    "direction",
    "event.direction",
    "data.direction",
    "message.direction",
  ]).toLowerCase();
  const authorType = pickFirstString(payload, [
    "author.type",
    "message.author.type",
    "data.author.type",
  ]).toLowerCase();
  const rawUserType = pickFirstString(payload, [
    "raw_message.message.userType",
    "raw_message.userType",
    "message.userType",
    "data.message.userType",
  ]).toLowerCase();

  if (normalizedEventType === "message_sent") {
    return "outbound";
  }

  if (normalizedEventType === "message_received") {
    return "inbound";
  }

  if (normalizedEventType === "message_logs") {
    return "status";
  }

  if (rawDirection.includes("out") || rawDirection.includes("send")) {
    return "outbound";
  }

  if (rawDirection.includes("in") || rawDirection.includes("receive")) {
    return "inbound";
  }

  const fromMe = pickFirstValue(payload, [
    "fromMe",
    "isFromMe",
    "message.fromMe",
    "data.fromMe",
  ]);

  if (typeof fromMe === "boolean") {
    return fromMe ? "outbound" : "inbound";
  }

  if (
    ["atendente", "attendant", "agent", "crm", "sistema", "system", "bot"].includes(authorType) ||
    rawUserType === "sender"
  ) {
    return "outbound";
  }

  if (authorType === "usuario" || rawUserType === "receiver") {
    return "inbound";
  }

  if (status && !pickFirstString(payload, ["body", "message", "text", "data.body", "data.text"])) {
    return "status";
  }

  return "inbound";
}

function inferMessageType(payload, mediaUrl = "") {
  const rawType = pickFirstString(payload, [
    "messageType",
    "message.type",
    "data.messageType",
    "data.type",
    "type",
  ]).toLowerCase();

  if (["text", "image", "video", "document", "voice", "audio", "template"].includes(rawType)) {
    return rawType === "audio" ? "voice" : rawType;
  }

  if (mediaUrl) {
    return "document";
  }

  return "text";
}

function extractMessageBody(payload) {
  return pickFirstString(payload, [
    "body",
    "text",
    "message",
    "message.mensagem",
    "message.body",
    "message.text",
    "raw_message.content",
    "data.body",
    "data.text",
    "content.text",
    "caption",
    "message.caption",
    "payload.entry.0.changes.0.value.messages.0.text.body",
  ]);
}

function extractMediaUrl(payload) {
  return pickFirstString(payload, [
    "media.url",
    "attachment.url",
    "document.url",
    "image.url",
    "video.url",
    "audio.url",
    "message.url",
    "message.mediaUrl",
    "data.url",
    "url",
  ]);
}

function extractFileName(payload) {
  return pickFirstString(payload, [
    "fileName",
    "filename",
    "document.fileName",
    "attachment.fileName",
    "message.fileName",
  ]);
}

function buildPreview({ body, mediaUrl, messageType, status }) {
  if (body) {
    return body.slice(0, 255);
  }

  if (status === "failed") {
    return "Falha no envio da mensagem.";
  }

  if (mediaUrl) {
    switch (messageType) {
      case "image":
        return "Imagem";
      case "video":
        return "Video";
      case "voice":
        return "Audio";
      case "document":
      default:
        return "Arquivo";
    }
  }

  return "";
}

function isConversationLifecycleEvent(eventType = "") {
  const normalized = String(eventType || "").trim().toLowerCase();
  return ["conversation_created", "conversation_closed"].includes(normalized);
}

function shouldPersistMessage(extracted) {
  if (isConversationLifecycleEvent(extracted.eventType)) {
    return false;
  }

  if (extracted.direction === "status") {
    return Boolean(extracted.externalMessageId || extracted.status);
  }

  return Boolean(
    extracted.body ||
      extracted.mediaUrl ||
      extracted.externalMessageId ||
      (extracted.messageType && extracted.messageType !== "text")
  );
}

function buildEventKey(departmentId, payload) {
  const explicitKey = pickFirstString(payload, [
    "eventId",
    "messageId",
    "message.id",
    "message._id",
    "data.messageId",
    "data.id",
    "id",
  ]);

  if (explicitKey) {
    return `${departmentId || "global"}:${explicitKey}`;
  }

  return crypto
    .createHash("sha1")
    .update(`${departmentId || "global"}:${safeJsonStringify(payload)}`)
    .digest("hex");
}

function buildMessageDedupeKey(conversationId, extracted) {
  if (extracted.externalMessageId) {
    return extracted.externalMessageId;
  }

  const signature = [
    conversationId,
    extracted.direction,
    extracted.messageType,
    extracted.body,
    extracted.mediaUrl,
    extracted.status,
    extracted.sentAt ? extracted.sentAt.toISOString() : "",
  ].join("|");

  return crypto.createHash("sha1").update(signature).digest("hex");
}

function mapConversationRow(row) {
  return {
    id: row.id,
    externalId: row.external_id,
    source: row.source,
    channel: getChannelLabel(row.channel),
    channelKey: normalizeChannelKey(row.channel),
    departmentId: row.department_id,
    departmentName: row.department_name,
    leadId: row.lead_id,
    leadName: row.lead_name,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    chatId: row.chat_id,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    contactAvatarUrl: row.contact_avatar_url,
    protocol: row.protocol,
    status: row.status,
    unreadCount: Number(row.unread_count || 0),
    lastMessagePreview: row.last_message_preview,
    lastMessageAt: row.last_message_at,
    updatedAt: row.updated_at,
  };
}

function mapMessageRow(row) {
  return {
    id: row.id,
    externalMessageId: row.external_message_id,
    direction: row.direction,
    channel: getChannelLabel(row.channel),
    channelKey: normalizeChannelKey(row.channel),
    messageType: row.message_type,
    body: row.body,
    mediaUrl: row.media_url,
    mimeType: row.mime_type,
    fileName: row.file_name,
    status: row.status,
    senderName: row.sender_name,
    senderPhone: row.sender_phone,
    createdBy: row.created_by_name,
    sentAt: row.sent_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
  };
}

function extractRemoteConversationContext(payload = {}) {
  return {
    externalConversationId: pickFirstString(payload, [
      "conversation._id",
      "conversation.id",
      "data.conversation._id",
      "data.conversation.id",
      "_id",
      "id",
      "data._id",
      "data.id",
    ]),
    departmentId: pickFirstString(payload, [
      "conversation.departamento_responsavel_atendimento._id",
      "departamento_responsavel_atendimento._id",
      "conversation.departamento_responsavel_atendimento",
      "departamento_responsavel_atendimento",
      "conversation.departmentId",
      "departmentId",
      "data.conversation.departamento_responsavel_atendimento",
      "data.departmentId",
    ]),
    departmentName: pickFirstString(payload, [
      "conversation.departamento_responsavel_atendimento.nome",
      "departamento_responsavel_atendimento.nome",
      "conversation.departamento_nome",
      "departamento_nome",
      "conversation.departmentName",
      "departmentName",
      "data.conversation.departmentName",
      "data.departmentName",
    ]),
    chatId: pickFirstString(payload, [
      "conversation.chatId",
      "chatId",
      "data.conversation.chatId",
      "data.chatId",
    ]),
    contactName: pickFirstString(payload, [
      "conversation.pushName",
      "conversation.contact.name",
      "conversation.nome",
      "pushName",
      "contact.name",
      "name",
    ]),
    contactPhone: pickFirstString(payload, [
      "conversation.chatId",
      "chatId",
      "conversation.contact.phone",
      "contact.phone",
      "phone",
    ]),
    attendantId: pickFirstString(payload, [
      "conversation.atendente._id",
      "atendente._id",
      "data.conversation.atendente._id",
    ]),
    attendantName: pickFirstString(payload, [
      "conversation.atendente.nome",
      "atendente.nome",
      "data.conversation.atendente.nome",
    ]),
  };
}

function createZapResponderMessageId() {
  return crypto.randomBytes(12).toString("hex");
}

function formatZapResponderChatTime(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = values.day || "00";
  const month = values.month || "00";
  const hours = values.hour || "00";
  const minutes = values.minute || "00";
  return `${day}-${month} ${hours}:${minutes}`;
}

function buildZapResponderTextPayload({ conversationId, chatId, body, senderName }) {
  const sentAt = new Date();
  const messageId = createZapResponderMessageId();
  const trimmedBody = String(body || "").trim();

  return {
    payload: {
      conversa: conversationId,
      mensagem: {
        _id: messageId,
        mensagem: {
          type: "text",
          mensagem: trimmedBody,
          reply: null,
        },
        chatId,
        message: {
          id: sentAt.getTime(),
          _id: messageId,
          message: trimmedBody,
          time: formatZapResponderChatTime(sentAt),
          userType: "sender",
          send_nome: senderName || "CRM",
          typeMessage: "textMessage",
          isFileMessage: false,
          isImageMessage: false,
          createdAt: sentAt.getTime(),
        },
      },
    },
    messageId,
    sentAt,
  };
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function getAutomationUser() {
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        r.slug AS role
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.active = 1
      ORDER BY
        CASE WHEN u.email = ? THEN 0 ELSE 1 END,
        CASE WHEN r.slug = 'admin' THEN 0 WHEN r.slug = 'manager' THEN 1 ELSE 2 END,
        u.id ASC
      LIMIT 1
    `,
    [CONTACT_EMAIL]
  );

  const user = rows[0];

  if (!user) {
    const error = new Error("Nenhum usuário ativo disponível para processar a automação.");
    error.status = 500;
    throw error;
  }

  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: user.role,
    onlyOwnLeads: false,
  };
}

function hasAnswer(answers, key) {
  return Object.prototype.hasOwnProperty.call(answers, key);
}

function buildLeadQualificationInboundToken(extracted = {}) {
  const explicitId = String(extracted.externalMessageId || "").trim();

  if (explicitId) {
    return explicitId;
  }

  const signature = [
    normalizeChannelKey(extracted.channel || ""),
    extracted.chatId || "",
    extracted.direction || "",
    extracted.body || "",
    extracted.mediaUrl || "",
    extracted.sentAt instanceof Date ? extracted.sentAt.toISOString() : "",
  ].join("|");

  if (!signature.replace(/\|/g, "").trim()) {
    return "";
  }

  return crypto.createHash("sha1").update(signature).digest("hex");
}

function clearLeadQualificationInactivityMeta(meta = {}) {
  const nextMeta = { ...(meta || {}) };
  delete nextMeta.inactivityReminderSentAt;
  return nextMeta;
}

function getLeadQualificationReminderSentAt(meta = {}) {
  return toDateTime(meta?.inactivityReminderSentAt);
}

function looksLikeQualificationPrompt(value = "") {
  const normalized = normalizeComparableText(value);

  if (!normalized) {
    return false;
  }

  return QUALIFICATION_PROMPT_MARKERS.some((marker) => normalized.includes(marker));
}

function buildLeadQualificationContext(conversation = {}, extracted = {}, answers = {}) {
  const channelKey = normalizeChannelKey(conversation.channel || extracted.channel);
  const normalizedPhone = normalizePhone(
    answers.phone ||
      conversation.contact_phone ||
      conversation.normalized_phone ||
      extracted.contactPhone ||
      extracted.chatId ||
      ""
  );

  return {
    channelKey,
    channelLabel: getChannelLabel(channelKey),
    normalizedPhone: normalizedPhone || "",
  };
}

function buildInitialLeadQualificationAnswers(conversation = {}, extracted = {}) {
  const answers = {};
  const context = buildLeadQualificationContext(conversation, extracted, answers);

  if (context.normalizedPhone) {
    answers.phone = context.normalizedPhone;
  }

  if (context.channelKey === "whatsapp") {
    answers.hasWhatsapp = true;
  }

  return answers;
}

function isCorruptedLeadQualificationState(state) {
  if (state.status !== QUALIFICATION_STATUS.PENDING) {
    return false;
  }

  if (!state.stepKey) {
    return false;
  }

  return Object.values(state.answers).some(
    (value) => typeof value === "string" && looksLikeQualificationPrompt(value)
  );
}

function getLeadQualificationState(conversation = {}, extracted = {}) {
  const parsedPayload = parseJson(conversation.qualification_payload_json, {});
  const answers =
    parsedPayload && typeof parsedPayload.answers === "object"
      ? { ...parsedPayload.answers }
      : {};
  const meta =
    parsedPayload && typeof parsedPayload.meta === "object" ? { ...parsedPayload.meta } : {};
  let context = buildLeadQualificationContext(conversation, extracted, answers);

  if (context.normalizedPhone && !hasAnswer(answers, "phone")) {
    answers.phone = context.normalizedPhone;
  }

  if (context.channelKey === "whatsapp" && !hasAnswer(answers, "hasWhatsapp")) {
    answers.hasWhatsapp = true;
  }

  let state = {
    status: conversation.qualification_status || QUALIFICATION_STATUS.NOT_STARTED,
    stepKey: conversation.qualification_step_key || "",
    answers,
    meta,
    context,
  };
  if (isCorruptedLeadQualificationState(state)) {
    const resetAnswers = buildInitialLeadQualificationAnswers(conversation, extracted);
    context = buildLeadQualificationContext(conversation, extracted, resetAnswers);
    state = {
      status: QUALIFICATION_STATUS.NOT_STARTED,
      stepKey: "",
      answers: resetAnswers,
      meta: {},
      context,
    };
  }

  return state;
}

function getStepsForState(state) {
  const channelKey = state.context?.channelKey || "whatsapp";
  return getLeadQualificationStepsForChannel(channelKey);
}

function getActiveLeadQualificationSteps(state) {
  return getStepsForState(state).filter(
    (step) => !step.isActive || step.isActive({ answers: state.answers, context: state.context })
  );
}

function isLeadQualificationStepAnswered(step, state) {
  if (typeof step.isAnswered === "function") {
    return step.isAnswered({ answers: state.answers, context: state.context, meta: state.meta });
  }

  return hasAnswer(state.answers, step.key);
}

function findPendingLeadQualificationStep(state) {
  return getActiveLeadQualificationSteps(state).find((step) => !isLeadQualificationStepAnswered(step, state)) || null;
}

function getLeadQualificationStepByKey(stepKey, state) {
  const steps = state ? getStepsForState(state) : LEAD_QUALIFICATION_STEPS;
  return steps.find((step) => step.key === stepKey) || null;
}

function getEffectiveLeadQualificationStep(state) {
  const currentStep = getLeadQualificationStepByKey(state.stepKey, state);

  if (!currentStep) {
    return findPendingLeadQualificationStep(state);
  }

  const stepIsActive =
    !currentStep.isActive || currentStep.isActive({ answers: state.answers, context: state.context });

  if (!stepIsActive || isLeadQualificationStepAnswered(currentStep, state)) {
    return findPendingLeadQualificationStep(state);
  }

  return currentStep;
}

async function buildLeadQualificationPrompt(step, state, { isIntro = false, retryMessage = "" } = {}) {
  const parts = [];

  if (retryMessage) {
    parts.push(retryMessage);
  }

  if (isIntro) {
    const channelKey = state.context?.channelKey || "whatsapp";
    const cfg = getChannelBotConfig(channelKey);
    parts.push(cfg.intro);
  }

  parts.push(typeof step.prompt === "function" ? await step.prompt(state) : step.prompt);

  return parts.filter(Boolean).join("\n\n");
}

function deriveLeadTemperature(answers) {
  if (answers.urgency === "Alta") {
    return "Quente";
  }

  if (answers.urgency === "Média") {
    return "Morno";
  }

  return "Frio";
}

function buildAutomatedLeadTags(answers) {
  const tags = new Set();

  if (answers.urgency === "Alta") {
    tags.add("urgente");
  }

  if (answers.planType === "MEI" || answers.hasActiveMei) {
    tags.add("mei");
  }

  if (answers.planType === "Familiar") {
    tags.add("familiar");
  }

  if (answers.planType === "Entidade de classe / sindicato" || answers.entityName) {
    tags.add("sindicato");
  }

  return [...tags];
}

function buildAutomatedInitialNotes(answers, context) {
  const parts = [`Lead recebido automaticamente via ${context.channelLabel}.`];

  const beneficiaryAgeRanges = getBeneficiaryAgeRanges(answers);

  if (beneficiaryAgeRanges.length) {
    parts.push(
      `Faixas etárias por vida: ${beneficiaryAgeRanges
        .map((range, index) => `Vida ${index + 1}: ${range}`)
        .join("; ")}`
    );
  }

  if (answers.initialNotes) {
    parts.push(`Observacao do lead: ${answers.initialNotes}`);
  }

  return parts.join("\n");
}

async function getNextBrokerForAutoAssignment(connection) {
  // Get all active brokers
  const [brokers] = await connection.query(
    `
      SELECT u.id
      FROM users u
        JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'broker'
        AND u.active = 1
      ORDER BY u.id ASC
    `
  );

  if (brokers.length === 0) {
    return null;
  }

  if (brokers.length === 1) {
    return brokers[0].id;
  }

  // Round-robin: pick broker with the oldest (or no) last assignment
  const [lastAssigned] = await connection.query(
    `
      SELECT la.user_id, MAX(la.created_at) AS last_assigned_at
      FROM lead_assignments la
      WHERE la.user_id IN (${brokers.map(() => "?").join(",")})
      GROUP BY la.user_id
    `,
    brokers.map((b) => b.id)
  );

  const assignmentMap = new Map(lastAssigned.map((row) => [row.user_id, row.last_assigned_at]));

  // Brokers without any assignment go first, then oldest assignment
  const sorted = [...brokers].sort((a, b) => {
    const aTime = assignmentMap.get(a.id);
    const bTime = assignmentMap.get(b.id);
    if (!aTime && !bTime) return a.id - b.id;
    if (!aTime) return -1;
    if (!bTime) return 1;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });

  return sorted[0].id;
}

function buildLeadPayloadFromQualification(state) {
  const { answers, context } = state;

  return {
    fullName: answers.fullName,
    phone: answers.phone || null,
    email: answers.email || "",
    cpf: answers.cpf || "",
    city: (answers.cityState && answers.cityState.city) || answers.city || "",
    state: (answers.cityState && answers.cityState.state) || answers.state || "",
    neighborhood: answers.neighborhood || "",
    ageRange: (answers.agesBundle && answers.agesBundle.primaryAgeRange) || answers.ageRange || "",
    beneficiaryAgeRanges: (answers.agesBundle && answers.agesBundle.ageRanges) || getBeneficiaryAgeRanges(answers),
    beneficiaries: (answers.agesBundle && answers.agesBundle.beneficiaries) || Number(answers.beneficiaries || 1),
    planType: answers.planType || "",
    contractType: answers.contractType || "",
    companyName: answers.companyName || "",
    cnpj: answers.cnpj || "",
    entityName: answers.entityName || "",
    hasActiveCnpj:
      answers.planType === "Empresarial" || answers.planType === "MEI"
        ? Boolean(answers.cnpj)
        : Boolean(answers.hasActiveCnpj),
    hasActiveMei:
      answers.planType === "MEI" ? Boolean(answers.cnpj) : Boolean(answers.hasActiveMei),
    operatorInterest: answers.operatorInterest || "",
    budgetRange: answers.budgetRange || "",
    coparticipation: answers.coparticipation || "",
    coverage: answers.coverage || "",
    urgency: answers.urgency || "Média",
    pipelineStage: "Novo lead",
    status: "Novo lead",
    temperature: deriveLeadTemperature(answers),
    tags: buildAutomatedLeadTags(answers),
    ownerUserId: null,
    origin: getOriginName(context.channelKey),
    sourceCampaign: `Zap Responder - ${context.channelLabel}`,
    notes: "",
    initialNotes: buildAutomatedInitialNotes(answers, context),
    hasWhatsapp:
      context.channelKey === "whatsapp" ? true : Boolean(answers.hasWhatsapp),
    hasCurrentPlan:
      answers.contractType === "Trocar de plano" || Boolean(answers.currentPlan),
    currentPlan: answers.currentPlan || "",
    currentPlanExpiry: answers.currentPlanExpiry || null,
    nextContactAt: new Date(),
    lossReason: "",
    closedAt: null,
  };
}

async function updateConversationQualificationState(
  connection,
  conversationId,
  {
    status,
    stepKey = null,
    answers = {},
    meta = {},
    completed = false,
    questionSent = false,
  } = {}
) {
  await connection.query(
    `
      UPDATE inbox_conversations
      SET
        qualification_status = ?,
        qualification_step_key = ?,
        qualification_payload_json = ?,
        qualification_started_at = COALESCE(qualification_started_at, NOW()),
        qualification_completed_at = CASE
          WHEN ? = 1 THEN COALESCE(qualification_completed_at, NOW())
          ELSE qualification_completed_at
        END,
        qualification_last_question_at = CASE
          WHEN ? = 1 THEN NOW()
          ELSE qualification_last_question_at
        END,
        contact_phone = COALESCE(contact_phone, ?),
        normalized_phone = COALESCE(normalized_phone, ?)
      WHERE id = ?
    `,
    [
      status,
      stepKey,
      safeJsonStringify({ answers, meta }),
      completed ? 1 : 0,
      questionSent ? 1 : 0,
      answers.phone || null,
      normalizePhone(answers.phone || "") || null,
      conversationId,
    ]
  );

  const [rows] = await connection.query("SELECT * FROM inbox_conversations WHERE id = ?", [
    conversationId,
  ]);

  return rows[0] || null;
}

async function markConversationAsIgnoredKnownContact(connection, conversationId) {
  await connection.query(
    `
      UPDATE inbox_conversations
      SET
        lead_id = NULL,
        assigned_user_id = NULL,
        qualification_status = ?,
        qualification_step_key = NULL,
        qualification_payload_json = NULL,
        qualification_started_at = NULL,
        qualification_completed_at = NULL,
        qualification_last_question_at = NULL
      WHERE id = ?
    `,
    [QUALIFICATION_STATUS.IGNORED, conversationId]
  );

  const [rows] = await connection.query("SELECT * FROM inbox_conversations WHERE id = ?", [
    conversationId,
  ]);

  return rows[0] || null;
}

async function linkLeadToConversation(connection, conversationId, lead, answers) {
  await connection.query(
    `
      UPDATE inbox_conversations
      SET
        lead_id = ?,
        assigned_user_id = COALESCE(assigned_user_id, ?),
        qualification_status = ?,
        qualification_step_key = NULL,
        qualification_payload_json = ?,
        qualification_started_at = COALESCE(qualification_started_at, NOW()),
        qualification_completed_at = COALESCE(qualification_completed_at, NOW()),
        contact_phone = COALESCE(contact_phone, ?),
        normalized_phone = COALESCE(normalized_phone, ?)
      WHERE id = ?
    `,
    [
      lead.id,
      lead.ownerUserId || null,
      QUALIFICATION_STATUS.COMPLETED,
      safeJsonStringify({ answers }),
      answers.phone || null,
      normalizePhone(answers.phone || "") || null,
      conversationId,
    ]
  );

  const [rows] = await connection.query("SELECT * FROM inbox_conversations WHERE id = ?", [
    conversationId,
  ]);

  return rows[0] || null;
}

async function sendAutomationConversationMessage(connection, conversation, body, automationUser) {
  const resolvedTarget = await resolveOutboundConversationTarget(conversation);
  const target = await ensureRemoteConversationTarget(resolvedTarget);
  const departmentId = target.departmentId;
  const chatId = target.chatId || normalizePhone(conversation.contact_phone || "");

  if (!departmentId || !chatId || !target.externalConversationId) {
    console.warn(
      `[BOT] sendAutomationConversationMessage: sem target para conversa ${conversation.id}`,
      { departmentId: !!departmentId, chatId: !!chatId, externalConversationId: !!target.externalConversationId }
    );
    return conversation;
  }

  await persistResolvedConversationTarget(connection, conversation.id, target);

  await zapResponderClient.assumeConversationAsAdmin(target.externalConversationId, {
    showChatLogs: true,
  });
  await delay(2200);

  const remoteMessage = buildZapResponderTextPayload({
    conversationId: target.externalConversationId,
    chatId,
    body,
    senderName: automationUser.name || "Veraluz CRM",
  });

  const remoteResponse = await zapResponderClient.sendConversationMessage(
    target.externalConversationId,
    remoteMessage.payload
  );

  const extracted = {
    channel: conversation.channel,
    departmentId,
    departmentName: target.departmentName || conversation.department_name || "",
    externalConversationId: target.externalConversationId || conversation.external_id || "",
    externalMessageId: pickFirstString(remoteResponse, [
      "referenceId",
      "messageId",
      "id",
      "data.messageId",
      "data.id",
    ]),
    direction: "outbound",
    messageType: "text",
    body: body.trim(),
    mediaUrl: "",
    status: "sent",
    sentAt: remoteMessage.sentAt,
    chatId,
    contactPhone: target.contactPhone || conversation.contact_phone || chatId,
    contactName: target.contactName || conversation.contact_name || "",
    rawPayload: remoteResponse,
    shouldPersistMessage: true,
  };

  const updatedConversation = await upsertConversation(connection, extracted);
  await upsertMessage(connection, updatedConversation, extracted, {
    createdBy: automationUser.id,
  });

  return updatedConversation;
}

async function finalizeLeadQualification(connection, conversation, state, automationUser) {
  const leadPayload = buildLeadPayloadFromQualification(state);

  // Round-robin broker auto-assignment
  try {
    const brokerId = await getNextBrokerForAutoAssignment(connection);
    if (brokerId) {
      leadPayload.ownerUserId = brokerId;
    }
  } catch (err) {
    console.error("[BOT] Erro ao obter corretor para auto-atribuicao:", err.message);
  }

  let lead = null;

  try {
    lead = await leadService.createLeadRecord(connection, leadPayload, automationUser);
  } catch (error) {
    if (error.status !== 409) {
      throw error;
    }

    const duplicatedLead =
      error.duplicateLead || (await leadService.findDuplicateLead(connection, leadPayload));

    if (!duplicatedLead) {
      throw error;
    }

    lead = {
      id: duplicatedLead.id,
      fullName: duplicatedLead.full_name,
      ownerUserId: duplicatedLead.owner_user_id || null,
    };
  }

  const linkedConversation = await linkLeadToConversation(
    connection,
    conversation.id,
    lead,
    state.answers
  );

  // Channel-specific completion message
  const channelKey = state.context?.channelKey || "whatsapp";
  const cfg = getChannelBotConfig(channelKey);
  const firstName = (state.answers.fullName || "").split(" ")[0] || "";

  const summaryParts = [];
  if (state.answers.fullName) summaryParts.push(`Nome: ${state.answers.fullName}`);
  if (state.answers.cityState) {
    const cs = state.answers.cityState;
    summaryParts.push(`Cidade: ${cs.city || ""}${cs.state ? ` - ${cs.state}` : ""}`);
  }
  if (state.answers.planType) summaryParts.push(`Tipo: ${state.answers.planType}`);
  if (state.answers.contractType) summaryParts.push(`Contrato: ${state.answers.contractType}`);
  if (state.answers.urgency) summaryParts.push(`Urgência: ${state.answers.urgency}`);

  const completionText = cfg.completionMessage(firstName, summaryParts.join("\n"));

  await sendAutomationConversationMessage(
    connection,
    linkedConversation || conversation,
    completionText,
    automationUser
  );

  // Push notification para o corretor atribuído
  if (lead?.ownerUserId) {
    pushNotificationService.notifyNewLeadAssigned(lead.ownerUserId, {
      leadId: lead.id,
      leadName: state.answers.fullName || "",
      planType: state.answers.planType || "",
      urgency: state.answers.urgency || "",
      channelLabel: cfg.usesBold ? channelKey : state.context?.channelLabel || channelKey,
    }).catch((err) => console.warn("[PUSH] Falha ao notificar corretor:", err.message));
  }

  return linkedConversation || conversation;
}

async function sendLeadQualificationInactivityReminder(connection, conversation, state, automationUser) {
  const currentStep = getEffectiveLeadQualificationStep(state);

  if (!currentStep) {
    return conversation;
  }

  const channelKey = state.context?.channelKey || normalizeChannelKey(conversation.channel);
  const cfg = getChannelBotConfig(channelKey);
  const firstName = (state.answers?.fullName || "").split(" ")[0] || "";
  const reminderText = cfg.reminderText(firstName);

  const updatedConversation = await sendAutomationConversationMessage(
    connection,
    conversation,
    reminderText,
    automationUser
  );

  await updateConversationQualificationState(connection, conversation.id, {
    status: QUALIFICATION_STATUS.PENDING,
    stepKey: currentStep.key,
    answers: state.answers,
    meta: {
      ...clearLeadQualificationInactivityMeta(state.meta),
      inactivityReminderSentAt: new Date().toISOString(),
      lastInboundMessageToken: state.meta?.lastInboundMessageToken || "",
    },
    questionSent: false,
  });

  return updatedConversation || conversation;
}

async function closeLeadQualificationAfterInactivity(connection, conversation, state, automationUser) {
  const channelKey = (state && state.context?.channelKey) || normalizeChannelKey(conversation.channel);
  const cfg = getChannelBotConfig(channelKey);
  const firstName = (state && state.answers?.fullName || "").split(" ")[0] || "";
  const closedText = cfg.closedText(firstName);

  const updatedConversation = await sendAutomationConversationMessage(
    connection,
    conversation,
    closedText,
    automationUser
  );

  await connection.query(
    `
      UPDATE inbox_conversations
      SET
        status = 'closed',
        qualification_status = ?,
        qualification_step_key = NULL,
        qualification_payload_json = NULL,
        qualification_started_at = NULL,
        qualification_completed_at = NULL,
        qualification_last_question_at = NULL
      WHERE id = ?
    `,
    [QUALIFICATION_STATUS.NOT_STARTED, conversation.id]
  );

  const [rows] = await connection.query("SELECT * FROM inbox_conversations WHERE id = ?", [
    conversation.id,
  ]);

  return rows[0] || updatedConversation || conversation;
}

async function processLeadQualificationInactivityForConversation(conversationId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT * FROM inbox_conversations WHERE id = ? LIMIT 1 FOR UPDATE",
      [conversationId]
    );
    const conversation = rows[0];

    if (!conversation) {
      await connection.rollback();
      return false;
    }

    const state = getLeadQualificationState(conversation, {});
    const lastQuestionAt = toDateTime(conversation.qualification_last_question_at);
    const reminderSentAt = getLeadQualificationReminderSentAt(state.meta);
    const now = Date.now();

    if (
      conversation.lead_id ||
      conversation.status === "closed" ||
      state.status !== QUALIFICATION_STATUS.PENDING ||
      !lastQuestionAt
    ) {
      await connection.rollback();
      return false;
    }

    const channelKey = state.context?.channelKey || normalizeChannelKey(conversation.channel);
    const reminderDelayMs = getChannelReminderDelayMs(channelKey);
    const closeAfterReminderMs = getChannelCloseAfterReminderMs(channelKey);

    let actionType = "";

    if (!reminderSentAt && now - lastQuestionAt.getTime() >= reminderDelayMs) {
      await sendLeadQualificationInactivityReminder(
        connection,
        conversation,
        state,
        await getAutomationUser()
      );
      actionType = "inbox.qualification_reminder_sent";
    } else if (
      reminderSentAt &&
      now - reminderSentAt.getTime() >= closeAfterReminderMs
    ) {
      await closeLeadQualificationAfterInactivity(
        connection,
        conversation,
        state,
        await getAutomationUser()
      );
      actionType = "inbox.qualification_closed";
    }

    if (!actionType) {
      await connection.rollback();
      return false;
    }

    await connection.commit();

    broadcastCrmUpdate({
      type: actionType,
      resources: ["inbox", "leads", "dashboard"],
      entityId: conversationId,
    });

    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function processPendingLeadQualificationInactivity() {
  // Use minimum reminder delay across all channels (Instagram = 10min)
  const minReminderMinutes = Math.floor(
    Math.min(
      CHANNEL_BOT_CONFIG.whatsapp.reminderDelayMs,
      CHANNEL_BOT_CONFIG.messenger.reminderDelayMs,
      CHANNEL_BOT_CONFIG.instagram.reminderDelayMs
    ) / 60000
  );

  const [rows] = await pool.query(
    `
      SELECT id
      FROM inbox_conversations
      WHERE qualification_status = ?
        AND lead_id IS NULL
        AND status <> 'closed'
        AND qualification_last_question_at IS NOT NULL
        AND qualification_last_question_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      ORDER BY qualification_last_question_at ASC
      LIMIT ?
    `,
    [QUALIFICATION_STATUS.PENDING, minReminderMinutes, LEAD_QUALIFICATION_MONITOR_BATCH_SIZE]
  );

  for (const row of rows) {
    try {
      await processLeadQualificationInactivityForConversation(row.id);
    } catch (error) {
      console.error(`Falha ao processar inatividade da qualificação da conversa ${row.id}.`);
      console.error(error);
    }
  }
}

function startLeadQualificationInactivityMonitor() {
  if (leadQualificationInactivityMonitor) {
    return;
  }

  leadQualificationInactivityMonitor = setInterval(async () => {
    if (leadQualificationInactivityMonitorRunning) {
      return;
    }

    leadQualificationInactivityMonitorRunning = true;

    try {
      await processPendingLeadQualificationInactivity();
    } finally {
      leadQualificationInactivityMonitorRunning = false;
    }
  }, LEAD_QUALIFICATION_MONITOR_INTERVAL_MS);

  leadQualificationInactivityMonitor.unref?.();
}

async function sendReturningLeadGreeting(connection, conversation, extracted) {
  if (!conversation.lead_id || extracted.direction !== "inbound") {
    return;
  }

  // Cooldown: check if we already sent an outbound message recently
  const [recentOutbound] = await connection.query(
    `
      SELECT sent_at
      FROM inbox_messages
      WHERE conversation_id = ?
        AND direction = 'outbound'
      ORDER BY sent_at DESC
      LIMIT 1
    `,
    [conversation.id]
  );

  if (recentOutbound[0]) {
    const lastOutboundAt = toDateTime(recentOutbound[0].sent_at);
    if (lastOutboundAt && Date.now() - lastOutboundAt.getTime() < RETURNING_LEAD_GREETING_COOLDOWN_MS) {
      console.log(`[BOT] saudação retorno ignorada conv=${conversation.id}: cooldown ativo (última outbound ${lastOutboundAt.toISOString()})`);
      return;
    }
  }

  // Fetch lead name and broker name
  const [leadRows] = await connection.query(
    `
      SELECT l.full_name, u.full_name AS broker_name
      FROM leads l
      LEFT JOIN users u ON u.id = l.owner_user_id
      WHERE l.id = ?
      LIMIT 1
    `,
    [conversation.lead_id]
  );

  const lead = leadRows[0];
  if (!lead) {
    return;
  }

  const channelKey = normalizeChannelKey(extracted.channel || conversation.channel);
  const cfg = getChannelBotConfig(channelKey);
  const firstName = (lead.full_name || "").split(" ")[0] || "";
  const brokerFirstName = (lead.broker_name || "").split(" ")[0] || "";

  const message = cfg.returningLeadMessage(firstName, brokerFirstName);

  const automationUser = await getAutomationUser();
  await sendAutomationConversationMessage(connection, conversation, message, automationUser);

  // Push notification para o corretor atribuído
  if (conversation.assigned_user_id) {
    const channelLabel = getChannelLabel(channelKey);
    pushNotificationService.notifyReturningLead(conversation.assigned_user_id, {
      leadId: conversation.lead_id,
      leadName: lead.full_name || "",
      channelLabel,
    }).catch((err) => console.warn("[PUSH] Falha ao notificar retorno:", err.message));
  }

  console.log(`[BOT] saudação retorno enviada conv=${conversation.id} lead=${conversation.lead_id} channel=${channelKey}`);
}

async function processLeadQualification(connection, conversation, extracted) {
  const channelKey = normalizeChannelKey(extracted.channel);
  const cfg = getChannelBotConfig(channelKey);
  const shouldSkipKnownContact = cfg.skipFollowers && extracted.knownContact;

  if (
    shouldSkipKnownContact ||
    !isSupportedQualificationChannel(extracted.channel) ||
    extracted.direction !== "inbound" ||
    !extracted.shouldPersistMessage
  ) {
    console.log(
      `[BOT] qualificação ignorada conv=${conversation.id}: lead=${!!conversation.lead_id} known=${extracted.knownContact} skipFollowers=${cfg.skipFollowers} channel=${channelKey} dir=${extracted.direction} persist=${extracted.shouldPersistMessage}`
    );
    return conversation;
  }

  // Lead already exists — send returning-lead greeting (with cooldown)
  if (conversation.lead_id) {
    try {
      await sendReturningLeadGreeting(connection, conversation, extracted);
    } catch (err) {
      console.error(`[BOT] Erro ao enviar saudação de retorno conv=${conversation.id}:`, err.message);
    }
    return conversation;
  }

  const automationUser = await getAutomationUser();
  let state = getLeadQualificationState(conversation, extracted);
  const inboundToken = buildLeadQualificationInboundToken(extracted);
  const inboundMeta = {
    ...clearLeadQualificationInactivityMeta(state.meta),
    lastInboundMessageToken: inboundToken || state.meta?.lastInboundMessageToken || "",
  };
  const lastQuestionAt = conversation.qualification_last_question_at
    ? new Date(conversation.qualification_last_question_at)
    : null;

  if (
    state.status === QUALIFICATION_STATUS.COMPLETED ||
    state.status === QUALIFICATION_STATUS.IGNORED
  ) {
    return conversation;
  }

  if (
    state.status === QUALIFICATION_STATUS.PENDING &&
    inboundToken &&
    state.meta?.lastInboundMessageToken === inboundToken
  ) {
    return conversation;
  }

  if (
    state.status === QUALIFICATION_STATUS.PENDING &&
    lastQuestionAt &&
    extracted.sentAt instanceof Date &&
    extracted.sentAt.getTime() <= lastQuestionAt.getTime()
  ) {
    return conversation;
  }

  let currentStep = getEffectiveLeadQualificationStep(state);

  if (state.status === QUALIFICATION_STATUS.NOT_STARTED) {
    if (!currentStep) {
      return finalizeLeadQualification(connection, conversation, state, automationUser);
    }

    await sendAutomationConversationMessage(
      connection,
      conversation,
      await buildLeadQualificationPrompt(currentStep, state, { isIntro: true }),
      automationUser
    );

    return updateConversationQualificationState(connection, conversation.id, {
      status: QUALIFICATION_STATUS.PENDING,
      stepKey: currentStep.key,
      answers: state.answers,
      meta: inboundMeta,
      questionSent: true,
    });
  }

  if (!currentStep) {
    currentStep = getEffectiveLeadQualificationStep(state);
  }

  if (!currentStep) {
    return finalizeLeadQualification(connection, conversation, state, automationUser);
  }

  const parsedAnswer = await currentStep.parse(extracted.body || "", state);

  if (!parsedAnswer.ok) {
    await sendAutomationConversationMessage(
      connection,
      conversation,
      await buildLeadQualificationPrompt(currentStep, state, { retryMessage: parsedAnswer.retryMessage }),
      automationUser
    );

    return updateConversationQualificationState(connection, conversation.id, {
      status: QUALIFICATION_STATUS.PENDING,
      stepKey: currentStep.key,
      answers: state.answers,
      meta: inboundMeta,
      questionSent: true,
    });
  }

  const nextAnswers = {
    ...state.answers,
    [currentStep.key]: parsedAnswer.value,
  };

  state = {
    status: QUALIFICATION_STATUS.PENDING,
    stepKey: currentStep.key,
    answers: nextAnswers,
    meta: inboundMeta,
    context: buildLeadQualificationContext(conversation, extracted, nextAnswers),
  };

  const nextStep = findPendingLeadQualificationStep(state);

  if (!nextStep) {
    return finalizeLeadQualification(connection, conversation, state, automationUser);
  }

  await sendAutomationConversationMessage(
    connection,
    conversation,
    await buildLeadQualificationPrompt(nextStep, state),
    automationUser
  );

  return updateConversationQualificationState(connection, conversation.id, {
    status: QUALIFICATION_STATUS.PENDING,
    stepKey: nextStep.key,
    answers: nextAnswers,
    meta: state.meta,
    questionSent: true,
  });
}

async function ensureConversationForLead({
  leadId,
  fullName = "",
  phone = "",
  email = "",
  ownerUserId = null,
  channel = "whatsapp",
  source = "website_form",
  departmentId = "",
  departmentName = "",
} = {}) {
  if (!leadId) {
    return null;
  }

  const channelKey = normalizeChannelKey(channel);
  const normalizedPhone = normalizePhone(phone || "");

  if (!normalizedPhone) {
    return null;
  }

  let resolvedDepartmentId = departmentId || "";
  let resolvedDepartmentName = departmentName || getChannelLabel(channelKey);

  if (!resolvedDepartmentId) {
    const channels = await listChannels().catch(() => []);
    const matchingChannel =
      channels.find(
        (item) => item.channelKey === channelKey && item.status === "Conectado"
      ) || channels.find((item) => item.channelKey === channelKey);

    resolvedDepartmentId = matchingChannel?.departmentId || "";
    resolvedDepartmentName = matchingChannel?.departmentName || resolvedDepartmentName;
  }

  const [existingRows] = await pool.query(
    `
      SELECT *
      FROM inbox_conversations
      WHERE channel = ?
        AND (lead_id = ? OR normalized_phone = ? OR chat_id = ?)
      ORDER BY CASE WHEN lead_id = ? THEN 0 ELSE 1 END, updated_at DESC, id DESC
      LIMIT 1
    `,
    [channelKey, leadId, normalizedPhone, normalizedPhone, leadId]
  );

  if (existingRows[0]) {
    await pool.query(
      `
        UPDATE inbox_conversations
        SET
          lead_id = COALESCE(lead_id, ?),
          assigned_user_id = COALESCE(assigned_user_id, ?),
          department_id = COALESCE(?, department_id),
          department_name = COALESCE(?, department_name),
          chat_id = COALESCE(chat_id, ?),
          normalized_phone = COALESCE(normalized_phone, ?),
          contact_name = COALESCE(contact_name, ?),
          contact_phone = COALESCE(contact_phone, ?),
          contact_email = COALESCE(contact_email, ?)
        WHERE id = ?
      `,
      [
        leadId,
        ownerUserId || null,
        resolvedDepartmentId || null,
        resolvedDepartmentName || null,
        normalizedPhone,
        normalizedPhone,
        fullName || null,
        phone || normalizedPhone,
        email || null,
        existingRows[0].id,
      ]
    );

    const [rows] = await pool.query("SELECT * FROM inbox_conversations WHERE id = ?", [
      existingRows[0].id,
    ]);

    return rows[0] ? mapConversationRow(rows[0]) : null;
  }

  const [result] = await pool.query(
    `
      INSERT INTO inbox_conversations (
        source, channel, department_id, department_name, lead_id, assigned_user_id, chat_id,
        normalized_phone, contact_name, contact_phone, contact_email, status, raw_payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `,
    [
      source,
      channelKey,
      resolvedDepartmentId || null,
      resolvedDepartmentName || null,
      leadId,
      ownerUserId || null,
      normalizedPhone,
      normalizedPhone,
      fullName || null,
      phone || normalizedPhone,
      email || null,
      safeJsonStringify({
        createdBy: "ensureConversationForLead",
        source,
      }),
    ]
  );

  const [rows] = await pool.query("SELECT * FROM inbox_conversations WHERE id = ?", [
    result.insertId,
  ]);

  return rows[0] ? mapConversationRow(rows[0]) : null;
}

async function findLeadByNormalizedPhone(normalizedPhone) {
  if (!normalizedPhone) {
    return null;
  }

  const [rows] = await pool.query(
    `
      SELECT id, full_name, owner_user_id
      FROM leads
      WHERE normalized_phone = ?
      LIMIT 1
    `,
    [normalizedPhone]
  );

  return rows[0] || null;
}

async function resolveLeadForConversation(connection, extracted, existingConversation = null) {
  const channelKey = normalizeChannelKey(extracted.channel || existingConversation?.channel);
  const cfgResolve = getChannelBotConfig(channelKey);
  const shouldSkipKnown = cfgResolve.skipFollowers && extracted.knownContact;

  if (
    shouldSkipKnown ||
    existingConversation?.qualification_status === QUALIFICATION_STATUS.IGNORED
  ) {
    return null;
  }

  if (existingConversation?.lead_id) {
    return {
      id: existingConversation.lead_id,
      fullName: existingConversation.contact_name || "",
      ownerUserId: existingConversation.assigned_user_id || null,
    };
  }

  const normalizedPhone = normalizePhone(
    extracted.contactPhone ||
      existingConversation?.contact_phone ||
      existingConversation?.normalized_phone ||
      extracted.chatId ||
      existingConversation?.chat_id ||
      ""
  );
  const existingLead = await findLeadByNormalizedPhone(normalizedPhone);

  if (existingLead) {
    return {
      id: existingLead.id,
      fullName: existingLead.full_name,
      ownerUserId: existingLead.owner_user_id,
    };
  }

  return null;
}

async function findConversationRecord(connection, extracted) {
  if (extracted.externalConversationId) {
    const [rows] = await connection.query(
      `
        SELECT *
        FROM inbox_conversations
        WHERE external_id = ?
        LIMIT 1
      `,
      [extracted.externalConversationId]
    );

    if (rows[0]) {
      return rows[0];
    }
  }

  if (extracted.departmentId && extracted.chatId) {
    const [rows] = await connection.query(
      `
        SELECT *
        FROM inbox_conversations
        WHERE department_id = ? AND chat_id = ?
        LIMIT 1
      `,
      [extracted.departmentId, extracted.chatId]
    );

    if (rows[0]) {
      return rows[0];
    }
  }

  return null;
}

function extractWebhookEvent(payload, department = null, departmentId = "") {
  const eventType = pickFirstString(payload, ["event", "type", "hookEvent"]) || "message";
  const mediaUrl = extractMediaUrl(payload);
  let status = normalizeMessageStatus(
    pickFirstString(payload, [
      "status",
      "event",
      "message.status",
      "data.status",
      "ack",
      "ackStatus",
      "message.ack",
      "payload.entry.0.changes.0.value.statuses.0.status",
    ])
  );

  if (!status && String(eventType).toLowerCase() === "conversation_closed") {
    status = "closed";
  }

  const channel = normalizeChannelKey(
    pickFirstString(payload, [
      "channel",
      "application",
      "aplicacao",
      "conversation.channel",
      "conversation.application",
      "data.channel",
      "data.application",
    ]) || department?.nome || ""
  );

  const direction = inferDirection(payload, status, eventType);
  const body = extractMessageBody(payload);
  const messageType = inferMessageType(payload, mediaUrl);
  const chatId = pickFirstString(payload, [
    "chatId",
    "raw_message.from",
    "message.chatId",
    "conversation.chatId",
    "data.chatId",
    "contact.phone",
    "contact.chatId",
    "sender.phone",
    "number",
    "from",
    "payload.entry.0.changes.0.value.contacts.0.wa_id",
    "payload.entry.0.changes.0.value.messages.0.from",
  ]);
  const contactPhone = pickFirstString(payload, [
    "phone",
    "contact.phone",
    "sender.phone",
    "data.phone",
  ]) || chatId;
  const sentAt =
    toDateTime(
      pickFirstValue(payload, [
        "sentAt",
        "timestamp",
        "createdAt",
        "message.createdAt",
        "message.timestamp",
        "data.createdAt",
        "date",
      ])
    ) || new Date();

  const extracted = {
    eventType,
    channel,
    departmentId: departmentId || department?._id || "",
    departmentName: department?.nome || "",
    externalConversationId: pickFirstString(payload, [
      "_id",
      "conversationId",
      "conversation.id",
      "conversation._id",
      "data.conversationId",
      "chat.id",
    ]),
    externalMessageId: pickFirstString(payload, [
      "raw_message.message._id",
      "raw_message.mensagem._id",
      "mensagem._id",
      "message._id",
      "data.message._id",
      "data.mensagem._id",
      "messageId",
      "raw_message.id",
      "message.id",
      "data.messageId",
      "data.message.id",
      "payload.entry.0.changes.0.value.messages.0.id",
      "payload.entry.0.changes.0.value.statuses.0.id",
    ]),
    protocol: pickFirstString(payload, ["protocol", "conversation.protocol", "data.protocol"]),
    direction,
    messageType,
    body,
    mediaUrl,
    mimeType: pickFirstString(payload, [
      "mimeType",
      "media.mimeType",
      "attachment.mimeType",
      "message.mimeType",
    ]),
    fileName: extractFileName(payload),
    status,
    sentAt,
    deliveredAt:
      normalizeMessageStatus(status) === "delivered"
        ? sentAt
        : toDateTime(pickFirstValue(payload, ["deliveredAt", "data.deliveredAt"])),
    readAt:
      normalizeMessageStatus(status) === "read"
        ? sentAt
        : toDateTime(pickFirstValue(payload, ["readAt", "data.readAt"])),
    failedAt:
      normalizeMessageStatus(status) === "failed"
        ? sentAt
        : toDateTime(pickFirstValue(payload, ["failedAt", "data.failedAt"])),
    chatId,
    contactPhone,
    contactName: pickFirstString(payload, [
      "name",
      "contact.name",
      "sender.name",
      "profile.name",
      "conversation.name",
      "pushName",
      "raw_message.pushName",
      "data.name",
      "payload.entry.0.changes.0.value.contacts.0.profile.name",
    ]),
    contactEmail: pickFirstString(payload, ["email", "contact.email", "sender.email"]),
    contactAvatarUrl: pickFirstString(payload, [
      "profile_pic",
      "avatar",
      "contact.avatar",
      "contact.profilePic",
      "sender.avatar",
    ]),
    knownContact: isSupportedQualificationChannel(channel)
      ? extractKnownContactFlag(payload)
      : false,
    rawPayload: payload,
  };

  extracted.shouldPersistMessage = shouldPersistMessage(extracted);

  return extracted;
}

async function upsertConversation(connection, extracted) {
  const existingConversation = await findConversationRecord(connection, extracted);
  const channelKeyForUpsert = normalizeChannelKey(extracted.channel);
  const cfgForUpsert = getChannelBotConfig(channelKeyForUpsert);
  const shouldIgnoreKnownContact =
    (cfgForUpsert.skipFollowers && extracted.knownContact) ||
    existingConversation?.qualification_status === QUALIFICATION_STATUS.IGNORED;
  const shouldResolveLead = extracted.direction === "inbound";
  const lead = shouldResolveLead
    ? await resolveLeadForConversation(connection, extracted, existingConversation)
    : existingConversation?.lead_id
    ? { id: existingConversation.lead_id, ownerUserId: existingConversation.assigned_user_id || null }
    : null;
  const preview = buildPreview(extracted);
  const nextStatus =
    normalizeMessageStatus(extracted.status) === "closed"
      ? "closed"
      : extracted.direction === "inbound"
      ? "open"
      : existingConversation?.status || "open";
  const unreadIncrement =
    extracted.shouldPersistMessage && extracted.direction === "inbound" ? 1 : 0;
  const lastMessagePreview = extracted.shouldPersistMessage ? preview || null : null;
  const lastMessageAt = extracted.shouldPersistMessage ? extracted.sentAt : null;

  if (!existingConversation) {
    const [result] = await connection.query(
      `
        INSERT INTO inbox_conversations (
          external_id, source, channel, department_id, department_name, lead_id, assigned_user_id,
          chat_id, normalized_phone, contact_name, contact_phone, contact_email, contact_avatar_url,
          protocol, status, last_message_preview, last_message_at, unread_count, raw_payload_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        extracted.externalConversationId || null,
        SYSTEM_SOURCE,
        normalizeChannelKey(extracted.channel),
        extracted.departmentId || null,
        extracted.departmentName || null,
        lead?.id || null,
        lead?.ownerUserId || null,
        extracted.chatId || null,
        normalizePhone(extracted.contactPhone || extracted.chatId || "") || null,
        extracted.contactName || null,
        extracted.contactPhone || null,
        extracted.contactEmail || null,
        extracted.contactAvatarUrl || null,
        extracted.protocol || null,
        nextStatus,
        lastMessagePreview,
        lastMessageAt,
        unreadIncrement,
        safeJsonStringify(extracted.rawPayload),
      ]
    );

    if (shouldIgnoreKnownContact) {
      return markConversationAsIgnoredKnownContact(connection, result.insertId);
    }

    if (lead?.id) {
      await connection.query(
        `
          UPDATE inbox_conversations
          SET
            qualification_status = ?,
            qualification_step_key = NULL,
            qualification_completed_at = COALESCE(qualification_completed_at, NOW())
          WHERE id = ?
        `,
        [QUALIFICATION_STATUS.COMPLETED, result.insertId]
      );
    }

    const [rows] = await connection.query("SELECT * FROM inbox_conversations WHERE id = ?", [
      result.insertId,
    ]);
    return rows[0];
  }

  await connection.query(
    `
      UPDATE inbox_conversations
      SET
        external_id = COALESCE(?, external_id),
        channel = COALESCE(?, channel),
        department_id = COALESCE(?, department_id),
        department_name = COALESCE(?, department_name),
        lead_id = COALESCE(lead_id, ?),
        assigned_user_id = COALESCE(assigned_user_id, ?),
        chat_id = COALESCE(?, chat_id),
        normalized_phone = COALESCE(?, normalized_phone),
        contact_name = COALESCE(?, contact_name),
        contact_phone = COALESCE(?, contact_phone),
        contact_email = COALESCE(?, contact_email),
        contact_avatar_url = COALESCE(?, contact_avatar_url),
        protocol = COALESCE(?, protocol),
        status = ?,
        qualification_status = CASE
          WHEN COALESCE(lead_id, ?) IS NOT NULL THEN ?
          ELSE qualification_status
        END,
        qualification_step_key = CASE
          WHEN COALESCE(lead_id, ?) IS NOT NULL THEN NULL
          ELSE qualification_step_key
        END,
        qualification_completed_at = CASE
          WHEN COALESCE(lead_id, ?) IS NOT NULL THEN COALESCE(qualification_completed_at, NOW())
          ELSE qualification_completed_at
        END,
        last_message_preview = CASE WHEN ? <> '' THEN ? ELSE last_message_preview END,
        last_message_at = CASE
          WHEN ? IS NOT NULL AND (last_message_at IS NULL OR ? >= last_message_at) THEN ?
          ELSE last_message_at
        END,
        unread_count = unread_count + ?,
        raw_payload_json = ?
      WHERE id = ?
    `,
    [
      extracted.externalConversationId || null,
      normalizeChannelKey(extracted.channel),
      extracted.departmentId || null,
      extracted.departmentName || null,
      lead?.id || null,
      lead?.ownerUserId || null,
      extracted.chatId || null,
      normalizePhone(extracted.contactPhone || extracted.chatId || "") || null,
      extracted.contactName || null,
      extracted.contactPhone || null,
      extracted.contactEmail || null,
      extracted.contactAvatarUrl || null,
      extracted.protocol || null,
      nextStatus,
      lead?.id || null,
      QUALIFICATION_STATUS.COMPLETED,
      lead?.id || null,
      lead?.id || null,
      lastMessagePreview || "",
      lastMessagePreview || "",
      lastMessageAt,
      lastMessageAt,
      lastMessageAt,
      unreadIncrement,
      safeJsonStringify(extracted.rawPayload),
      existingConversation.id,
    ]
  );

  if (shouldIgnoreKnownContact) {
    return markConversationAsIgnoredKnownContact(connection, existingConversation.id);
  }

  const [rows] = await connection.query("SELECT * FROM inbox_conversations WHERE id = ?", [
    existingConversation.id,
  ]);
  return rows[0];
}

async function insertLeadTimeline(connection, leadId, payload) {
  await connection.query(
    `
      INSERT INTO lead_timeline (lead_id, title, description, icon, color, event_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      leadId,
      payload.title,
      payload.description || null,
      payload.icon || "chat",
      payload.color || "info",
      payload.eventAt || new Date(),
      payload.createdBy || null,
    ]
  );
}

async function upsertMessage(connection, conversation, extracted, { createdBy = null } = {}) {
  const normalizedStatus = normalizeMessageStatus(extracted.status);
  const dedupeKey = buildMessageDedupeKey(conversation.id, extracted);
  const sentAt = extracted.sentAt || new Date();

  if (extracted.direction === "status" && extracted.externalMessageId) {
    const [result] = await connection.query(
      `
        UPDATE inbox_messages
        SET
          status = COALESCE(?, status),
          delivered_at = COALESCE(?, delivered_at),
          read_at = COALESCE(?, read_at),
          failed_at = COALESCE(?, failed_at),
          raw_payload_json = ?
        WHERE external_message_id = ?
      `,
      [
        normalizedStatus || null,
        extracted.deliveredAt || null,
        extracted.readAt || null,
        extracted.failedAt || null,
        safeJsonStringify(extracted.rawPayload),
        extracted.externalMessageId,
      ]
    );

    if (result.affectedRows) {
      if (conversation.lead_id && normalizedStatus === "failed") {
        await insertLeadTimeline(connection, conversation.lead_id, {
          title: `Falha de envio via ${getChannelLabel(conversation.channel)}`,
          description: buildPreview(extracted) || "A mensagem não foi entregue.",
          color: "error",
          icon: "error",
          eventAt: sentAt,
          createdBy,
        });
      }

      return { inserted: false };
    }
  }

  const [insertResult] = await connection.query(
    `
      INSERT IGNORE INTO inbox_messages (
        conversation_id, external_message_id, dedupe_key, direction, channel, message_type, body,
        media_url, mime_type, file_name, status, sender_name, sender_phone, raw_payload_json,
        created_by, sent_at, delivered_at, read_at, failed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      conversation.id,
      extracted.externalMessageId || null,
      dedupeKey,
      extracted.direction,
      normalizeChannelKey(extracted.channel || conversation.channel),
      extracted.messageType || "text",
      extracted.body || null,
      extracted.mediaUrl || null,
      extracted.mimeType || null,
      extracted.fileName || null,
      normalizedStatus || (extracted.direction === "outbound" ? "sent" : "received"),
      extracted.contactName || null,
      extracted.contactPhone || null,
      safeJsonStringify(extracted.rawPayload),
      createdBy,
      sentAt,
      extracted.deliveredAt || null,
      extracted.readAt || null,
      extracted.failedAt || null,
    ]
  );

  if (!insertResult.affectedRows) {
    await connection.query(
      `
        UPDATE inbox_messages
        SET
          status = COALESCE(?, status),
          delivered_at = COALESCE(?, delivered_at),
          read_at = COALESCE(?, read_at),
          failed_at = COALESCE(?, failed_at),
          raw_payload_json = ?
        WHERE dedupe_key = ?
      `,
      [
        normalizedStatus || null,
        extracted.deliveredAt || null,
        extracted.readAt || null,
        extracted.failedAt || null,
        safeJsonStringify(extracted.rawPayload),
        dedupeKey,
      ]
    );

    return { inserted: false };
  }

  if (conversation.lead_id) {
    const preview = buildPreview(extracted);

    if (extracted.direction === "inbound") {
      await insertLeadTimeline(connection, conversation.lead_id, {
        title: `Mensagem recebida via ${getChannelLabel(conversation.channel)}`,
        description: preview || "Nova mensagem recebida.",
        color: "info",
        icon: "chat",
        eventAt: sentAt,
      });
    }

    if (extracted.direction === "outbound") {
      await insertLeadTimeline(connection, conversation.lead_id, {
        title: `Mensagem enviada via ${getChannelLabel(conversation.channel)}`,
        description: preview || "Mensagem enviada pelo CRM.",
        color: "success",
        icon: "send",
        eventAt: sentAt,
        createdBy,
      });
    }
  }

  return { inserted: true };
}

async function listConversations(user, filters = {}) {
  const visibility = buildLeadVisibilityClause(user, "l");
  const clauses = [
    "COALESCE(c.qualification_status, 'not_started') <> 'ignored_known_contact'",
    "c.lead_id IS NOT NULL",
    "l.id IS NOT NULL",
  ];
  const params = [];

  if (visibility.sql) {
    clauses.push(visibility.sql.replace("WHERE ", ""));
    params.push(...visibility.params);
  }

  if (filters.search) {
    clauses.push(
      "(c.contact_name LIKE ? OR c.contact_phone LIKE ? OR c.chat_id LIKE ? OR l.full_name LIKE ?)"
    );
    params.push(
      `%${filters.search}%`,
      `%${filters.search}%`,
      `%${filters.search}%`,
      `%${filters.search}%`
    );
  }

  if (filters.channel) {
    clauses.push("c.channel = ?");
    params.push(normalizeChannelKey(filters.channel));
  }

  if (filters.status) {
    clauses.push("c.status = ?");
    params.push(filters.status);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        c.*,
        l.full_name AS lead_name,
        l.owner_user_id,
        u.full_name AS owner_name
      FROM inbox_conversations c
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN users u ON u.id = l.owner_user_id
      ${whereSql}
      ORDER BY COALESCE(c.last_message_at, c.updated_at) DESC, c.id DESC
    `,
    params
  );

  return rows.map(mapConversationRow);
}

async function getVisibleConversationOrThrow(conversationId, user, { connection = pool } = {}) {
  const visibility = buildLeadVisibilityClause(user, "l");
  const clauses = [
    "c.id = ?",
    "COALESCE(c.qualification_status, 'not_started') <> 'ignored_known_contact'",
    "c.lead_id IS NOT NULL",
    "l.id IS NOT NULL",
  ];
  const params = [conversationId];

  if (visibility.sql) {
    clauses.push(visibility.sql.replace("WHERE ", ""));
    params.push(...visibility.params);
  }

  const [rows] = await connection.query(
    `
      SELECT
        c.*,
        l.full_name AS lead_name,
        l.owner_user_id,
        u.full_name AS owner_name
      FROM inbox_conversations c
      LEFT JOIN leads l ON l.id = c.lead_id
      LEFT JOIN users u ON u.id = l.owner_user_id
      WHERE ${clauses.join(" AND ")}
      LIMIT 1
    `,
    params
  );

  if (!rows[0]) {
    const error = new Error("Conversa não encontrada.");
    error.status = 404;
    throw error;
  }

  return rows[0];
}

async function getConversationById(conversationId, user) {
  const conversation = await getVisibleConversationOrThrow(conversationId, user);
  await pool.query("UPDATE inbox_conversations SET unread_count = 0 WHERE id = ?", [conversationId]);
  const [messageRows] = await pool.query(
    `
      SELECT
        m.*,
        u.full_name AS created_by_name
      FROM inbox_messages m
      LEFT JOIN users u ON u.id = m.created_by
      WHERE m.conversation_id = ?
      ORDER BY COALESCE(m.sent_at, m.created_at) ASC, m.id ASC
    `,
    [conversationId]
  );

  return {
    ...mapConversationRow({
      ...conversation,
      unread_count: 0,
    }),
    messages: messageRows.map(mapMessageRow),
  };
}

async function resolveDepartmentForConversation(conversation) {
  if (conversation.department_id) {
    return conversation.department_id;
  }

  const channels = await listChannels();
  const match =
    channels.find(
      (item) =>
        item.channelKey === normalizeChannelKey(conversation.channel) &&
        item.status === "Conectado"
    ) || channels.find((item) => item.channelKey === normalizeChannelKey(conversation.channel));
  return match?.departmentId || "";
}

async function resolveOutboundConversationTarget(conversation) {
  const normalizedPhone = normalizePhone(
    conversation.contact_phone || conversation.normalized_phone || conversation.chat_id || ""
  );
  const resolved = {
    chatId: conversation.chat_id || normalizedPhone || "",
    externalConversationId: conversation.external_id || "",
    departmentId: conversation.department_id || "",
    departmentName: conversation.department_name || "",
    contactName: conversation.contact_name || "",
    contactPhone: conversation.contact_phone || normalizedPhone || "",
  };

  if (!resolved.departmentId) {
    resolved.departmentId = await resolveDepartmentForConversation(conversation);
  }

  const lookups = [];

  if (resolved.externalConversationId) {
    lookups.push(() =>
      zapResponderClient.getConversationById(resolved.externalConversationId, {
        includeClosed: true,
      })
    );
  }

  if (normalizedPhone) {
    lookups.push(() =>
      zapResponderClient.findConversationByPhone(normalizedPhone, {
        includeClosed: true,
      })
    );
  }

  for (const lookup of lookups) {
    try {
      const remotePayload = await lookup();
      const remoteConversation = extractRemoteConversationContext(remotePayload);

      resolved.chatId = remoteConversation.chatId || resolved.chatId;
      resolved.externalConversationId =
        remoteConversation.externalConversationId || resolved.externalConversationId;
      resolved.departmentId = remoteConversation.departmentId || resolved.departmentId;
      resolved.departmentName = remoteConversation.departmentName || resolved.departmentName;
      resolved.contactName = remoteConversation.contactName || resolved.contactName;
      resolved.contactPhone = remoteConversation.contactPhone || resolved.contactPhone;

      if (resolved.departmentId && resolved.chatId) {
        break;
      }
    } catch (error) {
      // Ignore transient lookup failures and keep the best local context available.
    }
  }

  return resolved;
}

async function persistResolvedConversationTarget(connection, conversationId, target) {
  await connection.query(
    `
      UPDATE inbox_conversations
      SET
        external_id = COALESCE(?, external_id),
        department_id = COALESCE(?, department_id),
        department_name = COALESCE(?, department_name),
        chat_id = COALESCE(?, chat_id),
        normalized_phone = COALESCE(?, normalized_phone),
        contact_name = COALESCE(?, contact_name),
        contact_phone = COALESCE(?, contact_phone)
      WHERE id = ?
    `,
    [
      target.externalConversationId || null,
      target.departmentId || null,
      target.departmentName || null,
      target.chatId || null,
      normalizePhone(target.contactPhone || target.chatId || "") || null,
      target.contactName || null,
      target.contactPhone || null,
      conversationId,
    ]
  );
}

async function ensureRemoteConversationTarget(target) {
  if (target.externalConversationId || !target.chatId || !target.departmentId) {
    return target;
  }

  const defaultAttendant = await zapResponderClient.getDefaultAttendant().catch(() => null);
  const chatSession = await zapResponderClient.getChatSession();
  const attendantId = defaultAttendant?.id || chatSession.attendantId || "";

  if (!attendantId) {
    return target;
  }

  try {
    const remotePayload = await zapResponderClient.createConversation({
      attendantId,
      chatId: target.chatId,
      departmentId: target.departmentId,
    });
    const remoteConversation = extractRemoteConversationContext(remotePayload);

    return {
      ...target,
      externalConversationId:
        remoteConversation.externalConversationId || target.externalConversationId,
      departmentId: remoteConversation.departmentId || target.departmentId,
      departmentName: remoteConversation.departmentName || target.departmentName,
      contactName: remoteConversation.contactName || target.contactName,
      contactPhone: remoteConversation.contactPhone || target.contactPhone,
    };
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();

    if (!message.includes("atendimento") && !message.includes("conversa")) {
      throw error;
    }

    try {
      const lookupPayload = await zapResponderClient.findConversationByPhone(target.chatId, {
        includeClosed: true,
      });
      const remoteConversation = extractRemoteConversationContext(lookupPayload);

      return {
        ...target,
        externalConversationId:
          remoteConversation.externalConversationId || target.externalConversationId,
        departmentId: remoteConversation.departmentId || target.departmentId,
        departmentName: remoteConversation.departmentName || target.departmentName,
        contactName: remoteConversation.contactName || target.contactName,
        contactPhone: remoteConversation.contactPhone || target.contactPhone,
      };
    } catch (lookupError) {
      throw error;
    }
  }
}

async function sendMessage(conversationId, payload, user) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const conversation = await getVisibleConversationOrThrow(conversationId, user, { connection });
    const resolvedTarget = await resolveOutboundConversationTarget(conversation);
    const target = await ensureRemoteConversationTarget(resolvedTarget);
    const departmentId = target.departmentId;
    const chatId = target.chatId || normalizePhone(conversation.contact_phone || "");

    if (!departmentId) {
      const error = new Error("Nenhum departamento da Zap Responder foi encontrado para esta conversa.");
      error.status = 400;
      throw error;
    }

    if (!chatId) {
      const error = new Error("A conversa não possui um identificador remoto válido para envio.");
      error.status = 400;
      throw error;
    }

    const messageType = payload.messageType || "text";
    const trimmedBody = payload.body?.trim() || "";

    if (messageType !== "text" || payload.mediaUrl) {
      const error = new Error("O CRM suporta apenas mensagens de texto no envio via Zap Responder.");
      error.status = 400;
      throw error;
    }

    if (!trimmedBody) {
      const error = new Error("Informe uma mensagem para envio.");
      error.status = 400;
      throw error;
    }

    if (!target.externalConversationId) {
      const error = new Error("Não foi possível localizar a conversa remota para envio.");
      error.status = 400;
      throw error;
    }

    await persistResolvedConversationTarget(connection, conversation.id, target);

    await zapResponderClient.assumeConversationAsAdmin(target.externalConversationId, {
      showChatLogs: true,
    });
    await delay(2200);

    const chatSession = await zapResponderClient.getChatSession();
    const remoteMessage = buildZapResponderTextPayload({
      conversationId: target.externalConversationId,
      chatId,
      body: trimmedBody,
      senderName: chatSession.attendantName || user.name || user.fullName || "CRM",
    });

    const remoteResponse = await zapResponderClient.sendConversationMessage(
      target.externalConversationId,
      remoteMessage.payload
    );
    const outboundExternalMessageId =
      pickFirstString(remoteResponse, [
        "referenceId",
        "message._id",
        "mensagem._id",
        "data.message._id",
        "messageId",
        "id",
        "data.messageId",
        "data.id",
      ]) || remoteMessage.messageId;
    const extracted = {
      channel: conversation.channel,
      departmentId,
      departmentName: target.departmentName || conversation.department_name || "",
      externalConversationId: target.externalConversationId || conversation.external_id || "",
      externalMessageId: outboundExternalMessageId,
      direction: "outbound",
      messageType,
      body: trimmedBody,
      mediaUrl: "",
      status: "sent",
      sentAt: remoteMessage.sentAt,
      chatId,
      contactPhone: target.contactPhone || conversation.contact_phone || chatId,
      contactName: target.contactName || conversation.contact_name || "",
      rawPayload: remoteResponse,
    };

    const updatedConversation = await upsertConversation(connection, extracted);
    await upsertMessage(connection, updatedConversation, extracted, {
      createdBy: user.id,
    });

    await connection.commit();

    broadcastCrmUpdate({
      type: "inbox.message_sent",
      resources: ["inbox", "leads", "dashboard"],
      entityId: Number(conversationId),
      actorUserId: user.id,
    });

    return getConversationById(conversationId, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function registerWebhookEvent(eventKey, extracted, rawPayload) {
  const [result] = await pool.query(
    `
      INSERT IGNORE INTO integration_webhook_events (
        source, event_key, event_type, channel, status, payload_json
      ) VALUES (?, ?, ?, ?, 'received', ?)
    `,
    [
      SYSTEM_SOURCE,
      eventKey,
      extracted.eventType || null,
      normalizeChannelKey(extracted.channel),
      safeJsonStringify(rawPayload),
    ]
  );

  return result.affectedRows > 0;
}

async function updateWebhookEventStatus(eventKey, status, errorMessage = null) {
  await pool.query(
    `
      UPDATE integration_webhook_events
      SET status = ?, error_message = ?, processed_at = NOW()
      WHERE source = ? AND event_key = ?
    `,
    [status, errorMessage, SYSTEM_SOURCE, eventKey]
  );
}

async function ingestWebhook({ departmentId, payload }) {
  const department = await zapResponderClient.getDepartmentById(departmentId).catch(() => null);
  const extracted = extractWebhookEvent(payload, department, departmentId);
  const eventKey = buildEventKey(departmentId, payload);
  const inserted = await registerWebhookEvent(eventKey, extracted, payload);

  if (!inserted) {
    return { ok: true, duplicated: true };
  }

  if (!extracted.chatId && !extracted.externalConversationId && !extracted.externalMessageId) {
    await updateWebhookEventStatus(eventKey, "ignored");
    return { ok: true, ignored: true };
  }

  console.log(
    `[BOT] ingestWebhook: dept=${departmentId} channel=${extracted.channel} dir=${extracted.direction} chatId=${extracted.chatId || "?"} event=${extracted.eventType}`
  );

  const connection = await pool.getConnection();
  let conversation = null;

  try {
    await connection.beginTransaction();
    conversation = await upsertConversation(connection, extracted);
    if (extracted.shouldPersistMessage) {
      await upsertMessage(connection, conversation, extracted);
      conversation = await processLeadQualification(connection, conversation, extracted);
    }
    await connection.commit();
    await updateWebhookEventStatus(eventKey, "processed");

    broadcastCrmUpdate({
      type: "inbox.webhook_received",
      resources: ["inbox", "leads", "dashboard"],
      entityId: conversation.id,
    });

    return {
      ok: true,
      conversationId: conversation.id,
    };
  } catch (error) {
    console.error(`[BOT] ingestWebhook ERRO: ${error.message}`, { departmentId, chatId: extracted.chatId });
    await connection.rollback();
    await updateWebhookEventStatus(eventKey, "error", error.message);
    throw error;
  } finally {
    connection.release();
  }
}

function buildWebhookUrl(departmentId) {
  const baseUrl = (env.zapResponder.webhookBaseUrl || env.publicAppUrl || "").replace(/\/$/, "");

  if (!baseUrl) {
    const error = new Error("URL pública do CRM não configurada para registrar webhooks.");
    error.status = 400;
    throw error;
  }

  return `${baseUrl}/api/webhooks/zapresponder/${departmentId}`;
}

async function upsertIntegrationRow(channelKey, department, webhookUrl) {
  const integrationName = `Zap Responder - ${department.nome}`;
  const integrationChannel = getChannelLabel(channelKey);
  const settings = {
    source: SYSTEM_SOURCE,
    channelKey,
    departmentId: department._id,
    departmentName: department.nome,
  };

  const [rows] = await pool.query(
    "SELECT id FROM integrations WHERE name = ? LIMIT 1",
    [integrationName]
  );

  if (rows[0]) {
    await pool.query(
      `
        UPDATE integrations
        SET
          channel = ?, status = ?, last_sync_at = NOW(), origin_mapping = ?, rule_description = ?,
          webhook_url = ?, settings_json = ?
        WHERE id = ?
      `,
      [
        integrationChannel,
        department.isActive ? "Conectado" : "Inativo",
        getOriginName(channelKey),
        "Mensagens e leads sincronizados via Zap Responder.",
        webhookUrl || null,
        safeJsonStringify(settings),
        rows[0].id,
      ]
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO integrations (
        channel, name, status, last_sync_at, origin_mapping, rule_description, webhook_url, settings_json
      ) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)
    `,
    [
      integrationChannel,
      integrationName,
      department.isActive ? "Conectado" : "Inativo",
      getOriginName(channelKey),
      "Mensagens e leads sincronizados via Zap Responder.",
      webhookUrl || null,
      safeJsonStringify(settings),
    ]
  );
}

async function listChannels() {
  if (!zapResponderClient.isConfigured()) {
    return [];
  }

  const [integrationsRows, departments] = await Promise.all([
    pool.query("SELECT channel, name, status, webhook_url, settings_json, last_sync_at FROM integrations"),
    zapResponderClient.listDepartments(),
  ]);

  const localRows = integrationsRows[0]
    .map((row) => ({
      ...row,
      settings: parseJson(row.settings_json, {}),
    }))
    .filter((row) => row.settings?.source === SYSTEM_SOURCE);

  return departments
    .map((department) => {
      const channelKey = normalizeChannelKey(department.nome);
      const local = localRows.find((row) => row.settings?.departmentId === department._id);

      return {
        departmentId: department._id,
        departmentName: department.nome,
        channel: getChannelLabel(channelKey),
        channelKey,
        isActive: Boolean(department.isActive),
        webhookUrl: local?.webhook_url || "",
        status: local?.status || (department.isActive ? "Conectado" : "Inativo"),
        lastSyncAt: local?.last_sync_at || null,
      };
    })
    .filter((item) => ["whatsapp", "instagram", "messenger"].includes(item.channelKey));
}

async function registerWebhooks() {
  if (!zapResponderClient.isConfigured()) {
    const error = new Error("Zap Responder API token não configurado.");
    error.status = 503;
    throw error;
  }

  const departments = await zapResponderClient.listDepartments({ force: true });
  const supportedDepartments = departments.filter((department) =>
    ["whatsapp", "instagram", "messenger"].includes(normalizeChannelKey(department.nome))
  );
  const userId = supportedDepartments[0]?.userId;

  if (!userId) {
    const error = new Error("Não foi possível identificar o usuário da Zap Responder.");
    error.status = 400;
    throw error;
  }

  const existingPayload = await zapResponderClient.listWebhooks(userId);
  const existingWebhooks = Array.isArray(existingPayload?.value) ? existingPayload.value : [];
  const results = [];

  for (const department of supportedDepartments) {
    const channelKey = normalizeChannelKey(department.nome);
    const webhookUrl = buildWebhookUrl(department._id);
    const expectedName = `Veraluz CRM - ${getChannelLabel(channelKey)}`;
    const matchingWebhook = existingWebhooks.find((webhook) => {
      const webhookDepartments = Array.isArray(webhook.departments) ? webhook.departments : [];
      return (
        webhook.name === expectedName &&
        webhook.url === webhookUrl &&
        webhookDepartments.length === 1 &&
        webhookDepartments[0]?._id === department._id
      );
    });

    if (!matchingWebhook) {
      const outdatedWebhook = existingWebhooks.find((webhook) => webhook.name === expectedName);

      if (outdatedWebhook?._id) {
        await zapResponderClient.deleteWebhook(outdatedWebhook._id);
      }

      await zapResponderClient.createWebhook({
        name: expectedName,
        url: webhookUrl,
        eventTypes: [
          "message_received",
          "message_sent",
          "message_logs",
          "conversation_created",
          "conversation_closed",
          "meta_webhooks",
        ],
        departments: [
          {
            nome: department.nome,
            _id: department._id,
          },
        ],
      });
    }

    await upsertIntegrationRow(channelKey, department, webhookUrl);

    results.push({
      departmentId: department._id,
      departmentName: department.nome,
      channel: getChannelLabel(channelKey),
      webhookUrl,
    });
  }

  broadcastCrmUpdate({
    type: "inbox.webhooks_registered",
    resources: ["inbox", "integrations"],
  });

  return results;
}

module.exports = {
  ensureConversationForLead,
  getConversationById,
  ingestWebhook,
  listChannels,
  listConversations,
  registerWebhooks,
  sendMessage,
  startLeadQualificationInactivityMonitor,
};
