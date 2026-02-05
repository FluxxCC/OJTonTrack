self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try {
      const text = event.data ? event.data.text() : "";
      data = text ? JSON.parse(text) : {};
    } catch {}
  }

  const title = data.title || "OJTonTrack";
  const body = data.body || "You have a new notification.";
  const icon = data.icon || "/icons-192.png";
  const tag = data.tag || `ojt-${Date.now()}`;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      tag,
      data: {
        url: data.url || "/"
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        const normalizedUrl = new URL(client.url);
        if (normalizedUrl.pathname === url || normalizedUrl.href.endsWith(url)) {
          client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
