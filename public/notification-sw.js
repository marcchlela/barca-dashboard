self.addEventListener("push", (event) => {
  let payload;
  try { payload = event.data ? event.data.json() : null; } catch { payload = null; }
  if (!payload || typeof payload.title !== "string") return;
  const external = typeof payload.url === "string" && payload.url.startsWith("https://www.fcbarcelona.com/en/");
  const url = external || (typeof payload.url === "string" && payload.url.startsWith("/") && !payload.url.startsWith("//")) ? payload.url : "/";
  event.waitUntil(self.registration.showNotification(payload.title.slice(0, 120), {
    body: typeof payload.body === "string" ? payload.body.slice(0, 240) : "",
    icon: typeof payload.iconUrl === "string" ? payload.iconUrl : "/icon.png",
    badge: "/icon.png",
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
    data: { url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url || "/";
  const target = new URL(path, self.location.origin).href;
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      if (new URL(target).origin !== self.location.origin) break;
      if (new URL(client.url).origin === self.location.origin) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    await clients.openWindow(target);
  })());
});
