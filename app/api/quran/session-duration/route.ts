import {
  findAyahIdBySurah,
  findSurahAyahByAyahId,
  getAyahCountInSurah,
  getPageMeta,
  type AyahNo,
  type Page,
  type Surah,
} from "quran-meta/hafs"

import {
  AHMED_DEBAN_RECITER_ID,
  getHadrAudioFile,
  HADR_RECITER_IDS,
  YASSER_SALAMA_RECITER_ID,
} from "@/lib/hadr-recitations"
import {
  AL_BANNA_MUJAWWAD_RECITER_ID,
  AL_BANNA_RECITER_ID,
  AL_HUDHAIFY_RECITER_ID,
  CONTINUOUS_CHAPTER_RECITER_IDS,
  getContinuousChapterAudio,
} from "@/lib/mp3quran-recitations"
import { ALIGNED_RECITER_IDS, getAlignedChapterAudio } from "@/lib/quran-recitation-data"

type ChapterTimestamp = {
  verse_key: string
  timestamp_from: number
  timestamp_to: number
}

type ChapterAudioResponse = {
  audio_file?: {
    audio_url?: string
    timestamps?: ChapterTimestamp[]
  }
}

const QURAN_API_URL = "https://api.quran.com/api/v4"
const VALID_RECITERS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 19,
  22, 43, 88, 91, 97, 104, 109, AL_BANNA_RECITER_ID, AL_HUDHAIFY_RECITER_ID,
  AL_BANNA_MUJAWWAD_RECITER_ID, AHMED_DEBAN_RECITER_ID, YASSER_SALAMA_RECITER_ID,
])

function parseVerseKey(value: string | null) {
  const match = value?.match(/^(\d{1,3}):(\d{1,3})$/)
  if (!match) return null
  const chapter = Number(match[1])
  const verse = Number(match[2])
  if (chapter < 1 || chapter > 114) return null
  const verseCount = getAyahCountInSurah(chapter as Surah)
  if (verse < 1 || verse > verseCount) return null
  return [chapter, verse] as const
}

async function fetchChapterAudio(reciter: number, chapter: number, segments: boolean) {
  const url = new URL(`${QURAN_API_URL}/chapter_recitations/${reciter}/${chapter}`)
  url.searchParams.set("segments", String(segments))
  const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } })
  if (!response.ok) throw new Error(`Chapter audio returned ${response.status}`)
  return (await response.json()) as ChapterAudioResponse
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
) {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index])
    }
  }))
  return results
}

async function getChapterTiming(reciter: number, chapter: number) {
  if (CONTINUOUS_CHAPTER_RECITER_IDS.has(reciter)) {
    const continuous = await getContinuousChapterAudio(reciter, chapter)
    return {
      timestamps: continuous.timestamps,
      openingStartMs: continuous.openingStartMs,
      scale: 1,
      approximate: continuous.timingMode === "approximate",
    }
  }
  if (ALIGNED_RECITER_IDS.has(reciter)) {
    const aligned = await getAlignedChapterAudio(reciter, chapter)
    return {
      timestamps: aligned.timestamps,
      openingStartMs: aligned.chapterStartMs,
      scale: 1,
      approximate: aligned.timingMode === "approximate",
    }
  }
  const referenceData = await fetchChapterAudio(reciter, chapter, true)
  const timestamps = referenceData.audio_file?.timestamps ?? []
  const referenceDuration = timestamps.at(-1)?.timestamp_to ?? 0
  if (!timestamps.length || referenceDuration <= 0) {
    throw new Error(`Chapter ${chapter} has no timestamps`)
  }
  return {
    timestamps,
    openingStartMs: 0,
    scale: 1,
    approximate: false,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reciter = Number(searchParams.get("reciter") ?? 6)
  const startPage = Number(searchParams.get("startPage"))
  const endPage = Number(searchParams.get("endPage"))

  if (!VALID_RECITERS.has(reciter)) {
    return Response.json({ error: "القارئ المحدد غير متاح." }, { status: 400 })
  }
  if (
    !Number.isInteger(startPage) || !Number.isInteger(endPage) ||
    startPage < 1 || endPage > 604 || endPage < startPage
  ) {
    return Response.json({ error: "نطاق الصفحات غير صالح." }, { status: 400 })
  }

  const pageStart = getPageMeta(startPage as Page).first
  const pageEnd = getPageMeta(endPage as Page).last
  const start = parseVerseKey(searchParams.get("startVerseKey")) ?? pageStart
  const end = parseVerseKey(searchParams.get("endVerseKey")) ?? pageEnd
  const startAyahId = findAyahIdBySurah(start[0] as Surah, start[1] as AyahNo)
  const endAyahId = findAyahIdBySurah(end[0] as Surah, end[1] as AyahNo)
  if (endAyahId < startAyahId) {
    return Response.json({ error: "نهاية النطاق تسبق بدايته." }, { status: 400 })
  }

  try {
    if (HADR_RECITER_IDS.has(reciter)) {
      const numbers = reciter === YASSER_SALAMA_RECITER_ID
        ? Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index)
        : Array.from({ length: end[0] - start[0] + 1 }, (_, index) => start[0] + index)
      const files = await Promise.all(numbers.map((number) => getHadrAudioFile(reciter, number)))
      return Response.json({
        seconds: Math.round(files.reduce((sum, file) => sum + file.durationMs, 0) / 1000),
        verseCount: endAyahId - startAyahId + 1,
        approximate: false,
        syncScope: reciter === AHMED_DEBAN_RECITER_ID ? "chapter" : "page",
        startVerseKey: `${findSurahAyahByAyahId(startAyahId).join(":")}`,
        endVerseKey: `${findSurahAyahByAyahId(endAyahId).join(":")}`,
      }, {
        headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400" },
      })
    }

    const chapterIds = Array.from(
      { length: end[0] - start[0] + 1 },
      (_, index) => start[0] + index,
    )
    const chapterDurations = await mapWithConcurrency(chapterIds, 8, async (chapter) => {
      const timing = await getChapterTiming(reciter, chapter)
      const firstVerse = chapter === start[0] ? start[1] : 1
      const lastVerse = chapter === end[0]
        ? end[1]
        : getAyahCountInSurah(chapter as Surah)
      const firstTimestamp = timing.timestamps.find((item) => item.verse_key === `${chapter}:${firstVerse}`)
      const lastTimestamp = timing.timestamps.find((item) => item.verse_key === `${chapter}:${lastVerse}`)
      if (!firstTimestamp || !lastTimestamp) throw new Error(`Missing range timestamps for chapter ${chapter}`)
      const startsWithOpening = firstVerse === 1 && chapter !== 9
      const startMs = startsWithOpening ? timing.openingStartMs : firstTimestamp.timestamp_from
      return {
        milliseconds: Math.max(0, lastTimestamp.timestamp_to - startMs) * timing.scale,
        approximate: timing.approximate,
      }
    })

    return Response.json({
      seconds: Math.round(chapterDurations.reduce((sum, item) => sum + item.milliseconds, 0) / 1000),
      verseCount: endAyahId - startAyahId + 1,
      approximate: chapterDurations.some((item) => item.approximate),
      startVerseKey: `${findSurahAyahByAyahId(startAyahId).join(":")}`,
      endVerseKey: `${findSurahAyahByAyahId(endAyahId).join(":")}`,
    }, {
      headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400" },
    })
  } catch (error) {
    console.error("Failed to calculate session duration", error)
    return Response.json({ error: "تعذر حساب مدة النطاق الآن." }, { status: 502 })
  }
}
