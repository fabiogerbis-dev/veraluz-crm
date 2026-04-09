SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

START TRANSACTION;

UPDATE leads SET pipeline_stage_id = 4 WHERE pipeline_stage_id = 10;
UPDATE leads SET pipeline_stage_id = 6 WHERE pipeline_stage_id = 11;
UPDATE leads SET pipeline_stage_id = 9 WHERE pipeline_stage_id = 12;

UPDATE leads SET origin_id = 5 WHERE origin_id = 7;
UPDATE form_submissions SET origin_id = 5 WHERE origin_id = 7;

UPDATE leads SET loss_reason_id = 1 WHERE loss_reason_id = 6;

DELETE FROM pipeline_stages WHERE id IN (10, 11, 12);
DELETE FROM lead_origins WHERE id = 7;
DELETE FROM lead_loss_reasons WHERE id = 6;

UPDATE pipeline_stages
SET name = 'Novo lead', sort_order = 1, is_final = 0, is_won = 0, active = 1
WHERE id = 1;

UPDATE pipeline_stages
SET name = 'Em contato', sort_order = 2, is_final = 0, is_won = 0, active = 1
WHERE id = 2;

UPDATE pipeline_stages
SET name = 'Qualificado', sort_order = 3, is_final = 0, is_won = 0, active = 1
WHERE id = 3;

UPDATE pipeline_stages
SET name = 'Cotação', sort_order = 4, is_final = 0, is_won = 0, active = 1
WHERE id = 4;

UPDATE pipeline_stages
SET name = 'Proposta enviada', sort_order = 5, is_final = 0, is_won = 0, active = 1
WHERE id = 5;

UPDATE pipeline_stages
SET name = 'Negociação', sort_order = 6, is_final = 0, is_won = 0, active = 1
WHERE id = 6;

UPDATE pipeline_stages
SET name = 'Fechado', sort_order = 7, is_final = 1, is_won = 1, active = 1
WHERE id = 7;

UPDATE pipeline_stages
SET name = 'Perdido', sort_order = 8, is_final = 1, is_won = 0, active = 1
WHERE id = 8;

UPDATE pipeline_stages
SET name = 'Pós-venda', sort_order = 9, is_final = 1, is_won = 1, active = 1
WHERE id = 9;

UPDATE lead_status
SET name = 'Novo lead', sort_order = 1, active = 1
WHERE id = 1;

UPDATE lead_status
SET name = 'Em contato', sort_order = 2, active = 1
WHERE id = 2;

UPDATE lead_status
SET name = 'Qualificado', sort_order = 3, active = 1
WHERE id = 3;

UPDATE lead_status
SET name = 'Cotação em andamento', sort_order = 4, active = 1
WHERE id = 4;

UPDATE lead_status
SET name = 'Proposta enviada', sort_order = 5, active = 1
WHERE id = 5;

UPDATE lead_status
SET name = 'Aguardando retorno', sort_order = 6, active = 1
WHERE id = 6;

UPDATE lead_status
SET name = 'Em negociação', sort_order = 7, active = 1
WHERE id = 7;

UPDATE lead_status
SET name = 'Venda fechada', sort_order = 8, active = 1
WHERE id = 8;

UPDATE lead_status
SET name = 'Perdido', sort_order = 9, active = 1
WHERE id = 9;

UPDATE lead_status
SET name = 'Pós-venda', sort_order = 10, active = 1
WHERE id = 10;

UPDATE lead_origins
SET name = 'Site', active = 1
WHERE id = 1;

UPDATE lead_origins
SET name = 'Instagram', active = 1
WHERE id = 2;

UPDATE lead_origins
SET name = 'Facebook', active = 1
WHERE id = 3;

UPDATE lead_origins
SET name = 'WhatsApp', active = 1
WHERE id = 4;

UPDATE lead_origins
SET name = 'Indicação', active = 1
WHERE id = 5;

UPDATE lead_origins
SET name = 'Cadastro manual', active = 1
WHERE id = 6;

UPDATE lead_loss_reasons
SET name = 'Preço', active = 1
WHERE id = 1;

UPDATE lead_loss_reasons
SET name = 'Sem interesse', active = 1
WHERE id = 2;

UPDATE lead_loss_reasons
SET name = 'Fechou com concorrente', active = 1
WHERE id = 3;

UPDATE lead_loss_reasons
SET name = 'Sem retorno', active = 1
WHERE id = 4;

UPDATE lead_loss_reasons
SET name = 'Fora do perfil', active = 1
WHERE id = 5;

COMMIT;
