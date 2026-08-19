export const LAST_READING_STORAGE_KEY = "wird-last-reading-v1"

export type LastReading = {
  page: number
  verseKey?: string
  chapterId?: number
  positionMs: number
  reciter: number
  viewMode: "image" | "text"
  readingMode: "page" | "large"
  updatedAt: number
}

export function loadLastReading() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(LAST_READING_STORAGE_KEY) ?? "null") as LastReading | null
    if (!saved || saved.page < 1 || saved.page > 604 || !Number.isFinite(saved.reciter)) return null
    return {
      ...saved,
      positionMs: Math.max(0, Number(saved.positionMs) || 0),
      viewMode: saved.viewMode === "text" ? "text" : "image",
      readingMode: saved.readingMode === "large" ? "large" : "page",
      updatedAt: Number(saved.updatedAt) || 0,
    } satisfies LastReading
  } catch {
    window.localStorage.removeItem(LAST_READING_STORAGE_KEY)
    return null
  }
}

export function saveLastReading(reading: LastReading) {
  window.localStorage.setItem(LAST_READING_STORAGE_KEY, JSON.stringify(reading))
  return reading
}
