import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import DefaultDoughnutChart from "examples/Charts/DoughnutCharts/DefaultDoughnutChart";
import EmptyState from "components/veraluz/EmptyState";
import PageShell from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import { useAuth } from "context/AuthContext";
import { useCRM } from "context/CRMContext";
import { apiRequest } from "services/apiClient";
import { computeDashboardMetrics, getVisibleLeads, serializeLeadsToCsv } from "utils/crm";

function Reports() {
  const { currentUser } = useAuth();
  const { leads, users } = useCRM();
  const visibleLeads = getVisibleLeads(leads, currentUser);
  const metrics = computeDashboardMetrics(visibleLeads, users);

  const handleExport = async () => {
    let blob;

    try {
      blob = await apiRequest("/api/reports/leads/export", { responseType: "blob" });
    } catch (error) {
      const csv = serializeLeadsToCsv(visibleLeads, users);
      blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "veraluz-leads.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <PageShell
      title="Relatórios"
      description="Análise de conversão por origem, corretor, funil e perdas."
      primaryAction={
        <MDButton
          variant="gradient"
          color="warning"
          onClick={handleExport}
          startIcon={<Icon>download</Icon>}
        >
          Exportar CSV
        </MDButton>
      }
    >
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ReportsBarChart
            color="warning"
            title="Conversão por origem"
            description="Quantidade de leads captados por canal."
            date={`${metrics.totalLeads} leads analisados`}
            chart={{
              labels: metrics.leadsByOrigin.map((item) => item.origin),
              datasets: {
                label: "Leads",
                data: metrics.leadsByOrigin.map((item) => item.total),
              },
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <DefaultDoughnutChart
            icon={{ color: "warning", component: "pie_chart" }}
            title="Tipos de plano"
            description="Distribuição das oportunidades por categoria."
            chart={{
              labels: metrics.leadsByPlanType.map((item) => item.planType),
              datasets: {
                label: "Planos",
                data: metrics.leadsByPlanType.map((item) => item.total),
                backgroundColors: ["info", "warning", "success", "dark", "primary"],
              },
            }}
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard title="Ranking comercial" description="Volume e conversão por corretor.">
            {metrics.ranking.length ? (
              metrics.ranking.map((broker) => (
                <Grid container spacing={1} key={broker.id} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <MDTypography variant="button" fontWeight="medium">
                      {broker.name}
                    </MDTypography>
                  </Grid>
                  <Grid item xs={3}>
                    <MDTypography variant="caption" color="text">
                      {broker.won} vendas
                    </MDTypography>
                  </Grid>
                  <Grid item xs={3}>
                    <MDTypography variant="caption" color="success">
                      {broker.conversionRate}%
                    </MDTypography>
                  </Grid>
                </Grid>
              ))
            ) : (
              <EmptyState
                icon="leaderboard"
                title="Sem dados para ranking"
                description="Cadastre leads e distribua oportunidades para acompanhar a equipe."
              />
            )}
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard
            title="Motivos de perda"
            description="Resumo dos fechamentos perdidos na base atual."
          >
            {metrics.lossReasons.length ? (
              metrics.lossReasons.map((item) => (
                <Grid container spacing={1} key={item.reason} sx={{ mb: 2 }}>
                  <Grid item xs={8}>
                    <MDTypography variant="button">{item.reason}</MDTypography>
                  </Grid>
                  <Grid item xs={4}>
                    <MDTypography variant="caption" color="error">
                      {item.total} ocorrências
                    </MDTypography>
                  </Grid>
                </Grid>
              ))
            ) : (
              <EmptyState
                icon="report_gmailerrorred"
                title="Sem perdas registradas"
                description="Os motivos de perda vão aparecer aqui assim que houver registros nessa etapa."
              />
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageShell>
  );
}

export default Reports;
