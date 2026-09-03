import { OFFLINE_PAGE_CACHE } from "@/lib/offline-audio"
import {
  normalizeQuranSearchRankingText,
  rankQuranSearchResults,
} from "@/lib/quran-search-ranking"
import { sanitizeQuranSearchText } from "@/lib/quran-search-text"

const SEARCH_DB_NAME = "wird-offline-quran-search-v1"
const SEARCH_STORE = "index"
const SEARCH_INDEX_KEY = "verses"
const SEARCH_INDEX_VERSION = 4
const OFFLINE_RECITER = 6

type CachedVerse = {
  verseKey: string
  verseNumber: number
  pageNumber: number
  chapterName: string
  text: string
}

type CachedPage = {
  verses?: CachedVerse[]
}

export type OfflineQuranSearchResult = {
  kind: "verse"
  verseKey: string
  surahName: string
  ayah: number
  text: string
  page: number
}

export type OfflineQuranIndexEntry = OfflineQuranSearchResult & {
  normalizedText: string
}

type StoredQuranSearchIndex = {
  snapshot: string
  entries: OfflineQuranIndexEntry[]
}

type CachedPageResource = {
  page: number
  request: Request
  priority: number
}

function openSearchDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(SEARCH_DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(SEARCH_STORE)) {
        request.result.createObjectStore(SEARCH_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readStoredIndex() {
  if (!("indexedDB" in window)) return null
  const database = await openSearchDatabase()
  return new Promise<StoredQuranSearchIndex | null>((resolve, reject) => {
    const transaction = database.transaction(SEARCH_STORE, "readonly")
    const request = transaction.objectStore(SEARCH_STORE).get(SEARCH_INDEX_KEY)
    request.onsuccess = () => {
      const stored = request.result as StoredQuranSearchIndex | OfflineQuranIndexEntry[] | undefined
      if (Array.isArray(stored)) resolve({ snapshot: "", entries: stored })
      else resolve(stored?.entries && typeof stored.snapshot === "string" ? stored : null)
    }
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}

async function storeIndex(index: StoredQuranSearchIndex) {
  if (!("indexedDB" in window)) return
  const database = await openSearchDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SEARCH_STORE, "readwrite")
    transaction.objectStore(SEARCH_STORE).put(index, SEARCH_INDEX_KEY)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

async function collectCachedPages() {
  const cache = await caches.open(OFFLINE_PAGE_CACHE)
  const pageResources = new Map<number, CachedPageResource>()
  for (const request of await cache.keys()) {
    const url = new URL(request.url)
    if (url.pathname !== "/api/quran") continue
    const page = Number(url.searchParams.get("page"))
    if (!Number.isInteger(page) || page < 1 || page > 604) continue
    const priority = url.searchParams.get("content") === "reading"
      ? 2
      : Number(url.searchParams.get("reciter")) === OFFLINE_RECITER ? 1 : 0
    if (priority === 0 || priority <= (pageResources.get(page)?.priority ?? -1)) continue
    pageResources.set(page, { page, request, priority })
  }
  const resources = [...pageResources.values()].sort((first, second) => first.page - second.page)
  return {
    cache,
    resources,
    snapshot: `v${SEARCH_INDEX_VERSION}:${resources.map((resource) => resource.page).join(",")}`,
  }
}

async function buildIndexFromCache(cached: Awaited<ReturnType<typeof collectCachedPages>>) {
  const pages = await Promise.all(cached.resources.map(async ({ request }) => {
    const response = await cached.cache.match(request)
    if (!response) return null
    return response.json().catch(() => null) as Promise<CachedPage | null>
  }))
  const entries: OfflineQuranIndexEntry[] = []
  for (const data of pages) {
    if (!data) continue
    for (const verse of data.verses ?? []) {
      const text = sanitizeQuranSearchText(verse.text)
      entries.push({
        kind: "verse",
        verseKey: verse.verseKey,
        surahName: verse.chapterName,
        ayah: verse.verseNumber,
        text,
        page: verse.pageNumber,
        normalizedText: normalizeQuranSearchRankingText(text),
      })
    }
  }
  await storeIndex({ snapshot: cached.snapshot, entries })
  return entries
}

let indexPromise: Promise<OfflineQuranIndexEntry[]> | null = null
let indexSnapshot: string | null = null

export async function rebuildOfflineQuranIndex() {
  const cached = await collectCachedPages()
  indexSnapshot = cached.snapshot
  indexPromise = buildIndexFromCache(cached)
  return indexPromise
}

export async function getOfflineQuranIndex() {
  if (!("caches" in window)) return []
  const cached = await collectCachedPages()
  if (indexPromise && indexSnapshot === cached.snapshot) return indexPromise

  indexSnapshot = cached.snapshot
  indexPromise = readStoredIndex()
    .then((stored) => stored?.snapshot === cached.snapshot
      ? stored.entries
      : buildIndexFromCache(cached))
    .catch(() => buildIndexFromCache(cached))
  return indexPromise
}

export async function searchOfflineQuran(query: string) {
  if (typeof window === "undefined") return { results: [] as OfflineQuranSearchResult[], totalResults: 0 }
  const normalizedQuery = normalizeQuranSearchRankingText(query)
  if (normalizedQuery.length < 2) return { results: [] as OfflineQuranSearchResult[], totalResults: 0 }
  const index = await getOfflineQuranIndex()
  const directVerse = query.match(/^(\d{1,3})\s*[:：]\s*(\d{1,3})$/)
  if (directVerse) {
    const verseKey = `${Number(directVerse[1])}:${Number(directVerse[2])}`
    const result = index.find((entry) => entry.verseKey === verseKey)
    return {
      results: result ? [{
        kind: result.kind,
        verseKey: result.verseKey,
        surahName: result.surahName,
        ayah: result.ayah,
        text: result.text,
        page: result.page,
      }] : [],
      totalResults: result ? 1 : 0,
    }
  }
  const matches = index.filter((entry) => entry.normalizedText.includes(normalizedQuery))
  const rankedMatches = rankQuranSearchResults(matches, query)
  return {
    results: rankedMatches.slice(0, 20).map(({ normalizedText: _normalizedText, ...entry }) => entry),
    totalResults: matches.length,
  }
}
