import { load } from "cheerio"
import { unstable_cache } from "next/cache"
import { findPage, isValidSurahAyah, type AyahNo, type Surah } from "quran-meta/hafs"

import mutashabihatIndex from "@/data/mutashabihat-index.json"

type QuranpediaVerse = {
  number: number
  surah: string
  page_number: number
  text: string
}

type QuranpediaSurah = {
  id: number
  name: string
  ayahs: QuranpediaVerse[]
}

type QuranpediaMushaf = {
  surahs: QuranpediaSurah[]
}

type QuranpediaIndex = {
  surahs: QuranpediaSurah[]
  verseByKey: Map<string, QuranpediaVerse>
}

type MutashabihatKind = "identical" | "similar" | "beginning" | "ending"
type MutashabihatFilter = MutashabihatKind | "all"
type VerifiedVerseEntry = [
  ayah: number,
  identicalCount: number,
  similarCount: number,
  beginningCount: number,
  endingCount: number,
  highSimilarityCount: number,
]

type VerifiedIndex = {
  source: string
  version: string
  similarThreshold: number
  highSimilarityThreshold: number
  surahs: Record<string, VerifiedVerseEntry[]>
}

type CategorizedReference = {
  kind: MutashabihatKind
  surah: number
  ayah: number
  similarity: number
  sharedWords: number
}

type TextSegment = {
  text: string
  highlighted: boolean
}

const QURANPEDIA_API_URL = "https://api.quranpedia.net"
const ARABIC_MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g
const MAX_SEARCH_RESULTS = 80
const MUTASHABIHAT_KINDS: MutashabihatKind[] = ["identical", "similar", "beginning", "ending"]
const CACHE_HEADERS = { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=604800" }
let quranpediaIndexPromise: Promise<QuranpediaIndex> | null = null

function normalizeCharacter(character: string) {
  if (/[أإآٱ]/.test(character)) return "ا"
  if (character === "ى") return "ي"
  if (character === "ؤ") return "و"
  if (character === "ئ") return "ي"
  return character
}

function cleanVerseText(text: string) {
  return text.replace(/^\uFEFF+/, "").trim()
}

function normalizeSearchText(text: string) {
  return cleanVerseText(text)
    .normalize("NFKD")
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\u0621-\u064A0-9:\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const loadCachedQuranpediaSurahs = unstable_cache(
  async () => {
    const response = await fetch(`${QURANPEDIA_API_URL}/v1/mushafs/1`, { cache: "no-store" })
    if (!response.ok) throw new Error(`Quranpedia mushaf returned ${response.status}`)
    const mushaf = (await response.json()) as QuranpediaMushaf
    return (mushaf.surahs ?? []).map((surah) => ({
      id: surah.id,
      name: surah.name,
      ayahs: (surah.ayahs ?? []).map((verse) => ({
        number: verse.number,
        surah: verse.surah,
        page_number: verse.page_number,
        text: verse.text,
      })),
    }))
  },
  ["quranpedia-mutashabihat-quran-index-v2"],
  { revalidate: 60 * 60 * 24 * 30, tags: ["quranpedia-mutashabihat-quran-index"] },
)

async function loadQuranpediaIndex() {
  const surahs = await loadCachedQuranpediaSurahs()
  const verseByKey = new Map<string, QuranpediaVerse>()
  for (const surah of surahs) {
    for (const ayah of surah.ayahs ?? []) {
      verseByKey.set(`${surah.id}:${ayah.number}`, ayah)
    }
  }
  return { surahs, verseByKey }
}

function getQuranpediaIndex() {
  if (!quranpediaIndexPromise) {
    quranpediaIndexPromise = loadQuranpediaIndex().catch((error) => {
      quranpediaIndexPromise = null
      throw error
    })
  }
  return quranpediaIndexPromise
}

function normalizedTextWithMap(text: string) {
  let normalized = ""
  const originalIndexes: number[] = []
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (ARABIC_MARKS.test(character)) {
      ARABIC_MARKS.lastIndex = 0
      continue
    }
    ARABIC_MARKS.lastIndex = 0
    const mappedCharacter = normalizeCharacter(character)
    if (/\s/.test(mappedCharacter)) {
      if (!normalized.endsWith(" ")) {
        normalized += " "
        originalIndexes.push(index)
      }
      continue
    }
    normalized += mappedCharacter
    originalIndexes.push(index)
  }
  return { normalized: normalized.trim(), originalIndexes }
}

function sharedWordRanges(sourceText: string, targetText: string) {
  const rangesFor = (text: string, otherText: string) => {
    const mapped = normalizedTextWithMap(text)
    const otherWords = new Set(normalizedTextWithMap(otherText).normalized.match(/\S+/g) ?? [])
    const ranges = [...mapped.normalized.matchAll(/\S+/g)]
      .filter((match) => otherWords.has(match[0]))
      .map((match) => {
        const normalizedStart = match.index ?? 0
        const normalizedEnd = normalizedStart + match[0].length
        const start = mapped.originalIndexes[normalizedStart] ?? 0
        let end = (mapped.originalIndexes[normalizedEnd - 1] ?? text.length - 1) + 1
        while (end < text.length && ARABIC_MARKS.test(text[end])) {
          ARABIC_MARKS.lastIndex = 0
          end += 1
        }
        ARABIC_MARKS.lastIndex = 0
        return { start, end }
      })
    return ranges.reduce<{ start: number; end: number }[]>((merged, range) => {
      const previous = merged.at(-1)
      if (previous && /^\s*$/.test(text.slice(previous.end, range.start))) {
        previous.end = range.end
      } else {
        merged.push({ ...range })
      }
      return merged
    }, [])
  }
  return {
    source: rangesFor(sourceText, targetText),
    target: rangesFor(targetText, sourceText),
  }
}

function segmentText(text: string, ranges: { start: number; end: number }[]): TextSegment[] {
  if (!ranges.length) return [{ text, highlighted: false }]
  const segments: TextSegment[] = []
  let cursor = 0
  for (const range of ranges) {
    if (range.start > cursor) segments.push({ text: text.slice(cursor, range.start), highlighted: false })
    segments.push({ text: text.slice(range.start, range.end), highlighted: true })
    cursor = range.end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), highlighted: false })
  return segments
}

const verifiedIndex = mutashabihatIndex as unknown as VerifiedIndex

function verifiedAyahsForSurah(surah: number) {
  return verifiedIndex.surahs[String(surah)] ?? []
}

function typeCounts(entry: VerifiedVerseEntry) {
  return {
    identical: entry[1],
    similar: entry[2],
    beginning: entry[3],
    ending: entry[4],
  }
}

function countForFilter(entry: VerifiedVerseEntry, filter: MutashabihatFilter, highOnly = false) {
  if (filter === "identical") return entry[1]
  if (filter === "similar") return highOnly ? entry[5] : entry[2]
  if (filter === "beginning") return entry[3]
  if (filter === "ending") return entry[4]
  return entry.slice(1, 5).reduce((total, count) => total + count, 0)
}

function parseFilter(value: string | null): MutashabihatFilter {
  return value === "identical" || value === "similar" || value === "beginning" || value === "ending"
    ? value
    : "all"
}

function parseKindList(value: string | null) {
  return [...new Set((value ?? "").split(",").filter((kind): kind is MutashabihatKind =>
    MUTASHABIHAT_KINDS.includes(kind as MutashabihatKind),
  ))]
}

function parseKinds(value: string | null) {
  const kinds = parseKindList(value)
  return kinds.length > 0 ? kinds : ["identical", "similar"] as MutashabihatKind[]
}

function compareVerseKeys(first: string, second: string) {
  const [firstSurah, firstAyah] = first.split(":").map(Number)
  const [secondSurah, secondAyah] = second.split(":").map(Number)
  return firstSurah - secondSurah || firstAyah - secondAyah
}

function countSharedWords(sourceText: string, targetText: string) {
  const sourceWords = new Set(normalizedTextWithMap(sourceText).normalized.match(/\S+/g) ?? [])
  const targetWords = new Set(normalizedTextWithMap(targetText).normalized.match(/\S+/g) ?? [])
  return [...sourceWords].filter((word) => targetWords.has(word)).length
}

function parseCategorizedReferences(html: string) {
  const $ = load(html)
  const references = new Map<string, CategorizedReference>()
  const addReference = (reference: CategorizedReference) => {
    const key = `${reference.kind}:${reference.surah}:${reference.ayah}`
    const current = references.get(key)
    if (!current || reference.similarity > current.similarity || reference.sharedWords > current.sharedWords) {
      references.set(key, reference)
    }
  }
  const addLinks = (kind: MutashabihatKind, root: ReturnType<typeof $>, similarity = 0, sharedWords = 0) => {
    root.find('a[href*="/surah/1/"]').each((_, anchor) => {
      const match = ($(anchor).attr("href") ?? "").match(/\/surah\/1\/(\d+)#(\d+)/)
      if (!match) return
      addReference({ kind, surah: Number(match[1]), ayah: Number(match[2]), similarity, sharedWords })
    })
  }

  $('[data-embed-tab-panel="similar"] article').each((_, article) => {
    const card = $(article)
    const similarity = Number(card.text().match(/(\d+)%/)?.[1] ?? 0)
    const sharedWords = Number(card.text().match(/(\d+)\s+كلمة\s+مُ?شتركة/)?.[1] ?? 0)
    if (similarity < 100) addLinks("similar", card, similarity, sharedWords)
  })
  addLinks("identical", $('[data-embed-tab-panel="identical"]'), 100)
  for (const kind of ["beginning", "ending"] as const) {
    $(`[data-embed-tab-panel="${kind}"] details`).each((_, detail) => {
      const card = $(detail)
      const sharedWords = Number(card.find("summary > span").first().text().trim() || 0)
      addLinks(kind, card, 0, sharedWords)
    })
  }

  return [...references.values()]
}

function countForKinds(entry: VerifiedVerseEntry, kinds: MutashabihatKind[], highOnly = false) {
  return kinds.reduce((total, kind) => total + countForFilter(entry, kind, highOnly && kind === "similar"), 0)
}

function verseSummary(surah: QuranpediaSurah, verse: QuranpediaVerse) {
  return {
    verseKey: `${surah.id}:${verse.number}`,
    surah: surah.id,
    ayah: verse.number,
    surahName: surah.name.replace(/^سورة\s+/, ""),
    page: verse.page_number,
    text: cleanVerseText(verse.text),
  }
}

function followingVerseContext(surah: QuranpediaSurah, ayah: number, count = 3) {
  const following = surah.ayahs.filter((verse) => verse.number > ayah)
  return {
    followingVerses: following.slice(0, count).map((verse) => verseSummary(surah, verse)),
    hasMoreFollowing: following.length > count,
  }
}

function browseVerse(
  surah: QuranpediaSurah,
  verse: QuranpediaVerse,
  entry: VerifiedVerseEntry,
  kinds: MutashabihatKind[],
) {
  return {
    ...verseSummary(surah, verse),
    similarCount: countForKinds(entry, kinds),
    typeCounts: typeCounts(entry),
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("mode")
  const filter = parseFilter(searchParams.get("type"))
  const browseKinds = searchParams.has("types")
    ? parseKindList(searchParams.get("types"))
    : filter === "all" ? MUTASHABIHAT_KINDS : [filter]

  try {
    const index = await getQuranpediaIndex()

    if (mode === "following") {
      const verseKey = searchParams.get("verseKey") ?? ""
      const pair = verseKey.split(":").map(Number) as [number, number]
      if (!isValidSurahAyah(pair)) {
        return Response.json({ error: "رقم الآية غير صالح" }, { status: 400 })
      }
      const surah = index.surahs.find((item) => item.id === pair[0])
      if (!surah) return Response.json({ error: "تعذر العثور على السورة" }, { status: 404 })
      const context = followingVerseContext(surah, pair[1])
      return Response.json({
        verses: context.followingVerses,
        hasMoreFollowing: context.hasMoreFollowing,
      }, { headers: CACHE_HEADERS })
    }

    const indexedVerses = (activeKinds: MutashabihatKind[], highOnly = false) =>
      index.surahs.flatMap((surah) =>
        verifiedAyahsForSurah(surah.id).flatMap((entry) => {
          const verse = index.verseByKey.get(`${surah.id}:${entry[0]}`)
          return verse && countForKinds(entry, activeKinds, highOnly) > 0
            ? [{ item: browseVerse(surah, verse, entry, activeKinds), entry }]
            : []
        }),
      )

    if (mode === "surahs") {
      const surahs = index.surahs.flatMap((surah) => {
        const count = verifiedAyahsForSurah(surah.id).filter((entry) => countForKinds(entry, browseKinds) > 0).length
        return count > 0 ? [{
          id: surah.id,
          name: surah.name.replace(/^سورة\s+/, ""),
          count,
        }] : []
      })
      return Response.json({
        surahs,
        totalVerses: indexedVerses(browseKinds).length,
        indexVersion: verifiedIndex.version,
        types: browseKinds,
        attribution: { name: "موسوعة القرآن الكريم - Quranpedia", url: verifiedIndex.source },
      }, { headers: CACHE_HEADERS })
    }

    if (mode === "surah") {
      const surahNumber = Number(searchParams.get("surah"))
      const surah = index.surahs.find((item) => item.id === surahNumber)
      if (!surah) return Response.json({ error: "رقم السورة غير صالح" }, { status: 400 })
      const verses = verifiedAyahsForSurah(surahNumber).flatMap((entry) => {
        const verse = index.verseByKey.get(`${surahNumber}:${entry[0]}`)
        return verse && countForKinds(entry, browseKinds) > 0 ? [browseVerse(surah, verse, entry, browseKinds)] : []
      })
      return Response.json({
        surah: { id: surah.id, name: surah.name.replace(/^سورة\s+/, "") },
        verses,
        types: browseKinds,
      }, { headers: CACHE_HEADERS })
    }

    if (mode === "search") {
      const query = normalizeSearchText(searchParams.get("q") ?? "")
      if (query.length < 2) return Response.json({ results: [], total: 0 }, { headers: CACHE_HEADERS })
      const exactKey = query.match(/^(\d{1,3}):\s*(\d{1,3})$/)?.slice(1).map(Number).join(":")
      const matches = indexedVerses(browseKinds).flatMap(({ item }) => {
        const surahName = index.surahs.find((surah) => surah.id === item.surah)?.name ?? ""
        const normalizedVerse = normalizeSearchText(item.text)
        const keyMatch = exactKey === item.verseKey
        const textIndex = normalizedVerse.indexOf(query)
        const surahMatch = normalizeSearchText(surahName).includes(query)
        if (!keyMatch && textIndex < 0 && !surahMatch) return []
        const score = keyMatch ? -2 : textIndex === 0 ? -1 : textIndex >= 0 ? textIndex : 10_000
        return [{ item, score }]
      }).sort((first, second) =>
        first.score - second.score || first.item.surah - second.item.surah || first.item.ayah - second.item.ayah,
      )
      return Response.json({
        results: matches.slice(0, MAX_SEARCH_RESULTS).map((match) => match.item),
        total: matches.length,
        types: browseKinds,
      }, { headers: CACHE_HEADERS })
    }

    if (mode === "range") {
      const kinds = parseKinds(searchParams.get("types"))
      const startPage = Math.min(Math.max(Number(searchParams.get("startPage")) || 1, 1), 604)
      const endPage = Math.min(Math.max(Number(searchParams.get("endPage")) || startPage, startPage), 604)
      const requestedStartVerseKey = searchParams.get("startVerseKey")
      const requestedEndVerseKey = searchParams.get("endVerseKey")
      const startVerseKey = requestedStartVerseKey && /^\d{1,3}:\d{1,3}$/.test(requestedStartVerseKey)
        ? requestedStartVerseKey
        : null
      const endVerseKey = requestedEndVerseKey && /^\d{1,3}:\d{1,3}$/.test(requestedEndVerseKey)
        ? requestedEndVerseKey
        : null
      const verses = indexedVerses(MUTASHABIHAT_KINDS).flatMap(({ item, entry }) => {
        const matchingTypes = kinds.filter((kind) => countForFilter(entry, kind, kind === "similar") > 0)
        return item.page >= startPage &&
          item.page <= endPage &&
          (!startVerseKey || compareVerseKeys(item.verseKey, startVerseKey) >= 0) &&
          (!endVerseKey || compareVerseKeys(item.verseKey, endVerseKey) <= 0) &&
          matchingTypes.length > 0
          ? [{ ...item, matchingTypes }]
          : []
      })
      return Response.json({
        verses,
        total: verses.length,
        types: kinds,
        highSimilarityThreshold: verifiedIndex.highSimilarityThreshold,
      }, { headers: CACHE_HEADERS })
    }

    const verseKey = searchParams.get("verseKey") ?? ""
    const pair = verseKey.split(":").map(Number) as [number, number]
    if (!isValidSurahAyah(pair)) {
      return Response.json({ error: "رقم الآية غير صالح" }, { status: 400 })
    }

    const sourceSurah = index.surahs.find((surah) => surah.id === pair[0])
    const source = index.verseByKey.get(verseKey)
    if (!sourceSurah || !source) return Response.json({ error: "تعذر العثور على الآية" }, { status: 404 })

    const requestedKinds = searchParams.has("types")
      ? parseKindList(searchParams.get("types"))
      : filter === "all" ? MUTASHABIHAT_KINDS : [filter]
    const fragmentResponse = await fetch(
      `${QURANPEDIA_API_URL}/embed?surah=${pair[0]}&ayah=${pair[1]}&type=similar&fragment=1&fonts=0`,
      { next: { revalidate: 60 * 60 * 24 * 30 } },
    )
    if (!fragmentResponse.ok) throw new Error(`Quranpedia similar returned ${fragmentResponse.status}`)
    const references = parseCategorizedReferences(await fragmentResponse.text()).filter((reference) =>
      requestedKinds.includes(reference.kind) &&
      (reference.surah !== pair[0] || reference.ayah !== pair[1]),
    )
    const sourceText = cleanVerseText(source.text)
    const similar = references.sort(
      (first, second) =>
        MUTASHABIHAT_KINDS.indexOf(first.kind) - MUTASHABIHAT_KINDS.indexOf(second.kind) ||
        first.surah - second.surah ||
        first.ayah - second.ayah,
    ).flatMap((reference) => {
      const verse = index.verseByKey.get(`${reference.surah}:${reference.ayah}`)
      if (!verse) return []
      const text = cleanVerseText(verse.text)
      const ranges = sharedWordRanges(sourceText, text)
      const targetSurah = index.surahs.find((surah) => surah.id === reference.surah)
      if (!targetSurah) return []
      return [{
        kind: reference.kind,
        verseKey: `${reference.surah}:${reference.ayah}`,
        surah: reference.surah,
        ayah: reference.ayah,
        surahName: targetSurah.name.replace(/^سورة\s+/, ""),
        page: findPage(reference.surah as Surah, reference.ayah as AyahNo),
        text,
        similarity: reference.similarity,
        sharedWords: reference.sharedWords || countSharedWords(sourceText, text),
        segments: segmentText(text, ranges.target),
        sourceSegments: segmentText(sourceText, ranges.source),
        ...followingVerseContext(targetSurah, reference.ayah),
      }]
    })
    const categoryCounts = Object.fromEntries(MUTASHABIHAT_KINDS.map((kind) => [
      kind,
      similar.filter((item) => item.kind === kind).length,
    ]))

    return Response.json({
      verseKey,
      source: {
        ...verseSummary(sourceSurah, source),
        page: findPage(pair[0] as Surah, pair[1] as AyahNo),
        ...followingVerseContext(sourceSurah, pair[1]),
      },
      similar,
      categoryCounts,
      selectedTypes: requestedKinds,
      totalSimilar: similar.length,
      methodology: "similar",
      attribution: {
        name: "موسوعة القرآن الكريم - Quranpedia",
        url: `${QURANPEDIA_API_URL}/embed?surah=${pair[0]}&ayah=${pair[1]}&type=similar`,
      },
    }, { headers: CACHE_HEADERS })
  } catch (error) {
    console.error("Failed to load verified Mutashabihat", error)
    return Response.json({ error: "تعذر تحميل المتشابهات الموثقة الآن" }, { status: 502 })
  }
}
