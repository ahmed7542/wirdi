import { getSurahMeta, type Surah } from "quran-meta/hafs"

const SAADI_DATASET_REVISION = "05d5ba765d77c6ca6d43c30f0e1c273deb137454"
const SAADI_EDITION = "ar-tafsir-as-saadi"
const SAADI_RESOURCE = {
  id: "saadi",
  name: "تفسير السعدي",
  author: "عبد الرحمن بن ناصر السعدي",
  sourceName: "Quranic Universal Library",
  sourceUrl: "https://qul.tarteel.ai/resources/tafsir/308",
  datasetUrl: "https://github.com/spa5k/tafsir_api",
  version: SAADI_DATASET_REVISION,
} as const

type SourceEntry = {
  text?: unknown
  ayah?: unknown
  surah?: unknown
}

function cleanTafsirText(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;/gi, "\"")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function parseVerseKey(value: string | null) {
  const match = value?.match(/^(\d{1,3}):(\d{1,3})$/)
  if (!match) return null
  const chapter = Number(match[1])
  const ayah = Number(match[2])
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 114) return null
  const meta = getSurahMeta(chapter as Surah)
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > meta.ayahCount) return null
  return { chapter, ayah, verseKey: `${chapter}:${ayah}` }
}

async function getSaadiChapter(chapter: number) {
  const sourceUrl = `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@${SAADI_DATASET_REVISION}/tafsir/${SAADI_EDITION}/${chapter}.json`
  const response = await fetch(sourceUrl, { next: { revalidate: 60 * 60 * 24 * 30 } })
  if (!response.ok) throw new Error(`Saadi source returned ${response.status}`)
  const source = (await response.json()) as SourceEntry[]
  const verses = source.flatMap((entry) => {
    const surah = Number(entry.surah)
    const ayah = Number(entry.ayah)
    const text = typeof entry.text === "string" ? cleanTafsirText(entry.text) : ""
    if (surah !== chapter || !Number.isInteger(ayah) || ayah < 1 || !text) return []
    return [{ verseKey: `${surah}:${ayah}`, surah, ayah, text }]
  }).sort((first, second) => first.ayah - second.ayah)

  return verses.reduce<Array<{
    verseKey: string
    verseKeys: string[]
    surah: number
    ayah: number
    text: string
    rangeStartVerseKey: string
    rangeEndVerseKey: string
  }>>((groups, verse) => {
    const previous = groups.at(-1)
    const previousEnd = previous ? Number(previous.rangeEndVerseKey.split(":")[1]) : 0
    if (previous && previous.text === verse.text && verse.ayah === previousEnd + 1) {
      previous.verseKeys.push(verse.verseKey)
      previous.rangeEndVerseKey = verse.verseKey
      return groups
    }
    groups.push({
      ...verse,
      verseKeys: [verse.verseKey],
      rangeStartVerseKey: verse.verseKey,
      rangeEndVerseKey: verse.verseKey,
    })
    return groups
  }, [])
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tafsir = searchParams.get("tafsir") ?? "saadi"
  if (tafsir !== "saadi") {
    return Response.json({ error: "التفسير المحدد غير متاح" }, { status: 400 })
  }

  const verse = parseVerseKey(searchParams.get("verseKey"))
  const chapterParam = Number(searchParams.get("chapter"))
  const chapter = verse?.chapter ?? chapterParam
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 114) {
    return Response.json({ error: "حدد آية أو سورة صالحة" }, { status: 400 })
  }

  try {
    const entries = await getSaadiChapter(chapter)
    if (verse) {
      const group = entries.find((item) => item.verseKeys.includes(verse.verseKey))
      if (!group) return Response.json({ error: "لا يوجد تفسير لهذه الآية" }, { status: 404 })
      const entry = { ...group, verseKey: verse.verseKey, ayah: verse.ayah }
      return Response.json(
        { resource: SAADI_RESOURCE, chapter, chapterName: getSurahMeta(chapter as Surah).name, entry },
        { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=604800" } },
      )
    }

    return Response.json(
      { resource: SAADI_RESOURCE, chapter, chapterName: getSurahMeta(chapter as Surah).name, entries },
      { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=604800" } },
    )
  } catch (error) {
    console.error("Failed to load Saadi tafsir", error)
    return Response.json({ error: "تعذر تحميل تفسير السعدي الآن" }, { status: 502 })
  }
}
