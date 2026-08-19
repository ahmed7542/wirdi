import { findPage, findRubAlHizb, getSurahMeta, type AyahNo, type Surah } from "quran-meta/hafs"

import {
  AHMED_DEBAN_RECITER_ID,
  getHadrAudioFile,
  HADR_RECITER_IDS,
  YASSER_SALAMA_RECITER_ID,
} from "@/lib/hadr-recitations"
import { ALIGNED_RECITER_IDS, getAlignedChapterAudio } from "@/lib/quran-recitation-data"

type QuranWord = {
  id: number
  position: number
  char_type_name: string
  text_qpc_hafs: string
  page_number: number
  line_number: number
}

type QuranVerse = {
  id: number
  verse_key: string
  verse_number: number
  page_number: number
  juz_number: number
  hizb_number: number
  text_qpc_hafs: string
  words?: QuranWord[]
}

type QuranResponse = {
  verses?: QuranVerse[]
}

type QuranVerseResponse = {
  verse?: QuranVerse
}

type Qcf4GlyphResponse = {
  code: number
  char: string
  font: string
  text: string
  type: "word" | "end" | "surah_header" | "bismillah" | "quarter"
  verse_key?: string
  position?: number
  sura?: number
}

type Qcf4PageResponse = {
  page: number
  font: string
  lines: Array<{
    line: number
    words: Qcf4GlyphResponse[]
  }>
}

type ChapterTimestamp = {
  verse_key: string
  timestamp_from: number
  timestamp_to: number
  segments?: number[][]
}

type ChapterAudioResponse = {
  audio_file?: {
    audio_url?: string
    timestamps?: ChapterTimestamp[]
  }
}

type AyahAudioFile = {
  verse_key: string
  url: string
  duration?: number
  segments?: number[][]
}

type AyahAudioResponse = {
  audio_files?: AyahAudioFile[]
}

const QURAN_API_URL = "https://api.quran.com/api/v4"
const QCF4_CDN_URL = "https://cdn.jsdelivr.net/npm/quran-qcf4@1.0.3"
const AL_BANNA_RECITER_ID = 1001
const AL_HUDHAIFY_RECITER_ID = 1002
const AL_MINSHAWI_MUJAWWAD_RECITER_ID = 8
const AL_BANNA_AUDIO_BASE = "https://everyayah.com/data/mahmoud_ali_al_banna_32kbps"
const AL_HUDHAIFY_AUDIO_BASE = "https://everyayah.com/data/Hudhaify_128kbps"
const VERSE_AUDIO_BASE = "https://verses.quran.com"
const VALID_RECITERS = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 19,
  22, 43, 88, 91, 97, 104, 109, AL_BANNA_RECITER_ID, AL_HUDHAIFY_RECITER_ID,
  AHMED_DEBAN_RECITER_ID, YASSER_SALAMA_RECITER_ID,
])

function getEveryAyahVerseUrl(baseUrl: string, verseKey: string) {
  const [chapter, verse] = verseKey.split(":").map(Number)
  return `${baseUrl}/${String(chapter).padStart(3, "0")}${String(verse).padStart(3, "0")}.mp3`
}

async function getRemoteFileSize(url: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
    return Number(response.headers.get("content-length")) || 0
  } catch {
    return 0
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get("page"))
  const reciter = Number(searchParams.get("reciter") ?? 6)

  if (!Number.isInteger(page) || page < 1 || page > 604) {
    return Response.json({ error: "رقم الصفحة يجب أن يكون بين 1 و604" }, { status: 400 })
  }

  if (!VALID_RECITERS.has(reciter)) {
    return Response.json({ error: "القارئ المحدد غير متاح" }, { status: 400 })
  }

  const pageUrl = new URL(`${QURAN_API_URL}/verses/by_page/${page}`)
  pageUrl.searchParams.set("language", "ar")
  pageUrl.searchParams.set("mushaf", "1")
  pageUrl.searchParams.set("fields", "text_qpc_hafs")
  pageUrl.searchParams.set("words", "true")
  pageUrl.searchParams.set("word_fields", "text_qpc_hafs")
  pageUrl.searchParams.set("per_page", "50")

  try {
    const paddedPage = String(page).padStart(3, "0")
    const [response, qcf4Response, fontMapResponse] = await Promise.all([
      fetch(pageUrl, { next: { revalidate: 60 * 60 * 24 * 7 } }),
      fetch(`${QCF4_CDN_URL}/pages/${paddedPage}.json`, {
        next: { revalidate: 60 * 60 * 24 * 30 },
      }),
      fetch(`${QCF4_CDN_URL}/font-map.json`, {
        next: { revalidate: 60 * 60 * 24 * 30 },
      }),
    ])

    if (!response.ok) throw new Error(`Quran API returned ${response.status}`)
    if (!qcf4Response.ok) throw new Error(`QCF4 page returned ${qcf4Response.status}`)
    if (!fontMapResponse.ok) throw new Error(`QCF4 font map returned ${fontMapResponse.status}`)

    const data = (await response.json()) as QuranResponse
    const qcf4Data = (await qcf4Response.json()) as Qcf4PageResponse
    const fontMap = (await fontMapResponse.json()) as Record<string, string>
    const mappedFont = fontMap[String(page)]
    if (
      qcf4Data.page !== page ||
      !mappedFont ||
      qcf4Data.font !== mappedFont ||
      !qcf4Data.lines.length
    ) {
      throw new Error(`Invalid QCF4 layout for page ${page}`)
    }

    const qcfVerseKeys = [...new Set(
      qcf4Data.lines.flatMap((line) => line.words.flatMap((glyph) => glyph.verse_key ? [glyph.verse_key] : [])),
    )]
    const versesByKey = new Map((data.verses ?? []).map((verse) => [verse.verse_key, verse]))
    const missingVerseKeys = qcfVerseKeys.filter((verseKey) => !versesByKey.has(verseKey))
    const missingVerseResponses = await Promise.all(missingVerseKeys.map(async (verseKey) => {
      const verseUrl = new URL(`${QURAN_API_URL}/verses/by_key/${encodeURIComponent(verseKey)}`)
      verseUrl.searchParams.set("language", "ar")
      verseUrl.searchParams.set("mushaf", "1")
      verseUrl.searchParams.set("fields", "text_qpc_hafs")
      verseUrl.searchParams.set("words", "true")
      verseUrl.searchParams.set("word_fields", "text_qpc_hafs")
      const response = await fetch(verseUrl, { next: { revalidate: 60 * 60 * 24 * 30 } })
      if (!response.ok) throw new Error(`Quran verse ${verseKey} returned ${response.status}`)
      const verse = ((await response.json()) as QuranVerseResponse).verse
      if (!verse || verse.verse_key !== verseKey) throw new Error(`Quran verse ${verseKey} is incomplete`)
      return verse
    }))
    missingVerseResponses.forEach((verse) => versesByKey.set(verse.verse_key, verse))
    const pageVerses = qcfVerseKeys.flatMap((verseKey) => {
      const verse = versesByKey.get(verseKey)
      return verse ? [verse] : []
    })
    if (pageVerses.length !== qcfVerseKeys.length || pageVerses.length === 0) {
      throw new Error(`Quran verses do not match QCF4 page ${page}`)
    }

    const chapterIds = [...new Set(pageVerses.map((verse) => Number(verse.verse_key.split(":")[0])))]
    const qcfPage = {
      font: mappedFont,
      lines: qcf4Data.lines.map((line) => ({
        lineNumber: line.line,
        glyphs: line.words.map((glyph) => ({
          code: glyph.code,
          char: glyph.char,
          font: glyph.font,
          text: glyph.text,
          type: glyph.type,
          verseKey: glyph.verse_key,
          position: glyph.position,
          chapterId: glyph.sura,
        })),
      })),
    }

    if (searchParams.get("content") === "reading") {
      const verses = pageVerses.map((verse) => {
        const chapterId = Number(verse.verse_key.split(":")[0])
        const chapterMeta = getSurahMeta(chapterId as Surah)
        return {
          id: verse.id,
          verseKey: verse.verse_key,
          verseNumber: verse.verse_number,
          pageNumber: page,
          juzNumber: verse.juz_number,
          hizbNumber: verse.hizb_number,
          rubAlHizbNumber: findRubAlHizb(chapterId as Surah, verse.verse_number as AyahNo),
          chapterId,
          chapterName: chapterMeta.name,
          isChapterEnd: verse.verse_number === chapterMeta.ayahCount,
          text: verse.text_qpc_hafs,
          words: (verse.words ?? []).map((word) => ({
            id: word.id,
            verseKey: verse.verse_key,
            position: word.position,
            charType: word.char_type_name,
            textQpcHafs: word.text_qpc_hafs,
            pageNumber: word.page_number,
            lineNumber: word.line_number,
          })),
          wordTimings: [],
          timestampFrom: 0,
          timestampTo: 0,
        }
      })
      return Response.json(
        { page, verses, tracks: [], qcfPage },
        { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=604800" } },
      )
    }

    const chapterAudio = reciter === AL_BANNA_RECITER_ID ||
      reciter === AL_HUDHAIFY_RECITER_ID ||
      reciter === AL_MINSHAWI_MUJAWWAD_RECITER_ID ||
      HADR_RECITER_IDS.has(reciter)
      ? []
      : await Promise.all(
          chapterIds.map(async (chapterId) => {
            if (ALIGNED_RECITER_IDS.has(reciter)) {
              const aligned = await getAlignedChapterAudio(reciter, chapterId)
              return {
                chapterId,
                audioUrl: aligned.audioUrl,
                openingStartMs: aligned.chapterStartMs,
                timingMode: aligned.timingMode,
                timestamps: new Map(
                  aligned.timestamps.map((timestamp) => [timestamp.verse_key, timestamp]),
                ),
              }
            }

            const targetAudioUrl = new URL(`${QURAN_API_URL}/chapter_recitations/${reciter}/${chapterId}`)
            targetAudioUrl.searchParams.set("segments", "true")
            const targetAudioResponse = await fetch(targetAudioUrl, {
              next: { revalidate: 60 * 60 * 24 * 30 },
            })
            if (!targetAudioResponse.ok) {
              throw new Error(`Chapter audio API returned ${targetAudioResponse.status}`)
            }
            const targetAudioData = (await targetAudioResponse.json()) as ChapterAudioResponse
            if (!targetAudioData.audio_file?.audio_url || !targetAudioData.audio_file.timestamps?.length) {
              throw new Error(`Chapter audio ${chapterId} is incomplete`)
            }
            return {
              chapterId,
              audioUrl: targetAudioData.audio_file.audio_url,
              openingStartMs: 0,
              timingMode: "exact" as const,
              timestamps: new Map(
                targetAudioData.audio_file.timestamps.map((timestamp) => [timestamp.verse_key, timestamp]),
              ),
            }
          }),
        )

    const needsMinshawiBismillah = reciter === AL_MINSHAWI_MUJAWWAD_RECITER_ID && pageVerses.some((verse) => {
      const chapterId = Number(verse.verse_key.split(":")[0])
      return verse.verse_number === 1 && chapterId !== 1 && chapterId !== 9
    })
    const minshawiChapterIds = needsMinshawiBismillah
      ? [...new Set([...chapterIds, 1])]
      : chapterIds
    const minshawiAudio = reciter === AL_MINSHAWI_MUJAWWAD_RECITER_ID
      ? (await Promise.all(minshawiChapterIds.map(async (chapterId) => {
          const audioUrl = new URL(`${QURAN_API_URL}/recitations/${reciter}/by_chapter/${chapterId}`)
          audioUrl.searchParams.set("per_page", "300")
          audioUrl.searchParams.set("fields", "verse_key,url,duration,segments")
          const response = await fetch(audioUrl, { next: { revalidate: 60 * 60 * 24 * 30 } })
          if (!response.ok) throw new Error(`Ayah audio API returned ${response.status}`)
          return ((await response.json()) as AyahAudioResponse).audio_files ?? []
        }))).flat().map((audio) => ({
          verseKey: audio.verse_key,
          audioUrl: audio.url.startsWith("http")
            ? audio.url
            : audio.url.startsWith("//")
              ? `https:${audio.url}`
              : `${VERSE_AUDIO_BASE}/${audio.url.replace(/^\//, "")}`,
          duration: Math.max(
            Math.round((audio.duration ?? 0) * 1000),
            audio.segments?.at(-1)?.at(-1) ?? 0,
            1_000,
          ),
          segments: audio.segments,
        }))
      : []

    const everyAyahSource = reciter === AL_BANNA_RECITER_ID
      ? { baseUrl: AL_BANNA_AUDIO_BASE, bitrate: 32_000 }
      : reciter === AL_HUDHAIFY_RECITER_ID
        ? { baseUrl: AL_HUDHAIFY_AUDIO_BASE, bitrate: 128_000 }
        : null
    const needsEveryAyahBismillah = Boolean(everyAyahSource) && pageVerses.some((verse) => {
      const chapterId = Number(verse.verse_key.split(":")[0])
      return verse.verse_number === 1 && chapterId !== 1 && chapterId !== 9
    })
    const everyAyahAudio = everyAyahSource
      ? await Promise.all(pageVerses.map(async (verse) => {
          const audioUrl = getEveryAyahVerseUrl(everyAyahSource.baseUrl, verse.verse_key)
          const fileSize = await getRemoteFileSize(audioUrl)
          const fallbackDuration = Math.max((verse.words?.length ?? 6) * 900, 4_000)
          const estimatedDuration = fileSize > 0
            ? Math.ceil((fileSize * 8 * 1000) / everyAyahSource.bitrate) + 750
            : fallbackDuration
          return { verseKey: verse.verse_key, audioUrl, estimatedDuration }
        }))
      : []
    const everyAyahBismillah = needsEveryAyahBismillah && everyAyahSource
      ? await (async () => {
          const audioUrl = getEveryAyahVerseUrl(everyAyahSource.baseUrl, "1:1")
          const fileSize = await getRemoteFileSize(audioUrl)
          return {
            audioUrl,
            estimatedDuration: fileSize > 0
              ? Math.ceil((fileSize * 8 * 1000) / everyAyahSource.bitrate) + 500
              : 8_000,
          }
        })()
      : null
    const hadrAudio = reciter === AHMED_DEBAN_RECITER_ID
      ? await Promise.all(chapterIds.map(async (chapterId) => ({
          chapterId,
          ...await getHadrAudioFile(reciter, chapterId),
        })))
      : reciter === YASSER_SALAMA_RECITER_ID
        ? [{ chapterId: chapterIds[0], ...await getHadrAudioFile(reciter, page) }]
        : []
    const hadrAudioByChapter = new Map(
      reciter === YASSER_SALAMA_RECITER_ID
        ? chapterIds.map((chapterId) => [chapterId, hadrAudio[0]] as const)
        : hadrAudio.map((audio) => [audio.chapterId, audio] as const),
    )
    const chapterAudioById = new Map(chapterAudio.map((chapter) => [chapter.chapterId, chapter]))
    const everyAyahAudioByVerse = new Map(everyAyahAudio.map((audio) => [audio.verseKey, audio]))
    const minshawiAudioByVerse = new Map(minshawiAudio.map((audio) => [audio.verseKey, audio]))
    const verses = pageVerses.map((verse) => {
      const chapterId = Number(verse.verse_key.split(":")[0])
      const everyAyahVerseAudio = everyAyahAudioByVerse.get(verse.verse_key)
      const minshawiVerseAudio = minshawiAudioByVerse.get(verse.verse_key)
      const verseFileAudio = everyAyahVerseAudio
        ? { duration: everyAyahVerseAudio.estimatedDuration }
        : minshawiVerseAudio
      const hadrFile = hadrAudioByChapter.get(chapterId)
      const timestamp = verseFileAudio
        ? {
            verse_key: verse.verse_key,
            timestamp_from: 0,
            timestamp_to: verseFileAudio.duration,
            segments: minshawiVerseAudio?.segments,
          }
        : hadrFile
          ? {
              verse_key: verse.verse_key,
              timestamp_from: 0,
              timestamp_to: hadrFile.durationMs,
              segments: undefined,
            }
          : chapterAudioById.get(chapterId)?.timestamps.get(verse.verse_key)
      if (!timestamp) throw new Error(`Missing timestamp for ${verse.verse_key}`)

      const timingSegments = minshawiVerseAudio?.segments ?? (
        "segments" in timestamp ? timestamp.segments : undefined
      ) ?? []
      const wordTimings = timingSegments.flatMap((segment) => {
        const hasSegmentIndex = segment.length >= 4
        const position = Number(segment[hasSegmentIndex ? 1 : 0])
        const startMs = Number(segment[hasSegmentIndex ? 2 : 1])
        const endMs = Number(segment[hasSegmentIndex ? 3 : 2])
        if (
          !Number.isInteger(position) ||
          position < 1 ||
          !Number.isFinite(startMs) ||
          !Number.isFinite(endMs) ||
          endMs <= startMs
        ) return []
        return [{ position, startMs, endMs }]
      })

      const chapterMeta = getSurahMeta(chapterId as Surah)
      return {
        id: verse.id,
        verseKey: verse.verse_key,
        verseNumber: verse.verse_number,
        pageNumber: page,
        juzNumber: verse.juz_number,
        hizbNumber: verse.hizb_number,
        rubAlHizbNumber: findRubAlHizb(chapterId as Surah, verse.verse_number as AyahNo),
        chapterId,
        chapterName: chapterMeta.name,
        isChapterEnd: verse.verse_number === chapterMeta.ayahCount,
        text: verse.text_qpc_hafs,
        words: (verse.words ?? []).map((word) => ({
          id: word.id,
          verseKey: verse.verse_key,
          position: word.position,
          charType: word.char_type_name,
          textQpcHafs: word.text_qpc_hafs,
          pageNumber: word.page_number,
          lineNumber: word.line_number,
        })),
        wordTimings,
        timestampFrom: timestamp.timestamp_from,
        timestampTo: timestamp.timestamp_to,
      }
    })

    const tracks = reciter === YASSER_SALAMA_RECITER_ID
      ? hadrAudio.map((audio) => ({
          chapterId: verses[0]?.chapterId ?? 1,
          audioUrl: audio.audioUrl,
          startMs: 0,
          endMs: audio.durationMs,
          firstVerseIndex: 0,
          lastVerseIndex: Math.max(verses.length - 1, 0),
          timingMode: "page" as const,
          previousPage: page - 1,
          advanceToPage: page + 1,
        }))
      : reciter === AHMED_DEBAN_RECITER_ID
        ? chapterIds.map((chapterId) => {
            const audio = hadrAudioByChapter.get(chapterId)
            const firstVerseIndex = verses.findIndex((verse) => verse.chapterId === chapterId)
            const lastVerseIndex = verses.findLastIndex((verse) => verse.chapterId === chapterId)
            if (!audio || firstVerseIndex < 0 || lastVerseIndex < 0) {
              throw new Error(`Missing Hadr chapter ${chapterId}`)
            }
            return {
              chapterId,
              audioUrl: audio.audioUrl,
              startMs: 0,
              endMs: audio.durationMs,
              firstVerseIndex,
              lastVerseIndex,
              timingMode: "chapter" as const,
              previousPage: chapterId > 1
                ? findPage((chapterId - 1) as Surah, 1 as AyahNo)
                : 0,
              advanceToPage: chapterId < 114
                ? findPage((chapterId + 1) as Surah, 1 as AyahNo)
                : 605,
            }
          })
      : reciter === AL_MINSHAWI_MUJAWWAD_RECITER_ID
      ? verses.flatMap((verse, index) => {
          const audio = minshawiAudioByVerse.get(verse.verseKey)
          if (!audio) throw new Error(`Missing Al-Minshawi audio for ${verse.verseKey}`)
          const verseTrack = {
            chapterId: verse.chapterId,
            audioUrl: audio.audioUrl,
            startMs: 0,
            endMs: audio.duration,
            firstVerseIndex: index,
            lastVerseIndex: index,
            timingMode: "verse" as const,
          }
          if (verse.verseNumber !== 1 || verse.chapterId === 1 || verse.chapterId === 9) {
            return [verseTrack]
          }
          const bismillah = minshawiAudioByVerse.get("1:1")
          if (!bismillah) throw new Error(`Missing Al-Minshawi Bismillah for ${verse.verseKey}`)
          return [
            {
              chapterId: verse.chapterId,
              audioUrl: bismillah.audioUrl,
              startMs: 0,
              endMs: bismillah.duration,
              firstVerseIndex: index,
              lastVerseIndex: index,
              timingMode: "bismillah" as const,
            },
            verseTrack,
          ]
        })
      : reciter === AL_BANNA_RECITER_ID || reciter === AL_HUDHAIFY_RECITER_ID
      ? verses.flatMap((verse, index) => {
          const audio = everyAyahAudioByVerse.get(verse.verseKey)
          if (!audio) throw new Error(`Missing EveryAyah audio for ${verse.verseKey}`)
          const verseTrack = {
            chapterId: verse.chapterId,
            audioUrl: audio.audioUrl,
            startMs: 0,
            endMs: verse.timestampTo,
            firstVerseIndex: index,
            lastVerseIndex: index,
            timingMode: "verse" as const,
          }
          if (verse.verseNumber !== 1 || verse.chapterId === 1 || verse.chapterId === 9) {
            return [verseTrack]
          }
          if (!everyAyahBismillah) throw new Error(`Missing EveryAyah Bismillah for ${verse.verseKey}`)
          return [
            {
              chapterId: verse.chapterId,
              audioUrl: everyAyahBismillah.audioUrl,
              startMs: 0,
              endMs: everyAyahBismillah.estimatedDuration,
              firstVerseIndex: index,
              lastVerseIndex: index,
              timingMode: "bismillah" as const,
            },
            verseTrack,
          ]
        })
      : chapterIds.map((chapterId) => {
          const firstVerseIndex = verses.findIndex((verse) => verse.chapterId === chapterId)
          const lastVerseIndex = verses.findLastIndex((verse) => verse.chapterId === chapterId)
          const chapter = chapterAudioById.get(chapterId)

          if (!chapter || firstVerseIndex < 0 || lastVerseIndex < 0) {
            throw new Error(`Missing audio track for chapter ${chapterId}`)
          }

          const firstVerse = verses[firstVerseIndex]
          const startsWithOpening = firstVerse.verseNumber === 1 && chapterId !== 9

          return {
            chapterId,
            audioUrl: chapter.audioUrl,
            startMs: startsWithOpening ? chapter.openingStartMs : firstVerse.timestampFrom,
            endMs: verses[lastVerseIndex].timestampTo,
            firstVerseIndex,
            lastVerseIndex,
            timingMode: chapter.timingMode,
          }
        })

    return Response.json(
      {
        page,
        verses,
        tracks,
        qcfPage,
        recitationSync: reciter === AHMED_DEBAN_RECITER_ID
          ? "chapter"
          : reciter === YASSER_SALAMA_RECITER_ID
            ? "page"
            : "verse",
      },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=86400" } },
    )
  } catch (error) {
    console.error("Failed to load Quran page", error)
    return Response.json(
      { error: "تعذر تحميل الصفحة الآن. حاول مرة أخرى." },
      { status: 502 },
    )
  }
}
