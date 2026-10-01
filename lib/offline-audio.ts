import { findPage, getSurahMeta, type AyahNo, type Surah } from "quran-meta/hafs"

export const OFFLINE_AUDIO_CACHE = "wird-offline-surahs-v1"
export const OFFLINE_PAGE_CACHE = "wird-manual-pages-v2"
export const OFFLINE_RANGE_STORAGE_KEY = "wird-offline-ranges-v1"

export type OfflineRangeFile = {
  id: string
  label: string
  audioUrl: string
  fileSize: number
}

export type OfflineRangePackage = {
  key: string
  reciter: number
  reciterName: string
  fileMode: "chapters" | "verses" | "pages"
  files: OfflineRangeFile[]
  totalSize: number
  startAyahId: number
  endAyahId: number
  startVerseKey: string
  endVerseKey: string
  startPage: number
  endPage: number
}

export function loadOfflineRangePackages() {
  try {
    return JSON.parse(
      window.localStorage.getItem(OFFLINE_RANGE_STORAGE_KEY) ?? "[]",
    ) as OfflineRangePackage[]
  } catch {
    window.localStorage.removeItem(OFFLINE_RANGE_STORAGE_KEY)
    return []
  }
}

export function saveOfflineRangePackages(packages: OfflineRangePackage[]) {
  window.localStorage.setItem(OFFLINE_RANGE_STORAGE_KEY, JSON.stringify(packages))
  window.dispatchEvent(new Event("wird-offline-ranges-changed"))
}

export function getOfflineRecitationPageUrl(page: number, reciter: number) {
  return `/api/quran?page=${page}&reciter=${reciter}`
}

export function getOfflineRecitationPages(chapterId: number) {
  const chapter = chapterId as Surah
  const chapterMeta = getSurahMeta(chapter)
  const startPage = findPage(chapter, 1 as AyahNo)
  const endPage = findPage(chapter, chapterMeta.ayahCount as AyahNo)
  return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index)
}

async function hasUsableRecitationMetadata(
  response: Response | undefined,
  page: number,
  chapterId: number,
  audioUrl?: string,
) {
  if (!response?.ok) return false
  try {
    const payload = await response.clone().json() as {
      page?: number
      tracks?: Array<{ chapterId?: number; audioUrl?: string }>
    }
    return payload.page === page && Boolean(
      payload.tracks?.some((track) => (
        track.chapterId === chapterId &&
        track.audioUrl &&
        (!audioUrl || track.audioUrl === audioUrl)
      )),
    )
  } catch {
    return false
  }
}

export async function cacheOfflineRecitationMetadata(options: {
  chapterId: number
  reciter: number
  audioUrl?: string
  signal?: AbortSignal
  onProgress?: (completed: number, total: number) => void
}) {
  if (typeof window === "undefined" || !("caches" in window)) {
    throw new Error("OFFLINE_CACHE_UNAVAILABLE")
  }
  const pages = getOfflineRecitationPages(options.chapterId)
  const cache = await window.caches.open(OFFLINE_PAGE_CACHE)
  let completed = 0

  for (const page of pages) {
    const url = getOfflineRecitationPageUrl(page, options.reciter)
    let response = await cache.match(url)
    if (!await hasUsableRecitationMetadata(response, page, options.chapterId, options.audioUrl)) {
      const sharedResponse = await window.caches.match(url)
      response = await hasUsableRecitationMetadata(sharedResponse, page, options.chapterId, options.audioUrl)
        ? sharedResponse
        : await fetch(url, { signal: options.signal })
      if (!await hasUsableRecitationMetadata(response, page, options.chapterId, options.audioUrl)) {
        throw new Error(`تعذر حفظ بيانات تشغيل الصفحة ${page}`)
      }
      await cache.put(url, response!.clone())
    }
    completed += 1
    options.onProgress?.(completed, pages.length)
  }

  return pages.length
}

export async function hasOfflineRecitationMetadata(chapterId: number, reciter: number, audioUrl?: string) {
  if (typeof window === "undefined" || !("caches" in window)) return false
  const pages = getOfflineRecitationPages(chapterId)
  const cache = await window.caches.open(OFFLINE_PAGE_CACHE)
  const matches = await Promise.all(pages.map(async (page) => (
    hasUsableRecitationMetadata(
      await cache.match(getOfflineRecitationPageUrl(page, reciter)),
      page,
      chapterId,
      audioUrl,
    )
  )))
  return matches.every(Boolean)
}

export function formatOfflineBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 MB"
  if (value < 1024 ** 2) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / 1024 ** 2).toFixed(value >= 100 * 1024 ** 2 ? 0 : 1)} MB`
}
