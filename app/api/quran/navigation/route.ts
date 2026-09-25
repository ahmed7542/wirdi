import {
  getQuranSearchMatchGroup,
  rankQuranSearchResults,
  type QuranSearchMatchGroup,
} from "@/lib/quran-search-ranking"
import { sanitizeQuranSearchText } from "@/lib/quran-search-text"
import {
  findPage,
  getJuzMeta,
  getPageMeta,
  getRubAlHizbMeta,
  getSurahMeta,
  isValidSurahAyah,
  type AyahNo,
  type Juz,
  type Page,
  type RubAlHizbId,
  type Surah,
} from "quran-meta/hafs"

const QURAN_API_URL = "https://api.quran.com/api/v4"

const COMMON_VERSE_NAMES = new Map<string, readonly [number, number]>([
  ["ايه الكرسي", [2, 255]],
  ["ايه الدين", [2, 282]],
  ["ايه النور", [24, 35]],
])

type VerseResponse = {
  verse?: {
    text_qpc_hafs?: string
  }
}

type SearchResponse = {
  search?: {
    results?: Array<{
      verse_key: string
      text: string
    }>
  }
}

type NavigationSearchResult = {
  kind: "surah" | "juz" | "hizb"
  verseKey: string
  surahName: string
  ayah: number
  text: string
  page: number
  title: string
  matchGroup?: QuranSearchMatchGroup
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
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
}

function verseKey(pair: readonly [number, number]) {
  return `${pair[0]}:${pair[1]}`
}

function pageFor(pair: readonly [number, number]) {
  return findPage(pair[0] as Surah, pair[1] as AyahNo)
}

function buildNavigation() {
  const chapters = Array.from({ length: 114 }, (_, index) => {
    const chapter = (index + 1) as Surah
    const meta = getSurahMeta(chapter)
    return {
      id: chapter,
      name: meta.name,
      verseCount: meta.ayahCount,
      startPage: findPage(chapter, 1),
      endPage: findPage(chapter, meta.ayahCount),
      versePages: Array.from(
        { length: meta.ayahCount },
        (_, ayahIndex) => findPage(chapter, (ayahIndex + 1) as AyahNo),
      ),
    }
  })

  const juzs = Array.from({ length: 30 }, (_, index) => {
    const number = (index + 1) as Juz
    const meta = getJuzMeta(number)
    return {
      number,
      startPage: pageFor(meta.first),
      endPage: pageFor(meta.last),
      firstVerseKey: verseKey(meta.first),
      lastVerseKey: verseKey(meta.last),
    }
  })

  const hizbs = Array.from({ length: 60 }, (_, index) => {
    const number = index + 1
    const firstQuarter = getRubAlHizbMeta(((number - 1) * 4 + 1) as RubAlHizbId)
    const lastQuarter = getRubAlHizbMeta((number * 4) as RubAlHizbId)
    return {
      number,
      startPage: pageFor(firstQuarter.first),
      endPage: pageFor(lastQuarter.last),
      firstVerseKey: verseKey(firstQuarter.first),
      lastVerseKey: verseKey(lastQuarter.last),
    }
  })

  const pages = Array.from({ length: 604 }, (_, index) => {
    const number = (index + 1) as Page
    const meta = getPageMeta(number)
    return {
      number,
      firstVerseKey: verseKey(meta.first),
      lastVerseKey: verseKey(meta.last),
    }
  })

  return { chapters, juzs, hizbs, pages }
}

const NAVIGATION = buildNavigation()

function navigationResults(query: string): NavigationSearchResult[] {
  const normalizedQuery = normalizeArabic(normalizeDigits(query))
    .replace(/^(?:سوره|سورة)\s+/, "")
    .trim()

  const juzMatch = normalizedQuery.match(/^(?:ال)?جزء\s*(?:رقم\s*)?(\d{1,2})$/)
  if (juzMatch) {
    const juz = NAVIGATION.juzs.find((item) => item.number === Number(juzMatch[1]))
    if (!juz) return []
    const [surah, ayah] = juz.firstVerseKey.split(":").map(Number)
    return [{
      kind: "juz",
      verseKey: juz.firstVerseKey,
      surahName: getSurahMeta(surah as Surah).name,
      ayah,
      text: `بداية الجزء ${juz.number}`,
      page: juz.startPage,
      title: `الجزء ${juz.number}`,
    }]
  }

  const hizbMatch = normalizedQuery.match(/^(?:ال)?حزب\s*(?:رقم\s*)?(\d{1,2})$/)
  if (hizbMatch) {
    const hizb = NAVIGATION.hizbs.find((item) => item.number === Number(hizbMatch[1]))
    if (!hizb) return []
    const [surah, ayah] = hizb.firstVerseKey.split(":").map(Number)
    return [{
      kind: "hizb",
      verseKey: hizb.firstVerseKey,
      surahName: getSurahMeta(surah as Surah).name,
      ayah,
      text: `بداية الحزب ${hizb.number}`,
      page: hizb.startPage,
      title: `الحزب ${hizb.number}`,
    }]
  }

  if (!normalizedQuery) return []
  return NAVIGATION.chapters
    .filter((chapter) => normalizeArabic(chapter.name).includes(normalizedQuery))
    .slice(0, 8)
    .map((chapter) => ({
      kind: "surah" as const,
      verseKey: `${chapter.id}:1`,
      surahName: chapter.name,
      ayah: 1,
      text: `الانتقال إلى بداية سورة ${chapter.name}`,
      page: chapter.startPage,
      title: `سورة ${chapter.name}`,
    }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get("q")?.trim()

  if (!query) {
    return Response.json(NAVIGATION, {
      headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=604800" },
    })
  }

  const directVerse = query.match(/^(\d{1,3})\s*[:：]\s*(\d{1,3})$/)
  const commonVerse = COMMON_VERSE_NAMES.get(normalizeArabic(normalizeDigits(query)))
  if (directVerse || commonVerse) {
    const pair: [number, number] = directVerse
      ? [Number(directVerse[1]), Number(directVerse[2])]
      : [...commonVerse!] as [number, number]
    if (!isValidSurahAyah(pair)) {
      return Response.json({ results: [] })
    }
    const [chapter, verse] = pair
    const verseUrl = new URL(`${QURAN_API_URL}/verses/by_key/${chapter}:${verse}`)
    verseUrl.searchParams.set("fields", "text_qpc_hafs")
    const response = await fetch(verseUrl, { next: { revalidate: 60 * 60 * 24 * 30 } })
    const data = response.ok ? (await response.json()) as VerseResponse : null
    return Response.json({
      results: [{
        verseKey: `${chapter}:${verse}`,
        surahName: getSurahMeta(chapter as Surah).name,
        ayah: verse,
        text: sanitizeQuranSearchText(data?.verse?.text_qpc_hafs ?? `الآية ${chapter}:${verse}`),
        page: findPage(chapter, verse),
        matchGroup: "direct" as const,
      }],
      directResultCount: 1,
      relatedResultCount: 0,
    })
  }

  if (query.length < 2 || query.length > 100) {
    return Response.json({ results: [] })
  }

  const localResults = navigationResults(query)
  const isDirectNavigation = localResults.some((result) => result.kind === "juz" || result.kind === "hizb")
  if (isDirectNavigation) return Response.json({
    results: localResults,
    directResultCount: localResults.length,
    relatedResultCount: 0,
  })

  try {
    const searchUrl = new URL(`${QURAN_API_URL}/search`)
    searchUrl.searchParams.set("q", query)
    searchUrl.searchParams.set("size", "50")
    searchUrl.searchParams.set("page", "0")
    const response = await fetch(searchUrl, { next: { revalidate: 60 * 60 * 24 } })
    if (response.status === 204) return Response.json({ results: [] })
    if (!response.ok) throw new Error(`Quran search returned ${response.status}`)

    const data = (await response.json()) as SearchResponse
    const verseResults = (data.search?.results ?? []).flatMap((result) => {
      const pair = result.verse_key.split(":").map(Number) as [number, number]
      if (!isValidSurahAyah(pair)) return []
      return [{
        kind: "verse" as const,
        verseKey: result.verse_key,
        surahName: getSurahMeta(pair[0] as Surah).name,
        ayah: pair[1],
        text: sanitizeQuranSearchText(result.text),
        page: findPage(pair[0], pair[1]),
      }]
    })
    const seen = new Set(localResults.map((result) => result.verseKey))
    const combinedResults = [...localResults, ...verseResults.filter((result) => !seen.has(result.verseKey))]
    const rankedResults = rankQuranSearchResults(combinedResults, query).slice(0, 50)
    const results = rankedResults.map((result) => ({
      ...result,
      matchGroup: getQuranSearchMatchGroup(result, query),
    }))
    const directResultCount = results.filter((result) => result.matchGroup === "direct").length
    const relatedResultCount = results.length - directResultCount

    return Response.json({ results, directResultCount, relatedResultCount }, {
      headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600" },
    })
  } catch (error) {
    console.error("Failed to search Quran", error)
    if (localResults.length > 0) return Response.json({
      results: localResults,
      directResultCount: localResults.length,
      relatedResultCount: 0,
    })
    return Response.json({ error: "تعذر البحث الآن" }, { status: 502 })
  }
}
