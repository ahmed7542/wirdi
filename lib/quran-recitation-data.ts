import "server-only"

import abdulRashidSufiCatalog from "@/data/recitations/abdul-rashid-sufi-catalog.json"
import abdulRashidSufiTimestamps from "@/data/recitations/abdul-rashid-sufi-verse-timestamps.json"
import muhammadAyyubCatalog from "@/data/recitations/muhammad-ayyub-catalog.json"
import muhammadAyyubTimestamps from "@/data/recitations/muhammad-ayyub-verse-timestamps.json"

export const ALIGNED_RECITER_IDS = new Set([22, 109])

type RecitationCatalog = {
  audio: {
    chapter_urls: Record<string, string>
    chapter_offsets_ms?: Record<string, number> | null
  }
}

type AlignedTimestamp = {
  verse_key: string
  timestamp_from: number
  timestamp_to: number
}

type AlignedRecitation = {
  catalog: RecitationCatalog
  chapters: Map<number, AlignedTimestamp[]>
}

const RECITATION_DATA = {
  22: {
    catalog: muhammadAyyubCatalog as RecitationCatalog,
    timestamps: muhammadAyyubTimestamps as Record<string, unknown>,
  },
  109: {
    catalog: abdulRashidSufiCatalog as RecitationCatalog,
    timestamps: abdulRashidSufiTimestamps as Record<string, unknown>,
  },
} as const

const recitationPromises = new Map<number, Promise<AlignedRecitation>>()
const MUHAMMAD_AYYUB_AUDIO_BASE = "https://download.quranicaudio.com/quran/muhammad_ayyoob"

function chapterAudioUrl(reciter: number, chapter: number, catalogUrl: string) {
  if (reciter === 22) {
    return `${MUHAMMAD_AYYUB_AUDIO_BASE}/${String(chapter).padStart(3, "0")}.mp3`
  }
  return catalogUrl
}

async function loadAlignedRecitation(reciter: number) {
  const data = RECITATION_DATA[reciter as keyof typeof RECITATION_DATA]
  if (!data) throw new Error(`No aligned data for reciter ${reciter}`)
  const { catalog, timestamps: rawTimestamps } = data
  const chapters = new Map<number, AlignedTimestamp[]>()
  for (const [verseKey, value] of Object.entries(rawTimestamps)) {
    if (!/^\d{1,3}:\d{1,3}$/.test(verseKey) || !Array.isArray(value)) continue
    const [chapter] = verseKey.split(":").map(Number)
    const [start, end] = value.map(Number)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue
    const timestamp = {
      verse_key: verseKey,
      timestamp_from: Math.round(start),
      timestamp_to: Math.round(end),
    }
    const current = chapters.get(chapter) ?? []
    current.push(timestamp)
    chapters.set(chapter, current)
  }
  return { catalog, chapters }
}

function getRecitation(reciter: number) {
  let promise = recitationPromises.get(reciter)
  if (!promise) {
    promise = loadAlignedRecitation(reciter)
    recitationPromises.set(reciter, promise)
  }
  return promise
}

export async function getAlignedChapterAudio(reciter: number, chapter: number) {
  const recitation = await getRecitation(reciter)
  const audioUrl = recitation.catalog.audio.chapter_urls[String(chapter)]
  const timestamps = recitation.chapters.get(chapter)
  if (!audioUrl || !timestamps?.length) {
    throw new Error(`Missing aligned chapter ${chapter} for reciter ${reciter}`)
  }
  return {
    audioUrl: chapterAudioUrl(reciter, chapter, audioUrl),
    chapterStartMs: 0,
    timingMode: reciter === 22 ? "approximate" as const : "exact" as const,
    timestamps,
  }
}
