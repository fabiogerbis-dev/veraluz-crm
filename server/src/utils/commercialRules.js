const COMMERCIAL_STAGE_STATUS_RULES = {
  "Novo lead": {
    defaultStatus: "Novo lead",
    allowedStatuses: ["Novo lead"],
  },
  "Em contato": {
    defaultStatus: "Em contato",
    allowedStatuses: ["Em contato", "Aguardando retorno"],
  },
  Cotação: {
    defaultStatus: "Cotação em andamento",
    allowedStatuses: ["Cotação em andamento", "Aguardando retorno"],
  },
  "Proposta enviada": {
    defaultStatus: "Proposta enviada",
    allowedStatuses: ["Proposta enviada", "Aguardando retorno"],
  },
  Negociação: {
    defaultStatus: "Em negociação",
    allowedStatuses: ["Em negociação", "Aguardando retorno"],
  },
  Fechado: {
    defaultStatus: "Venda fechada",
    allowedStatuses: ["Venda fechada"],
  },
  Perdido: {
    defaultStatus: "Perdido",
    allowedStatuses: ["Perdido"],
  },
  "Pós-venda": {
    defaultStatus: "Pós-venda",
    allowedStatuses: ["Pós-venda"],
  },
};

const LOST_STAGE = "Perdido";
const POST_SALE_STAGE = "Pós-venda";
const WON_STAGES = ["Fechado", POST_SALE_STAGE];

function getStageRule(stageName = "") {
  return COMMERCIAL_STAGE_STATUS_RULES[String(stageName || "").trim()] || null;
}

function getDefaultStatusForStage(stageName = "") {
  return getStageRule(stageName)?.defaultStatus || "Novo lead";
}

function getAllowedStatusesForStage(stageName = "") {
  return [...(getStageRule(stageName)?.allowedStatuses || [getDefaultStatusForStage(stageName)])];
}

function isStatusAllowedForStage(stageName = "", statusName = "") {
  return getAllowedStatusesForStage(stageName).includes(String(statusName || "").trim());
}

function requiresLossReason(stageName = "") {
  return String(stageName || "").trim() === LOST_STAGE;
}

function isWonStage(stageName = "") {
  return WON_STAGES.includes(String(stageName || "").trim());
}

module.exports = {
  COMMERCIAL_STAGE_STATUS_RULES,
  LOST_STAGE,
  POST_SALE_STAGE,
  WON_STAGES,
  getAllowedStatusesForStage,
  getDefaultStatusForStage,
  isStatusAllowedForStage,
  isWonStage,
  requiresLossReason,
};
