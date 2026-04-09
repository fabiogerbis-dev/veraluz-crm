function normalizePhone(value = "") {
  return value.replace(/\D/g, "") || null;
}

function normalizeEmail(value = "") {
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeCpf(value = "") {
  return value.replace(/\D/g, "") || null;
}

function normalizeCnpj(value = "") {
  return value.replace(/\D/g, "") || null;
}

module.exports = {
  normalizePhone,
  normalizeEmail,
  normalizeCpf,
  normalizeCnpj,
};
