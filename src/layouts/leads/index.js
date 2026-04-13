import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import ConfirmDialog from "components/veraluz/ConfirmDialog";
import EmptyState from "components/veraluz/EmptyState";
import PageShell, { PageShellAction } from "components/veraluz/PageShell";
import StatusChip from "components/veraluz/StatusChip";
import DataTable from "examples/Tables/DataTable";
import { useCRM } from "context/CRMContext";
import {
  ORIGIN_OPTIONS,
  PIPELINE_STAGES,
  PLAN_TYPE_OPTIONS,
  STATUS_OPTIONS,
  TEMPERATURE_OPTIONS,
} from "data/veraluzSeed";
import { formatDateTime, formatPhone, getInitials } from "utils/formatters";

const periodOptions = [
  { label: "Todos", value: "all" },
  { label: "Hoje", value: "today" },
  { label: "Ultimos 7 dias", value: "7d" },
  { label: "Ultimos 30 dias", value: "30d" },
];

/* stage header color accents */
const STAGE_ACCENT = {
  "Novo lead": "#42a5f5",
  "Em contato": "#ffa726",
  Qualificado: "#66bb6a",
  Cotação: "#29b6f6",
  "Proposta enviada": "#7e57c2",
  Negociação: "#ff7043",
  Fechado: "#26a69a",
  Perdido: "#ef5350",
  "Pós-venda": "#78909c",
};

const desktopTableSx = {
  "& .MuiTable-root": { minWidth: "76rem" },
  "& thead th, & tbody td": {
    paddingLeft: "0.875rem !important",
    paddingRight: "0.875rem !important",
  },
  "& thead th": { whiteSpace: "nowrap" },
  "& tbody td": { verticalAlign: "middle" },
  "& thead th:first-of-type, & tbody td:first-of-type": { minWidth: "16rem" },
  "& thead th:nth-of-type(5), & tbody td:nth-of-type(5)": { minWidth: "10rem" },
  "& thead th:nth-of-type(6), & tbody td:nth-of-type(6)": { minWidth: "9rem" },
  "& thead th:nth-of-type(7), & tbody td:nth-of-type(7)": { minWidth: "7rem" },
  "& thead th:nth-of-type(8), & tbody td:nth-of-type(8)": { minWidth: "7.5rem" },
  "& thead th:nth-of-type(9), & tbody td:nth-of-type(9)": { minWidth: "8rem" },
  "& thead th:last-of-type, & tbody td:last-of-type": { minWidth: "7rem" },
};

function Leads() {
  const { leads, users, settings, deleteLead, moveLeadStage } = useCRM();
  const isMobile = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const isTablet = useMediaQuery((theme) => theme.breakpoints.between("md", "xl"));
  const [searchParams, setSearchParams] = useSearchParams();
  const [feedback, setFeedback] = useState({ type: "success", message: "" });
  const [deletingLeadId, setDeletingLeadId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewMode, setViewMode] = useState("kanban");
  const [mobileTab, setMobileTab] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    origin: "",
    status: "",
    ownerId: "",
    planType: "",
    temperature: "",
    period: "all",
  });

  const pipelineStages = settings.pipelineStages?.length
    ? settings.pipelineStages
    : PIPELINE_STAGES;
  const originOptions = settings.origins?.length ? settings.origins : ORIGIN_OPTIONS;
  const planTypeOptions = settings.planTypes?.length ? settings.planTypes : PLAN_TYPE_OPTIONS;
  const searchTerm = searchParams.get("search") || "";
  const brokerOptions = users
    .filter((user) => user.role === "broker")
    .map((user) => ({ label: user.name, value: user.id }));

  const handleSearchChange = (event) => {
    const value = event.target.value;
    const nextSearchParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextSearchParams.set("search", value);
    } else {
      nextSearchParams.delete("search");
    }
    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleDeleteLead = async (lead) => {
    setConfirmDelete(lead);
  };

  const executeDeleteLead = async () => {
    const lead = confirmDelete;
    if (!lead) return;
    setConfirmDelete(null);
    setDeletingLeadId(lead.id);
    setFeedback({ type: "success", message: "" });

    const result = await deleteLead(lead.id);
    setDeletingLeadId("");

    if (!result.ok) {
      setFeedback({
        type: "error",
        message: result.message || "Não foi possível excluir o lead.",
      });
      return;
    }

    setFeedback({
      type: "success",
      message: `Lead ${lead.fullName} excluído com sucesso.`,
    });
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const destStage = result.destination.droppableId;
    const leadId = Number(result.draggableId);
    if (result.source.droppableId !== destStage) {
      moveLeadStage(leadId, destStage).then((res) => {
        if (!res.ok) {
          setFeedback({
            type: "error",
            message: res.message || "Não foi possível mover o lead.",
          });
        }
      });
    }
  };

  const filteredLeads = useMemo(() => {
    const now = new Date();
    return leads.filter((lead) => {
      const leadDate = new Date(lead.createdAt);
      const textMatches = !searchTerm
        ? true
        : [lead.fullName, lead.phone, lead.email, lead.origin, lead.planType]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(searchTerm.toLowerCase());

      const periodMatches =
        filters.period === "all" ||
        (filters.period === "today" &&
          leadDate.getDate() === now.getDate() &&
          leadDate.getMonth() === now.getMonth() &&
          leadDate.getFullYear() === now.getFullYear()) ||
        (filters.period === "7d" && now - leadDate <= 7 * 86400000) ||
        (filters.period === "30d" && now - leadDate <= 30 * 86400000);

      return (
        textMatches &&
        (!filters.origin || lead.origin === filters.origin) &&
        (!filters.status || lead.status === filters.status) &&
        (!filters.ownerId || lead.ownerId === filters.ownerId) &&
        (!filters.planType || lead.planType === filters.planType) &&
        (!filters.temperature || lead.temperature === filters.temperature) &&
        periodMatches
      );
    });
  }, [filters, leads, searchTerm]);

  const summary = {
    total: filteredLeads.length,
    hot: filteredLeads.filter((lead) => lead.temperature === "Quente").length,
    overdue: filteredLeads.filter(
      (lead) => lead.nextContact && new Date(lead.nextContact) < new Date()
    ).length,
  };

  const activeFilterCount = [
    filters.origin,
    filters.status,
    filters.ownerId,
    filters.planType,
    filters.temperature,
    filters.period !== "all" ? filters.period : "",
  ].filter(Boolean).length;

  /* kanban card */
  const renderKanbanCard = (lead, provided) => {
    const owner = users.find((user) => user.id === lead.ownerId);
    const isOverdue = lead.nextContact && new Date(lead.nextContact) < new Date();
    const isDeleting = deletingLeadId === lead.id;

    return (
      <MDBox
        ref={provided?.innerRef}
        {...(provided?.draggableProps || {})}
        {...(provided?.dragHandleProps || {})}
        mb={1.5}
        sx={{
          background: "#fff",
          borderRadius: "12px",
          border: "1px solid rgba(22, 102, 109, 0.08)",
          transition: "box-shadow 0.2s, border-color 0.2s",
          cursor: provided ? "grab" : "default",
          "&:hover": {
            boxShadow: "0 4px 20px rgba(22, 102, 109, 0.12)",
            borderColor: "rgba(22, 102, 109, 0.2)",
          },
          "&:active": { cursor: "grabbing" },
        }}
      >
        <MDBox p={2}>
          {/* header: avatar + name + temperature */}
          <MDBox display="flex" alignItems="center" gap={1.5}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: "#16666D",
                fontSize: "0.8rem",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {getInitials(lead.fullName)}
            </Avatar>
            <MDBox flex="1 1 0" minWidth={0}>
              <MDTypography
                component={Link}
                to={`/leads/${lead.id}`}
                variant="button"
                fontWeight="medium"
                color="dark"
                sx={{
                  display: "block",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  "&:hover": { color: "#16666D" },
                }}
              >
                {lead.fullName}
              </MDTypography>
              <MDTypography variant="caption" color="text" display="block" sx={{ lineHeight: 1.4 }}>
                {formatPhone(lead.phone)}
              </MDTypography>
            </MDBox>
            <StatusChip value={lead.temperature} type="temperature" />
          </MDBox>

          {/* badges row */}
          <MDBox mt={1.5} display="flex" gap={0.75} flexWrap="wrap">
            <StatusChip value={lead.origin} type="origin" />
            {lead.planType ? (
              <Chip
                label={lead.planType}
                size="small"
                sx={{
                  height: 22,
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  bgcolor: "rgba(22, 102, 109, 0.08)",
                  color: "#16666D",
                }}
              />
            ) : null}
            {lead.beneficiaries ? (
              <Chip
                label={`${lead.beneficiaries} vidas`}
                size="small"
                sx={{
                  height: 22,
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  bgcolor: "rgba(22, 102, 109, 0.06)",
                  color: "#546e7a",
                }}
              />
            ) : null}
          </MDBox>

          {/* info row */}
          <MDBox mt={1.5} display="flex" flexDirection="column" gap={0.5}>
            {owner ? (
              <MDBox display="flex" alignItems="center" gap={0.5}>
                <Icon sx={{ fontSize: "0.875rem !important", color: "#90a4ae" }}>person</Icon>
                <MDTypography variant="caption" color="text" sx={{ lineHeight: 1.3 }}>
                  {owner.name}
                </MDTypography>
              </MDBox>
            ) : null}
            {lead.nextContact ? (
              <MDBox display="flex" alignItems="center" gap={0.5}>
                <Icon
                  sx={{
                    fontSize: "0.875rem !important",
                    color: isOverdue ? "#ef5350" : "#90a4ae",
                  }}
                >
                  schedule
                </Icon>
                <MDTypography
                  variant="caption"
                  sx={{ lineHeight: 1.3, color: isOverdue ? "#ef5350" : undefined }}
                  color={isOverdue ? undefined : "text"}
                >
                  {formatDateTime(lead.nextContact)}
                </MDTypography>
              </MDBox>
            ) : null}
          </MDBox>

          {/* actions */}
          <MDBox
            mt={1.5}
            pt={1.5}
            display="flex"
            justifyContent="flex-end"
            gap={0.5}
            sx={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
          >
            <Tooltip title="Abrir lead" placement="top">
              <IconButton
                component={Link}
                to={`/leads/${lead.id}`}
                size="small"
                sx={{ color: "#42a5f5" }}
              >
                <Icon fontSize="small">visibility</Icon>
              </IconButton>
            </Tooltip>
            <Tooltip title="Editar" placement="top">
              <IconButton
                component={Link}
                to={`/leads/${lead.id}/edit`}
                size="small"
                sx={{ color: "#16666D" }}
              >
                <Icon fontSize="small">edit</Icon>
              </IconButton>
            </Tooltip>
            <Tooltip title={isDeleting ? "Excluindo..." : "Excluir"} placement="top">
              <span>
                <IconButton
                  size="small"
                  disabled={isDeleting}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLead(lead);
                  }}
                  sx={{ color: "#ef5350" }}
                >
                  <Icon fontSize="small">{isDeleting ? "hourglass_top" : "delete"}</Icon>
                </IconButton>
              </span>
            </Tooltip>
          </MDBox>
        </MDBox>
      </MDBox>
    );
  };

  /* kanban column */
  const renderKanbanColumn = (stage) => {
    const stageLeads = filteredLeads.filter((lead) => lead.stage === stage);
    const accent = STAGE_ACCENT[stage] || "#78909c";

    return (
      <Droppable droppableId={stage} key={stage}>
        {(provided, snapshot) => (
          <MDBox
            sx={{
              flex: "0 0 auto",
              width: isTablet ? 300 : 320,
              display: "flex",
              flexDirection: "column",
              maxHeight: "calc(100vh - 340px)",
              minHeight: 200,
            }}
          >
            {/* column header */}
            <MDBox
              px={2}
              py={1.5}
              sx={{
                borderTop: `3px solid ${accent}`,
                borderRadius: "12px 12px 0 0",
                background: "#fff",
              }}
            >
              <MDBox display="flex" alignItems="center" justifyContent="space-between">
                <MDTypography variant="button" fontWeight="bold" color="dark">
                  {stage}
                </MDTypography>
                <Chip
                  label={stageLeads.length}
                  size="small"
                  sx={{
                    height: 22,
                    minWidth: 28,
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    bgcolor: `${accent}18`,
                    color: accent,
                  }}
                />
              </MDBox>
            </MDBox>

            {/* column body */}
            <MDBox
              ref={provided.innerRef}
              {...provided.droppableProps}
              px={1}
              pb={1}
              sx={{
                flexGrow: 1,
                overflowY: "auto",
                background: snapshot.isDraggingOver
                  ? "rgba(22, 102, 109, 0.04)"
                  : "rgba(246, 248, 250, 0.6)",
                borderRadius: "0 0 12px 12px",
                transition: "background 0.2s",
                "&::-webkit-scrollbar": { width: 4 },
                "&::-webkit-scrollbar-thumb": {
                  bgcolor: "rgba(22, 102, 109, 0.15)",
                  borderRadius: 2,
                },
              }}
            >
              <MDBox pt={1}>
                {stageLeads.length ? (
                  stageLeads.map((lead, index) => (
                    <Draggable draggableId={String(lead.id)} index={index} key={lead.id}>
                      {(dragProvided) => renderKanbanCard(lead, dragProvided)}
                    </Draggable>
                  ))
                ) : (
                  <MDBox
                    py={4}
                    display="flex"
                    flexDirection="column"
                    alignItems="center"
                    sx={{ opacity: 0.45 }}
                  >
                    <Icon sx={{ fontSize: "2rem !important", mb: 0.5, color: "#90a4ae" }}>
                      view_kanban
                    </Icon>
                    <MDTypography variant="caption" color="text">
                      Sem leads
                    </MDTypography>
                  </MDBox>
                )}
                {provided.placeholder}
              </MDBox>
            </MDBox>
          </MDBox>
        )}
      </Droppable>
    );
  };

  /* mobile kanban with tabs */
  const renderMobileKanban = () => {
    const stage = pipelineStages[mobileTab];
    const stageLeads = filteredLeads.filter((lead) => lead.stage === stage);

    return (
      <>
        <MDBox mb={2} sx={{ width: "100%", overflowX: "hidden" }}>
          <Tabs
            value={mobileTab}
            onChange={(_, v) => setMobileTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 0,
              "& .MuiTabs-scroller": { overflowX: "auto !important" },
              "& .MuiTabs-flexContainer": { flexWrap: "nowrap", gap: 0.5 },
              "& .MuiTab-root": {
                flex: "0 0 auto",
                textTransform: "none",
                fontWeight: 600,
                minWidth: "auto",
                px: 2,
                py: 1,
                whiteSpace: "nowrap",
                minHeight: 36,
                borderRadius: "8px",
                fontSize: "0.8rem",
              },
              "& .Mui-selected": {
                bgcolor: "rgba(22, 102, 109, 0.08)",
              },
            }}
          >
            {pipelineStages.map((s) => {
              const count = filteredLeads.filter((l) => l.stage === s).length;
              return <Tab key={s} label={`${s} (${count})`} />;
            })}
          </Tabs>
        </MDBox>
        <MDBox display="flex" flexDirection="column" gap={1.5}>
          {stageLeads.length ? (
            stageLeads.map((lead) => <MDBox key={lead.id}>{renderKanbanCard(lead, null)}</MDBox>)
          ) : (
            <EmptyState
              icon="view_kanban"
              title="Nenhum lead nesta etapa"
              description="Leads nesta etapa aparecerão aqui."
            />
          )}
        </MDBox>
      </>
    );
  };

  /* desktop table */
  const tableData = useMemo(
    () => ({
      columns: [
        { Header: "Lead", accessor: "lead", width: "16rem" },
        { Header: "Origem", accessor: "origin", align: "center", width: "7.5rem" },
        { Header: "Plano", accessor: "planType", align: "center", width: "6.5rem" },
        { Header: "Vidas", accessor: "beneficiaries", align: "center", width: "4.5rem" },
        { Header: "Corretor", accessor: "owner", align: "center", width: "10rem" },
        { Header: "Status", accessor: "status", align: "center", width: "9rem" },
        { Header: "Temperatura", accessor: "temperature", align: "center", width: "7rem" },
        { Header: "Entrada", accessor: "createdAt", align: "center", width: "7.5rem" },
        { Header: "Próximo contato", accessor: "nextContact", align: "center", width: "8rem" },
        { Header: "Ações", accessor: "actions", align: "center", width: "7rem" },
      ],
      rows: filteredLeads.map((lead) => {
        const owner = users.find((user) => user.id === lead.ownerId);
        const isDeleting = deletingLeadId === lead.id;

        return {
          lead: (
            <MDBox lineHeight={1.4} sx={{ minWidth: "13rem", maxWidth: "15rem", pr: 1 }}>
              <MDTypography
                component={Link}
                to={`/leads/${lead.id}`}
                variant="button"
                fontWeight="medium"
                color="dark"
                sx={{ display: "block", textDecoration: "none" }}
              >
                {lead.fullName}
              </MDTypography>
              <MDTypography
                variant="caption"
                color="text"
                display="block"
                sx={{ mt: 0.5, wordBreak: "normal", overflowWrap: "anywhere" }}
              >
                {formatPhone(lead.phone)}
              </MDTypography>
            </MDBox>
          ),
          origin: <StatusChip value={lead.origin} type="origin" />,
          planType: lead.planType,
          beneficiaries: lead.beneficiaries,
          owner: (
            <MDBox sx={{ minWidth: "8.5rem", whiteSpace: "normal" }}>
              {owner?.name || "Sem corretor"}
            </MDBox>
          ),
          status: <StatusChip value={lead.status} type="status" />,
          temperature: <StatusChip value={lead.temperature} type="temperature" />,
          createdAt: <MDBox sx={{ whiteSpace: "nowrap" }}>{formatDateTime(lead.createdAt)}</MDBox>,
          nextContact: (
            <MDBox sx={{ whiteSpace: "nowrap" }}>{formatDateTime(lead.nextContact)}</MDBox>
          ),
          actions: (
            <MDBox display="flex" gap={1} justifyContent="center">
              <MDButton
                component={Link}
                to={`/leads/${lead.id}`}
                variant="text"
                color="info"
                iconOnly
                title="Visualizar lead"
              >
                <Icon>visibility</Icon>
              </MDButton>
              <MDButton
                component={Link}
                to={`/leads/${lead.id}/edit`}
                variant="text"
                color="brand"
                iconOnly
                title="Editar lead"
              >
                <Icon>edit</Icon>
              </MDButton>
              <MDButton
                variant="text"
                color="error"
                iconOnly
                title={isDeleting ? "Excluindo lead" : "Excluir lead"}
                disabled={isDeleting}
                onClick={() => handleDeleteLead(lead)}
              >
                <Icon>{isDeleting ? "hourglass_top" : "delete"}</Icon>
              </MDButton>
            </MDBox>
          ),
        };
      }),
    }),
    [deletingLeadId, filteredLeads, users]
  );

  /* filters panel */
  const filtersPanel = (
    <MDBox p={3} bgColor="white" borderRadius="xl" shadow="sm">
      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            size="small"
            label="Busca rápida"
            value={searchTerm}
            onChange={handleSearchChange}
            helperText={
              searchTerm
                ? "Busca aplicada a partir da navegação rápida."
                : "Pesquise por nome, telefone ou e-mail."
            }
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Autocomplete
            options={originOptions}
            value={filters.origin}
            onChange={(_, value) => setFilters((current) => ({ ...current, origin: value || "" }))}
            renderInput={(params) => <TextField {...params} label="Origem" size="small" />}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Autocomplete
            options={STATUS_OPTIONS}
            value={filters.status}
            onChange={(_, value) => setFilters((current) => ({ ...current, status: value || "" }))}
            renderInput={(params) => <TextField {...params} label="Status" size="small" />}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Autocomplete
            options={brokerOptions}
            value={brokerOptions.find((option) => option.value === filters.ownerId) || null}
            onChange={(_, value) =>
              setFilters((current) => ({ ...current, ownerId: value?.value || "" }))
            }
            renderInput={(params) => <TextField {...params} label="Corretor" size="small" />}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Autocomplete
            options={planTypeOptions}
            value={filters.planType}
            onChange={(_, value) =>
              setFilters((current) => ({ ...current, planType: value || "" }))
            }
            renderInput={(params) => <TextField {...params} label="Tipo de plano" size="small" />}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Autocomplete
            options={TEMPERATURE_OPTIONS}
            value={filters.temperature}
            onChange={(_, value) =>
              setFilters((current) => ({ ...current, temperature: value || "" }))
            }
            renderInput={(params) => <TextField {...params} label="Temperatura" size="small" />}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <Autocomplete
            options={periodOptions}
            value={periodOptions.find((option) => option.value === filters.period) || null}
            onChange={(_, value) =>
              setFilters((current) => ({ ...current, period: value?.value || "all" }))
            }
            isOptionEqualToValue={(option, value) => option.value === value.value}
            getOptionLabel={(option) => option.label || ""}
            renderInput={(params) => <TextField {...params} label="Período" size="small" />}
          />
        </Grid>
        <Grid
          item
          xs={12}
          md={8}
          display="flex"
          alignItems="center"
          justifyContent={{ xs: "flex-start", md: "flex-end" }}
        >
          <MDButton
            variant="outlined"
            color="dark"
            onClick={() =>
              setFilters({
                origin: "",
                status: "",
                ownerId: "",
                planType: "",
                temperature: "",
                period: "all",
              })
            }
          >
            Limpar filtros
          </MDButton>
        </Grid>
      </Grid>
    </MDBox>
  );

  return (
    <PageShell
      title="Leads"
      description="Gerencie seus leads em visão Kanban ou lista com filtros comerciais."
      primaryAction={
        <PageShellAction component={Link} to="/leads/new" startIcon={<Icon>add</Icon>}>
          Cadastrar lead
        </PageShellAction>
      }
    >
      <Grid container spacing={3}>
        {/* summary cards */}
        <Grid item xs={12} md={4}>
          <MDBox p={2.5} bgColor="light" borderRadius="xl">
            <MDTypography variant="button" color="text">
              Leads filtrados
            </MDTypography>
            <MDTypography variant="h4">{summary.total}</MDTypography>
          </MDBox>
        </Grid>
        <Grid item xs={12} md={4}>
          <MDBox p={2.5} bgColor="light" borderRadius="xl">
            <MDTypography variant="button" color="text">
              Leads quentes
            </MDTypography>
            <MDTypography variant="h4" color="error">
              {summary.hot}
            </MDTypography>
          </MDBox>
        </Grid>
        <Grid item xs={12} md={4}>
          <MDBox p={2.5} bgColor="light" borderRadius="xl">
            <MDTypography variant="button" color="text">
              Contatos vencidos
            </MDTypography>
            <MDTypography variant="h4" color="warning">
              {summary.overdue}
            </MDTypography>
          </MDBox>
        </Grid>

        {feedback.message ? (
          <Snackbar
            open
            autoHideDuration={4000}
            onClose={() => setFeedback({ type: "success", message: "" })}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert
              severity={feedback.type}
              onClose={() => setFeedback({ type: "success", message: "" })}
              variant="filled"
            >
              {feedback.message}
            </Alert>
          </Snackbar>
        ) : null}

        <ConfirmDialog
          open={Boolean(confirmDelete)}
          title="Excluir lead"
          message={
            confirmDelete
              ? `Excluir o lead ${confirmDelete.fullName}? Essa ação remove tarefas, histórico, anexos e desfaz o vínculo com formulários importados.`
              : ""
          }
          confirmLabel="Excluir"
          onConfirm={executeDeleteLead}
          onCancel={() => setConfirmDelete(null)}
        />

        {/* toolbar: view toggle + filter toggle */}
        <Grid item xs={12}>
          <MDBox display="flex" alignItems="center" justifyContent="space-between" gap={2}>
            <MDBox display="flex" alignItems="center" gap={1}>
              <MDButton
                variant={showFilters ? "contained" : "outlined"}
                color="dark"
                size="small"
                onClick={() => setShowFilters((v) => !v)}
                startIcon={<Icon>filter_list</Icon>}
              >
                Filtros
                {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
              </MDButton>
              {searchTerm ? (
                <Chip
                  label={`"${searchTerm}"`}
                  size="small"
                  onDelete={() => {
                    const nextSearchParams = new URLSearchParams(searchParams);
                    nextSearchParams.delete("search");
                    setSearchParams(nextSearchParams, { replace: true });
                  }}
                  sx={{ fontWeight: 500 }}
                />
              ) : null}
            </MDBox>
            {!isMobile ? (
              <MDBox
                display="flex"
                gap={0.5}
                sx={{ bgcolor: "rgba(0,0,0,0.04)", borderRadius: 2, p: 0.5 }}
              >
                <Tooltip title="Kanban">
                  <IconButton
                    size="small"
                    onClick={() => setViewMode("kanban")}
                    sx={{
                      bgcolor: viewMode === "kanban" ? "#fff" : "transparent",
                      boxShadow: viewMode === "kanban" ? 1 : 0,
                      borderRadius: 1.5,
                      color: viewMode === "kanban" ? "#16666D" : "#90a4ae",
                    }}
                  >
                    <Icon>view_kanban</Icon>
                  </IconButton>
                </Tooltip>
                <Tooltip title="Lista">
                  <IconButton
                    size="small"
                    onClick={() => setViewMode("table")}
                    sx={{
                      bgcolor: viewMode === "table" ? "#fff" : "transparent",
                      boxShadow: viewMode === "table" ? 1 : 0,
                      borderRadius: 1.5,
                      color: viewMode === "table" ? "#16666D" : "#90a4ae",
                    }}
                  >
                    <Icon>view_list</Icon>
                  </IconButton>
                </Tooltip>
              </MDBox>
            ) : null}
          </MDBox>
        </Grid>

        {/* filters panel (collapsible) */}
        {showFilters ? (
          <Grid item xs={12}>
            {filtersPanel}
          </Grid>
        ) : null}

        {/* content area */}
        <Grid item xs={12}>
          {viewMode === "kanban" || isMobile ? (
            isMobile ? (
              renderMobileKanban()
            ) : (
              <DragDropContext onDragEnd={handleDragEnd}>
                <MDBox
                  display="flex"
                  gap={2}
                  pb={2}
                  sx={{
                    overflowX: "auto",
                    overflowY: "hidden",
                    "&::-webkit-scrollbar": { height: 6 },
                    "&::-webkit-scrollbar-thumb": {
                      bgcolor: "rgba(22, 102, 109, 0.15)",
                      borderRadius: 3,
                    },
                  }}
                >
                  {pipelineStages.map((stage) => renderKanbanColumn(stage))}
                </MDBox>
              </DragDropContext>
            )
          ) : filteredLeads.length ? (
            <MDBox p={3} bgColor="white" borderRadius="xl" shadow="sm">
              <MDBox sx={desktopTableSx}>
                <DataTable
                  table={tableData}
                  entriesPerPage={{ defaultValue: 10, entries: [5, 10, 15, 20] }}
                  canSearch={false}
                  showTotalEntries
                  isSorted={false}
                  noEndBorder={false}
                />
              </MDBox>
            </MDBox>
          ) : (
            <MDBox p={3} bgColor="white" borderRadius="xl" shadow="sm">
              <EmptyState
                icon="groups"
                title="Nenhum lead encontrado"
                description="Ajuste os filtros ou cadastre um novo lead para começar a preencher a base."
              />
            </MDBox>
          )}
        </Grid>
      </Grid>
    </PageShell>
  );
}

export default Leads;
