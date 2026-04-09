import {
  LOSS_REASON_OPTIONS,
  ORIGIN_OPTIONS,
  PIPELINE_STAGES,
  PLAN_TYPE_OPTIONS,
  ROLE_OPTIONS,
  TEMPERATURE_OPTIONS,
} from "data/veraluzSeed";
import { normalizeCpf, normalizeEmail, normalizePhone, sameDay } from "utils/formatters";

export const STATUS_COLOR_MAP = {
  "Novo lead": "info",
  "Em contato": "warning",
  Qualificado: "success",
  "Cotação em andamento": "info",
  "Proposta enviada": "primary",
  "Aguardando retorno": "warning",
  "Em negociação": "warning",
  "Venda fechada": "success",
  Perdido: "error",
  "Pós-venda": "dark",
};

export const STAGE_COLOR_MAP = {
  "Novo lead": "info",
  "Em contato": "warning",
  Qualificado: "success",
  Cotação: "info",
  "Proposta enviada": "primary",
  Negociação: "warning",
  Fechado: "success",
  Perdido: "error",
  "Pós-venda": "dark",
};

export const ORIGIN_COLOR_MAP = {
  Site: "info",
  Instagram: "warning",
  Facebook: "primary",
  WhatsApp: "success",
  Indicação: "dark",
  "Cadastro manual": "secondary",
};

export const TEMPERATURE_COLOR_MAP = {
  Frio: "info",
  Morno: "warning",
  Quente: "error",
};

export const TAG_COLOR_MAP = {
  urgente: "error",
  retorno: "warning",
  mei: "info",
  familiar: "success",
  sindicato: "dark",
  "alto valor": "success",
  premium: "primary",
  concorrente: "warning",
  "cotação rápida": "info",
};

export function getRoleLabel(role) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label || role;
}

export function mapStageToStatus(stage) {
  const mapping = {
    Cotação: "Cotação em andamento",
    Negociação: "Em negociação",
    Fechado: "Venda fechada",
  };

  return mapping[stage] || stage;
}

export function isWonStage(stage) {
  return stage === "Fechado" || stage === "Pós-venda";
}

export function isFinalizedStage(stage) {
  return isWonStage(stage) || stage === "Perdido";
}

export function buildTimelineEntry({ title, description, icon = "info", color = "info", date }) {
  return {
    id: `timeline-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    title,
    description,
    icon,
    color,
    date: date || new Date().toISOString(),
  };
}

export function getVisibleLeads(leads, currentUser) {
  if (!currentUser) {
    return [];
  }

  if (currentUser.role === "broker" && currentUser.onlyOwnLeads) {
    return leads.filter((lead) => lead.ownerId === currentUser.id);
  }

  return leads;
}

export function getVisibleUsers(users, currentUser) {
  if (!currentUser) {
    return [];
  }

  if (currentUser.role === "broker") {
    return users.filter((user) => user.id === currentUser.id);
  }

  return users;
}

export function findDuplicateLead(leads, values, ignoredLeadId = "") {
  const normalizedPhone = normalizePhone(values.phone);
  const normalizedEmail = normalizeEmail(values.email);
  const normalizedCpf = normalizeCpf(values.cpf);

  return leads.find((lead) => {
    if (lead.id === ignoredLeadId) {
      return false;
    }

    return (
      (normalizedPhone && normalizePhone(lead.phone) === normalizedPhone) ||
      (normalizedEmail && normalizeEmail(lead.email) === normalizedEmail) ||
      (normalizedCpf && normalizeCpf(lead.cpf) === normalizedCpf)
    );
  });
}

export function deriveTasks(leads, users) {
  const now = new Date();

  return leads
    .flatMap((lead) =>
      (lead.tasks || []).map((task) => {
        const owner = users.find((user) => user.id === lead.ownerId);

        return {
          ...task,
          leadId: lead.id,
          leadName: lead.fullName,
          leadPhone: lead.phone,
          ownerId: lead.ownerId,
          ownerName: owner?.name || "Sem corretor",
          overdue: !task.completed && new Date(task.dueDate) < now,
          dueToday: !task.completed && sameDay(task.dueDate, now),
          stage: lead.stage,
        };
      })
    )
    .sort((left, right) => new Date(left.dueDate) - new Date(right.dueDate));
}

export function computeDashboardMetrics(leads, users) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const tasks = deriveTasks(leads, users);
  const brokers = users.filter((user) => user.role === "broker" && user.active);

  const totalLeads = leads.length;
  const newToday = leads.filter((lead) => sameDay(lead.createdAt, now)).length;
  const wonLeads = leads.filter((lead) => isWonStage(lead.stage));
  const lostLeads = leads.filter((lead) => lead.stage === "Perdido");
  const closedThisMonth = leads.filter((lead) => {
    if (!lead.closedAt || !isWonStage(lead.stage)) {
      return false;
    }

    const closedDate = new Date(lead.closedAt);
    return closedDate.getMonth() === month && closedDate.getFullYear() === year;
  }).length;

  const finalizedCount = wonLeads.length + lostLeads.length;
  const conversionRate = totalLeads ? Math.round((wonLeads.length / totalLeads) * 100) : 0;
  const lossRate = finalizedCount ? Math.round((lostLeads.length / finalizedCount) * 100) : 0;

  const firstResponseHours = leads
    .map((lead) => {
      const firstInteraction = [...(lead.interactions || [])].sort(
        (left, right) => new Date(left.date) - new Date(right.date)
      )[0];

      if (!firstInteraction) {
        return null;
      }

      return (new Date(firstInteraction.date) - new Date(lead.createdAt)) / 3600000;
    })
    .filter((value) => value !== null);

  const averageFirstResponseHours = firstResponseHours.length
    ? (
        firstResponseHours.reduce((sum, value) => sum + value, 0) / firstResponseHours.length
      ).toFixed(1)
    : "0.0";

  const closeDays = leads
    .filter((lead) => lead.closedAt && isWonStage(lead.stage))
    .map((lead) => (new Date(lead.closedAt) - new Date(lead.createdAt)) / 86400000);

  const averageCloseDays = closeDays.length
    ? (closeDays.reduce((sum, value) => sum + value, 0) / closeDays.length).toFixed(1)
    : "0.0";

  const leadsByOrigin = ORIGIN_OPTIONS.map((origin) => ({
    origin,
    total: leads.filter((lead) => lead.origin === origin).length,
  }));

  const leadsByPlanType = PLAN_TYPE_OPTIONS.map((planType) => ({
    planType,
    total: leads.filter((lead) => lead.planType === planType).length,
  }));

  const stageTotals = PIPELINE_STAGES.map((stage) => ({
    stage,
    total: leads.filter((lead) => lead.stage === stage).length,
  }));

  const temperatureTotals = TEMPERATURE_OPTIONS.map((temperature) => ({
    temperature,
    total: leads.filter((lead) => lead.temperature === temperature).length,
  }));

  const leadsByBroker = brokers.map((broker) => ({
    brokerId: broker.id,
    brokerName: broker.name,
    total: leads.filter((lead) => lead.ownerId === broker.id).length,
    won: leads.filter((lead) => lead.ownerId === broker.id && isWonStage(lead.stage)).length,
  }));

  const ranking = brokers
    .map((broker) => {
      const assigned = leads.filter((lead) => lead.ownerId === broker.id);
      const won = assigned.filter((lead) => isWonStage(lead.stage)).length;

      return {
        id: broker.id,
        name: broker.name,
        avatar: broker.avatar,
        totalAssigned: assigned.length,
        won,
        conversionRate: assigned.length ? Math.round((won / assigned.length) * 100) : 0,
      };
    })
    .sort(
      (left, right) =>
        right.won - left.won ||
        right.conversionRate - left.conversionRate ||
        right.totalAssigned - left.totalAssigned
    );

  const lossReasons = LOSS_REASON_OPTIONS.map((reason) => ({
    reason,
    total: leads.filter((lead) => lead.lossReason === reason).length,
  })).filter((item) => item.total > 0);

  return {
    totalLeads,
    newToday,
    closedThisMonth,
    conversionRate,
    lossRate,
    averageFirstResponseHours,
    averageCloseDays,
    leadsByOrigin,
    leadsByPlanType,
    leadsByBroker,
    stageTotals,
    temperatureTotals,
    ranking,
    lossReasons,
    tasks,
    overdueTasks: tasks.filter((task) => task.overdue),
    dueTodayTasks: tasks.filter((task) => task.dueToday),
    openTasks: tasks.filter((task) => !task.completed),
    recentLeads: [...leads]
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
      .slice(0, 5),
  };
}

export function serializeLeadsToCsv(leads, users) {
  const headers = [
    "Lead",
    "Telefone",
    "E-mail",
    "Origem",
    "Plano",
    "Vidas",
    "Corretor",
    "Etapa",
    "Status",
    "Temperatura",
    "Próximo contato",
    "Criado em",
  ];

  const rows = leads.map((lead) => {
    const owner = users.find((user) => user.id === lead.ownerId);

    return [
      lead.fullName,
      lead.phone,
      lead.email,
      lead.origin,
      lead.planType,
      lead.beneficiaries,
      owner?.name || "Sem corretor",
      lead.stage,
      lead.status,
      lead.temperature,
      lead.nextContact || "",
      lead.createdAt,
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
