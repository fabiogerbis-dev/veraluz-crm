const { pool } = require("../db/pool");
const { getReferenceData } = require("./referenceService");

const REMOVED_PIPELINE_STAGE_NAME = "Qualificado";
const REMOVED_ORIGIN_NAME = "Indicação";
const DEFAULT_PIPELINE_STAGE_NAME = "Novo lead";
const DEFAULT_STATUS_NAME = "Novo lead";

function sanitizeList(items = []) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

async function upsertSetting(connection, settingKey, settingValue) {
  await connection.query(
    `
      INSERT INTO settings (setting_key, setting_value_json)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE setting_value_json = VALUES(setting_value_json)
    `,
    [settingKey, JSON.stringify(settingValue)]
  );
}

async function syncNamedTable(connection, tableName, names, options = {}) {
  const { defaultColor = "info", includeSortOrder = false } = options;

  const [rows] = await connection.query(`SELECT id, name FROM ${tableName}`);
  const existingNames = new Set(rows.map((row) => row.name));

  for (let index = 0; index < names.length; index += 1) {
    const name = names[index];

    if (tableName === "lead_tags") {
      if (existingNames.has(name)) {
        await connection.query(
          "UPDATE lead_tags SET color = ?, active = 1 WHERE name = ?",
          [defaultColor, name]
        );
      } else {
        await connection.query(
          "INSERT INTO lead_tags (name, color, active) VALUES (?, ?, 1)",
          [name, defaultColor]
        );
      }

      continue;
    }

    if (tableName === "pipeline_stages") {
      const isFinal = ["Fechado", "Perdido", "Pós-venda"].includes(name) ? 1 : 0;
      const isWon = ["Fechado", "Pós-venda"].includes(name) ? 1 : 0;

      if (existingNames.has(name)) {
        await connection.query(
          `
            UPDATE pipeline_stages
            SET sort_order = ?, is_final = ?, is_won = ?, active = 1
            WHERE name = ?
          `,
          [index + 1, isFinal, isWon, name]
        );
      } else {
        await connection.query(
          `
            INSERT INTO pipeline_stages (name, sort_order, is_final, is_won, active)
            VALUES (?, ?, ?, ?, 1)
          `,
          [name, index + 1, isFinal, isWon]
        );
      }

      continue;
    }

    if (includeSortOrder) {
      if (existingNames.has(name)) {
        await connection.query(
          `UPDATE ${tableName} SET sort_order = ?, active = 1 WHERE name = ?`,
          [index + 1, name]
        );
      } else {
        await connection.query(
          `INSERT INTO ${tableName} (name, sort_order, active) VALUES (?, ?, 1)`,
          [name, index + 1]
        );
      }

      continue;
    }

    if (existingNames.has(name)) {
      await connection.query(`UPDATE ${tableName} SET active = 1 WHERE name = ?`, [name]);
    } else {
      await connection.query(`INSERT INTO ${tableName} (name, active) VALUES (?, 1)`, [name]);
    }
  }

  const disabledNames = rows
    .map((row) => row.name)
    .filter((name) => !names.includes(name));

  if (disabledNames.length) {
    await connection.query(
      `UPDATE ${tableName} SET active = 0 WHERE name IN (${disabledNames.map(() => "?").join(",")})`,
      disabledNames
    );
  }
}

async function applyLeadBusinessRuleMigrations(connection) {
  const [defaultStageResult, legacyStageResult, defaultStatusResult, legacyStatusResult] =
    await Promise.all([
      connection.query(
        "SELECT id FROM pipeline_stages WHERE name = ? LIMIT 1",
        [DEFAULT_PIPELINE_STAGE_NAME]
      ),
      connection.query(
        "SELECT id FROM pipeline_stages WHERE name = ? LIMIT 1",
        [REMOVED_PIPELINE_STAGE_NAME]
      ),
      connection.query("SELECT id FROM lead_status WHERE name = ? LIMIT 1", [DEFAULT_STATUS_NAME]),
      connection.query("SELECT id FROM lead_status WHERE name = ? LIMIT 1", [REMOVED_PIPELINE_STAGE_NAME]),
    ]);

  const defaultStageRow = defaultStageResult[0]?.[0];
  const legacyStageRow = legacyStageResult[0]?.[0];
  const defaultStatusRow = defaultStatusResult[0]?.[0];
  const legacyStatusRow = legacyStatusResult[0]?.[0];

  if (defaultStageRow?.id && legacyStageRow?.id) {
    await connection.query(
      "UPDATE leads SET pipeline_stage_id = ? WHERE pipeline_stage_id = ?",
      [defaultStageRow.id, legacyStageRow.id]
    );
    await connection.query("UPDATE pipeline_stages SET active = 0 WHERE id = ?", [legacyStageRow.id]);
  }

  if (defaultStatusRow?.id && legacyStatusRow?.id) {
    await connection.query("UPDATE leads SET status_id = ? WHERE status_id = ?", [
      defaultStatusRow.id,
      legacyStatusRow.id,
    ]);
  }

  await connection.query("UPDATE lead_origins SET active = 0 WHERE name = ?", [REMOVED_ORIGIN_NAME]);
}

async function getSettings() {
  const [settingsRows] = await pool.query("SELECT setting_key, setting_value_json FROM settings");
  const references = await getReferenceData();

  const settings = settingsRows.reduce((accumulator, row) => {
    accumulator[row.setting_key] = JSON.parse(row.setting_value_json);
    return accumulator;
  }, {});

  return {
    ...settings,
    ...references,
  };
}

async function updateSettings(payload) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await applyLeadBusinessRuleMigrations(connection);

    const planTypes = sanitizeList(payload.planTypes);
    const operatorInterests = sanitizeList(payload.operatorInterests);
    const tags = sanitizeList(payload.tags);

    if (planTypes.length) {
      await syncNamedTable(connection, "plan_types", planTypes, {
        includeSortOrder: true,
      });
    }

    if (tags.length) {
      await syncNamedTable(connection, "lead_tags", tags, {
        defaultColor: "info",
      });
    }

    if (Object.prototype.hasOwnProperty.call(payload, "operatorInterests")) {
      if (!operatorInterests.length) {
        throw new Error("Inclua ao menos uma operadora nas configurações.");
      }

      await upsertSetting(connection, "operatorInterests", operatorInterests);
    }

    if (payload.brokerage) {
      await upsertSetting(connection, "brokerage", payload.brokerage);
    }

    if (payload.notifications) {
      await upsertSetting(connection, "notifications", payload.notifications);
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getSettings();
}

module.exports = {
  getSettings,
  updateSettings,
};
