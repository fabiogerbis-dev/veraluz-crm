import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import Snackbar from "@mui/material/Snackbar";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
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
import { LOSS_REASON_OPTIONS, PIPELINE_STAGES } from "data/veraluzSeed";
import { LOST_STAGE } from "utils/commercialRules";
import { formatDateTime, formatPhone, getInitials } from "utils/formatters";

function Pipeline() {
  const { leads, moveLeadStage, settings } = useCRM();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const [mobileTab, setMobileTab] = useState(0);
  const [movingLeadId, setMovingLeadId] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [pendingLostMove, setPendingLostMove] = useState(null);
  const [lossReason, setLossReason] = useState("");
  const pipelineStages = settings.pipelineStages?.length
    ? settings.pipelineStages
    : PIPELINE_STAGES;
  const lossReasonOptions = settings.lossReasons?.length
    ? settings.lossReasons
    : LOSS_REASON_OPTIONS;
  const pendingLead = useMemo(
    () => leads.find((lead) => String(lead.id) === String(pendingLostMove?.leadId)),
    [leads, pendingLostMove?.leadId]
  );

  const executeMoveLead = async (leadId, stage, options = {}) => {
    setMovingLeadId(leadId);
    const result = await moveLeadStage(leadId, stage, options);
    setMovingLeadId(null);
    if (!result.ok) {
      setFeedback(result.message || "Não foi possível mover o lead.");
    }
  };

  const handleMoveLead = async (leadId, stage) => {
    if (stage === LOST_STAGE) {
      setLossReason("");
      setPendingLostMove({ leadId, stage });
      return;
    }

    await executeMoveLead(leadId, stage);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const destStage = result.destination.droppableId;
    const leadId = Number(result.draggableId);
    if (result.source.droppableId !== destStage) {
      handleMoveLead(leadId, destStage);
    }
  };

  const handleConfirmLostMove = async () => {
    if (!pendingLostMove?.leadId || !lossReason) {
      setFeedback("Selecione o motivo da perda para concluir a movimentação.");
      return;
    }

    const { leadId, stage } = pendingLostMove;
    setPendingLostMove(null);
    await executeMoveLead(leadId, stage, { lossReason });
    setLossReason("");
  };

  const handleCancelLostMove = () => {
    setPendingLostMove(null);
    setLossReason("");
  };

  const renderLeadCard = (lead, stageIndex, providedDrag) => (
    <MDBox
      ref={providedDrag?.innerRef}
      {...(providedDrag?.draggableProps || {})}
      {...(providedDrag?.dragHandleProps || {})}
      p={2}
      bgColor="light"
      borderRadius="xl"
      sx={{
        cursor: providedDrag ? "grab" : undefined,
        width: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <MDBox display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <MDBox flex="1 1 auto" minWidth={0}>
          <MDTypography
            component={Link}
            to={`/leads/${lead.id}`}
            variant="button"
            fontWeight="medium"
            color="dark"
            sx={{
              display: "block",
              textDecoration: "none",
              whiteSpace: "normal",
              overflowWrap: "anywhere",
            }}
          >
            {lead.fullName}
          </MDTypography>
          <MDTypography
            variant="caption"
            color="text"
            display="block"
            sx={{ mt: 0.5, whiteSpace: "normal", overflowWrap: "anywhere" }}
          >
            {formatPhone(lead.phone)}
          </MDTypography>
        </MDBox>
        <Avatar
          sx={{
            width: isMobile ? 30 : 34,
            height: isMobile ? 30 : 34,
            bgcolor: "#16666D",
            flexShrink: 0,
          }}
        >
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
      <MDBox
        mt={2}
        display="grid"
        gap={1}
        sx={{
          gridTemplateColumns: isMobile ? "1fr" : "repeat(2, max-content)",
        }}
      >
        <MDButton
          variant="outlined"
          color="dark"
          size="small"
          disabled={stageIndex === 0 || movingLeadId === lead.id}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleMoveLead(lead.id, pipelineStages[stageIndex - 1]);
          }}
          sx={{ minWidth: 0, px: isMobile ? 1.25 : 2 }}
        >
          Voltar
        </MDButton>
        <MDButton
          variant="gradient"
          color="brand"
          size="small"
          disabled={stageIndex === pipelineStages.length - 1 || movingLeadId === lead.id}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleMoveLead(lead.id, pipelineStages[stageIndex + 1]);
          }}
          sx={{ minWidth: 0, px: isMobile ? 1.25 : 2 }}
        >
          {movingLeadId === lead.id ? "..." : "Avançar"}
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
        <MDBox mb={3} sx={{ width: "100%", overflowX: "hidden" }}>
          <Tabs
            value={mobileTab}
            onChange={(_, v) => setMobileTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 0,
              "& .MuiTabs-scroller": {
                overflowX: "auto !important",
              },
              "& .MuiTabs-flexContainer": {
                flexWrap: "nowrap",
              },
              "& .MuiTab-root": {
                flex: "0 0 auto",
                textTransform: "none",
                fontWeight: 600,
                minWidth: "auto",
                px: 2,
                whiteSpace: "nowrap",
                minHeight: 40,
              },
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
            stageLeads.map((lead) => (
              <MDBox key={lead.id} width="100%">
                {renderLeadCard(lead, mobileTab, null)}
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
      </>
    );
  };

  return (
    <PageShell
      title="Pipeline comercial"
      description="Visão em colunas para movimentar o funil da corretora com mais clareza."
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
      <Snackbar
        open={Boolean(feedback)}
        autoHideDuration={4000}
        onClose={() => setFeedback("")}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="warning" onClose={() => setFeedback("")}>
          {feedback}
        </Alert>
      </Snackbar>
      <Dialog
        open={Boolean(pendingLostMove)}
        onClose={handleCancelLostMove}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600, fontSize: "1rem" }}>
          Registrar motivo da perda
        </DialogTitle>
        <DialogContent sx={{ pt: "0.5rem !important" }}>
          <MDTypography variant="body2" color="text" mb={2}>
            {pendingLead
              ? `Selecione o motivo da perda para concluir a movimentação de ${pendingLead.fullName}.`
              : "Selecione o motivo da perda para concluir a movimentação."}
          </MDTypography>
          <Autocomplete
            options={lossReasonOptions}
            value={lossReason}
            onChange={(_, value) => setLossReason(value || "")}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Motivo da perda"
                size="small"
                required
                helperText="Campo obrigatório para enviar o lead à etapa Perdido."
              />
            )}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <MDButton variant="text" color="dark" onClick={handleCancelLostMove}>
            Cancelar
          </MDButton>
          <MDButton variant="gradient" color="error" onClick={handleConfirmLostMove}>
            Confirmar perda
          </MDButton>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}

export default Pipeline;
