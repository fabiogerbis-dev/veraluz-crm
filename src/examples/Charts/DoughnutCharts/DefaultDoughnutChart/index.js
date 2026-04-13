/**
=========================================================
* Material Dashboard 2  React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { cloneElement, isValidElement, useMemo } from "react";

// porp-types is a library for typechecking of props
import PropTypes from "prop-types";

// react-chartjs-2 components
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";

// @mui material components
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// DefaultDoughnutChart configurations
import configs from "examples/Charts/DoughnutCharts/DefaultDoughnutChart/configs";

ChartJS.register(ArcElement, Tooltip, Legend);

function DefaultDoughnutChart({ icon, title, description, height, chart }) {
  const { data, options, backgroundColors } = configs(
    chart.labels || [],
    chart.datasets || {},
    chart.cutout
  );
  const chartIcon = isValidElement(icon.component)
    ? cloneElement(icon.component, { fontSize: "medium" })
    : icon.component;

  const labels = chart.labels || [];
  const values = chart.datasets?.data || [];
  const total = values.reduce((sum, v) => sum + (v || 0), 0);

  // When all values are 0, show a gray placeholder ring
  const chartData =
    total === 0
      ? {
          labels: [],
          datasets: [
            {
              ...data.datasets[0],
              data: [1],
              backgroundColor: ["#e0e0e0"],
              borderWidth: 0,
            },
          ],
        }
      : data;

  const chartOptions =
    total === 0
      ? { ...options, plugins: { ...options.plugins, tooltip: { enabled: false } } }
      : options;

  const renderChart = (
    <MDBox py={2} pr={2} pl={icon.component ? 1 : 2}>
      {title || description ? (
        <MDBox display="flex" px={description ? 1 : 0} pt={description ? 1 : 0}>
          {icon.component && (
            <MDBox
              width="4rem"
              height="4rem"
              bgColor={icon.color || "dark"}
              variant="gradient"
              coloredShadow={icon.color || "dark"}
              borderRadius="xl"
              display="flex"
              justifyContent="center"
              alignItems="center"
              color="white"
              mt={-5}
              mr={2}
            >
              {typeof chartIcon === "string" ? (
                <Icon fontSize="medium">{chartIcon}</Icon>
              ) : (
                chartIcon
              )}
            </MDBox>
          )}
          <MDBox mt={icon.component ? -2 : 0}>
            {title && <MDTypography variant="h6">{title}</MDTypography>}
            <MDBox mb={2}>
              <MDTypography component="div" variant="body2" color="text" lineHeight={1.6}>
                {description}
              </MDTypography>
            </MDBox>
          </MDBox>
        </MDBox>
      ) : null}
      {useMemo(
        () => (
          <MDBox height={height}>
            <Doughnut data={chartData} options={chartOptions} redraw />
          </MDBox>
        ),
        [chart, height]
      )}
      {labels.length > 0 && (
        <MDBox px={2} pb={1} pt={1}>
          {labels.map((label, index) => {
            const value = values[index] || 0;
            const pct = total ? Math.round((value / total) * 100) : 0;
            return (
              <MDBox
                key={label}
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                mb={index < labels.length - 1 ? 0.75 : 0}
              >
                <MDBox display="flex" alignItems="center" gap={1}>
                  <MDBox
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: backgroundColors[index] || "#344767",
                      flexShrink: 0,
                    }}
                  />
                  <MDTypography variant="caption" color="text" fontWeight="regular">
                    {label}
                  </MDTypography>
                </MDBox>
                <MDTypography variant="caption" fontWeight="medium">
                  {value} ({pct}%)
                </MDTypography>
              </MDBox>
            );
          })}
        </MDBox>
      )}
    </MDBox>
  );

  return title || description ? <Card>{renderChart}</Card> : renderChart;
}

// Setting default values for the props of DefaultDoughnutChart
DefaultDoughnutChart.defaultProps = {
  icon: { color: "info", component: "" },
  title: "",
  description: "",
  height: "19.125rem",
};

// Typechecking props for the DefaultDoughnutChart
DefaultDoughnutChart.propTypes = {
  icon: PropTypes.shape({
    color: PropTypes.oneOf([
      "primary",
      "secondary",
      "info",
      "success",
      "warning",
      "error",
      "light",
      "dark",
    ]),
    component: PropTypes.node,
  }),
  title: PropTypes.string,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  chart: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.array, PropTypes.object])).isRequired,
};

export default DefaultDoughnutChart;
