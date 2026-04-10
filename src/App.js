import { useEffect, useMemo, useState, Suspense } from "react";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Skeleton from "@mui/material/Skeleton";
import rtlPlugin from "stylis-plugin-rtl";
import Sidenav from "examples/Sidenav";
import theme from "assets/theme";
import themeRTL from "assets/theme/theme-rtl";
import themeDark from "assets/theme-dark";
import themeDarkRTL from "assets/theme-dark/theme-rtl";
import routes from "routes";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useMaterialUIController, setMiniSidenav } from "context";
import { useAuth } from "context/AuthContext";
import { startAppVersionMonitor } from "services/appUpdateService";
import OfflineBanner from "components/veraluz/OfflineBanner";
import KeyboardShortcuts from "components/veraluz/KeyboardShortcuts";

export default function App() {
  const [controller, dispatch] = useMaterialUIController();
  const { authReady, isAuthenticated } = useAuth();
  const { miniSidenav, direction, layout, darkMode } = controller;
  const [onMouseEnter, setOnMouseEnter] = useState(false);
  const [rtlCache, setRtlCache] = useState(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useMemo(() => {
    const cacheRtl = createCache({
      key: "rtl",
      stylisPlugins: [rtlPlugin],
    });

    setRtlCache(cacheRtl);
  }, []);

  const handleOnMouseEnter = () => {
    if (miniSidenav && !onMouseEnter) {
      setMiniSidenav(dispatch, false);
      setOnMouseEnter(true);
    }
  };

  const handleOnMouseLeave = () => {
    if (onMouseEnter) {
      setMiniSidenav(dispatch, true);
      setOnMouseEnter(false);
    }
  };

  const shouldRenderDashboardShell =
    isAuthenticated && layout === "dashboard" && !pathname.startsWith("/authentication");

  useEffect(() => {
    document.body.setAttribute("dir", direction);
  }, [direction]);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
  }, [pathname]);

  useEffect(() => startAppVersionMonitor(), []);

  useEffect(() => {
    if (!isAuthenticated || !authReady) {
      return;
    }

    if (pathname === "/" || pathname.startsWith("/authentication")) {
      navigate("/dashboard", { replace: true });
    }
  }, [authReady, isAuthenticated, navigate, pathname]);

  const getRoutes = (allRoutes) =>
    allRoutes.map((route) => {
      if (route.collapse) {
        return getRoutes(route.collapse);
      }

      if (route.route) {
        return <Route exact path={route.route} element={route.component} key={route.key} />;
      }

      return null;
    });

  const shell = shouldRenderDashboardShell ? (
    <Sidenav routes={routes} onMouseEnter={handleOnMouseEnter} onMouseLeave={handleOnMouseLeave} />
  ) : null;

  const loadingScreen = (
    <MDBox minHeight="100vh" display="grid" placeItems="center" px={3}>
      <MDTypography variant="button" color="text">
        Carregando ambiente...
      </MDTypography>
    </MDBox>
  );

  const suspenseFallback = (
    <MDBox px={3} py={6}>
      <Skeleton variant="rounded" width="100%" height={48} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" width="60%" height={24} sx={{ mb: 4 }} />
      <Skeleton variant="rounded" width="100%" height={200} />
    </MDBox>
  );

  if (direction === "rtl") {
    return (
      <CacheProvider value={rtlCache}>
        <ThemeProvider theme={darkMode ? themeDarkRTL : themeRTL}>
          <CssBaseline />
          {!authReady ? (
            loadingScreen
          ) : (
            <>
              {shell}
              <OfflineBanner />
              <KeyboardShortcuts />
              <Suspense fallback={suspenseFallback}>
                <Routes>
                  {getRoutes(routes)}
                  <Route
                    path="*"
                    element={
                      <Navigate to={isAuthenticated ? "/dashboard" : "/authentication/sign-in"} />
                    }
                  />
                </Routes>
              </Suspense>
            </>
          )}
        </ThemeProvider>
      </CacheProvider>
    );
  }

  return (
    <ThemeProvider theme={darkMode ? themeDark : theme}>
      <CssBaseline />
      {!authReady ? (
        loadingScreen
      ) : (
        <>
          {shell}
          <OfflineBanner />
          <KeyboardShortcuts />
          <Suspense fallback={suspenseFallback}>
            <Routes>
              {getRoutes(routes)}
              <Route
                path="*"
                element={
                  <Navigate to={isAuthenticated ? "/dashboard" : "/authentication/sign-in"} />
                }
              />
            </Routes>
          </Suspense>
        </>
      )}
    </ThemeProvider>
  );
}
