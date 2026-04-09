const settingsService = require("../services/settingsService");
const { broadcastCrmUpdate } = require("../services/realtimeService");

async function getSettings(req, res) {
  const settings = await settingsService.getSettings();
  return res.json({ settings });
}

async function updateSettings(req, res) {
  const settings = await settingsService.updateSettings(req.body || {});
  broadcastCrmUpdate({
    type: "settings.updated",
    resources: ["settings", "dashboard", "leads", "tasks"],
    actorUserId: req.user.id,
  });

  return res.json({ settings });
}

module.exports = {
  getSettings,
  updateSettings,
};
