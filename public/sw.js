// Service worker de Doctor Deck: solo hace que el contador de vidas (/play) funcione sin
// conexión. No toca nada más: el resto de páginas y la API van siempre a la red.
const CACHE = "dd-play-v1";
// Una copia por idioma: español en /play e inglés en /en/play.
const PLAYS = ["/play", "/en/play"];

const assetsOf = (html) => [...new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) ?? [])];

/**
 * Guarda esa página del contador y los archivos de /_next/static que usa; borra los que ya no usa
 * ninguna de las dos.
 */
async function savePlay(path, response) {
  const assets = assetsOf(await response.clone().text());
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
  await cache.put(path, response);
  const used = [...PLAYS, ...assets];
  for (const other of PLAYS) {
    const saved = other === path ? null : await cache.match(other);
    if (saved) used.push(...assetsOf(await saved.text()));
  }
  const keep = new Set(used.map((u) => new URL(u, self.location.origin).href));
  for (const req of await cache.keys()) {
    if (!keep.has(req.url) && !new URL(req.url).pathname.startsWith("/symbols/")) {
      await cache.delete(req);
    }
  }
}

self.addEventListener("install", (event) => {
  // Con el inglés elegido, /play redirige a /en/play: esa respuesta no vale como copia de /play.
  // De una en una: cada guardado borra lo que no usa ninguna copia, y a la vez se pisarían.
  const saveAll = async () => {
    for (const path of PLAYS) {
      try {
        const r = await fetch(path);
        if (r.ok && !r.redirected) await savePlay(path, r);
      } catch {
        // Sin red: se guardará al visitarla.
      }
    }
  };
  event.waitUntil(saveAll().then(() => self.skipWaiting()));
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
  if (req.mode === "navigate" && PLAYS.includes(url.pathname)) {
    const path = url.pathname;
    // Sin red: la copia de ese idioma y, si aún no la hay, la del otro (mejor que nada).
    const offline = async () => {
      for (const p of [path, ...PLAYS]) {
        const hit = await caches.match(p);
        if (hit) return hit;
      }
      return Response.error();
    };
    event.respondWith(
      fetch(req)
        .then((r) => {
          if (r.ok && !r.redirected) event.waitUntil(savePlay(path, r.clone()));
          return r;
        })
        .catch(offline),
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
