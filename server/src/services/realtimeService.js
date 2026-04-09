const clients = new Map();
let nextClientId = 1;
let nextEventId = 1;

function writeEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`);
  res.write(`id: ${nextEventId}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
  nextEventId += 1;
}

function subscribeToRealtimeStream(req, res, user) {
  const clientId = nextClientId;
  nextClientId += 1;

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write("retry: 3000\n\n");

  clients.set(clientId, {
    id: clientId,
    userId: user.id,
    res,
  });

  writeEvent(res, "connected", {
    userId: user.id,
    connectedAt: new Date().toISOString(),
  });

  const heartbeat = setInterval(() => {
    writeEvent(res, "ping", {
      ts: new Date().toISOString(),
    });
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    res.end();
  });
}

function broadcastCrmUpdate({
  type,
  resources = [],
  entityId = null,
  actorUserId = null,
  metadata = {},
} = {}) {
  if (!clients.size) {
    return;
  }

  const payload = {
    type: type || "crm.updated",
    resources,
    entityId,
    actorUserId,
    metadata,
    emittedAt: new Date().toISOString(),
  };

  for (const client of clients.values()) {
    try {
      writeEvent(client.res, "crm:update", payload);
    } catch (error) {
      clients.delete(client.id);
    }
  }
}

module.exports = {
  broadcastCrmUpdate,
  subscribeToRealtimeStream,
};
