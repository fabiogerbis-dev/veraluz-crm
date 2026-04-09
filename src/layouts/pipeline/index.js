import { Link } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import EmptyState from "components/veraluz/EmptyState";
import PageShell from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import StatusChip from "components/veraluz/StatusChip";
import { useCRM } from "context/CRMContext";
import { PIPELINE_STAGES } from "data/veraluzSeed";
import { formatDateTime, formatPhone, getInitials } from "utils/formatters";

function Pipeline() {
  const { leads, moveLeadStage, settings } = useCRM();
  const pipelineStages = settings.pipelineStages?.length
    ? settings.pipelineStages
    : PIPELINE_STAGES;

  const handleMoveLead = async (leadId, stage) => {
    await moveLeadStage(leadId, stage);
  };

  return (
    <PageShell
      title="Pipeline comercial"
      description="Visão em colunas para movimentar o funil da corretora com mais clareza."
      primaryAction={
        <MDButton component={Link} to="/leads/new" variant="gradient" color="warning">
          Novo lead
        </MDButton>
      }
    >
      <Grid container spacing={3} sx={{ alignItems: "stretch" }}>
        {pipelineStages.map((stage, stageIndex) => {
          const stageLeads = leads.filter((lead) => lead.stage === stage);

          return (
            <Grid item xs={12} md={6} xl={4} key={stage}>
              <SectionCard
                title={stage}
                description={`${stageLeads.length} leads nesta etapa`}
                noPadding
              >
                <MDBox px={2} pb={2} display="grid" gap={2}>
                  {stageLeads.length ? (
                    stageLeads.map((lead) => (
                      <MDBox key={lead.id} p={2} bgColor="light" borderRadius="xl">
                        <MDBox
                          display="flex"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          gap={2}
                        >
                          <MDBox>
                            <MDTypography
                              component={Link}
                              to={`/leads/${lead.id}`}
                              variant="button"
                              fontWeight="medium"
                              color="dark"
                              sx={{ textDecoration: "none" }}
                            >
                              {lead.fullName}
                            </MDTypography>
                            <MDTypography variant="caption" color="text" display="block">
                              {formatPhone(lead.phone)}
                            </MDTypography>
                          </MDBox>
                          <Avatar sx={{ width: 34, height: 34, bgcolor: "warning.main" }}>
                            {getInitials(lead.fullName)}
                          </Avatar>
                        </MDBox>
                        <MDBox mt={1.5} display="flex" gap={1} flexWrap="wrap">
                          <StatusChip value={lead.origin} type="origin" />
                          <StatusChip value={lead.temperature} type="temperature" />
                        </MDBox>
                        <MDBox mt={1.5}>
                          <MDTypography variant="caption" color="text" display="block">
                            {lead.planType} · {lead.beneficiaries} vidas
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            {lead.origin} · próximo retorno {formatDateTime(lead.nextContact)}
                          </MDTypography>
                        </MDBox>
                        <MDBox mt={2} display="flex" gap={1}>
                          <MDButton
                            variant="outlined"
                            color="dark"
                            disabled={stageIndex === 0}
                            onClick={() => handleMoveLead(lead.id, pipelineStages[stageIndex - 1])}
                          >
                            Voltar
                          </MDButton>
                          <MDButton
                            variant="gradient"
                            color="warning"
                            disabled={stageIndex === pipelineStages.length - 1}
                            onClick={() => handleMoveLead(lead.id, pipelineStages[stageIndex + 1])}
                          >
                            Avançar
                          </MDButton>
                        </MDBox>
                      </MDBox>
                    ))
                  ) : (
                    <EmptyState
                      icon="view_kanban"
                      title="Nenhum lead nesta etapa"
                      description="Os leads movimentados para esta coluna aparecerão aqui."
                    />
                  )}
                </MDBox>
              </SectionCard>
            </Grid>
          );
        })}
      </Grid>
    </PageShell>
  );
}

export default Pipeline;
