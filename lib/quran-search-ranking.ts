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
    .replace(/\u0670/g, "ا")
    .replace(/\u06E5/g, "و")
    .replace(/\u06E6/g, "ي")
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

const SHORT_PREFIXED_WORDS = new Set(["وهو", "فهو", "وهي", "فهي", "وان", "فان"])

function tokenVariants(value: string) {
  const variants = new Set([value])
  const pending = [value]
  while (pending.length > 0) {
    const token = pending.pop()!
    const add = (variant: string) => {
      if (!variant || variants.has(variant)) return
      variants.add(variant)
      pending.push(variant)
    }
    if (/^[وف]/.test(token) && (token.length > 3 || SHORT_PREFIXED_WORDS.has(token))) add(token.slice(1))
    if (/^[بكل]/.test(token) && token.slice(1).startsWith("ال") && token.length > 4) add(token.slice(1))
    if (token.startsWith("ال") && token.length > 4) add(token.slice(2))
  }
  return [...variants]
}

function comparableToken(value: string) {
  return tokenVariants(value).sort((first, second) => first.length - second.length)[0]
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
  const queryVariants = tokenVariants(queryToken)
  const targetVariants = tokenVariants(targetToken)
  if (queryVariants.some((variant) => targetVariants.includes(variant) && variant.length >= 2)) return 0.96

  let bestSimilarity = 0
  for (const queryVariant of queryVariants) {
    for (const targetVariant of targetVariants) {
      const queryComparable = comparableToken(queryVariant)
      const targetComparable = comparableToken(targetVariant)
      const shortestLength = Math.min(queryComparable.length, targetComparable.length)
      if (shortestLength >= 4 && (queryComparable.includes(targetComparable) || targetComparable.includes(queryComparable))) {
        bestSimilarity = Math.max(bestSimilarity, 0.82)
      } else if (shortestLength >= 5 && isOneEditApart(queryComparable, targetComparable)) {
        bestSimilarity = Math.max(bestSimilarity, 0.72)
      }
    }
  }
  return bestSimilarity
}

type TokenAlignment = {
  matched: number
  similarity: number
  first: number
  last: number
}

const EMPTY_ALIGNMENT: TokenAlignment = { matched: 0, similarity: 0, first: -1, last: -1 }

function betterAlignment(first: TokenAlignment, second: TokenAlignment) {
  if (first.matched !== second.matched) return first.matched > second.matched ? first : second
  if (first.similarity !== second.similarity) return first.similarity > second.similarity ? first : second
  const firstSpan = first.matched > 0 ? first.last - first.first + 1 : Number.MAX_SAFE_INTEGER
  const secondSpan = second.matched > 0 ? second.last - second.first + 1 : Number.MAX_SAFE_INTEGER
  return firstSpan <= secondSpan ? first : second
}

function orderedTokenAlignment(queryTokens: string[], targetTokens: string[]) {
  const rows: TokenAlignment[][] = Array.from(
    { length: queryTokens.length + 1 },
    () => Array.from({ length: targetTokens.length + 1 }, () => ({ ...EMPTY_ALIGNMENT })),
  )
  for (let queryIndex = 1; queryIndex <= queryTokens.length; queryIndex += 1) {
    for (let targetIndex = 1; targetIndex <= targetTokens.length; targetIndex += 1) {
      let best = betterAlignment(rows[queryIndex - 1][targetIndex], rows[queryIndex][targetIndex - 1])
      const similarity = tokenSimilarity(queryTokens[queryIndex - 1], targetTokens[targetIndex - 1])
      if (similarity >= 0.72) {
        const previous = rows[queryIndex - 1][targetIndex - 1]
        const matched: TokenAlignment = {
          matched: previous.matched + 1,
          similarity: previous.similarity + similarity,
          first: previous.matched > 0 ? previous.first : targetIndex - 1,
          last: targetIndex - 1,
        }
        best = betterAlignment(best, matched)
      }
      rows[queryIndex][targetIndex] = best
    }
  }
  return rows[queryTokens.length][targetTokens.length]
}

function unorderedTokenAlignment(queryTokens: string[], targetTokens: string[]) {
  const candidates = queryTokens.flatMap((queryToken, queryIndex) => targetTokens.map((targetToken, targetIndex) => ({
    queryIndex,
    targetIndex,
    similarity: tokenSimilarity(queryToken, targetToken),
  })))
    .filter((candidate) => candidate.similarity >= 0.72)
    .sort((first, second) => second.similarity - first.similarity)
  const usedQueries = new Set<number>()
  const usedTargets = new Set<number>()
  let similarity = 0
  for (const candidate of candidates) {
    if (usedQueries.has(candidate.queryIndex) || usedTargets.has(candidate.targetIndex)) continue
    usedQueries.add(candidate.queryIndex)
    usedTargets.add(candidate.targetIndex)
    similarity += candidate.similarity
  }
  return { matched: usedQueries.size, similarity }
}

function directTokenMatch(queryToken: string, targetToken: string) {
  return queryToken === targetToken || tokenVariants(targetToken).includes(queryToken)
}

function hasConsecutiveDirectTokenMatch(queryTokens: string[], targetTokens: string[]) {
  if (queryTokens.length === 0 || queryTokens.length > targetTokens.length) return false
  return targetTokens.some((_, start) => {
    if (start + queryTokens.length > targetTokens.length) return false
    return queryTokens.every((queryToken, offset) => directTokenMatch(queryToken, targetTokens[start + offset]))
  })
}

function analyzeText(text: string, normalizedQuery: string): MatchAnalysis {
  const normalizedText = normalizeQuranSearchRankingText(text)
  if (!normalizedText || !normalizedQuery) return EMPTY_MATCH
  if (normalizedText === normalizedQuery) return { group: "direct", score: 6000 }
  if (wholePhraseIndex(normalizedText, normalizedQuery) >= 0) return { group: "direct", score: 5000 }

  const queryTokens = normalizedQuery.split(" ").filter(Boolean)
  const targetTokens = normalizedText.split(" ").filter(Boolean)
  if (queryTokens.length === 0 || targetTokens.length === 0) return EMPTY_MATCH
  if (hasConsecutiveDirectTokenMatch(queryTokens, targetTokens)) return { group: "direct", score: 4800 }

  const ordered = orderedTokenAlignment(queryTokens, targetTokens)
  const unordered = unorderedTokenAlignment(queryTokens, targetTokens)
  if (unordered.matched === 0) return EMPTY_MATCH

  const unorderedCoverage = unordered.matched / queryTokens.length
  const unorderedSimilarity = unordered.similarity / queryTokens.length
  const orderedCoverage = ordered.matched / queryTokens.length
  const orderedSimilarity = ordered.similarity / queryTokens.length
  if (ordered.matched === queryTokens.length) {
    const span = ordered.last - ordered.first + 1
    const proximity = queryTokens.length / Math.max(span, queryTokens.length)
    return { group: "related", score: 3300 + orderedSimilarity * 400 + proximity * 300 }
  }
  if (unordered.matched === queryTokens.length) {
    return { group: "related", score: 2800 + unorderedSimilarity * 500 }
  }
  return {
    group: "related",
    score: 700 + unorderedCoverage * 1500 + unorderedSimilarity * 500 + orderedCoverage * 300,
  }
}

function analyzeResult(result: QuranSearchRankable, query: string): MatchAnalysis {
  const normalizedQuery = normalizeQuranSearchRankingText(query)
  const textMatch = analyzeText(result.text, normalizedQuery)
  const titleMatch = result.title ? analyzeText(result.title, normalizedQuery) : EMPTY_MATCH
  const best = titleMatch.score > textMatch.score ? titleMatch : textMatch
  if (result.matchGroup === "direct") {
    return best.group === "direct" ? best : { group: "direct", score: 6000 }
  }
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
