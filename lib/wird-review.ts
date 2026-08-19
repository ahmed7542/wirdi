import type { HighlightCategory, VerseHighlight } from "@/components/quran-page"
import { localDateKey } from "@/lib/wird-activity"

export const HIGHLIGHTS_STORAGE_KEY = "wird-verse-highlights-v1"
export const REVIEW_INTERVALS = [0, 1, 3, 7, 14, 30] as const

export const HIGHLIGHT_CATEGORY_LABELS: Record<HighlightCategory, string> = {
  mistake: "خطأ",
  hesitation: "تردد",
  reinforce: "يحتاج تثبيت",
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setHours(12, 0, 0, 0)
  next.setDate(next.getDate() + days)
  return localDateKey(next)
}

function normalizeHighlight(highlight: VerseHighlight): VerseHighlight | null {
  if (
    !highlight ||
    !/^\d{1,3}:\d{1,3}$/.test(highlight.verseKey) ||
    !Number.isInteger(highlight.startPosition) ||
    !Number.isInteger(highlight.endPosition) ||
    highlight.startPosition <= 0 ||
    highlight.endPosition <= 0
  ) return null

  const category = ["mistake", "hesitation", "reinforce"].includes(highlight.category ?? "")
    ? highlight.category
    : "reinforce"
  return {
    ...highlight,
    pageNumber: highlight.pageNumber && highlight.pageNumber >= 1 && highlight.pageNumber <= 604
      ? highlight.pageNumber
      : undefined,
    chapterName: typeof highlight.chapterName === "string" ? highlight.chapterName.trim().slice(0, 80) || undefined : undefined,
    verseText: typeof highlight.verseText === "string" ? highlight.verseText.trim().slice(0, 2000) || undefined : undefined,
    category,
    reviewStep: Math.min(Math.max(Math.round(highlight.reviewStep ?? 0), 0), REVIEW_INTERVALS.length - 1),
    nextReviewDate: highlight.nextReviewDate ?? localDateKey(new Date()),
  }
}

export function loadVerseHighlights() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(HIGHLIGHTS_STORAGE_KEY) ?? "[]") as VerseHighlight[]
    return saved.map(normalizeHighlight).filter((highlight): highlight is VerseHighlight => Boolean(highlight))
  } catch {
    window.localStorage.removeItem(HIGHLIGHTS_STORAGE_KEY)
    return []
  }
}

export function saveVerseHighlights(highlights: VerseHighlight[]) {
  window.localStorage.setItem(HIGHLIGHTS_STORAGE_KEY, JSON.stringify(highlights))
  window.dispatchEvent(new Event("wird-review-changed"))
  return highlights
}

export function scheduleHighlight(
  highlight: VerseHighlight,
  category: HighlightCategory,
  pageNumber?: number,
) {
  const existingStep = highlight.reviewStep ?? 0
  return {
    ...highlight,
    pageNumber: pageNumber ?? highlight.pageNumber,
    category,
    reviewStep: existingStep,
    nextReviewDate: highlight.nextReviewDate ?? localDateKey(new Date()),
  } satisfies VerseHighlight
}

export function getDueReviews(highlights: VerseHighlight[], date = new Date()) {
  const today = localDateKey(date)
  return highlights
    .filter((highlight) => (highlight.nextReviewDate ?? today) <= today)
    .sort((first, second) => {
      const dateOrder = (first.nextReviewDate ?? today).localeCompare(second.nextReviewDate ?? today)
      if (dateOrder !== 0) return dateOrder
      return first.verseKey.localeCompare(second.verseKey, "ar", { numeric: true })
    })
}

export function recordReviewOutcome(
  highlights: VerseHighlight[],
  verseKey: string,
  outcome: "mastered" | "retry",
  date = new Date(),
) {
  const today = localDateKey(date)
  return highlights.map((highlight) => {
    if (highlight.verseKey !== verseKey) return highlight
    if (outcome === "retry") {
      return {
        ...highlight,
        lastReviewDate: today,
        nextReviewDate: addDays(date, 1),
      }
    }
    const nextStep = Math.min((highlight.reviewStep ?? 0) + 1, REVIEW_INTERVALS.length - 1)
    return {
      ...highlight,
      reviewStep: nextStep,
      lastReviewDate: today,
      nextReviewDate: addDays(date, REVIEW_INTERVALS[nextStep]),
    }
  })
}

export function countReviewsForDate(highlights: VerseHighlight[], date: Date) {
  const key = localDateKey(date)
  return highlights.filter((highlight) => highlight.nextReviewDate === key).length
}
