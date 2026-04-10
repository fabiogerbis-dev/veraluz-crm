import { useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import Grid from "@mui/material/Grid";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import useMediaQuery from "@mui/material/useMediaQuery";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
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
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const [mobileTab, setMobileTab] = useState(0);
  const pipelineStages = settings.pipelineStages?.length
    ? settings.pipelineStages
    : PIPELINE_STAGES;

  const handleMoveLead = async (leadId, stage) => {
    await moveLeadStage(leadId, stage);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const destStage = result.destination.droppableId;
    const leadId = result.draggableId;
    if (result.source.droppableId !== destStage) {
      handleMoveLead(leadId, destStage);
    }
  };

  const renderLeadCard = (lead, stageIndex, providedDrag) => (
    <MDBox
      ref={providedDrag?.innerRef}
      {...(providedDrag?.draggableProps || {})}
      {...(providedDrag?.dragHandleProps || {})}
      p={2}
      bgColor="light"
      borderRadius="xl"
      sx={{ cursor: providedDrag ? "grab" : undefined }}
    >
      <MDBox display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
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
        <Avatar sx={{ width: 34, height: 34, bgcolor: "#16666D" }}>
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
          próximo retorno {formatDateTime(lead.nextContact)}
        </MDTypography>
      </MDBox>
      <MDBox mt={2} display="flex" gap={1}>
        <MDButton
          variant="outlined"
          color="dark"
          size="small"
          disabled={stageIndex === 0}
          onClick={() => handleMoveLead(lead.id, pipelineStages[stageIndex - 1])}
        >
          Voltar
        </MDButton>
        <MDButton
          variant="gradient"
          color="brand"
          size="small"
          disabled={stageIndex === pipelineStages.length - 1}
          onClick={() => handleMoveLead(lead.id, pipelineStages[stageIndex + 1])}
        >
          Avançar
        </MDButton>
      </MDBox>
    </MDBox>
  );

  const renderStageColumn = (stage, stageIndex) => {
    const stageLeads = leads.filter((lead) => lead.stage === stage);

    return (
      <Droppable droppableId={stage} key={stage}>
        {(provided) => (
          <Grid item xs={12} md={6} xl={4}>
            <SectionCard
              title={stage}
              description={`${stageLeads.length} leads nesta etapa`}
              noPadding
            >
              <MDBox
                ref={provided.innerRef}
                {...provided.droppableProps}
                px={2}
                pb={2}
                display="grid"
                gap={2}
                sx={{ minHeight: 80 }}
              >
                {stageLeads.length ? (
                  stageLeads.map((lead, index) => (
                    <Draggable draggableId={String(lead.id)} index={index} key={lead.id}>
                      {(dragProvided) => renderLeadCard(lead, stageIndex, dragProvided)}
                    </Draggable>
                  ))
                ) : (
                  <EmptyState
                    icon="view_kanban"
                    title="Nenhum lead nesta etapa"
                    description="Arraste leads para esta coluna ou clique Avançar."
                  />
                )}
                {provided.placeholder}
              </MDBox>
            </SectionCard>
          </Grid>
        )}
      </Droppable>
    );
  };

  const renderMobileTabs = () => {
    const stage = pipelineStages[mobileTab];
    const stageLeads = leads.filter((lead) => lead.stage === stage);

    return (
      <>
        <MDBox mx={-1.5} mb={3}>
          <Tabs
            value={mobileTab}
            onChange={(_, v) => setMobileTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minWidth: 0, px: 2 },
            }}
          >
            {pipelineStages.map((s) => {
              const count = leads.filter((l) => l.stage === s).length;
              return <Tab key={s} label={`${s} (${count})`} />;
            })}
          </Tabs>
        </MDBox>
        <MDBox display="grid" gap={2}>
          {stageLeads.length ? (
            stageLeads.map((lead) => renderLeadCard(lead, mobileTab, null))
          ) : (
            <EmptyState
              icon="view_kanban"
              title="Nenhum lead nesta etapa"
              description="Os leads movimentados para esta coluna aparecerão aqui."
            />
          )}
        </MDBox>
      </>
    );
  };

  return (
    <PageShell
      title="Pipeline comercial"
      description="Visão em colunas para movimentar o funil da corretora com mais clareza."
      primaryAction={
        <MDButton component={Link} to="/leads/new" variant="gradient" color="brand">
          Novo lead
        </MDButton>
      }
    >
      {isMobile ? (
        renderMobileTabs()
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Grid container spacing={3} sx={{ alignItems: "stretch" }}>
            {pipelineStages.map((stage, stageIndex) => renderStageColumn(stage, stageIndex))}
          </Grid>
        </DragDropContext>
      )}
    </PageShell>
  );
}

export default Pipeline;
