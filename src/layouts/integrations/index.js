import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import EmptyState from "components/veraluz/EmptyState";
import PageShell from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import StatusChip from "components/veraluz/StatusChip";
import { useCRM } from "context/CRMContext";
import { formatDateTime } from "utils/formatters";

function Integrations() {
  const { integrations } = useCRM();

  return (
    <PageShell
      title="Captação e integrações"
      description="Monitoramento dos canais de entrada, webhooks e fila de importação."
    >
      <Grid container spacing={3}>
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
      </Grid>
    </PageShell>
  );
}

export default Integrations;
