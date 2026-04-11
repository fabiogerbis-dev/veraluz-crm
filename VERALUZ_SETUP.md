# Veraluz CRM

## Stack Docker local

O projeto sobe localmente com estes serviços:

- `frontend`: React + Material Dashboard servido por Nginx
- `api`: Node.js + Express
- `mariadb`: banco principal do CRM
- `adminer`: painel web para inspeção do banco

## Subida rápida

1. Subir tudo:
   `npm run docker:up`
2. Ver logs:
   `npm run docker:logs`
3. Derrubar stack:
   `npm run docker:down`
4. Resetar banco e volumes:
   `npm run docker:reset`

## Portas

- Front-end: `http://localhost:3000`
- API: `http://localhost:4000`
- Adminer: `http://localhost:8080`
- MariaDB: `localhost:3306`

## Credencial inicial

- Admin: `contato@veraluz.net.br`
- Senha: `Vera3636#`

Usuários extras devem ser criados pela interface do CRM na área de usuários.

## Banco de dados

Arquivos principais:

- Schema: [schema.sql](/c:/dev/veraluz-crm/server/database/schema.sql)
- Seed: [seed.sql](/c:/dev/veraluz-crm/server/database/seed.sql)

O MariaDB é inicializado automaticamente na primeira subida do volume.

## Compatibilidade de schema

A API garante na inicialização a presença dos campos:

- `leads.has_active_cnpj`
- `leads.has_active_mei`

Isso mantém bases já existentes compatíveis com a implementação atual do formulário e do detalhe do lead.

## Serviços-chave

- Compose: [docker-compose.yml](/c:/dev/veraluz-crm/docker-compose.yml)
- Front Docker: [Dockerfile](/c:/dev/veraluz-crm/Dockerfile)
- Nginx: [default.conf](/c:/dev/veraluz-crm/docker/nginx/default.conf)
- API Docker: [Dockerfile](/c:/dev/veraluz-crm/server/Dockerfile)
- API app: [app.js](/c:/dev/veraluz-crm/server/src/app.js)
- Regras de leads: [leadService.js](/c:/dev/veraluz-crm/server/src/services/leadService.js)

## Endpoints principais

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard/summary`
- `GET /api/leads`
- `GET /api/leads/:id`
- `POST /api/leads`
- `PUT /api/leads/:id`
- `PATCH /api/leads/:id/stage`
- `POST /api/leads/:id/interactions`
- `POST /api/leads/:id/tasks`
- `PATCH /api/leads/:id/tasks/:taskId/complete`
- `POST /api/leads/:id/documents`
- `GET /api/tasks`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id/toggle-status`
- `GET /api/integrations`
- `GET /api/integrations/form-submissions`
- `POST /api/integrations/form-submissions/:id/import`
- `GET /api/reports/leads/export`
- `GET /api/settings`

## Observação

O front-end já compila em produção no container e o app pode ser instalado como PWA. A base Docker está pronta para uso local completo com banco persistido em volume.
