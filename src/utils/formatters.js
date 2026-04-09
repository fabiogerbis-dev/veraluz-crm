const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function formatDate(value) {
  if (!value) {
    return "--";
  }

  return dateFormatter.format(new Date(value));
}

export function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  return dateTimeFormatter.format(new Date(value));
}

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

export function normalizePhone(value = "") {
  return value.replace(/\D/g, "");
}

export function normalizeCpf(value = "") {
  return value.replace(/\D/g, "");
}

export function normalizeEmail(value = "") {
  return value.trim().toLowerCase();
}

export function formatPhone(value = "") {
  const digits = normalizePhone(value);

  if (!digits) {
    return "--";
  }

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  return value;
}

export function getInitials(value = "") {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0].toUpperCase())
    .join("");
}

export function sameDay(first, second) {
  if (!first || !second) {
    return false;
  }

  const left = new Date(first);
  const right = new Date(second);

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function formatRelativeLabel(value) {
  if (!value) {
    return "--";
  }

  const today = new Date();
  const target = new Date(value);

  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diff = Math.round((startTarget - startToday) / 86400000);

  if (diff === 0) {
    return "Hoje";
  }

  if (diff === 1) {
    return "Amanhã";
  }

  if (diff === -1) {
    return "Ontem";
  }

  if (diff > 1) {
    return `Em ${diff} dias`;
  }

  return `${Math.abs(diff)} dias atrás`;
}

export function buildWhatsAppUrl(phone = "") {
  const digits = normalizePhone(phone);
  return digits ? `https://wa.me/55${digits}` : "#";
}

export function buildPhoneUrl(phone = "") {
  const digits = normalizePhone(phone);
  return digits ? `tel:+55${digits}` : "#";
}

export function buildMailtoUrl(email = "") {
  return email ? `mailto:${email}` : "#";
}
