import {
  QPC_HAFS_FONT_URL,
  SURAH_NAME_FONT_URL,
  getQcf4FontUrl,
} from "@/components/quran-page"
import { OFFLINE_PAGE_CACHE } from "@/lib/offline-audio"
import { QURAN_NAVIGATION_URL } from "@/lib/offline-quran-navigation"

export const OFFLINE_QURAN_PAGE_COUNT = 604
export const OFFLINE_QURAN_PROGRESS_EVENT = "wird-offline-quran-progress"
export const OFFLINE_QURAN_RECITER = 6
const DOWNLOAD_CONCURRENCY = 4
const DOWNLOAD_ATTEMPTS = 3
const MAX_CONSECUTIVE_FAILURES = DOWNLOAD_CONCURRENCY
const INSPECTION_CONCURRENCY = 12

type OfflineQuranResource = {
  url: string
  page: number | null
}

type QuranPagePayload = {
  page?: unknown
  verses?: unknown
  tracks?: unknown
  recitationSync?: unknown
  qcfPage?: {
    font?: unknown
    lines?: Array<{
      glyphs?: Array<{
        font?: unknown
        verseKey?: unknown
      }>
    }>
  }
}

export type OfflineQuranStatus = {
  completed: number
  total: number
  pagesCompleted: number
  pagesTotal: number
  running: boolean
  failed: number
}

let activeDownload: Promise<OfflineQuranStatus> | null = null

export function getOfflineQuranPageUrl(page: number) {
  return `/api/quran?page=${page}&content=reading`
}

export function getOfflineQuranResources(startingPage = 1): OfflineQuranResource[] {
  const normalizedStart = Math.min(Math.max(Math.trunc(startingPage), 1), OFFLINE_QURAN_PAGE_COUNT)
  const pageNumbers = [
    ...Array.from({ length: OFFLINE_QURAN_PAGE_COUNT - normalizedStart + 1 }, (_, index) => normalizedStart + index),
    ...Array.from({ length: normalizedStart - 1 }, (_, index) => index + 1),
  ]
  const pages = pageNumbers.map((page) => ({
    url: getOfflineQuranPageUrl(page),
    page,
  }))
  const qcfFonts = [
    getQcf4FontUrl("QCF4_QBSML"),
    ...Array.from({ length: 47 }, (_, index) =>
      getQcf4FontUrl(`QCF4_Hafs_${String(index + 1).padStart(2, "0")}`),
    ),
  ]
  const supportingResources = [
    ...qcfFonts,
    QPC_HAFS_FONT_URL,
    SURAH_NAME_FONT_URL,
  ].map((url) => ({
    url,
    page: null,
  }))
  return [
    { url: QURAN_NAVIGATION_URL, page: null },
    ...pages,
    ...supportingResources,
  ]
}

function getDownloadUrl(url: string) {
  const parsed = new URL(url, window.location.origin)
  parsed.searchParams.set("__wird_offline", "1")
  return url.startsWith("http") ? parsed.href : `${parsed.pathname}${parsed.search}`
}

function isValidQuranPagePayload(payload: QuranPagePayload, expectedPage: number) {
  if (payload.page !== expectedPage || !Array.isArray(payload.verses) || payload.verses.length === 0) return false
  const verses = payload.verses as Array<{
    verseKey?: unknown
    pageNumber?: unknown
    text?: unknown
    words?: unknown
  }>
  if (!verses.every((verse) =>
    typeof verse.verseKey === "string" &&
    verse.pageNumber === expectedPage &&
    typeof verse.text === "string" &&
    Boolean(verse.text.trim()) &&
    Array.isArray(verse.words) &&
    verse.words.length > 0,
  )) return false

  if (!Array.isArray(payload.qcfPage?.lines) || payload.qcfPage.lines.length === 0) return false
  const qcfVerseKeys = new Set(
    (payload.qcfPage.lines as Array<{ glyphs?: Array<{ verseKey?: unknown }> }>)
      .flatMap((line) => line.glyphs ?? [])
      .flatMap((glyph) => typeof glyph.verseKey === "string" ? [glyph.verseKey] : []),
  )
  const verseKeys = new Set(verses.map((verse) => String(verse.verseKey)))
  const qcfMatchesVerses = qcfVerseKeys.size === verseKeys.size &&
    [...qcfVerseKeys].every((verseKey) => verseKeys.has(verseKey))

  return qcfMatchesVerses &&
    Array.isArray(payload.tracks) &&
    (payload.tracks.length === 0 || ["verse", "chapter", "page"].includes(String(payload.recitationSync))) &&
    typeof payload.qcfPage.font === "string" &&
    Boolean(payload.qcfPage.font)
}

async function readValidQuranPage(response: Response | undefined, expectedPage: number) {
  if (!response?.ok) return null
  try {
    const payload = await response.clone().json() as QuranPagePayload
    return isValidQuranPagePayload(payload, expectedPage) ? payload : null
  } catch {
    return null
  }
}

async function getCachedResource(
  cache: Cache,
  resource: OfflineQuranResource,
): Promise<Response | undefined> {
  let response = await cache.match(resource.url)
  if (!response && resource.page !== null) {
    response = await cache.match(`/api/quran?page=${resource.page}&reciter=${OFFLINE_QURAN_RECITER}`)
  }
  if (!response || resource.page === null) return response
  if (await readValidQuranPage(response, resource.page)) return response
  await cache.delete(resource.url)
  return undefined
}

async function inspectCachedResources(cache: Cache, resources: OfflineQuranResource[]) {
  const matches = new Array<Response | undefined>(resources.length)
  let nextIndex = 0
  const worker = async () => {
    while (nextIndex < resources.length) {
      const index = nextIndex
      nextIndex += 1
      matches[index] = await getCachedResource(cache, resources[index])
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(INSPECTION_CONCURRENCY, Math.max(resources.length, 1)) },
    () => worker(),
  ))
  return matches
}

async function matchOfflineResource(url: string) {
  const manualCache = await window.caches.open(OFFLINE_PAGE_CACHE)
  return (await manualCache.match(url)) ?? window.caches.match(url)
}

export async function loadOfflineQuranPage<T>(page: number, reciter: number, allowReciterFallback = true) {
  if (
    typeof window === "undefined" ||
    !("caches" in window) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > OFFLINE_QURAN_PAGE_COUNT
  ) return null

  const sourceReciters = allowReciterFallback
    ? [...new Set([reciter, OFFLINE_QURAN_RECITER])]
    : [reciter]
  for (const sourceReciter of sourceReciters) {
    const url = `/api/quran?page=${page}&reciter=${sourceReciter}`
    const response = await matchOfflineResource(url)
    const payload = await readValidQuranPage(response, page)
    if (payload) return { data: payload as T, reciter: sourceReciter }
  }

  const readingResponse = await matchOfflineResource(getOfflineQuranPageUrl(page))
  const readingPayload = await readValidQuranPage(readingResponse, page)
  return readingPayload ? { data: readingPayload as T, reciter: OFFLINE_QURAN_RECITER } : null
}

export async function loadOfflineQuranReadingPage<T>(page: number) {
  if (
    typeof window === "undefined" ||
    !("caches" in window) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > OFFLINE_QURAN_PAGE_COUNT
  ) return null

  const response = await matchOfflineResource(getOfflineQuranPageUrl(page))
  const payload = await readValidQuranPage(response, page)
  return payload ? payload as T : null
}

function emitStatus(status: OfflineQuranStatus) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<OfflineQuranStatus>(OFFLINE_QURAN_PROGRESS_EVENT, {
    detail: status,
  }))
}

export async function inspectOfflineQuran(): Promise<OfflineQuranStatus> {
  const resources = getOfflineQuranResources()
  if (typeof window === "undefined" || !("caches" in window)) {
    return {
      completed: 0,
      total: resources.length,
      pagesCompleted: 0,
      pagesTotal: OFFLINE_QURAN_PAGE_COUNT,
      running: false,
      failed: 0,
    }
  }
  const cache = await window.caches.open(OFFLINE_PAGE_CACHE)
  const matches = await inspectCachedResources(cache, resources)
  return {
    completed: matches.filter(Boolean).length,
    total: resources.length,
    pagesCompleted: matches.filter((match, index) => Boolean(match) && resources[index].page !== null).length,
    pagesTotal: OFFLINE_QURAN_PAGE_COUNT,
    running: Boolean(activeDownload),
    failed: 0,
  }
}

async function runDownload(startingPage: number): Promise<OfflineQuranStatus> {
  if (navigator.onLine === false) throw new Error("OFFLINE")
  const resources = getOfflineQuranResources(startingPage)
  await navigator.storage?.persist?.()
  const cache = await window.caches.open(OFFLINE_PAGE_CACHE)
  const matches = await inspectCachedResources(cache, resources)
  const missing = resources.filter((_, index) => !matches[index])
  let completed = resources.length - missing.length
  let pagesCompleted = resources.filter((resource, index) => resource.page !== null && matches[index]).length
  let failed = 0
  let consecutiveFailures = 0
  let paused = false
  let nextIndex = 0

  const currentStatus = (): OfflineQuranStatus => ({
    completed,
    total: resources.length,
    pagesCompleted,
    pagesTotal: OFFLINE_QURAN_PAGE_COUNT,
    running: completed + failed < resources.length,
    failed,
  })
  emitStatus(currentStatus())

  const cacheResource = async (resource: OfflineQuranResource) => {
    for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
      try {
        const requestMode = resource.url.startsWith("http") ? "cors" : "same-origin"
        const cacheRequest = new Request(resource.url, { mode: requestMode })
        const response = await fetch(new Request(getDownloadUrl(resource.url), { mode: requestMode }))
        if (!response.ok) throw new Error(`Unable to cache ${resource.url}`)
        if (resource.page !== null) {
          const payload = await readValidQuranPage(response, resource.page)
          if (!payload) throw new Error(`Invalid Quran page ${resource.page}`)
          const fontUrls = [...new Set(
            payload.qcfPage?.lines
              ?.flatMap((line) => line.glyphs ?? [])
              .flatMap((glyph) => typeof glyph.font === "string" ? [getQcf4FontUrl(glyph.font)] : []) ?? [],
          )]
          await Promise.all(fontUrls.map(async (fontUrl) => {
            if (await cache.match(fontUrl)) return
            const fontResponse = await fetch(new Request(fontUrl, { mode: "cors" }))
            if (!fontResponse.ok) throw new Error(`Unable to cache ${fontUrl}`)
            await cache.put(fontUrl, fontResponse)
          }))
        }
        await cache.put(cacheRequest, response)
        return
      } catch (error) {
        if (attempt === DOWNLOAD_ATTEMPTS) throw error
        await new Promise((resolve) => window.setTimeout(resolve, 250 * (2 ** (attempt - 1))))
      }
    }
  }

  const isOffline = () => navigator.onLine === false
  const worker = async () => {
    while (nextIndex < missing.length && !isOffline() && !paused) {
      const resource = missing[nextIndex]
      nextIndex += 1
      try {
        await cacheResource(resource)
        completed += 1
        consecutiveFailures = 0
        if (resource.page !== null) pagesCompleted += 1
      } catch {
        if (isOffline()) return
        failed += 1
        consecutiveFailures += 1
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) paused = true
      }
      emitStatus(currentStatus())
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(DOWNLOAD_CONCURRENCY, Math.max(missing.length, 1)) },
    () => worker(),
  ))
  const status = { ...currentStatus(), running: false }
  emitStatus(status)
  return status
}

export function downloadOfflineQuran(startingPage = 1): Promise<OfflineQuranStatus> {
  if (activeDownload) return activeDownload
  activeDownload = runDownload(startingPage).finally(() => {
    activeDownload = null
  })
  return activeDownload
}
