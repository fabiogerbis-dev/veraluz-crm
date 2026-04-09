import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

function PageShell({ title, description, primaryAction, secondaryAction, children }) {
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox
          mb={4}
          display="flex"
          flexDirection={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
          gap={2}
        >
          <MDBox maxWidth="48rem">
            <MDTypography variant="h4" fontWeight="medium" lineHeight={1.3} mb={0.5}>
              {title}
            </MDTypography>
            {description ? (
              <MDTypography variant="body2" color="text" lineHeight={1.6}>
                {description}
              </MDTypography>
            ) : null}
          </MDBox>
          <MDBox display="flex" gap={1} flexWrap="wrap" alignItems="center">
            {secondaryAction}
            {primaryAction}
          </MDBox>
        </MDBox>
        {children}
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

PageShell.defaultProps = {
  description: "",
  primaryAction: null,
  secondaryAction: null,
};

PageShell.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  primaryAction: PropTypes.node,
  secondaryAction: PropTypes.node,
  children: PropTypes.node.isRequired,
};

export function PageShellAction({ children, ...rest }) {
  return (
    <MDButton variant="gradient" color="warning" {...rest}>
      {children}
    </MDButton>
  );
}

PageShellAction.propTypes = {
  children: PropTypes.node.isRequired,
};

export default PageShell;
