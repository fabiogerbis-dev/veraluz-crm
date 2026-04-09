import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

function EmptyState({ icon, title, description }) {
  return (
    <MDBox
      py={6}
      px={3}
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      textAlign="center"
    >
      <MDBox
        width="4rem"
        height="4rem"
        display="grid"
        placeItems="center"
        bgColor="light"
        borderRadius="xl"
        color="warning"
        mb={2}
      >
        <Icon fontSize="medium">{icon}</Icon>
      </MDBox>
      <MDTypography variant="h6" lineHeight={1.35}>
        {title}
      </MDTypography>
      <MDTypography variant="body2" color="text" lineHeight={1.6} maxWidth="28rem">
        {description}
      </MDTypography>
    </MDBox>
  );
}

EmptyState.propTypes = {
  icon: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
};

export default EmptyState;
