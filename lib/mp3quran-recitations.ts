import { getSurahMeta, type Surah } from "quran-meta/hafs"

const MP3QURAN_RECITERS_API = "https://www.mp3quran.net/api/v3/reciters?language=ar"
const MP3QURAN_TIMING_API = "https://www.mp3quran.net/api/v3/ayat_timing"
const QUL_AUDIO_API = "https://qul.tarteel.ai/api/v1/audio/surah_segments"

export const AL_BANNA_RECITER_ID = 1001
export const AL_HUDHAIFY_RECITER_ID = 1002
export const AL_MINSHAWI_MUJAWWAD_RECITER_ID = 8

export const CONTINUOUS_CHAPTER_RECITER_IDS = new Set([
  AL_MINSHAWI_MUJAWWAD_RECITER_ID,
  AL_BANNA_RECITER_ID,
  AL_HUDHAIFY_RECITER_ID,
])

type ChapterTimestamp = {
  verse_key: string
  timestamp_from: number
  timestamp_to: number
  segments: number[][]
}

type Mp3QuranMoshaf = {
  id: number
  rewaya_id?: number
  server: string
  surah_list: string
}

type Mp3QuranCatalog = {
  reciters: Array<{
    id: number
    moshaf: Mp3QuranMoshaf[]
  }>
}

type Mp3QuranTiming = {
  ayah: number
  start_time: number
  end_time: number
}

type QulAudioResponse = {
  audio?: {
    url?: string
    duration?: number
    audio_size?: number
  }
  segments?: Record<string, {
    time_from?: number
    time_to?: number
    segments?: number[][]
  }>
}

const RECITER_CONFIG = {
  [AL_HUDHAIFY_RECITER_ID]: {
    catalogReciterId: 74,
    moshafId: 74,
    fallbackServer: "https://server9.mp3quran.net/hthfi/",
    qulRecitationId: 167,
  },
} as const

const MONTHLY_CACHE = { revalidate: 60 * 60 * 24 * 30 } as const

async function getMp3QuranServer(reciter: number, chapter: number) {
  const config = RECITER_CONFIG[reciter as keyof typeof RECITER_CONFIG]
  if (!config) throw new Error("Continuous chapter reciter is not supported")

  let server: string = config.fallbackServer
  try {
    const response = await fetch(MP3QURAN_RECITERS_API, { next: MONTHLY_CACHE })
    if (response.ok) {
      const catalog = await response.json() as Mp3QuranCatalog
      const reciterEntry = catalog.reciters.find((item) => item.id === config.catalogReciterId)
      const moshaf = reciterEntry?.moshaf.find((item) => (
        item.id === config.moshafId &&
        item.rewaya_id === 1 &&
        item.surah_list.split(",").map(Number).includes(chapter)
      ))
      if (moshaf?.server) server = moshaf.server
    }
  } catch {
    // The verified fallback remains usable if the catalog is temporarily unavailable.
  }
  return server
}

async function getQulAudio(recitationId: number, chapter: number, ayahCount: number) {
  const url = new URL(`${QUL_AUDIO_API}/${recitationId}`)
  url.searchParams.set("surah", String(chapter))
  url.searchParams.set("per_page", String(ayahCount))
  const response = await fetch(url, { next: MONTHLY_CACHE })
  if (!response.ok) throw new Error(`QUL audio API returned ${response.status}`)
  return response.json() as Promise<QulAudioResponse>
}

function getQulTimestamps(chapter: number, ayahCount: number, data: QulAudioResponse) {
  const timestamps: ChapterTimestamp[] = []
  for (let ayah = 1; ayah <= ayahCount; ayah += 1) {
    const key = `${chapter}:${ayah}`
    const segment = data.segments?.[key]
    if (
      !segment ||
      !Number.isFinite(segment.time_from) ||
      !Number.isFinite(segment.time_to) ||
      segment.time_to! <= segment.time_from!
    ) throw new Error(`QUL timing is missing for ${key}`)
    timestamps.push({
      verse_key: key,
      timestamp_from: segment.time_from!,
      timestamp_to: segment.time_to!,
      segments: segment.segments ?? [],
    })
  }
  return timestamps
}

async function getHudhaifyTimestamps(chapter: number, ayahCount: number, durationMs: number) {
  const url = new URL(MP3QURAN_TIMING_API)
  url.searchParams.set("read", "74")
  url.searchParams.set("surah", String(chapter))
  const response = await fetch(url, { next: MONTHLY_CACHE })
  if (!response.ok) throw new Error(`MP3Quran timing API returned ${response.status}`)
  const rows = (await response.json()) as Mp3QuranTiming[]
  const timestamps = rows.flatMap((row) => {
    const ayah = row.ayah + 1
    if (
      ayah < 1 ||
      ayah > ayahCount ||
      !Number.isFinite(row.start_time) ||
      !Number.isFinite(row.end_time) ||
      row.end_time <= row.start_time
    ) return []
    return [{
      verse_key: `${chapter}:${ayah}`,
      timestamp_from: row.start_time,
      timestamp_to: row.end_time,
      segments: [],
    }]
  })

  const knownAyahs = new Set(timestamps.map((item) => Number(item.verse_key.split(":")[1])))
  const missingAyahs = Array.from({ length: ayahCount }, (_, index) => index + 1)
    .filter((ayah) => !knownAyahs.has(ayah))
  const hasEstimatedTiming = missingAyahs.length > 0
  if (hasEstimatedTiming) {
    const lastKnownEnd = timestamps.at(-1)?.timestamp_to ?? 0
    const fallbackEnd = Math.max(durationMs, lastKnownEnd + missingAyahs.length * 8_000)
    const durationPerAyah = Math.max((fallbackEnd - lastKnownEnd) / missingAyahs.length, 1_000)
    missingAyahs.forEach((ayah, index) => {
      timestamps.push({
        verse_key: `${chapter}:${ayah}`,
        timestamp_from: Math.round(lastKnownEnd + index * durationPerAyah),
        timestamp_to: Math.round(lastKnownEnd + (index + 1) * durationPerAyah),
        segments: [],
      })
    })
  }
  return {
    timestamps: timestamps.sort((left, right) => (
      Number(left.verse_key.split(":")[1]) - Number(right.verse_key.split(":")[1])
    )),
    timingMode: hasEstimatedTiming ? "approximate" as const : "exact" as const,
  }
}

async function getRemoteFileSize(url: string) {
  try {
    const response = await fetch(url, {
      headers: { Range: "bytes=0-0" },
      next: MONTHLY_CACHE,
    })
    const contentRange = response.headers.get("content-range")
    const rangeSize = Number(contentRange?.match(/\/(\d+)$/)?.[1])
    const contentLength = Number(response.headers.get("content-length"))
    await response.arrayBuffer()
    return rangeSize || contentLength || 0
  } catch {
    return 0
  }
}

function normalizeAudioUrl(value: string) {
  const url = new URL(value)
  url.pathname = url.pathname.replace(/\/{2,}/g, "/")
  return url.toString()
}

async function getSegmentedQulChapterAudio(
  recitationId: number,
  chapter: number,
  source: string,
) {
  const ayahCount = getSurahMeta(chapter as Surah).ayahCount
  const data = await getQulAudio(recitationId, chapter, ayahCount)
  if (!data.audio?.url) throw new Error(`QUL audio is missing for chapter ${chapter}`)
  return {
    audioUrl: normalizeAudioUrl(data.audio.url),
    fileSize: Math.max(Math.round(data.audio.audio_size ?? 0), 0),
    openingStartMs: 0,
    timingMode: "exact" as const,
    timestamps: getQulTimestamps(chapter, ayahCount, data),
    source,
  }
}

export async function getContinuousChapterAudio(reciter: number, chapter: number) {
  if (reciter === AL_MINSHAWI_MUJAWWAD_RECITER_ID) {
    return getSegmentedQulChapterAudio(8, chapter, "QUL · Tarteel / QuranicAudio")
  }

  if (reciter === AL_BANNA_RECITER_ID) {
    return getSegmentedQulChapterAudio(129, chapter, "QUL · Tarteel / QuranicAudio")
  }

  const config = RECITER_CONFIG[reciter as keyof typeof RECITER_CONFIG]
  if (!config) throw new Error("Continuous chapter reciter is not supported")
  const ayahCount = getSurahMeta(chapter as Surah).ayahCount
  const qulAudio = await getQulAudio(config.qulRecitationId, chapter, ayahCount)
  const server = await getMp3QuranServer(reciter, chapter)
  const audioUrl = `${server}${String(chapter).padStart(3, "0")}.mp3`
  const fileSize = await getRemoteFileSize(audioUrl)
  const durationMs = Math.max(
    Math.round((qulAudio.audio?.duration ?? 0) * 1000),
    Math.round((fileSize * 8 * 1000) / 64_000),
    1_000,
  )
  const timing = await getHudhaifyTimestamps(chapter, ayahCount, durationMs)

  return {
    audioUrl,
    fileSize,
    openingStartMs: 0,
    timingMode: timing.timingMode,
    timestamps: timing.timestamps,
    source: "MP3Quran.net",
  }
}
