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

function sanitizeStageList(items = []) {
  const seenNames = new Set();

  return (Array.isArray(items) ? items : [])
    .map((item) => {
      if (typeof item === "string") {
        return {
          id: null,
          name: item.trim(),
        };
      }

      return {
        id: item?.id ? Number(item.id) : null,
        name: String(item?.name || "").trim(),
      };
    })
    .filter((item) => item.name)
    .filter((item) => {
      const normalizedName = item.name.toLocaleLowerCase("pt-BR");

      if (seenNames.has(normalizedName)) {
        return false;
      }

      seenNames.add(normalizedName);
      return true;
    })
    .filter((item) => item.name !== REMOVED_PIPELINE_STAGE_NAME);
}

function sanitizeOriginList(items = []) {
  return sanitizeList(items).filter((item) => item !== REMOVED_ORIGIN_NAME);
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

async function syncPipelineStages(connection, items) {
  const [rows] = await connection.query("SELECT id, name FROM pipeline_stages");
  const existingById = new Map(rows.map((row) => [row.id, row]));
  const availableByName = new Map(rows.map((row) => [row.name.toLocaleLowerCase("pt-BR"), row]));
  const activeStageIds = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const stageName = item.name;
    const normalizedName = stageName.toLocaleLowerCase("pt-BR");
    const sortOrder = index + 1;
    const isFinal = ["Fechado", "Perdido", "Pós-venda"].includes(stageName) ? 1 : 0;
    const isWon = ["Fechado", "Pós-venda"].includes(stageName) ? 1 : 0;

    let stageId = item.id && existingById.has(item.id) ? item.id : null;

    if (!stageId) {
      const existingByName = availableByName.get(normalizedName);
      stageId = existingByName?.id || null;
    }

    if (stageId) {
      await connection.query(
        `
          UPDATE pipeline_stages
          SET name = ?, sort_order = ?, is_final = ?, is_won = ?, active = 1
          WHERE id = ?
        `,
        [stageName, sortOrder, isFinal, isWon, stageId]
      );

      activeStageIds.push(stageId);
      availableByName.set(normalizedName, { id: stageId, name: stageName });
      continue;
    }

    const [result] = await connection.query(
      `
        INSERT INTO pipeline_stages (name, sort_order, is_final, is_won, active)
        VALUES (?, ?, ?, ?, 1)
      `,
      [stageName, sortOrder, isFinal, isWon]
    );

    activeStageIds.push(result.insertId);
    availableByName.set(normalizedName, { id: result.insertId, name: stageName });
  }

  const disabledStages = rows.filter((row) => !activeStageIds.includes(row.id));

  if (!disabledStages.length) {
    return;
  }

  const disabledStageIds = disabledStages.map((row) => row.id);
  const [leadRows] = await connection.query(
    `
      SELECT pipeline_stage_id AS pipelineStageId
      FROM leads
      WHERE pipeline_stage_id IN (${disabledStageIds.map(() => "?").join(",")})
      LIMIT 1
    `,
    disabledStageIds
  );

  if (leadRows.length) {
    const blockedStage = disabledStages.find(
      (row) => row.id === Number(leadRows[0].pipelineStageId)
    );
    const error = new Error(
      `Nao e possivel remover a etapa \"${blockedStage?.name || "selecionada"}\" porque existem leads vinculados a ela.`
    );
    error.status = 400;
    throw error;
  }

  await connection.query(
    `UPDATE pipeline_stages SET active = 0 WHERE id IN (${disabledStageIds.map(() => "?").join(",")})`,
    disabledStageIds
  );
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

    const pipelineStages = sanitizeStageList(payload.pipelineStages);
    const planTypes = sanitizeList(payload.planTypes);
    const operatorInterests = sanitizeList(payload.operatorInterests);
    const tags = sanitizeList(payload.tags);
    const lossReasons = sanitizeList(payload.lossReasons);
    const origins = sanitizeOriginList(payload.origins);

    if (pipelineStages.length) {
      await syncPipelineStages(connection, pipelineStages);
    }

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

    if (lossReasons.length) {
      await syncNamedTable(connection, "lead_loss_reasons", lossReasons);
    }

    if (origins.length) {
      await syncNamedTable(connection, "lead_origins", origins);
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
