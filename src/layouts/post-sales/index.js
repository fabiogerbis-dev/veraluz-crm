import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Autocomplete from "@mui/material/Autocomplete";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import EmptyState from "components/veraluz/EmptyState";
import PageShell, { PageShellAction } from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import StatusChip from "components/veraluz/StatusChip";
import { useCRM } from "context/CRMContext";
import { POST_SALE_STAGE } from "utils/commercialRules";
import { formatDateTime, formatPhone, formatRelativeLabel, getInitials } from "utils/formatters";

const scopeOptions = [
  { label: "Toda a carteira", value: "all" },
  { label: "Implantação recente", value: "recent" },
  { label: "Com pendência", value: "pending" },
  { label: "Sem agenda", value: "no_schedule" },
];

function PostSales() {
  const { leads, tasks, users } = useCRM();
  const [scope, setScope] = useState(scopeOptions[0]);
  const [ownerId, setOwnerId] = useState("");
  const now = new Date();

  const postSaleLeads = useMemo(
    () => leads.filter((lead) => lead.stage === POST_SALE_STAGE),
    [leads]
  );
  const postSaleLeadIds = useMemo(
    () => new Set(postSaleLeads.map((lead) => String(lead.id))),
    [postSaleLeads]
  );
  const postSaleTasks = useMemo(
    () =>
      tasks
        .filter((task) => postSaleLeadIds.has(String(task.leadId)) && !task.completed)
        .sort((left, right) => new Date(left.dueDate || 0) - new Date(right.dueDate || 0)),
    [postSaleLeadIds, tasks]
  );
  const ownerOptions = users
    .filter((user) => ["broker", "manager", "admin"].includes(user.role))
    .map((user) => ({ label: user.name, value: user.id }));

  const filteredLeads = useMemo(
    () =>
      postSaleLeads.filter((lead) => {
        const recentImplantation = lead.closedAt && now - new Date(lead.closedAt) <= 30 * 86400000;
        const hasPendingTask = postSaleTasks.some(
          (task) => String(task.leadId) === String(lead.id)
        );
        const hasSchedule = Boolean(lead.nextContact);

        if (ownerId && String(lead.ownerId) !== String(ownerId)) {
          return false;
        }

        if (scope.value === "recent") {
          return recentImplantation;
        }

        if (scope.value === "pending") {
          return hasPendingTask;
        }

        if (scope.value === "no_schedule") {
          return !hasSchedule;
        }

        return true;
      }),
    [now, ownerId, postSaleLeads, postSaleTasks, scope.value]
  );
  const filteredLeadIds = useMemo(
    () => new Set(filteredLeads.map((lead) => String(lead.id))),
    [filteredLeads]
  );
  const visiblePostSaleTasks = useMemo(
    () => postSaleTasks.filter((task) => filteredLeadIds.has(String(task.leadId))),
    [filteredLeadIds, postSaleTasks]
  );

  const summary = {
    total: postSaleLeads.length,
    recent: postSaleLeads.filter(
      (lead) => lead.closedAt && now - new Date(lead.closedAt) <= 30 * 86400000
    ).length,
    overdue: postSaleLeads.filter((lead) => lead.nextContact && new Date(lead.nextContact) < now)
      .length,
    withoutSchedule: postSaleLeads.filter((lead) => !lead.nextContact).length,
  };

  return (
    <PageShell
      title="Pós-venda"
      description="Carteira ativa após o fechamento, com foco em implantação, retornos e continuidade."
      primaryAction={
        <PageShellAction component={Link} to="/tasks">
          Abrir tarefas
        </PageShellAction>
      }
      secondaryAction={
        <MDButton component={Link} to="/pipeline" variant="outlined" color="dark">
          Voltar ao pipeline
        </MDButton>
      }
    >
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <MDBox p={3} bgColor="white" borderRadius="xl" shadow="sm">
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={scopeOptions}
                  value={scope}
                  onChange={(_, value) => setScope(value || scopeOptions[0])}
                  renderInput={(params) => <TextField {...params} label="Visão" size="small" />}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  options={ownerOptions}
                  value={ownerOptions.find((option) => option.value === ownerId) || null}
                  onChange={(_, value) => setOwnerId(value?.value || "")}
                  renderInput={(params) => (
                    <TextField {...params} label="Responsável pela carteira" size="small" />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <MDTypography variant="button" color="text">
                  {filteredLeads.length} clientes exibidos no pós-venda
                </MDTypography>
              </Grid>
            </Grid>
          </MDBox>
        </Grid>

        <Grid item xs={12} md={6} xl={3}>
          <SectionCard title="Carteira ativa" description="Leads já convertidos em acompanhamento.">
            <MDTypography variant="h3" color="brand">
              {summary.total}
            </MDTypography>
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6} xl={3}>
          <SectionCard
            title="Implantação recente"
            description="Fechamentos que entraram no pós-venda há até 30 dias."
          >
            <MDTypography variant="h3" color="info">
              {summary.recent}
            </MDTypography>
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6} xl={3}>
          <SectionCard
            title="Retornos em atraso"
            description="Clientes do pós-venda com agenda vencida."
          >
            <MDTypography variant="h3" color="error">
              {summary.overdue}
            </MDTypography>
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6} xl={3}>
          <SectionCard
            title="Sem agenda"
            description="Carteira sem próximo acompanhamento definido."
          >
            <MDTypography variant="h3" color="warning">
              {summary.withoutSchedule}
            </MDTypography>
          </SectionCard>
        </Grid>

        <Grid item xs={12} xl={7}>
          <SectionCard
            title="Carteira em acompanhamento"
            description="Acompanhe clientes implantados, próximos retornos e responsável atual."
          >
            {filteredLeads.length ? (
              <MDBox display="grid" gap={1.5}>
                {filteredLeads.map((lead) => {
                  const owner = users.find((user) => String(user.id) === String(lead.ownerId));
                  const isOverdue = lead.nextContact && new Date(lead.nextContact) < now;

                  return (
                    <MDBox
                      key={lead.id}
                      p={2}
                      sx={{
                        borderRadius: "12px",
                        border: "1px solid rgba(22, 102, 109, 0.08)",
                        background: "#fff",
                      }}
                    >
                      <MDBox display="flex" justifyContent="space-between" gap={2}>
                        <MDBox display="flex" gap={1.5} minWidth={0}>
                          <Avatar sx={{ width: 40, height: 40, bgcolor: "#16666D" }}>
                            {getInitials(lead.fullName)}
                          </Avatar>
                          <MDBox minWidth={0}>
                            <MDTypography
                              component={Link}
                              to={`/leads/${lead.id}`}
                              variant="button"
                              fontWeight="medium"
                              color="dark"
                              sx={{ textDecoration: "none", display: "block" }}
                            >
                              {lead.fullName}
                            </MDTypography>
                            <MDTypography variant="caption" color="text" display="block">
                              {formatPhone(lead.phone)} · {lead.email || "Sem e-mail"}
                            </MDTypography>
                            <MDTypography variant="caption" color="text" display="block">
                              {lead.planType || "Plano não informado"} · {lead.beneficiaries || 0}{" "}
                              vidas
                            </MDTypography>
                          </MDBox>
                        </MDBox>
                        <MDBox display="flex" gap={0.75} flexWrap="wrap" justifyContent="flex-end">
                          <StatusChip value={lead.status} type="status" />
                          <StatusChip value={lead.temperature} type="temperature" />
                          <Chip
                            label={owner?.name || "Sem responsável"}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              bgcolor: "rgba(22, 102, 109, 0.08)",
                              color: "#16666D",
                            }}
                          />
                        </MDBox>
                      </MDBox>

                      <MDBox
                        mt={1.5}
                        display="flex"
                        flexDirection={{ xs: "column", md: "row" }}
                        gap={{ xs: 0.75, md: 2 }}
                      >
                        <MDTypography variant="caption" color="text">
                          Fechado em {formatDateTime(lead.closedAt)}
                        </MDTypography>
                        <MDTypography variant="caption" color={isOverdue ? "error" : "text"}>
                          Próximo contato {formatDateTime(lead.nextContact)}
                        </MDTypography>
                      </MDBox>

                      <MDBox mt={1.5} display="flex" gap={1} flexWrap="wrap">
                        <MDButton
                          component={Link}
                          to={`/leads/${lead.id}`}
                          variant="outlined"
                          color="dark"
                          size="small"
                        >
                          Abrir lead
                        </MDButton>
                        <MDButton
                          component={Link}
                          to={`/leads/${lead.id}/edit`}
                          variant="gradient"
                          color="brand"
                          size="small"
                        >
                          Atualizar cadastro
                        </MDButton>
                      </MDBox>
                    </MDBox>
                  );
                })}
              </MDBox>
            ) : (
              <EmptyState
                icon="support_agent"
                title="Nenhum cliente nesta visão"
                description="Quando um lead for movido para Pós-venda, ele aparecerá aqui para acompanhamento da carteira."
              />
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} xl={5}>
          <SectionCard
            title="Pendências do pós-venda"
            description="Tarefas abertas ligadas à carteira já fechada."
          >
            {visiblePostSaleTasks.length ? (
              <List sx={{ p: 0 }}>
                {visiblePostSaleTasks.slice(0, 8).map((task) => (
                  <ListItem key={task.id} disableGutters divider>
                    <ListItemText
                      primary={
                        <MDBox
                          display="flex"
                          justifyContent="space-between"
                          gap={2}
                          flexDirection={{ xs: "column", md: "row" }}
                        >
                          <MDTypography
                            component={Link}
                            to={`/leads/${task.leadId}`}
                            variant="button"
                            color="dark"
                            fontWeight="medium"
                            sx={{ textDecoration: "none" }}
                          >
                            {task.title}
                          </MDTypography>
                          <MDTypography
                            variant="caption"
                            color={new Date(task.dueDate) < now ? "error" : "text"}
                          >
                            {formatRelativeLabel(task.dueDate)}
                          </MDTypography>
                        </MDBox>
                      }
                      secondary={
                        <MDBox mt={0.75}>
                          <MDTypography variant="caption" color="text" display="block">
                            {task.leadName} · {task.ownerName}
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            {task.type} · {formatDateTime(task.dueDate)}
                          </MDTypography>
                        </MDBox>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <EmptyState
                icon="task_alt"
                title="Sem pendências abertas"
                description="As tarefas de implantação e acompanhamento do pós-venda aparecerão aqui."
              />
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageShell>
  );
}

export default PostSales;
