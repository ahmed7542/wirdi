export const KHATMA_STORAGE_KEY = "wird-khatma-plan-v1"
export const KHATMA_CHANGE_EVENT = "wird-khatma-plan-changed"
export const KHATMA_TOTAL_PAGES = 604

export type KhatmaMethod = "duration" | "daily"

export type KhatmaPlan = {
  version: 1
  method: KhatmaMethod
  durationDays: number
  dailyPages: number
  startDate: string
  completedPage: number
  reminderEnabled: boolean
  reminderTime: string
  startPage?: number
  pageCount?: number
  lastOpenedDate?: string
  lastNotifiedDate?: string
  catchUpStartedDate?: string
  catchUpDays?: number
  catchUpPagesPerDay?: number
}

type KhatmaStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">

function clampInteger(value: number, min: number, max: number) {
  const integer = Number.isFinite(value) ? Math.round(value) : min
  return Math.min(Math.max(integer, min), max)
}

function resolveStorage(storage?: KhatmaStorage) {
  if (storage) return storage
  if (typeof window === "undefined") return null
  return window.localStorage
}

export function readKhatmaPlan(storage?: KhatmaStorage): KhatmaPlan | null {
  const target = resolveStorage(storage)
  if (!target) return null

  try {
    const plan = JSON.parse(target.getItem(KHATMA_STORAGE_KEY) ?? "null") as KhatmaPlan | null
    if (
      !plan ||
      plan.version !== 1 ||
      !["duration", "daily"].includes(plan.method) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(plan.startDate)
    ) return null

    const normalized: KhatmaPlan = {
      ...plan,
      durationDays: clampInteger(plan.durationDays, 1, 365),
      dailyPages: clampInteger(plan.dailyPages, 1, 100),
      completedPage: clampInteger(plan.completedPage, 0, KHATMA_TOTAL_PAGES),
      reminderEnabled: Boolean(plan.reminderEnabled),
      reminderTime: /^\d{2}:\d{2}$/.test(plan.reminderTime) ? plan.reminderTime : "20:00",
    }
    if (Number.isFinite(plan.catchUpDays) && Number.isFinite(plan.catchUpPagesPerDay) && plan.catchUpStartedDate && /^\d{4}-\d{2}-\d{2}$/.test(plan.catchUpStartedDate)) {
      normalized.catchUpStartedDate = plan.catchUpStartedDate
      normalized.catchUpDays = clampInteger(plan.catchUpDays!, 1, 365)
      normalized.catchUpPagesPerDay = clampInteger(plan.catchUpPagesPerDay!, 1, 100)
    } else {
      delete normalized.catchUpStartedDate
      delete normalized.catchUpDays
      delete normalized.catchUpPagesPerDay
    }
    if (Number.isFinite(plan.startPage) && Number.isFinite(plan.pageCount)) {
      normalized.startPage = clampInteger(plan.startPage!, 1, KHATMA_TOTAL_PAGES)
      normalized.pageCount = clampInteger(
        plan.pageCount!,
        1,
        KHATMA_TOTAL_PAGES - normalized.startPage + 1,
      )
    } else {
      delete normalized.startPage
      delete normalized.pageCount
    }
    return normalized
  } catch {
    target.removeItem(KHATMA_STORAGE_KEY)
    return null
  }
}

export function saveKhatmaPlan(plan: KhatmaPlan | null, storage?: KhatmaStorage) {
  const target = resolveStorage(storage)
  if (!target) return
  if (plan) target.setItem(KHATMA_STORAGE_KEY, JSON.stringify(plan))
  else target.removeItem(KHATMA_STORAGE_KEY)
  if (typeof window !== "undefined") window.dispatchEvent(new Event(KHATMA_CHANGE_EVENT))
}
