import {
  getOfflineQuranIndex,
  rebuildOfflineQuranIndex,
  type OfflineQuranIndexEntry,
} from "@/lib/offline-quran-search"

const EXACT_DB_NAME = "wird-offline-mutashabihat-v1"
const EXACT_STORE = "responses"
const EXPECTED_VERSE_COUNT = 6236
const MAX_RESULTS = 12

type TextSegment = {
  text: string
  highlighted: boolean
}

export type OfflineMutashabihatResponse = {
  verseKey: string
  source: {
    verseKey: string
    surah: number
    ayah: number
    surahName: string
    page: number
    text: string
  } | null
  similar: Array<{
    verseKey: string
    surah: number
    ayah: number
    surahName: string
    page: number
    text: string
    similarity: number
    sharedWords: number
    segments: TextSegment[]
    sourceSegments: TextSegment[]
  }>
  totalSimilar?: number
  methodology?: "similar" | "local"
  offline?: boolean
  cached?: boolean
}

export type OfflineMutashabihatStatus = {
  ready: boolean
  verses: number
  total: number
}

function openExactDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(EXACT_DB_NAME, 1)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(EXACT_STORE)) {
        request.result.createObjectStore(EXACT_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function storeExactMutashabihat(response: OfflineMutashabihatResponse) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return
  const database = await openExactDatabase()
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(EXACT_STORE, "readwrite")
    transaction.objectStore(EXACT_STORE).put(response, response.verseKey)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  database.close()
}

export async function readExactMutashabihat(verseKey: string) {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null
  const database = await openExactDatabase()
  return new Promise<OfflineMutashabihatResponse | null>((resolve, reject) => {
    const transaction = database.transaction(EXACT_STORE, "readonly")
    const request = transaction.objectStore(EXACT_STORE).get(verseKey)
    request.onsuccess = () => resolve((request.result as OfflineMutashabihatResponse | undefined) ?? null)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}

function words(value: string) {
  return value.split(/\s+/).filter(Boolean)
}

function sharedWordCount(firstWords: string[], secondWords: string[]) {
  const counts = new Map<string, number>()
  for (const word of secondWords) counts.set(word, (counts.get(word) ?? 0) + 1)
  let shared = 0
  for (const word of firstWords) {
    const count = counts.get(word) ?? 0
    if (count <= 0) continue
    shared += 1
    counts.set(word, count - 1)
  }
  return shared
}

function sharedSegments(text: string, otherNormalizedText: string) {
  const otherWords = new Set(words(otherNormalizedText))
  const normalizedWords = words(normalizeArabic(text))
  const originalWords = text.match(/\S+\s*/g) ?? [text]
  const segments = originalWords.map((word, index) => ({
    text: word,
    highlighted: otherWords.has(normalizedWords[index] ?? ""),
  }))
  return segments.reduce<TextSegment[]>((merged, segment) => {
    const previous = merged.at(-1)
    if (previous?.highlighted === segment.highlighted) previous.text += segment.text
    else merged.push({ ...segment })
    return merged
  }, [])
}

function normalizeArabic(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[^\u0621-\u064A\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function toSource(entry: OfflineQuranIndexEntry) {
  const [surah, ayah] = entry.verseKey.split(":").map(Number)
  return {
    verseKey: entry.verseKey,
    surah,
    ayah,
    surahName: entry.surahName,
    page: entry.page,
    text: entry.text,
  }
}

export async function inspectOfflineMutashabihat(): Promise<OfflineMutashabihatStatus> {
  if (typeof window === "undefined") return { ready: false, verses: 0, total: EXPECTED_VERSE_COUNT }
  const index = await getOfflineQuranIndex()
  return { ready: index.length >= EXPECTED_VERSE_COUNT, verses: index.length, total: EXPECTED_VERSE_COUNT }
}

export async function prepareOfflineMutashabihat() {
  if (typeof window === "undefined") return { ready: false, verses: 0, total: EXPECTED_VERSE_COUNT }
  const index = await rebuildOfflineQuranIndex()
  return { ready: index.length >= EXPECTED_VERSE_COUNT, verses: index.length, total: EXPECTED_VERSE_COUNT }
}

export async function findOfflineMutashabihat(verseKey: string): Promise<OfflineMutashabihatResponse | null> {
  if (typeof window === "undefined") return null
  const exact = await readExactMutashabihat(verseKey).catch(() => null)
  if (exact) return { ...exact, offline: true, cached: true }

  const index = await getOfflineQuranIndex()
  const source = index.find((entry) => entry.verseKey === verseKey)
  if (!source || index.length < EXPECTED_VERSE_COUNT) return null
  const sourceWords = words(source.normalizedText)
  const sourceSet = new Set(sourceWords)
  const candidates = index.flatMap((entry) => {
    if (entry.verseKey === verseKey) return []
    const targetWords = words(entry.normalizedText)
    const sharedWords = sharedWordCount(sourceWords, targetWords)
    const minimumLength = Math.min(sourceWords.length, targetWords.length)
    const requiredWords = Math.max(4, Math.ceil(minimumLength * 0.65))
    if (sharedWords < requiredWords) return []
    const score = Math.round((200 * sharedWords) / (sourceWords.length + targetWords.length))
    if (score < 60) return []
    return [{ entry, targetWords, sharedWords, score }]
  }).sort((first, second) => second.score - first.score || second.sharedWords - first.sharedWords)

  const similar = candidates.slice(0, MAX_RESULTS).map(({ entry, targetWords, sharedWords, score }) => {
    const target = toSource(entry)
    return {
      ...target,
      similarity: score,
      sharedWords,
      segments: sharedSegments(entry.text, source.normalizedText),
      sourceSegments: sharedSegments(source.text, targetWords.filter((word) => sourceSet.has(word)).join(" ")),
    }
  })
  return {
    verseKey,
    source: toSource(source),
    similar,
    totalSimilar: candidates.length,
    methodology: "local",
    offline: true,
  }
}
