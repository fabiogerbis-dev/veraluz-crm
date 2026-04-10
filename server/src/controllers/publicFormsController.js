const env = require("../config/env");
const integrationService = require("../services/integrationService");
const { broadcastCrmUpdate } = require("../services/realtimeService");

function assertWebhookSecret(req) {
  if (!env.siteLeadWebhookSecret) {
    return;
  }

  const providedSecret = String(req.headers["x-site-webhook-secret"] || "").trim();

  if (!providedSecret || providedSecret !== env.siteLeadWebhookSecret) {
    const error = new Error("Webhook do site não autorizado.");
    error.status = 401;
    throw error;
  }
}

async function receiveVeraluzLead(req, res) {
  assertWebhookSecret(req);

  const result = await integrationService.receiveWebsiteSubmission(req.body || {});

  broadcastCrmUpdate({
    type: result.imported ? "integration.site_lead_imported" : "integration.site_lead_received",
    resources: result.imported ? ["dashboard", "leads", "integrations"] : ["integrations"],
    entityId: result.lead?.id || result.submission?.id || null,
    metadata: {
      source: "veraluz_site",
      imported: Boolean(result.imported),
      duplicated: Boolean(result.duplicated),
      duplicateLead: Boolean(result.duplicateLead),
      submissionId: result.submission?.id || null,
      leadId: result.lead?.id || null,
    },
  });

  return res.status(result.duplicated ? 200 : 201).json({
    ok: true,
    imported: Boolean(result.imported),
    duplicated: Boolean(result.duplicated),
    duplicateLead: Boolean(result.duplicateLead),
    submissionId: result.submission?.id || null,
    leadId: result.lead?.id || result.submission?.importedLeadId || null,
    message:
      result.message ||
      (result.imported
        ? "Formulário recebido e lead criado no CRM."
        : "Formulário recebido no CRM."),
  });
}

module.exports = {
  receiveVeraluzLead,
};
