const taskService = require("../services/taskService");

async function listTasks(req, res) {
  const tasks = await taskService.listTasks(req.query, req.user);
  return res.json({ tasks });
}

module.exports = {
  listTasks,
};
