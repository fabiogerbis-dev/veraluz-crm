const dashboardService = require("../services/dashboardService");

async function getSummary(req, res) {
  const summary = await dashboardService.getDashboardSummary(req.user);
  return res.json(summary);
}

module.exports = {
  getSummary,
};
