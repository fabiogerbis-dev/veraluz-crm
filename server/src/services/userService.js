const { pool } = require("../db/pool");
const { hashPassword } = require("../utils/password");

async function listUsers() {
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
        r.slug AS role,
        r.label AS role_label
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      ORDER BY u.full_name ASC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    state: row.state,
    active: Boolean(row.active),
    onlyOwnLeads: Boolean(row.only_own_leads),
    lastLoginAt: row.last_login_at,
    role: row.role,
    roleLabel: row.role_label,
  }));
}

async function createUser(payload) {
  const [roleRows] = await pool.query("SELECT id FROM roles WHERE slug = ? LIMIT 1", [payload.role]);

  if (!roleRows[0]) {
    const error = new Error("Perfil de acesso inválido.");
    error.status = 400;
    throw error;
  }

  const [existingRows] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
    payload.email.toLowerCase(),
  ]);

  if (existingRows[0]) {
    const error = new Error("Já existe um usuário com este e-mail.");
    error.status = 409;
    throw error;
  }

  const passwordHash = hashPassword(payload.password);
  const [result] = await pool.query(
    `
      INSERT INTO users (role_id, full_name, email, password_hash, phone, city, state, active, only_own_leads)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `,
    [
      roleRows[0].id,
      payload.fullName,
      payload.email.toLowerCase(),
      passwordHash,
      payload.phone || null,
      payload.city || null,
      payload.state || null,
      payload.onlyOwnLeads ? 1 : 0,
    ]
  );

  const [rows] = await pool.query(
    `
      SELECT u.id, u.full_name, u.email, u.phone, u.city, u.state, u.active, u.only_own_leads, r.slug AS role, r.label AS role_label
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [result.insertId]
  );

  return {
    id: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    phone: rows[0].phone,
    city: rows[0].city,
    state: rows[0].state,
    active: Boolean(rows[0].active),
    onlyOwnLeads: Boolean(rows[0].only_own_leads),
    role: rows[0].role,
    roleLabel: rows[0].role_label,
  };
}

async function updateUser(userId, payload) {
  const [existing] = await pool.query("SELECT id, email FROM users WHERE id = ? LIMIT 1", [userId]);

  if (!existing[0]) {
    const error = new Error("Usuário não encontrado.");
    error.status = 404;
    throw error;
  }

  if (payload.email) {
    const [dup] = await pool.query("SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1", [
      payload.email.toLowerCase(),
      userId,
    ]);

    if (dup[0]) {
      const error = new Error("Já existe outro usuário com este e-mail.");
      error.status = 409;
      throw error;
    }
  }

  let roleId;

  if (payload.role) {
    const [roleRows] = await pool.query("SELECT id FROM roles WHERE slug = ? LIMIT 1", [payload.role]);

    if (!roleRows[0]) {
      const error = new Error("Perfil de acesso inválido.");
      error.status = 400;
      throw error;
    }

    roleId = roleRows[0].id;
  }

  const fields = [];
  const values = [];

  if (payload.fullName !== undefined) {
    fields.push("full_name = ?");
    values.push(payload.fullName);
  }

  if (payload.email !== undefined) {
    fields.push("email = ?");
    values.push(payload.email.toLowerCase());
  }

  if (payload.phone !== undefined) {
    fields.push("phone = ?");
    values.push(payload.phone || null);
  }

  if (payload.city !== undefined) {
    fields.push("city = ?");
    values.push(payload.city || null);
  }

  if (payload.state !== undefined) {
    fields.push("state = ?");
    values.push(payload.state || null);
  }

  if (roleId !== undefined) {
    fields.push("role_id = ?");
    values.push(roleId);
  }

  if (payload.onlyOwnLeads !== undefined) {
    fields.push("only_own_leads = ?");
    values.push(payload.onlyOwnLeads ? 1 : 0);
  }

  if (payload.password) {
    fields.push("password_hash = ?");
    values.push(hashPassword(payload.password));
  }

  if (!fields.length) {
    const error = new Error("Nenhum campo para atualizar.");
    error.status = 400;
    throw error;
  }

  values.push(userId);
  await pool.query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);

  const [rows] = await pool.query(
    `
      SELECT u.id, u.full_name, u.email, u.phone, u.city, u.state, u.active, u.only_own_leads, r.slug AS role, r.label AS role_label
      FROM users u
      INNER JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId]
  );

  return {
    id: rows[0].id,
    fullName: rows[0].full_name,
    email: rows[0].email,
    phone: rows[0].phone,
    city: rows[0].city,
    state: rows[0].state,
    active: Boolean(rows[0].active),
    onlyOwnLeads: Boolean(rows[0].only_own_leads),
    role: rows[0].role,
    roleLabel: rows[0].role_label,
  };
}

async function toggleUserStatus(userId) {
  await pool.query("UPDATE users SET active = NOT active WHERE id = ?", [userId]);
  const [rows] = await pool.query("SELECT id, active FROM users WHERE id = ? LIMIT 1", [userId]);
  return rows[0];
}

module.exports = {
  createUser,
  listUsers,
  toggleUserStatus,
  updateUser,
};
