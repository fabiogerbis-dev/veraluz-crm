const authService = require("../services/authService");

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "E-mail e senha são obrigatórios." });
  }

  const result = await authService.login(email, password);
  return res.json(result);
}

async function me(req, res) {
  const user = await authService.getMe(req.user.id);
  return res.json({ user });
}

module.exports = {
  login,
  me,
};
