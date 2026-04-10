const userService = require("../services/userService");
const { broadcastCrmUpdate } = require("../services/realtimeService");

async function listUsers(req, res) {
  const users = await userService.listUsers();
  return res.json({ users });
}

async function createUser(req, res) {
  const { fullName, email, password, role } = req.body;

  if (!fullName || !email || !password || !role) {
    return res
      .status(400)
      .json({ message: "Nome, e-mail, senha e perfil de acesso são obrigatórios." });
  }

  const user = await userService.createUser(req.body);
  broadcastCrmUpdate({
    type: "user.created",
    resources: ["users", "dashboard"],
    entityId: user.id,
    actorUserId: req.user.id,
  });

  return res.status(201).json({ user });
}

async function updateUser(req, res) {
  const user = await userService.updateUser(req.params.id, req.body);
  broadcastCrmUpdate({
    type: "user.updated",
    resources: ["users", "dashboard"],
    entityId: user.id,
    actorUserId: req.user.id,
  });

  return res.json({ user });
}

async function toggleUserStatus(req, res) {
  const user = await userService.toggleUserStatus(req.params.id);
  broadcastCrmUpdate({
    type: "user.status_toggled",
    resources: ["users", "dashboard"],
    entityId: user.id,
    actorUserId: req.user.id,
  });

  return res.json({ user });
}

module.exports = {
  createUser,
  listUsers,
  toggleUserStatus,
  updateUser,
};
