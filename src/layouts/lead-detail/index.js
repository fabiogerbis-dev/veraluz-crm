import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import EmptyState from "components/veraluz/EmptyState";
import PageShell, { PageShellAction } from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import StatusChip from "components/veraluz/StatusChip";
import { useCRM } from "context/CRMContext";
import { INTERACTION_CHANNEL_OPTIONS, TASK_TYPE_OPTIONS } from "data/veraluzSeed";
import TimelineItem from "examples/Timeline/TimelineItem";
import TimelineList from "examples/Timeline/TimelineList";
import {
  buildMailtoUrl,
  buildPhoneUrl,
  buildWhatsAppUrl,
  formatDateTime,
  formatPhone,
  getInitials,
} from "utils/formatters";

const ACCEPTED_DOCUMENT_TYPES = [".png", ".jpg", ".jpeg", ".pdf"];
const ACCEPTED_DOCUMENT_MIME_TYPES = ["image/png", "image/jpeg", "application/pdf"];
const COMPACT_FIELD_SX = {
  "& .MuiInputBase-root": {
    minHeight: 40,
  },
};

const COMPACT_SELECT_FIELD_SX = {
  ...COMPACT_FIELD_SX,
  "& .MuiSelect-select": {
    display: "flex",
    alignItems: "center",
    minHeight: "1.4375em",
  },
};

function isAcceptedDocument(file) {
  const normalizedName = file.name?.toLowerCase() || "";
  const hasAcceptedMimeType = ACCEPTED_DOCUMENT_MIME_TYPES.includes(file.type);
  const hasAcceptedExtension = ACCEPTED_DOCUMENT_TYPES.some((extension) =>
    normalizedName.endsWith(extension)
  );

  return hasAcceptedMimeType || hasAcceptedExtension;
}

function LeadDetail() {
  const { id } = useParams();
  const { getLeadById, fetchLeadById, users, addInteraction, addTask, addDocument, completeTask } =
    useCRM();
  const lead = getLeadById(id);
  const owner = useMemo(
    () => users.find((user) => user.id === lead?.ownerId),
    [lead?.ownerId, users]
  );
  const [error, setError] = useState("");
  const [loadingLead, setLoadingLead] = useState(true);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [interaction, setInteraction] = useState({
    channel: "WhatsApp",
    subject: "",
    summary: "",
    nextContact: "",
  });
  const [task, setTask] = useState({
    title: "",
    type: "Ligação",
    dueDate: "",
    notes: "",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadLead() {
      setLoadingLead(true);
      await fetchLeadById(id);

      if (isMounted) {
        setLoadingLead(false);
      }
    }

    loadLead();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleInteractionSubmit = async (event) => {
    event.preventDefault();

    if (!interaction.subject.trim()) {
      setError("Informe o assunto da interação.");
      return;
    }

    setSavingInteraction(true);
    const result = await addInteraction(lead.id, {
      channel: interaction.channel,
      subject: interaction.subject,
      summary: interaction.summary,
      nextContact: interaction.nextContact,
    });
    setSavingInteraction(false);

    if (!result.ok) {
      setError(result.message || "Não foi possível registrar a interação.");
      return;
    }

    setError("");
    setInteraction({
      channel: "WhatsApp",
      subject: "",
      summary: "",
      nextContact: "",
    });
  };

  const handleTaskSubmit = async (event) => {
    event.preventDefault();

    if (!task.title.trim() || !task.dueDate) {
      setError("Preencha título e vencimento da tarefa.");
      return;
    }

    setSavingTask(true);
    const result = await addTask(lead.id, {
      title: task.title,
      type: task.type,
      dueDate: task.dueDate,
      notes: task.notes,
    });
    setSavingTask(false);

    if (!result.ok) {
      setError(result.message || "Não foi possível criar a tarefa.");
      return;
    }

    setError("");
    setTask({
      title: "",
      type: "Ligação",
      dueDate: "",
      notes: "",
    });
  };

  const handleDocumentSelect = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile) {
      return;
    }

    if (!isAcceptedDocument(selectedFile)) {
      setError("Anexe um arquivo PNG, JPG ou PDF.");
      return;
    }

    setUploadingDocument(true);
    const result = await addDocument(lead.id, { file: selectedFile });
    setUploadingDocument(false);

    if (!result.ok) {
      setError(result.message || "Não foi possível anexar o documento.");
      return;
    }

    setError("");
  };

  const handleCompleteTask = async (taskId) => {
    const result = await completeTask(lead.id, taskId);

    if (!result.ok) {
      setError(result.message || "Não foi possível concluir a tarefa.");
      return;
    }

    setError("");
  };

  if (loadingLead && !lead) {
    return (
      <PageShell title="Carregando lead" description="Buscando os dados completos da oportunidade.">
        <EmptyState
          icon="hourglass_top"
          title="Carregando lead"
          description="Aguarde enquanto o CRM consulta o histórico completo deste cadastro."
        />
      </PageShell>
    );
  }

  if (!lead) {
    return (
      <PageShell
        title="Lead não encontrado"
        description="O cadastro solicitado não está disponível."
      >
        <EmptyState
          icon="person_off"
          title="Lead não encontrado"
          description="Volte para a listagem e selecione outra oportunidade."
        />
      </PageShell>
    );
  }

  const qualificationItems = [
    ["Cidade / UF", `${lead.city || "--"} / ${lead.state || "--"}`],
    ["Bairro", lead.neighborhood || "--"],
    ["Faixa etária", lead.ageRange || "--"],
    ["Tipo de contratação", lead.contractType || "--"],
    ["Plano desejado", lead.planType || "--"],
    ["Coparticipação", lead.coparticipation || "--"],
    ["Cobertura", lead.coverage || "--"],
    ["Urgência", lead.urgency || "--"],
    ["Empresa", lead.companyName || "--"],
    ["CNPJ", lead.cnpj || "--"],
    ["CNPJ ativo", lead.hasActiveCnpj ? "Sim" : "NÃ£o"],
    ["MEI ativo", lead.hasActiveMei ? "Sim" : "NÃ£o"],
    ["Entidade / sindicato", lead.entityName || "--"],
    ["Plano atual", lead.currentPlan || "--"],
  ];

  if (Array.isArray(lead.beneficiaryAgeRanges) && lead.beneficiaryAgeRanges.length) {
    qualificationItems.splice(3, 0, [
      "Faixas etárias por vida",
      lead.beneficiaryAgeRanges.map((range, index) => `${index + 1}. ${range}`).join(" | "),
    ]);
  }

  if (lead.lossReason) {
    qualificationItems.push(["Motivo da perda", lead.lossReason]);
  }

  return (
    <PageShell
      title={lead.fullName}
      description={`${lead.planType} · ${lead.beneficiaries} vidas · ${lead.city || "--"}/${
        lead.state || "--"
      }`}
      primaryAction={
        <PageShellAction
          component={Link}
          to={`/leads/${lead.id}/edit`}
          startIcon={<Icon>edit</Icon>}
        >
          Editar lead
        </PageShellAction>
      }
      secondaryAction={
        <MDButton component={Link} to="/leads" variant="outlined" color="dark">
          Voltar para leads
        </MDButton>
      }
    >
      <Grid container spacing={3}>
        <Grid item xs={12}>
          {error ? <Alert severity="warning">{error}</Alert> : null}
        </Grid>

        <Grid item xs={12}>
          <MDBox p={3} bgColor="light" borderRadius="xl">
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <MDBox display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ width: 56, height: 56, bgcolor: "warning.main" }}>
                    {getInitials(lead.fullName)}
                  </Avatar>
                  <MDBox>
                    <MDTypography variant="h5">{lead.fullName}</MDTypography>
                    <MDTypography variant="button" color="text">
                      {formatPhone(lead.phone)} · {lead.email || "Sem e-mail"}
                    </MDTypography>
                  </MDBox>
                </MDBox>
              </Grid>
              <Grid item xs={12} md={4}>
                <MDBox display="flex" gap={1} flexWrap="wrap">
                  <StatusChip value={lead.origin} type="origin" />
                  <StatusChip value={lead.status} type="status" />
                  <StatusChip value={lead.temperature} type="temperature" />
                </MDBox>
              </Grid>
              <Grid item xs={12} md={4}>
                <MDBox
                  display="flex"
                  justifyContent={{ xs: "flex-start", md: "flex-end" }}
                  gap={1}
                  flexWrap="wrap"
                >
                  <MDButton
                    component={Link}
                    to={`/inbox?lead=${lead.id}`}
                    variant="gradient"
                    color="warning"
                  >
                    Abrir atendimento
                  </MDButton>
                  <MDButton
                    component="a"
                    href={buildPhoneUrl(lead.phone)}
                    variant="outlined"
                    color="dark"
                    disabled={!lead.phone}
                  >
                    Ligar
                  </MDButton>
                  <MDButton
                    component="a"
                    href={buildWhatsAppUrl(lead.phone)}
                    target="_blank"
                    variant="outlined"
                    color="success"
                    disabled={!lead.phone}
                  >
                    WhatsApp web
                  </MDButton>
                  <MDButton
                    component="a"
                    href={buildMailtoUrl(lead.email)}
                    variant="gradient"
                    color="info"
                    disabled={!lead.email}
                  >
                    E-mail
                  </MDButton>
                </MDBox>
              </Grid>
            </Grid>
          </MDBox>
        </Grid>

        <Grid item xs={12} lg={4}>
          <SectionCard
            title="Resumo do lead"
            description="Informações consolidadas para atendimento rápido."
          >
            <MDTypography variant="button" display="block" fontWeight="medium">
              Corretor responsável
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block" mb={2}>
              {owner?.name || lead.ownerName || "Sem corretor"}
            </MDTypography>

            <MDTypography variant="button" display="block" fontWeight="medium">
              Etapa atual
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block" mb={2}>
              {lead.stage}
            </MDTypography>

            <MDTypography variant="button" display="block" fontWeight="medium">
              Próximo retorno
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block" mb={2}>
              {formatDateTime(lead.nextContact)}
            </MDTypography>

            <MDTypography variant="button" display="block" fontWeight="medium">
              Origem / campanha
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block" mb={2}>
              {lead.sourceCampaign || lead.origin || "--"}
            </MDTypography>

            <MDTypography variant="button" display="block" fontWeight="medium">
              Operadora de interesse
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block" mb={2}>
              {lead.operatorInterest || "--"}
            </MDTypography>

            <MDTypography variant="button" display="block" fontWeight="medium">
              Tags
            </MDTypography>
            <MDBox mt={1} display="flex" gap={1} flexWrap="wrap">
              {lead.tags?.length ? (
                lead.tags.map((tag) => <StatusChip key={tag} value={tag} type="tag" />)
              ) : (
                <MDTypography variant="caption" color="text">
                  Sem tags
                </MDTypography>
              )}
            </MDBox>
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={8}>
          <SectionCard
            title="Qualificação completa"
            description="Campos relevantes para venda de planos."
          >
            <Grid container spacing={2}>
              {qualificationItems.map(([label, value]) => (
                <Grid item xs={12} md={6} key={label}>
                  <MDTypography variant="button" fontWeight="medium" display="block">
                    {label}
                  </MDTypography>
                  <MDTypography variant="caption" color="text">
                    {value}
                  </MDTypography>
                </Grid>
              ))}
            </Grid>
            <Divider sx={{ my: 3 }} />
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <MDTypography variant="button" fontWeight="medium" display="block">
                  Observações iniciais
                </MDTypography>
                <MDTypography variant="caption" color="text">
                  {lead.initialNotes || "--"}
                </MDTypography>
              </Grid>
              <Grid item xs={12} md={6}>
                <MDTypography variant="button" fontWeight="medium" display="block">
                  Observações internas
                </MDTypography>
                <MDTypography variant="caption" color="text">
                  {lead.notes || "--"}
                </MDTypography>
              </Grid>
            </Grid>
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <SectionCard
            title="Histórico de contatos"
            description="Linha de atendimento por canal e assunto."
          >
            {lead.interactions?.length ? (
              <List sx={{ p: 0 }}>
                {lead.interactions.map((item) => (
                  <ListItem key={item.id} disableGutters divider>
                    <ListItemText
                      primary={`${item.channel} · ${item.subject}`}
                      secondary={`${formatDateTime(item.date)} · ${item.createdBy}`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <EmptyState
                icon="call"
                title="Sem interações"
                description="Registre o primeiro contato deste lead."
              />
            )}
            <Divider sx={{ my: 3 }} />
            <MDBox component="form" onSubmit={handleInteractionSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Canal"
                    sx={COMPACT_SELECT_FIELD_SX}
                    value={interaction.channel}
                    onChange={(event) =>
                      setInteraction((current) => ({ ...current, channel: event.target.value }))
                    }
                  >
                    {INTERACTION_CHANNEL_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Assunto"
                    sx={COMPACT_FIELD_SX}
                    value={interaction.subject}
                    onChange={(event) =>
                      setInteraction((current) => ({ ...current, subject: event.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={3}
                    label="Resumo"
                    value={interaction.summary}
                    onChange={(event) =>
                      setInteraction((current) => ({ ...current, summary: event.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    size="small"
                    type="datetime-local"
                    label="Próximo contato"
                    value={interaction.nextContact ? interaction.nextContact.slice(0, 16) : ""}
                    onChange={(event) =>
                      setInteraction((current) => ({ ...current, nextContact: event.target.value }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <MDButton
                    type="submit"
                    variant="gradient"
                    color="warning"
                    fullWidth
                    disabled={savingInteraction}
                    sx={{ height: "100%" }}
                  >
                    {savingInteraction ? "Registrando..." : "Registrar interação"}
                  </MDButton>
                </Grid>
              </Grid>
            </MDBox>
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <SectionCard
            title="Tarefas e follow-ups"
            description="Agenda do lead com acompanhamento de retorno."
          >
            {lead.tasks?.length ? (
              <List sx={{ p: 0 }}>
                {lead.tasks.map((item) => (
                  <ListItem
                    key={item.id}
                    disableGutters
                    divider
                    secondaryAction={
                      !item.completed ? (
                        <MDButton
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => handleCompleteTask(item.id)}
                        >
                          Concluir
                        </MDButton>
                      ) : null
                    }
                  >
                    <ListItemText
                      primary={`${item.title} · ${item.type}`}
                      secondary={`${formatDateTime(item.dueDate)}${
                        item.completed ? " · concluída" : ""
                      }`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <EmptyState
                icon="task"
                title="Sem tarefas"
                description="Crie um follow-up para este lead."
              />
            )}
            <Divider sx={{ my: 3 }} />
            <MDBox component="form" onSubmit={handleTaskSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Título da tarefa"
                    value={task.title}
                    onChange={(event) =>
                      setTask((current) => ({ ...current, title: event.target.value }))
                    }
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Tipo"
                    sx={COMPACT_SELECT_FIELD_SX}
                    value={task.type}
                    onChange={(event) =>
                      setTask((current) => ({ ...current, type: event.target.value }))
                    }
                  >
                    {TASK_TYPE_OPTIONS.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    size="small"
                    type="datetime-local"
                    label="Vencimento"
                    value={task.dueDate ? task.dueDate.slice(0, 16) : ""}
                    onChange={(event) =>
                      setTask((current) => ({ ...current, dueDate: event.target.value }))
                    }
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <MDButton
                    type="submit"
                    variant="gradient"
                    color="warning"
                    fullWidth
                    disabled={savingTask}
                    sx={{ height: "100%" }}
                  >
                    {savingTask ? "Criando..." : "Criar tarefa"}
                  </MDButton>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    label="Notas"
                    value={task.notes}
                    onChange={(event) =>
                      setTask((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </Grid>
              </Grid>
            </MDBox>
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={5} display="flex">
          <MDBox width="100%" display="flex">
            <SectionCard
              title="Documentos anexados"
              description="Controle de arquivos recebidos no processo comercial."
            >
              {lead.documents?.length ? (
                <List sx={{ p: 0 }}>
                  {lead.documents.map((item) => (
                    <ListItem key={item.id} disableGutters divider>
                      <ListItemText
                        primary={item.fileName || item.label || "Documento"}
                        secondary={formatDateTime(item.uploadedAt)}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <EmptyState
                  icon="attach_file"
                  title="Sem documentos"
                  description="Anexe RG, CPF, proposta ou comprovantes."
                />
              )}
              <Divider sx={{ my: 3 }} />
              <MDTypography variant="caption" color="text" display="block" mb={2}>
                Aceita arquivos PNG, JPG e PDF. O nome do arquivo é preenchido automaticamente.
              </MDTypography>
              <MDButton
                component="label"
                variant="gradient"
                color="warning"
                fullWidth
                disabled={uploadingDocument}
              >
                {uploadingDocument ? "Preparando documento..." : "Adicionar documento"}
                <input
                  hidden
                  type="file"
                  accept={ACCEPTED_DOCUMENT_TYPES.join(",")}
                  onChange={handleDocumentSelect}
                />
              </MDButton>
            </SectionCard>
          </MDBox>
        </Grid>

        <Grid item xs={12} lg={7} display="flex">
          <MDBox
            width="100%"
            sx={{
              "& .MuiCard-root": {
                height: "100%",
              },
            }}
          >
            <TimelineList title="Linha do tempo">
              {lead.timeline?.length ? (
                lead.timeline.map((item, index) => (
                  <TimelineItem
                    key={item.id}
                    color={item.color}
                    icon={item.icon}
                    title={item.title}
                    dateTime={formatDateTime(item.date)}
                    description={item.description}
                    lastItem={index === lead.timeline.length - 1}
                  />
                ))
              ) : (
                <MDBox p={3}>
                  <MDTypography variant="caption" color="text">
                    Ainda não há movimentações registradas.
                  </MDTypography>
                </MDBox>
              )}
            </TimelineList>
          </MDBox>
        </Grid>
      </Grid>
    </PageShell>
  );
}

export default LeadDetail;
