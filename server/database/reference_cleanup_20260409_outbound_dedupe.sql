-- Limpeza de mensagens outbound duplicadas no inbox
-- Criterio: mesma conversa + direcao outbound + mesmo conteudo/tipo + janela de 20s.
-- Mantem sempre o registro mais antigo (menor id).

START TRANSACTION;

CREATE TABLE IF NOT EXISTS inbox_messages_outbound_dedupe_backup_20260409 LIKE inbox_messages;

INSERT INTO inbox_messages_outbound_dedupe_backup_20260409
SELECT m2.*
FROM inbox_messages m1
INNER JOIN inbox_messages m2
  ON m2.id > m1.id
 AND m2.conversation_id = m1.conversation_id
 AND m2.direction = 'outbound'
 AND m1.direction = 'outbound'
 AND COALESCE(m2.message_type, 'text') = COALESCE(m1.message_type, 'text')
 AND COALESCE(m2.body, '') = COALESCE(m1.body, '')
 AND COALESCE(m2.media_url, '') = COALESCE(m1.media_url, '')
 AND ABS(TIMESTAMPDIFF(SECOND, COALESCE(m1.sent_at, m1.created_at), COALESCE(m2.sent_at, m2.created_at))) <= 20
 AND ABS(TIMESTAMPDIFF(SECOND, m1.created_at, m2.created_at)) <= 20
 AND COALESCE(m2.external_message_id, '') <> COALESCE(m1.external_message_id, '')
WHERE m2.id NOT IN (
  SELECT id FROM inbox_messages_outbound_dedupe_backup_20260409
);

DELETE m
FROM inbox_messages m
INNER JOIN inbox_messages_outbound_dedupe_backup_20260409 b ON b.id = m.id;

COMMIT;

SELECT COUNT(*) AS removed_rows
FROM inbox_messages_outbound_dedupe_backup_20260409;
