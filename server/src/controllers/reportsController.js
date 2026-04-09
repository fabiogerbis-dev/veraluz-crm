const reportService = require("../services/reportService");

async function exportLeads(req, res) {
  const csv = await reportService.exportLeadsCsv(req.query, req.user);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="leads-veraluz.csv"');
  return res.send(csv);
}

module.exports = {
  exportLeads,
};
