const { pool } = require("../db/pool");

const ORDER_BY_MAP = {
  pipeline_stages: "sort_order, id",
  lead_status: "sort_order, id",
  plan_types: "sort_order, id",
  lead_origins: "id",
  lead_loss_reasons: "id",
};

async function getLookupMap(tableName) {
  const orderBy = ORDER_BY_MAP[tableName] || "name";
  const [rows] = await pool.query(
    `SELECT id, name FROM ${tableName} WHERE active = 1 ORDER BY ${orderBy}`
  );
  return rows;
}

async function getReferenceData() {
  const [origins, statuses, stages, planTypes, tags, lossReasons] = await Promise.all([
    getLookupMap("lead_origins"),
    getLookupMap("lead_status"),
    getLookupMap("pipeline_stages"),
    getLookupMap("plan_types"),
    getLookupMap("lead_tags"),
    getLookupMap("lead_loss_reasons"),
  ]);

  return {
    origins,
    statuses,
    stages,
    planTypes,
    tags,
    lossReasons,
  };
}

async function findIdByName(tableName, value) {
  if (!value) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT id FROM ${tableName} WHERE name = ? AND active = 1 LIMIT 1`,
    [value]
  );
  return rows[0]?.id || null;
}

async function findSetting(settingKey) {
  const [rows] = await pool.query(
    "SELECT setting_value_json FROM settings WHERE setting_key = ? LIMIT 1",
    [settingKey]
  );

  if (!rows[0]) {
    return null;
  }

  return JSON.parse(rows[0].setting_value_json);
}

function buildLeadVisibilityClause(user, alias = "l") {
  if (user.role === "broker" && user.onlyOwnLeads) {
    return {
      sql: `WHERE ${alias}.owner_user_id = ?`,
      params: [user.id],
    };
  }

  return {
    sql: "",
    params: [],
  };
}

module.exports = {
  buildLeadVisibilityClause,
  findIdByName,
  findSetting,
  getReferenceData,
};
