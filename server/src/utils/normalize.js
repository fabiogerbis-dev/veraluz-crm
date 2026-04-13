function normalizePhone(value) {
  if (!value) return null;
  return value.replace(/\D/g, "") || null;
}

function normalizeEmail(value) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeCpf(value) {
  if (!value) return null;
  return value.replace(/\D/g, "") || null;
}

function normalizeCnpj(value) {
  if (!value) return null;
  return value.replace(/\D/g, "") || null;
}

module.exports = {
  normalizePhone,
  normalizeEmail,
  normalizeCpf,
  normalizeCnpj,
};
