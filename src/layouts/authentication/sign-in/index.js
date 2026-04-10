import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import MuiLink from "@mui/material/Link";
import Switch from "@mui/material/Switch";
import VisibilityOffRoundedIcon from "@mui/icons-material/VisibilityOffRounded";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import BasicLayout from "layouts/authentication/components/BasicLayout";
import { useAuth } from "context/AuthContext";
import brandLogo from "assets/images/brand/logo-veraluz.png";

const loginBackground = `${process.env.PUBLIC_URL}/fundologin.jpg`;
const brandGradient = "linear-gradient(135deg, #0f4c52 0%, #16666D 50%, #2a7f86 100%)";
const brandShadow = "0 14px 30px rgba(22, 102, 109, 0.24)";
const RECENT_EMAILS_STORAGE_KEY = "veraluz-crm-login-emails";

function readRecentEmails() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(RECENT_EMAILS_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];

    return Array.isArray(parsedValue) ? parsedValue.filter(Boolean) : [];
  } catch (error) {
    return [];
  }
}

function storeRecentEmail(email, currentEmails) {
  if (typeof window === "undefined") {
    return currentEmails;
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return currentEmails;
  }

  const nextEmails = [
    normalizedEmail,
    ...currentEmails.filter((item) => item !== normalizedEmail),
  ].slice(0, 5);

  window.localStorage.setItem(RECENT_EMAILS_STORAGE_KEY, JSON.stringify(nextEmails));

  return nextEmails;
}

function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [recentEmails, setRecentEmails] = useState(() => readRecentEmails());
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [values, setValues] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSetRememberMe = () => setRememberMe((current) => !current);
  const handleTogglePasswordVisibility = () => setShowPassword((current) => !current);
  const handleChange = (field) => (event) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const result = await login(values.email, values.password, rememberMe);

    if (!result.ok) {
      setSubmitting(false);
      setError(result.message);
      return;
    }

    setRecentEmails((current) => storeRecentEmail(values.email, current));
    const redirectTo = location.state?.from?.pathname || "/dashboard";
    navigate(redirectTo, { replace: true });
  };

  return (
    <BasicLayout image={loginBackground}>
      <>
        <Card>
          <MDBox
            borderRadius="lg"
            mx={2}
            mt={-3}
            p={2.5}
            mb={1}
            display="flex"
            justifyContent="center"
            alignItems="center"
            textAlign="center"
            sx={{
              backgroundImage: brandGradient,
              boxShadow: brandShadow,
            }}
          >
            <MDBox component="img" src={brandLogo} alt="Veraluz CRM" width="15rem" />
          </MDBox>
          <MDBox pt={4} pb={3} px={3}>
            <MDBox component="form" role="form" onSubmit={handleSubmit} autoComplete="off">
              {error ? (
                <MDBox mb={2}>
                  <Alert severity="error">{error}</Alert>
                </MDBox>
              ) : null}

              <MDBox mb={2}>
                <Autocomplete
                  freeSolo
                  options={recentEmails}
                  inputValue={values.email}
                  onInputChange={(_, newInputValue) =>
                    setValues((current) => ({ ...current, email: newInputValue }))
                  }
                  onChange={(_, newValue) =>
                    setValues((current) => ({
                      ...current,
                      email: typeof newValue === "string" ? newValue : newValue || "",
                    }))
                  }
                  renderInput={(params) => (
                    <MDInput
                      {...params}
                      type="email"
                      label="E-mail"
                      fullWidth
                      autoComplete="off"
                      InputProps={{
                        ...params.InputProps,
                      }}
                      inputProps={{
                        ...params.inputProps,
                        autoComplete: "off",
                      }}
                    />
                  )}
                />
              </MDBox>
              <MDBox mb={2}>
                <MDInput
                  type={showPassword ? "text" : "password"}
                  label="Senha"
                  fullWidth
                  value={values.password}
                  onChange={handleChange("password")}
                  autoComplete="off"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          onClick={handleTogglePasswordVisibility}
                          edge="end"
                          sx={{ color: "#16666D" }}
                        >
                          {showPassword ? <VisibilityOffRoundedIcon /> : <VisibilityRoundedIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </MDBox>

              <MDBox display="flex" alignItems="center" ml={-1}>
                <Switch checked={rememberMe} onChange={handleSetRememberMe} />
                <MDTypography
                  variant="button"
                  fontWeight="regular"
                  color="text"
                  onClick={handleSetRememberMe}
                  sx={{ cursor: "pointer", userSelect: "none", ml: -1 }}
                >
                  &nbsp;&nbsp;Manter conectado
                </MDTypography>
              </MDBox>
              <MDBox mt={4} mb={1}>
                <MDButton
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={submitting}
                  sx={{
                    backgroundImage: brandGradient,
                    color: "#fff",
                    boxShadow: brandShadow,
                    "&:hover": {
                      backgroundImage:
                        "linear-gradient(135deg, #0c4348 0%, #145c63 50%, #23777e 100%)",
                      boxShadow: "0 16px 32px rgba(22, 102, 109, 0.3)",
                    },
                    "&:disabled": {
                      color: "rgba(255, 255, 255, 0.72)",
                      backgroundImage: brandGradient,
                      opacity: 0.72,
                    },
                  }}
                >
                  entrar no CRM
                </MDButton>
              </MDBox>
              <MDBox mt={3} mb={1} textAlign="center">
                <MDTypography
                  component={Link}
                  to="/authentication/recover-password"
                  variant="button"
                  fontWeight="medium"
                  sx={{
                    textDecoration: "none",
                    backgroundImage: brandGradient,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  Recuperar senha
                </MDTypography>
              </MDBox>
            </MDBox>
          </MDBox>
        </Card>
        <MDBox
          sx={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 14,
            textAlign: "center",
            zIndex: 1200,
            px: 2,
          }}
        >
          <MDTypography
            variant="button"
            color="white"
            sx={{ textShadow: "0 2px 8px rgba(0,0,0,0.45)" }}
          >
            2026 Veraluz Planos De Saúde - Desenvolvido Por{" "}
            <MuiLink
              href="https://gerbistecnologia.online"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: "white", fontWeight: 600, textDecorationColor: "white" }}
            >
              Gerbis Tecnologia
            </MuiLink>
          </MDTypography>
        </MDBox>
      </>
    </BasicLayout>
  );
}

export default SignIn;
