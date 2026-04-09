import { useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import EmptyState from "components/veraluz/EmptyState";
import MDButton from "components/MDButton";
import PageShell from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import { useCRM } from "context/CRMContext";
import { DEFAULT_PASSWORD_HINT, ROLE_OPTIONS } from "data/veraluzSeed";
import { formatDateTime } from "utils/formatters";
import { getRoleLabel } from "utils/crm";

function Users() {
  const { users, createUser, toggleUserStatus } = useCRM();
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    password: DEFAULT_PASSWORD_HINT,
    role: "broker",
    onlyOwnLeads: true,
  });

  const handleChange = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setMessageType("warning");
      setMessage("Preencha nome, e-mail e senha do usuário.");
      return;
    }

    const result = await createUser({
      name: form.name,
      email: form.email,
      phone: form.phone,
      city: form.city,
      password: form.password,
      role: form.role,
      onlyOwnLeads: form.onlyOwnLeads,
    });

    if (!result.ok) {
      setMessageType("error");
      setMessage(result.message || "Não foi possível criar o usuário.");
      return;
    }

    setMessageType("success");
    setMessage(`Usuário ${form.name} criado com sucesso.`);
    setForm({
      name: "",
      email: "",
      phone: "",
      city: "",
      password: DEFAULT_PASSWORD_HINT,
      role: "broker",
      onlyOwnLeads: true,
    });
  };

  const handleToggleStatus = async (userId) => {
    const result = await toggleUserStatus(userId);

    if (!result.ok) {
      setMessageType("error");
      setMessage(result.message || "Não foi possível atualizar o usuário.");
      return;
    }

    setMessage("");
  };

  return (
    <PageShell
      title="Usuários e acesso"
      description="Controle de perfis, corretores ativos e permissões da equipe."
    >
      <Grid container spacing={3}>
        {message ? (
          <Grid item xs={12}>
            <Alert severity={messageType}>{message}</Alert>
          </Grid>
        ) : null}

        <Grid item xs={12} lg={5}>
          <SectionCard title="Novo usuário" description="Cadastro rápido com permissão inicial.">
            <form onSubmit={handleCreateUser}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Nome"
                    value={form.name}
                    onChange={handleChange("name")}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="E-mail"
                    value={form.email}
                    onChange={handleChange("email")}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Telefone"
                    value={form.phone}
                    onChange={handleChange("phone")}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Cidade"
                    value={form.city}
                    onChange={handleChange("city")}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={ROLE_OPTIONS}
                    value={ROLE_OPTIONS.find((option) => option.value === form.role) || null}
                    onChange={(_, value) =>
                      setForm((current) => ({ ...current, role: value?.value || "broker" }))
                    }
                    renderInput={(params) => <TextField {...params} label="Perfil" size="small" />}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Senha inicial"
                    value={form.password}
                    onChange={handleChange("password")}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch checked={form.onlyOwnLeads} onChange={handleChange("onlyOwnLeads")} />
                    }
                    label="Corretor vê apenas seus próprios leads"
                  />
                </Grid>
                <Grid item xs={12}>
                  <MDButton type="submit" variant="gradient" color="warning" fullWidth>
                    Criar usuário
                  </MDButton>
                </Grid>
              </Grid>
            </form>
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={7}>
          <SectionCard
            title="Equipe ativa"
            description="Status, perfil e último acesso da operação."
          >
            {users.length ? (
              <List sx={{ p: 0 }}>
                {users.map((user) => (
                  <ListItem
                    key={user.id}
                    disableGutters
                    divider
                    secondaryAction={
                      <MDButton
                        size="small"
                        variant={user.active ? "outlined" : "gradient"}
                        color={user.active ? "dark" : "success"}
                        onClick={() => handleToggleStatus(user.id)}
                      >
                        {user.active ? "Desativar" : "Reativar"}
                      </MDButton>
                    }
                  >
                    <ListItemText
                      primary={`${user.name} · ${getRoleLabel(user.role)}`}
                      secondary={`${user.email} · ${user.city || "Sem cidade"} · último acesso ${
                        user.lastLogin ? formatDateTime(user.lastLogin) : "não informado"
                      }`}
                    />
                  </ListItem>
                ))}
              </List>
            ) : (
              <EmptyState
                icon="manage_accounts"
                title="Nenhum usuário cadastrado"
                description="Cadastre usuários para organizar a operação comercial."
              />
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </PageShell>
  );
}

export default Users;
