export type QuranSearchMatchGroup = "direct" | "related"

export type QuranSearchRankable = {
  verseKey: string
  text: string
  title?: string
  matchGroup?: QuranSearchMatchGroup
}

export type QuranSearchHighlightSegment = {
  text: string
  highlighted: boolean
}

type MatchAnalysis = { group: QuranSearchMatchGroup; score: number }
type NormalizedSource = { value: string; starts: number[]; ends: number[] }

const EMPTY_MATCH: MatchAnalysis = { group: "related", score: 0 }

function normalizeCharacter(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\p{M}\u0610-\u061A\u06D6-\u06ED]/gu, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
}

function normalizedSource(value: string): NormalizedSource {
  const starts: number[] = []
  const ends: number[] = []
  let normalized = ""
  let sourceOffset = 0

  for (const character of Array.from(value)) {
    const characterEnd = sourceOffset + character.length
    for (const item of Array.from(normalizeCharacter(character))) {
      const output = /[\p{L}\p{N}]/u.test(item) ? item.toLocaleLowerCase() : " "
      if (output === " " && (!normalized || normalized.endsWith(" "))) continue
      normalized += output
      starts.push(sourceOffset)
      ends.push(characterEnd)
    }
    sourceOffset = characterEnd
  }

  if (normalized.endsWith(" ")) {
    normalized = normalized.slice(0, -1)
    starts.pop()
    ends.pop()
  }
  return { value: normalized, starts, ends }
}

export function normalizeQuranSearchRankingText(value: string) {
  return normalizedSource(value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " "))
    .value
}

function wholePhraseIndex(text: string, query: string) {
  let index = text.indexOf(query)
  while (index >= 0) {
    const end = index + query.length
    if ((index === 0 || text[index - 1] === " ") && (end === text.length || text[end] === " ")) return index
    index = text.indexOf(query, index + 1)
  }
  return -1
}

function comparableToken(value: string) {
  let token = value
  if (/^[وف]/.test(token) && token.length > 4) token = token.slice(1)
  if (token.startsWith("ال") && token.length > 4) token = token.slice(2)
  return token
}

function isOneEditApart(first: string, second: string) {
  if (Math.abs(first.length - second.length) > 1) return false
  let short = first
  let long = second
  if (short.length > long.length) [short, long] = [long, short]
  let shortIndex = 0
  let longIndex = 0
  let edits = 0
  while (shortIndex < short.length && longIndex < long.length) {
    if (short[shortIndex] === long[longIndex]) {
      shortIndex += 1
      longIndex += 1
      continue
    }
    edits += 1
    if (edits > 1) return false
    if (short.length === long.length) shortIndex += 1
    longIndex += 1
  }
  return edits + (long.length - longIndex) <= 1
}

function tokenSimilarity(queryToken: string, targetToken: string) {
  if (queryToken === targetToken) return 1
  const queryComparable = comparableToken(queryToken)
  const targetComparable = comparableToken(targetToken)
  if (queryComparable === targetComparable && queryComparable.length >= 2) return 0.94
  const shortestLength = Math.min(queryComparable.length, targetComparable.length)
  if (shortestLength >= 4 && (queryComparable.includes(targetComparable) || targetComparable.includes(queryComparable))) return 0.82
  if (shortestLength >= 5 && isOneEditApart(queryComparable, targetComparable)) return 0.72
  return 0
}

function analyzeText(text: string, normalizedQuery: string): MatchAnalysis {
  const normalizedText = normalizeQuranSearchRankingText(text)
  if (!normalizedText || !normalizedQuery) return EMPTY_MATCH
  if (normalizedText === normalizedQuery) return { group: "direct", score: 6000 }
  if (wholePhraseIndex(normalizedText, normalizedQuery) >= 0) return { group: "direct", score: 5000 }

  const queryTokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))]
  const targetTokens = normalizedText.split(" ").filter(Boolean)
  if (queryTokens.length === 0 || targetTokens.length === 0) return EMPTY_MATCH

  const matchedPositions: number[] = []
  let similarityTotal = 0
  for (const queryToken of queryTokens) {
    let bestSimilarity = 0
    let bestPosition = -1
    targetTokens.forEach((targetToken, position) => {
      const similarity = tokenSimilarity(queryToken, targetToken)
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestPosition = position
      }
    })
    if (bestPosition >= 0 && bestSimilarity >= 0.72) matchedPositions.push(bestPosition)
    similarityTotal += bestSimilarity
  }

  const matchedRatio = matchedPositions.length / queryTokens.length
  const similarity = similarityTotal / queryTokens.length
  if (matchedPositions.length === 0) return EMPTY_MATCH
  const ordered = matchedPositions.every((position, index) => index === 0 || position > matchedPositions[index - 1])
  if (matchedRatio === 1 && ordered) return { group: "related", score: 3200 + similarity * 500 }
  if (matchedRatio === 1) return { group: "related", score: 2700 + similarity * 500 }
  return { group: "related", score: 900 + matchedRatio * 1100 + similarity * 600 }
}

function analyzeResult(result: QuranSearchRankable, query: string): MatchAnalysis {
  const normalizedQuery = normalizeQuranSearchRankingText(query)
  const textMatch = analyzeText(result.text, normalizedQuery)
  const titleMatch = result.title ? analyzeText(result.title, normalizedQuery) : EMPTY_MATCH
  const best = titleMatch.score > textMatch.score ? titleMatch : textMatch
  if (result.matchGroup === "direct") return { group: "direct", score: Math.max(best.score, 6000) }
  return best
}

export function getQuranSearchMatchGroup(result: QuranSearchRankable, query: string) {
  return analyzeResult(result, query).group
}

export function getQuranSearchMatchScore(result: QuranSearchRankable, query: string) {
  return analyzeResult(result, query).score
}

function verseOrder(verseKey: string) {
  const [chapter, ayah] = verseKey.split(":").map(Number)
  return {
    chapter: Number.isInteger(chapter) ? chapter : Number.MAX_SAFE_INTEGER,
    ayah: Number.isInteger(ayah) ? ayah : Number.MAX_SAFE_INTEGER,
  }
}

export function rankQuranSearchResults<T extends QuranSearchRankable>(results: readonly T[], query: string) {
  return results
    .map((result, index) => ({ result, index, match: analyzeResult(result, query) }))
    .sort((first, second) => {
      if (first.match.group !== second.match.group) return first.match.group === "direct" ? -1 : 1
      if (first.match.score !== second.match.score) return second.match.score - first.match.score
      if (first.match.group === "direct") {
        const firstVerse = verseOrder(first.result.verseKey)
        const secondVerse = verseOrder(second.result.verseKey)
        return firstVerse.chapter - secondVerse.chapter || firstVerse.ayah - secondVerse.ayah || first.index - second.index
      }
      return first.index - second.index
    })
    .map(({ result }) => result)
}

export function getQuranSearchHighlightSegments(text: string, query: string): QuranSearchHighlightSegment[] {
  if (!text || !query || /^\d+\s*[:：]\s*\d+$/.test(query.trim())) return [{ text, highlighted: false }]
  const source = normalizedSource(text)
  const normalizedQuery = normalizeQuranSearchRankingText(query)
  if (!source.value || !normalizedQuery) return [{ text, highlighted: false }]

  const phraseIndex = wholePhraseIndex(source.value, normalizedQuery)
  const ranges: Array<[number, number]> = []
  if (phraseIndex >= 0) {
    ranges.push([source.starts[phraseIndex], source.ends[phraseIndex + normalizedQuery.length - 1]])
  } else {
    const queryTokens = [...new Set(normalizedQuery.split(" ").filter(Boolean))]
    for (const match of source.value.matchAll(/\S+/g)) {
      const targetToken = match[0]
      if (!queryTokens.some((queryToken) => tokenSimilarity(queryToken, targetToken) >= 0.72)) continue
      const start = match.index
      ranges.push([source.starts[start], source.ends[start + targetToken.length - 1]])
    }
  }

  if (ranges.length === 0) return [{ text, highlighted: false }]
  const mergedRanges = ranges.reduce<Array<[number, number]>>((merged, range) => {
    const previous = merged.at(-1)
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1])
    else merged.push([...range])
    return merged
  }, [])
  const segments: QuranSearchHighlightSegment[] = []
  let offset = 0
  for (const [start, end] of mergedRanges) {
    if (start > offset) segments.push({ text: text.slice(offset, start), highlighted: false })
    segments.push({ text: text.slice(start, end), highlighted: true })
    offset = end
  }
  if (offset < text.length) segments.push({ text: text.slice(offset), highlighted: false })
  return segments
}
