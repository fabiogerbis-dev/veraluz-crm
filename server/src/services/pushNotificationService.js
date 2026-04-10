const webpush = require("web-push");
const { pool } = require("../db/pool");
const env = require("../config/env");

if (env.vapid.publicKey && env.vapid.privateKey) {
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
}

async function ensurePushSubscriptionsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      endpoint VARCHAR(500) NOT NULL,
      keys_p256dh VARCHAR(255) NOT NULL,
      keys_auth VARCHAR(255) NOT NULL,
      user_agent VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_push_subscriptions_endpoint (endpoint),
      KEY idx_push_subscriptions_user_id (user_id),
      CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
}

ensurePushSubscriptionsTable().catch((err) => {
  console.warn("[PUSH] Falha ao criar tabela push_subscriptions:", err.message);
});

async function saveSubscription(userId, subscription, userAgent = "") {
  const { endpoint, keys } = subscription;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    const error = new Error("Subscription inválida.");
    error.status = 400;
    throw error;
  }

  await pool.query(
    `
      INSERT INTO push_subscriptions (user_id, endpoint, keys_p256dh, keys_auth, user_agent)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id),
        keys_p256dh = VALUES(keys_p256dh),
        keys_auth = VALUES(keys_auth),
        user_agent = VALUES(user_agent),
        updated_at = NOW()
    `,
    [userId, endpoint, keys.p256dh, keys.auth, (userAgent || "").slice(0, 255)]
  );
}

async function removeSubscription(endpoint) {
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint = ?", [endpoint]);
}

async function removeSubscriptionsForUser(userId) {
  await pool.query("DELETE FROM push_subscriptions WHERE user_id = ?", [userId]);
}

async function getSubscriptionsForUser(userId) {
  const [rows] = await pool.query(
    "SELECT endpoint, keys_p256dh, keys_auth FROM push_subscriptions WHERE user_id = ?",
    [userId]
  );

  return rows.map((row) => ({
    endpoint: row.endpoint,
    keys: { p256dh: row.keys_p256dh, auth: row.keys_auth },
  }));
}

async function sendPushToUser(userId, payload) {
  const subscriptions = await getSubscriptionsForUser(userId);

  if (subscriptions.length === 0) {
    return;
  }

  const body = JSON.stringify(payload);

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, body, { TTL: 3600 });
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await removeSubscription(sub.endpoint).catch(() => {});
        }
        throw err;
      }
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  if (failed > 0) {
    console.warn(`[PUSH] userId=${userId}: ${succeeded} ok, ${failed} falhas`);
  }
}

async function notifyNewLeadAssigned(userId, { leadId, leadName, planType, urgency, channelLabel }) {
  const title = "Novo lead atribuído";
  const bodyText = [
    leadName || "Lead sem nome",
    planType ? `Plano: ${planType}` : "",
    urgency ? `Urgência: ${urgency}` : "",
    channelLabel ? `Via ${channelLabel}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  await sendPushToUser(userId, {
    title,
    body: bodyText,
    icon: "/logo192.png",
    badge: "/favicon.png",
    tag: "new-lead",
    data: { type: "new_lead", url: leadId ? `/leads/${leadId}` : "/leads" },
  });
}

async function notifyReturningLead(userId, { leadId, leadName, channelLabel }) {
  const title = "Lead retornou";
  const bodyText = `${leadName || "Lead"} voltou a fazer contato${channelLabel ? ` via ${channelLabel}` : ""}.`;

  await sendPushToUser(userId, {
    title,
    body: bodyText,
    icon: "/logo192.png",
    badge: "/favicon.png",
    tag: "returning-lead",
    data: { type: "returning_lead", url: leadId ? `/leads/${leadId}` : "/inbox" },
  });
}

function getVapidPublicKey() {
  return env.vapid.publicKey;
}

module.exports = {
  saveSubscription,
  removeSubscription,
  removeSubscriptionsForUser,
  getSubscriptionsForUser,
  sendPushToUser,
  notifyNewLeadAssigned,
  notifyReturningLead,
  getVapidPublicKey,
};
