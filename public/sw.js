self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "OJTonTrack";
  const options = {
    body: data.body || "You have a new notification.",
    icon: data.icon || "/icons-192.png",
    badge: "/icons-192.png",
    tag: data.tag || "general-notification",
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const urlObj = new URL(urlToOpen, self.location.origin);

      // Check if there is already a window/tab open with the target URL or same path
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        const clientUrl = new URL(client.url, self.location.origin);
        
        // Match if same pathname (e.g. /portal/supervisor) to support tab switching
        if (clientUrl.pathname === urlObj.pathname && "focus" in client) {
          return client.focus().then((focusedClient) => {
             // Send message to client to trigger in-app navigation/state update
             if (focusedClient) {
                focusedClient.postMessage({
                    type: 'notification-click',
                    url: urlToOpen
                });
             }
             return focusedClient;
          });
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
