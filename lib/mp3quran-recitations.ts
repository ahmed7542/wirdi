const MP3QURAN_RECITERS_API = "https://www.mp3quran.net/api/v3/reciters?language=ar"

export const AL_BANNA_RECITER_ID = 1001
export const AL_HUDHAIFY_RECITER_ID = 1002

export const MP3QURAN_CHAPTER_RECITER_IDS = new Set([
  AL_BANNA_RECITER_ID,
  AL_HUDHAIFY_RECITER_ID,
])

type Mp3QuranMoshaf = {
  id: number
  rewaya_id?: number
  server: string
  surah_list: string
}

type Mp3QuranReciter = {
  id: number
  moshaf: Mp3QuranMoshaf[]
}

type Mp3QuranCatalog = {
  reciters: Mp3QuranReciter[]
}

const RECITER_CONFIG = {
  [AL_BANNA_RECITER_ID]: {
    catalogReciterId: 121,
    moshafId: 121,
    fallbackServer: "https://server8.mp3quran.net/bna/",
  },
  [AL_HUDHAIFY_RECITER_ID]: {
    catalogReciterId: 74,
    moshafId: 74,
    fallbackServer: "https://server9.mp3quran.net/hthfi/",
  },
} as const

export async function getMp3QuranChapterAudio(reciter: number, chapter: number) {
  const config = RECITER_CONFIG[reciter as keyof typeof RECITER_CONFIG]
  if (!config) throw new Error("MP3Quran chapter reciter is not supported")

  let server: string = config.fallbackServer
  try {
    const response = await fetch(MP3QURAN_RECITERS_API, {
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
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

  return {
    audioUrl: `${server}${String(chapter).padStart(3, "0")}.mp3`,
    source: "MP3Quran.net",
  }
}
