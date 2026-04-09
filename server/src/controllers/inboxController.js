const inboxService = require("../services/inboxService");

async function listConversations(req, res) {
  const conversations = await inboxService.listConversations(req.user, req.query);
  return res.json({ conversations });
}

async function getConversation(req, res) {
  const conversation = await inboxService.getConversationById(req.params.id, req.user);
  return res.json({ conversation });
}

async function sendMessage(req, res) {
  const conversation = await inboxService.sendMessage(req.params.id, req.body, req.user);
  return res.status(201).json({ conversation });
}

async function listChannels(req, res) {
  const channels = await inboxService.listChannels();
  return res.json({ channels });
}

async function registerWebhooks(req, res) {
  const channels = await inboxService.registerWebhooks();
  return res.status(201).json({ channels });
}

module.exports = {
  getConversation,
  listChannels,
  listConversations,
  registerWebhooks,
  sendMessage,
};
