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
  audioUrls?: string[],
) {
  if (!response?.ok) return false
  try {
    const payload = await response.clone().json() as {
      page?: number
      tracks?: Array<{ chapterId?: number; audioUrl?: string }>
    }
    const allowedAudioUrls = audioUrls?.length ? new Set(audioUrls) : null
    return payload.page === page && Boolean(
      payload.tracks?.some((track) => (
        track.audioUrl && (allowedAudioUrls
          ? allowedAudioUrls.has(track.audioUrl)
          : track.chapterId === chapterId)
      )),
    )
  } catch {
    return false
  }
}

async function getCachedAudioDurationMs(audioUrl: string) {
  const response = await window.caches.match(audioUrl)
  if (!response?.ok) throw new Error("OFFLINE_AUDIO_MISSING")
  const objectUrl = URL.createObjectURL(await response.blob())
  try {
    return await new Promise<number>((resolve, reject) => {
      const audio = new Audio()
      const timeout = window.setTimeout(() => reject(new Error("AUDIO_DURATION_TIMEOUT")), 15_000)
      audio.preload = "metadata"
      audio.onloadedmetadata = () => {
        window.clearTimeout(timeout)
        const durationMs = Math.round(audio.duration * 1000)
        if (Number.isFinite(durationMs) && durationMs > 0) resolve(durationMs)
        else reject(new Error("AUDIO_DURATION_UNAVAILABLE"))
      }
      audio.onerror = () => {
        window.clearTimeout(timeout)
        reject(new Error("AUDIO_DURATION_UNAVAILABLE"))
      }
      audio.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function createChapterFallbackMetadata(
  response: Response,
  page: number,
  chapterId: number,
  audioUrl: string,
  durationMs: number,
) {
  const payload = await response.clone().json() as {
    page?: number
    verses?: Array<{ chapterId?: number }>
    tracks?: Array<{
      chapterId?: number
      timingMode?: string
      firstVerseIndex?: number
      [key: string]: unknown
    }>
    recitationSync?: string
  }
  if (payload.page !== page || !payload.verses?.length) return null
  const matchingIndexes = payload.verses.flatMap((verse, index) =>
    verse.chapterId === chapterId ? [index] : [])
  if (matchingIndexes.length === 0) return null
  const existingChapterTracks = (payload.tracks ?? []).filter((track) => (
    track.timingMode === "chapter" && track.chapterId !== chapterId
  ))
  const chapterTrack = {
    chapterId,
    audioUrl,
    startMs: 0,
    endMs: durationMs,
    firstVerseIndex: matchingIndexes[0],
    lastVerseIndex: matchingIndexes.at(-1),
    timingMode: "chapter",
  }
  return new Response(JSON.stringify({
    ...payload,
    tracks: [...existingChapterTracks, chapterTrack]
      .sort((left, right) => (left.firstVerseIndex ?? 0) - (right.firstVerseIndex ?? 0)),
    recitationSync: "chapter",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

export async function cacheOfflineRecitationMetadata(options: {
  chapterId: number
  reciter: number
  audioUrls?: string[]
  signal?: AbortSignal
  onProgress?: (completed: number, total: number) => void
}) {
  if (typeof window === "undefined" || !("caches" in window)) {
    throw new Error("OFFLINE_CACHE_UNAVAILABLE")
  }
  const pages = getOfflineRecitationPages(options.chapterId)
  const cache = await window.caches.open(OFFLINE_PAGE_CACHE)
  const chapterAudioUrl = options.audioUrls?.length === 1 ? options.audioUrls[0] : null
  let chapterDurationMs: number | null = null
  let completed = 0

  for (const page of pages) {
    const url = getOfflineRecitationPageUrl(page, options.reciter)
    let response = await cache.match(url)
    if (!await hasUsableRecitationMetadata(response, page, options.chapterId, options.audioUrls)) {
      const chapterFallbackSource = response
      const sharedResponse = await window.caches.match(url)
      response = await hasUsableRecitationMetadata(sharedResponse, page, options.chapterId, options.audioUrls)
        ? sharedResponse
        : await fetch(url, { signal: options.signal })
      if (!await hasUsableRecitationMetadata(response, page, options.chapterId, options.audioUrls)) {
        const fallbackSource = chapterFallbackSource?.ok ? chapterFallbackSource : response
        if (!fallbackSource?.ok || !chapterAudioUrl) {
          throw new Error(`تعذر حفظ بيانات تشغيل الصفحة ${page}`)
        }
        chapterDurationMs ??= await getCachedAudioDurationMs(chapterAudioUrl)
        response = await createChapterFallbackMetadata(
          fallbackSource,
          page,
          options.chapterId,
          chapterAudioUrl,
          chapterDurationMs,
        ) ?? undefined
      }
      if (!await hasUsableRecitationMetadata(response, page, options.chapterId, options.audioUrls)) {
        throw new Error(`تعذر حفظ بيانات تشغيل الصفحة ${page}`)
      }
      await cache.put(url, response!.clone())
    }
    completed += 1
    options.onProgress?.(completed, pages.length)
  }

  return pages.length
}

export async function hasOfflineRecitationMetadata(chapterId: number, reciter: number, audioUrls?: string[]) {
  if (typeof window === "undefined" || !("caches" in window)) return false
  const pages = getOfflineRecitationPages(chapterId)
  const cache = await window.caches.open(OFFLINE_PAGE_CACHE)
  const matches = await Promise.all(pages.map(async (page) => (
    hasUsableRecitationMetadata(
      await cache.match(getOfflineRecitationPageUrl(page, reciter)),
      page,
      chapterId,
      audioUrls,
    )
  )))
  return matches.every(Boolean)
}

export function formatOfflineBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 MB"
  if (value < 1024 ** 2) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / 1024 ** 2).toFixed(value >= 100 * 1024 ** 2 ? 0 : 1)} MB`
}
