import {
  findAyahIdBySurah,
  findPagebyAyahId,
  findSurahAyahByAyahId,
  getPageMeta,
  type AyahNo,
  type Page,
  type Surah,
} from "quran-meta/hafs"

export const LEARNING_PLAN_STORAGE_KEY = "wird-learning-plan-v1"

export type LearningPlanType = "new" | "reinforce" | "review"
export type LearningScheduleMode = "daily" | "deadline"

export const LEARNING_PLAN_TYPES: LearningPlanType[] = ["new", "reinforce", "review"]

export type LearningPlan = {
  version: 3
  type: LearningPlanType
  startPage: number
  targetPages: number
  startVerseKey?: string
  endVerseKey?: string
  startAyahId: number
  endAyahId: number
  completedAyahs: number
  scheduleMode: LearningScheduleMode
  dailyPages: number
  endDate: string
  activeDays: number[]
  reviewEnabled: boolean
  reviewPages: number
  redistributeOverdue: boolean
  completedPages: number
  startedAt: string
  updatedAt: number
}

export const LEARNING_PLAN_LABELS: Record<LearningPlanType, string> = {
  new: "حفظ جديد",
  reinforce: "تثبيت",
  review: "مراجعة",
}

export const WEEKDAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]

function clampInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.round(value || min), min), max)
}

function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function learningPlanDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

export function addLearningPlanDays(value: string, amount: number) {
  const date = parseDateKey(value)
  date.setDate(date.getDate() + amount)
  return learningPlanDateKey(date)
}

function daysBetween(first: string, second: string) {
  return Math.floor((parseDateKey(second).getTime() - parseDateKey(first).getTime()) / 86_400_000)
}

function normalizeActiveDays(value: unknown) {
  if (!Array.isArray(value)) return [0, 1, 2, 3, 4, 5, 6]
  const days = [...new Set(value.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))] as number[]
  return days.length ? days.sort((first, second) => first - second) : [0, 1, 2, 3, 4, 5, 6]
}

function isActiveDate(value: string, activeDays: number[]) {
  return activeDays.includes(parseDateKey(value).getDay())
}

function countActiveDates(start: string, end: string, activeDays: number[]) {
  if (daysBetween(start, end) < 0) return 0
  let count = 0
  let cursor = start
  while (daysBetween(cursor, end) >= 0) {
    if (isActiveDate(cursor, activeDays)) count += 1
    cursor = addLearningPlanDays(cursor, 1)
  }
  return count
}

function activeDateAfter(start: string, offset: number, activeDays: number[]) {
  let cursor = start
  let remaining = Math.max(0, offset)
  for (let guard = 0; guard < 5000; guard += 1) {
    if (isActiveDate(cursor, activeDays)) {
      if (remaining === 0) return cursor
      remaining -= 1
    }
    cursor = addLearningPlanDays(cursor, 1)
  }
  return cursor
}

function pageFirstAyahId(page: number) {
  return getPageMeta(page as Page).firstAyahId
}

function pageLastAyahId(page: number) {
  return getPageMeta(page as Page).lastAyahId
}

function verseKeyToAyahId(verseKey: string | undefined, fallback: number) {
  if (!verseKey) return fallback
  const [surah, ayah] = verseKey.split(":").map(Number)
  if (!Number.isInteger(surah) || !Number.isInteger(ayah) || surah < 1 || surah > 114 || ayah < 1) return fallback
  try {
    return findAyahIdBySurah(surah as Surah, ayah as AyahNo)
  } catch {
    return fallback
  }
}

export function learningPlanVerseKey(ayahId: number) {
  const [surah, ayah] = findSurahAyahByAyahId(clampInteger(ayahId, 1, 6236))
  return `${surah}:${ayah}`
}

export function resolveLearningPlanRange(
  startPage: number,
  endPage: number,
  startVerseKey?: string,
  endVerseKey?: string,
) {
  const safeStartPage = clampInteger(startPage, 1, 604)
  const safeEndPage = clampInteger(endPage, safeStartPage, 604)
  const startAyahId = verseKeyToAyahId(startVerseKey, pageFirstAyahId(safeStartPage))
  const endAyahId = verseKeyToAyahId(endVerseKey, pageLastAyahId(safeEndPage))
  return {
    startAyahId,
    endAyahId: Math.max(startAyahId, endAyahId),
  }
}

function completedPagesFromAyahs(plan: Pick<LearningPlan, "startPage" | "startAyahId" | "completedAyahs">) {
  if (plan.completedAyahs <= 0) return 0
  const completedEndAyahId = plan.startAyahId + plan.completedAyahs - 1
  return Math.max(1, findPagebyAyahId(completedEndAyahId) - plan.startPage + 1)
}

function normalizeLearningPlan(saved: Partial<LearningPlan>) {
  if (!LEARNING_PLAN_TYPES.includes(saved.type as LearningPlanType)) return null
  const startPage = clampInteger(saved.startPage ?? 1, 1, 604)
  const targetPages = clampInteger(saved.targetPages ?? 1, 1, 604 - startPage + 1)
  const endPage = Math.min(604, startPage + targetPages - 1)
  const durationDays = clampInteger((saved as { durationDays?: number }).durationDays ?? 30, 1, 365)
  const startedAt = isDateKey(saved.startedAt) ? saved.startedAt : learningPlanDateKey(new Date())
  const scheduleMode: LearningScheduleMode = saved.scheduleMode === "daily" ? "daily" : "deadline"
  const requestedEndDate = isDateKey(saved.endDate)
    ? saved.endDate
    : addLearningPlanDays(startedAt, durationDays - 1)
  const requestedDuration = daysBetween(startedAt, requestedEndDate)
  const endDate = requestedDuration < 0
    ? startedAt
    : requestedDuration > 1825
      ? addLearningPlanDays(startedAt, 1825)
      : requestedEndDate
  const resolved = resolveLearningPlanRange(startPage, endPage, saved.startVerseKey, saved.endVerseKey)
  const totalAyahs = resolved.endAyahId - resolved.startAyahId + 1
  const legacyCompletedPages = clampInteger(saved.completedPages ?? 0, 0, targetPages)
  const legacyCompletedEndPage = legacyCompletedPages > 0
    ? Math.min(endPage, startPage + legacyCompletedPages - 1)
    : startPage
  const migratedCompletedAyahs = legacyCompletedPages > 0
    ? Math.min(totalAyahs, pageLastAyahId(legacyCompletedEndPage) - resolved.startAyahId + 1)
    : 0
  const completedAyahs = clampInteger(saved.completedAyahs ?? migratedCompletedAyahs, 0, totalAyahs)
  const plan: LearningPlan = {
    version: 3,
    type: saved.type as LearningPlanType,
    startPage,
    targetPages,
    startVerseKey: learningPlanVerseKey(resolved.startAyahId),
    endVerseKey: learningPlanVerseKey(resolved.endAyahId),
    startAyahId: resolved.startAyahId,
    endAyahId: resolved.endAyahId,
    completedAyahs,
    scheduleMode,
    dailyPages: clampInteger(saved.dailyPages ?? Math.ceil(targetPages / durationDays), 1, 100),
    endDate,
    activeDays: normalizeActiveDays(saved.activeDays),
    reviewEnabled: Boolean(saved.reviewEnabled),
    reviewPages: clampInteger(saved.reviewPages ?? 2, 1, 30),
    redistributeOverdue: Boolean(saved.redistributeOverdue),
    completedPages: 0,
    startedAt,
    updatedAt: Math.max(0, Math.round(saved.updatedAt ?? 0)),
  }
  plan.completedPages = completedPagesFromAyahs(plan)
  return plan
}

export function loadLearningPlans() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LEARNING_PLAN_STORAGE_KEY) ?? "null") as unknown
    const candidates = Array.isArray(raw) ? raw : raw ? [raw] : []
    const byType = new Map<LearningPlanType, LearningPlan>()
    candidates.forEach((candidate) => {
      if (!candidate || typeof candidate !== "object") return
      try {
        const plan = normalizeLearningPlan(candidate as Partial<LearningPlan>)
        if (!plan) return
        const current = byType.get(plan.type)
        if (!current || plan.updatedAt >= current.updatedAt) byType.set(plan.type, plan)
      } catch {
        // Ignore only the malformed plan so other plan types remain available.
      }
    })
    return LEARNING_PLAN_TYPES.flatMap((type) => {
      const plan = byType.get(type)
      return plan ? [plan] : []
    })
  } catch {
    window.localStorage.removeItem(LEARNING_PLAN_STORAGE_KEY)
    return []
  }
}

export function loadLearningPlan(type?: LearningPlanType) {
  const plans = loadLearningPlans()
  return type ? plans.find((plan) => plan.type === type) ?? null : plans[0] ?? null
}

export function saveLearningPlan(plan: LearningPlan) {
  const plans = loadLearningPlans().filter((saved) => saved.type !== plan.type)
  const next = [...plans, plan].sort(
    (first, second) => LEARNING_PLAN_TYPES.indexOf(first.type) - LEARNING_PLAN_TYPES.indexOf(second.type),
  )
  window.localStorage.setItem(LEARNING_PLAN_STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event("wird-learning-plan-changed"))
  return plan
}

export function deleteLearningPlan(type: LearningPlanType) {
  const plans = loadLearningPlans().filter((plan) => plan.type !== type)
  if (plans.length) window.localStorage.setItem(LEARNING_PLAN_STORAGE_KEY, JSON.stringify(plans))
  else window.localStorage.removeItem(LEARNING_PLAN_STORAGE_KEY)
  window.dispatchEvent(new Event("wird-learning-plan-changed"))
  return plans
}

function assignmentEndForPages(plan: LearningPlan, startAyahId: number) {
  const startPage = findPagebyAyahId(startAyahId)
  const endPage = Math.min(604, startPage + plan.dailyPages - 1)
  return Math.min(plan.endAyahId, pageLastAyahId(endPage))
}

function reviewRange(startAyahId: number, endAyahId: number) {
  if (endAyahId < startAyahId) return null
  return {
    startPage: findPagebyAyahId(startAyahId),
    endPage: findPagebyAyahId(endAyahId),
    startVerseKey: learningPlanVerseKey(startAyahId),
    endVerseKey: learningPlanVerseKey(endAyahId),
    ayahCount: endAyahId - startAyahId + 1,
  }
}

export function getLearningPlanStatus(plan: LearningPlan, date = new Date()) {
  const today = learningPlanDateKey(date)
  const totalAyahs = plan.endAyahId - plan.startAyahId + 1
  const remainingAyahs = Math.max(0, totalAyahs - plan.completedAyahs)
  const totalActiveDays = Math.max(1, countActiveDates(plan.startedAt, plan.endDate, plan.activeDays))
  const elapsedActiveDays = Math.max(0, countActiveDates(plan.startedAt, addLearningPlanDays(today, -1), plan.activeDays))
  const averageAyahsPerPage = totalAyahs / Math.max(plan.targetPages, 1)
  const baselineDailyAyahs = plan.scheduleMode === "daily"
    ? Math.max(1, Math.ceil(plan.dailyPages * averageAyahsPerPage))
    : Math.max(1, Math.ceil(totalAyahs / totalActiveDays))
  const expectedAyahs = Math.min(totalAyahs, elapsedActiveDays * baselineDailyAyahs)
  const overdueAyahs = Math.max(0, expectedAyahs - plan.completedAyahs)
  const deadlineStart = daysBetween(today, plan.endDate) >= 0 ? today : plan.endDate
  const remainingActiveDays = Math.max(1, countActiveDates(deadlineStart, plan.endDate, plan.activeDays))
  const redistributedDailyAyahs = Math.max(1, Math.ceil(remainingAyahs / remainingActiveDays))
  const nextAyahId = Math.min(plan.endAyahId, plan.startAyahId + plan.completedAyahs)
  const activeToday = isActiveDate(today, plan.activeDays)
  let assignmentEndAyahId = nextAyahId - 1
  if (remainingAyahs > 0 && activeToday) {
    assignmentEndAyahId = plan.scheduleMode === "daily" && !plan.redistributeOverdue
      ? assignmentEndForPages(plan, nextAyahId)
      : Math.min(plan.endAyahId, nextAyahId + (plan.redistributeOverdue ? redistributedDailyAyahs : baselineDailyAyahs) - 1)
  }
  const todayAyahs = assignmentEndAyahId >= nextAyahId ? assignmentEndAyahId - nextAyahId + 1 : 0
  const startPage = findPagebyAyahId(nextAyahId)
  const endPage = todayAyahs > 0 ? findPagebyAyahId(assignmentEndAyahId) : startPage
  const plannedDailyAyahs = plan.redistributeOverdue ? redistributedDailyAyahs : baselineDailyAyahs
  const assignmentsRemaining = remainingAyahs > 0 ? Math.ceil(remainingAyahs / Math.max(plannedDailyAyahs, 1)) : 0
  const estimatedFinishDate = assignmentsRemaining > 0
    ? activeDateAfter(today, assignmentsRemaining - 1, plan.activeDays)
    : today
  const nextActiveDate = activeToday ? today : activeDateAfter(addLearningPlanDays(today, 1), 0, plan.activeDays)

  const completedEndAyahId = plan.startAyahId + plan.completedAyahs - 1
  const recentStartPage = plan.completedAyahs > 0
    ? Math.max(plan.startPage, findPagebyAyahId(completedEndAyahId) - plan.reviewPages + 1)
    : plan.startPage
  const recentReview = plan.completedAyahs > 0
    ? reviewRange(
        Math.max(plan.startAyahId, pageFirstAyahId(recentStartPage)),
        completedEndAyahId,
      )
    : null
  const olderEndAyahId = recentReview
    ? verseKeyToAyahId(recentReview.startVerseKey, plan.startAyahId) - 1
    : completedEndAyahId
  const olderAyahs = Math.max(0, olderEndAyahId - plan.startAyahId + 1)
  const distantReviewAyahs = Math.min(Math.max(1, Math.ceil(plan.reviewPages * averageAyahsPerPage)), olderAyahs)
  const elapsedDays = Math.max(0, daysBetween(plan.startedAt, today))
  const distantOffset = olderAyahs > 0 ? (elapsedDays * distantReviewAyahs) % olderAyahs : 0
  const distantStartAyahId = plan.startAyahId + Math.min(distantOffset, Math.max(0, olderAyahs - distantReviewAyahs))
  const distantReview = distantReviewAyahs > 0
    ? reviewRange(distantStartAyahId, distantStartAyahId + distantReviewAyahs - 1)
    : null

  return {
    elapsedDays,
    remainingDays: plan.scheduleMode === "deadline"
      ? Math.max(0, daysBetween(today, plan.endDate) + 1)
      : Math.max(0, daysBetween(today, estimatedFinishDate) + 1),
    remainingActiveDays,
    remainingPages: remainingAyahs > 0 ? findPagebyAyahId(plan.endAyahId) - findPagebyAyahId(nextAyahId) + 1 : 0,
    remainingAyahs,
    dailyPages: todayAyahs > 0 ? endPage - startPage + 1 : plan.dailyPages,
    dailyAyahs: plannedDailyAyahs,
    todayPages: todayAyahs > 0 ? endPage - startPage + 1 : 0,
    todayAyahs,
    activeToday,
    nextActiveDate,
    startPage,
    endPage,
    startVerseKey: learningPlanVerseKey(nextAyahId),
    endVerseKey: todayAyahs > 0 ? learningPlanVerseKey(assignmentEndAyahId) : learningPlanVerseKey(nextAyahId),
    rangeEndPage: findPagebyAyahId(plan.endAyahId),
    estimatedFinishDate,
    isOverdue: overdueAyahs > 0,
    overdueAyahs,
    redistributed: plan.redistributeOverdue,
    recentReview,
    distantReview,
    totalAyahs,
    completedAyahs: plan.completedAyahs,
    progress: Math.min(100, Math.round((plan.completedAyahs / totalAyahs) * 100)),
  }
}

export function redistributeLearningPlanOverdue(type?: LearningPlanType) {
  const plan = loadLearningPlan(type)
  if (!plan) return null
  return saveLearningPlan({ ...plan, redistributeOverdue: true, updatedAt: Date.now() })
}

export function addLearningPlanProgress(
  sessionStartPage: number,
  sessionEndPage: number,
  sessionStartVerseKey?: string,
  sessionEndVerseKey?: string,
  type?: LearningPlanType,
) {
  const plan = loadLearningPlan(type)
  if (!plan) return null
  const nextAyahId = plan.startAyahId + plan.completedAyahs
  const sessionStartAyahId = verseKeyToAyahId(sessionStartVerseKey, pageFirstAyahId(sessionStartPage))
  const sessionEndAyahId = verseKeyToAyahId(sessionEndVerseKey, pageLastAyahId(sessionEndPage))
  const creditedStartAyahId = Math.max(sessionStartAyahId, nextAyahId)
  const creditedEndAyahId = Math.min(sessionEndAyahId, plan.endAyahId)
  if (creditedStartAyahId > nextAyahId || creditedEndAyahId < creditedStartAyahId) return plan
  const completedAyahs = Math.min(
    plan.endAyahId - plan.startAyahId + 1,
    plan.completedAyahs + creditedEndAyahId - creditedStartAyahId + 1,
  )
  const next = { ...plan, completedAyahs, updatedAt: Date.now() }
  next.completedPages = completedPagesFromAyahs(next)
  return saveLearningPlan(next)
}
