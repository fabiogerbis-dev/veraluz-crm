import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

function SectionCard({ title, description, action, children, noPadding }) {
  return (
    <Card sx={{ height: "100%" }}>
      <MDBox px={3} pt={3}>
        <MDBox
          display="flex"
          flexDirection={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          gap={1.5}
        >
          <MDBox maxWidth="42rem">
            <MDTypography variant="h6" lineHeight={1.35}>
              {title}
            </MDTypography>
            {description ? (
              <MDTypography variant="body2" color="text" lineHeight={1.6} mt={0.5}>
                {description}
              </MDTypography>
            ) : null}
          </MDBox>
          {action}
        </MDBox>
        <Divider sx={{ mt: 2, mb: 0 }} />
      </MDBox>
      <MDBox p={noPadding ? 0 : 3}>{children}</MDBox>
    </Card>
  );
}

SectionCard.defaultProps = {
  description: "",
  action: null,
  noPadding: false,
};

SectionCard.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  action: PropTypes.node,
  children: PropTypes.node.isRequired,
  noPadding: PropTypes.bool,
};

export default SectionCard;
