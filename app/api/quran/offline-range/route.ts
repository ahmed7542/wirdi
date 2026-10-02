import {
  findAyahIdBySurah,
  findPage,
  findSurahAyahByAyahId,
  getPageMeta,
  getSurahMeta,
  isValidSurahAyah,
  type AyahNo,
  type Page,
  type Surah,
} from "quran-meta/hafs"

import {
  AHMED_DEBAN_RECITER_ID,
  getHadrAudioFile,
  YASSER_SALAMA_RECITER_ID,
} from "@/lib/hadr-recitations"
import {
  AL_BANNA_RECITER_ID,
  AL_HUDHAIFY_RECITER_ID,
  getMp3QuranChapterAudio,
  MP3QURAN_CHAPTER_RECITER_IDS,
} from "@/lib/mp3quran-recitations"
import { ALIGNED_RECITER_IDS, getAlignedChapterAudio } from "@/lib/quran-recitation-data"

const QURAN_API_URL = "https://api.quran.com/api/v4"
const AL_MINSHAWI_MUJAWWAD_RECITER_ID = 8
const VERSE_AUDIO_BASE = "https://verses.quran.com"
const VALID_RECITERS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 19,
  22, 43, 88, 91, 97, 104, 109, AL_BANNA_RECITER_ID, AL_HUDHAIFY_RECITER_ID,
  AHMED_DEBAN_RECITER_ID, YASSER_SALAMA_RECITER_ID,
])
const MAX_VERSE_FILES = 600

type ChapterAudioResponse = {
  audio_file?: {
    audio_url?: string
  }
}

type AyahAudioResponse = {
  audio_files?: Array<{
    verse_key: string
    url: string
  }>
}

type OfflineFile = {
  id: string
  label: string
  audioUrl: string
  fileSize: number
}

function parseVerseKey(value: string | null) {
  if (!value) return null
  const pair = value.split(":").map(Number) as [number, number]
  return isValidSurahAyah(pair) ? pair : null
}

function verseKey(pair: readonly [number, number]) {
  return `${pair[0]}:${pair[1]}`
}

async function fileSizeFor(url: string) {
  const response = await fetch(url, {
    method: "HEAD",
    next: { revalidate: 60 * 60 * 24 * 30 },
  })
  if (!response.ok) throw new Error(`Audio HEAD returned ${response.status}`)
  return Number(response.headers.get("content-length")) || 0
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await mapper(items[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const reciter = Number(searchParams.get("reciter"))
  const startPage = Number(searchParams.get("startPage"))
  const endPage = Number(searchParams.get("endPage"))
  const requestedStart = parseVerseKey(searchParams.get("startVerseKey"))
  const requestedEnd = parseVerseKey(searchParams.get("endVerseKey"))

  if (!VALID_RECITERS.has(reciter)) {
    return Response.json({ error: "القارئ المحدد غير متاح" }, { status: 400 })
  }
  if (
    !Number.isInteger(startPage) ||
    !Number.isInteger(endPage) ||
    startPage < 1 ||
    endPage > 604 ||
    endPage < startPage
  ) {
    return Response.json({ error: "نطاق الصفحات غير صالح" }, { status: 400 })
  }

  try {
    const startPair = requestedStart ?? getPageMeta(startPage as Page).first
    const endPair = requestedEnd ?? getPageMeta(endPage as Page).last
    const startAyahId = findAyahIdBySurah(startPair[0] as Surah, startPair[1] as AyahNo)
    const endAyahId = findAyahIdBySurah(endPair[0] as Surah, endPair[1] as AyahNo)
    if (endAyahId < startAyahId) {
      return Response.json({ error: "نهاية النطاق تسبق بدايته" }, { status: 400 })
    }

    let files: OfflineFile[]
    let fileMode: "chapters" | "verses" | "pages"
    if (reciter === YASSER_SALAMA_RECITER_ID) {
      const pages = Array.from(
        { length: endPage - startPage + 1 },
        (_, index) => startPage + index,
      )
      files = await Promise.all(pages.map(async (page) => {
        const file = await getHadrAudioFile(reciter, page)
        return {
          id: String(page),
          label: `صفحة ${page}`,
          audioUrl: file.audioUrl,
          fileSize: file.size,
        }
      }))
      fileMode = "pages"
    } else if (reciter === AL_MINSHAWI_MUJAWWAD_RECITER_ID) {
      const verseCount = endAyahId - startAyahId + 1
      if (verseCount > MAX_VERSE_FILES) {
        return Response.json(
          { error: `نطاق ملفات الآيات يجب ألا يتجاوز ${MAX_VERSE_FILES} آية في الحزمة الواحدة` },
          { status: 400 },
        )
      }
      const ayahIds = Array.from({ length: verseCount }, (_, index) => startAyahId + index)
      const pairs = ayahIds.map((ayahId) => findSurahAyahByAyahId(ayahId))
      const needsBismillah = pairs.some(([chapter, verse]) => verse === 1 && chapter !== 1 && chapter !== 9)
      const chapters = [...new Set([
        ...pairs.map(([chapter]) => chapter),
        ...(needsBismillah ? [1] : []),
      ])]
      const chapterFiles = (await Promise.all(chapters.map(async (chapter) => {
        const url = new URL(`${QURAN_API_URL}/recitations/${reciter}/by_chapter/${chapter}`)
        url.searchParams.set("per_page", "300")
        url.searchParams.set("fields", "verse_key,url")
        const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 30 } })
        if (!response.ok) throw new Error(`Ayah audio returned ${response.status}`)
        return ((await response.json()) as AyahAudioResponse).audio_files ?? []
      }))).flat()
      const audioByVerse = new Map(chapterFiles.map((audio) => [audio.verse_key, audio.url]))
      const resolveAudioUrl = (key: string) => {
        const relativeUrl = audioByVerse.get(key)
        if (!relativeUrl) throw new Error(`Missing ayah audio ${key}`)
        return relativeUrl.startsWith("http")
          ? relativeUrl
          : relativeUrl.startsWith("//")
            ? `https:${relativeUrl}`
            : `${VERSE_AUDIO_BASE}/${relativeUrl.replace(/^\//, "")}`
      }
      files = await mapWithConcurrency(pairs, 10, async (pair) => {
        const key = verseKey(pair)
        const audioUrl = resolveAudioUrl(key)
        return {
          id: key,
          label: `الآية ${key}`,
          audioUrl,
          fileSize: await fileSizeFor(audioUrl),
        }
      })
      if (needsBismillah && !files.some((file) => file.id === "1:1")) {
        const audioUrl = resolveAudioUrl("1:1")
        files.unshift({
          id: "bismillah",
          label: "البسملة",
          audioUrl,
          fileSize: await fileSizeFor(audioUrl),
        })
      }
      fileMode = "verses"
    } else {
      const firstChapter = startPair[0]
      const lastChapter = endPair[0]
      const chapters = Array.from(
        { length: lastChapter - firstChapter + 1 },
        (_, index) => firstChapter + index,
      )
      const chapterFiles = await mapWithConcurrency(chapters, 8, async (chapter) => {
        let audioUrl: string | undefined
        if (MP3QURAN_CHAPTER_RECITER_IDS.has(reciter)) {
          audioUrl = (await getMp3QuranChapterAudio(reciter, chapter)).audioUrl
        } else if (reciter === AHMED_DEBAN_RECITER_ID) {
          audioUrl = (await getHadrAudioFile(reciter, chapter)).audioUrl
        } else if (ALIGNED_RECITER_IDS.has(reciter)) {
          audioUrl = (await getAlignedChapterAudio(reciter, chapter)).audioUrl
        } else {
          const response = await fetch(`${QURAN_API_URL}/chapter_recitations/${reciter}/${chapter}`, {
            next: { revalidate: 60 * 60 * 24 * 30 },
          })
          if (!response.ok) throw new Error(`Chapter audio returned ${response.status}`)
          audioUrl = ((await response.json()) as ChapterAudioResponse).audio_file?.audio_url
        }
        if (!audioUrl) throw new Error(`Chapter ${chapter} has no audio URL`)
        return {
          id: String(chapter),
          label: `سورة ${getSurahMeta(chapter as Surah).name}`,
          audioUrl,
          fileSize: reciter === AHMED_DEBAN_RECITER_ID
            ? (await getHadrAudioFile(reciter, chapter)).size
            : await fileSizeFor(audioUrl),
        }
      })
      files = [...new Map(chapterFiles.map((file) => [file.audioUrl, file])).values()]
      fileMode = "chapters"
    }

    const resolvedStartPage = findPage(startPair[0] as Surah, startPair[1] as AyahNo)
    const resolvedEndPage = findPage(endPair[0] as Surah, endPair[1] as AyahNo)
    return Response.json(
      {
        reciter,
        fileMode,
        files,
        totalSize: files.reduce((total, file) => total + file.fileSize, 0),
        startAyahId,
        endAyahId,
        startVerseKey: verseKey(startPair),
        endVerseKey: verseKey(endPair),
        startPage: resolvedStartPage,
        endPage: resolvedEndPage,
      },
      { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=604800" } },
    )
  } catch (error) {
    console.error("Failed to prepare offline range", error)
    return Response.json({ error: "تعذر حساب ملفات هذا النطاق الآن" }, { status: 502 })
  }
}
