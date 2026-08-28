import { findEnglishSurahIds, getEnglishSurahName } from "@/lib/i18n/quran-names"

export type QuranSearchChapter = {
  id: number
  name: string
  verseCount: number
  startPage: number
  endPage: number
  versePages: number[]
}

export type QuranSearchDivision = {
  number: number
  startPage: number
  endPage: number
  firstVerseKey: string
  lastVerseKey: string
}

export type QuranSearchPage = {
  number: number
  firstVerseKey: string
  lastVerseKey: string
}

export type QuranSearchNavigationData = {
  chapters: QuranSearchChapter[]
  juzs: QuranSearchDivision[]
  hizbs: QuranSearchDivision[]
  pages: QuranSearchPage[]
}

export type QuranSearchLanguage = "ar" | "en"

export type QuranSmartSearchResult = {
  id: string
  kind: "surah" | "juz" | "hizb" | "page" | "verse"
  startPage: number
  endPage: number
  startVerseKey: string
  endVerseKey: string
  title: string
  detail: string
  text?: string
}

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
}

export function normalizeQuranSmartQuery(value: string) {
  return normalizeDigits(value)
    .normalize("NFKD")
    .replace(/\u0670/g, "ا")
    .replace(/[\u064B-\u065F\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[،,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isEnglishQuery(value: string) {
  return /[a-z]/i.test(value)
}

function findChapterByName(data: QuranSearchNavigationData, value: string, exact = false) {
  if (isEnglishQuery(value)) {
    const chapterIds = new Set(findEnglishSurahIds(value, exact))
    return data.chapters.filter((chapter) => chapterIds.has(chapter.id))
  }
  const normalizedValue = normalizeQuranSmartQuery(value).replace(/^(?:سوره|السوره)\s+/, "").trim()
  return data.chapters.filter((chapter) => {
    const name = normalizeQuranSmartQuery(chapter.name)
    return exact ? name === normalizedValue : name.includes(normalizedValue)
  })
}

function verseResult(data: QuranSearchNavigationData, verseKey: string, english = false): QuranSmartSearchResult | null {
  const [chapterId, ayah] = verseKey.split(":").map(Number)
  const chapter = data.chapters.find((item) => item.id === chapterId)
  const page = chapter?.versePages[ayah - 1]
  if (!chapter || !page || ayah < 1 || ayah > chapter.verseCount) return null
  return {
    id: `verse-${verseKey}`,
    kind: "verse",
    startPage: page,
    endPage: page,
    startVerseKey: verseKey,
    endVerseKey: verseKey,
    title: english
      ? `Surah ${getEnglishSurahName(chapter.id)} · Ayah ${ayah}`
      : `سورة ${chapter.name} · الآية ${ayah}`,
    detail: english ? `Page ${page} · ${verseKey}` : `صفحة ${page} · ${verseKey}`,
  }
}

function surahResult(chapter: QuranSearchChapter, english = false): QuranSmartSearchResult {
  return {
    id: `surah-${chapter.id}`,
    kind: "surah",
    startPage: chapter.startPage,
    endPage: chapter.endPage,
    startVerseKey: `${chapter.id}:1`,
    endVerseKey: `${chapter.id}:${chapter.verseCount}`,
    title: english ? `Surah ${getEnglishSurahName(chapter.id)}` : `سورة ${chapter.name}`,
    detail: english
      ? `${chapter.verseCount} ayahs · pages ${chapter.startPage}–${chapter.endPage}`
      : `${chapter.verseCount} آية · الصفحات ${chapter.startPage}–${chapter.endPage}`,
  }
}

function divisionResult(division: QuranSearchDivision, kind: "juz" | "hizb", english = false): QuranSmartSearchResult {
  const label = english ? (kind === "juz" ? "Juz" : "Hizb") : (kind === "juz" ? "الجزء" : "الحزب")
  return {
    id: `${kind}-${division.number}`,
    kind,
    startPage: division.startPage,
    endPage: division.endPage,
    startVerseKey: division.firstVerseKey,
    endVerseKey: division.lastVerseKey,
    title: `${label} ${division.number}`,
    detail: english
      ? `Pages ${division.startPage}–${division.endPage}`
      : `الصفحات ${division.startPage}–${division.endPage}`,
  }
}

function pageResult(page: QuranSearchPage, english = false): QuranSmartSearchResult {
  return {
    id: `page-${page.number}`,
    kind: "page",
    startPage: page.number,
    endPage: page.number,
    startVerseKey: page.firstVerseKey,
    endVerseKey: page.lastVerseKey,
    title: english ? `Page ${page.number}` : `الصفحة ${page.number}`,
    detail: english ? `Quran page ${page.number}` : `صفحة ${page.number} من المصحف`,
  }
}

export function searchQuranNavigationLocally(
  data: QuranSearchNavigationData,
  query: string,
  interfaceLanguage?: QuranSearchLanguage,
): QuranSmartSearchResult[] {
  const normalized = normalizeQuranSmartQuery(query)
  const english = interfaceLanguage ? interfaceLanguage === "en" : isEnglishQuery(normalized)
  if (!normalized) return []

  const directVerse = normalized.match(/^(\d{1,3})\s*[:：]\s*(\d{1,3})$/)
  if (directVerse) {
    const result = verseResult(data, `${Number(directVerse[1])}:${Number(directVerse[2])}`, english)
    return result ? [result] : []
  }

  const juzMatch = normalized.match(/^(?:(?:ال)?جزء|juz|para)\s*(?:(?:رقم|no\.?|number)\s*)?(\d{1,2})$/i)
  if (juzMatch) {
    const division = data.juzs.find((item) => item.number === Number(juzMatch[1]))
    return division ? [divisionResult(division, "juz", english)] : []
  }

  const hizbMatch = normalized.match(/^(?:(?:ال)?حزب|hizb)\s*(?:(?:رقم|no\.?|number)\s*)?(\d{1,2})$/i)
  if (hizbMatch) {
    const division = data.hizbs.find((item) => item.number === Number(hizbMatch[1]))
    return division ? [divisionResult(division, "hizb", english)] : []
  }

  const pageMatch = normalized.match(/^(?:ص|صفحه|الصفحه|page|p\.?)(?:\s*(?:رقم|no\.?|number))?\s*(\d{1,3})$/i)
  if (pageMatch) {
    const page = data.pages.find((item) => item.number === Number(pageMatch[1]))
    return page ? [pageResult(page, english)] : []
  }

  const ayahAfterSurah = normalized.match(/^(?:(?:سوره|surah|sura)\s+)?(.+?)\s+(?:ايه|الايه|ayah|aya|verse)\s*(\d{1,3})$/i)
  const ayahBeforeSurah = normalized.match(/^(?:ايه|الايه|ayah|aya|verse)\s*(\d{1,3})\s+(?:(?:من|of)\s+)?(?:(?:سوره|surah|sura)\s+)?(.+)$/i)
  const plainSurahAyah = normalized.match(/^(.+?)\s+(\d{1,3})$/)
  const chapterQuery = ayahAfterSurah?.[1] ?? ayahBeforeSurah?.[2] ?? plainSurahAyah?.[1]
  const ayahQuery = Number(ayahAfterSurah?.[2] ?? ayahBeforeSurah?.[1] ?? plainSurahAyah?.[2])
  if (chapterQuery && ayahQuery) {
    const chapter = findChapterByName(data, chapterQuery, true)[0]
    const result = chapter ? verseResult(data, `${chapter.id}:${ayahQuery}`, english) : null
    return result ? [result] : []
  }

  if (/^\d{1,3}$/.test(normalized)) {
    const number = Number(normalized)
    const results: QuranSmartSearchResult[] = []
    const chapter = data.chapters.find((item) => item.id === number)
    const juz = data.juzs.find((item) => item.number === number)
    const hizb = data.hizbs.find((item) => item.number === number)
    const page = data.pages.find((item) => item.number === number)
    if (chapter) results.push(surahResult(chapter, english))
    if (juz) results.push(divisionResult(juz, "juz", english))
    if (hizb) results.push(divisionResult(hizb, "hizb", english))
    if (page) results.push(pageResult(page, english))
    return results.sort((first, second) => first.startPage - second.startPage || first.id.localeCompare(second.id))
  }

  const chapterNameQuery = normalized.replace(/^(?:سوره|السوره|surah|sura|chapter)\s+/i, "").trim()
  return chapterNameQuery
    ? findChapterByName(data, chapterNameQuery).slice(0, 12).map((chapter) => surahResult(chapter, english))
    : []
}

export function isQuranSearchQueryReady(query: string) {
  const normalized = normalizeQuranSmartQuery(query)
  return normalized.length >= 2 || /^\d$/.test(normalized)
}

export function isStructuralQuranSearch(query: string) {
  const normalized = normalizeQuranSmartQuery(query)
  return /^(?:(?:(?:ال)?(?:جزء|حزب)|juz|para|hizb)\s*(?:(?:رقم|no\.?|number)\s*)?\d+|(?:ص|صفحه|الصفحه|page|p\.?)\s*(?:(?:رقم|no\.?|number)\s*)?\d+|(?:سوره|السوره|surah|sura|chapter)\s+.+|\d+\s*[:：]\s*\d+|\d+|(?:(?:سوره|surah|sura)\s+)?(.+?)\s+(?:ايه|الايه|ayah|aya|verse)\s*\d+|(?:ايه|الايه|ayah|aya|verse)\s*\d+\s+(?:(?:من|of)\s+)?(?:(?:سوره|surah|sura)\s+)?(.+)|.+\s+\d{1,3})$/i.test(normalized)
}
