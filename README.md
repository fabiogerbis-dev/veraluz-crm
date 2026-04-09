# Veraluz CRM

CRM comercial para captação, qualificação e acompanhamento de leads de planos de saúde.

## Stack

- Frontend: React 18 + MUI + Material Dashboard
- API: Node.js + Express
- Banco: MariaDB
- Realtime: Server-Sent Events
- Deploy local: Docker Compose
- Produção web: Nginx + build estático + API containerizada

## Como rodar localmente

1. Instale as dependências do projeto raiz e da API:
   `npm install`
   `npm install --prefix server`
2. Suba a stack completa:
   `npm run docker:up`
3. Acesse:
   - Frontend: `http://localhost:3000`
   - API: `http://localhost:4000`
   - Adminer: `http://localhost:8080`

## Credenciais iniciais

- Admin: `contato@veraluz.net.br`
- Senha: `Vera3636#`

O seed inicial cria apenas esse administrador. Usuários adicionais podem ser criados pela tela de usuários do CRM.

## Estrutura principal

- Frontend: [src](/c:/dev/veraluz-crm/src)
- API: [server/src](/c:/dev/veraluz-crm/server/src)
- Banco: [server/database/schema.sql](/c:/dev/veraluz-crm/server/database/schema.sql)
- Seed: [server/database/seed.sql](/c:/dev/veraluz-crm/server/database/seed.sql)
- Compose local: [docker-compose.yml](/c:/dev/veraluz-crm/docker-compose.yml)
- Compose VPS: [docker-compose.vps.yml](/c:/dev/veraluz-crm/docker-compose.vps.yml)

## Fluxos implementados

- Autenticação com JWT e sessão persistente opcional
- CRUD de leads
- Deduplicação por telefone, e-mail e CPF
- Pipeline comercial com movimentação por etapa
- Interações, tarefas e documentos por lead
- Integrações com fila de formulários recebidos
- Relatórios com exportação CSV
- Configurações operacionais do CRM
- Atualização em tempo real via SSE
- PWA com cache offline do app shell

## Observações importantes

- A API aplica compatibilidade automática de schema ao iniciar, incluindo os campos `has_active_cnpj` e `has_active_mei` em bases existentes.
- O projeto mantém um conjunto de arquivos herdados do template base, mas o fluxo ativo do CRM está concentrado em `src/` e `server/src/`.
- Não há suíte de testes automatizados configurada neste repositório neste momento.

## Scripts úteis

- Frontend dev: `npm start`
- API dev: `npm run api:dev`
- Build frontend: `npm run build`
- Subir Docker: `npm run docker:up`
- Derrubar Docker: `npm run docker:down`
- Resetar volumes do Docker: `npm run docker:reset`
