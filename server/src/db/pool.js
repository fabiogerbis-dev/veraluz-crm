const mysql = require("mysql2/promise");
const env = require("../config/env");

const pool = mysql.createPool(env.db);

async function testConnection() {
  const connection = await pool.getConnection();
  await connection.ping();
  connection.release();
}

async function ensureSchemaCompatibility() {
  await pool.query(`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS has_active_cnpj TINYINT(1) NOT NULL DEFAULT 0 AFTER entity_union_id
  `);

  await pool.query(`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS has_active_mei TINYINT(1) NOT NULL DEFAULT 0 AFTER has_active_cnpj
  `);

  await pool.query(`
    ALTER TABLE leads
    ADD COLUMN IF NOT EXISTS beneficiary_age_ranges_json LONGTEXT NULL AFTER age_range
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inbox_conversations (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      external_id VARCHAR(120) NULL,
      source VARCHAR(60) NOT NULL DEFAULT 'zap_responder',
      channel VARCHAR(40) NOT NULL,
      department_id VARCHAR(120),
      department_name VARCHAR(150),
      lead_id BIGINT UNSIGNED NULL,
      assigned_user_id INT UNSIGNED NULL,
      chat_id VARCHAR(120),
      normalized_phone VARCHAR(20),
      contact_name VARCHAR(190),
      contact_phone VARCHAR(40),
      contact_email VARCHAR(190),
      contact_avatar_url VARCHAR(500),
      protocol VARCHAR(120),
      status VARCHAR(40) NOT NULL DEFAULT 'open',
      last_message_preview VARCHAR(255),
      last_message_at DATETIME NULL,
      unread_count INT UNSIGNED NOT NULL DEFAULT 0,
      qualification_status VARCHAR(40) NOT NULL DEFAULT 'not_started',
      qualification_step_key VARCHAR(80) NULL,
      qualification_payload_json LONGTEXT NULL,
      qualification_started_at DATETIME NULL,
      qualification_completed_at DATETIME NULL,
      qualification_last_question_at DATETIME NULL,
      raw_payload_json LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_inbox_conversations_external_id (external_id),
      UNIQUE KEY uq_inbox_conversations_department_chat (department_id, chat_id),
      KEY idx_inbox_conversations_last_message_at (last_message_at),
      KEY idx_inbox_conversations_status (status),
      KEY idx_inbox_conversations_qualification_status (qualification_status),
      CONSTRAINT fk_inbox_conversations_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      CONSTRAINT fk_inbox_conversations_assigned_user FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inbox_messages (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      conversation_id BIGINT UNSIGNED NOT NULL,
      external_message_id VARCHAR(190) NULL,
      dedupe_key VARCHAR(190) NOT NULL,
      direction VARCHAR(20) NOT NULL,
      channel VARCHAR(40) NOT NULL,
      message_type VARCHAR(40) NOT NULL DEFAULT 'text',
      body TEXT NULL,
      media_url VARCHAR(500) NULL,
      mime_type VARCHAR(120),
      file_name VARCHAR(255),
      status VARCHAR(40),
      sender_name VARCHAR(190),
      sender_phone VARCHAR(40),
      raw_payload_json LONGTEXT NULL,
      created_by INT UNSIGNED NULL,
      sent_at DATETIME NULL,
      delivered_at DATETIME NULL,
      read_at DATETIME NULL,
      failed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_inbox_messages_dedupe (dedupe_key),
      KEY idx_inbox_messages_conversation_id (conversation_id, sent_at, id),
      KEY idx_inbox_messages_external_message_id (external_message_id),
      CONSTRAINT fk_inbox_messages_conversation FOREIGN KEY (conversation_id) REFERENCES inbox_conversations(id) ON DELETE CASCADE,
      CONSTRAINT fk_inbox_messages_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS integration_webhook_events (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      source VARCHAR(60) NOT NULL,
      event_key VARCHAR(190) NOT NULL,
      event_type VARCHAR(80),
      channel VARCHAR(40),
      status VARCHAR(40) NOT NULL DEFAULT 'received',
      error_message VARCHAR(255),
      payload_json LONGTEXT NOT NULL,
      received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME NULL,
      UNIQUE KEY uq_integration_webhook_events_source_key (source, event_key),
      KEY idx_integration_webhook_events_received_at (received_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS form_submissions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      external_id VARCHAR(120) NULL,
      full_name VARCHAR(190) NOT NULL,
      phone VARCHAR(30),
      email VARCHAR(190),
      city VARCHAR(120),
      state VARCHAR(2),
      plan_type_id INT UNSIGNED NULL,
      beneficiaries INT UNSIGNED NOT NULL DEFAULT 1,
      origin_id INT UNSIGNED NULL,
      campaign VARCHAR(150),
      raw_payload_json TEXT,
      received_at DATETIME NOT NULL,
      imported TINYINT(1) NOT NULL DEFAULT 0,
      imported_lead_id BIGINT UNSIGNED NULL,
      status VARCHAR(60) NOT NULL DEFAULT 'Novo',
      UNIQUE KEY uq_form_submissions_external_id (external_id),
      CONSTRAINT fk_form_submissions_plan_type FOREIGN KEY (plan_type_id) REFERENCES plan_types(id),
      CONSTRAINT fk_form_submissions_origin FOREIGN KEY (origin_id) REFERENCES lead_origins(id),
      CONSTRAINT fk_form_submissions_imported_lead FOREIGN KEY (imported_lead_id) REFERENCES leads(id)
    )
  `);

  await pool.query(`
    ALTER TABLE form_submissions
    ADD COLUMN IF NOT EXISTS external_id VARCHAR(120) NULL AFTER id
  `);

  await pool.query(`
    ALTER TABLE inbox_conversations
    ADD COLUMN IF NOT EXISTS qualification_status VARCHAR(40) NOT NULL DEFAULT 'not_started' AFTER unread_count
  `);

  await pool.query(`
    ALTER TABLE inbox_conversations
    ADD COLUMN IF NOT EXISTS qualification_step_key VARCHAR(80) NULL AFTER qualification_status
  `);

  await pool.query(`
    ALTER TABLE inbox_conversations
    ADD COLUMN IF NOT EXISTS qualification_payload_json LONGTEXT NULL AFTER qualification_step_key
  `);

  await pool.query(`
    ALTER TABLE inbox_conversations
    ADD COLUMN IF NOT EXISTS qualification_started_at DATETIME NULL AFTER qualification_payload_json
  `);

  await pool.query(`
    ALTER TABLE inbox_conversations
    ADD COLUMN IF NOT EXISTS qualification_completed_at DATETIME NULL AFTER qualification_started_at
  `);

  await pool.query(`
    ALTER TABLE inbox_conversations
    ADD COLUMN IF NOT EXISTS qualification_last_question_at DATETIME NULL AFTER qualification_completed_at
  `);

  try {
    await pool.query(`
      ALTER TABLE form_submissions
      ADD UNIQUE KEY uq_form_submissions_external_id (external_id)
    `);
  } catch (error) {
    if (error?.errno !== 1061) {
      throw error;
    }
  }

  try {
    await pool.query(`
      ALTER TABLE inbox_conversations
      ADD KEY idx_inbox_conversations_qualification_status (qualification_status)
    `);
  } catch (error) {
    if (error?.errno !== 1061) {
      throw error;
    }
  }
}

module.exports = {
  ensureSchemaCompatibility,
  pool,
  testConnection,
};
