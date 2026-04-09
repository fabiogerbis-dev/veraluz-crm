import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { formatDateTime } from "utils/formatters";

function InboxMessageBubble({ message }) {
  const isMine = message.direction === "outbound";

  return (
    <MDBox
      alignSelf={isMine ? "flex-end" : "flex-start"}
      maxWidth={{ xs: "100%", md: "78%" }}
      px={2}
      py={1.5}
      borderRadius="xl"
      bgColor={isMine ? "success" : "light"}
      color={isMine ? "white" : "dark"}
      boxShadow="sm"
    >
      {message.body ? (
        <MDTypography variant="button" color="inherit" sx={{ whiteSpace: "pre-wrap" }}>
          {message.body}
        </MDTypography>
      ) : null}

      {message.mediaUrl ? (
        <MDBox mt={message.body ? 1.5 : 0}>
          <MDTypography
            component="a"
            href={message.mediaUrl}
            target="_blank"
            rel="noreferrer"
            variant="button"
            color={isMine ? "white" : "info"}
          >
            {message.fileName || "Abrir arquivo"}
          </MDTypography>
        </MDBox>
      ) : null}

      <MDBox
        mt={1}
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        gap={2}
        flexWrap="wrap"
      >
        <MDTypography variant="caption" color={isMine ? "white" : "text"}>
          {message.senderName || (isMine ? "CRM" : "Contato")}
        </MDTypography>
        <MDTypography variant="caption" color={isMine ? "white" : "text"}>
          {formatDateTime(message.sentAt || message.createdAt)}
          {message.status ? ` · ${message.status}` : ""}
        </MDTypography>
      </MDBox>
    </MDBox>
  );
}

InboxMessageBubble.propTypes = {
  message: PropTypes.shape({
    direction: PropTypes.string,
    body: PropTypes.string,
    mediaUrl: PropTypes.string,
    fileName: PropTypes.string,
    senderName: PropTypes.string,
    sentAt: PropTypes.string,
    createdAt: PropTypes.string,
    status: PropTypes.string,
  }).isRequired,
};

export default InboxMessageBubble;
