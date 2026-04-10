import PropTypes from "prop-types";
import MDBadge from "components/MDBadge";
import {
  ORIGIN_COLOR_MAP,
  STAGE_COLOR_MAP,
  STATUS_COLOR_MAP,
  TAG_COLOR_MAP,
  TEMPERATURE_COLOR_MAP,
} from "utils/crm";

const colorMaps = {
  origin: ORIGIN_COLOR_MAP,
  stage: STAGE_COLOR_MAP,
  status: STATUS_COLOR_MAP,
  tag: TAG_COLOR_MAP,
  temperature: TEMPERATURE_COLOR_MAP,
};

function StatusChip({ value, type }) {
  const color = colorMaps[type]?.[value] || "secondary";

  return (
    <MDBadge
      badgeContent={value || "--"}
      color={color}
      variant="gradient"
      size="sm"
      container
      sx={{ "& .MuiBadge-badge": { role: "status" } }}
      aria-label={`${type}: ${value || "não definido"}`}
    />
  );
}

StatusChip.propTypes = {
  value: PropTypes.string.isRequired,
  type: PropTypes.oneOf(["origin", "stage", "status", "tag", "temperature"]).isRequired,
};

export default StatusChip;
