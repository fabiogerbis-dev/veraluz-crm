import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import MDButton from "components/MDButton";

function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: "1rem" }}>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: "0.875rem" }}>{message}</DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <MDButton variant="text" color="dark" onClick={onCancel}>
          Cancelar
        </MDButton>
        <MDButton variant="gradient" color="error" onClick={onConfirm}>
          {confirmLabel || "Confirmar"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

ConfirmDialog.defaultProps = {
  confirmLabel: "Confirmar",
};

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ConfirmDialog;
