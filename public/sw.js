// Service worker de Doctor Deck: solo hace que el contador de vidas (/play) funcione sin
// conexión. No toca nada más: el resto de páginas y la API van siempre a la red.
const CACHE = "dd-play-v1";
const PLAY = "/play";

/** Guarda /play y los archivos de /_next/static que usa; borra los que ya no usa. */
async function savePlay(response) {
  const html = await response.clone().text();
  const assets = [...new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) ?? [])];
  const cache = await caches.open(CACHE);
  await Promise.all(
    assets.map(async (url) => {
      if (await cache.match(url)) return;
      try {
        const r = await fetch(url);
        if (r.ok) await cache.put(url, r);
      } catch {
        // Sin red a medias: se intentará en la próxima visita.
      }
    }),
  );
  await cache.put(PLAY, response);
  const keep = new Set([PLAY, ...assets].map((u) => new URL(u, self.location.origin).href));
  for (const req of await cache.keys()) {
    if (!keep.has(req.url) && !new URL(req.url).pathname.startsWith("/symbols/")) {
      await cache.delete(req);
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    fetch(PLAY)
      .then((r) => (r.ok ? savePlay(r) : undefined))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // /play: primero la red (y se guarda); sin red, la copia guardada.
  if (req.mode === "navigate" && url.pathname === PLAY) {
    event.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok && !r.redirected) event.waitUntil(savePlay(r.clone()));
          return r;
        })
        .catch(async () => (await caches.match(PLAY)) ?? Response.error()),
    );
    return;
  }

  // Archivos con hash (no cambian) y símbolos de maná: de la caché si están.
  const isStatic = url.pathname.startsWith("/_next/static/");
  const isSymbol = url.pathname.startsWith("/symbols/");
  if (isStatic || isSymbol) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then(async (r) => {
            if (isSymbol && r.ok) await (await caches.open(CACHE)).put(req, r.clone());
            return r;
          }),
      ),
    );
  }
});
