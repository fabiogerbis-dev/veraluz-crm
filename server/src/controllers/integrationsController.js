const integrationService = require("../services/integrationService");
const leadService = require("../services/leadService");
const { broadcastCrmUpdate } = require("../services/realtimeService");

async function listIntegrations(req, res) {
  const integrations = await integrationService.listIntegrations();
  return res.json({ integrations });
}

async function listFormSubmissions(req, res) {
  const submissions = await integrationService.listFormSubmissions();
  return res.json({ submissions });
}

async function importSubmission(req, res) {
  const submission = await integrationService.getFormSubmissionById(req.params.id);

  if (submission.imported) {
    return res.status(400).json({ message: "Este formulário já foi importado." });
  }

  const lead = await leadService.createLead(
    {
      fullName: submission.fullName,
      phone: submission.phone,
      email: submission.email,
      city: submission.city,
      state: submission.state,
      beneficiaries: submission.beneficiaries,
      planType: submission.planType,
      origin: submission.origin,
      sourceCampaign: submission.campaign,
      initialNotes: `Lead importado da fila ${submission.origin}.`,
      temperature: "Morno",
    },
    req.user
  );

  await integrationService.markSubmissionImported(req.params.id, lead.id);
  broadcastCrmUpdate({
    type: "integration.submission_imported",
    resources: ["dashboard", "leads", "tasks", "integrations"],
    entityId: lead.id,
    actorUserId: req.user.id,
    metadata: {
      submissionId: req.params.id,
    },
  });

  return res.status(201).json({ lead });
}

module.exports = {
  importSubmission,
  listFormSubmissions,
  listIntegrations,
};
