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

function findChapterByName(data: QuranSearchNavigationData, value: string, exact = false) {
  const normalizedValue = normalizeQuranSmartQuery(value).replace(/^(?:سوره|السوره)\s+/, "").trim()
  return data.chapters.filter((chapter) => {
    const name = normalizeQuranSmartQuery(chapter.name)
    return exact ? name === normalizedValue : name.includes(normalizedValue)
  })
}

function verseResult(data: QuranSearchNavigationData, verseKey: string): QuranSmartSearchResult | null {
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
    title: `سورة ${chapter.name} · الآية ${ayah}`,
    detail: `صفحة ${page} · ${verseKey}`,
  }
}

function surahResult(chapter: QuranSearchChapter): QuranSmartSearchResult {
  return {
    id: `surah-${chapter.id}`,
    kind: "surah",
    startPage: chapter.startPage,
    endPage: chapter.endPage,
    startVerseKey: `${chapter.id}:1`,
    endVerseKey: `${chapter.id}:${chapter.verseCount}`,
    title: `سورة ${chapter.name}`,
    detail: `${chapter.verseCount} آية · الصفحات ${chapter.startPage}–${chapter.endPage}`,
  }
}

function divisionResult(division: QuranSearchDivision, kind: "juz" | "hizb"): QuranSmartSearchResult {
  const label = kind === "juz" ? "الجزء" : "الحزب"
  return {
    id: `${kind}-${division.number}`,
    kind,
    startPage: division.startPage,
    endPage: division.endPage,
    startVerseKey: division.firstVerseKey,
    endVerseKey: division.lastVerseKey,
    title: `${label} ${division.number}`,
    detail: `الصفحات ${division.startPage}–${division.endPage}`,
  }
}

function pageResult(page: QuranSearchPage): QuranSmartSearchResult {
  return {
    id: `page-${page.number}`,
    kind: "page",
    startPage: page.number,
    endPage: page.number,
    startVerseKey: page.firstVerseKey,
    endVerseKey: page.lastVerseKey,
    title: `الصفحة ${page.number}`,
    detail: `صفحة ${page.number} من المصحف`,
  }
}

export function searchQuranNavigationLocally(data: QuranSearchNavigationData, query: string): QuranSmartSearchResult[] {
  const normalized = normalizeQuranSmartQuery(query)
  if (!normalized) return []

  const directVerse = normalized.match(/^(\d{1,3})\s*[:：]\s*(\d{1,3})$/)
  if (directVerse) {
    const result = verseResult(data, `${Number(directVerse[1])}:${Number(directVerse[2])}`)
    return result ? [result] : []
  }

  const juzMatch = normalized.match(/^(?:ال)?جزء\s*(?:رقم\s*)?(\d{1,2})$/)
  if (juzMatch) {
    const division = data.juzs.find((item) => item.number === Number(juzMatch[1]))
    return division ? [divisionResult(division, "juz")] : []
  }

  const hizbMatch = normalized.match(/^(?:ال)?حزب\s*(?:رقم\s*)?(\d{1,2})$/)
  if (hizbMatch) {
    const division = data.hizbs.find((item) => item.number === Number(hizbMatch[1]))
    return division ? [divisionResult(division, "hizb")] : []
  }

  const pageMatch = normalized.match(/^(?:ص|صفحه|الصفحه)\s*(?:رقم\s*)?(\d{1,3})$/)
  if (pageMatch) {
    const page = data.pages.find((item) => item.number === Number(pageMatch[1]))
    return page ? [pageResult(page)] : []
  }

  const ayahAfterSurah = normalized.match(/^(?:سوره\s+)?(.+?)\s+(?:ايه|الايه)\s*(\d{1,3})$/)
  const ayahBeforeSurah = normalized.match(/^(?:ايه|الايه)\s*(\d{1,3})\s+(?:من\s+)?(?:سوره\s+)?(.+)$/)
  const plainSurahAyah = normalized.match(/^(.+?)\s+(\d{1,3})$/)
  const chapterQuery = ayahAfterSurah?.[1] ?? ayahBeforeSurah?.[2] ?? plainSurahAyah?.[1]
  const ayahQuery = Number(ayahAfterSurah?.[2] ?? ayahBeforeSurah?.[1] ?? plainSurahAyah?.[2])
  if (chapterQuery && ayahQuery) {
    const chapter = findChapterByName(data, chapterQuery, true)[0]
    const result = chapter ? verseResult(data, `${chapter.id}:${ayahQuery}`) : null
    return result ? [result] : []
  }

  if (/^\d{1,3}$/.test(normalized)) {
    const number = Number(normalized)
    const results: QuranSmartSearchResult[] = []
    const chapter = data.chapters.find((item) => item.id === number)
    const juz = data.juzs.find((item) => item.number === number)
    const hizb = data.hizbs.find((item) => item.number === number)
    const page = data.pages.find((item) => item.number === number)
    if (chapter) results.push(surahResult(chapter))
    if (juz) results.push(divisionResult(juz, "juz"))
    if (hizb) results.push(divisionResult(hizb, "hizb"))
    if (page) results.push(pageResult(page))
    return results.sort((first, second) => first.startPage - second.startPage || first.id.localeCompare(second.id))
  }

  const chapterNameQuery = normalized.replace(/^(?:سوره|السوره)\s+/, "").trim()
  return chapterNameQuery
    ? findChapterByName(data, chapterNameQuery).slice(0, 12).map(surahResult)
    : []
}

export function isQuranSearchQueryReady(query: string) {
  const normalized = normalizeQuranSmartQuery(query)
  return normalized.length >= 2 || /^\d$/.test(normalized)
}

export function isStructuralQuranSearch(query: string) {
  const normalized = normalizeQuranSmartQuery(query)
  return /^(?:(?:ال)?(?:جزء|حزب)\s*(?:رقم\s*)?\d+|(?:ص|صفحه|الصفحه)\s*(?:رقم\s*)?\d+|(?:سوره|السوره)\s+.+|\d+\s*[:：]\s*\d+|\d+|(?:سوره\s+)?(.+?)\s+(?:ايه|الايه)\s*\d+|(?:ايه|الايه)\s*\d+\s+(?:من\s+)?(?:سوره\s+)?(.+)|.+\s+\d{1,3})$/.test(normalized)
}
