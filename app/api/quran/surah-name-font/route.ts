const SURAH_NAME_FONT_URL =
  "https://static-cdn.tarteel.ai/qul/fonts/surah-names/v4/surah-name-v4.ttf"

export async function GET() {
  try {
    const response = await fetch(SURAH_NAME_FONT_URL, {
      next: { revalidate: 60 * 60 * 24 * 30 },
    })
    if (!response.ok || !response.body) {
      throw new Error(`Surah name font returned ${response.status}`)
    }

    return new Response(response.body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "font/ttf",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    console.error("Failed to load the Surah name font", error)
    return Response.json({ error: "تعذر تحميل خط أسماء السور." }, { status: 502 })
  }
}
