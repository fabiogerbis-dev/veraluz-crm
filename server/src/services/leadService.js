const path = require("node:path");
const fs = require("node:fs/promises");
const { pool } = require("../db/pool");
const {
  normalizeCpf,
  normalizeCnpj,
  normalizeEmail,
  normalizePhone,
} = require("../utils/normalize");
const { buildLeadVisibilityClause, findIdByName } = require("./referenceService");

const LEGACY_STAGE_NAME_MAP = {
  Qualificado: "Novo lead",
};

const LEGACY_STATUS_NAME_MAP = {
  Qualificado: "Novo lead",
};

const STAGE_DEFAULT_STATUS = {
  "Novo lead": "Novo lead",
  "Em contato": "Em contato",
  Cotação: "Cotação em andamento",
  "Proposta enviada": "Proposta enviada",
  Negociação: "Em negociação",
  Fechado: "Venda fechada",
  Perdido: "Perdido",
  "Pós-venda": "Pós-venda",
};

function normalizePipelineStageName(name) {
  const nextName = String(name || "").trim() || "Novo lead";
  return LEGACY_STAGE_NAME_MAP[nextName] || nextName;
}

function normalizeStatusName(name, pipelineStageName) {
  const normalizedName = String(name || "").trim();

  if (!normalizedName) {
    return STAGE_DEFAULT_STATUS[pipelineStageName] || "Novo lead";
  }

  return LEGACY_STATUS_NAME_MAP[normalizedName] || normalizedName;
}

function normalizeComparableText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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

function parseJsonArray(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((item) => String(item || "").trim()).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function stringifyJsonArray(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value.map((item) => String(item || "").trim()).filter(Boolean);
  return normalized.length ? JSON.stringify(normalized) : null;
}

function mapLeadRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    email: row.email,
    cpf: row.cpf,
    city: row.city,
    state: row.state,
    neighborhood: row.neighborhood,
    ageRange: row.age_range,
    beneficiaryAgeRanges: parseJsonArray(row.beneficiary_age_ranges_json),
    beneficiaries: row.beneficiaries,
    planType: row.plan_type,
    contractType: normalizeContractType(row.contract_type),
    companyName: row.company_name,
    cnpj: row.company_cnpj,
    entityName: row.entity_name,
    hasActiveCnpj: Boolean(row.has_active_cnpj),
    hasActiveMei: Boolean(row.has_active_mei),
    operatorInterest: row.operator_interest,
    budgetRange: row.budget_range,
    coparticipation: row.coparticipation,
    coverage: row.coverage,
    urgency: row.urgency,
    pipelineStage: row.pipeline_stage,
    status: row.status_name,
    temperature: row.temperature,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    origin: row.origin_name,
    sourceCampaign: row.source_campaign,
    notes: row.notes,
    initialNotes: row.initial_notes,
    hasWhatsapp: Boolean(row.has_whatsapp),
    hasCurrentPlan: Boolean(row.has_current_plan),
    currentPlan: row.current_plan,
    currentPlanExpiry: row.current_plan_expiry,
    nextContactAt: row.next_contact_at,
    lossReason: row.loss_reason,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ? row.tags.split(",") : [],
  };
}

async function findDuplicateLead(connection, payload, ignoredLeadId = null) {
  const normalizedPhone = normalizePhone(payload.phone);
  const normalizedEmail = normalizeEmail(payload.email);
  const normalizedCpf = normalizeCpf(payload.cpf);
  const clauses = [];
  const params = [];

  if (normalizedPhone) {
    clauses.push("normalized_phone = ?");
    params.push(normalizedPhone);
  }

  if (normalizedEmail) {
    clauses.push("normalized_email = ?");
    params.push(normalizedEmail);
  }

  if (normalizedCpf) {
    clauses.push("normalized_cpf = ?");
    params.push(normalizedCpf);
  }

  if (!clauses.length) {
    return null;
  }

  const ignoredSql = ignoredLeadId ? "AND id <> ?" : "";
  if (ignoredLeadId) {
    params.push(ignoredLeadId);
  }

  const [rows] = await connection.query(
    `
      SELECT id, full_name, owner_user_id
      FROM leads
      WHERE (${clauses.join(" OR ")})
      ${ignoredSql}
      LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

async function getStageIdByName(name) {
  return findIdByName("pipeline_stages", name);
}

async function getStatusIdByName(name) {
  return findIdByName("lead_status", name);
}

async function ensureCompany(connection, { companyName, cnpj, city, state }) {
  if (!companyName && !cnpj) {
    return null;
  }

  const resolvedCompanyName = String(companyName || "").trim() || `Empresa ${cnpj}`;

  const normalizedCnpj = normalizeCnpj(cnpj);

  if (normalizedCnpj) {
    const [existingByCnpj] = await connection.query(
      "SELECT id FROM companies WHERE normalized_cnpj = ? LIMIT 1",
      [normalizedCnpj]
    );

    if (existingByCnpj[0]) {
      return existingByCnpj[0].id;
    }
  }

  const [existingByName] = await connection.query(
    "SELECT id FROM companies WHERE legal_name = ? LIMIT 1",
    [resolvedCompanyName]
  );

  if (existingByName[0]) {
    return existingByName[0].id;
  }

  const [result] = await connection.query(
    `
      INSERT INTO companies (legal_name, trade_name, cnpj, normalized_cnpj, city, state)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [resolvedCompanyName, resolvedCompanyName, cnpj || null, normalizedCnpj, city || null, state || null]
  );

  return result.insertId;
}

async function ensureEntity(connection, { entityName, city, state }) {
  if (!entityName) {
    return null;
  }

  const [existing] = await connection.query(
    "SELECT id FROM entities_unions WHERE name = ? LIMIT 1",
    [entityName]
  );

  if (existing[0]) {
    return existing[0].id;
  }

  const [result] = await connection.query(
    "INSERT INTO entities_unions (name, city, state) VALUES (?, ?, ?)",
    [entityName, city || null, state || null]
  );

  return result.insertId;
}

async function insertTimeline(connection, leadId, payload, createdBy) {
  await connection.query(
    `
      INSERT INTO lead_timeline (lead_id, title, description, icon, color, event_at, created_by)
      VALUES (?, ?, ?, ?, ?, NOW(), ?)
    `,
    [
      leadId,
      payload.title,
      payload.description || null,
      payload.icon || "info",
      payload.color || "info",
      createdBy,
    ]
  );
}

async function replaceTags(connection, leadId, tags = []) {
  await connection.query("DELETE FROM lead_tag_items WHERE lead_id = ?", [leadId]);

  if (!tags.length) {
    return;
  }

  const [tagRows] = await connection.query(
    `SELECT id, name FROM lead_tags WHERE name IN (${tags.map(() => "?").join(",")})`,
    tags
  );

  if (!tagRows.length) {
    return;
  }

  const values = tagRows.map((tag) => [leadId, tag.id]);
  await connection.query("INSERT INTO lead_tag_items (lead_id, tag_id) VALUES ?", [values]);
}

async function assertNoDuplicate(connection, payload, ignoredLeadId = null) {
  const duplicatedLead = await findDuplicateLead(connection, payload, ignoredLeadId);

  if (duplicatedLead) {
    const error = new Error(`Lead duplicado encontrado: ${duplicatedLead.full_name}.`);
    error.status = 409;
    error.duplicateLead = duplicatedLead;
    throw error;
  }
}

async function buildLeadBasePayload(connection, payload) {
  const pipelineStageName = normalizePipelineStageName(payload.pipelineStage);
  const statusName = normalizeStatusName(payload.status, pipelineStageName);

  const [planTypeId, originId, statusId, pipelineStageId, lossReasonId] = await Promise.all([
    payload.planType ? findIdByName("plan_types", payload.planType) : null,
    payload.origin ? findIdByName("lead_origins", payload.origin) : null,
    getStatusIdByName(statusName),
    getStageIdByName(pipelineStageName),
    payload.lossReason ? findIdByName("lead_loss_reasons", payload.lossReason) : null,
  ]);

  if (!statusId || !pipelineStageId) {
    const error = new Error("Status ou etapa informados não existem na configuração do CRM.");
    error.status = 400;
    throw error;
  }

  const companyId = await ensureCompany(connection, payload);
  const entityId = await ensureEntity(connection, payload);

  return {
    planTypeId,
    originId,
    statusId,
    pipelineStageId,
    lossReasonId,
    companyId,
    entityId,
    normalizedPhone: normalizePhone(payload.phone),
    normalizedEmail: normalizeEmail(payload.email),
    normalizedCpf: normalizeCpf(payload.cpf),
  };
}

function buildDateForClose(pipelineStageName, closedAt) {
  if (!["Fechado", "Perdido", "Pós-venda"].includes(pipelineStageName)) {
    return null;
  }

  return closedAt || new Date();
}

async function listLeads(filters, user) {
  const visibility = buildLeadVisibilityClause(user, "l");
  const clauses = [];
  const params = [];

  if (visibility.sql) {
    clauses.push(visibility.sql.replace("WHERE ", ""));
    params.push(...visibility.params);
  }

  if (filters.search) {
    clauses.push("(l.full_name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)");
    params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.origin) {
    clauses.push("o.name = ?");
    params.push(filters.origin);
  }

  if (filters.status) {
    clauses.push("s.name = ?");
    params.push(filters.status);
  }

  if (filters.ownerUserId) {
    clauses.push("l.owner_user_id = ?");
    params.push(filters.ownerUserId);
  }

  if (filters.planType) {
    clauses.push("pt.name = ?");
    params.push(filters.planType);
  }

  if (filters.temperature) {
    clauses.push("l.temperature = ?");
    params.push(filters.temperature);
  }

  if (filters.period === "today") {
    clauses.push("DATE(l.created_at) = CURDATE()");
  } else if (filters.period === "7d") {
    clauses.push("l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");
  } else if (filters.period === "30d") {
    clauses.push("l.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)");
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        l.*,
        pt.name AS plan_type,
        ps.name AS pipeline_stage,
        s.name AS status_name,
        u.full_name AS owner_name,
        o.name AS origin_name,
        c.legal_name AS company_name,
        c.cnpj AS company_cnpj,
        eu.name AS entity_name,
        lr.name AS loss_reason,
        GROUP_CONCAT(DISTINCT lt.name ORDER BY lt.name SEPARATOR ',') AS tags
      FROM leads l
      LEFT JOIN plan_types pt ON pt.id = l.plan_type_id
      LEFT JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
      LEFT JOIN lead_status s ON s.id = l.status_id
      LEFT JOIN users u ON u.id = l.owner_user_id
      LEFT JOIN lead_origins o ON o.id = l.origin_id
      LEFT JOIN companies c ON c.id = l.company_id
      LEFT JOIN entities_unions eu ON eu.id = l.entity_union_id
      LEFT JOIN lead_loss_reasons lr ON lr.id = l.loss_reason_id
      LEFT JOIN lead_tag_items lti ON lti.lead_id = l.id
      LEFT JOIN lead_tags lt ON lt.id = lti.tag_id
      ${whereSql}
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `,
    params
  );

  return rows.map(mapLeadRow);
}

async function getLeadById(leadId, user) {
  const visibility = buildLeadVisibilityClause(user, "l");
  const clauses = ["l.id = ?"];
  const params = [leadId];

  if (visibility.sql) {
    clauses.push(visibility.sql.replace("WHERE ", ""));
    params.push(...visibility.params);
  }

  const [leadRows] = await pool.query(
    `
      SELECT
        l.*,
        pt.name AS plan_type,
        ps.name AS pipeline_stage,
        s.name AS status_name,
        u.full_name AS owner_name,
        o.name AS origin_name,
        c.legal_name AS company_name,
        c.cnpj AS company_cnpj,
        eu.name AS entity_name,
        lr.name AS loss_reason,
        GROUP_CONCAT(DISTINCT lt.name ORDER BY lt.name SEPARATOR ',') AS tags
      FROM leads l
      LEFT JOIN plan_types pt ON pt.id = l.plan_type_id
      LEFT JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
      LEFT JOIN lead_status s ON s.id = l.status_id
      LEFT JOIN users u ON u.id = l.owner_user_id
      LEFT JOIN lead_origins o ON o.id = l.origin_id
      LEFT JOIN companies c ON c.id = l.company_id
      LEFT JOIN entities_unions eu ON eu.id = l.entity_union_id
      LEFT JOIN lead_loss_reasons lr ON lr.id = l.loss_reason_id
      LEFT JOIN lead_tag_items lti ON lti.lead_id = l.id
      LEFT JOIN lead_tags lt ON lt.id = lti.tag_id
      WHERE ${clauses.join(" AND ")}
      GROUP BY l.id
      LIMIT 1
    `,
    params
  );

  if (!leadRows[0]) {
    const error = new Error("Lead não encontrado.");
    error.status = 404;
    throw error;
  }

  const lead = mapLeadRow(leadRows[0]);

  const [interactions, tasks, documents, timeline, assignments] = await Promise.all([
    pool.query(
      `
        SELECT li.id, li.channel, li.subject, li.summary, li.interaction_at, u.full_name AS created_by
        FROM lead_interactions li
        INNER JOIN users u ON u.id = li.created_by
        WHERE li.lead_id = ?
        ORDER BY li.interaction_at DESC
      `,
      [leadId]
    ),
    pool.query(
      `
        SELECT id, title, task_type, due_at, notes, completed, completed_at, created_at
        FROM lead_tasks
        WHERE lead_id = ?
        ORDER BY due_at ASC
      `,
      [leadId]
    ),
    pool.query(
      `
        SELECT id, label, file_name, file_path, mime_type, uploaded_at
        FROM lead_documents
        WHERE lead_id = ?
        ORDER BY uploaded_at DESC
      `,
      [leadId]
    ),
    pool.query(
      `
        SELECT id, title, description, icon, color, event_at
        FROM lead_timeline
        WHERE lead_id = ?
        ORDER BY event_at DESC
      `,
      [leadId]
    ),
    pool.query(
      `
        SELECT la.id, la.assigned_at, la.notes, u.full_name AS user_name, assigner.full_name AS assigned_by
        FROM lead_assignments la
        INNER JOIN users u ON u.id = la.user_id
        INNER JOIN users assigner ON assigner.id = la.assigned_by
        WHERE la.lead_id = ?
        ORDER BY la.assigned_at DESC
      `,
      [leadId]
    ),
  ]);

  return {
    ...lead,
    interactions: interactions[0].map((row) => ({
      id: row.id,
      channel: row.channel,
      subject: row.subject,
      summary: row.summary,
      date: row.interaction_at,
      createdBy: row.created_by,
    })),
    tasks: tasks[0].map((row) => ({
      id: row.id,
      title: row.title,
      type: row.task_type,
      dueDate: row.due_at,
      notes: row.notes,
      completed: Boolean(row.completed),
      completedAt: row.completed_at,
      createdAt: row.created_at,
    })),
    documents: documents[0].map((row) => ({
      id: row.id,
      label: row.label,
      fileName: row.file_name,
      filePath: row.file_path,
      mimeType: row.mime_type,
      uploadedAt: row.uploaded_at,
    })),
    timeline: timeline[0].map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      icon: row.icon,
      color: row.color,
      date: row.event_at,
    })),
    assignments: assignments[0].map((row) => ({
      id: row.id,
      assignedAt: row.assigned_at,
      notes: row.notes,
      userName: row.user_name,
      assignedBy: row.assigned_by,
    })),
  };
}

async function createLead(payload, user) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const createdLead = await createLeadRecord(connection, payload, user);
    await connection.commit();
    return getLeadById(createdLead.id, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createLeadRecord(connection, payload, user) {
  await assertNoDuplicate(connection, payload);

  const reference = await buildLeadBasePayload(connection, payload);

  const normalizedContractType = normalizeContractType(payload.contractType);

  const [result] = await connection.query(
    `
      INSERT INTO leads (
        full_name, phone, normalized_phone, email, normalized_email, cpf, normalized_cpf, city, state, neighborhood,
        age_range, beneficiary_age_ranges_json, beneficiaries, plan_type_id, contract_type, company_id, entity_union_id, has_active_cnpj,
        has_active_mei, operator_interest, budget_range, coparticipation, coverage, urgency, pipeline_stage_id,
        status_id, temperature, owner_user_id, origin_id, source_campaign, notes, initial_notes, has_whatsapp,
        has_current_plan, current_plan, current_plan_expiry, next_contact_at, loss_reason_id, closed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.fullName,
      payload.phone || null,
      reference.normalizedPhone,
      payload.email || null,
      reference.normalizedEmail,
      payload.cpf || null,
      reference.normalizedCpf,
      payload.city || null,
      payload.state || null,
      payload.neighborhood || null,
      payload.ageRange || null,
      stringifyJsonArray(payload.beneficiaryAgeRanges),
      Number(payload.beneficiaries || 1),
      reference.planTypeId,
      normalizedContractType || null,
      reference.companyId,
      reference.entityId,
      payload.hasActiveCnpj ? 1 : 0,
      payload.hasActiveMei ? 1 : 0,
      payload.operatorInterest || null,
      payload.budgetRange || null,
      payload.coparticipation || null,
      payload.coverage || null,
      payload.urgency || null,
      reference.pipelineStageId,
      reference.statusId,
      payload.temperature || "Frio",
      payload.ownerUserId || null,
      reference.originId,
      payload.sourceCampaign || null,
      payload.notes || null,
      payload.initialNotes || null,
      payload.hasWhatsapp ? 1 : 0,
      payload.hasCurrentPlan ? 1 : 0,
      payload.currentPlan || null,
      payload.currentPlanExpiry || null,
      payload.nextContactAt || null,
      reference.lossReasonId,
      buildDateForClose(payload.pipelineStage || "Novo lead", payload.closedAt),
    ]
  );

  if (payload.ownerUserId) {
    await connection.query(
      "INSERT INTO lead_assignments (lead_id, user_id, assigned_by, notes) VALUES (?, ?, ?, ?)",
      [result.insertId, payload.ownerUserId, user.id, "Atribuicao inicial do lead."]
    );
  }

  await replaceTags(connection, result.insertId, payload.tags || []);
  await insertTimeline(
    connection,
    result.insertId,
    {
      title: "Lead criado",
      description: `Cadastro realizado por ${user.name}.`,
      icon: "person_add",
      color: "success",
    },
    user.id
  );

  return {
    id: result.insertId,
    fullName: payload.fullName,
    ownerUserId: payload.ownerUserId || null,
  };
}

async function updateLead(leadId, payload, user) {
  const existingLead = await getLeadById(leadId, user);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await assertNoDuplicate(connection, payload, leadId);

    const reference = await buildLeadBasePayload(connection, {
      ...existingLead,
      ...payload,
      pipelineStage: payload.pipelineStage || existingLead.pipelineStage,
      status: payload.status || existingLead.status,
    });

    const normalizedContractType = normalizeContractType(
      payload.contractType ?? existingLead.contractType
    );

    await connection.query(
      `
        UPDATE leads
        SET
          full_name = ?,
          phone = ?,
          normalized_phone = ?,
          email = ?,
          normalized_email = ?,
          cpf = ?,
          normalized_cpf = ?,
          city = ?,
          state = ?,
          neighborhood = ?,
          age_range = ?,
          beneficiary_age_ranges_json = ?,
          beneficiaries = ?,
          plan_type_id = ?,
          contract_type = ?,
          company_id = ?,
          entity_union_id = ?,
          has_active_cnpj = ?,
          has_active_mei = ?,
          operator_interest = ?,
          budget_range = ?,
          coparticipation = ?,
          coverage = ?,
          urgency = ?,
          pipeline_stage_id = ?,
          status_id = ?,
          temperature = ?,
          owner_user_id = ?,
          origin_id = ?,
          source_campaign = ?,
          notes = ?,
          initial_notes = ?,
          has_whatsapp = ?,
          has_current_plan = ?,
          current_plan = ?,
          current_plan_expiry = ?,
          next_contact_at = ?,
          loss_reason_id = ?,
          closed_at = ?
        WHERE id = ?
      `,
      [
        payload.fullName || existingLead.fullName,
        payload.phone ?? existingLead.phone,
        reference.normalizedPhone ?? normalizePhone(existingLead.phone),
        payload.email ?? existingLead.email,
        reference.normalizedEmail ?? normalizeEmail(existingLead.email),
        payload.cpf ?? existingLead.cpf,
        reference.normalizedCpf ?? normalizeCpf(existingLead.cpf),
        payload.city ?? existingLead.city,
        payload.state ?? existingLead.state,
        payload.neighborhood ?? existingLead.neighborhood,
        payload.ageRange ?? existingLead.ageRange,
        payload.beneficiaryAgeRanges !== undefined
          ? stringifyJsonArray(payload.beneficiaryAgeRanges)
          : stringifyJsonArray(existingLead.beneficiaryAgeRanges),
        Number(payload.beneficiaries ?? existingLead.beneficiaries ?? 1),
        reference.planTypeId,
        normalizedContractType || null,
        reference.companyId,
        reference.entityId,
        payload.hasActiveCnpj ?? (existingLead.hasActiveCnpj ? 1 : 0),
        payload.hasActiveMei ?? (existingLead.hasActiveMei ? 1 : 0),
        payload.operatorInterest ?? existingLead.operatorInterest,
        payload.budgetRange ?? existingLead.budgetRange,
        payload.coparticipation ?? existingLead.coparticipation,
        payload.coverage ?? existingLead.coverage,
        payload.urgency ?? existingLead.urgency,
        reference.pipelineStageId,
        reference.statusId,
        payload.temperature ?? existingLead.temperature,
        payload.ownerUserId ?? existingLead.ownerUserId,
        reference.originId,
        payload.sourceCampaign ?? existingLead.sourceCampaign,
        payload.notes ?? existingLead.notes,
        payload.initialNotes ?? existingLead.initialNotes,
        payload.hasWhatsapp ?? (existingLead.hasWhatsapp ? 1 : 0),
        payload.hasCurrentPlan ?? (existingLead.hasCurrentPlan ? 1 : 0),
        payload.currentPlan ?? existingLead.currentPlan,
        payload.currentPlanExpiry ?? existingLead.currentPlanExpiry,
        payload.nextContactAt ?? existingLead.nextContactAt,
        reference.lossReasonId,
        buildDateForClose(
          payload.pipelineStage || existingLead.pipelineStage,
          payload.closedAt || existingLead.closedAt
        ),
        leadId,
      ]
    );

    if (payload.ownerUserId && Number(payload.ownerUserId) !== Number(existingLead.ownerUserId)) {
      await connection.query(
        "INSERT INTO lead_assignments (lead_id, user_id, assigned_by, notes) VALUES (?, ?, ?, ?)",
        [leadId, payload.ownerUserId, user.id, "Alteração manual do responsável."]
      );
    }

    await replaceTags(connection, leadId, payload.tags || existingLead.tags || []);
    await insertTimeline(
      connection,
      leadId,
      {
        title: "Lead atualizado",
        description: `Dados revisados por ${user.name}.`,
        icon: "edit",
        color: "info",
      },
      user.id
    );

    await connection.commit();
    return getLeadById(leadId, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function moveLeadStage(leadId, pipelineStage, user) {
  return updateLead(
    leadId,
    {
      pipelineStage,
      status: STAGE_DEFAULT_STATUS[pipelineStage] || "Novo lead",
    },
    user
  );
}

async function addInteraction(leadId, payload, user) {
  await getLeadById(leadId, user);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `
        INSERT INTO lead_interactions (lead_id, channel, subject, summary, interaction_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        leadId,
        payload.channel,
        payload.subject,
        payload.summary || null,
        payload.date || new Date(),
        user.id,
      ]
    );

    if (payload.nextContactAt) {
      await connection.query("UPDATE leads SET next_contact_at = ? WHERE id = ?", [
        payload.nextContactAt,
        leadId,
      ]);
    }

    await insertTimeline(
      connection,
      leadId,
      {
        title: `${payload.channel} registrado`,
        description: payload.subject,
        icon: "call",
        color: "success",
      },
      user.id
    );

    await connection.commit();
    return getLeadById(leadId, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function addTask(leadId, payload, user) {
  await getLeadById(leadId, user);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `
        INSERT INTO lead_tasks (lead_id, title, task_type, due_at, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [leadId, payload.title, payload.taskType, payload.dueAt, payload.notes || null, user.id]
    );

    await connection.query("UPDATE leads SET next_contact_at = ? WHERE id = ?", [
      payload.dueAt,
      leadId,
    ]);

    await insertTimeline(
      connection,
      leadId,
      {
        title: "Nova tarefa criada",
        description: payload.title,
        icon: "task_alt",
        color: "primary",
      },
      user.id
    );

    await connection.commit();
    return getLeadById(leadId, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function completeTask(leadId, taskId, user) {
  await getLeadById(leadId, user);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `
        UPDATE lead_tasks
        SET completed = 1, completed_at = NOW()
        WHERE id = ? AND lead_id = ?
      `,
      [taskId, leadId]
    );

    if (!result.affectedRows) {
      const error = new Error("Tarefa não encontrada.");
      error.status = 404;
      throw error;
    }

    await insertTimeline(
      connection,
      leadId,
      {
        title: "Tarefa concluída",
        description: `Conclusão registrada por ${user.name}.`,
        icon: "check_circle",
        color: "success",
      },
      user.id
    );

    await connection.commit();
    return getLeadById(leadId, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function addDocument(leadId, payload, file, user) {
  await getLeadById(leadId, user);

  if (!file) {
    const error = new Error("Arquivo não enviado.");
    error.status = 400;
    throw error;
  }

  const filePath = `/uploads/${path.basename(file.filename)}`;
  const documentLabel = payload.label || "Documento";

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `
        INSERT INTO lead_documents (lead_id, label, file_name, file_path, mime_type, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [leadId, documentLabel, file.originalname, filePath, file.mimetype, user.id]
    );

    await insertTimeline(
      connection,
      leadId,
      {
        title: "Documento anexado",
        description: file.originalname,
        icon: "attach_file",
        color: "dark",
      },
      user.id
    );

    await connection.commit();
    return getLeadById(leadId, user);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteLeadDocuments(filePaths = []) {
  await Promise.all(
    filePaths
      .filter(Boolean)
      .map(async (filePath) => {
        const resolvedPath = path.resolve(__dirname, "../../", String(filePath).replace(/^\/+/, ""));

        try {
          await fs.unlink(resolvedPath);
        } catch (error) {
          if (error?.code !== "ENOENT") {
            // Ignore file cleanup failures because the lead has already been removed from the CRM.
          }
        }
      })
  );
}

async function deleteLead(leadId, user) {
  const existingLead = await getLeadById(leadId, user);
  const connection = await pool.getConnection();
  let documentPaths = [];
  let shouldDeleteDocuments = false;

  try {
    await connection.beginTransaction();

    const [documentRows] = await connection.query(
      "SELECT file_path FROM lead_documents WHERE lead_id = ?",
      [leadId]
    );
    documentPaths = documentRows.map((row) => row.file_path).filter(Boolean);

    await connection.query(
      `
        UPDATE form_submissions
        SET imported = 0, imported_lead_id = NULL, status = 'Novo'
        WHERE imported_lead_id = ?
      `,
      [leadId]
    );

    await connection.query("DELETE FROM inbox_conversations WHERE lead_id = ?", [leadId]);

    const [result] = await connection.query("DELETE FROM leads WHERE id = ?", [leadId]);

    if (!result.affectedRows) {
      const error = new Error("Lead nao encontrado.");
      error.status = 404;
      throw error;
    }

    await connection.commit();
    shouldDeleteDocuments = true;

    return {
      id: existingLead.id,
      fullName: existingLead.fullName,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();

    if (shouldDeleteDocuments && documentPaths.length) {
      await deleteLeadDocuments(documentPaths);
    }
  }
}

module.exports = {
  addDocument,
  addInteraction,
  addTask,
  completeTask,
  createLead,
  createLeadRecord,
  deleteLead,
  findDuplicateLead,
  getLeadById,
  listLeads,
  moveLeadStage,
  updateLead,
};
