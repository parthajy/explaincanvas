/* ExplainCanvas service worker.
 * Keeps the app installable (a fetch handler is required), serves an offline page when the network is gone,
 * and caches the shell assets so the app opens instantly. Explanations themselves are never cached here:
 * they stream from the server and must stay fresh.
 */
const VERSION = "ec-v3";
const SHELL = ["/offline", "/logo-192.png", "/logo.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API, auth, uploads or streaming routes.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.pathname.startsWith("/_next/webpack-hmr")) return;

  // Hashed build assets: cache first, they never change under the same URL.
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(caches.open(VERSION).then(async (c) => (await c.match(req)) ?? fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; })));
    return;
  }

  // Pages: network first, offline page when the network is gone.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(async () => (await caches.match("/offline")) ?? new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } })));
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "ExplainCanvas", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(self.registration.showNotification(data.title || "ExplainCanvas", { body: data.body || "", icon: "/logo-192.png", badge: "/logo-192.png", data: { url: data.url || "/" } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const client of list) if ("focus" in client) { client.navigate(url); return client.focus(); }
    return self.clients.openWindow(url);
  }));
});
