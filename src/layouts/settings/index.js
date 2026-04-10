import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import PageShell, { PageShellAction } from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import { useCRM } from "context/CRMContext";
import { ROLE_OPTIONS, ROLE_PERMISSIONS } from "data/veraluzSeed";

function createFormState(settings) {
  return {
    brokerageName: settings?.brokerage?.name || "",
    brokerageCnpj: settings?.brokerage?.cnpj || "",
    brokerageCity: settings?.brokerage?.city || "",
    brokerageState: settings?.brokerage?.state || "",
    brokeragePhone: settings?.brokerage?.supportPhone || "",
    brokerageEmail: settings?.brokerage?.supportEmail || "",
    pipelineStages: (settings?.pipelineStageRecords || settings?.pipelineStages || [])
      .map((item) => {
        if (typeof item === "string") {
          return { id: "", name: item };
        }

        return {
          id: String(item?.id || ""),
          name: String(item?.name || "").trim(),
        };
      })
      .filter((item) => item.name),
    planTypes: [...(settings?.planTypes || [])],
    operatorInterests: [...(settings?.operatorInterests || [])],
    tags: [...(settings?.tags || [])],
    lossReasons: [...(settings?.lossReasons || [])],
    origins: [...(settings?.origins || [])],
    browserNotifications: Boolean(settings?.notifications?.browser),
    overdueFollowUps: Boolean(settings?.notifications?.overdueFollowUps),
    dailyAgenda: Boolean(settings?.notifications?.dailyAgenda),
  };
}

function normalizeItems(items = []) {
  return Array.from(
    new Set(
      items
        .map((item) => String(item || "").trim())
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function SettingsGroupHeader({ eyebrow, title, description }) {
  return (
    <MDBox>
      <MDTypography variant="button" color="text" textTransform="uppercase" opacity={0.7}>
        {eyebrow}
      </MDTypography>
      <MDTypography variant="h5" fontWeight="medium" mt={0.5}>
        {title}
      </MDTypography>
      <MDTypography variant="body2" color="text" mt={0.5}>
        {description}
      </MDTypography>
    </MDBox>
  );
}

function ManagedListCard({
  title,
  description,
  items,
  draftValue,
  onDraftChange,
  onAdd,
  onRemove,
  placeholder,
  emptyState,
  addLabel,
  minItems,
  compactContent,
}) {
  return (
    <SectionCard
      title={title}
      description={description}
      action={
        <Chip
          label={`${items.length} ${items.length === 1 ? "item" : "itens"}`}
          size="small"
          variant="outlined"
          sx={
            compactContent
              ? {
                  height: 26,
                  "& .MuiChip-label": { fontSize: "0.72rem", px: 1.1 },
                }
              : undefined
          }
        />
      }
    >
      <MDBox display="grid" gap={2.25}>
        <MDBox display="flex" gap={1} flexWrap="wrap" alignItems="flex-start">
          <TextField
            fullWidth
            size="small"
            label={placeholder}
            value={draftValue}
            onChange={(event) => onDraftChange(event.target.value)}
            InputLabelProps={
              compactContent
                ? {
                    sx: {
                      fontSize: "0.8rem",
                    },
                  }
                : undefined
            }
            inputProps={
              compactContent
                ? {
                    style: {
                      fontSize: "0.85rem",
                    },
                  }
                : undefined
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAdd();
              }
            }}
            sx={
              compactContent
                ? {
                    minWidth: 0,
                    "& .MuiInputBase-root": {
                      fontSize: "0.85rem",
                    },
                  }
                : undefined
            }
          />
          <MDButton
            variant="gradient"
            color="warning"
            onClick={onAdd}
            sx={compactContent ? { px: 2, whiteSpace: "nowrap" } : undefined}
          >
            {addLabel}
          </MDButton>
        </MDBox>

        {items.length ? (
          <List
            sx={{
              px: 0.75,
              py: 0.5,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              maxHeight: 300,
              overflowY: "auto",
              overflowX: "hidden",
              scrollbarWidth: "thin",
              scrollbarColor: (theme) => `${theme.palette.warning.main} ${theme.palette.grey[200]}`,
              "&::-webkit-scrollbar": {
                width: 8,
              },
              "&::-webkit-scrollbar-track": {
                backgroundColor: (theme) => theme.palette.grey[200],
                borderRadius: 999,
              },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: (theme) => theme.palette.warning.main,
                borderRadius: 999,
                border: (theme) => `2px solid ${theme.palette.grey[200]}`,
              },
            }}
          >
            {items.map((item, index) => (
              <ListItem
                key={`${title}-${item}`}
                divider={index < items.length - 1}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 1.5,
                }}
              >
                <ListItemText
                  sx={{ flex: 1, minWidth: 0, my: 0 }}
                  primary={item}
                  primaryTypographyProps={{
                    sx: compactContent
                      ? {
                          fontSize: "0.8rem",
                          lineHeight: 1.45,
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                        }
                      : {
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                        },
                  }}
                />
                <IconButton
                  edge="end"
                  aria-label={`Excluir ${item}`}
                  onClick={() => onRemove(item)}
                  disabled={items.length <= minItems}
                  sx={{
                    flexShrink: 0,
                    alignSelf: "center",
                    color: (theme) => theme.palette.warning.main,
                    backgroundColor: (theme) => theme.palette.background.paper,
                    borderRadius: "50%",
                    "&:hover": {
                      backgroundColor: (theme) => theme.palette.action.hover,
                    },
                  }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </ListItem>
            ))}
          </List>
        ) : (
          <Alert severity="warning" sx={compactContent ? { fontSize: "0.82rem" } : undefined}>
            {emptyState}
          </Alert>
        )}
      </MDBox>
    </SectionCard>
  );
}

function ReadOnlyListCard({ title, description, items, emptyState, note, compactContent }) {
  return (
    <SectionCard
      title={title}
      description={description}
      action={
        <Chip
          label={`${items.length} ${items.length === 1 ? "item" : "itens"}`}
          size="small"
          variant="outlined"
          sx={{
            height: 26,
            "& .MuiChip-label": { fontSize: "0.72rem", px: 1.1 },
          }}
        />
      }
    >
      <MDBox display="grid" gap={2.25}>
        {items.length ? (
          <List
            sx={{
              px: 0.75,
              py: 0.5,
              border: (theme) => `1px solid ${theme.palette.divider}`,
              borderRadius: 2,
              maxHeight: 340,
              overflowY: "auto",
              overflowX: "hidden",
              scrollbarWidth: "thin",
              scrollbarColor: (theme) => `${theme.palette.warning.main} ${theme.palette.grey[200]}`,
              "&::-webkit-scrollbar": {
                width: 8,
              },
              "&::-webkit-scrollbar-track": {
                backgroundColor: (theme) => theme.palette.grey[200],
                borderRadius: 999,
              },
              "&::-webkit-scrollbar-thumb": {
                backgroundColor: (theme) => theme.palette.warning.main,
                borderRadius: 999,
                border: (theme) => `2px solid ${theme.palette.grey[200]}`,
              },
            }}
          >
            {items.map((item, index) => (
              <ListItem
                key={`${title}-${item}-${index}`}
                divider={index < items.length - 1}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 1.5,
                  py: 1.25,
                  borderRadius: 1.5,
                }}
              >
                <ListItemText
                  sx={{ flex: 1, minWidth: 0, my: 0 }}
                  primary={item}
                  primaryTypographyProps={{
                    sx: compactContent
                      ? {
                          fontSize: "0.8rem",
                          lineHeight: 1.45,
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                        }
                      : {
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                        },
                  }}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Alert severity="warning" sx={compactContent ? { fontSize: "0.82rem" } : undefined}>
            {emptyState}
          </Alert>
        )}

        {note ? (
          <MDTypography variant="caption" color="text">
            {note}
          </MDTypography>
        ) : null}
      </MDBox>
    </SectionCard>
  );
}

function Settings() {
  const { settings, updateSettings, resetSettings } = useCRM();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [form, setForm] = useState(() => createFormState(settings));
  const [drafts, setDrafts] = useState({
    pipelineStages: "",
    planTypes: "",
    operatorInterests: "",
    tags: "",
    lossReasons: "",
    origins: "",
  });

  useEffect(() => {
    setForm(createFormState(settings));
    setDrafts({
      pipelineStages: "",
      planTypes: "",
      operatorInterests: "",
      tags: "",
      lossReasons: "",
      origins: "",
    });
  }, [settings]);

  const roleLabels = useMemo(
    () =>
      ROLE_OPTIONS.reduce((accumulator, option) => {
        accumulator[option.value] = option.label;
        return accumulator;
      }, {}),
    []
  );

  const handleChange = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleDraftChange = (field) => (value) => {
    setDrafts((current) => ({ ...current, [field]: value }));
  };

  const handleAddListItem = (field, label) => {
    const nextItem = String(drafts[field] || "").trim();

    if (!nextItem) {
      return;
    }

    const alreadyExists = form[field].some(
      (item) => item.localeCompare(nextItem, "pt-BR", { sensitivity: "base" }) === 0
    );

    if (alreadyExists) {
      setMessageType("warning");
      setMessage(`${label} já está cadastrado(a).`);
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: [...current[field], nextItem],
    }));
    setDrafts((current) => ({ ...current, [field]: "" }));
    setMessage("");
  };

  const handleRemoveListItem = (field, item, minItems, messageText) => {
    if (form[field].length <= minItems) {
      setMessageType("warning");
      setMessage(messageText);
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: current[field].filter((currentItem) => currentItem !== item),
    }));
    setMessage("");
  };

  const handleSave = async () => {
    const result = await updateSettings({
      planTypes: normalizeItems(form.planTypes),
      operatorInterests: normalizeItems(form.operatorInterests),
      tags: normalizeItems(form.tags),
      brokerage: {
        name: form.brokerageName,
        cnpj: form.brokerageCnpj,
        city: form.brokerageCity,
        state: form.brokerageState,
        supportPhone: form.brokeragePhone,
        supportEmail: form.brokerageEmail,
      },
      notifications: {
        browser: form.browserNotifications,
        overdueFollowUps: form.overdueFollowUps,
        dailyAgenda: form.dailyAgenda,
      },
    });

    setMessageType(result.ok ? "success" : "warning");
    setMessage(result.ok ? "Configurações salvas com sucesso." : result.message);
  };

  const handleReset = async () => {
    const result = await resetSettings();
    setMessageType(result.ok ? "success" : "warning");
    setMessage(result.ok ? "Configurações restauradas para o padrão inicial." : result.message);
  };

  return (
    <PageShell
      title="Configurações"
      description="Gerencie operação, catálogo comercial e preferências do CRM com a mesma identidade visual do restante do sistema."
      primaryAction={<PageShellAction onClick={handleSave}>Salvar configurações</PageShellAction>}
      secondaryAction={
        <MDButton variant="outlined" color="dark" onClick={handleReset}>
          Restaurar padrão
        </MDButton>
      }
    >
      <Grid container spacing={3}>
        {message ? (
          <Grid item xs={12}>
            <Alert severity={messageType}>{message}</Alert>
          </Grid>
        ) : null}

        <Grid item xs={12}>
          <SettingsGroupHeader
            eyebrow="Operação do CRM"
            title="Base institucional e alertas"
            description="Mantenha os dados da corretora e as preferências de notificação organizados no mesmo nível visual das demais áreas administrativas."
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard
            title="Dados da corretora"
            description="Informações usadas no CRM e nos pontos de contato."
          >
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Nome da corretora"
                  value={form.brokerageName}
                  onChange={handleChange("brokerageName")}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="CNPJ"
                  value={form.brokerageCnpj}
                  onChange={handleChange("brokerageCnpj")}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Cidade"
                  value={form.brokerageCity}
                  onChange={handleChange("brokerageCity")}
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="UF"
                  value={form.brokerageState}
                  onChange={handleChange("brokerageState")}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Telefone de suporte"
                  value={form.brokeragePhone}
                  onChange={handleChange("brokeragePhone")}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="E-mail de suporte"
                  value={form.brokerageEmail}
                  onChange={handleChange("brokerageEmail")}
                />
              </Grid>
            </Grid>
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard
            title="Notificações"
            description="Preferências para agenda, follow-up e instalação PWA."
          >
            <MDBox display="grid" gap={1.5}>
              <MDBox px={2} py={1.5} borderRadius="lg" bgColor="light" display="grid" gap={0.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.browserNotifications}
                      onChange={handleChange("browserNotifications")}
                    />
                  }
                  label="Ativar notificações do navegador"
                />
                <MDTypography variant="caption" color="text">
                  Ideal para avisos imediatos sobre novos eventos no CRM.
                </MDTypography>
              </MDBox>
              <MDBox px={2} py={1.5} borderRadius="lg" bgColor="light" display="grid" gap={0.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.overdueFollowUps}
                      onChange={handleChange("overdueFollowUps")}
                    />
                  }
                  label="Avisar sobre follow-ups atrasados"
                />
                <MDTypography variant="caption" color="text">
                  Mantém a equipe atenta ao que já passou do prazo planejado.
                </MDTypography>
              </MDBox>
              <MDBox px={2} py={1.5} borderRadius="lg" bgColor="light" display="grid" gap={0.5}>
                <FormControlLabel
                  control={
                    <Switch checked={form.dailyAgenda} onChange={handleChange("dailyAgenda")} />
                  }
                  label="Enviar lembrete da agenda diária"
                />
                <MDTypography variant="caption" color="text">
                  Consolida a rotina do dia sem exigir consulta manual ao painel.
                </MDTypography>
              </MDBox>
            </MDBox>
          </SectionCard>
        </Grid>

        <Grid item xs={12}>
          <SettingsGroupHeader
            eyebrow="Catálogo comercial"
            title="Listas que alimentam o atendimento e o cadastro"
            description="As listas abaixo são usadas no CRM, no formulário de leads e no fluxo automático."
          />
        </Grid>

        <Grid item xs={12} lg={6}>
          <ManagedListCard
            title="Operadoras"
            description="Operadoras usadas no CRM e no fluxo automático."
            items={form.operatorInterests}
            draftValue={drafts.operatorInterests}
            onDraftChange={handleDraftChange("operatorInterests")}
            onAdd={() => handleAddListItem("operatorInterests", "Essa operadora")}
            onRemove={(item) =>
              handleRemoveListItem(
                "operatorInterests",
                item,
                1,
                "Mantenha ao menos uma operadora cadastrada."
              )
            }
            placeholder="Nova operadora"
            emptyState="Inclua ao menos uma operadora."
            addLabel="Incluir"
            minItems={1}
            compactContent
          />
        </Grid>

        <Grid item xs={12} lg={6}>
          <ManagedListCard
            title="Tipos de plano"
            description="Opções comerciais exibidas em cadastros e atendimentos."
            items={form.planTypes}
            draftValue={drafts.planTypes}
            onDraftChange={handleDraftChange("planTypes")}
            onAdd={() => handleAddListItem("planTypes", "Esse tipo de plano")}
            onRemove={(item) =>
              handleRemoveListItem(
                "planTypes",
                item,
                1,
                "Mantenha ao menos um tipo de plano cadastrado."
              )
            }
            placeholder="Novo tipo de plano"
            emptyState="Inclua ao menos um tipo de plano."
            addLabel="Adicionar"
            minItems={1}
            compactContent
          />
        </Grid>

        <Grid item xs={12} md={10} lg={8} sx={{ mx: "auto" }}>
          <ReadOnlyListCard
            title="Origens de leads"
            description="Canais fixos usados para classificar a captação comercial no CRM."
            items={form.origins}
            emptyState="Nenhuma origem ativa configurada para exibição."
            note="As origens seguem uma regra fixa do negócio e não são mais editadas por este painel."
            compactContent
          />
        </Grid>

        <Grid item xs={12}>
          <SettingsGroupHeader
            eyebrow="Estrutura interna"
            title="Padronização do fluxo comercial"
            description="Ajuste as listas que organizam pipeline, classificação interna e encerramento das oportunidades."
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <ReadOnlyListCard
            title="Etapas do funil"
            description="Sequência oficial das colunas usadas na pipeline comercial."
            items={form.pipelineStages.map((item) => item.name)}
            emptyState="Nenhuma etapa ativa configurada para exibição."
            note="A ordem mostrada aqui reflete diretamente a ordem das colunas da pipeline."
            compactContent
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <ReadOnlyListCard
            title="Motivos de perda"
            description="Razões padronizadas exibidas no CRM para encerramento sem venda."
            items={form.lossReasons}
            emptyState="Nenhum motivo de perda ativo configurado para exibição."
            note="Esse conjunto é mantido como regra operacional e está disponível apenas para consulta neste painel."
            compactContent
          />
        </Grid>

        <Grid item xs={12}>
          <SettingsGroupHeader
            eyebrow="Governança"
            title="Perfis e permissões"
            description="Consulta rápida do que cada papel pode fazer dentro do CRM."
          />
        </Grid>

        <Grid item xs={12}>
          <SectionCard
            title="Matriz de permissões"
            description="Comparação direta entre os papéis disponíveis no sistema."
          >
            <MDBox
              sx={{
                overflowX: "auto",
              }}
            >
              <MDBox
                sx={{
                  minWidth: 680,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <MDBox
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "minmax(260px, 2.4fr) repeat(3, minmax(110px, 1fr))",
                    alignItems: "stretch",
                    backgroundColor: (theme) => theme.palette.grey[100],
                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                  }}
                >
                  <MDBox px={2.5} py={1.75} display="flex" alignItems="center">
                    <MDTypography variant="button" fontWeight="medium" color="text">
                      Permissão
                    </MDTypography>
                  </MDBox>
                  {ROLE_OPTIONS.map((role) => (
                    <MDBox
                      key={role.value}
                      px={1.5}
                      py={1.75}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      textAlign="center"
                    >
                      <MDTypography
                        variant="button"
                        fontWeight="medium"
                        color="text"
                        sx={{
                          fontSize: "0.8rem",
                          lineHeight: 1.3,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {roleLabels[role.value]}
                      </MDTypography>
                    </MDBox>
                  ))}
                </MDBox>

                {ROLE_PERMISSIONS.map((permission, index) => (
                  <MDBox
                    key={permission.id}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "minmax(260px, 2.4fr) repeat(3, minmax(110px, 1fr))",
                      alignItems: "stretch",
                      borderBottom:
                        index < ROLE_PERMISSIONS.length - 1
                          ? (theme) => `1px solid ${theme.palette.divider}`
                          : "none",
                    }}
                  >
                    <MDBox px={2.5} py={1.75} display="flex" alignItems="center">
                      <MDTypography variant="button" fontWeight="regular">
                        {permission.title}
                      </MDTypography>
                    </MDBox>
                    {ROLE_OPTIONS.map((role) => (
                      <MDBox
                        key={`${permission.id}-${role.value}`}
                        px={1.5}
                        py={1.75}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        textAlign="center"
                      >
                        <MDTypography variant="button" color="text">
                          {permission[role.value] ? "Sim" : "--"}
                        </MDTypography>
                      </MDBox>
                    ))}
                  </MDBox>
                ))}
              </MDBox>
            </MDBox>
          </SectionCard>
        </Grid>

        <Grid item xs={12}>
          <MDBox
            display="flex"
            justifyContent="space-between"
            alignItems={{ xs: "stretch", md: "center" }}
            flexDirection={{ xs: "column", md: "row" }}
            gap={2}
            p={2.5}
            borderRadius="xl"
            bgColor="white"
            boxShadow="sm"
          >
            <MDBox>
              <MDTypography variant="h6">Pronto para salvar?</MDTypography>
              <MDTypography variant="body2" color="text">
                Revise as listas e confirme as alterações para refletir imediatamente no CRM.
              </MDTypography>
            </MDBox>
            <MDBox display="flex" gap={1} flexWrap="wrap">
              <MDButton variant="outlined" color="dark" onClick={handleReset}>
                Restaurar padrão
              </MDButton>
              <PageShellAction onClick={handleSave}>Salvar configurações</PageShellAction>
            </MDBox>
          </MDBox>
        </Grid>
      </Grid>
    </PageShell>
  );
}

SettingsGroupHeader.propTypes = {
  eyebrow: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
};

ManagedListCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
  draftValue: PropTypes.string.isRequired,
  onDraftChange: PropTypes.func.isRequired,
  onAdd: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  placeholder: PropTypes.string.isRequired,
  emptyState: PropTypes.string.isRequired,
  addLabel: PropTypes.string.isRequired,
  minItems: PropTypes.number.isRequired,
  compactContent: PropTypes.bool,
};

ReadOnlyListCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
  emptyState: PropTypes.string.isRequired,
  note: PropTypes.string,
  compactContent: PropTypes.bool,
};

ManagedListCard.defaultProps = {
  compactContent: false,
};

ReadOnlyListCard.defaultProps = {
  note: "",
  compactContent: false,
};

export default Settings;
