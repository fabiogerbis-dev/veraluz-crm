import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import EmptyState from "components/veraluz/EmptyState";
import PageShell from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import StatusChip from "components/veraluz/StatusChip";
import { useCRM } from "context/CRMContext";
import { formatDateTime, formatPhone } from "utils/formatters";

function getSubmissionStatusColor(submission) {
  return submission.imported ? "success" : "warning";
}

function getSubmissionSummary(submission) {
  return [
    submission.planType || "Plano não informado",
    submission.beneficiaries ? `${submission.beneficiaries} vida(s)` : "",
    [submission.city, submission.state].filter(Boolean).join(" / "),
  ]
    .filter(Boolean)
    .join(" | ");
}

function Integrations() {
  const { integrations, formSubmissions, importSubmission } = useCRM();
  const [feedback, setFeedback] = useState({ type: "info", message: "" });
  const [importingSubmissionId, setImportingSubmissionId] = useState("");

  const pendingSubmissions = useMemo(
    () => formSubmissions.filter((submission) => !submission.imported).length,
    [formSubmissions]
  );

  const importedSubmissions = formSubmissions.length - pendingSubmissions;

  const handleImportSubmission = async (submission) => {
    setImportingSubmissionId(submission.id);
    const result = await importSubmission(submission.id);
    setImportingSubmissionId("");

    if (!result.ok) {
      const duplicateMessage = result.duplicateLead?.fullName
        ? ` Lead duplicado detectado: ${result.duplicateLead.fullName}.`
        : "";

      setFeedback({
        type: "warning",
        message: `${
          result.message || "Não foi possível importar o formulário."
        }${duplicateMessage}`,
      });
      return;
    }

    setFeedback({
      type: "success",
      message: `Lead ${result.lead.fullName} importado com sucesso.`,
    });
  };

  return (
    <PageShell
      title="Captação e integrações"
      description="Monitoramento dos canais de entrada, webhooks e fila de importação."
    >
      <Grid container spacing={3}>
        {feedback.message ? (
          <Grid item xs={12}>
            <Alert
              severity={feedback.type}
              onClose={() => setFeedback({ type: "info", message: "" })}
            >
              {feedback.message}
            </Alert>
          </Grid>
        ) : null}

        <Grid item xs={12}>
          <SectionCard
            title="Canais conectados"
            description="Status operacional das integrações de site, redes sociais e mensageria."
          >
            {integrations.length ? (
              <Grid container spacing={3}>
                {integrations.map((integration) => (
                  <Grid item xs={12} md={6} xl={3} key={integration.id}>
                    <MDBox p={2.5} bgColor="light" borderRadius="xl" height="100%">
                      <MDBox display="flex" gap={1} flexWrap="wrap" mb={1.5}>
                        <StatusChip value={integration.channel} type="origin" />
                      </MDBox>
                      <MDTypography variant="h6" lineHeight={1.3}>
                        {integration.name}
                      </MDTypography>
                      <MDTypography variant="caption" color="text" display="block" mt={1}>
                        Status: {integration.status}
                      </MDTypography>
                      <MDTypography variant="caption" color="text" display="block">
                        Última sincronização: {formatDateTime(integration.lastSync)}
                      </MDTypography>
                      <MDTypography variant="caption" color="text" display="block" mt={1.5}>
                        {integration.originMapping}
                      </MDTypography>
                      <MDTypography variant="caption" color="text" display="block">
                        {integration.rule}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <EmptyState
                icon="hub"
                title="Nenhuma integração configurada"
                description="Quando os canais forem conectados, o status operacional aparecerá aqui."
              />
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12}>
          <SectionCard
            title="Fila de formulários do site"
            description="Leads recebidos pelo site aguardando importação manual ou já convertidos em cadastro."
            action={
              <Chip
                label={`${pendingSubmissions} pendente(s) | ${importedSubmissions} importado(s)`}
                size="small"
                variant="outlined"
              />
            }
          >
            {formSubmissions.length ? (
              <Grid container spacing={3}>
                {formSubmissions.map((submission) => (
                  <Grid item xs={12} md={6} xl={4} key={submission.id}>
                    <MDBox p={2.5} bgColor="light" borderRadius="xl" height="100%">
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={1.5}>
                        <StatusChip value={submission.origin || "Site"} type="origin" />
                        <Chip
                          label={submission.status || (submission.imported ? "Importado" : "Novo")}
                          color={getSubmissionStatusColor(submission)}
                          size="small"
                          variant={submission.imported ? "filled" : "outlined"}
                        />
                      </Stack>

                      <MDTypography variant="h6" lineHeight={1.3}>
                        {submission.fullName || "Lead sem nome"}
                      </MDTypography>

                      <MDTypography variant="caption" color="text" display="block" mt={1}>
                        {getSubmissionSummary(submission) || "Sem detalhes complementares."}
                      </MDTypography>

                      <MDBox mt={1.5} display="grid" gap={0.5}>
                        <MDTypography variant="caption" color="text" display="block">
                          Telefone: {formatPhone(submission.phone) || "--"}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block">
                          E-mail: {submission.email || "--"}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block">
                          Campanha: {submission.campaign || "--"}
                        </MDTypography>
                        <MDTypography variant="caption" color="text" display="block">
                          Recebido em: {formatDateTime(submission.receivedAt)}
                        </MDTypography>
                      </MDBox>

                      <MDBox mt={2} display="flex" gap={1} flexWrap="wrap">
                        {submission.imported && submission.importedLeadId ? (
                          <MDButton
                            component={Link}
                            to={`/leads/${submission.importedLeadId}`}
                            variant="outlined"
                            color="dark"
                            size="small"
                          >
                            Abrir lead
                          </MDButton>
                        ) : (
                          <MDButton
                            variant="gradient"
                            color="brand"
                            size="small"
                            onClick={() => handleImportSubmission(submission)}
                            disabled={importingSubmissionId === submission.id}
                          >
                            {importingSubmissionId === submission.id
                              ? "Importando..."
                              : "Importar lead"}
                          </MDButton>
                        )}
                      </MDBox>
                    </MDBox>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <EmptyState
                icon="inventory_2"
                title="Nenhum formulário recebido"
                description="Quando o site enviar novos contatos, a fila de importação aparecerá aqui."
              />
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageShell>
  );
}

export default Integrations;
