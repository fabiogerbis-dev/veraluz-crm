const { pool } = require("../db/pool");
const { buildLeadVisibilityClause } = require("./referenceService");

async function listTasks(filters, user) {
  const visibility = buildLeadVisibilityClause(user, "l");
  const clauses = [];
  const params = [];

  if (visibility.sql) {
    clauses.push(visibility.sql.replace("WHERE ", ""));
    params.push(...visibility.params);
  }

  if (filters.ownerUserId) {
    clauses.push("l.owner_user_id = ?");
    params.push(filters.ownerUserId);
  }

  if (filters.scope === "today") {
    clauses.push("lt.completed = 0 AND DATE(lt.due_at) = CURDATE()");
  } else if (filters.scope === "overdue") {
    clauses.push("lt.completed = 0 AND lt.due_at < NOW()");
  } else if (filters.scope === "upcoming") {
    clauses.push("lt.completed = 0 AND lt.due_at >= NOW()");
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        lt.id,
        lt.title,
        lt.task_type,
        lt.due_at,
        lt.notes,
        lt.completed,
        lt.completed_at,
        l.id AS lead_id,
        l.full_name AS lead_name,
        l.phone AS lead_phone,
        u.id AS owner_user_id,
        u.full_name AS owner_name,
        ps.name AS pipeline_stage
      FROM lead_tasks lt
      INNER JOIN leads l ON l.id = lt.lead_id
      LEFT JOIN users u ON u.id = l.owner_user_id
      LEFT JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
      ${whereSql}
      ORDER BY lt.due_at ASC
    `,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    taskType: row.task_type,
    dueAt: row.due_at,
    notes: row.notes,
    completed: Boolean(row.completed),
    completedAt: row.completed_at,
    leadId: row.lead_id,
    leadName: row.lead_name,
    leadPhone: row.lead_phone,
    ownerUserId: row.owner_user_id,
    ownerName: row.owner_name,
    pipelineStage: row.pipeline_stage,
  }));
}

module.exports = {
  listTasks,
};
