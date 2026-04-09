const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  publicAppUrl:
    process.env.PUBLIC_APP_URL || process.env.CLIENT_URL || "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET || "veraluz-super-secret",
  siteLeadWebhookSecret: process.env.SITE_LEAD_WEBHOOK_SECRET || "",
  zapResponder: {
    apiBaseUrl: process.env.ZAP_RESPONDER_API_BASE_URL || "https://api.zapresponder.com.br/api",
    apiToken: process.env.ZAP_RESPONDER_API_TOKEN || "",
    chatEmail: process.env.ZAP_RESPONDER_CHAT_EMAIL || "",
    chatPassword: process.env.ZAP_RESPONDER_CHAT_PASSWORD || "",
    chatVersion: process.env.ZAP_RESPONDER_CHAT_VERSION || "1.3.22",
    chatReferer:
      process.env.ZAP_RESPONDER_CHAT_REFERER || "https://chat.zapresponder.com.br/",
    defaultAttendantId: process.env.ZAP_RESPONDER_DEFAULT_ATTENDANT_ID || "",
    defaultAttendantName: process.env.ZAP_RESPONDER_DEFAULT_ATTENDANT_NAME || "",
    defaultAttendantEmail: process.env.ZAP_RESPONDER_DEFAULT_ATTENDANT_EMAIL || "",
    transferComment:
      process.env.ZAP_RESPONDER_TRANSFER_COMMENT || "Atribuicao automatica CRM",
    webhookBaseUrl:
      process.env.ZAP_RESPONDER_WEBHOOK_BASE_URL ||
      process.env.PUBLIC_APP_URL ||
      process.env.CLIENT_URL ||
      "",
    webhookSecret: process.env.ZAP_RESPONDER_WEBHOOK_SECRET || "",
  },
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || "veraluz_crm",
    user: process.env.DB_USER || "veraluz",
    password: process.env.DB_PASSWORD || "veraluz123",
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  },
};
