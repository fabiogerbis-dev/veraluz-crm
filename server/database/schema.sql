CREATE DATABASE IF NOT EXISTS veraluz_crm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE veraluz_crm;

CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  city VARCHAR(120),
  state VARCHAR(2),
  active TINYINT(1) NOT NULL DEFAULT 1,
  only_own_leads TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT NOT NULL,
  is_final TINYINT(1) NOT NULL DEFAULT 0,
  is_won TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lead_status (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lead_origins (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS plan_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  sort_order INT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lead_loss_reasons (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lead_tags (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  color VARCHAR(30) DEFAULT 'info',
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS companies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  legal_name VARCHAR(190) NOT NULL,
  trade_name VARCHAR(190),
  cnpj VARCHAR(20),
  normalized_cnpj VARCHAR(20),
  city VARCHAR(120),
  state VARCHAR(2),
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_companies_normalized_cnpj (normalized_cnpj)
);

CREATE TABLE IF NOT EXISTS entities_unions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL UNIQUE,
  document VARCHAR(30),
  city VARCHAR(120),
  state VARCHAR(2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(190) NOT NULL,
  phone VARCHAR(30),
  normalized_phone VARCHAR(20),
  email VARCHAR(190),
  normalized_email VARCHAR(190),
  cpf VARCHAR(20),
  normalized_cpf VARCHAR(20),
  city VARCHAR(120),
  state VARCHAR(2),
  neighborhood VARCHAR(120),
  age_range VARCHAR(50),
  beneficiary_age_ranges_json LONGTEXT,
  beneficiaries INT UNSIGNED NOT NULL DEFAULT 1,
  plan_type_id INT UNSIGNED,
  contract_type VARCHAR(50),
  company_id INT UNSIGNED NULL,
  entity_union_id INT UNSIGNED NULL,
  has_active_cnpj TINYINT(1) NOT NULL DEFAULT 0,
  has_active_mei TINYINT(1) NOT NULL DEFAULT 0,
  operator_interest VARCHAR(120),
  budget_range VARCHAR(120),
  coparticipation VARCHAR(60),
  coverage VARCHAR(60),
  urgency VARCHAR(30),
  pipeline_stage_id INT UNSIGNED NOT NULL,
  status_id INT UNSIGNED NOT NULL,
  temperature VARCHAR(30) NOT NULL DEFAULT 'Frio',
  owner_user_id INT UNSIGNED NULL,
  origin_id INT UNSIGNED NULL,
  source_campaign VARCHAR(150),
  notes TEXT,
  initial_notes TEXT,
  has_whatsapp TINYINT(1) NOT NULL DEFAULT 1,
  has_current_plan TINYINT(1) NOT NULL DEFAULT 0,
  current_plan VARCHAR(120),
  current_plan_expiry DATE NULL,
  next_contact_at DATETIME NULL,
  loss_reason_id INT UNSIGNED NULL,
  closed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_leads_normalized_phone (normalized_phone),
  UNIQUE KEY uq_leads_normalized_email (normalized_email),
  UNIQUE KEY uq_leads_normalized_cpf (normalized_cpf),
  CONSTRAINT fk_leads_plan_type FOREIGN KEY (plan_type_id) REFERENCES plan_types(id),
  CONSTRAINT fk_leads_stage FOREIGN KEY (pipeline_stage_id) REFERENCES pipeline_stages(id),
  CONSTRAINT fk_leads_status FOREIGN KEY (status_id) REFERENCES lead_status(id),
  CONSTRAINT fk_leads_owner FOREIGN KEY (owner_user_id) REFERENCES users(id),
  CONSTRAINT fk_leads_origin FOREIGN KEY (origin_id) REFERENCES lead_origins(id),
  CONSTRAINT fk_leads_loss_reason FOREIGN KEY (loss_reason_id) REFERENCES lead_loss_reasons(id),
  CONSTRAINT fk_leads_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_leads_entity FOREIGN KEY (entity_union_id) REFERENCES entities_unions(id)
);

CREATE TABLE IF NOT EXISTS lead_tag_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT UNSIGNED NOT NULL,
  tag_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lead_tag (lead_id, tag_id),
  CONSTRAINT fk_lead_tag_items_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_tag_items_tag FOREIGN KEY (tag_id) REFERENCES lead_tags(id)
);

CREATE TABLE IF NOT EXISTS lead_interactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT UNSIGNED NOT NULL,
  channel VARCHAR(60) NOT NULL,
  subject VARCHAR(190) NOT NULL,
  summary TEXT,
  interaction_at DATETIME NOT NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lead_interactions_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_interactions_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lead_tasks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(190) NOT NULL,
  task_type VARCHAR(60) NOT NULL,
  due_at DATETIME NOT NULL,
  notes TEXT,
  system_key VARCHAR(80) NULL,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  completed_at DATETIME NULL,
  created_by INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_lead_tasks_system_key (lead_id, system_key, completed, due_at),
  CONSTRAINT fk_lead_tasks_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_tasks_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lead_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT UNSIGNED NOT NULL,
  label VARCHAR(120) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120),
  uploaded_by INT UNSIGNED NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lead_documents_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_documents_user FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lead_assignments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  assigned_by INT UNSIGNED NOT NULL,
  notes VARCHAR(255),
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lead_assignments_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_assignments_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_lead_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lead_timeline (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(190) NOT NULL,
  description TEXT,
  icon VARCHAR(60) DEFAULT 'info',
  color VARCHAR(30) DEFAULT 'info',
  event_at DATETIME NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lead_timeline_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_timeline_user FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS integrations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  channel VARCHAR(60) NOT NULL,
  name VARCHAR(150) NOT NULL,
  status VARCHAR(60) NOT NULL,
  last_sync_at DATETIME NULL,
  origin_mapping VARCHAR(150),
  rule_description VARCHAR(255),
  webhook_url VARCHAR(255),
  settings_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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
);

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
);

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
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  keys_p256dh VARCHAR(255) NOT NULL,
  keys_auth VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_push_subscriptions_endpoint (endpoint),
  KEY idx_push_subscriptions_user_id (user_id),
  CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS form_submissions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
  CONSTRAINT fk_form_submissions_plan_type FOREIGN KEY (plan_type_id) REFERENCES plan_types(id),
  CONSTRAINT fk_form_submissions_origin FOREIGN KEY (origin_id) REFERENCES lead_origins(id),
  CONSTRAINT fk_form_submissions_imported_lead FOREIGN KEY (imported_lead_id) REFERENCES leads(id)
);

CREATE TABLE IF NOT EXISTS settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  setting_value_json TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
