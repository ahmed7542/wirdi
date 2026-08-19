export const RECENT_READING_STORAGE_KEY = "wird-recent-locations-v1"

export type RecentReadingLocation = {
  page: number
  verseKey: string
  chapterId: number
  chapterName: string
  updatedAt: number
}

export function loadRecentReadingLocations() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(RECENT_READING_STORAGE_KEY) ?? "[]") as RecentReadingLocation[]
    return saved.filter((item) =>
      Number.isInteger(item.page) && item.page >= 1 && item.page <= 604 &&
      /^\d{1,3}:\d{1,3}$/.test(item.verseKey) &&
      Number.isInteger(item.chapterId) && item.chapterId >= 1 && item.chapterId <= 114 &&
      typeof item.chapterName === "string",
    ).slice(0, 8)
  } catch {
    window.localStorage.removeItem(RECENT_READING_STORAGE_KEY)
    return []
  }
}

export function saveRecentReadingLocation(location: RecentReadingLocation) {
  const current = loadRecentReadingLocations()
  const next = [
    location,
    ...current.filter((item) => item.page !== location.page),
  ].slice(0, 8)
  window.localStorage.setItem(RECENT_READING_STORAGE_KEY, JSON.stringify(next))
  return next
}
