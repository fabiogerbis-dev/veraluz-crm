const { pool } = require("../db/pool");
const { verifyToken } = require("../utils/token");

function extractToken(req, { allowQueryToken = false } = {}) {
  const header = req.headers.authorization || "";
  const headerToken = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (headerToken) {
    return headerToken;
  }

  if (allowQueryToken && typeof req.query?.token === "string") {
    return req.query.token;
  }

  return "";
}

async function resolveAuthenticatedUser(req, { allowQueryToken = false } = {}) {
  const token = extractToken(req, { allowQueryToken });

  if (!token) {
    const error = new Error("Token de acesso não informado.");
    error.status = 401;
    throw error;
  }

  const payload = verifyToken(token);
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.active,
        u.only_own_leads,
        r.slug AS role
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [payload.userId]
  );

  const user = rows[0];

  if (!user || !user.active) {
    const error = new Error("Usuário inválido ou inativo.");
    error.status = 401;
    throw error;
  }

  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: user.role,
    onlyOwnLeads: Boolean(user.only_own_leads),
  };
}

async function authenticate(req, res, next) {
  try {
    req.user = await resolveAuthenticatedUser(req);
    return next();
  } catch (error) {
    const status = error.status || 401;
    const message = error.status ? error.message : "Token inválido ou expirado.";
    return res.status(status).json({ message });
  }
}

async function authenticateStream(req, res, next) {
  try {
    req.user = await resolveAuthenticatedUser(req, { allowQueryToken: true });
    return next();
  } catch (error) {
    const status = error.status || 401;
    const message = error.status ? error.message : "Token inválido ou expirado.";
    return res.status(status).json({ message });
  }
}

function requireRoles(...roles) {
  return function authorize(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    if (!roles.length || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ message: "Você não tem permissão para esta ação." });
  };
}

module.exports = {
  authenticate,
  authenticateStream,
  requireRoles,
  resolveAuthenticatedUser,
};
