const inboxService = require("../services/inboxService");

function verifyWebhookSecret(req) {
  const expectedSecret = process.env.ZAP_RESPONDER_WEBHOOK_SECRET || "";

  if (!expectedSecret) {
    return true;
  }

  const headerValue =
    req.headers["x-webhook-secret"] ||
    req.headers["x-api-key"] ||
    req.headers["x-zapresponder-secret"] ||
    req.headers.authorization ||
    "";

  if (headerValue === expectedSecret) {
    return true;
  }

  if (typeof headerValue === "string" && headerValue === `Bearer ${expectedSecret}`) {
    return true;
  }

  return false;
}

async function receiveWebhook(req, res) {
  if (!verifyWebhookSecret(req)) {
    return res.status(401).json({ message: "Webhook nao autorizado." });
  }

  const result = await inboxService.ingestWebhook({
    departmentId: req.params.departmentId,
    payload: req.body,
  });

  return res.status(202).json(result);
}

async function pingWebhook(req, res) {
  return res.json({
    status: "ok",
    service: "zap_responder_webhook",
    departmentId: req.params.departmentId,
  });
}

module.exports = {
  pingWebhook,
  receiveWebhook,
};
