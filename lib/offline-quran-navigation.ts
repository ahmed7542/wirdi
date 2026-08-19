import { OFFLINE_PAGE_CACHE } from "@/lib/offline-audio"

export const QURAN_NAVIGATION_URL = "/api/quran/navigation"

export async function loadQuranNavigation<T>() {
  try {
    const response = await fetch(QURAN_NAVIGATION_URL)
    if (!response.ok) throw new Error("Unable to load Quran navigation")
    if (typeof window !== "undefined" && "caches" in window) {
      const cache = await window.caches.open(OFFLINE_PAGE_CACHE)
      await cache.put(QURAN_NAVIGATION_URL, response.clone())
    }
    return await response.json() as T
  } catch (error) {
    if (typeof window === "undefined" || !("caches" in window)) throw error
    const cached = await window.caches.match(QURAN_NAVIGATION_URL)
    if (!cached?.ok) throw error
    return await cached.json() as T
  }
}
