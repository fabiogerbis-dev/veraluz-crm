import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import EmptyState from "components/veraluz/EmptyState";
import MaskedInput from "components/veraluz/MaskedInput";
import PageShell, { PageShellAction } from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import { useAuth } from "context/AuthContext";
import { useCRM } from "context/CRMContext";
import {
  AGE_RANGE_OPTIONS,
  CONTRACT_OPTIONS,
  COPARTICIPATION_OPTIONS,
  COVERAGE_OPTIONS,
  LOSS_REASON_OPTIONS,
  OPERATOR_INTEREST_OPTIONS,
  ORIGIN_OPTIONS,
  PIPELINE_STAGES,
  PLAN_TYPE_OPTIONS,
  STATUS_OPTIONS,
  TAG_OPTIONS,
  TEMPERATURE_OPTIONS,
  URGENCY_OPTIONS,
} from "data/veraluzSeed";
import { getVisibleUsers } from "utils/crm";

function normalizeBeneficiariesCount(value, fallbackValue = 1) {
  const parsedValue = Number.parseInt(value, 10);

  if (Number.isInteger(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return fallbackValue;
}

function syncBeneficiaryAgeRanges(ageRanges = [], beneficiaries = 1) {
  const normalizedBeneficiaries = normalizeBeneficiariesCount(beneficiaries);

  if (normalizedBeneficiaries <= 1) {
    return [];
  }

  const normalizedAgeRanges = Array.isArray(ageRanges)
    ? ageRanges.map((item) => String(item || "")).slice(0, normalizedBeneficiaries)
    : [];

  while (normalizedAgeRanges.length < normalizedBeneficiaries) {
    normalizedAgeRanges.push("");
  }

  return normalizedAgeRanges;
}

function getInitialFormState(lead, currentUser) {
  const beneficiaries = normalizeBeneficiariesCount(lead?.beneficiaries, 1);

  if (lead) {
    return {
      fullName: lead.fullName || "",
      phone: lead.phone || "",
      email: lead.email || "",
      cpf: lead.cpf || "",
      city: lead.city || "",
      state: lead.state || "",
      neighborhood: lead.neighborhood || "",
      ageRange: lead.ageRange || "",
      beneficiaryAgeRanges: syncBeneficiaryAgeRanges(lead.beneficiaryAgeRanges, beneficiaries),
      beneficiaries,
      planType: lead.planType || "Individual",
      contractType: lead.contractType || "Primeiro plano",
      companyName: lead.companyName || "",
      cnpj: lead.cnpj || "",
      entityName: lead.entityName || "",
      hasActiveCnpj: Boolean(lead.hasActiveCnpj),
      hasActiveMei: Boolean(lead.hasActiveMei),
      operatorInterest: lead.operatorInterest || "",
      budgetRange: lead.budgetRange || "",
      coparticipation: lead.coparticipation || "",
      coverage: lead.coverage || "",
      urgency: lead.urgency || "Média",
      stage: lead.stage || "Novo lead",
      status: lead.status || "Novo lead",
      temperature: lead.temperature || "Frio",
      tags: lead.tags || [],
      ownerId: lead.ownerId || currentUser?.id || "",
      origin: lead.origin || "Cadastro manual",
      sourceCampaign: lead.sourceCampaign || "",
      notes: lead.notes || "",
      initialNotes: lead.initialNotes || "",
      hasWhatsapp: lead.hasWhatsapp ?? true,
      hasCurrentPlan: lead.hasCurrentPlan ?? false,
      currentPlan: lead.currentPlan || "",
      currentPlanExpiry: lead.currentPlanExpiry || "",
      nextContact: lead.nextContact || "",
      lossReason: lead.lossReason || "",
    };
  }

  return {
    fullName: "",
    phone: "",
    email: "",
    cpf: "",
    city: "",
    state: "",
    neighborhood: "",
    ageRange: "",
    beneficiaryAgeRanges: [],
    beneficiaries: 1,
    planType: "Individual",
    contractType: "Primeiro plano",
    companyName: "",
    cnpj: "",
    entityName: "",
    hasActiveCnpj: false,
    hasActiveMei: false,
    operatorInterest: "",
    budgetRange: "",
    coparticipation: "",
    coverage: "",
    urgency: "Média",
    stage: "Novo lead",
    status: "Novo lead",
    temperature: "Frio",
    tags: [],
    ownerId: currentUser?.id || "",
    origin: "Cadastro manual",
    sourceCampaign: "",
    notes: "",
    initialNotes: "",
    hasWhatsapp: true,
    hasCurrentPlan: false,
    currentPlan: "",
    currentPlanExpiry: "",
    nextContact: "",
    lossReason: "",
  };
}

function LeadForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  const { currentUser } = useAuth();
  const { users, settings, loading, getLeadById, fetchLeadById, createLead, updateLead } = useCRM();
  const lead = isEditing ? getLeadById(id) : null;
  const [form, setForm] = useState(() => getInitialFormState(lead, currentUser));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const todayDatetime = new Date().toISOString().slice(0, 16);

  const validateField = (field, value) => {
    const errors = {};
    if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.email = "E-mail inválido";
    }
    if (field === "phone" && value) {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 11) errors.phone = "Telefone inválido";
    }
    if (field === "cpf" && value) {
      const digits = value.replace(/\D/g, "");
      if (digits.length !== 11) errors.cpf = "CPF inválido";
    }
    if (field === "cnpj" && value) {
      const digits = value.replace(/\D/g, "");
      if (digits.length !== 14) errors.cnpj = "CNPJ inválido";
    }
    setFieldErrors((prev) => {
      const next = { ...prev, ...errors };
      if (!errors[field]) delete next[field];
      return next;
    });
  };

  const handleBlur = (field) => () => {
    validateField(field, form[field]);
  };

  const originOptions = settings.origins?.length ? settings.origins : ORIGIN_OPTIONS;
  const pipelineStageOptions = settings.pipelineStages?.length
    ? settings.pipelineStages
    : PIPELINE_STAGES;
  const planTypeOptions = settings.planTypes?.length ? settings.planTypes : PLAN_TYPE_OPTIONS;
  const operatorInterestOptions = settings.operatorInterests?.length
    ? settings.operatorInterests
    : OPERATOR_INTEREST_OPTIONS;
  const tagOptions = settings.tags?.length ? settings.tags : TAG_OPTIONS;
  const lossReasonOptions = settings.lossReasons?.length
    ? settings.lossReasons
    : LOSS_REASON_OPTIONS;

  const visibleUsers = useMemo(() => getVisibleUsers(users, currentUser), [users, currentUser]);
  const brokerOptions = visibleUsers
    .filter((user) => ["broker", "manager", "admin"].includes(user.role))
    .map((user) => ({
      label: user.name,
      value: user.id,
    }));
  const normalizedBeneficiaries = normalizeBeneficiariesCount(form.beneficiaries, 1);

  useEffect(() => {
    if (isEditing && !lead && !loading) {
      fetchLeadById(id);
    }
  }, [id, isEditing, lead, loading]);

  useEffect(() => {
    setForm(getInitialFormState(lead, currentUser));
  }, [currentUser, lead]);

  const handleChange = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => {
      if (field === "beneficiaries") {
        return {
          ...current,
          beneficiaries: value,
          beneficiaryAgeRanges: syncBeneficiaryAgeRanges(current.beneficiaryAgeRanges, value),
        };
      }

      return { ...current, [field]: value };
    });
  };

  const handleBeneficiaryAgeRangeChange = (index, value) => {
    setForm((current) => {
      const nextAgeRanges = syncBeneficiaryAgeRanges(
        current.beneficiaryAgeRanges,
        current.beneficiaries
      );

      nextAgeRanges[index] = value || "";

      return {
        ...current,
        beneficiaryAgeRanges: nextAgeRanges,
      };
    });
  };

  const handleSubmit = async (event) => {
    if (event?.preventDefault) {
      event.preventDefault();
    }

    setSaving(true);
    setError("");

    const payload = {
      ...form,
      beneficiaryAgeRanges: normalizedBeneficiaries > 1 ? form.beneficiaryAgeRanges : [],
      beneficiaries: normalizedBeneficiaries,
      lossReason: form.stage === "Perdido" ? form.lossReason : "",
    };

    const result = isEditing ? await updateLead(id, payload) : await createLead(payload);

    if (!result.ok) {
      setSaving(false);
      setError(
        result.message ||
          (result.duplicateLead
            ? `Lead duplicado encontrado: ${result.duplicateLead.fullName}.`
            : "Não foi possível salvar o lead.")
      );
      return;
    }

    navigate(`/leads/${result.lead.id}`, { replace: true });
  };

  if (loading && isEditing && !lead) {
    return (
      <PageShell title="Carregando lead" description="Buscando os dados mais recentes do cadastro.">
        <EmptyState
          icon="hourglass_top"
          title="Carregando lead"
          description="Aguarde enquanto o CRM busca as informações do cadastro."
        />
      </PageShell>
    );
  }

  if (isEditing && !lead) {
    return (
      <PageShell
        title="Lead não encontrado"
        description="Esse cadastro não está disponível na base atual."
      >
        <EmptyState
          icon="person_off"
          title="Lead não encontrado"
          description="Volte para a listagem e selecione outro lead."
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={isEditing ? "Editar lead" : "Novo lead"}
      description="Cadastro comercial completo para qualificar e acompanhar a oportunidade."
      primaryAction={
        <PageShellAction
          onClick={handleSubmit}
          startIcon={<span className="material-icons">save</span>}
        >
          {saving ? "Salvando..." : "Salvar lead"}
        </PageShellAction>
      }
      secondaryAction={
        <MDButton
          component={Link}
          to={isEditing ? `/leads/${id}` : "/leads"}
          variant="outlined"
          color="dark"
        >
          Cancelar
        </MDButton>
      }
    >
      <MDBox component="form" onSubmit={handleSubmit}>
        {error ? (
          <Snackbar
            open={!!error}
            autoHideDuration={6000}
            onClose={() => setError("")}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert severity="error" onClose={() => setError("")}>
              {error}
            </Alert>
          </Snackbar>
        ) : null}

        <Grid container spacing={3}>
          <Grid item xs={12} lg={7}>
            <SectionCard
              title="Dados pessoais"
              description="Informações principais do lead e dados de contato."
            >
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Nome completo"
                    value={form.fullName}
                    onChange={handleChange("fullName")}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <MaskedInput
                    maskType="phone"
                    fullWidth
                    size="small"
                    label="Telefone / WhatsApp"
                    value={form.phone}
                    onChange={handleChange("phone")}
                    onBlur={handleBlur("phone")}
                    error={!!fieldErrors.phone}
                    helperText={fieldErrors.phone}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="E-mail"
                    value={form.email}
                    onChange={handleChange("email")}
                    onBlur={handleBlur("email")}
                    error={!!fieldErrors.email}
                    helperText={fieldErrors.email}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <MaskedInput
                    maskType="cpf"
                    fullWidth
                    size="small"
                    label="CPF"
                    value={form.cpf}
                    onChange={handleChange("cpf")}
                    onBlur={handleBlur("cpf")}
                    error={!!fieldErrors.cpf}
                    helperText={fieldErrors.cpf}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Cidade"
                    value={form.city}
                    onChange={handleChange("city")}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="UF"
                    value={form.state}
                    onChange={handleChange("state")}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Bairro"
                    value={form.neighborhood}
                    onChange={handleChange("neighborhood")}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Autocomplete
                    options={AGE_RANGE_OPTIONS}
                    value={form.ageRange}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, ageRange: value || "" }))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={
                          normalizedBeneficiaries > 1 ? "Faixa etária principal" : "Faixa etária"
                        }
                        size="small"
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    type="number"
                    fullWidth
                    size="small"
                    label="Quantidade de vidas"
                    value={form.beneficiaries}
                    onChange={handleChange("beneficiaries")}
                  />
                </Grid>
                {normalizedBeneficiaries > 1 ? (
                  <Grid item xs={12}>
                    <MDBox mt={0.5} p={2} borderRadius="lg" bgColor="light" display="grid" gap={2}>
                      <MDBox>
                        <MDTypography variant="button" fontWeight="medium" display="block">
                          Faixas etárias por vida
                        </MDTypography>
                        <MDTypography variant="caption" color="text">
                          Preencha cada beneficiário para manter o cadastro manual equivalente ao
                          fluxo automático de qualificação.
                        </MDTypography>
                      </MDBox>
                      <Grid container spacing={2}>
                        {Array.from({ length: normalizedBeneficiaries }, (_, index) => (
                          <Grid item xs={12} md={6} key={`beneficiary-age-range-${index + 1}`}>
                            <Autocomplete
                              options={AGE_RANGE_OPTIONS}
                              value={form.beneficiaryAgeRanges[index] || ""}
                              onChange={(_, value) => handleBeneficiaryAgeRangeChange(index, value)}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label={`Faixa etária da vida ${index + 1}`}
                                  size="small"
                                />
                              )}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </MDBox>
                  </Grid>
                ) : null}
              </Grid>
            </SectionCard>
          </Grid>

          <Grid item xs={12} lg={5}>
            <SectionCard
              title="Origem e distribuição"
              description="Canal de entrada, corretor responsável e prioridade comercial."
            >
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Autocomplete
                    options={originOptions}
                    value={form.origin}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, origin: value || "" }))
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Origem do lead" size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Origem / campanha"
                    value={form.sourceCampaign}
                    onChange={handleChange("sourceCampaign")}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    options={brokerOptions}
                    value={brokerOptions.find((option) => option.value === form.ownerId) || null}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, ownerId: value?.value || "" }))
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Responsável" size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={TEMPERATURE_OPTIONS}
                    value={form.temperature}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, temperature: value || "" }))
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Temperatura" size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={STATUS_OPTIONS}
                    value={form.status}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, status: value || "" }))
                    }
                    renderInput={(params) => <TextField {...params} label="Status" size="small" />}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    options={pipelineStageOptions}
                    value={form.stage}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, stage: value || "" }))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Etapa do funil"
                        size="small"
                        helperText="Ex.: Novo lead, Em contato, Proposta enviada ou Fechado."
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Próximo contato"
                    type="datetime-local"
                    value={form.nextContact ? form.nextContact.slice(0, 16) : ""}
                    onChange={handleChange("nextContact")}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: todayDatetime }}
                  />
                </Grid>
                {form.stage === "Perdido" ? (
                  <Grid item xs={12}>
                    <Autocomplete
                      options={lossReasonOptions}
                      value={form.lossReason}
                      onChange={(_, value) =>
                        setForm((current) => ({ ...current, lossReason: value || "" }))
                      }
                      renderInput={(params) => (
                        <TextField {...params} label="Motivo da perda" size="small" />
                      )}
                    />
                  </Grid>
                ) : null}
              </Grid>
            </SectionCard>
          </Grid>

          <Grid item xs={12} lg={7}>
            <SectionCard
              title="Interesse comercial"
              description="Campos principais do nicho de planos de saúde."
            >
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={planTypeOptions}
                    value={form.planType}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, planType: value || "" }))
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Tipo de plano" size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={CONTRACT_OPTIONS}
                    value={form.contractType}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, contractType: value || "" }))
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Tipo de contratação" size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    freeSolo
                    options={operatorInterestOptions}
                    value={form.operatorInterest}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, operatorInterest: value || "" }))
                    }
                    onInputChange={(_, value, reason) => {
                      if (reason === "input") {
                        setForm((current) => ({ ...current, operatorInterest: value || "" }));
                      }
                    }}
                    renderInput={(params) => (
                      <TextField {...params} label="Operadora de interesse" size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Faixa de orçamento"
                    value={form.budgetRange}
                    onChange={handleChange("budgetRange")}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={COPARTICIPATION_OPTIONS}
                    value={form.coparticipation}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, coparticipation: value || "" }))
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Coparticipação" size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={COVERAGE_OPTIONS}
                    value={form.coverage}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, coverage: value || "" }))
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Cobertura" size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={URGENCY_OPTIONS}
                    value={form.urgency}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, urgency: value || "" }))
                    }
                    renderInput={(params) => (
                      <TextField {...params} label="Urgência" size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(form.hasCurrentPlan)}
                        onChange={handleChange("hasCurrentPlan")}
                      />
                    }
                    label="Possui plano atual"
                  />
                </Grid>
                {form.hasCurrentPlan ? (
                  <>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Plano atual"
                        value={form.currentPlan}
                        onChange={handleChange("currentPlan")}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Vencimento do plano atual"
                        value={form.currentPlanExpiry ? form.currentPlanExpiry.slice(0, 10) : ""}
                        onChange={handleChange("currentPlanExpiry")}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                  </>
                ) : null}
              </Grid>
            </SectionCard>
          </Grid>

          <Grid item xs={12} lg={5}>
            <SectionCard
              title="Empresa, MEI e entidade"
              description="Campos complementares para PJ, MEI e vínculo sindical."
            >
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Nome da empresa"
                    value={form.companyName}
                    onChange={handleChange("companyName")}
                  />
                </Grid>
                <Grid item xs={12}>
                  <MaskedInput
                    maskType="cnpj"
                    fullWidth
                    size="small"
                    label="CNPJ"
                    value={form.cnpj}
                    onChange={handleChange("cnpj")}
                    onBlur={handleBlur("cnpj")}
                    error={!!fieldErrors.cnpj}
                    helperText={fieldErrors.cnpj}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Entidade / sindicato"
                    value={form.entityName}
                    onChange={handleChange("entityName")}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    freeSolo
                    options={tagOptions}
                    value={form.tags}
                    onChange={(_, value) => setForm((current) => ({ ...current, tags: value }))}
                    renderInput={(params) => <TextField {...params} label="Tags" size="small" />}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(form.hasWhatsapp)}
                        onChange={handleChange("hasWhatsapp")}
                      />
                    }
                    label="Telefone com WhatsApp"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(form.hasActiveCnpj)}
                        onChange={handleChange("hasActiveCnpj")}
                      />
                    }
                    label="Empresa com CNPJ ativo"
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={Boolean(form.hasActiveMei)}
                        onChange={handleChange("hasActiveMei")}
                      />
                    }
                    label="MEI ativo"
                  />
                </Grid>
              </Grid>
            </SectionCard>
          </Grid>

          <Grid item xs={12}>
            <SectionCard
              title="Observações"
              description="Notas internas, qualificação e contexto do atendimento."
            >
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={5}
                    label="Observações iniciais"
                    value={form.initialNotes}
                    onChange={handleChange("initialNotes")}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={5}
                    label="Observações internas"
                    value={form.notes}
                    onChange={handleChange("notes")}
                  />
                </Grid>
              </Grid>
            </SectionCard>
          </Grid>
        </Grid>
      </MDBox>
    </PageShell>
  );
}

export default LeadForm;
