const env = require("../config/env");

const DEPARTMENT_CACHE_TTL_MS = 5 * 60 * 1000;
const ATTENDANT_CACHE_TTL_MS = 5 * 60 * 1000;
const CHAT_SESSION_FALLBACK_TTL_MS = 30 * 60 * 1000;

const departmentCache = {
  expiresAt: 0,
  value: [],
};

const attendantCache = {
  expiresAt: 0,
  value: [],
};

const chatSessionCache = {
  expiresAt: 0,
  value: null,
};

function isConfigured() {
  return Boolean(env.zapResponder.apiToken);
}

function getInternalBaseUrl() {
  return env.zapResponder.apiBaseUrl.replace(/\/api\/?$/, "");
}

function decodeJwtExpiration(token) {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) {
      return 0;
    }

    const normalized = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
    return typeof payload?.exp === "number" ? payload.exp * 1000 : 0;
  } catch (error) {
    return 0;
  }
}

function normalizeAttendant(attendant = {}) {
  return {
    id: String(attendant?._id || attendant?.id || ""),
    name: String(attendant?.nome || attendant?.name || ""),
    email: String(attendant?.email || ""),
  };
}

function buildChatHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json, text/plain, */*",
    Referer: env.zapResponder.chatReferer,
    "version-chat": env.zapResponder.chatVersion,
  };
}

function buildUrl(baseUrl, path, query = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

async function executeRequest(baseUrl, path, { method = "GET", body, query, headers = {} } = {}) {
  const options = {
    method,
    headers,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(baseUrl, path, query), options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const errorMessage =
      payload?.metaError?.message ||
      payload?.message ||
      payload?.error ||
      (typeof payload === "string" && payload) ||
      "Falha ao consultar a Zap Responder.";
    const error = new Error(errorMessage);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function requestWithBase(
  baseUrl,
  path,
  { method = "GET", body, query, authToken, headers = {} } = {}
) {
  const token = authToken === undefined ? env.zapResponder.apiToken : authToken;

  if (!token) {
    const error = new Error("Zap Responder API token não configurado.");
    error.status = 503;
    throw error;
  }

  return executeRequest(baseUrl, path, {
    method,
    body,
    query,
    headers: {
      Authorization: `Bearer ${token}`,
      ...headers,
    },
  });
}

async function request(path, options = {}) {
  return requestWithBase(env.zapResponder.apiBaseUrl, path, options);
}

async function requestInternal(path, options = {}) {
  return requestWithBase(getInternalBaseUrl(), path, options);
}

async function listAttendants() {
  const now = Date.now();

  if (attendantCache.expiresAt > now && attendantCache.value.length) {
    return attendantCache.value;
  }

  const payload = await request("/atendentes");
  const attendants = Array.isArray(payload) ? payload : Array.isArray(payload?.value) ? payload.value : [];

  attendantCache.value = attendants;
  attendantCache.expiresAt = now + ATTENDANT_CACHE_TTL_MS;

  return attendants;
}

async function listDepartments({ force = false } = {}) {
  const now = Date.now();

  if (!force && departmentCache.expiresAt > now && departmentCache.value.length) {
    return departmentCache.value;
  }

  const payload = await request("/departamento/all");
  const departments = Array.isArray(payload?.departamentos) ? payload.departamentos : [];

  departmentCache.value = departments;
  departmentCache.expiresAt = now + DEPARTMENT_CACHE_TTL_MS;

  return departments;
}

async function getDepartmentById(departmentId) {
  const departments = await listDepartments();
  return departments.find((department) => department._id === departmentId) || null;
}

async function findConversationByPhone(phone, { includeClosed = false } = {}) {
  return request(`/v2/conversations/chatId/${encodeURIComponent(phone)}`, {
    query: {
      includeClosed,
    },
  });
}

async function getConversationById(conversationId, { includeClosed = false } = {}) {
  return request(`/v2/conversations/${encodeURIComponent(conversationId)}`, {
    query: {
      includeClosed,
    },
  });
}

async function listConversationMessages(conversationId, { cursor } = {}) {
  return request(`/v2/conversations/${encodeURIComponent(conversationId)}/messages`, {
    query: {
      cursor,
    },
  });
}

async function getConversationDetails(conversationId) {
  return requestInternal(`/conversa/${encodeURIComponent(conversationId)}`);
}

async function createConversation({ attendantId, chatId, departmentId }) {
  return request("/conversa", {
    method: "POST",
    body: {
      attendantId,
      chatId,
      departmentId,
    },
  });
}

async function sendMessage(departmentId, payload) {
  return request(`/whatsapp/message/${encodeURIComponent(departmentId)}`, {
    method: "POST",
    body: payload,
  });
}

async function sendTemplate(departmentId, payload) {
  return request(`/whatsapp/message/${encodeURIComponent(departmentId)}`, {
    method: "POST",
    body: payload,
  });
}

async function getChatSession({ force = false } = {}) {
  if (!env.zapResponder.chatEmail || !env.zapResponder.chatPassword) {
    const error = new Error("Credenciais do chat da Zap Responder não configuradas.");
    error.status = 503;
    throw error;
  }

  const now = Date.now();

  if (!force && chatSessionCache.expiresAt > now && chatSessionCache.value?.token) {
    return chatSessionCache.value;
  }

  const payload = await executeRequest(getInternalBaseUrl(), "/atendente/login", {
    method: "POST",
    body: {
      email: env.zapResponder.chatEmail,
      senha: env.zapResponder.chatPassword,
    },
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: env.zapResponder.chatReferer,
      "version-chat": env.zapResponder.chatVersion,
    },
  });

  const token = String(payload?.token || "").trim();

  if (!token) {
    const error = new Error("Não foi possível autenticar no chat da Zap Responder.");
    error.status = 502;
    throw error;
  }

  const expiresAt = decodeJwtExpiration(token) || now + CHAT_SESSION_FALLBACK_TTL_MS;
  const attendant = normalizeAttendant(payload);
  const session = {
    token,
    attendantId: attendant.id,
    attendantName: attendant.name,
    attendantEmail: attendant.email,
  };

  chatSessionCache.value = session;
  chatSessionCache.expiresAt = Math.max(now + 60_000, expiresAt - 60_000);

  return session;
}

async function requestChat(path, options = {}) {
  const session = await getChatSession();
  return requestWithBase(getInternalBaseUrl(), path, {
    ...options,
    authToken: session.token,
    headers: buildChatHeaders(session.token),
  });
}

async function getDefaultAttendant() {
  const attendants = await listAttendants();
  const configuredId = env.zapResponder.defaultAttendantId.trim();
  const configuredEmail = env.zapResponder.defaultAttendantEmail.trim().toLowerCase();
  const configuredName = env.zapResponder.defaultAttendantName.trim().toLowerCase();

  const match = attendants.find((attendant) => {
    const normalized = normalizeAttendant(attendant);

    if (configuredId && normalized.id === configuredId) {
      return true;
    }

    if (configuredEmail && normalized.email.toLowerCase() === configuredEmail) {
      return true;
    }

    if (configuredName && normalized.name.toLowerCase() === configuredName) {
      return true;
    }

    return false;
  });

  if (!match) {
    return null;
  }

  return normalizeAttendant(match);
}

async function assumeConversationAsAdmin(conversationId, { showChatLogs = true } = {}) {
  return requestChat("/conversa/assumirConversaAdministrador", {
    method: "POST",
    body: {
      conversa: conversationId,
      showChatLogs,
    },
  });
}

async function transferConversationToAttendant(
  conversationId,
  attendantId,
  { comment = env.zapResponder.transferComment } = {}
) {
  return requestChat("/conversa/tranferirAtendente", {
    method: "POST",
    body: {
      tipo_fila: "atendente",
      destino: attendantId,
      comentario: comment,
      conversa: conversationId,
    },
  });
}

async function sendConversationMessage(conversationId, payload) {
  return requestChat(`/conversation/${encodeURIComponent(conversationId)}/message`, {
    method: "POST",
    body: payload,
  });
}

async function updateWebhook(departmentId, webhook) {
  return request(`/whatsapp/webhook/${encodeURIComponent(departmentId)}`, {
    method: "POST",
    body: {
      webhook,
    },
  });
}

async function listWebhooks(userId) {
  return requestInternal(`/webhook/all/${encodeURIComponent(userId)}`);
}

async function createWebhook(payload) {
  return requestInternal("/webhook/new", {
    method: "POST",
    body: payload,
  });
}

async function deleteWebhook(webhookId) {
  return requestInternal(`/webhook/${encodeURIComponent(webhookId)}`, {
    method: "DELETE",
  });
}

async function findContactByPhone(phone) {
  return request(`/contatos/phone/${encodeURIComponent(phone)}`);
}

async function createContact(contact) {
  return request("/contatos", {
    method: "POST",
    body: {
      contact,
    },
  });
}

module.exports = {
  createContact,
  createConversation,
  createWebhook,
  deleteWebhook,
  findContactByPhone,
  findConversationByPhone,
  getChatSession,
  getConversationDetails,
  getConversationById,
  getDefaultAttendant,
  getDepartmentById,
  isConfigured,
  listAttendants,
  listConversationMessages,
  listDepartments,
  listWebhooks,
  assumeConversationAsAdmin,
  sendMessage,
  sendConversationMessage,
  sendTemplate,
  transferConversationToAttendant,
  updateWebhook,
};
