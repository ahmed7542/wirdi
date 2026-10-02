const RELEASE = new URL(self.location.href).searchParams.get("release") || "base"
const VERSION = `wird-v51-${RELEASE.replace(/[^a-zA-Z0-9_-]/g, "")}`
const STATIC_CACHE = `${VERSION}-static`
const PAGE_CACHE = `${VERSION}-pages`
const QURAN_CACHE = "wird-quran-v1"
const MANUAL_PAGE_CACHE = "wird-manual-pages-v2"
const APP_CACHE_GENERATIONS = 3
const NAVIGATION_TIMEOUT_MS = 4_000
const PRECACHE_PAGES = ["/", "/offline"]
const PRECACHE_DATA = ["/api/quran/navigation"]
const PRECACHE_STATIC = [
  "/manifest.webmanifest",
  "/icons/wird-192.png",
  "/icons/wird-mark.png",
  "/icons/wird-512.png",
  "/icons/wird-maskable-512.png",
  "/fonts/IBMPlexSansArabic-Regular.ttf",
]

self.addEventListener("install", (event) => {
  event.waitUntil(precacheAppShell())
})

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await migrateLegacyQuranCaches()
    await cleanupOldAppCaches()
    await self.clients.claim()
  })())
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || "/?khatma=1", self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const existingWindow = windows.find((client) => new URL(client.url).origin === self.location.origin)
    if (existingWindow) {
      await existingWindow.navigate(targetUrl)
      return existingWindow.focus()
    }
    return self.clients.openWindow(targetUrl)
  })())
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  const isQuranAudio = [
    "download.quranicaudio.com",
    "audio.qurancdn.com",
    "verses.quran.com",
    "everyayah.com",
    "drive.usercontent.google.com",
    "archive.org",
    "server8.mp3quran.net",
    "server9.mp3quran.net",
    "cdn.mp3quran.net",
  ].includes(url.hostname)

  if (request.headers.has("range")) {
    if (isQuranAudio) event.respondWith(rangeAudioResponse(request))
    return
  }

  if (url.searchParams.get("__wird_offline") === "1" || url.searchParams.has("__wird_update")) {
    event.respondWith(fetch(request))
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationNetworkFirst(request, PAGE_CACHE, "/offline"))
    return
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/quran")) {
    event.respondWith(
      url.pathname === "/api/quran"
        ? quranPageNetworkFirst(request)
        : networkFirst(request, QURAN_CACHE),
    )
    return
  }

  if (isQuranAudio) {
    event.respondWith(cachedAudioOrNetwork(request))
    return
  }

  const isStaticAsset = url.origin === self.location.origin && (
    url.pathname.startsWith("/_next/static/") ||
    ["style", "script", "font", "image"].includes(request.destination)
  )
  const isQuranAsset = ["cdn.myquran.com", "verses.quran.foundation", "cdn.jsdelivr.net"].includes(url.hostname)

  if (isStaticAsset || isQuranAsset) {
    event.respondWith(cacheFirst(request, isQuranAsset ? QURAN_CACHE : STATIC_CACHE))
  }
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting())
    return
  }

  if (!Array.isArray(event.data?.urls)) return

  if (event.data.type === "CACHE_APP_SHELL") {
    event.waitUntil((async () => {
      const cache = await caches.open(STATIC_CACHE)
      const urls = event.data.urls.filter((url) => {
        const parsed = new URL(url, self.location.origin)
        return parsed.origin === self.location.origin && parsed.pathname.startsWith("/_next/static/")
      })
      const results = await Promise.allSettled(urls.map(async (url) => {
        try {
          const response = await fetch(url)
          if (!response.ok) throw new Error(`Unable to cache ${url}`)
          await cache.put(url, response)
        } catch (error) {
          const cached = await matchCachedStaticAsset(url)
          if (!cached) throw error
          await cache.put(url, cached.clone())
        }
      }))
      event.ports[0]?.postMessage({
        type: "APP_SHELL_CACHED",
        success: results.every((result) => result.status === "fulfilled"),
      })
    })())
    return
  }

  if (event.data.type !== "CACHE_QURAN_PAGE") return
  event.waitUntil((async () => {
    const cache = await caches.open(QURAN_CACHE)
    const results = await Promise.allSettled(
      event.data.urls.map(async (url) => {
        const request = new Request(url, { mode: url.startsWith("http") ? "cors" : "same-origin" })
        const response = await fetch(request)
        if (!response.ok) throw new Error(`Unable to cache ${url}`)
        await cache.put(request, response)
      }),
    )
    event.source?.postMessage({
      type: "QURAN_PAGE_CACHED",
      page: event.data.page,
      success: results.every((result) => result.status === "fulfilled"),
    })
  })())
})

async function precacheAppShell() {
  const pageCache = await caches.open(PAGE_CACHE)
  const staticCache = await caches.open(STATIC_CACHE)
  const pages = await Promise.all(PRECACHE_PAGES.map(async (url) => {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) throw new Error(`Unable to cache ${url}`)
    await pageCache.put(url, response.clone())
    return response.text()
  }))
  const staticUrls = new Set(PRECACHE_STATIC)
  for (const html of pages) {
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const parsed = new URL(match[1].replaceAll("&amp;", "&"), self.location.origin)
      if (parsed.origin === self.location.origin && parsed.pathname.startsWith("/_next/static/")) {
        staticUrls.add(parsed.href)
      }
    }
  }
  await staticCache.addAll([...staticUrls])

  const quranCache = await caches.open(QURAN_CACHE)
  await Promise.allSettled(PRECACHE_DATA.map(async (url) => {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) throw new Error(`Unable to cache ${url}`)
    await quranCache.put(url, response)
  }))
}

async function migrateLegacyQuranCaches() {
  const keys = await caches.keys()
  const legacyCaches = keys.filter((key) => /^wird-v\d+-.+-quran$/.test(key))
  if (!legacyCaches.length) return

  const target = await caches.open(QURAN_CACHE)
  for (const cacheName of legacyCaches) {
    const source = await caches.open(cacheName)
    let migrated = true
    try {
      for (const request of await source.keys()) {
        const response = await source.match(request)
        if (response) await target.put(request, response)
      }
    } catch {
      migrated = false
    }
    if (migrated) await caches.delete(cacheName)
  }
}

async function cleanupOldAppCaches() {
  const keys = await caches.keys()
  const versionFor = (key) => key.match(/^(wird-v\d+-.+)-(?:static|pages)$/)?.[1]
  const staticVersions = keys
    .filter((key) => /-static$/.test(key))
    .map(versionFor)
    .filter(Boolean)
  const retainedVersions = new Set([...staticVersions.slice(-APP_CACHE_GENERATIONS), VERSION])
  await Promise.all(keys.map((key) => {
    const version = versionFor(key)
    return version && !retainedVersions.has(version) ? caches.delete(key) : undefined
  }))
}

async function quranPageNetworkFirst(request) {
  const cache = await caches.open(QURAN_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) {
      await cache.put(request, response.clone())
      return response
    }
    return (await caches.open(MANUAL_PAGE_CACHE).then((cache) => cache.match(request))) ||
      (await caches.match(request)) || response
  } catch {
    return (await caches.open(MANUAL_PAGE_CACHE).then((cache) => cache.match(request))) ||
      (await caches.match(request)) ||
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
  }
}

async function navigationNetworkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), NAVIGATION_TIMEOUT_MS)
  try {
    const response = await fetch(request, { signal: controller.signal })
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    const pathname = new URL(request.url).pathname
    return (await cache.match(request)) ||
      (await cache.match(pathname)) ||
      (fallbackUrl ? await caches.match(fallbackUrl) : undefined) ||
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
  } finally {
    clearTimeout(timeout)
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    return (await cache.match(request)) ||
      (await caches.match(request)) ||
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
  }
}

async function matchCachedStaticAsset(request) {
  const exact = await caches.match(request)
  if (exact) return exact
  const url = new URL(typeof request === "string" ? request : request.url, self.location.origin)
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/_next/static/")) return undefined
  return caches.match(request, { ignoreSearch: true })
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = (await cache.match(request)) || (await matchCachedStaticAsset(request))
  if (cached) {
    if (!(await cache.match(request))) await cache.put(request, cached.clone())
    return cached
  }
  const response = await fetch(request)
  if (response.ok || response.type === "opaque") await cache.put(request, response.clone())
  return response
}

async function cachedAudioOrNetwork(request) {
  return (await caches.match(request.url)) || fetch(request)
}

async function rangeAudioResponse(request) {
  const cached = await caches.match(request.url)
  if (!cached) return fetch(request)

  const range = request.headers.get("range")?.match(/bytes=(\d+)-(\d*)/)
  if (!range) return cached

  const blob = await cached.blob()
  const start = Number(range[1])
  const requestedEnd = range[2] ? Number(range[2]) : blob.size - 1
  const end = Math.min(requestedEnd, blob.size - 1)
  if (start > end || start >= blob.size) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${blob.size}` },
    })
  }

  const headers = new Headers(cached.headers)
  headers.set("Accept-Ranges", "bytes")
  headers.set("Content-Length", String(end - start + 1))
  headers.set("Content-Range", `bytes ${start}-${end}/${blob.size}`)
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    statusText: "Partial Content",
    headers,
  })
}
