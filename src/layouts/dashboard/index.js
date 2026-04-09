import { Link } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import Grid from "@mui/material/Grid";
import PersonAddRoundedIcon from "@mui/icons-material/PersonAddRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PaidRoundedIcon from "@mui/icons-material/PaidRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import ScheduleRoundedIcon from "@mui/icons-material/ScheduleRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import DefaultDoughnutChart from "examples/Charts/DoughnutCharts/DefaultDoughnutChart";
import ReportsLineChart from "examples/Charts/LineCharts/ReportsLineChart";
import EmptyState from "components/veraluz/EmptyState";
import PageShell, { PageShellAction } from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import StatusChip from "components/veraluz/StatusChip";
import { useCRM } from "context/CRMContext";
import { formatDateTime, formatPhone, formatRelativeLabel, getInitials } from "utils/formatters";

function Dashboard() {
  const { dashboard: metrics, leads, users } = useCRM();

  const originChart = {
    labels: metrics.leadsByOrigin.map((item) => item.origin),
    datasets: {
      label: "Leads",
      data: metrics.leadsByOrigin.map((item) => item.total),
    },
  };

  const stageChart = {
    labels: metrics.stageTotals.map((item) => item.stage),
    datasets: {
      label: "Funil",
      data: metrics.stageTotals.map((item) => item.total),
    },
  };

  const temperatureChart = {
    labels: metrics.temperatureTotals.map((item) => item.temperature),
    datasets: {
      label: "Temperatura",
      data: metrics.temperatureTotals.map((item) => item.total),
      backgroundColors: ["info", "warning", "error"],
    },
  };

  return (
    <PageShell
      title="Dashboard comercial"
      description="Visão rápida da operação, com foco em captação, follow-up e fechamento."
      primaryAction={
        <PageShellAction
          component={Link}
          to="/leads/new"
          startIcon={<PersonAddRoundedIcon fontSize="small" />}
        >
          Novo lead
        </PageShellAction>
      }
      secondaryAction={
        <MDButton component={Link} to="/tasks" variant="outlined" color="dark">
          Ver follow-ups
        </MDButton>
      }
    >
      <Grid container spacing={3}>
        <Grid item xs={12} md={6} xl={3}>
          <ComplexStatisticsCard
            color="dark"
            icon={<GroupsRoundedIcon fontSize="medium" color="inherit" />}
            title="Leads ativos"
            count={metrics.totalLeads}
            percentage={{
              color: "success",
              amount: `${metrics.newToday}`,
              label: "novos hoje",
            }}
          />
        </Grid>
        <Grid item xs={12} md={6} xl={3}>
          <ComplexStatisticsCard
            color="success"
            icon={<PaidRoundedIcon fontSize="medium" color="inherit" />}
            title="Vendas no mês"
            count={metrics.closedThisMonth}
            percentage={{
              color: "success",
              amount: `${metrics.ranking.reduce((sum, item) => sum + item.won, 0)}`,
              label: "fechamentos registrados",
            }}
          />
        </Grid>
        <Grid item xs={12} md={6} xl={3}>
          <ComplexStatisticsCard
            color="warning"
            icon={<TrendingUpRoundedIcon fontSize="medium" color="inherit" />}
            title="Conversão"
            count={`${metrics.conversionRate}%`}
            percentage={{
              color: "info",
              amount: `${metrics.averageCloseDays} dias`,
              label: "tempo médio até o fechamento",
            }}
          />
        </Grid>
        <Grid item xs={12} md={6} xl={3}>
          <ComplexStatisticsCard
            color="info"
            icon={<ScheduleRoundedIcon fontSize="medium" color="inherit" />}
            title="1º atendimento"
            count={`${metrics.averageFirstResponseHours}h`}
            percentage={{
              color: metrics.overdueTasks.length ? "error" : "success",
              amount: metrics.overdueTasks.length,
              label: "tarefas em atraso",
            }}
          />
        </Grid>

        <Grid item xs={12} md={6} xl={4} sx={{ pt: 2, mt: 1 }}>
          <ReportsBarChart
            color="warning"
            title="Leads por origem"
            description="Comparativo entre canais de entrada e campanhas ativas."
            date={`${metrics.newToday} novos leads hoje`}
            chart={originChart}
          />
        </Grid>
        <Grid item xs={12} md={6} xl={4} sx={{ pt: 2, mt: 1 }}>
          <ReportsLineChart
            color="success"
            title="Distribuição do funil"
            description="Volume atual por etapa comercial."
            date={`${metrics.closedThisMonth} vendas fechadas neste mês`}
            chart={stageChart}
          />
        </Grid>
        <Grid item xs={12} xl={4}>
          <DefaultDoughnutChart
            icon={{
              color: "warning",
              component: <LocalFireDepartmentRoundedIcon fontSize="medium" color="inherit" />,
            }}
            title="Temperatura dos leads"
            description="Priorize os leads quentes e os retornos pendentes."
            chart={temperatureChart}
          />
        </Grid>

        <Grid item xs={12} xl={5}>
          <SectionCard
            title="Próximos retornos"
            description="Agenda imediata do time para hoje e próximos passos."
            action={
              <MDButton component={Link} to="/tasks" variant="text" color="warning">
                Abrir tarefas
              </MDButton>
            }
          >
            {metrics.openTasks.slice(0, 6).length ? (
              <List sx={{ p: 0 }}>
                {metrics.openTasks.slice(0, 6).map((task) => (
                  <ListItem
                    key={task.id}
                    disableGutters
                    divider
                    sx={{ alignItems: "flex-start", gap: 1.5 }}
                  >
                    <ListItemAvatar sx={{ minWidth: "auto" }}>
                      <Avatar
                        sx={{
                          width: 38,
                          height: 38,
                          bgcolor: task.overdue
                            ? "error.main"
                            : task.dueToday
                            ? "warning.main"
                            : "info.main",
                          fontSize: "0.9rem",
                        }}
                      >
                        {task.leadName?.[0] || "L"}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <MDBox display="flex" justifyContent="space-between" gap={2}>
                          <MDTypography variant="button" fontWeight="medium">
                            {task.title}
                          </MDTypography>
                          <MDTypography variant="caption" color={task.overdue ? "error" : "text"}>
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
                icon="event_available"
                title="Sem retornos pendentes"
                description="As tarefas abertas vão aparecer aqui quando existirem novos agendamentos."
              />
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} xl={4}>
          <SectionCard
            title="Ranking de corretores"
            description="Performance por conversão e volume de fechamentos."
          >
            {metrics.ranking.length ? (
              <List sx={{ p: 0 }}>
                {metrics.ranking.map((broker) => (
                  <ListItem key={broker.id} disableGutters divider sx={{ gap: 1.5 }}>
                    <ListItemAvatar sx={{ minWidth: "auto" }}>
                      <Avatar sx={{ width: 38, height: 38, bgcolor: "warning.main" }}>
                        {broker.avatar}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <MDBox display="flex" justifyContent="space-between" gap={1}>
                          <MDTypography variant="button" fontWeight="medium">
                            {broker.name}
                          </MDTypography>
                          <MDTypography variant="caption" color="success">
                            {broker.conversionRate}%
                          </MDTypography>
                        </MDBox>
                      }
                      secondary={
                        <MDTypography variant="caption" color="text">
                          {broker.won} vendas fechadas · {broker.totalAssigned} leads na carteira
                        </MDTypography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <EmptyState
                icon="leaderboard"
                title="Sem corretores ativos"
                description="Cadastre corretores para acompanhar o ranking comercial."
              />
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} xl={3}>
          <SectionCard title="Sinais de risco" description="O que merece atenção imediata.">
            <MDBox display="grid" gap={2}>
              <MDBox p={2} bgColor="light" borderRadius="lg">
                <MDTypography variant="button" fontWeight="medium" display="block">
                  {metrics.overdueTasks.length} follow-ups atrasados
                </MDTypography>
                <MDTypography variant="caption" color="text">
                  Leads com promessa de retorno fora do prazo combinado.
                </MDTypography>
              </MDBox>
              <MDBox p={2} bgColor="light" borderRadius="lg">
                <MDTypography variant="button" fontWeight="medium" display="block">
                  {metrics.lossRate}% de taxa de perda
                </MDTypography>
                <MDTypography variant="caption" color="text">
                  Reveja motivos de perda e gargalos na proposta.
                </MDTypography>
              </MDBox>
              <MDBox p={2} bgColor="light" borderRadius="lg">
                <MDTypography variant="button" fontWeight="medium" display="block">
                  {metrics.lossReasons[0]?.reason || "Sem perdas críticas"}
                </MDTypography>
                <MDTypography variant="caption" color="text">
                  Principal motivo recente de perda registrado no CRM.
                </MDTypography>
              </MDBox>
            </MDBox>
          </SectionCard>
        </Grid>

        <Grid item xs={12}>
          <SectionCard
            title="Leads recentes"
            description="Entradas mais novas da operação, com origem, responsável e próximo passo."
            action={
              <MDButton component={Link} to="/leads" variant="text" color="warning">
                Ver todos
              </MDButton>
            }
          >
            {metrics.recentLeads.length ? (
              <Grid container spacing={2}>
                {metrics.recentLeads.map((lead) => {
                  const owner = users.find((user) => user.id === lead.ownerId);

                  return (
                    <Grid item xs={12} md={6} xl={4} key={lead.id}>
                      <MDBox p={2.5} borderRadius="xl" bgColor="light" height="100%">
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
                              variant="h6"
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
                        <MDBox mt={2} display="flex" gap={1} flexWrap="wrap">
                          <StatusChip value={lead.origin} type="origin" />
                          <StatusChip value={lead.temperature} type="temperature" />
                          <StatusChip value={lead.status} type="status" />
                        </MDBox>
                        <MDBox mt={2}>
                          <MDTypography variant="caption" color="text" display="block">
                            {lead.planType} · {lead.beneficiaries} vidas
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            Responsável: {owner?.name || "Sem corretor"}
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            Próximo contato: {formatDateTime(lead.nextContact)}
                          </MDTypography>
                        </MDBox>
                      </MDBox>
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <EmptyState
                icon="groups"
                title="Nenhum lead disponível"
                description="Cadastre o primeiro lead para começar a acompanhar o funil comercial."
              />
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageShell>
  );
}

export default Dashboard;
