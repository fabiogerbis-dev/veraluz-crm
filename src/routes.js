import { lazy } from "react";
import DashboardRoundedIcon from "@mui/icons-material/DashboardRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import ManageAccountsRoundedIcon from "@mui/icons-material/ManageAccountsRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SupportAgentRoundedIcon from "@mui/icons-material/SupportAgentRounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import ViewKanbanRoundedIcon from "@mui/icons-material/ViewKanbanRounded";
import ProtectedRoute from "components/ProtectedRoute";

const Dashboard = lazy(() => import("layouts/dashboard"));
const Leads = lazy(() => import("layouts/leads"));
const LeadForm = lazy(() => import("layouts/lead-form"));
const LeadDetail = lazy(() => import("layouts/lead-detail"));
const Pipeline = lazy(() => import("layouts/pipeline"));
const PostSales = lazy(() => import("layouts/post-sales"));
const Tasks = lazy(() => import("layouts/tasks"));
const Inbox = lazy(() => import("layouts/inbox"));
const Integrations = lazy(() => import("layouts/integrations"));
const Reports = lazy(() => import("layouts/reports"));
const Users = lazy(() => import("layouts/users"));
const Settings = lazy(() => import("layouts/settings"));
const SignIn = lazy(() => import("layouts/authentication/sign-in"));
const RecoverPassword = lazy(() => import("layouts/authentication/reset-password/cover"));

const managementRoles = ["admin", "manager"];

const protect = (component, roles = []) => (
  <ProtectedRoute roles={roles}>{component}</ProtectedRoute>
);

const routes = [
  {
    type: "title",
    title: "Comercial",
    key: "group-comercial",
  },
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
    name: "Pós-venda",
    key: "post-sales",
    icon: <SupportAgentRoundedIcon fontSize="small" />,
    route: "/post-sales",
    component: protect(<PostSales />),
  },
  {
    type: "title",
    title: "Administração",
    key: "group-admin",
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
