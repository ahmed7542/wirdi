export const OFFLINE_TAFSIR_CACHE = "wird-offline-tafsir-v1"
export const OFFLINE_TAFSIR_PROGRESS_EVENT = "wird-offline-tafsir-progress"
export const OFFLINE_TAFSIR_CHAPTER_COUNT = 114
const DOWNLOAD_CONCURRENCY = 3

export type TafsirResource = {
  id: "saadi"
  name: string
  author: string
  sourceName: string
  sourceUrl: string
  datasetUrl: string
  version: string
}

export type TafsirEntry = {
  verseKey: string
  verseKeys: string[]
  surah: number
  ayah: number
  text: string
  rangeStartVerseKey: string
  rangeEndVerseKey: string
}

export type TafsirResponse = {
  resource: TafsirResource
  chapter: number
  chapterName: string
  entry?: TafsirEntry
  entries?: TafsirEntry[]
  offline?: boolean
  error?: string
}

export type OfflineTafsirStatus = {
  completed: number
  total: number
  running: boolean
  failed: number
}

let activeDownload: Promise<OfflineTafsirStatus> | null = null

function chapterUrl(chapter: number) {
  return `/api/quran/tafsir?tafsir=saadi&chapter=${chapter}`
}

function verseUrl(verseKey: string) {
  return `/api/quran/tafsir?tafsir=saadi&verseKey=${encodeURIComponent(verseKey)}`
}

function emitStatus(status: OfflineTafsirStatus) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<OfflineTafsirStatus>(OFFLINE_TAFSIR_PROGRESS_EVENT, { detail: status }))
}

export async function inspectOfflineTafsir(): Promise<OfflineTafsirStatus> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return { completed: 0, total: OFFLINE_TAFSIR_CHAPTER_COUNT, running: false, failed: 0 }
  }
  const cache = await window.caches.open(OFFLINE_TAFSIR_CACHE)
  const matches = await Promise.all(
    Array.from({ length: OFFLINE_TAFSIR_CHAPTER_COUNT }, (_, index) => cache.match(chapterUrl(index + 1))),
  )
  return {
    completed: matches.filter(Boolean).length,
    total: OFFLINE_TAFSIR_CHAPTER_COUNT,
    running: Boolean(activeDownload),
    failed: 0,
  }
}

export async function storeOfflineTafsirVerse(verseKey: string, response: TafsirResponse) {
  if (typeof window === "undefined" || !("caches" in window)) return
  const cache = await window.caches.open(OFFLINE_TAFSIR_CACHE)
  await cache.put(verseUrl(verseKey), new Response(JSON.stringify(response), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  }))
}

export async function readOfflineTafsir(verseKey: string): Promise<TafsirResponse | null> {
  if (typeof window === "undefined" || !("caches" in window)) return null
  const [chapterValue] = verseKey.split(":").map(Number)
  if (!Number.isInteger(chapterValue) || chapterValue < 1 || chapterValue > 114) return null
  const cache = await window.caches.open(OFFLINE_TAFSIR_CACHE)
  const exact = await cache.match(verseUrl(verseKey))
  if (exact) return { ...await exact.json() as TafsirResponse, offline: true }
  const chapterResponse = await cache.match(chapterUrl(chapterValue))
  if (!chapterResponse) return null
  const data = await chapterResponse.json() as TafsirResponse
  const [, ayah] = verseKey.split(":").map(Number)
  const group = data.entries?.find((item) => item.verseKeys?.includes(verseKey) || item.verseKey === verseKey)
  const entry = group ? { ...group, verseKey, ayah } : null
  return entry ? { ...data, entries: undefined, entry, offline: true } : null
}

async function runDownload(): Promise<OfflineTafsirStatus> {
  if (navigator.onLine === false) throw new Error("OFFLINE")
  await navigator.storage?.persist?.()
  const cache = await window.caches.open(OFFLINE_TAFSIR_CACHE)
  const urls = Array.from({ length: OFFLINE_TAFSIR_CHAPTER_COUNT }, (_, index) => chapterUrl(index + 1))
  const matches = await Promise.all(urls.map((url) => cache.match(url)))
  const missing = urls.filter((_, index) => !matches[index])
  let completed = urls.length - missing.length
  let failed = 0
  let nextIndex = 0

  const status = (running: boolean): OfflineTafsirStatus => ({
    completed,
    total: OFFLINE_TAFSIR_CHAPTER_COUNT,
    running,
    failed,
  })
  emitStatus(status(missing.length > 0))

  const worker = async () => {
    while (nextIndex < missing.length) {
      const url = missing[nextIndex]
      nextIndex += 1
      try {
        const downloadUrl = new URL(url, window.location.origin)
        downloadUrl.searchParams.set("__wird_offline", "1")
        const response = await fetch(`${downloadUrl.pathname}${downloadUrl.search}`)
        if (!response.ok) throw new Error(`Unable to cache ${url}`)
        await cache.put(url, response)
        completed += 1
      } catch {
        failed += 1
      }
      emitStatus(status(completed + failed < urls.length))
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(DOWNLOAD_CONCURRENCY, Math.max(missing.length, 1)) },
    () => worker(),
  ))
  const finalStatus = status(false)
  emitStatus(finalStatus)
  return finalStatus
}

export function downloadOfflineTafsir() {
  if (activeDownload) return activeDownload
  activeDownload = runDownload().finally(() => {
    activeDownload = null
  })
  return activeDownload
}

export async function deleteOfflineTafsir() {
  if (typeof window === "undefined" || !("caches" in window)) return
  await window.caches.delete(OFFLINE_TAFSIR_CACHE)
  emitStatus({ completed: 0, total: OFFLINE_TAFSIR_CHAPTER_COUNT, running: false, failed: 0 })
}
