export type QuranSearchRankable = {
  verseKey: string
  text: string
}

export function normalizeQuranSearchRankingText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/\u0670/g, "ا")
    .normalize("NFKD")
    .replace(/[\p{M}\u0610-\u061A\u06D6-\u06ED]/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function matchRank(text: string, query: string) {
  if (!text || !query) return 2
  if (text === query) return 0
  return ` ${text} `.includes(` ${query} `) ? 1 : 2
}

function verseOrder(verseKey: string) {
  const [chapter, ayah] = verseKey.split(":").map(Number)
  return {
    chapter: Number.isInteger(chapter) ? chapter : Number.MAX_SAFE_INTEGER,
    ayah: Number.isInteger(ayah) ? ayah : Number.MAX_SAFE_INTEGER,
  }
}

export function rankQuranSearchResults<T extends QuranSearchRankable>(results: readonly T[], query: string) {
  const normalizedQuery = normalizeQuranSearchRankingText(query)
  return results
    .map((result, index) => ({
      result,
      index,
      rank: matchRank(normalizeQuranSearchRankingText(result.text), normalizedQuery),
    }))
    .sort((first, second) => {
      if (first.rank !== second.rank) return first.rank - second.rank
      if (first.rank < 2) {
        const firstVerse = verseOrder(first.result.verseKey)
        const secondVerse = verseOrder(second.result.verseKey)
        return firstVerse.chapter - secondVerse.chapter ||
          firstVerse.ayah - secondVerse.ayah ||
          first.index - second.index
      }
      return first.index - second.index
    })
    .map(({ result }) => result)
}
