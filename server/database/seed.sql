USE veraluz_crm;

DELETE FROM form_submissions;
DELETE FROM lead_timeline;
DELETE FROM lead_documents;
DELETE FROM lead_tasks;
DELETE FROM lead_interactions;
DELETE FROM lead_assignments;
DELETE FROM lead_tag_items;
DELETE FROM leads;
DELETE FROM integrations;
DELETE FROM companies;
DELETE FROM entities_unions;
DELETE FROM users;
DELETE FROM settings;

INSERT INTO roles (id, slug, label) VALUES
  (1, 'admin', 'Administrador'),
  (2, 'manager', 'Gerente'),
  (3, 'broker', 'Corretor')
ON DUPLICATE KEY UPDATE label = VALUES(label);

INSERT INTO pipeline_stages (id, name, sort_order, is_final, is_won, active) VALUES
  (1, 'Novo lead', 1, 0, 0, 1),
  (2, 'Em contato', 2, 0, 0, 1),
  (3, 'Qualificado', 3, 0, 0, 0),
  (4, 'Cotação', 4, 0, 0, 1),
  (5, 'Proposta enviada', 5, 0, 0, 1),
  (6, 'Negociação', 6, 0, 0, 1),
  (7, 'Fechado', 7, 1, 1, 1),
  (8, 'Perdido', 8, 1, 0, 1),
  (9, 'Pós-venda', 9, 1, 1, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_final = VALUES(is_final),
  is_won = VALUES(is_won),
  active = VALUES(active);

INSERT INTO lead_status (id, name, sort_order, active) VALUES
  (1, 'Novo lead', 1, 1),
  (2, 'Em contato', 2, 1),
  (3, 'Qualificado', 3, 0),
  (4, 'Cotação em andamento', 4, 1),
  (5, 'Proposta enviada', 5, 1),
  (6, 'Aguardando retorno', 6, 1),
  (7, 'Em negociação', 7, 1),
  (8, 'Venda fechada', 8, 1),
  (9, 'Perdido', 9, 1),
  (10, 'Pós-venda', 10, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  active = VALUES(active);

INSERT INTO lead_origins (id, name, active) VALUES
  (1, 'Site', 1),
  (2, 'Instagram', 1),
  (3, 'Facebook', 1),
  (4, 'WhatsApp', 1),
  (5, 'Indicação', 0),
  (6, 'Cadastro manual', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  active = VALUES(active);

INSERT INTO plan_types (id, name, sort_order, active) VALUES
  (1, 'Individual', 1, 1),
  (2, 'Familiar', 2, 1),
  (3, 'Empresarial', 3, 1),
  (4, 'MEI', 4, 1),
  (5, 'Entidade de classe / sindicato', 5, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  active = VALUES(active);

INSERT INTO lead_loss_reasons (id, name, active) VALUES
  (1, 'Preço', 1),
  (2, 'Sem interesse', 1),
  (3, 'Fechou com concorrente', 1),
  (4, 'Sem retorno', 1),
  (5, 'Fora do perfil', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  active = VALUES(active);

INSERT INTO lead_tags (id, name, color, active) VALUES
  (1, 'urgente', 'error', 1),
  (2, 'retorno', 'warning', 1),
  (3, 'mei', 'info', 1),
  (4, 'familiar', 'success', 1),
  (5, 'sindicato', 'dark', 1),
  (6, 'alto valor', 'success', 1),
  (7, 'premium', 'primary', 1),
  (8, 'concorrente', 'warning', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  color = VALUES(color),
  active = VALUES(active);

INSERT INTO users (
  id,
  role_id,
  full_name,
  email,
  password_hash,
  phone,
  city,
  state,
  active,
  only_own_leads,
  last_login_at
) VALUES
  (
    1,
    1,
    'Administrador Veraluz',
    'contato@veraluz.net.br',
    'veraluz-fixed-salt:d590ddb2db307315198db174d606a6d6f6ce95f9e2a41f16698ed0f0a8312e9812f5e54526475431405468bcda2c03ddc6f78410848878d71d05c1c52da41cd5',
    NULL,
    NULL,
    NULL,
    1,
    0,
    NULL
  );

INSERT INTO settings (setting_key, setting_value_json) VALUES
  ('brokerage', '{"name":"Veraluz CRM","cnpj":"","city":"","state":"","supportPhone":"","supportEmail":"contato@veraluz.net.br"}'),
  ('notifications', '{"browser":true,"overdueFollowUps":true,"dailyAgenda":true}'),
  ('permissions', '{"brokerOwnLeadsDefault":true,"adminCanSeeAll":true}')
ON DUPLICATE KEY UPDATE setting_value_json = VALUES(setting_value_json);
