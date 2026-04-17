export const COMMERCIAL_STAGE_STATUS_RULES = {
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

export const LOST_STAGE = "Perdido";
export const POST_SALE_STAGE = "Pós-venda";
export const WON_STAGES = ["Fechado", POST_SALE_STAGE];

function getStageRule(stageName = "") {
  return COMMERCIAL_STAGE_STATUS_RULES[String(stageName || "").trim()] || null;
}

export function getDefaultStatusForStage(stageName = "") {
  return getStageRule(stageName)?.defaultStatus || "Novo lead";
}

export function getAllowedStatusesForStage(stageName = "") {
  return [...(getStageRule(stageName)?.allowedStatuses || [getDefaultStatusForStage(stageName)])];
}

export function isStatusAllowedForStage(stageName = "", statusName = "") {
  return getAllowedStatusesForStage(stageName).includes(String(statusName || "").trim());
}

export function normalizeStatusForStage(stageName = "", statusName = "") {
  return isStatusAllowedForStage(stageName, statusName)
    ? String(statusName || "").trim()
    : getDefaultStatusForStage(stageName);
}

export function requiresLossReason(stageName = "") {
  return String(stageName || "").trim() === LOST_STAGE;
}

export function isWonStage(stageName = "") {
  return WON_STAGES.includes(String(stageName || "").trim());
}
