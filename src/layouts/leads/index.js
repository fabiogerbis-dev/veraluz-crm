import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
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

const desktopTableSx = {
  "& .MuiTable-root": {
    minWidth: "76rem",
  },
  "& thead th, & tbody td": {
    paddingLeft: "0.875rem !important",
    paddingRight: "0.875rem !important",
  },
  "& thead th": {
    whiteSpace: "nowrap",
  },
  "& tbody td": {
    verticalAlign: "middle",
  },
  "& thead th:first-of-type, & tbody td:first-of-type": {
    minWidth: "16rem",
  },
  "& thead th:nth-of-type(5), & tbody td:nth-of-type(5)": {
    minWidth: "10rem",
  },
  "& thead th:nth-of-type(6), & tbody td:nth-of-type(6)": {
    minWidth: "9rem",
  },
  "& thead th:nth-of-type(7), & tbody td:nth-of-type(7)": {
    minWidth: "7rem",
  },
  "& thead th:nth-of-type(8), & tbody td:nth-of-type(8)": {
    minWidth: "7.5rem",
  },
  "& thead th:nth-of-type(9), & tbody td:nth-of-type(9)": {
    minWidth: "8rem",
  },
  "& thead th:last-of-type, & tbody td:last-of-type": {
    minWidth: "7rem",
  },
};

function Leads() {
  const { leads, users, settings, deleteLead } = useCRM();
  const isMobileList = useMediaQuery((theme) => theme.breakpoints.down("md"));
  const [searchParams, setSearchParams] = useSearchParams();
  const [feedback, setFeedback] = useState({ type: "success", message: "" });
  const [deletingLeadId, setDeletingLeadId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filters, setFilters] = useState({
    origin: "",
    status: "",
    ownerId: "",
    planType: "",
    temperature: "",
    period: "all",
  });

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
        message: result.message || "Nao foi possivel excluir o lead.",
      });
      return;
    }

    setFeedback({
      type: "success",
      message: `Lead ${lead.fullName} excluido com sucesso.`,
    });
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
        { Header: "Proximo contato", accessor: "nextContact", align: "center", width: "8rem" },
        { Header: "Acoes", accessor: "actions", align: "center", width: "7rem" },
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

  return (
    <PageShell
      title="Leads"
      description="Lista principal com filtros comerciais para captacao, qualificacao e acompanhamento."
      primaryAction={
        <PageShellAction component={Link} to="/leads/new" startIcon={<Icon>add</Icon>}>
          Cadastrar lead
        </PageShellAction>
      }
    >
      <Grid container spacing={3}>
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

        <Grid item xs={12}>
          <MDBox p={3} bgColor="white" borderRadius="xl" shadow="sm">
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Busca rapida"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  helperText={
                    searchTerm
                      ? "Busca aplicada a partir da navegacao rapida."
                      : "Pesquise por nome, telefone ou e-mail."
                  }
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={originOptions}
                  value={filters.origin}
                  onChange={(_, value) =>
                    setFilters((current) => ({ ...current, origin: value || "" }))
                  }
                  renderInput={(params) => <TextField {...params} label="Origem" size="small" />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={STATUS_OPTIONS}
                  value={filters.status}
                  onChange={(_, value) =>
                    setFilters((current) => ({ ...current, status: value || "" }))
                  }
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
                  renderInput={(params) => (
                    <TextField {...params} label="Tipo de plano" size="small" />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={TEMPERATURE_OPTIONS}
                  value={filters.temperature}
                  onChange={(_, value) =>
                    setFilters((current) => ({ ...current, temperature: value || "" }))
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Temperatura" size="small" />
                  )}
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
                  renderInput={(params) => <TextField {...params} label="Periodo" size="small" />}
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
        </Grid>

        <Grid item xs={12}>
          {filteredLeads.length ? (
            <MDBox p={3} bgColor="white" borderRadius="xl" shadow="sm">
              {isMobileList ? (
                <MDBox display="grid" gap={2}>
                  {filteredLeads.map((lead) => {
                    const owner = users.find((user) => user.id === lead.ownerId);
                    const isDeleting = deletingLeadId === lead.id;

                    return (
                      <MDBox
                        key={lead.id}
                        p={2.5}
                        borderRadius="xl"
                        sx={{
                          border: "1px solid rgba(22, 102, 109, 0.12)",
                          background:
                            "linear-gradient(180deg, rgba(246, 250, 250, 0.98) 0%, rgba(255, 255, 255, 1) 100%)",
                        }}
                      >
                        <MDBox
                          display="flex"
                          alignItems="flex-start"
                          justifyContent="space-between"
                          gap={1.5}
                        >
                          <MDBox display="flex" alignItems="center" gap={1.5} minWidth={0}>
                            <Avatar
                              sx={{
                                width: 44,
                                height: 44,
                                bgcolor: "#16666D",
                                fontSize: "0.95rem",
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(lead.fullName)}
                            </Avatar>
                            <MDBox minWidth={0}>
                              <MDTypography variant="button" fontWeight="medium" lineHeight={1.4}>
                                {lead.fullName}
                              </MDTypography>
                              <MDTypography
                                variant="caption"
                                color="text"
                                display="block"
                                sx={{ wordBreak: "break-word", lineHeight: 1.6 }}
                              >
                                {formatPhone(lead.phone)}
                              </MDTypography>
                              {lead.email ? (
                                <MDTypography
                                  variant="caption"
                                  color="text"
                                  display="block"
                                  sx={{ wordBreak: "break-word", lineHeight: 1.6 }}
                                >
                                  {lead.email}
                                </MDTypography>
                              ) : null}
                            </MDBox>
                          </MDBox>
                          <StatusChip value={lead.temperature} type="temperature" />
                        </MDBox>

                        <MDBox mt={2} display="flex" gap={1} flexWrap="wrap">
                          <StatusChip value={lead.origin} type="origin" />
                          <StatusChip value={lead.status} type="status" />
                        </MDBox>

                        <Grid container spacing={1.5} mt={0.5}>
                          <Grid item xs={6}>
                            <MDTypography variant="caption" color="text" display="block">
                              Tipo de plano
                            </MDTypography>
                            <MDTypography variant="button" lineHeight={1.5}>
                              {lead.planType || "--"}
                            </MDTypography>
                          </Grid>
                          <Grid item xs={6}>
                            <MDTypography variant="caption" color="text" display="block">
                              Quantidade de vidas
                            </MDTypography>
                            <MDTypography variant="button" lineHeight={1.5}>
                              {lead.beneficiaries || "--"}
                            </MDTypography>
                          </Grid>
                          <Grid item xs={6}>
                            <MDTypography variant="caption" color="text" display="block">
                              Corretor responsavel
                            </MDTypography>
                            <MDTypography variant="button" lineHeight={1.5}>
                              {owner?.name || "Sem corretor"}
                            </MDTypography>
                          </Grid>
                          <Grid item xs={6}>
                            <MDTypography variant="caption" color="text" display="block">
                              Proximo contato
                            </MDTypography>
                            <MDTypography variant="button" lineHeight={1.5}>
                              {formatDateTime(lead.nextContact)}
                            </MDTypography>
                          </Grid>
                          <Grid item xs={12}>
                            <MDBox
                              mt={0.5}
                              pt={1.5}
                              sx={{ borderTop: "1px solid rgba(22, 102, 109, 0.08)" }}
                            >
                              <MDTypography variant="caption" color="text" display="block">
                                Data de entrada
                              </MDTypography>
                              <MDTypography variant="button" lineHeight={1.5}>
                                {formatDateTime(lead.createdAt)}
                              </MDTypography>
                            </MDBox>
                          </Grid>
                        </Grid>

                        <MDBox mt={2} display="grid" gridTemplateColumns="1fr 1fr 1fr" gap={1}>
                          <MDButton
                            component={Link}
                            to={`/leads/${lead.id}`}
                            variant="gradient"
                            color="info"
                            size="small"
                          >
                            Abrir lead
                          </MDButton>
                          <MDButton
                            component={Link}
                            to={`/leads/${lead.id}/edit`}
                            variant="outlined"
                            color="dark"
                            size="small"
                          >
                            Editar
                          </MDButton>
                          <MDButton
                            variant="outlined"
                            color="error"
                            size="small"
                            disabled={isDeleting}
                            onClick={() => handleDeleteLead(lead)}
                          >
                            {isDeleting ? "Excluindo..." : "Excluir"}
                          </MDButton>
                        </MDBox>
                      </MDBox>
                    );
                  })}
                </MDBox>
              ) : (
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
              )}
            </MDBox>
          ) : (
            <MDBox p={3} bgColor="white" borderRadius="xl" shadow="sm">
              <EmptyState
                icon="groups"
                title="Nenhum lead encontrado"
                description="Ajuste os filtros ou cadastre um novo lead para comecar a preencher a base."
              />
            </MDBox>
          )}
        </Grid>
      </Grid>
    </PageShell>
  );
}

export default Leads;
