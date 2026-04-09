import { Link } from "react-router-dom";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import BasicLayout from "layouts/authentication/components/BasicLayout";

const loginBackground = `${process.env.PUBLIC_URL}/fundologin.jpg`;
const brandGradient = "linear-gradient(135deg, #0f4c52 0%, #16666D 50%, #2a7f86 100%)";
const brandShadow = "0 14px 30px rgba(22, 102, 109, 0.24)";

function RecoverPassword() {
  return (
    <BasicLayout image={loginBackground}>
      <Card>
        <MDBox pt={4} pb={3} px={3}>
          <MDBox
            borderRadius="lg"
            p={2.5}
            mb={3}
            textAlign="center"
            sx={{
              backgroundImage: brandGradient,
              boxShadow: brandShadow,
            }}
          >
            <MDTypography variant="h3" fontWeight="medium" color="white" mt={1}>
              Recuperacao de acesso
            </MDTypography>
            <MDTypography display="block" variant="button" color="white" my={1}>
              No momento a redefinicao de senha e feita manualmente pelo administrador do CRM
            </MDTypography>
          </MDBox>
          <MDBox component="form" role="form">
            <MDBox mb={4}>
              <MDInput type="email" label="E-mail" variant="standard" fullWidth />
            </MDBox>
            <MDTypography variant="caption" color="text" display="block" mb={2}>
              Informe o e-mail cadastrado e solicite a redefinicao para{" "}
              <MDTypography component="span" variant="caption" fontWeight="medium" color="dark">
                contato@veraluz.net.br
              </MDTypography>
              .
            </MDTypography>
            <MDBox mt={6} mb={1}>
              <MDButton
                component={Link}
                to="/authentication/sign-in"
                variant="contained"
                fullWidth
                sx={{
                  backgroundImage: brandGradient,
                  color: "#fff",
                  boxShadow: brandShadow,
                  "&:hover": {
                    backgroundImage:
                      "linear-gradient(135deg, #0c4348 0%, #145c63 50%, #23777e 100%)",
                    boxShadow: "0 16px 32px rgba(22, 102, 109, 0.3)",
                  },
                }}
              >
                voltar ao login
              </MDButton>
            </MDBox>
          </MDBox>
        </MDBox>
      </Card>
    </BasicLayout>
  );
}

export default RecoverPassword;
