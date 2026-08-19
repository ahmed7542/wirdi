import { getSurahMeta, type Surah } from "quran-meta/hafs"

import {
  AHMED_DEBAN_RECITER_ID,
  getHadrAudioFile,
  YASSER_SALAMA_RECITER_ID,
} from "@/lib/hadr-recitations"
import { ALIGNED_RECITER_IDS, getAlignedChapterAudio } from "@/lib/quran-recitation-data"

const QURAN_API_URL = "https://api.quran.com/api/v4"
const AL_HUDHAIFY_RECITER_ID = 1002
const VALID_RECITER_IDS = [
  1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 17, 18, 19,
  22, 43, 88, 91, 97, 104, 109, AL_HUDHAIFY_RECITER_ID, AHMED_DEBAN_RECITER_ID, YASSER_SALAMA_RECITER_ID,
] as const

type ChapterAudioResponse = {
  audio_file?: {
    audio_url?: string
    format?: string
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const chapter = Number(searchParams.get("chapter"))
  const reciter = Number(searchParams.get("reciter"))

  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 114) {
    return Response.json({ error: "رقم السورة غير صالح" }, { status: 400 })
  }
  if (!(VALID_RECITER_IDS as readonly number[]).includes(reciter)) {
    return Response.json({ error: "القارئ المحدد غير متاح" }, { status: 400 })
  }

  if (reciter === YASSER_SALAMA_RECITER_ID || reciter === AL_HUDHAIFY_RECITER_ID) {
    return Response.json(
      { error: reciter === AL_HUDHAIFY_RECITER_ID
        ? "تلاوة الحذيفي مقسمة حسب الآيات؛ استخدم تنزيل نطاق الآيات"
        : "مصحف ياسر سلامة مقسم حسب الصفحات؛ استخدم تنزيل نطاق الصفحات" },
      { status: 400 },
    )
  }

  try {
    let audioUrl: string | undefined
    let format = "mp3"
    let catalogFileSize = 0
    if (reciter === AHMED_DEBAN_RECITER_ID) {
      const file = await getHadrAudioFile(reciter, chapter)
      audioUrl = file.audioUrl
      catalogFileSize = file.size
    } else if (ALIGNED_RECITER_IDS.has(reciter)) {
      audioUrl = (await getAlignedChapterAudio(reciter, chapter)).audioUrl
    } else {
      const response = await fetch(
        `${QURAN_API_URL}/chapter_recitations/${reciter}/${chapter}`,
        { next: { revalidate: 60 * 60 * 24 * 30 } },
      )
      if (!response.ok) throw new Error(`Chapter audio API returned ${response.status}`)
      const data = (await response.json()) as ChapterAudioResponse
      audioUrl = data.audio_file?.audio_url
      format = data.audio_file?.format || "mp3"
    }
    if (!audioUrl) throw new Error("Chapter audio URL is missing")

    let fileSize = catalogFileSize
    if (!fileSize) {
      try {
        const headResponse = await fetch(audioUrl, {
          method: "HEAD",
          next: { revalidate: 60 * 60 * 24 * 30 },
        })
        fileSize = Number(headResponse.headers.get("content-length")) || 0
      } catch {
        // Some audio hosts do not support HEAD; the browser will use the GET response size.
      }
    }

    return Response.json(
      {
        chapter,
        chapterName: getSurahMeta(chapter as Surah).name,
        reciter,
        audioUrl,
        fileSize,
        format,
        variants: [
          {
            id: "original",
            label: "الجودة الأصلية",
            audioUrl,
            fileSize,
            format,
          },
        ],
      },
      { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=604800" } },
    )
  } catch (error) {
    console.error("Failed to resolve chapter audio", error)
    return Response.json({ error: "تعذر تجهيز ملف السورة الآن" }, { status: 502 })
  }
}
