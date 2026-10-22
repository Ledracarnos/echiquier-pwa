const CACHE_NAME = 'echiquier-pwa-v1'
const SCOPE_URL = new URL('./', self.registration.scope)
const BASE_PATH = SCOPE_URL.pathname
const ROOT_URL = BASE_PATH
const FALLBACK_URL = `${BASE_PATH}index.html`

function isSameOrigin(url) {
  return url.origin === self.location.origin
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME)
  const response = await fetch(FALLBACK_URL, { cache: 'no-store' })
  await cache.put(FALLBACK_URL, response.clone())
  await cache.put(ROOT_URL, response.clone())

  const html = await response.text()
  const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((resource) => resource.startsWith(BASE_PATH))

  await cache.addAll([...new Set([
    `${BASE_PATH}manifest.webmanifest`,
    `${BASE_PATH}icon.svg`,
    ...resources,
  ])])
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    cacheAppShell()
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || !isSameOrigin(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => Promise.all([
            cache.put(request, copy),
            cache.put(FALLBACK_URL, response.clone()),
          ]))
          return response
        })
        .catch(async () => (await caches.match(request)) ?? caches.match(FALLBACK_URL)),
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached

      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
    }),
  )
})
