import type { LearningPlanType } from "@/lib/learning-plan"

export const READING_STATS_STORAGE_KEY = "wird-reading-stats-v1"
export const SESSION_HISTORY_STORAGE_KEY = "wird-session-history-v1"
export const SAVED_SESSIONS_STORAGE_KEY = "wird-saved-sessions-v1"
export const REVIEW_SIGNALS_STORAGE_KEY = "wird-review-signals-v1"

export type WirdSessionMode = "listen" | "recite" | "test"
export type WirdTestKind = "standard" | "mutashabihat"
export type WirdMutashabihatType = "identical" | "similar" | "beginning" | "ending"

export type ReadingStats = {
  totalSeconds: number
  sessionsCompleted: number
  days: Record<string, number>
  pages: number[]
}

export type ReviewSignal = {
  verseKey: string
  page: number
  chapterName: string
  count: number
  lastAt: number
}

export type SavedSessionPreset = {
  id: string
  name: string
  mode: WirdSessionMode
  testKind?: WirdTestKind
  mutashabihatTypes?: WirdMutashabihatType[]
  startPage: number
  endPage: number
  startVerseKey?: string
  endVerseKey?: string
  reciter: number
  repeatTarget: string
  ayahRepeatEnabled: boolean
  ayahRepeatCount: number
  ayahPauseSeconds: number
  createdAt: number
  updatedAt: number
}

export type SessionHistoryItem = {
  id: string
  mode: WirdSessionMode
  testKind?: WirdTestKind
  mutashabihatTypes?: WirdMutashabihatType[]
  learningPlanType?: LearningPlanType
  startPage: number
  endPage: number
  startVerseKey?: string
  endVerseKey?: string
  currentPage: number
  currentVerseKey?: string
  reciter: number
  reciterName: string
  repeatTarget?: string
  ayahRepeatEnabled?: boolean
  ayahRepeatCount?: number
  ayahPauseSeconds?: number
  startedAt?: number
  updatedAt: number
  completed: boolean
}

const EMPTY_STATS: ReadingStats = {
  totalSeconds: 0,
  sessionsCompleted: 0,
  days: {},
  pages: [],
}

export function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

export function recordReviewSignal(signal: Omit<ReviewSignal, "count" | "lastAt">) {
  const current = loadReviewSignals()
  const existing = current.find((item) => item.verseKey === signal.verseKey)
  const nextSignal: ReviewSignal = {
    ...signal,
    count: (existing?.count ?? 0) + 1,
    lastAt: Date.now(),
  }
  const next = [nextSignal, ...current.filter((item) => item.verseKey !== signal.verseKey)]
    .sort((first, second) => second.count - first.count || second.lastAt - first.lastAt)
    .slice(0, 20)
  window.localStorage.setItem(REVIEW_SIGNALS_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event("wird-activity-changed"))
  return nextSignal
}

export function loadReviewSignals() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(REVIEW_SIGNALS_STORAGE_KEY) ?? "[]") as ReviewSignal[]
    return saved.filter((item) => (
      item && typeof item.verseKey === "string" && Number.isInteger(item.page) &&
      item.page >= 1 && item.page <= 604 && Number.isFinite(item.count)
    )).slice(0, 20)
  } catch {
    window.localStorage.removeItem(REVIEW_SIGNALS_STORAGE_KEY)
    return []
  }
}

export function loadReadingStats() {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(READING_STATS_STORAGE_KEY) ?? "null",
    ) as ReadingStats | null
    if (!saved) return { ...EMPTY_STATS }
    return {
      totalSeconds: Math.max(0, Math.round(saved.totalSeconds || 0)),
      sessionsCompleted: Math.max(0, Math.round(saved.sessionsCompleted || 0)),
      days: saved.days && typeof saved.days === "object" ? saved.days : {},
      pages: Array.isArray(saved.pages)
        ? [...new Set(saved.pages.filter((page) => Number.isInteger(page) && page >= 1 && page <= 604))]
        : [],
    }
  } catch {
    window.localStorage.removeItem(READING_STATS_STORAGE_KEY)
    return { ...EMPTY_STATS }
  }
}

export function addReadingTime(seconds: number, page: number) {
  const amount = Math.max(0, Math.round(seconds))
  if (amount === 0) return loadReadingStats()
  const stats = loadReadingStats()
  const today = localDateKey(new Date())
  const next: ReadingStats = {
    ...stats,
    totalSeconds: stats.totalSeconds + amount,
    days: { ...stats.days, [today]: (stats.days[today] ?? 0) + amount },
    pages: stats.pages.includes(page) ? stats.pages : [...stats.pages, page],
  }
  window.localStorage.setItem(READING_STATS_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event("wird-activity-changed"))
  return next
}

export function incrementCompletedSessions() {
  const stats = loadReadingStats()
  const next = { ...stats, sessionsCompleted: stats.sessionsCompleted + 1 }
  window.localStorage.setItem(READING_STATS_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event("wird-activity-changed"))
  return next
}

export function loadSessionHistory() {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(SESSION_HISTORY_STORAGE_KEY) ?? "[]",
    ) as SessionHistoryItem[]
    return saved
      .filter((item) =>
        item &&
        typeof item.id === "string" &&
        ["listen", "recite", "test"].includes(item.mode) &&
        item.startPage >= 1 &&
        item.endPage <= 604,
      )
      .sort((first, second) => second.updatedAt - first.updatedAt)
      .slice(0, 12)
  } catch {
    window.localStorage.removeItem(SESSION_HISTORY_STORAGE_KEY)
    return []
  }
}

export function saveSessionHistory(items: SessionHistoryItem[]) {
  const next = items
    .sort((first, second) => second.updatedAt - first.updatedAt)
    .slice(0, 12)
  window.localStorage.setItem(SESSION_HISTORY_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event("wird-activity-changed"))
  return next
}

export function upsertSessionHistory(item: SessionHistoryItem) {
  return saveSessionHistory([
    item,
    ...loadSessionHistory().filter((current) => current.id !== item.id),
  ])
}

export function completeSessionHistory(id: string) {
  return saveSessionHistory(loadSessionHistory().map((item) =>
    item.id === id ? { ...item, completed: true, updatedAt: Date.now() } : item,
  ))
}

export function loadSavedSessions() {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(SAVED_SESSIONS_STORAGE_KEY) ?? "[]",
    ) as SavedSessionPreset[]
    return saved
      .filter((item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        ["listen", "recite", "test"].includes(item.mode) &&
        item.startPage >= 1 &&
        item.endPage <= 604 &&
        item.endPage >= item.startPage,
      )
      .sort((first, second) => second.updatedAt - first.updatedAt)
      .slice(0, 20)
  } catch {
    window.localStorage.removeItem(SAVED_SESSIONS_STORAGE_KEY)
    return []
  }
}

export function saveSavedSession(preset: SavedSessionPreset) {
  const sessions = [
    preset,
    ...loadSavedSessions().filter((item) => item.id !== preset.id),
  ].sort((first, second) => second.updatedAt - first.updatedAt).slice(0, 20)
  window.localStorage.setItem(SAVED_SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
  window.dispatchEvent(new Event("wird-saved-sessions-changed"))
  return sessions
}

export function deleteSavedSession(id: string) {
  const sessions = loadSavedSessions().filter((item) => item.id !== id)
  window.localStorage.setItem(SAVED_SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
  window.dispatchEvent(new Event("wird-saved-sessions-changed"))
  return sessions
}
