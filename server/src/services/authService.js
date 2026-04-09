const { pool } = require("../db/pool");
const { verifyPassword } = require("../utils/password");
const { signToken } = require("../utils/token");

function mapUserRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    city: row.city,
    state: row.state,
    active: Boolean(row.active),
    onlyOwnLeads: Boolean(row.only_own_leads),
    lastLoginAt: row.last_login_at,
  };
}

async function login(email, password) {
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.password_hash,
        u.phone,
        u.city,
        u.state,
        u.active,
        u.only_own_leads,
        u.last_login_at,
        r.slug AS role
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.email = ?
      LIMIT 1
    `,
    [email.trim().toLowerCase()]
  );

  const user = rows[0];

  if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
    const error = new Error("Credenciais inválidas.");
    error.status = 401;
    throw error;
  }

  await pool.query("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]);

  const token = signToken({
    userId: user.id,
    role: user.role,
  });

  return {
    token,
    user: mapUserRow({
      ...user,
      last_login_at: new Date(),
    }),
  };
}

async function getMe(userId) {
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.city,
        u.state,
        u.active,
        u.only_own_leads,
        u.last_login_at,
        r.slug AS role
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId]
  );

  if (!rows[0]) {
    const error = new Error("Usuário não encontrado.");
    error.status = 404;
    throw error;
  }

  return mapUserRow(rows[0]);
}

module.exports = {
  getMe,
  login,
};
