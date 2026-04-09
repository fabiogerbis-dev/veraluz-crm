const { listLeads } = require("./leadService");

function escapeCsv(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function exportLeadsCsv(filters, user) {
  const leads = await listLeads(filters, user);
  const lines = [
    [
      "Lead",
      "Telefone",
      "Email",
      "Origem",
      "Plano",
      "Vidas",
      "Corretor",
      "Etapa",
      "Status",
      "Temperatura",
      "Próximo contato",
      "Criado em",
    ],
    ...leads.map((lead) => [
      lead.fullName,
      lead.phone,
      lead.email,
      lead.origin,
      lead.planType,
      lead.beneficiaries,
      lead.ownerName,
      lead.pipelineStage,
      lead.status,
      lead.temperature,
      lead.nextContactAt,
      lead.createdAt,
    ]),
  ];

  return lines.map((line) => line.map(escapeCsv).join(",")).join("\n");
}

module.exports = {
  exportLeadsCsv,
};
