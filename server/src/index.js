const app = require("./app");
const env = require("./config/env");
const { ensureSchemaCompatibility, testConnection } = require("./db/pool");
const { startLeadQualificationInactivityMonitor } = require("./services/inboxService");

async function start() {
  try {
    await testConnection();
    await ensureSchemaCompatibility();
    startLeadQualificationInactivityMonitor();
    app.listen(env.port, () => {
      console.log(`Veraluz CRM API rodando em http://localhost:${env.port}`);
    });
  } catch (error) {
    console.error("Falha ao iniciar a API do Veraluz CRM.");
    console.error(error);
    process.exit(1);
  }
}

start();
