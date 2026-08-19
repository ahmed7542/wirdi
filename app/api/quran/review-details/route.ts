import { findPage, getSurahMeta, isValidSurahAyah, type AyahNo, type Surah } from "quran-meta/hafs"

const QURAN_API_URL = "https://api.quran.com/api/v4"
const MAX_VERSES = 20

type VerseResponse = {
  verse?: {
    verse_key: string
    page_number: number
    text_qpc_hafs: string
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keys = [...new Set(
    (searchParams.get("keys") ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
  )]

  if (keys.length === 0 || keys.length > MAX_VERSES) {
    return Response.json({ error: `يجب تحديد ما بين آية واحدة و${MAX_VERSES} آية` }, { status: 400 })
  }

  const parsedKeys = keys.map((key) => {
    const pair = key.split(":").map(Number) as [number, number]
    return { key, pair }
  })
  if (parsedKeys.some(({ pair }) => !isValidSurahAyah(pair))) {
    return Response.json({ error: "يتضمن الطلب رقم آية غير صالح" }, { status: 400 })
  }

  const details = await Promise.all(parsedKeys.map(async ({ key, pair }) => {
    try {
      const response = await fetch(`${QURAN_API_URL}/verses/by_key/${key}?fields=text_qpc_hafs`, {
        next: { revalidate: 60 * 60 * 24 * 30 },
      })
      if (!response.ok) throw new Error(`Quran API returned ${response.status}`)
      const data = (await response.json()) as VerseResponse
      const verse = data.verse
      if (!verse?.text_qpc_hafs) throw new Error(`Missing verse text for ${key}`)
      const chapter = pair[0] as Surah
      return {
        verseKey: key,
        chapterName: getSurahMeta(chapter).name,
        verseText: verse.text_qpc_hafs.trim(),
        pageNumber: verse.page_number || findPage(chapter, pair[1] as AyahNo),
      }
    } catch (error) {
      console.error(`Failed to load review details for ${key}`, error)
      return null
    }
  }))

  return Response.json({ details: details.filter(Boolean) }, {
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800",
    },
  })
}
