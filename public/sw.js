/*
 * Skilient service worker (PRD 5.34): the app shell for offline moments and the open ticket, plus
 * web push. There is no offline feed: only an offline page and tickets the student already opened
 * are cached, and every cache is cleared at sign-out. Kept dependency-free; served with no-cache.
 */
const SHELL = "skilient-shell-v1";
const TICKETS = "skilient-tickets-v1";
const SHELL_URLS = ["/offline.html", "/brand/skilient-app-icon.svg", "/brand/favicon.svg"];
const TICKET_PATH = /^\/events\/[0-9a-f-]{36}\/ticket$/;
const MAX_TICKETS = 10;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("skilient-") && k !== SHELL && k !== TICKETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function keepTicket(request, response) {
  const cache = await caches.open(TICKETS);
  await cache.put(request, response);
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_TICKETS))) await cache.delete(old);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (TICKET_PATH.test(url.pathname)) {
    // Network first; the last good copy of an open ticket shows at the door without signal.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.type === "basic" && !response.redirected) event.waitUntil(keepTicket(new Request(url.pathname), response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(new Request(url.pathname), { cacheName: TICKETS })) || caches.match("/offline.html")),
    );
    return;
  }
  event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "clear") event.waitUntil(caches.delete(TICKETS));
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Skilient", body: event.data ? event.data.text() : "" };
  }
  const url = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/notifications";
  event.waitUntil(
    self.registration.showNotification(data.title || "Skilient", {
      body: data.body || "",
      icon: "/brand/skilient-app-icon.svg",
      badge: "/brand/favicon.svg",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
