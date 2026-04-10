const { pool } = require("../db/pool");
const leadService = require("./leadService");
const inboxService = require("./inboxService");
const { findIdByName } = require("./referenceService");

const AUTOMATION_EMAIL = "contato@veraluz.net.br";
const SITE_CAMPAIGN = "veraluz.net.br";
const SITE_ORIGIN = "Site";
const SITE_WEBHOOK_URL = "https://www.veraluz.net.br/lead-webhook";

function mapIntegrationRow(row) {
  return {
    id: row.id,
    channel: row.channel,
    name: row.name,
    status: row.status,
    lastSyncAt: row.last_sync_at,
    originMapping: row.origin_mapping,
    ruleDescription: row.rule_description,
    webhookUrl: row.webhook_url,
    settings: row.settings_json ? JSON.parse(row.settings_json) : {},
  };
}

function mapSubmissionRow(row) {
  return {
    id: row.id,
    externalId: row.external_id || "",
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    city: row.city,
    state: row.state,
    beneficiaries: row.beneficiaries,
    campaign: row.campaign,
    receivedAt: row.received_at,
    imported: Boolean(row.imported),
    importedLeadId: row.imported_lead_id,
    status: row.status,
    planType: row.plan_type,
    origin: row.origin,
  };
}

function normalizePlanType(value = "") {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  if (
    normalized.toLowerCase() === "entidade de classe/sindicato" ||
    normalized.toLowerCase() === "entidade de classe / sindicato"
  ) {
    return "Entidade de classe / sindicato";
  }

  return normalized;
}

function buildSubmissionPayload(payload = {}) {
  const dados = payload?.dados || {};
  const detalhes = payload?.detalhes || {};
  const beneficiaries = Number(
    detalhes.quantidade || (Array.isArray(detalhes.idades) ? detalhes.idades.length : 1) || 1
  );

  return {
    externalId: String(payload.id || "").trim(),
    fullName: String(dados.nome || "").trim(),
    email: String(dados.email || "").trim().toLowerCase(),
    phone: String(dados.telefone || "").trim(),
    planType: normalizePlanType(dados.tipoPlano),
    beneficiaries: Number.isFinite(beneficiaries) && beneficiaries > 0 ? beneficiaries : 1,
    pageUrl: String(payload.pagina || "").trim(),
    referer: String(payload.referer || "").trim(),
    channel: String(payload.canal || "whatsapp").trim(),
    whatsappUrl: String(payload.whatsappUrl || "").trim(),
    details: detalhes,
    rawPayload: payload,
    receivedAt: payload.criadoEm ? new Date(payload.criadoEm) : new Date(),
  };
}

function buildInitialNotes(submission) {
  const noteLines = [
    "Lead recebido pelo formulário do site Veraluz.",
    `Tipo de plano informado: ${submission.planType || "Não informado"}.`,
    `Canal de continuidade: ${submission.channel || "whatsapp"}.`,
  ];

  if (submission.details.tipoEmpresa) {
    noteLines.push(`Tipo de empresa: ${submission.details.tipoEmpresa}.`);
  }

  if (submission.details.tipoEntidade) {
    noteLines.push(`Categoria da entidade: ${submission.details.tipoEntidade}.`);
  }

  if (submission.details.nomeEntidade) {
    noteLines.push(`Instituição informada: ${submission.details.nomeEntidade}.`);
  }

  if (submission.beneficiaries) {
    noteLines.push(`Quantidade de vidas: ${submission.beneficiaries}.`);
  }

  if (Array.isArray(submission.details.idades) && submission.details.idades.length) {
    noteLines.push(`Idades informadas: ${submission.details.idades.join(", ")}.`);
  }

  if (submission.pageUrl) {
    noteLines.push(`Página de origem: ${submission.pageUrl}.`);
  }

  if (submission.referer) {
    noteLines.push(`Referer: ${submission.referer}.`);
  }

  return noteLines.join("\n");
}

async function getAutomationUser() {
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        r.slug AS role
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.active = 1
      ORDER BY
        CASE WHEN u.email = ? THEN 0 ELSE 1 END,
        CASE WHEN r.slug = 'admin' THEN 0 WHEN r.slug = 'manager' THEN 1 ELSE 2 END,
        u.id ASC
      LIMIT 1
    `,
    [AUTOMATION_EMAIL]
  );

  const user = rows[0];

  if (!user) {
    const error = new Error("Nenhum usuário ativo disponível para importar formulários do site.");
    error.status = 500;
    throw error;
  }

  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: user.role,
    onlyOwnLeads: false,
  };
}

async function upsertSiteIntegration() {
  const integrationName = "Site Veraluz";
  const settingsJson = JSON.stringify({
    source: "website_form",
    campaign: SITE_CAMPAIGN,
  });

  const [rows] = await pool.query("SELECT id FROM integrations WHERE name = ? LIMIT 1", [
    integrationName,
  ]);

  if (rows[0]) {
    await pool.query(
      `
        UPDATE integrations
        SET
          channel = 'Website',
          status = 'Conectado',
          last_sync_at = NOW(),
          origin_mapping = ?,
          rule_description = ?,
          webhook_url = ?,
          settings_json = ?
        WHERE id = ?
      `,
      [
        SITE_ORIGIN,
        "Formulário do site encaminhado para o CRM via /lead-webhook.",
        SITE_WEBHOOK_URL,
        settingsJson,
        rows[0].id,
      ]
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO integrations (
        channel, name, status, last_sync_at, origin_mapping, rule_description, webhook_url, settings_json
      ) VALUES ('Website', ?, 'Conectado', NOW(), ?, ?, ?, ?)
    `,
    [
      integrationName,
      SITE_ORIGIN,
      "Formulário do site encaminhado para o CRM via /lead-webhook.",
      SITE_WEBHOOK_URL,
      settingsJson,
    ]
  );
}

async function listIntegrations() {
  const [rows] = await pool.query(
    `
      SELECT id, channel, name, status, last_sync_at, origin_mapping, rule_description, webhook_url, settings_json
      FROM integrations
      ORDER BY channel ASC
    `
  );

  return rows.map(mapIntegrationRow);
}

async function listFormSubmissions() {
  const [rows] = await pool.query(
    `
      SELECT
        fs.id,
        fs.external_id,
        fs.full_name,
        fs.phone,
        fs.email,
        fs.city,
        fs.state,
        fs.beneficiaries,
        fs.campaign,
        fs.received_at,
        fs.imported,
        fs.imported_lead_id,
        fs.status,
        pt.name AS plan_type,
        lo.name AS origin
      FROM form_submissions fs
      LEFT JOIN plan_types pt ON pt.id = fs.plan_type_id
      LEFT JOIN lead_origins lo ON lo.id = fs.origin_id
      ORDER BY fs.received_at DESC
    `
  );

  return rows.map(mapSubmissionRow);
}

async function getFormSubmissionById(submissionId) {
  const [rows] = await pool.query(
    `
      SELECT
        fs.id,
        fs.external_id,
        fs.full_name,
        fs.phone,
        fs.email,
        fs.city,
        fs.state,
        fs.beneficiaries,
        fs.campaign,
        fs.received_at,
        fs.imported,
        fs.imported_lead_id,
        fs.status,
        pt.name AS plan_type,
        lo.name AS origin
      FROM form_submissions fs
      LEFT JOIN plan_types pt ON pt.id = fs.plan_type_id
      LEFT JOIN lead_origins lo ON lo.id = fs.origin_id
      WHERE fs.id = ?
      LIMIT 1
    `,
    [submissionId]
  );

  if (!rows[0]) {
    const error = new Error("Formulário recebido não encontrado.");
    error.status = 404;
    throw error;
  }

  return mapSubmissionRow(rows[0]);
}

async function getFormSubmissionByExternalId(externalId) {
  if (!externalId) {
    return null;
  }

  const [rows] = await pool.query(
    `
      SELECT
        fs.id,
        fs.external_id,
        fs.full_name,
        fs.phone,
        fs.email,
        fs.city,
        fs.state,
        fs.beneficiaries,
        fs.campaign,
        fs.received_at,
        fs.imported,
        fs.imported_lead_id,
        fs.status,
        pt.name AS plan_type,
        lo.name AS origin
      FROM form_submissions fs
      LEFT JOIN plan_types pt ON pt.id = fs.plan_type_id
      LEFT JOIN lead_origins lo ON lo.id = fs.origin_id
      WHERE fs.external_id = ?
      LIMIT 1
    `,
    [externalId]
  );

  return rows[0] ? mapSubmissionRow(rows[0]) : null;
}

async function markSubmissionImported(submissionId, leadId) {
  await pool.query(
    `
      UPDATE form_submissions
      SET imported = 1, imported_lead_id = ?, status = 'Importado'
      WHERE id = ?
    `,
    [leadId, submissionId]
  );
}

async function updateSubmissionStatus(submissionId, status) {
  await pool.query("UPDATE form_submissions SET status = ? WHERE id = ?", [status, submissionId]);
}

async function receiveWebsiteSubmission(payload = {}) {
  const submission = buildSubmissionPayload(payload);

  if (!submission.fullName || !submission.email || !submission.phone || !submission.planType) {
    const error = new Error("Payload do formulário incompleto.");
    error.status = 400;
    throw error;
  }

  await upsertSiteIntegration();

  const duplicatedSubmission = await getFormSubmissionByExternalId(submission.externalId);

  if (duplicatedSubmission) {
    return {
      duplicated: true,
      imported: duplicatedSubmission.imported,
      submission: duplicatedSubmission,
    };
  }

  const [planTypeId, originId] = await Promise.all([
    findIdByName("plan_types", submission.planType),
    findIdByName("lead_origins", SITE_ORIGIN),
  ]);

  const [result] = await pool.query(
    `
      INSERT INTO form_submissions (
        external_id, full_name, phone, email, plan_type_id, beneficiaries,
        origin_id, campaign, raw_payload_json, received_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Novo')
    `,
    [
      submission.externalId || null,
      submission.fullName,
      submission.phone || null,
      submission.email || null,
      planTypeId,
      submission.beneficiaries,
      originId,
      SITE_CAMPAIGN,
      JSON.stringify(submission.rawPayload || {}),
      submission.receivedAt,
    ]
  );

  const createdSubmission = await getFormSubmissionById(result.insertId);
  const automationUser = await getAutomationUser();

  try {
    const lead = await leadService.createLead(
      {
        fullName: submission.fullName,
        phone: submission.phone,
        email: submission.email,
        beneficiaries: submission.beneficiaries,
        planType: submission.planType,
        origin: SITE_ORIGIN,
        sourceCampaign: SITE_CAMPAIGN,
        initialNotes: buildInitialNotes(submission),
        hasWhatsapp: true,
        temperature: "Morno",
        entityName:
          submission.planType === "Entidade de classe / sindicato"
            ? submission.details.nomeEntidade || null
            : null,
      },
      automationUser
    );

    await markSubmissionImported(createdSubmission.id, lead.id);
    await inboxService.ensureConversationForLead({
      leadId: Number(lead.id),
      fullName: submission.fullName,
      phone: submission.phone,
      email: submission.email,
      ownerUserId: lead.ownerUserId || null,
      channel: "whatsapp",
      source: "website_form",
    });

    return {
      duplicated: false,
      imported: true,
      submission: {
        ...createdSubmission,
        imported: true,
        importedLeadId: lead.id,
        status: "Importado",
      },
      lead,
    };
  } catch (error) {
    if (error.status !== 409) {
      throw error;
    }

    await updateSubmissionStatus(createdSubmission.id, "Duplicado");

    return {
      duplicated: false,
      imported: false,
      duplicateLead: true,
      submission: {
        ...createdSubmission,
        status: "Duplicado",
      },
      message: error.message,
    };
  }
}

module.exports = {
  getFormSubmissionById,
  listFormSubmissions,
  listIntegrations,
  markSubmissionImported,
  receiveWebsiteSubmission,
};
