/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { Link } from "react-router-dom";
import PropTypes from "prop-types";
import { isValidElement } from "react";
import { Breadcrumbs as MuiBreadcrumbs } from "@mui/material";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

const segmentLabelMap = {
  dashboard: "Dashboard",
  leads: "Leads",
  new: "Novo lead",
  edit: "Editar lead",
  pipeline: "Pipeline",
  tasks: "Tarefas",
  inbox: "Atendimento",
  integrations: "Integrações",
  reports: "Relatórios",
  users: "Usuários",
  settings: "Configurações",
  authentication: "Autenticação",
  "recover-password": "Recuperar senha",
  "sign-in": "Entrar",
};

function formatSegmentLabel(value = "") {
  if (!value) {
    return "";
  }

  if (segmentLabelMap[value]) {
    return segmentLabelMap[value];
  }

  if (value.startsWith("lead-") || /^\d+$/.test(value)) {
    return "Detalhes do lead";
  }

  return value.replace(/-/g, " ");
}

function Breadcrumbs({ icon, title, route, light }) {
  const routes = route.slice(0, -1);
  const currentTitle = formatSegmentLabel(title);
  const homeIcon = isValidElement(icon) ? icon : <Icon>{icon}</Icon>;

  return (
    <MDBox mr={{ xs: 0, xl: 8 }} minWidth={0}>
      <MuiBreadcrumbs
        sx={{
          "& .MuiBreadcrumbs-separator": {
            color: ({ palette: { white, grey } }) => (light ? white.main : grey[600]),
          },
        }}
      >
        <Link to="/">
          <MDTypography
            component="span"
            variant="body2"
            color={light ? "white" : "dark"}
            opacity={light ? 0.8 : 0.5}
            sx={{ lineHeight: 1 }}
          >
            {homeIcon}
          </MDTypography>
        </Link>
        {routes.map((el) => (
          <Link to={`/${el}`} key={el}>
            <MDTypography
              component="span"
              variant="body2"
              fontWeight="regular"
              color={light ? "white" : "dark"}
              opacity={light ? 0.8 : 0.5}
              sx={{ lineHeight: 1.3 }}
            >
              {formatSegmentLabel(el)}
            </MDTypography>
          </Link>
        ))}
        <MDTypography
          variant="body2"
          fontWeight="regular"
          color={light ? "white" : "dark"}
          sx={{ lineHeight: 1.3 }}
        >
          {currentTitle}
        </MDTypography>
      </MuiBreadcrumbs>
      <MDTypography
        fontWeight="bold"
        variant="h6"
        color={light ? "white" : "dark"}
        lineHeight={1.25}
        sx={{ wordBreak: "break-word" }}
      >
        {currentTitle}
      </MDTypography>
    </MDBox>
  );
}

Breadcrumbs.defaultProps = {
  light: false,
};

Breadcrumbs.propTypes = {
  icon: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  route: PropTypes.oneOfType([PropTypes.string, PropTypes.array]).isRequired,
  light: PropTypes.bool,
};

export default Breadcrumbs;
