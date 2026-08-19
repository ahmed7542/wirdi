export const BOOKMARK_CATEGORIES_STORAGE_KEY = "wird-bookmark-categories-v1"
export const MAX_BOOKMARK_CATEGORIES = 12
export const MAX_BOOKMARK_CATEGORY_LABEL_LENGTH = 32

export type BookmarkCategory = {
  id: string
  label: string
}

export const DEFAULT_BOOKMARK_CATEGORIES: BookmarkCategory[] = [
  { id: "memorization", label: "حفظ" },
  { id: "review", label: "مراجعة" },
  { id: "similar", label: "متشابهات" },
  { id: "question", label: "سؤال" },
  { id: "favorite", label: "مفضل" },
]

function normalizeCategory(value: unknown): BookmarkCategory | null {
  if (!value || typeof value !== "object") return null
  const candidate = value as Partial<BookmarkCategory>
  const id = typeof candidate.id === "string" ? candidate.id.trim() : ""
  const label = typeof candidate.label === "string" ? candidate.label.trim() : ""
  if (!id || id.length > 80 || !label || label.length > MAX_BOOKMARK_CATEGORY_LABEL_LENGTH) return null
  return { id, label }
}

export function normalizeBookmarkCategories(value: unknown): BookmarkCategory[] {
  if (!Array.isArray(value)) return [...DEFAULT_BOOKMARK_CATEGORIES]
  const seenIds = new Set<string>()
  const seenLabels = new Set<string>()
  const categories: BookmarkCategory[] = []
  for (const valueItem of value) {
    const category = normalizeCategory(valueItem)
    if (!category) continue
    const normalizedLabel = category.label.toLocaleLowerCase("ar")
    if (seenIds.has(category.id) || seenLabels.has(normalizedLabel)) continue
    seenIds.add(category.id)
    seenLabels.add(normalizedLabel)
    categories.push(category)
    if (categories.length === MAX_BOOKMARK_CATEGORIES) break
  }
  return value.length > 0 && categories.length === 0
    ? [...DEFAULT_BOOKMARK_CATEGORIES]
    : categories
}

export function loadBookmarkCategories(storage: Storage): BookmarkCategory[] {
  const value = storage.getItem(BOOKMARK_CATEGORIES_STORAGE_KEY)
  if (value === null) return [...DEFAULT_BOOKMARK_CATEGORIES]
  try {
    return normalizeBookmarkCategories(JSON.parse(value))
  } catch {
    storage.removeItem(BOOKMARK_CATEGORIES_STORAGE_KEY)
    return [...DEFAULT_BOOKMARK_CATEGORIES]
  }
}

export function saveBookmarkCategories(storage: Storage, categories: BookmarkCategory[]) {
  storage.setItem(BOOKMARK_CATEGORIES_STORAGE_KEY, JSON.stringify(categories))
}

export function createBookmarkCategoryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `custom-${crypto.randomUUID()}`
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
