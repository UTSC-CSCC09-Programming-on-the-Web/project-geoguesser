const clientsByUserId = new Map();

function userKey(userId) {
  return String(userId);
}

export function registerRealtimeClient(userId, res) {
  const key = userKey(userId);
  const clients = clientsByUserId.get(key) ?? new Set();

  clients.add(res);
  clientsByUserId.set(key, clients);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let heartbeat = null;
  let cleanedUp = false;

  function cleanup() {
    if (cleanedUp) return;

    cleanedUp = true;

    if (heartbeat) {
      clearInterval(heartbeat);
    }

    clients.delete(res);

    if (clients.size === 0) {
      clientsByUserId.delete(key);
    }
  }

  function writeEvent(eventName, payload) {
    if (res.writableEnded || res.destroyed) {
      cleanup();
      return;
    }

    try {
      res.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch {
      cleanup();
    }
  }

  res.on("close", cleanup);
  res.on("error", cleanup);

  writeEvent("connected", { connected: true });

  heartbeat = setInterval(() => {
    writeEvent("heartbeat", {});
  }, 25000);
}

export function broadcastToUser(userId, eventName, payload) {
  const key = userKey(userId);
  const clients = clientsByUserId.get(key);

  if (!clients) return;

  const message =
    `event: ${eventName}\n` + `data: ${JSON.stringify(payload)}\n\n`;

  for (const res of clients) {
    try {
      if (res.writableEnded || res.destroyed) {
        clients.delete(res);
        continue;
      }

      res.write(message);
    } catch {
      clients.delete(res);
      res.destroy?.();
    }
  }

  if (clients.size === 0) {
    clientsByUserId.delete(key);
  }
}
