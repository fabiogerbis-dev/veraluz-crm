import { useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import EmptyState from "components/veraluz/EmptyState";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import PageShell from "components/veraluz/PageShell";
import SectionCard from "components/veraluz/SectionCard";
import { useCRM } from "context/CRMContext";
import { DEFAULT_PASSWORD_HINT, ROLE_OPTIONS } from "data/veraluzSeed";
import { formatDateTime } from "utils/formatters";
import { getRoleLabel } from "utils/crm";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  city: "",
  password: DEFAULT_PASSWORD_HINT,
  role: "broker",
  onlyOwnLeads: true,
};

function Users() {
  const { users, createUser, updateUser, toggleUserStatus } = useCRM();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [snack, setSnack] = useState({ open: false, message: "", severity: "info" });
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM });

  const showSnack = (message, severity = "success") => setSnack({ open: true, message, severity });

  const handleChange = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleEditChange = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      showSnack("Preencha nome, e-mail e senha do usuário.", "warning");
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
      showSnack(result.message || "Não foi possível criar o usuário.", "error");
      return;
    }

    showSnack(`Usuário ${form.name} criado com sucesso.`);
    setForm({ ...EMPTY_FORM });
  };

  const handleToggleStatus = async (userId) => {
    const result = await toggleUserStatus(userId);

    if (!result.ok) {
      showSnack(result.message || "Não foi possível atualizar o usuário.", "error");
    }
  };

  const handleOpenEdit = (user) => {
    setEditForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      city: user.city || "",
      password: "",
      role: user.role || "broker",
      onlyOwnLeads: Boolean(user.onlyOwnLeads),
    });
    setEditingUser(user);
  };

  const handleCloseEdit = () => {
    setEditingUser(null);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name.trim() || !editForm.email.trim()) {
      showSnack("Nome e e-mail são obrigatórios.", "warning");
      return;
    }

    const result = await updateUser(editingUser.id, {
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone,
      city: editForm.city,
      role: editForm.role,
      onlyOwnLeads: editForm.onlyOwnLeads,
      password: editForm.password || undefined,
    });

    if (!result.ok) {
      showSnack(result.message || "Não foi possível atualizar o usuário.", "error");
      return;
    }

    showSnack(`Usuário ${editForm.name} atualizado com sucesso.`);
    setEditingUser(null);
  };

  return (
    <PageShell
      title="Usuários e acesso"
      description="Controle de perfis, corretores ativos e permissões da equipe."
    >
      <Grid container spacing={3}>
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
                  <MDButton type="submit" variant="gradient" color="brand" fullWidth>
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
                      <>
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEdit(user)}
                          sx={{ mr: 0.5 }}
                          aria-label={`Editar ${user.name}`}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                        <MDButton
                          size="small"
                          variant={user.active ? "outlined" : "gradient"}
                          color={user.active ? "dark" : "success"}
                          onClick={() => handleToggleStatus(user.id)}
                        >
                          {user.active ? "Desativar" : "Reativar"}
                        </MDButton>
                      </>
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

      <Dialog open={Boolean(editingUser)} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle>
          <MDTypography variant="h6">Editar usuário</MDTypography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Nome"
                value={editForm.name}
                onChange={handleEditChange("name")}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="E-mail"
                value={editForm.email}
                onChange={handleEditChange("email")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Telefone"
                value={editForm.phone}
                onChange={handleEditChange("phone")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Cidade"
                value={editForm.city}
                onChange={handleEditChange("city")}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={ROLE_OPTIONS}
                value={ROLE_OPTIONS.find((option) => option.value === editForm.role) || null}
                onChange={(_, value) =>
                  setEditForm((current) => ({ ...current, role: value?.value || "broker" }))
                }
                renderInput={(params) => <TextField {...params} label="Perfil" size="small" />}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                size="small"
                label="Nova senha (deixe em branco para manter)"
                type="password"
                value={editForm.password}
                onChange={handleEditChange("password")}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={editForm.onlyOwnLeads}
                    onChange={handleEditChange("onlyOwnLeads")}
                  />
                }
                label="Corretor vê apenas seus próprios leads"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <MDButton variant="outlined" color="dark" onClick={handleCloseEdit}>
            Cancelar
          </MDButton>
          <MDButton variant="gradient" color="brand" onClick={handleSaveEdit}>
            Salvar alterações
          </MDButton>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snack.severity}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          variant="filled"
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </PageShell>
  );
}

export default Users;
