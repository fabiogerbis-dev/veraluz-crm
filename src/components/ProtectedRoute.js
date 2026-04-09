import PropTypes from "prop-types";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "context/AuthContext";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

function ProtectedRoute({ children, roles }) {
  const { authReady, isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return (
      <MDBox minHeight="100vh" display="grid" placeItems="center" px={3}>
        <MDTypography variant="button" color="text">
          Carregando ambiente...
        </MDTypography>
      </MDBox>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/authentication/sign-in" state={{ from: location }} replace />;
  }

  if (roles.length && !hasRole(roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

ProtectedRoute.defaultProps = {
  roles: [],
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  roles: PropTypes.arrayOf(PropTypes.string),
};

export default ProtectedRoute;
