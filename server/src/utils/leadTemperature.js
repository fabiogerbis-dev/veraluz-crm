const HIGH_VALUE_PLAN_TYPES = new Set(["Empresarial", "MEI", "Entidade de classe / sindicato"]);

function normalizeComparableText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizePlanType(value = "") {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  if (normalizeComparableText(normalizedValue).includes("entidade")) {
    return "Entidade de classe / sindicato";
  }

  return normalizedValue;
}

function normalizeContractType(value = "") {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return "";
  }

  const comparableValue = normalizeComparableText(normalizedValue);

  if (
    comparableValue === "renovacao" ||
    comparableValue.includes("trocar") ||
    comparableValue.includes("migr") ||
    comparableValue.includes("portabilidade")
  ) {
    return "Trocar de plano";
  }

  if (comparableValue.includes("primeiro") || comparableValue.includes("novo")) {
    return "Primeiro plano";
  }

  return normalizedValue;
}

function deriveLeadTemperature(values = {}, context = {}) {
  const planType = normalizePlanType(values.planType);
  const contractType = normalizeContractType(values.contractType);
  const beneficiaries = Number(values.beneficiaries || 1);
  const channelKey = normalizeComparableText(
    context.channelKey || context.channel || context.origin || values.origin
  );
  let score = 0;

  if (values.urgency === "Alta") {
    score += 3;
  } else if (values.urgency === "Média") {
    score += 1;
  }

  if (beneficiaries >= 10) {
    score += 3;
  } else if (beneficiaries >= 5) {
    score += 2;
  } else if (beneficiaries >= 2) {
    score += 1;
  }

  if (HIGH_VALUE_PLAN_TYPES.has(planType)) {
    score += planType === "Empresarial" ? 3 : 2;
  } else if (planType === "Familiar") {
    score += 1;
  }

  if (contractType === "Trocar de plano") {
    score += 2;
  }

  if (values.hasCurrentPlan || values.currentPlan) {
    score += 1;
  }

  if (values.operatorInterest && values.operatorInterest !== "Sem preferência") {
    score += 1;
  }

  if (values.budgetRange) {
    score += 1;
  }

  if (values.coverage === "Nacional") {
    score += 1;
  }

  if (values.entityName || values.hasActiveCnpj || values.hasActiveMei || values.cnpj) {
    score += 1;
  }

  if (["whatsapp", "instagram", "facebook", "site"].includes(channelKey)) {
    score += 1;
  }

  if (score >= 7) {
    return "Quente";
  }

  if (score >= 4) {
    return "Morno";
  }

  return "Frio";
}

module.exports = {
  deriveLeadTemperature,
};
