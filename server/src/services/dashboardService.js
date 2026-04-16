const { pool } = require("../db/pool");
const { buildLeadVisibilityClause } = require("./referenceService");

async function getDashboardSummary(user) {
  const visibility = buildLeadVisibilityClause(user, "l");
  const whereSql = visibility.sql || "";
  const params = visibility.params || [];
  const taskWhereSql = whereSql ? `${whereSql} AND lt.completed = 0` : "WHERE lt.completed = 0";

  const [totalsRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalLeads,
        SUM(CASE WHEN DATE(l.created_at) = CURDATE() THEN 1 ELSE 0 END) AS newToday,
        SUM(CASE WHEN ps.is_won = 1 AND MONTH(l.closed_at) = MONTH(CURDATE()) AND YEAR(l.closed_at) = YEAR(CURDATE()) THEN 1 ELSE 0 END) AS closedThisMonth,
        SUM(CASE WHEN ps.is_won = 1 THEN 1 ELSE 0 END) AS wonLeads,
        SUM(CASE WHEN ps.name = 'Perdido' THEN 1 ELSE 0 END) AS lostLeads
      FROM leads l
      INNER JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
      ${whereSql}
    `,
    params
  );

  const [originRows] = await pool.query(
    `
      SELECT o.name, COUNT(*) AS total
      FROM leads l
      INNER JOIN lead_origins o ON o.id = l.origin_id
      ${whereSql}
      GROUP BY o.id
      ORDER BY total DESC
    `,
    params
  );

  const [brokerRows] = await pool.query(
    `
      SELECT u.id, u.full_name, COUNT(*) AS total, SUM(CASE WHEN ps.is_won = 1 THEN 1 ELSE 0 END) AS won
      FROM leads l
      INNER JOIN users u ON u.id = l.owner_user_id
      INNER JOIN pipeline_stages ps ON ps.id = l.pipeline_stage_id
      ${whereSql}
      GROUP BY u.id
      ORDER BY won DESC, total DESC
    `,
    params
  );

  const [taskRows] = await pool.query(
    `
      SELECT
        lt.id,
        lt.title,
        lt.task_type,
        lt.due_at,
        lt.completed,
        l.id AS lead_id,
        l.full_name AS lead_name,
        u.full_name AS owner_name
      FROM lead_tasks lt
      INNER JOIN leads l ON l.id = lt.lead_id
      LEFT JOIN users u ON u.id = l.owner_user_id
      ${taskWhereSql}
      ORDER BY lt.due_at ASC
      LIMIT 8
    `,
    params
  );

  const totals = totalsRows[0] || {};
  const finalized = Number(totals.wonLeads || 0) + Number(totals.lostLeads || 0);

  return {
    totals: {
      totalLeads: Number(totals.totalLeads || 0),
      newToday: Number(totals.newToday || 0),
      closedThisMonth: Number(totals.closedThisMonth || 0),
      conversionRate: Number(totals.totalLeads || 0)
        ? Math.round((Number(totals.wonLeads || 0) / Number(totals.totalLeads || 0)) * 100)
        : 0,
      lossRate: finalized ? Math.round((Number(totals.lostLeads || 0) / finalized) * 100) : 0,
    },
    leadsByOrigin: originRows.map((row) => ({
      origin: row.name,
      total: Number(row.total),
    })),
    ranking: brokerRows.map((row) => ({
      id: row.id,
      name: row.full_name,
      total: Number(row.total),
      won: Number(row.won),
      conversionRate: Number(row.total) ? Math.round((Number(row.won) / Number(row.total)) * 100) : 0,
    })),
    nextTasks: taskRows.map((row) => ({
      id: row.id,
      title: row.title,
      taskType: row.task_type,
      dueAt: row.due_at,
      completed: Boolean(row.completed),
      leadId: row.lead_id,
      leadName: row.lead_name,
      ownerName: row.owner_name,
    })),
  };
}

module.exports = {
  getDashboardSummary,
};
