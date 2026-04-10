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

import { useEffect } from "react";
import { useLocation, NavLink } from "react-router-dom";
import PropTypes from "prop-types";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import Link from "@mui/material/Link";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import SidenavCollapse from "examples/Sidenav/SidenavCollapse";
import SidenavRoot from "examples/Sidenav/SidenavRoot";
import {
  useMaterialUIController,
  setMiniSidenav,
  setTransparentSidenav,
  setWhiteSidenav,
} from "context";
import { useAuth } from "context/AuthContext";
import brandLogo from "assets/images/brand/logo-veraluz.png";

function Sidenav({ routes, ...rest }) {
  const [controller, dispatch] = useMaterialUIController();
  const { hasRole } = useAuth();
  const { miniSidenav, transparentSidenav, whiteSidenav, darkMode } = controller;
  const location = useLocation();

  let textColor = "white";

  if (transparentSidenav || (whiteSidenav && !darkMode)) {
    textColor = "dark";
  } else if (whiteSidenav && darkMode) {
    textColor = "inherit";
  }

  const closeSidenav = (event) => {
    event?.stopPropagation?.();
    setMiniSidenav(dispatch, true);
  };

  useEffect(() => {
    function handleMiniSidenav() {
      setMiniSidenav(dispatch, window.innerWidth < 1200);
      setTransparentSidenav(dispatch, window.innerWidth < 1200 ? false : transparentSidenav);
      setWhiteSidenav(dispatch, window.innerWidth < 1200 ? false : whiteSidenav);
    }

    window.addEventListener("resize", handleMiniSidenav);
    handleMiniSidenav();

    return () => window.removeEventListener("resize", handleMiniSidenav);
  }, [dispatch, location, transparentSidenav, whiteSidenav]);

  const renderRoutes = routes.map(
    ({ type, name, icon, title, noCollapse, key, href, route, hidden, roles }) => {
      if (hidden || (roles?.length && !hasRole(roles))) {
        return null;
      }

      const isActive = route
        ? route === "/"
          ? location.pathname === route
          : location.pathname === route || location.pathname.startsWith(`${route}/`)
        : false;

      let returnValue;

      if (type === "collapse") {
        returnValue = href ? (
          <Link
            href={href}
            key={key}
            target="_blank"
            rel="noreferrer"
            sx={{ textDecoration: "none" }}
          >
            <SidenavCollapse name={name} icon={icon} active={isActive} noCollapse={noCollapse} />
          </Link>
        ) : (
          <NavLink key={key} to={route}>
            <SidenavCollapse name={name} icon={icon} active={isActive} />
          </NavLink>
        );
      } else if (type === "title") {
        returnValue = (
          <MDTypography
            key={key}
            color={textColor}
            display="block"
            variant="caption"
            fontWeight="bold"
            textTransform="uppercase"
            pl={3}
            mt={2}
            mb={1}
            ml={1}
          >
            {title}
          </MDTypography>
        );
      }

      return returnValue;
    }
  );

  return (
    <>
      <MDBox
        display={{ xs: miniSidenav ? "none" : "block", xl: "none" }}
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        onClick={closeSidenav}
        sx={{
          zIndex: 1199,
          backgroundColor: "rgba(15, 32, 34, 0.24)",
          backdropFilter: "blur(2px)",
        }}
      />
      <SidenavRoot
        {...rest}
        variant="permanent"
        ownerState={{ transparentSidenav, whiteSidenav, miniSidenav, darkMode }}
      >
        <MDBox pt={1.5} pb={0.5} px={2} position="relative">
          <IconButton
            aria-label="Fechar menu"
            onClick={closeSidenav}
            sx={{
              display: { xs: "inline-flex", xl: "none" },
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 2,
              color: (theme) => theme.palette.common.white,
            }}
          >
            <CloseRoundedIcon sx={{ fontSize: "2rem", fontWeight: "bold", lineHeight: 1 }} />
          </IconButton>
        </MDBox>
        <List
          sx={{
            pt: { xs: 2, xl: 1 },
            pb: { xs: 1, xl: 12 },
            mt: { xs: "4px", xl: 0 },
            flex: 1,
          }}
        >
          {renderRoutes}
        </List>
        <MDBox
          position={{ xs: "static", xl: "absolute" }}
          bottom={{ xl: 20 }}
          left={0}
          width="100%"
          px={0}
          pb={{ xs: 1.5, xl: 0 }}
          mt={{ xs: "auto", xl: 0 }}
          flexShrink={0}
          display="flex"
          justifyContent="center"
          sx={{ pointerEvents: "none" }}
        >
          <MDBox
            component="img"
            src={brandLogo}
            alt="Veraluz"
            sx={{
              width: miniSidenav ? "2.5rem" : "12rem",
              maxWidth: "100%",
              opacity: 0.95,
              transition: "width 200ms ease, opacity 200ms ease",
            }}
          />
        </MDBox>
      </SidenavRoot>
    </>
  );
}

Sidenav.propTypes = {
  routes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default Sidenav;
