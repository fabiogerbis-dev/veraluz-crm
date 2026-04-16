const app = require("./app");
const env = require("./config/env");
const { ensureSchemaCompatibility, testConnection } = require("./db/pool");
const { startLeadQualificationInactivityMonitor } = require("./services/inboxService");
const { reconcileTaskSchedulingState } = require("./services/leadService");

async function start() {
  try {
    await testConnection();
    await ensureSchemaCompatibility();
    const reconciliation = await reconcileTaskSchedulingState();
    if (reconciliation.systemTasksCreated || reconciliation.leadNextContactsRefreshed) {
      console.log(
        `[TASKS] reconciliaÃ§Ã£o concluÃ­da: ${reconciliation.systemTasksCreated} tarefas canÃ´nicas criadas, ${reconciliation.leadNextContactsRefreshed} leads recalculados.`
      );
    }
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
