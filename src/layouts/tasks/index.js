import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Autocomplete from "@mui/material/Autocomplete";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import EmptyState from "components/veraluz/EmptyState";
import PageShell from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import { useCRM } from "context/CRMContext";
import { formatDateTime, formatPhone, formatRelativeLabel, sameDay } from "utils/formatters";

const scopeOptions = [
  { label: "Todos", value: "all" },
  { label: "Hoje", value: "today" },
  { label: "Atrasados", value: "overdue" },
  { label: "Próximas", value: "upcoming" },
];

function Tasks() {
  const { tasks, users, completeTask } = useCRM();
  const [scope, setScope] = useState(scopeOptions[0]);
  const [ownerId, setOwnerId] = useState("");

  const tasksWithFlags = useMemo(() => {
    const now = new Date();

    return tasks.map((task) => ({
      ...task,
      dueToday: !task.completed && sameDay(task.dueDate, now),
      overdue: !task.completed && new Date(task.dueDate) < now,
    }));
  }, [tasks]);

  const filteredTasks = tasksWithFlags.filter((task) => {
    if (ownerId && String(task.ownerId) !== String(ownerId)) {
      return false;
    }

    if (scope.value === "today") {
      return task.dueToday;
    }

    if (scope.value === "overdue") {
      return task.overdue;
    }

    if (scope.value === "upcoming") {
      return !task.completed && !task.overdue;
    }

    return true;
  });

  const ownerOptions = users
    .filter((user) => user.role === "broker")
    .map((user) => ({ label: user.name, value: user.id }));

  const handleCompleteTask = async (leadId, taskId) => {
    await completeTask(leadId, taskId);
  };

  return (
    <PageShell
      title="Tarefas e follow-ups"
      description="Agenda do dia, retornos atrasados e próximos agendamentos."
    >
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <MDBox p={3} bgColor="white" borderRadius="xl" shadow="sm">
            <Grid container spacing={2}>
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
                  renderInput={(params) => <TextField {...params} label="Corretor" size="small" />}
                />
              </Grid>
              <Grid item xs={12} md={4} display="flex" alignItems="center">
                <MDTypography variant="button" color="text">
                  {filteredTasks.length} tarefas exibidas
                </MDTypography>
              </Grid>
            </Grid>
          </MDBox>
        </Grid>

        <Grid item xs={12} md={4}>
          <SectionCard title="Retornos do dia" description="O que precisa acontecer hoje.">
            <MDTypography variant="h3" color="warning">
              {tasksWithFlags.filter((task) => task.dueToday).length}
            </MDTypography>
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <SectionCard title="Atrasadas" description="Tarefas vencidas aguardando contato.">
            <MDTypography variant="h3" color="error">
              {tasksWithFlags.filter((task) => task.overdue).length}
            </MDTypography>
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <SectionCard title="Concluídas" description="Tarefas já finalizadas no fluxo atual.">
            <MDTypography variant="h3" color="success">
              {tasksWithFlags.filter((task) => task.completed).length}
            </MDTypography>
          </SectionCard>
        </Grid>

        <Grid item xs={12}>
          <SectionCard
            title="Lista operacional"
            description="Acompanhamento detalhado por lead e corretor."
          >
            {filteredTasks.length ? (
              <List sx={{ p: 0 }}>
                {filteredTasks.map((task) => (
                  <ListItem
                    key={task.id}
                    disableGutters
                    divider
                    secondaryAction={
                      !task.completed ? (
                        <MDButton
                          size="small"
                          variant="gradient"
                          color={task.overdue ? "error" : "warning"}
                          onClick={() => handleCompleteTask(task.leadId, task.id)}
                        >
                          Concluir
                        </MDButton>
                      ) : null
                    }
                  >
                    <ListItemText
                      primary={
                        <MDBox
                          display="flex"
                          flexDirection={{ xs: "column", md: "row" }}
                          gap={{ xs: 0.5, md: 2 }}
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
                          <MDTypography variant="caption" color={task.overdue ? "error" : "text"}>
                            {formatRelativeLabel(task.dueDate)}
                          </MDTypography>
                        </MDBox>
                      }
                      secondary={
                        <MDBox mt={0.5}>
                          <MDTypography variant="caption" color="text" display="block">
                            {task.leadName} · {formatPhone(task.leadPhone)} · {task.ownerName}
                          </MDTypography>
                          <MDTypography variant="caption" color="text" display="block">
                            {task.type} · {task.stage} · {formatDateTime(task.dueDate)}
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
                title="Sem tarefas nesta visão"
                description="Ajuste os filtros ou aguarde novos follow-ups."
              />
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageShell>
  );
}

export default Tasks;
