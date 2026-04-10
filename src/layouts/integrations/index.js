import { useState } from "react";
import Alert from "@mui/material/Alert";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import useMediaQuery from "@mui/material/useMediaQuery";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import EmptyState from "components/veraluz/EmptyState";
import PageShell from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import StatusChip from "components/veraluz/StatusChip";
import { useCRM } from "context/CRMContext";
import { formatDateTime } from "utils/formatters";

function Integrations() {
  const { integrations, formSubmissions, importSubmission } = useCRM();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));

  const handleImport = async (submissionId) => {
    const result = await importSubmission(submissionId);

    if (!result.ok) {
      setMessageType("warning");
      setMessage(
        result.message ||
          (result.duplicateLead
            ? `Não importado: lead duplicado com ${result.duplicateLead.fullName}.`
            : "Não foi possível importar o formulário.")
      );
      return;
    }

    setMessageType("success");
    setMessage(`Formulário importado com sucesso para o lead ${result.lead.fullName}.`);
  };

  return (
    <PageShell
      title="Captação e integrações"
      description="Monitoramento dos canais de entrada, webhooks e fila de importação."
    >
      <Grid container spacing={3}>
        {message ? (
          <Grid item xs={12}>
            <Alert severity={messageType}>{message}</Alert>
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
            title="Formulários e leads recebidos"
            description="Fila de captação do site, Instagram, Facebook e WhatsApp."
          >
            {formSubmissions.length ? (
              <List sx={{ p: 0 }}>
                {formSubmissions.map((submission) => {
                  const actionButton = submission.imported ? (
                    <MDButton variant="outlined" color="success" size="small" disabled>
                      Importado
                    </MDButton>
                  ) : (
                    <MDButton
                      variant="gradient"
                      color="brand"
                      size="small"
                      onClick={() => handleImport(submission.id)}
                    >
                      Importar
                    </MDButton>
                  );

                  return (
                    <ListItem
                      key={submission.id}
                      disableGutters
                      divider
                      secondaryAction={isMobile ? null : actionButton}
                      sx={
                        isMobile
                          ? {
                              flexDirection: "column",
                              alignItems: "stretch",
                              gap: 1.5,
                              py: 1.75,
                            }
                          : undefined
                      }
                    >
                      <MDBox width="100%" minWidth={0}>
                        <ListItemText
                          primary={`${submission.fullName} · ${submission.origin} · ${submission.planType}`}
                          secondary={`${submission.campaign} · ${
                            submission.beneficiaries
                          } vidas · ${formatDateTime(submission.receivedAt)}`}
                          primaryTypographyProps={{
                            sx: {
                              whiteSpace: "normal",
                              overflowWrap: "anywhere",
                            },
                          }}
                          secondaryTypographyProps={{
                            sx: {
                              mt: 0.75,
                              whiteSpace: "normal",
                              overflowWrap: "anywhere",
                            },
                          }}
                        />
                      </MDBox>
                      {isMobile ? (
                        <MDBox display="flex" justifyContent="flex-start">
                          {actionButton}
                        </MDBox>
                      ) : null}
                    </ListItem>
                  );
                })}
              </List>
            ) : (
              <EmptyState
                icon="inbox"
                title="Sem entradas novas"
                description="Os formulários recebidos e as importações pendentes vão aparecer aqui."
              />
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageShell>
  );
}

export default Integrations;
