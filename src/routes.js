import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import ViewKanbanRoundedIcon from "@mui/icons-material/ViewKanbanRounded";
import ProtectedRoute from "components/ProtectedRoute";
import Dashboard from "layouts/dashboard";
import Leads from "layouts/leads";
import LeadForm from "layouts/lead-form";
import LeadDetail from "layouts/lead-detail";
import Pipeline from "layouts/pipeline";
import Tasks from "layouts/tasks";
import Inbox from "layouts/inbox";
import Integrations from "layouts/integrations";
import Reports from "layouts/reports";
import Users from "layouts/users";
import Settings from "layouts/settings";
import SignIn from "layouts/authentication/sign-in";
import RecoverPassword from "layouts/authentication/reset-password/cover";

const managementRoles = ["admin", "manager"];

const protect = (component, roles = []) => (
  <ProtectedRoute roles={roles}>{component}</ProtectedRoute>
);

const routes = [
  {
    type: "collapse",
    name: "Dashboard",
    key: "dashboard",
    icon: <DashboardRoundedIcon fontSize="small" />,
    route: "/dashboard",
    component: protect(<Dashboard />),
  },
  {
    type: "collapse",
    name: "Leads",
    key: "leads",
    icon: <GroupsRoundedIcon fontSize="small" />,
    route: "/leads",
    component: protect(<Leads />),
  },
  {
    type: "collapse",
    name: "Atendimento",
    key: "inbox",
    icon: <ForumRoundedIcon fontSize="small" />,
    route: "/inbox",
    component: protect(<Inbox />),
  },
  {
    type: "collapse",
    name: "Pipeline",
    key: "pipeline",
    icon: <ViewKanbanRoundedIcon fontSize="small" />,
    route: "/pipeline",
    component: protect(<Pipeline />),
  },
  {
    type: "collapse",
    name: "Tarefas",
    key: "tasks",
    icon: <TaskAltRoundedIcon fontSize="small" />,
    route: "/tasks",
    component: protect(<Tasks />),
  },
  {
    type: "collapse",
    name: "Relatórios",
    key: "reports",
    icon: <InsightsRoundedIcon fontSize="small" />,
    route: "/reports",
    component: protect(<Reports />, managementRoles),
    roles: managementRoles,
  },
  {
    type: "collapse",
    name: "Usuários",
    key: "users",
    icon: <ManageAccountsRoundedIcon fontSize="small" />,
    route: "/users",
    component: protect(<Users />, managementRoles),
    roles: managementRoles,
  },
  {
    type: "collapse",
    name: "Integrações",
    key: "integrations",
    icon: <HubRoundedIcon fontSize="small" />,
    route: "/integrations",
    component: protect(<Integrations />, managementRoles),
    roles: managementRoles,
  },
  {
    type: "collapse",
    name: "Configurações",
    key: "settings",
    icon: <SettingsRoundedIcon fontSize="small" />,
    route: "/settings",
    component: protect(<Settings />, managementRoles),
    roles: managementRoles,
  },
  {
    type: "collapse",
    key: "lead-new",
    hidden: true,
    route: "/leads/new",
    component: protect(<LeadForm />),
  },
  {
    type: "collapse",
    key: "lead-detail",
    hidden: true,
    route: "/leads/:id",
    component: protect(<LeadDetail />),
  },
  {
    type: "collapse",
    key: "lead-edit",
    hidden: true,
    route: "/leads/:id/edit",
    component: protect(<LeadForm />),
  },
  {
    type: "collapse",
    key: "sign-in",
    hidden: true,
    route: "/authentication/sign-in",
    component: <SignIn />,
  },
  {
    type: "collapse",
    key: "recover-password",
    hidden: true,
    route: "/authentication/recover-password",
    component: <RecoverPassword />,
  },
];

export default routes;
