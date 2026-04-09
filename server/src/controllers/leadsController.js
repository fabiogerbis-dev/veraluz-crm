const leadService = require("../services/leadService");
const { broadcastCrmUpdate } = require("../services/realtimeService");

async function listLeads(req, res) {
  const leads = await leadService.listLeads(req.query, req.user);
  return res.json({ leads });
}

async function getLead(req, res) {
  const lead = await leadService.getLeadById(req.params.id, req.user);
  return res.json({ lead });
}

async function createLead(req, res) {
  if (!req.body.fullName) {
    return res.status(400).json({ message: "Nome completo do lead é obrigatório." });
  }

  const lead = await leadService.createLead(req.body, req.user);
  broadcastCrmUpdate({
    type: "lead.created",
    resources: ["dashboard", "leads", "tasks"],
    entityId: lead.id,
    actorUserId: req.user.id,
  });

  return res.status(201).json({ lead });
}

async function updateLead(req, res) {
  const lead = await leadService.updateLead(req.params.id, req.body, req.user);
  broadcastCrmUpdate({
    type: "lead.updated",
    resources: ["dashboard", "leads", "tasks"],
    entityId: lead.id,
    actorUserId: req.user.id,
  });

  return res.json({ lead });
}

async function deleteLead(req, res) {
  const deletedLead = await leadService.deleteLead(req.params.id, req.user);
  broadcastCrmUpdate({
    type: "lead.deleted",
    resources: ["dashboard", "leads", "tasks", "inbox", "integrations"],
    entityId: deletedLead.id,
    actorUserId: req.user.id,
  });

  return res.json({ deletedLead });
}

async function moveLeadStage(req, res) {
  if (!req.body.pipelineStage) {
    return res.status(400).json({ message: "A etapa do funil é obrigatória." });
  }

  const lead = await leadService.moveLeadStage(req.params.id, req.body.pipelineStage, req.user);
  broadcastCrmUpdate({
    type: "lead.stage_moved",
    resources: ["dashboard", "leads", "tasks"],
    entityId: lead.id,
    actorUserId: req.user.id,
  });

  return res.json({ lead });
}

async function addInteraction(req, res) {
  if (!req.body.channel || !req.body.subject) {
    return res.status(400).json({ message: "Canal e assunto são obrigatórios." });
  }

  const lead = await leadService.addInteraction(req.params.id, req.body, req.user);
  broadcastCrmUpdate({
    type: "lead.interaction_added",
    resources: ["dashboard", "leads", "tasks"],
    entityId: lead.id,
    actorUserId: req.user.id,
  });

  return res.status(201).json({ lead });
}

async function addTask(req, res) {
  if (!req.body.title || !req.body.taskType || !req.body.dueAt) {
    return res
      .status(400)
      .json({ message: "Título, tipo e vencimento da tarefa são obrigatórios." });
  }

  const lead = await leadService.addTask(req.params.id, req.body, req.user);
  broadcastCrmUpdate({
    type: "lead.task_added",
    resources: ["dashboard", "leads", "tasks"],
    entityId: lead.id,
    actorUserId: req.user.id,
  });

  return res.status(201).json({ lead });
}

async function completeTask(req, res) {
  const lead = await leadService.completeTask(req.params.id, req.params.taskId, req.user);
  broadcastCrmUpdate({
    type: "lead.task_completed",
    resources: ["dashboard", "leads", "tasks"],
    entityId: lead.id,
    actorUserId: req.user.id,
    metadata: {
      taskId: req.params.taskId,
    },
  });

  return res.json({ lead });
}

async function addDocument(req, res) {
  const lead = await leadService.addDocument(req.params.id, req.body, req.file, req.user);
  broadcastCrmUpdate({
    type: "lead.document_added",
    resources: ["dashboard", "leads"],
    entityId: lead.id,
    actorUserId: req.user.id,
  });

  return res.status(201).json({ lead });
}

module.exports = {
  addDocument,
  addInteraction,
  addTask,
  completeTask,
  createLead,
  deleteLead,
  getLead,
  listLeads,
  moveLeadStage,
  updateLead,
};
