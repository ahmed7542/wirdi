import { readFile } from "node:fs/promises"
import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib"

import {
  getQuranSearchMatchGroup,
  normalizeQuranSearchRankingText,
  rankQuranSearchResults,
} from "../lib/quran-search-ranking"

test("يصنف اللواصق كتطابق مباشر ويرتب الصلة حسب الاكتمال والقرب", () => {
  const attachedResult = { verseKey: "1:1", text: "وَهُوَ ٱلْعَلِيمُ ٱلْحَكِيمُ" }
  const prefixedResult = { verseKey: "1:2", text: "فَإِنَّ ٱللَّهَ غَفُورٌ رَّحِيمٌ" }
  expect(getQuranSearchMatchGroup(attachedResult, "هو العليم الحكيم")).toBe("direct")
  expect(getQuranSearchMatchGroup({ verseKey: "1:3", text: "هُوَ ٱلْعَلِيمُ ٱلْحَكِيمُ" }, "وهو العليم الحكيم")).toBe("related")
  expect(getQuranSearchMatchGroup(prefixedResult, "ان الله غفور رحيم")).toBe("direct")
  const creationVerse = "ٱلْحَمْدُ لِلَّهِ ٱلَّذِى خَلَقَ ٱلسَّمَـٰوَٰتِ وَٱلْأَرْضَ وَجَعَلَ ٱلظُّلُمَـٰتِ وَٱلنُّورَ"
  expect(normalizeQuranSearchRankingText(creationVerse)).toBe("الحمد لله الذي خلق السماوات والارض وجعل الظلمات والنور")
  expect(getQuranSearchMatchGroup({
    verseKey: "6:1",
    text: creationVerse,
  }, "خلق السماوات والارض")).toBe("direct")
  expect(getQuranSearchMatchGroup(attachedResult, "هو العليم الحكييم")).toBe("related")

  const query = "الله غفور رحيم"
  const ranked = rankQuranSearchResults([
    { verseKey: "1:4", text: "الله غفور" },
    { verseKey: "1:3", text: "رحيم الله غفور" },
    { verseKey: "1:2", text: "الله واسع الفضل كثير العطاء وهو غفور رحيم" },
    { verseKey: "1:1", text: "الله واسع غفور رحيم" },
  ], query)
  expect(ranked.map((result) => result.verseKey)).toEqual(["1:1", "1:2", "1:3", "1:4"])
})

async function openMushaf(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" })
  await expect(page.locator("[data-qcf-line]").first()).toBeVisible()
}

test("يحوّل لغة الواجهة ويحفظها دون تغيير النص القرآني", async ({ page }) => {
  await openMushaf(page)
  await expect(page.locator("html")).toHaveAttribute("lang", "ar")
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  const originalQuran = await page.locator("[data-quran-text-page]").first().innerText()

  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()
  const languageControl = page.locator('[data-settings-content="reading"] [data-language-control]')
  await expect(languageControl).toBeVisible()
  await languageControl.locator('[data-language-option="en"]').click()

  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr")
  expect(await page.locator("[data-quran-text-page]").first().evaluate((element) => getComputedStyle(element).direction)).toBe("rtl")
  await expect(page.getByRole("heading", { name: "Wirdy settings" })).toBeVisible()
  await expect(languageControl.locator('[data-language-option="en"]')).toHaveAttribute("data-state", "on")
  expect(await page.evaluate(() => window.localStorage.getItem("wird-interface-language-v1"))).toBe("en")
  expect(await page.locator("[data-quran-text-page]").first().innerText()).toBe(originalQuran)

  await page.getByRole("button", { name: "Close settings" }).click()
  await page.reload({ waitUntil: "networkidle" })
  await expect(page.locator("[data-qcf-line]").first()).toBeVisible()
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr")
  await expect(page.getByRole("button", { name: "App settings" })).toBeVisible()
  expect(await page.locator("[data-quran-text-page]").first().innerText()).toBe(originalQuran)
})

test("يدعم البحث الإنجليزي البنيوي وأسماء السور الرسمية", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("wird-interface-language-v1", "en"))
  await openMushaf(page)
  await page.getByRole("button", { name: /Open search and navigation/ }).click()
  const search = page.getByLabel("Quick Quran search").first()
  const queries = [
    ["Baqarah", "surah-2", "Surah Al-Baqarah"],
    ["Al-Kahf", "surah-18", "Surah Al-Kahf"],
    ["Surah Yasin", "surah-36", "Surah Ya-Sin"],
    ["Juz 5", "juz-5", "Juz 5"],
    ["Hizb 12", "hizb-12", "Hizb 12"],
    ["Page 42", "page-42", "Page 42"],
    ["2:255", "verse-2:255", "Surah Al-Baqarah"],
  ] as const

  for (const [query, resultId, expectedLabel] of queries) {
    await search.fill(query)
    await expect(page.locator(`button[data-search-id="${resultId}"]:visible`)).toContainText(expectedLabel)
  }

  const directAyahResult = page.locator('button[data-search-id="verse-2:255"]:visible')
  await expect(directAyahResult).toContainText("Page 42")
  await expect(directAyahResult).not.toContainText("صفحة")
})

test("يبقي البحث العربي فعالًا بعد إضافة اللغة الإنجليزية", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
  const search = page.locator('input[aria-label="البحث السريع في القرآن"]:visible').first()

  await search.fill("سورة الكهف")
  await expect(page.locator('button[data-search-id="surah-18"]:visible')).toContainText("سورة الكَهف")
  await search.fill("الجزء 5")
  await expect(page.locator('button[data-search-id="juz-5"]:visible')).toContainText("الجزء 5")
  await search.fill("آية الكرسي")
  await expect(page.locator('button[data-verse-key="2:255"]:visible')).toBeVisible()
  await search.fill("2:255")
  const directAyahResult = page.locator('button[data-search-id="verse-2:255"]:visible')
  await expect(directAyahResult).toContainText("صفحة 42")
  await expect(directAyahResult).not.toContainText("Page 42")
})

test("يشغّل الواجهة الإنجليزية والبحث المحلي دون اتصال", async ({ page, context }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => window.localStorage.setItem("wird-interface-language-v1", "en"))
  await openMushaf(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js?release=english-offline-test", {
      scope: "/",
      updateViaCache: "none",
    })
    await navigator.serviceWorker.ready
  })
  await page.reload({ waitUntil: "networkidle" })
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect(page.getByRole("button", { name: "App settings" })).toBeVisible()

  await context.setOffline(true)
  try {
    await page.goto("/?english-offline=1", { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-qcf-line]").first()).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("lang", "en")
    await page.getByRole("button", { name: /Open search and navigation/ }).click()
    await page.getByLabel("Quick Quran search").first().fill("Juz 5")
    await expect(page.locator('button[data-search-id="juz-5"]:visible')).toContainText("Juz 5")
    await expect(page.getByText("No internet connection")).toHaveCount(0)
  } finally {
    await context.setOffline(false)
  }
})

test("يقدم تطابق عبارة الآية ويرتب التطابقات المتصلة بالمصحف", async ({ page, request }) => {
  const exactPhraseQuery = "وهو العليم الحكيم"
  const exactPhraseResponse = await request.get("/api/quran/navigation", { params: { q: exactPhraseQuery } })
  expect(exactPhraseResponse.ok()).toBeTruthy()
  const exactPhrasePayload = await exactPhraseResponse.json() as {
    results: Array<{ verseKey: string; matchGroup: "direct" | "related" }>
    directResultCount: number
    relatedResultCount: number
    totalResults?: number
  }
  expect(exactPhrasePayload.results.slice(0, 2).map((result) => result.verseKey)).toEqual(["66:2", "12:83"])
  expect(exactPhrasePayload.results.slice(0, 2).map((result) => result.matchGroup)).toEqual(["direct", "related"])
  expect(exactPhrasePayload.directResultCount).toBe(1)
  expect(exactPhrasePayload.relatedResultCount).toBe(49)
  expect(exactPhrasePayload.totalResults).toBeUndefined()

  await openMushaf(page)
  await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
  const searchInput = page.locator('input[aria-label="البحث السريع في القرآن"]:visible')
  await searchInput.fill(exactPhraseQuery)
  await expect(page.locator('button[data-verse-key="66:2"]:visible')).toBeVisible()
  await expect(page.locator('button[data-verse-key="43:84"]:visible')).toHaveCount(0)
  await expect(page.locator('[data-direct-result-count="1"]:visible')).toHaveText("1 تطابق مباشر")
  await expect(page.getByText("201 نتيجة", { exact: true })).toHaveCount(0)
  const exactPhraseVerseKeys = await page.locator('button[data-search-id^="verse-"]:visible')
    .evaluateAll((results) => results.map((result) => result.getAttribute("data-verse-key")))
  expect(exactPhraseVerseKeys).toEqual(["66:2"])
  await expect(page.locator('[data-search-group="direct"]:visible')).toHaveText("تطابق مباشر")
  await expect(page.locator('[data-search-group="related"]:visible')).toHaveCount(0)
  expect(await page.locator("[data-quick-navigator]").evaluate((root) => {
    const directResults = [...root.querySelectorAll<HTMLElement>('[data-search-result-group="direct"]')]
    const toggle = root.querySelector<HTMLElement>("[data-related-results-toggle]")
    return Boolean(toggle) && directResults.every((result) => result.getBoundingClientRect().bottom <= toggle.getBoundingClientRect().top + 1)
  })).toBeTruthy()

  await page.getByRole("button", { name: "إظهار النتائج ذات الصلة" }).click()
  await expect(page.locator('button[data-verse-key="43:84"]:visible')).toBeVisible()
  await expect(page.locator('[data-search-group="related"]:visible')).toHaveText("نتائج ذات صلة")
  expect(await page.locator("[data-quick-navigator]").evaluate((root) => {
    const toggle = root.querySelector<HTMLElement>("[data-related-results-toggle]")
    const relatedResults = [...root.querySelectorAll<HTMLElement>('[data-search-result-group="related"]')]
    return Boolean(toggle) && relatedResults.every((result) => toggle.getBoundingClientRect().bottom <= result.getBoundingClientRect().top + 1)
  })).toBeTruthy()
  const visibleGroups = await page.locator("[data-search-result-group]:visible")
    .evaluateAll((results) => results.map((result) => result.getAttribute("data-search-result-group")))
  expect(visibleGroups[0]).toBe("direct")
  expect(visibleGroups.slice(1)).toContain("related")
  const directHighlight = page.locator('button[data-verse-key="66:2"]:visible [data-search-highlight="true"]')
  await expect(directHighlight).toHaveCount(1)
  await expect(directHighlight).toContainText(/وَهُوَ.*ٱلْعَلِيمُ.*ٱلْحَكِيم/)
  await expect(page.locator('button[data-verse-key="43:84"]:visible [data-search-highlight="true"]')).not.toHaveCount(0)

  await page.getByRole("button", { name: "استعراض النتائج في صفحة كاملة" }).click()
  const fullResults = page.locator('[data-search-fullscreen="true"]')
  await expect(fullResults).toBeVisible()
  await expect(fullResults.locator("[data-search-stats]")).toContainText("التطابق المباشر")
  await expect(fullResults.locator("[data-search-stats]")).toContainText("نتائج ذات صلة")
  await expect(fullResults.locator("[data-search-stats]")).not.toContainText("الإجمالي")
  await expect(fullResults.locator("[data-search-stats]")).not.toContainText("المعروض")
  expect(await fullResults.locator("[data-search-result-group]").count()).toBeGreaterThan(10)
  await page.getByRole("button", { name: "العودة إلى قائمة النتائج المصغرة" }).click()
  await expect(fullResults).toHaveCount(0)

  const connectedQuery = "ان الله غفور رحيم"
  const expectedConnectedVerseKeys = ["2:173", "2:182", "2:199", "5:34"]
  const connectedResponse = await request.get("/api/quran/navigation", { params: { q: connectedQuery } })
  expect(connectedResponse.ok()).toBeTruthy()
  const connectedPayload = await connectedResponse.json() as { results: Array<{ verseKey: string }> }
  expect(connectedPayload.results.slice(0, 4).map((result) => result.verseKey)).toEqual(expectedConnectedVerseKeys)

  await searchInput.fill(connectedQuery)
  await expect(page.locator('button[data-verse-key="2:173"]:visible')).toBeVisible()
  const connectedVerseKeys = await page.locator('button[data-search-id^="verse-"]:visible')
    .evaluateAll((results) => results.map((result) => result.getAttribute("data-verse-key")))
  expect(connectedVerseKeys.slice(0, 4)).toEqual(expectedConnectedVerseKeys)
})

test("يقدم الإجراء اليومي وينظم العلامات الكثيرة في لوحة وِردي", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("wird-bookmarks", JSON.stringify([
      { id: "mark-1", page: 1, verseKey: "1:1", chapterId: 1, chapterName: "الفاتحة", positionMs: 0, reciter: 6, createdAt: 6 },
      { id: "mark-2", page: 2, verseKey: "2:1", chapterId: 2, chapterName: "البقرة", positionMs: 0, reciter: 6, createdAt: 5 },
      { id: "mark-3", page: 50, verseKey: "3:1", chapterId: 3, chapterName: "آل عمران", positionMs: 0, reciter: 6, createdAt: 4 },
      { id: "mark-4", page: 77, verseKey: "4:1", chapterId: 4, chapterName: "النساء", positionMs: 0, reciter: 6, createdAt: 3 },
      { id: "mark-5", page: 106, verseKey: "5:1", chapterId: 5, chapterName: "المائدة", positionMs: 0, reciter: 6, createdAt: 2 },
      { id: "mark-6", page: 604, verseKey: "112:1", chapterId: 112, chapterName: "الإخلاص", positionMs: 0, reciter: 6, createdAt: 1 },
    ]))
  })
  await openMushaf(page)
  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()

  const today = page.locator('[data-dashboard-section="today"]')
  const plans = page.locator('[data-dashboard-section="plans"]')
  await expect(today).toBeVisible()
  expect(await today.evaluate((element) => element.getBoundingClientRect().top))
    .toBeLessThan(await plans.evaluate((element) => element.getBoundingClientRect().top))

  await expect(page.locator("[data-dashboard-bookmark]")).toHaveCount(5)
  await page.getByRole("button", { name: "عرض كل العلامات (6)" }).click()
  await expect(page.locator("[data-dashboard-bookmark]")).toHaveCount(6)
  await page.getByLabel("البحث في علامات الوقوف").fill("الإخلاص")
  await expect(page.locator("[data-dashboard-bookmark]")).toHaveCount(1)
  await expect(page.locator("[data-dashboard-bookmark]")).toContainText("سورة الإخلاص")
})

test("يعرض المصحف دون أخطاء أو تجاوز أفقي", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await openMushaf(page)
  await expect(page.locator("[data-qcf-line]")).toHaveCount(8)
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
  expect(errors).toEqual([])
})

test("يبحث عن آية الكرسي بالاسم الشائع وينتقل إليها", async ({ page, request }) => {
  const response = await request.get("/api/quran/navigation", { params: { q: "آية الكرسي" } })
  expect(response.ok()).toBeTruthy()
  const payload = await response.json()
  expect(payload.results).toHaveLength(1)
  expect(payload.results[0].verseKey).toBe("2:255")
  expect(payload.results[0].text).not.toMatch(/[\u06D6-\u06ED\uFD3E\uFD3F|¦]/)

  await openMushaf(page)
  await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
  await page.locator('input[aria-label="البحث السريع في القرآن"]:visible').first().fill("آية الكرسي")

  const contextToggle = page.locator('[data-search-context-toggle="2:255"]:visible')
  await expect(contextToggle).toBeVisible()
  await contextToggle.click()
  const context = page.locator('[data-search-context="2:255"]:visible')
  await expect(context.getByText("الآية السابقة · 2:254", { exact: true })).toBeVisible()
  await expect(context.getByText("الآية التالية · 2:256", { exact: true })).toBeVisible()
  await expect(context.locator("[data-quran-content]")).toHaveCount(2)

  await page.locator('button[data-verse-key="2:255"]:visible').click()
  await expect(page.getByLabel("صفحة 42 من المصحف الشريف")).toBeVisible()
  const returnPrompt = page.locator("[data-reading-return-prompt]")
  const returnButton = page.getByRole("button", { name: "العودة إلى موضعك السابق" })
  await expect(returnPrompt).toBeVisible()
  await expect(returnButton).toHaveAttribute("data-reading-return-source", "search")
  await expect(page.getByRole("button", { name: "إغلاق خيار العودة" })).toBeVisible()
  const promptBounds = (await returnPrompt.boundingBox())!
  const viewportWidth = page.viewportSize()!.width
  expect(Math.abs((promptBounds.x + promptBounds.width / 2) - viewportWidth / 2)).toBeLessThanOrEqual(1)
  expect(promptBounds.y).toBeLessThanOrEqual(80)
  expect(promptBounds.height).toBeLessThanOrEqual(36)
  await returnButton.click()
  await expect(page.getByLabel("صفحة 1 من المصحف الشريف")).toBeVisible()
  await expect(returnButton).toHaveCount(0)
})

test("يغلق خيار العودة يدويًا ويخفيه تلقائيًا بعد مهلة قصيرة", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
  await page.locator('input[aria-label="البحث السريع في القرآن"]:visible').first().fill("آية الكرسي")
  await page.locator('button[data-verse-key="2:255"]:visible').click()
  await expect(page.getByLabel("صفحة 42 من المصحف الشريف")).toBeVisible()

  const returnPrompt = page.locator("[data-reading-return-prompt]")
  await expect(returnPrompt).toBeVisible()
  await page.getByRole("button", { name: "إغلاق خيار العودة" }).click()
  await expect(returnPrompt).toHaveCount(0)

  await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
  await page.locator('input[aria-label="البحث السريع في القرآن"]:visible').first().fill("صفحة 1")
  await page.locator('button[data-search-id="page-1"]:visible').click()
  await expect(page.getByLabel("صفحة 1 من المصحف الشريف")).toBeVisible()
  await expect(returnPrompt).toBeVisible()
  await expect(returnPrompt).toHaveCount(0, { timeout: 7_500 })
})

test("يوحد فئات التنقل أسفل بحث المصحف دون قسم منفصل", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()

  const tabs = page.locator("[data-quick-navigator-tabs]")
  await expect(tabs.getByRole("tab")).toHaveText(["الأقرب", "السور", "الأجزاء", "الأحزاب", "الصفحات"])
  await expect(page.locator("[data-navigator-track]:visible")).toHaveCount(0)

  await tabs.getByRole("tab", { name: "الأحزاب" }).click()
  await expect(page.locator('[data-quick-browse="hizbs"] [data-quick-browse-item]')).toHaveCount(60)
  await expect(page.getByRole("button", { name: /الحزب 1، صفحة 1/ })).toBeVisible()

  await tabs.getByRole("tab", { name: "الصفحات" }).click()
  await expect(page.getByLabel("رقم صفحة المصحف")).toBeVisible()

  const search = page.getByLabel("البحث السريع في القرآن")
  await search.fill("آية الكرسي")
  await expect(tabs).toBeHidden()
  await expect(page.locator('button[data-verse-key="2:255"]')).toBeVisible()
  await search.fill("")
  await expect(tabs).toBeVisible()

  await tabs.getByRole("tab", { name: "السور" }).click()
  await page.locator('[data-quick-browse-item="surah-2"]').click()
  await expect(page.getByLabel("صفحة 2 من المصحف الشريف")).toBeVisible()
})

test("يوحد اقتراحات الرقم المفرد بين البحث العادي والاستماع", async ({ page }) => {
  const expectedIds = ["surah-5", "juz-5", "hizb-5", "page-5"]
  let textSearchRequests = 0
  page.on("request", (request) => {
    if (request.url().includes("/api/quran/navigation?q=")) textSearchRequests += 1
  })

  await openMushaf(page)
  await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
  await page.locator('input[aria-label="البحث السريع في القرآن"]:visible').fill("5")
  for (const id of expectedIds) await expect(page.locator(`button[data-search-id="${id}"]:visible`)).toBeVisible()
  await page.getByRole("button", { name: "إغلاق البحث السريع" }).click()

  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
  await page.getByRole("combobox", { name: "البحث والانتقال في المصحف" }).click()
  await page.getByLabel("البحث في المصحف").fill("5")
  for (const id of expectedIds) await expect(page.locator(`button[data-search-id="${id}"]:visible`)).toBeVisible()
  await page.keyboard.press("Escape")

  await page.getByRole("radio", { name: "استماع" }).click()
  await page.getByLabel("اختيار بداية النطاق").click()
  await page.getByLabel("البحث عن بداية النطاق").fill("٥")
  const rangeDialog = page.getByRole("dialog")
  for (const id of expectedIds) await expect(rangeDialog.locator(`button[data-search-id="${id}"]`)).toBeVisible()
  expect(textSearchRequests).toBe(0)
})

test("يفتح الصفحات 121 إلى 123 بآيات مطابقة لتخطيط QCF", async ({ page, request }) => {
  await openMushaf(page)
  const targets = [
    { page: 121, verseKey: "5:78" },
    { page: 122, verseKey: "5:84" },
    { page: 123, verseKey: "5:91" },
  ]

  for (const target of targets) {
    const response = await request.get("/api/quran", {
      params: { page: String(target.page), content: "reading" },
    })
    expect(response.ok()).toBeTruthy()
    const payload = await response.json()
    const verseKeys = payload.verses.map((verse: { verseKey: string }) => verse.verseKey)
    const qcfVerseKeys = [...new Set(payload.qcfPage.lines.flatMap(
      (line: { glyphs: Array<{ verseKey?: string }> }) => line.glyphs.flatMap((glyph) => glyph.verseKey ? [glyph.verseKey] : []),
    ))]
    expect(verseKeys).toEqual(qcfVerseKeys)

    await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
    await page.locator('input[aria-label="البحث السريع في القرآن"]:visible').first().fill(target.verseKey)
    const result = page.locator(`button[data-verse-key="${target.verseKey}"]`)
    await expect(result).toBeVisible()
    await result.evaluate((element: HTMLButtonElement) => element.click())
    await expect(page.getByLabel(`صفحة ${target.page} من المصحف الشريف`).locator("[data-qcf-line]")).toHaveCount(15)
  }
})

test("يفتح الصفحة من الموارد المحفوظة دون شبكة أو خط الجار", async ({ page }) => {
  const targetFont = "https://cdn.jsdelivr.net/npm/quran-qcf4@1.0.3/fonts-woff2/QCF4_Hafs_33_W.woff2"
  await openMushaf(page)
  await page.evaluate(async (fontUrl) => {
    const pageUrl = "/api/quran?page=432&reciter=6"
    const [fontResponse, pageResponse] = await Promise.all([fetch(fontUrl), fetch(pageUrl)])
    const cache = await window.caches.open("wird-test-navigation-resources")
    await Promise.all([
      cache.put(fontUrl, fontResponse),
      cache.put(pageUrl, pageResponse),
    ])
  }, targetFont)

  const requestedFonts = new Set<string>()
  let targetPageRequests = 0
  page.on("request", (request) => {
    const match = request.url().match(/\/fonts-woff2\/(QCF4_Hafs_\d{2}_W\.woff2)$/)
    if (match) requestedFonts.add(match[1])
    if (request.url().includes("/api/quran?page=432&reciter=6")) targetPageRequests += 1
  })

  await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
  await page.locator('input[aria-label="البحث السريع في القرآن"]:visible').first().fill("34:32")
  const result = page.locator('button[data-verse-key="34:32"]')
  await expect(result).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.fonts.check('16px "QCF4_Hafs_33"'))).toBe(true)

  await result.evaluate((element: HTMLButtonElement) => element.click())
  await expect(page.getByLabel("صفحة 432 من المصحف الشريف").locator("[data-qcf-line]").first()).toBeVisible()
  expect(targetPageRequests).toBe(0)
  expect(requestedFonts).not.toContain("QCF4_Hafs_33_W.woff2")
  expect(requestedFonts).not.toContain("QCF4_Hafs_34_W.woff2")
  await expect(page.locator("[data-qcf-loading-preview]")).toHaveCount(0)
})

test("يجلب بيانات القارئ عند وجود صفحة نصية محفوظة", async ({ page }) => {
  await openMushaf(page)
  await page.evaluate(async () => {
    for (const cacheName of await window.caches.keys()) await window.caches.delete(cacheName)
    const response = await fetch("/api/quran?page=1&content=reading&__wird_offline=1")
    const cache = await window.caches.open("wird-test-text-only-page")
    await cache.put("/api/quran?page=1&content=reading", response)
  })

  let reciterPageRequests = 0
  page.on("request", (request) => {
    if (request.url().includes("/api/quran?page=1&reciter=6")) reciterPageRequests += 1
  })
  await page.reload({ waitUntil: "networkidle" })
  await expect(page.locator("[data-qcf-line]").first()).toBeVisible()

  const playButton = page.getByRole("button", { name: "تشغيل", exact: true })
  await expect(playButton).toBeEnabled()
  expect(reciterPageRequests).toBeGreaterThan(0)
  await playButton.click()
  await expect.poll(() => page.locator("audio").evaluate((audio: HTMLAudioElement) => ({
    paused: audio.paused,
    currentTime: audio.currentTime,
    source: audio.currentSrc,
  }))).toMatchObject({ paused: false })
  await expect.poll(() => page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(0)
})

test("يعرض الصفحة قبل اكتمال تحميل بيانات القارئ", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem("wird-reciter", "1002"))
  let releaseFullPage!: () => void
  const fullPageGate = new Promise<void>((resolve) => { releaseFullPage = resolve })
  let fullPageBlocked = false
  await page.route("**/api/quran?page=432&reciter=1002", async (route) => {
    fullPageBlocked = true
    await fullPageGate
    await route.continue()
  })

  try {
    await openMushaf(page)
    const targetFont = "https://cdn.jsdelivr.net/npm/quran-qcf4@1.0.3/fonts-woff2/QCF4_Hafs_33_W.woff2"
    await page.evaluate(async (fontUrl) => {
      const response = await fetch(fontUrl)
      const cache = await window.caches.open("wird-test-reading-font")
      await cache.put(fontUrl, response)
    }, targetFont)

    await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
    await page.locator('input[aria-label="البحث السريع في القرآن"]:visible').first().fill("34:32")
    const result = page.locator('button[data-verse-key="34:32"]')
    await expect(result).toBeVisible()
    await result.evaluate((element: HTMLButtonElement) => element.click())

    await expect(page.getByLabel("صفحة 432 من المصحف الشريف").locator("[data-qcf-line]")).toHaveCount(15)
    expect(fullPageBlocked).toBe(true)
  } finally {
    releaseFullPage()
  }
})

test("لا يعرض إشعار القارئ عند التنقل دون تشغيل", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
  await page.locator('input[aria-label="البحث السريع في القرآن"]:visible').fill("34:32")
  await page.locator('button[data-verse-key="34:32"]').click()
  await expect(page.getByLabel("صفحة 432 من المصحف الشريف")).toBeVisible()

  await page.locator("audio").evaluate((audio) => audio.dispatchEvent(new Event("error")))
  await expect(page.getByText(/تسجيل القارئ|مصدر تلاوة القارئ|تعذر تحميل التلاوة/)).toHaveCount(0)
})

test("يوضح منتقي الموضع ويقدم إجراء اليوم قبل الخطط", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("wird-khatma-plan-v1")
    window.localStorage.removeItem("wird-learning-plan-v1")
  })
  await openMushaf(page)
  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()

  const picker = page.getByRole("combobox", { name: "البحث والانتقال في المصحف" })
  const plans = page.getByRole("heading", { name: "الخطط", exact: true })
  const today = page.getByRole("heading", { name: "اليوم", exact: true })
  await expect(picker).toBeVisible()
  await expect(plans).toBeVisible()
  await expect(page.getByRole("button", { name: /^خطط الحفظ والمراجعة/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /^المتشابهات/ })).toBeVisible()
  await expect(today).toBeVisible()
  expect((await today.boundingBox())!.y).toBeLessThan((await plans.boundingBox())!.y)
  await expect(page.getByRole("button", { name: "أنشئ خطة", exact: true })).toBeVisible()

  await picker.click()
  const search = page.getByLabel("البحث في المصحف")
  await expect(search).toBeVisible()
  const tabs = ["الأقرب", "السور", "الأجزاء", "الصفحات"].map((name) => page.getByRole("tab", { name }))
  const tabBounds = await Promise.all(tabs.map(async (tab) => {
    await expect(tab).toBeVisible()
    return (await tab.boundingBox())!
  }))
  for (const bounds of tabBounds) expect(bounds.height).toBeGreaterThanOrEqual(36)
  const tabWidths = tabBounds.map((bounds) => bounds.width)
  expect(Math.max(...tabWidths) - Math.min(...tabWidths)).toBeLessThan(2)
  expect(tabWidths.reduce((sum, width) => sum + width, 0)).toBeGreaterThan((await search.boundingBox())!.width * 0.9)
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "أنشئ خطة", exact: true }).click()
  await expect(page.getByRole("heading", { name: "خطط الحفظ والمراجعة" })).toBeVisible()
})

test("ينشئ خطة مستقلة لكل نوع ويبعد الإغلاق عن أيقونات العناوين", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("wird-khatma-plan-v1")
    window.localStorage.removeItem("wird-learning-plan-v1")
  })
  await openMushaf(page)
  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
  await page.getByRole("button", { name: /^خطط الحفظ والمراجعة/ }).click()

  const learningDialog = page.getByRole("dialog")
  const learningClose = (await learningDialog.locator(":scope > button").first().boundingBox())!
  const learningTitleIcon = (await learningDialog.getByRole("heading", { name: "خطط الحفظ والمراجعة" }).locator("svg").boundingBox())!
  expect(learningClose.x + learningClose.width).toBeLessThan(learningTitleIcon.x)

  await learningDialog.getByRole("button", { name: /إنشاء خطة حفظ جديد/ }).click()
  await learningDialog.locator('[data-learning-plan-type="reinforce"]').click()
  await learningDialog.getByRole("button", { name: /إنشاء خطة تثبيت/ }).click()
  await learningDialog.locator('[data-learning-plan-type="review"]').click()
  await learningDialog.getByRole("button", { name: /إنشاء خطة مراجعة/ }).click()

  const storedPlans = await page.evaluate(() => JSON.parse(window.localStorage.getItem("wird-learning-plan-v1") ?? "[]"))
  expect(storedPlans.map((plan: { type: string }) => plan.type)).toEqual(["new", "reinforce", "review"])
  await expect(learningDialog.getByText("3 من 3 خطط نشطة")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.getByRole("button", { name: /خطط الحفظ والمراجعة.*3 من 3/ })).toBeVisible()

  await page.getByRole("button", { name: /^الختمة/ }).first().click()
  const khatmaDialog = page.getByRole("dialog")
  const khatmaClose = (await khatmaDialog.locator(":scope > button").first().boundingBox())!
  const khatmaTitleIcon = (await khatmaDialog.getByRole("heading", { name: "مسار الختمة" }).locator("svg").boundingBox())!
  expect(khatmaClose.x + khatmaClose.width).toBeLessThan(khatmaTitleIcon.x)
})

test("يرحّل خطة المستخدم السابقة دون فقد التقدم", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("wird-learning-plan-v1", JSON.stringify({
      version: 2,
      type: "reinforce",
      startPage: 10,
      targetPages: 3,
      completedPages: 1,
      durationDays: 30,
      startedAt: "2026-08-01",
      updatedAt: 1,
    }))
  })
  await openMushaf(page)
  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
  await expect(page.getByRole("button", { name: /خطط الحفظ والمراجعة.*1 من 3.*تثبيت/ })).toBeVisible()
  await page.getByRole("button", { name: /^خطط الحفظ والمراجعة/ }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog.locator('[data-learning-plan-type="reinforce"]')).toHaveAttribute("data-state", "on")
  await expect(dialog.getByText(/الصفحات 10–12/)).toBeVisible()
  await dialog.getByRole("button", { name: "تعديل الخطة" }).click()
  await dialog.getByRole("button", { name: "حفظ التعديلات" }).click()

  const storedPlans = await page.evaluate(() => JSON.parse(window.localStorage.getItem("wird-learning-plan-v1") ?? "[]"))
  expect(Array.isArray(storedPlans)).toBe(true)
  expect(storedPlans).toHaveLength(1)
  expect(storedPlans[0].type).toBe("reinforce")
  expect(storedPlans[0].completedAyahs).toBeGreaterThan(0)
})

test("يفتح آخر نسخة احتياطية على خيارات النسخ الاحتياطي", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
  await page.getByRole("button", { name: "فتح إعدادات النسخ الاحتياطي" }).click()

  await expect(page.getByRole("heading", { name: "إعدادات وِردي" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "التطبيق" })).toHaveAttribute("data-state", "active")
  await expect(page.locator("[data-backup-settings]")).toBeVisible()
})

test("يعرض المصحف المفتوح في رأس الهاتف ويستخدم أهداف لمس أوضح", async ({ page }) => {
  await openMushaf(page)
  const appButton = page.getByRole("button", { name: "فتح لوحة وِردي" })
  await expect(appButton.locator("[data-app-icon]")).toHaveCount(1)
  const settingsButton = page.getByRole("button", { name: "إعدادات التطبيق" })
  await expect(settingsButton.locator("svg.lucide-settings")).toHaveCount(1)
  expect((await settingsButton.boundingBox())!.x).toBeLessThanOrEqual(12)
  const labels = ["فتح لوحة وِردي", "أدوات القراءة", "إعدادات التطبيق", "المزيد من أدوات الصفحة"]
  for (const label of labels) {
    const bounds = await page.getByRole("button", { name: label }).boundingBox()
    expect(bounds?.width).toBeGreaterThanOrEqual(36)
    expect(bounds?.height).toBeGreaterThanOrEqual(36)
  }
  await expect(page.getByRole("button", { name: "عرض المصحف بملء الشاشة" })).toHaveCount(0)
  await page.getByRole("button", { name: "المزيد من أدوات الصفحة" }).click()
  await expect(page.getByRole("menuitem", { name: "ملء الشاشة" })).toBeVisible()
})

test("يجعل تلاوة الآية الإجراء الأساسي في قائمة الضغط المطول", async ({ page }) => {
  await openMushaf(page)
  await page.locator("[data-quran-text-page] [data-verse-key]").first().click({ button: "right" })

  const dialog = page.getByRole("dialog")
  const playback = dialog.getByRole("button", { name: /بدء التلاوة من هذه الآية/ })
  await expect(playback).toBeVisible()
  await expect(playback).toBeFocused()
  await expect(dialog.getByRole("button", { name: "بدء التسميع" })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "التفسير" })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "المتشابهات" })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "نسخ الآية" })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "للجلسة القادمة" })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "أضف للمراجعة" })).toBeVisible()
})

test("يخفي الواجهة ويكبر صفحة المصحف بانتقال خفيف عند ضغط الوسط", async ({ page }) => {
  await openMushaf(page)
  const header = page.getByRole("banner")
  await expect(header).toHaveCSS("transition-duration", "0.36s")
  await expect(header).toHaveCSS("transition-timing-function", "cubic-bezier(0.22, 1, 0.36, 1)")
  const mushafPage = page.locator("[data-quran-text-page]").first()
  const bounds = await mushafPage.boundingBox()
  if (!bounds) throw new Error("تعذر قياس صفحة المصحف")

  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await expect(page.getByRole("button", { name: "العودة إلى واجهة المصحف" })).toBeVisible()
  await expect(header).toHaveAttribute("data-reader-chrome-state", "hidden")
  await expect(page.locator('[data-reader-chrome="player"]')).toHaveAttribute("data-reader-chrome-state", "hidden")
  await expect(header).toHaveCSS("opacity", "0")
  await expect(page.locator("[data-reader-page-shell]")).toHaveCSS("transition-duration", "0.3s")

  await page.evaluate(() => {
    const states: string[] = []
    document.querySelectorAll<HTMLElement>("[data-reader-chrome]").forEach((element) => {
      const observer = new MutationObserver(() => {
        states.push(`${element.dataset.readerChrome}:${element.dataset.readerChromeState}`)
      })
      observer.observe(element, { attributes: true, attributeFilter: ["data-reader-chrome-state"] })
    })
    Object.assign(window, { __wirdReaderChromeStates: states })
  })
  await page.getByRole("button", { name: "العودة إلى واجهة المصحف" }).click()
  const transitionStates = await page.evaluate(() => (
    window as typeof window & { __wirdReaderChromeStates: string[] }
  ).__wirdReaderChromeStates)
  expect(transitionStates).toContain("header:revealing")
  expect(transitionStates).toContain("player:revealing")
  await expect(header).toHaveCSS("opacity", "1")
  await expect(header).toHaveAttribute("data-reader-chrome-state", "visible")
  await expect(page.locator('[data-reader-chrome="player"]')).toHaveAttribute("data-reader-chrome-state", "visible")
})

test("يجعل التباعد المتوسط افتراضيًا ويرفع رقم الصفحة في ملء الصفحة", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()
  const spacingControl = page.locator('[aria-label="تباعد أسطر الصفحة الكاملة"]')
  await expect(spacingControl.getByRole("radio", { name: "متوسط" })).toHaveAttribute("data-state", "on")
  await page.getByRole("button", { name: "إغلاق الإعدادات" }).click()

  await page.evaluate(() => {
    window.localStorage.setItem("wird-last-reading-v1", JSON.stringify({
      page: 120,
      positionMs: 0,
      reciter: 6,
      viewMode: "text",
      readingMode: "page",
      updatedAt: Date.now(),
    }))
    window.localStorage.setItem("wird-player-settings", JSON.stringify({
      viewMode: "text",
      readingMode: "page",
      lineSpacing: "spacious",
    }))
  })
  await page.reload({ waitUntil: "networkidle" })
  await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
  await page.locator('input[aria-label="البحث السريع في القرآن"]:visible').fill("120")
  await page.locator('button[data-search-id="page-120"]:visible').click()
  await expect(page.getByLabel("صفحة 120 من المصحف الشريف")).toBeVisible()

  const clearance = await page.evaluate(() => {
    const pageNumber = document.querySelector<HTMLElement>("[data-qcf-page-number]")?.getBoundingClientRect()
    const player = document.querySelector<HTMLElement>("[data-quran-player]")?.getBoundingClientRect()
    if (!pageNumber || !player) throw new Error("تعذر قياس رقم الصفحة أو المشغل")
    return player.top - pageNumber.bottom
  })
  expect(clearance).toBeGreaterThanOrEqual(8)
})

test("يقترح اتجاه الجهاز ولا يطبقه إلا بعد الضغط", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => 1 })
  })
  await openMushaf(page)
  const header = page.locator("header > div").first()
  expect((await header.boundingBox())!.height).toBe(48)

  await page.evaluate(() => {
    window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { gamma: 70, beta: 0 }))
  })
  const suggestion = page.getByRole("button", { name: "اعتماد العرض الأفقي" })
  await expect(suggestion).toBeVisible()
  expect((await header.boundingBox())!.height).toBe(48)

  await suggestion.click()
  await expect.poll(async () => (await header.boundingBox())!.height).toBe(40)
  await expect(suggestion).toHaveCount(0)
})

test("يمنع قفل اتجاه الشاشة اقتراح التدوير والتغيير", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => 1 })
  })
  await openMushaf(page)
  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()
  await page.getByRole("button", { name: "التشغيل والمتابعة" }).click()
  const rotationLock = page.getByLabel("قفل اتجاه الشاشة")
  await expect(rotationLock).not.toBeChecked()
  await rotationLock.click()
  await expect(rotationLock).toBeChecked()
  await page.getByRole("button", { name: "إغلاق الإعدادات" }).click()

  await page.evaluate(() => {
    window.dispatchEvent(new DeviceOrientationEvent("deviceorientation", { gamma: 70, beta: 0 }))
  })
  await page.waitForTimeout(300)
  await expect(page.getByRole("button", { name: "اعتماد العرض الأفقي" })).toHaveCount(0)
  expect((await page.locator("header > div").first().boundingBox())!.height).toBe(48)
})

test("يفتح التسميع من زر العين داخل وضع القراءة الحالي", async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("wird-test-fullscreen-requests", "0")
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: async () => {
        const count = Number(window.sessionStorage.getItem("wird-test-fullscreen-requests") ?? "0")
        window.sessionStorage.setItem("wird-test-fullscreen-requests", String(count + 1))
      },
    })
  })
  await openMushaf(page)

  await page.getByRole("button", { name: "بدء التسميع المفتوح" }).first().click()
  await expect(page.getByRole("button", { name: "إظهار جميع الآيات" }).first()).toBeVisible()
  await expect(page.getByText("اضغط على صفحة المصحف لإظهار الآية التالية", { exact: true })).toBeVisible()
  await expect(page.getByRole("banner")).toBeVisible()
  await expect(page.locator("[data-quran-player]")).toBeVisible()
  await expect.poll(() => page.locator("[data-verse-key]").first().evaluate((verse) => getComputedStyle(verse).opacity)).toBe("0")
  expect(await page.evaluate(() => ({
    fullscreen: Boolean(document.fullscreenElement),
    requests: Number(window.sessionStorage.getItem("wird-test-fullscreen-requests") ?? "0"),
  }))).toEqual({ fullscreen: false, requests: 0 })
})

test("يبقي أخطاء التلاوة داخل المشغل مع إعادة المحاولة", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "تشغيل", exact: true }).click()
  await page.locator("audio").evaluate((audio) => audio.dispatchEvent(new Event("error")))
  const alert = page.getByRole("alert").filter({ hasText: "تعذر الوصول إلى مصدر تلاوة القارئ" })
  await expect(alert).toBeVisible()
  await expect(alert.getByRole("button", { name: "إعادة المحاولة" })).toBeVisible()
})

test("تخلو واجهتا القراءة واللوحة من مخالفات Axe", async ({ page }) => {
  await openMushaf(page)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
  await expect(page.getByRole("heading", { name: "لوحة وِردي" })).toBeAttached()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test("يحمل الإعدادات عند الطلب ويحافظ على تباين التبويبات", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()
  await expect(page.getByRole("heading", { name: "إعدادات وِردي" })).toBeVisible()
  await expect(page.getByRole("button", { name: "عرض المصحف" })).toHaveAttribute("data-state", "open")
  await expect(page.getByRole("button", { name: "التشغيل والمتابعة" })).toBeVisible()
  await expect(page.getByRole("button", { name: "إمكانية الوصول" })).toBeVisible()
  await expect(page.getByRole("button", { name: "الألوان" })).toBeVisible()
  const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()
  expect(results.violations).toEqual([])
})

test("يثبت قياسات تبويبات الإعدادات وينقل اللغة إلى القراءة", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()

  const settingsTabs = page.locator("[data-settings-tabs]")
  const readingContent = page.locator('[data-settings-content="reading"]')
  const languageSettings = readingContent.locator("[data-language-settings]")
  const languageOptions = languageSettings.locator("[data-language-option]")

  const assertTabGeometry = async (expectedFontSize: string) => {
    const listBox = (await settingsTabs.boundingBox())!
    const tabBoxes = await settingsTabs.getByRole("tab").evaluateAll((tabs) => tabs.map((tab) => {
      const tabBox = tab.getBoundingClientRect()
      const iconBox = tab.querySelector("svg")!.getBoundingClientRect()
      const indicator = tab.querySelector<HTMLElement>("[data-settings-tab-indicator]")!
      const indicatorBox = indicator.getBoundingClientRect()
      return {
        x: tabBox.x,
        y: tabBox.y,
        width: tabBox.width,
        height: tabBox.height,
        iconWidth: iconBox.width,
        iconHeight: iconBox.height,
        indicatorY: indicatorBox.y,
        indicatorWidth: indicatorBox.width,
        indicatorHeight: indicatorBox.height,
        fontSize: getComputedStyle(tab).fontSize,
      }
    }))

    expect(listBox.height).toBe(56)
    expect(tabBoxes).toHaveLength(4)
    expect(Math.max(...tabBoxes.map((box) => box.width)) - Math.min(...tabBoxes.map((box) => box.width))).toBeLessThan(1)
    for (const box of tabBoxes) {
      expect(box.y).toBeCloseTo(listBox.y, 1)
      expect(box.height).toBe(56)
      expect(box.iconWidth).toBe(17)
      expect(box.iconHeight).toBe(17)
      expect(box.indicatorY).toBeCloseTo(listBox.y + 53, 1)
      expect(box.indicatorWidth).toBeCloseTo(box.width, 1)
      expect(box.indicatorHeight).toBe(3)
      expect(box.fontSize).toBe(expectedFontSize)
    }

    const contentBox = (await readingContent.boundingBox())!
    expect(contentBox.y).toBeGreaterThanOrEqual(listBox.y + listBox.height)
    const activeIndicatorColor = await settingsTabs.locator('[role="tab"][data-state="active"] [data-settings-tab-indicator]').evaluate(
      (indicator) => getComputedStyle(indicator).backgroundColor,
    )
    expect(activeIndicatorColor).not.toBe("rgba(0, 0, 0, 0)")
  }

  await expect(languageSettings).toBeVisible()
  await expect(languageOptions).toHaveCount(2)
  await expect(languageOptions).toHaveText(["العربية", "English"])
  const optionWidths = await languageOptions.evaluateAll((options) => options.map((option) => option.getBoundingClientRect().width))
  expect(Math.abs(optionWidths[0] - optionWidths[1])).toBeLessThan(1)
  await expect(page.locator('[data-settings-content="install"] [data-language-settings]')).toHaveCount(0)
  await assertTabGeometry("11px")

  await languageSettings.locator('[data-language-option="en"]').click()
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr")
  await expect(languageOptions).toHaveText(["العربية", "English"])
  expect(await page.evaluate(() => window.localStorage.getItem("wird-interface-language-v1"))).toBe("en")
  await assertTabGeometry("11px")

  await page.setViewportSize({ width: 900, height: 844 })
  await assertTabGeometry("12px")
  await settingsTabs.getByRole("tab", { name: "App" }).click()
  await expect(page.locator('[data-settings-content="install"] [data-language-settings]')).toHaveCount(0)
})

test("يوضح تبويبات الإعدادات ويحسن إدارة أقسام العلامات", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()

  const settingsTabs = page.locator("[data-settings-tabs]")
  const expectedTabs = [
    ["القراءة", "lucide-book-open"],
    ["العلامات", "lucide-bookmark"],
    ["التنزيلات", "lucide-download"],
    ["التطبيق", "lucide-smartphone"],
  ] as const
  for (const [label, iconClass] of expectedTabs) {
    const tab = settingsTabs.getByRole("tab", { name: label })
    await expect(tab.locator(`svg.${iconClass}`)).toHaveCount(1)
    expect((await tab.boundingBox())!.height).toBeGreaterThanOrEqual(56)
  }

  await settingsTabs.getByRole("tab", { name: "العلامات" }).click()
  await expect(page.getByRole("heading", { name: "أقسام العلامات" })).toBeVisible()
  await expect(page.getByLabel("ملخص العلامات")).toBeVisible()
  await expect(page.locator("[data-bookmark-category-list] [data-bookmark-category]")).toHaveCount(5)

  await page.getByRole("button", { name: "تعديل قسم حفظ" }).click()
  const categoryName = page.getByRole("textbox", { name: "اسم قسم حفظ", exact: true })
  await categoryName.fill("حفظ يومي")
  await page.getByRole("button", { name: "حفظ اسم قسم حفظ" }).click()
  await expect(page.getByText("حفظ يومي", { exact: true })).toBeVisible()

  await page.getByLabel("قسم جديد").fill("تدبر")
  await page.getByRole("button", { name: "إضافة قسم علامات" }).click()
  await expect(page.getByText("تدبر", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "حذف قسم تدبر" }).click()
  await page.getByRole("button", { name: "حذف القسم" }).click()
  await expect(page.getByText("تدبر", { exact: true })).toHaveCount(0)

  const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()
  expect(results.violations).toEqual([])
})

test("يسجل تاريخ النسخة الاحتياطية بعد التصدير", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()
  await page.getByRole("tab", { name: "التطبيق" }).click()
  await expect(page.getByText("آخر نسخة احتياطية: لم تُنشأ")).toBeVisible()

  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "تصدير" }).click()
  await downloadPromise
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("wird-backup-last-exported-at"))).not.toBeNull()
  await expect(page.getByText("آخر نسخة احتياطية: لم تُنشأ")).toHaveCount(0)
})

test("يحتفظ بطلب التثبيت حتى فتح الإعدادات", async ({ page }) => {
  await openMushaf(page)
  await page.evaluate(() => {
    Object.assign(window, { __wirdInstallPromptCalls: 0 })
    const event = new Event("beforeinstallprompt", { cancelable: true })
    Object.defineProperties(event, {
      prompt: {
        value: async () => {
          const target = window as typeof window & { __wirdInstallPromptCalls: number }
          target.__wirdInstallPromptCalls += 1
        },
      },
      userChoice: { value: Promise.resolve({ outcome: "dismissed" }) },
    })
    window.dispatchEvent(event)
  })

  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()
  await page.getByRole("tab", { name: "التطبيق" }).click()
  const installButton = page.getByRole("button", { name: "تثبيت التطبيق" })
  await expect(installButton).toBeEnabled()
  await installButton.click()
  await expect.poll(() => page.evaluate(() => (
    window as typeof window & { __wirdInstallPromptCalls: number }
  ).__wirdInstallPromptCalls)).toBe(1)
})

test("يوضح التثبيت اليدوي عندما لا يدعمه المتصفح تلقائيًا", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()
  await page.getByRole("tab", { name: "التطبيق" }).click()
  await expect(page.getByText("التثبيت من المتصفح", { exact: true })).toBeVisible()
  await expect(page.getByText(/اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية/)).toBeVisible()
  await expect(page.getByText("بانتظار إتاحة التثبيت")).toHaveCount(0)
})

test("يقترح فتح تبويب مستقل من المعاينة المضمّنة", async ({ page }) => {
  await page.setContent('<iframe title="معاينة وِردي" src="http://127.0.0.1:3000/" style="width:390px;height:844px"></iframe>')
  const preview = page.frameLocator('iframe[title="معاينة وِردي"]')
  await expect(preview.locator("[data-qcf-line]").first()).toBeVisible()
  await preview.getByRole("button", { name: "إعدادات التطبيق" }).click()
  await preview.getByRole("tab", { name: "التطبيق" }).click()
  await expect(preview.getByText("افتح التطبيق مباشرة", { exact: true })).toBeVisible()
  await expect(preview.getByRole("button", { name: "فتح في تبويب مستقل" })).toBeVisible()
})

test("يثبت ثيم الهوية المختار قبل تشغيل الواجهة في الوضعين", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("wird-color-palette-v1", "navy-gold")
    window.localStorage.setItem("theme", "light")
    const paletteChanges: Array<string | null> = []
    Object.assign(window, { __wirdPaletteChanges: paletteChanges })
    new MutationObserver(() => {
      paletteChanges.push(document.documentElement.dataset.palette ?? null)
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-palette"] })
  })

  await openMushaf(page)
  const themeState = await page.evaluate(() => ({
    palette: document.documentElement.dataset.palette,
    changes: (window as typeof window & { __wirdPaletteChanges: Array<string | null> }).__wirdPaletteChanges,
    themeColors: [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
      .map((meta) => meta.content),
  }))
  expect(themeState.palette).toBe("navy-gold")
  expect(themeState.changes).not.toContain("olive")
  expect(themeState.themeColors.every((color) => color === "#203f62")).toBeTruthy()
  const appLogo = page.locator("[data-app-icon]")
  await expect.poll(() => appLogo.evaluate((mark) => {
    const toRgb = (color: string) => {
      const canvas = document.createElement("canvas")
      canvas.width = 1
      canvas.height = 1
      const context = canvas.getContext("2d")!
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
      return `rgb(${red}, ${green}, ${blue})`
    }
    return {
      mark: toRgb(getComputedStyle(mark).backgroundColor),
      surface: toRgb(getComputedStyle(mark.parentElement!).backgroundColor),
    }
  })).toEqual({ mark: "rgb(32, 63, 98)", surface: "rgb(0, 0, 0)" })

  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()
  await page.getByText("ليلي", { exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect.poll(async () => page.locator('meta[name="theme-color"]').first().getAttribute("content"))
    .toBe("#101923")
  await expect.poll(() => appLogo.evaluate((mark) => {
    const toRgb = (color: string) => {
      const canvas = document.createElement("canvas")
      canvas.width = 1
      canvas.height = 1
      const context = canvas.getContext("2d")!
      context.fillStyle = color
      context.fillRect(0, 0, 1, 1)
      const [red, green, blue] = context.getImageData(0, 0, 1, 1).data
      return `rgb(${red}, ${green}, ${blue})`
    }
    return {
      mark: toRgb(getComputedStyle(mark).backgroundColor),
      surface: toRgb(getComputedStyle(mark.parentElement!).backgroundColor),
    }
  })).toEqual({ mark: "rgb(214, 185, 98)", surface: "rgb(0, 0, 0)" })

  await page.getByRole("button", { name: "الألوان" }).click()
  const identityPaletteOption = page.locator('[data-palette-option="navy-gold"]')
  await expect(identityPaletteOption).toBeVisible()
  await expect(identityPaletteOption.locator("span > span")).toHaveCount(3)
  await expect(page.getByRole("radio", { name: "كحلي ذهبي" })).toBeChecked()
})

test("يسمح بمسح مدخلات أرقام الخطط ثم يثبت القيم الجديدة", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("wird-khatma-plan-v1")
    window.localStorage.removeItem("wird-learning-plan-v1")
  })
  await openMushaf(page)
  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
  await page.locator("button").filter({ hasText: "إنشاء مسار ختمة" }).click()

  const duration = page.getByLabel("المدة بالأيام")
  await duration.fill("")
  await expect(duration).toHaveValue("")
  await duration.fill("2")
  await duration.press("Enter")
  await expect(duration).toHaveValue("2")
  await expect(duration).toHaveAttribute("inputmode", "numeric")

  await page.getByText("مقدار يومي", { exact: true }).click()
  const khatmaPages = page.getByLabel("عدد الصفحات يوميًا")
  await khatmaPages.fill("")
  await expect(khatmaPages).toHaveValue("")
  await khatmaPages.fill("3")
  await khatmaPages.blur()
  await expect(khatmaPages).toHaveValue("3")
  await expect(khatmaPages).toHaveAttribute("inputmode", "numeric")
  await page.keyboard.press("Escape")

  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
  await page.getByRole("button", { name: /^خطط الحفظ والمراجعة/ }).click()
  await page.getByText("مقدار يومي", { exact: true }).click()
  const activityPages = page.getByLabel("صفحات كل يوم نشاط")
  await activityPages.fill("")
  await expect(activityPages).toHaveValue("")
  await activityPages.fill("2")
  await activityPages.press("Enter")
  await expect(activityPages).toHaveValue("2")

  const reviewPages = page.getByLabel("صفحات كل مراجعة")
  await reviewPages.fill("")
  await expect(reviewPages).toHaveValue("")
  await reviewPages.fill("1")
  await reviewPages.blur()
  await expect(reviewPages).toHaveValue("1")
  await expect(activityPages).toHaveAttribute("inputmode", "numeric")
  await expect(reviewPages).toHaveAttribute("inputmode", "numeric")
})

test("يحفظ آخر صفحة مرئية من مقرر الختمة مع بقاء نطاقه", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("wird-khatma-plan-v1", JSON.stringify({
      version: 1,
      method: "daily",
      durationDays: 30,
      dailyPages: 3,
      startDate: date,
      completedPage: 4,
      reminderEnabled: false,
      reminderTime: "20:00",
      lastOpenedDate: date,
    }))
  })
  await openMushaf(page)
  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
  await page.getByRole("button", { name: /^الختمة/ }).first().click()
  await expect(page.getByText("صفحة 5 إلى 7")).toBeVisible()
  await page.getByRole("button", { name: "افتح مقرر اليوم" }).click()
  await expect(page.getByLabel("صفحة 5 من المصحف الشريف")).toBeVisible()

  await page.getByRole("button", { name: "بدء التمرير التلقائي" }).click()
  const scrollContainer = page.locator("[data-quran-scroll-container]")
  await expect(page.locator('[data-large-reading-page="6"]')).toBeAttached()
  await scrollContainer.evaluate((element) => {
    const target = element.querySelector<HTMLElement>('[data-large-reading-page="6"]')
    if (!target) throw new Error("Page 6 was not rendered")
    element.scrollTop = target.offsetTop
  })
  await expect(page.locator("[data-continuous-reader-bar]")).toHaveAttribute("aria-label", /الصفحة 6/)
  expect(await page.evaluate(() => JSON.parse(window.localStorage.getItem("wird-khatma-plan-v1") ?? "null").completedPage)).toBe(4)

  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
  const savedOnDashboard = await page.evaluate(() => JSON.parse(window.localStorage.getItem("wird-khatma-plan-v1") ?? "null"))
  expect(savedOnDashboard.completedPage).toBe(6)
  expect(savedOnDashboard.startPage).toBe(5)
  expect(savedOnDashboard.pageCount).toBe(3)

  await page.getByRole("button", { name: "العودة إلى المصحف" }).click()
  await page.getByRole("button", { name: "الخروج من التمرير التلقائي" }).click()
  await expect(page.getByLabel("صفحة 6 من المصحف الشريف")).toBeVisible()
  await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
  await page.locator('input[aria-label="البحث السريع في القرآن"]:visible').fill("7")
  await page.locator('button[data-search-id="page-7"]:visible').click()
  await expect(page.getByLabel("صفحة 7 من المصحف الشريف")).toBeVisible()
  await page.evaluate(() => window.dispatchEvent(new Event("wird-before-app-update")))

  const planAfterRegularReading = await page.evaluate(() => JSON.parse(window.localStorage.getItem("wird-khatma-plan-v1") ?? "null"))
  expect(planAfterRegularReading.completedPage).toBe(6)
  expect(planAfterRegularReading.startPage).toBe(5)
  expect(planAfterRegularReading.pageCount).toBe(3)
})

test("يعرض تأخر مسار الختمة بالعربية والإنجليزية دون احتساب يوم البدء أو الختمة المكتملة", async ({ page }) => {
  await page.addInitScript(() => {
    const today = new Date()
    const startedAt = new Date(today)
    startedAt.setDate(startedAt.getDate() - 7)
    const dateKey = (date: Date) => [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("wird-khatma-plan-v1", JSON.stringify({
      version: 1,
      method: "duration",
      durationDays: 30,
      dailyPages: 20,
      startDate: dateKey(startedAt),
      completedPage: 60,
      reminderEnabled: false,
      reminderTime: "20:00",
      lastOpenedDate: dateKey(today),
    }))
  })

  await openMushaf(page)
  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
  await page.getByRole("button", { name: /^الختمة/ }).first().click()
  const overdueStatus = page.locator('[data-khatma-overdue-days="4"]')
  await expect(overdueStatus).toHaveText("متأخر 4 أيام عن المقرر")
  await page.getByRole("button", { name: "تعويض خلال 3 أيام" }).click()
  const compensatedPlan = await page.evaluate(() => JSON.parse(window.localStorage.getItem("wird-khatma-plan-v1") ?? "null"))
  expect(compensatedPlan.completedPage).toBe(60)
  expect(compensatedPlan.catchUpDays).toBe(3)
  expect(compensatedPlan.catchUpPagesPerDay).toBeGreaterThan(0)

  await page.keyboard.press("Escape")
  await page.evaluate(() => window.localStorage.setItem("wird-interface-language-v1", "en"))
  await page.reload({ waitUntil: "networkidle" })
  await expect(page.locator("html")).toHaveAttribute("lang", "en")
  await page.getByRole("button", { name: "Open Wirdy dashboard" }).click()
  await page.getByRole("button", { name: /^Khatmah/ }).first().click()
  await expect(overdueStatus).toHaveText("4 days behind schedule")

  await page.evaluate(() => {
    const plan = JSON.parse(window.localStorage.getItem("wird-khatma-plan-v1") ?? "null")
    window.localStorage.setItem("wird-khatma-plan-v1", JSON.stringify({ ...plan, completedPage: 604 }))
    window.dispatchEvent(new Event("wird-khatma-plan-changed"))
  })
  await expect(page.locator("[data-khatma-overdue-days]")).toHaveCount(0)

  await page.evaluate(() => {
    const now = new Date()
    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    const plan = JSON.parse(window.localStorage.getItem("wird-khatma-plan-v1") ?? "null")
    window.localStorage.setItem("wird-khatma-plan-v1", JSON.stringify({
      ...plan,
      startDate: today,
      completedPage: 0,
      lastOpenedDate: today,
    }))
    window.dispatchEvent(new Event("wird-khatma-plan-changed"))
  })
  await expect(page.locator("[data-khatma-overdue-days]")).toHaveCount(0)
})

test("يوضح أن تذكير الختمة يعمل داخل التطبيق", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
  await page.locator("button").filter({ hasText: "إنشاء مسار ختمة" }).click()
  await expect(page.getByRole("heading", { name: "مسار الختمة" })).toBeVisible()
  await expect(page.getByText("تذكير يومي داخل التطبيق", { exact: true })).toBeVisible()
})

test("يعيد جلسة الاستماع السابقة من بداية نطاقها لا من آخر موضع", async ({ page }) => {
  await page.addInitScript(() => {
    const now = Date.now()
    window.localStorage.setItem("wird-session-history-v1", JSON.stringify([{
      id: "previous-listening-session",
      mode: "listen",
      startPage: 120,
      endPage: 122,
      currentPage: 122,
      reciter: 6,
      reciterName: "ماهر المعيقلي",
      repeatTarget: "1",
      ayahRepeatEnabled: false,
      ayahRepeatCount: 3,
      ayahPauseSeconds: 1,
      startedAt: now - 60_000,
      updatedAt: now,
      completed: false,
    }]))
  })

  await openMushaf(page)
  await page.getByRole("button", { name: "أدوات القراءة" }).click()
  await page.getByRole("radio", { name: "استماع" }).click()
  const previousSession = page.getByRole("button", { name: /من صفحة 120 إلى صفحة 122/ })
  await expect(previousSession).toBeVisible()
  await expect(page.getByRole("button", { name: /استئناف.*صفحة 122/ })).toBeVisible()
  await previousSession.click()

  await expect(page.getByLabel("صفحة 120 من المصحف الشريف")).toBeVisible()
  await expect.poll(() => page.evaluate(() => {
    const sessions = JSON.parse(window.localStorage.getItem("wird-session-history-v1") ?? "[]")
    return sessions.find((session: { id: string }) => session.id !== "previous-listening-session")?.currentPage
  })).toBe(120)
  expect(await page.evaluate(() => {
    const sessions = JSON.parse(window.localStorage.getItem("wird-session-history-v1") ?? "[]")
    return sessions.find((session: { id: string }) => session.id === "previous-listening-session")?.currentPage
  })).toBe(122)
})

test("يحمل أدوات الجلسة ومحدد النطاق عند الطلب", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "أدوات القراءة" }).click()
  await page.getByRole("radio", { name: "استماع" }).click()
  await page.getByLabel("اختيار بداية النطاق").click()
  await expect(page.getByLabel("البحث عن بداية النطاق")).toBeVisible()
})

test("يتصفح السور والأجزاء والصفحات لاختيار نطاق دون بحث", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "أدوات القراءة" }).click()
  await page.getByRole("radio", { name: "استماع" }).click()
  await page.getByLabel("اختيار بداية النطاق").click()

  let picker = page.getByRole("dialog")
  await expect(picker.getByRole("tab", { name: "الأقرب" })).toBeVisible()
  await picker.getByRole("tab", { name: "الأجزاء" }).click()
  await expect(picker.locator('button[data-search-id="juz-30"]')).toBeVisible()
  await picker.getByRole("radio", { name: "حزب" }).click()
  await expect(picker.locator('button[data-search-id="hizb-60"]')).toBeVisible()
  await picker.getByRole("tab", { name: "السور" }).click()
  await picker.locator('button[data-search-id="surah-18"]').click()
  await expect(page.getByRole("combobox", { name: "اختيار بداية النطاق" })).toContainText("سورة الكَهف")
  const endingGrid = page.locator("[data-suggested-endings]")
  await expect(endingGrid.locator("button")).toHaveCount(4)
  expect(await endingGrid.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(2)

  await page.getByRole("combobox", { name: "اختيار نهاية النطاق" }).click()
  picker = page.getByRole("dialog")
  await expect(picker.locator('button[data-search-id="surah-18"]')).toBeVisible()
  await picker.getByRole("tab", { name: "الصفحات" }).click()
  await picker.getByLabel("رقم الصفحة").fill("300")
  await picker.getByRole("button", { name: "اختيار الصفحة 300" }).click()
  await expect(page.getByRole("combobox", { name: "اختيار نهاية النطاق" })).toContainText("نهاية الصفحة 300")
})

test("يفتح محدد النطاق كنافذة مدمجة على سطح المكتب", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await openMushaf(page)
  await page.getByRole("button", { name: "أدوات القراءة" }).click()
  await page.getByRole("radio", { name: "استماع" }).click()
  await page.getByLabel("اختيار بداية النطاق").click()

  const picker = page.getByRole("dialog")
  const bounds = await picker.boundingBox()
  await expect(picker.getByRole("tab", { name: "السور" })).toBeVisible()
  await expect(picker.getByLabel("البحث عن بداية النطاق")).toBeFocused()
  expect(bounds!.width).toBeLessThanOrEqual(382)
})

test("يوزع مشغل الهاتف ويغير موضع سهم الطي", async ({ page }) => {
  await openMushaf(page)
  const collapseButton = page.getByRole("button", { name: "طي شريط التشغيل" })
  const collapse = await collapseButton.boundingBox()
  const collapseIndicator = await collapseButton.locator("span").boundingBox()
  const collapseColor = await collapseButton.locator("span").evaluate((indicator) => getComputedStyle(indicator).backgroundColor)
  const play = await page.getByRole("button", { name: "تشغيل", exact: true }).boundingBox()
  const progress = await page.getByRole("progressbar", { name: "تقدم جلسة التلاوة من اليمين إلى اليسار" }).boundingBox()
  const player = await page.locator("[data-quran-player]").boundingBox()
  const reciter = await page.locator('button[aria-label^="اختيار القارئ، الحالي"]:visible').first().boundingBox()
  const controlCenters = await page.locator("[data-mobile-player-controls] button:visible").evaluateAll((buttons) => buttons
    .map((button) => {
      const bounds = button.getBoundingClientRect()
      return bounds.x + bounds.width / 2
    })
    .sort((first, second) => first - second))
  const gaps = controlCenters.slice(1).map((center, index) => center - controlCenters[index])
  const viewportCenter = page.viewportSize()!.width / 2

  expect(collapse?.height).toBeGreaterThanOrEqual(36)
  expect(collapse?.width).toBeGreaterThanOrEqual(36)
  expect(collapse!.x).toBeLessThanOrEqual(8)
  expect(collapseIndicator!.width).toBeLessThan(collapse!.width)
  expect(Math.abs(collapseIndicator!.y - player!.y)).toBeLessThanOrEqual(2)
  expect(collapseColor).not.toBe("rgba(0, 0, 0, 0)")
  expect(reciter?.height).toBeGreaterThanOrEqual(24)
  expect(Math.abs((play!.x + play!.width / 2) - viewportCenter)).toBeLessThanOrEqual(1)
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(32)
  expect(progress!.y).toBeLessThanOrEqual(player!.y)

  await collapseButton.click()
  const expandButton = page.getByRole("button", { name: "توسيع شريط التشغيل" })
  await expect.poll(async () => {
    const expand = await expandButton.boundingBox()
    return Math.abs((expand!.x + expand!.width / 2) - viewportCenter)
  }).toBeLessThanOrEqual(1)
})

test("يعتمد أيقونة وردي في الرأس والتثبيت والأقنعة", async ({ page, request }) => {
  const [manifestResponse, markResponse] = await Promise.all([
    request.get("/manifest.webmanifest"),
    request.get("/icons/wird-mark.png"),
  ])
  expect(manifestResponse.ok()).toBeTruthy()
  expect(markResponse.ok()).toBeTruthy()
  const manifest = await manifestResponse.json() as {
    icons: Array<{ src: string; sizes: string; purpose?: string }>
  }
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "/icons/wird-192.png", sizes: "192x192", purpose: "any" }),
    expect.objectContaining({ src: "/icons/wird-512.png", sizes: "512x512", purpose: "any" }),
    expect.objectContaining({ src: "/icons/wird-maskable-512.png", sizes: "512x512", purpose: "maskable" }),
  ]))

  await openMushaf(page)
  const appIcon = page.locator("[data-app-icon]")
  await expect(appIcon).toBeVisible()
  await expect.poll(() => appIcon.evaluate((mark) => ({
    usesMark: getComputedStyle(mark).maskImage.includes("/icons/wird-mark.png"),
    square: mark.getBoundingClientRect().width > 0
      && mark.getBoundingClientRect().width === mark.getBoundingClientRect().height,
  }))).toEqual({ usesMark: true, square: true })
})

test("يعترض Service Worker مصدر حدر أحمد ديبان", async ({ request }) => {
  const [workerResponse, pageResponse] = await Promise.all([
    request.get("/sw.js"),
    request.get("/api/quran", { params: { page: "2", reciter: "2001" } }),
  ])
  expect(workerResponse.ok()).toBeTruthy()
  expect(pageResponse.ok()).toBeTruthy()
  const workerSource = await workerResponse.text()
  expect(workerSource).toContain('"archive.org"')
  expect(workerSource).toContain('VERSION = `wird-v50-')
  expect(workerSource).toContain('"/icons/wird-mark.png"')
  expect(workerSource).toContain('QURAN_CACHE = "wird-quran-v1"')
  expect(workerSource).toContain("matchCachedStaticAsset")
  expect(workerSource).toContain("APP_CACHE_GENERATIONS = 3")
  expect(workerSource).toContain("precacheAppShell()")
  expect((await pageResponse.json()).tracks[0].audioUrl).toContain("archive.org")
})

test("يعيد ملف واجهة Next المحفوظ عند اختلاف معامل النشر دون شبكة", async ({ page, context }) => {
  await openMushaf(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js?release=offline-static-query-test", {
      scope: "/",
      updateViaCache: "none",
    })
    await navigator.serviceWorker.ready
  })
  await page.reload({ waitUntil: "networkidle" })
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  const staticAsset = await page.locator('script[src*="/_next/static/"]').first().getAttribute("src")
  expect(staticAsset).toBeTruthy()
  await expect.poll(() => page.evaluate(async (url) => Boolean(await caches.match(url!)), staticAsset)).toBe(true)
  const alternateAsset = new URL(staticAsset!, "http://127.0.0.1:3000")
  alternateAsset.searchParams.set("dpl", "offline-query-change")

  await context.setOffline(true)
  try {
    const result = await page.evaluate(async (url) => {
      const response = await fetch(url)
      return { ok: response.ok, status: response.status, size: (await response.text()).length }
    }, `${alternateAsset.pathname}${alternateAsset.search}`)
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    expect(result.size).toBeGreaterThan(100)
  } finally {
    await context.setOffline(false)
  }
})

test("يعيد طلب صفحة القراءة المستمرة بعد ثلاث إخفاقات وأخطاء التخزين المحلي", async ({ page }) => {
  let readingAttempts = 0
  const fullPageRequests: string[] = []
  await page.addInitScript(() => {
    window.localStorage.setItem("wird-last-reading-v1", JSON.stringify({
      page: 120,
      positionMs: 0,
      reciter: 6,
      viewMode: "text",
      readingMode: "page",
      updatedAt: Date.now(),
    }))
    window.sessionStorage.setItem("wird-test-reading-cache-attempts", "0")
    const originalMatch = CacheStorage.prototype.match
    CacheStorage.prototype.match = function(request, options) {
      const requestUrl = typeof request === "string"
        ? request
        : request instanceof Request ? request.url : request.toString()
      const url = new URL(requestUrl, window.location.origin)
      if (url.searchParams.get("page") === "122" && url.searchParams.get("content") === "reading") {
        const attempts = Number(window.sessionStorage.getItem("wird-test-reading-cache-attempts") ?? "0")
        window.sessionStorage.setItem("wird-test-reading-cache-attempts", String(attempts + 1))
        return Promise.reject(new Error("Cache Storage unavailable"))
      }
      return originalMatch.call(this, request, options)
    }
  })
  await page.route("**/api/quran**", async (route) => {
    const url = new URL(route.request().url())
    if (url.searchParams.get("page") !== "122") {
      await route.continue()
      return
    }
    if (url.searchParams.get("content") !== "reading") {
      fullPageRequests.push(url.href)
      await route.continue()
      return
    }
    readingAttempts += 1
    if (readingAttempts <= 3) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporary" }) })
      return
    }
    await route.continue()
  })

  await openMushaf(page)
  await page.getByRole("button", { name: "بدء التمرير التلقائي" }).click()
  await expect(page.locator('[data-large-reading-page="122"]')).toBeAttached()
  expect(readingAttempts).toBe(4)
  expect(await page.evaluate(() => Number(window.sessionStorage.getItem("wird-test-reading-cache-attempts")))).toBe(4)
  await expect(page.getByText("تعذر تحميل نص الصفحة")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "إعادة تحميل التلاوة" })).toHaveCount(0)
  expect(fullPageRequests).toEqual([])
})

test("يثبت هندسة صفحات التمرير في ملء الشاشة مع التباعد الواسع", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("wird-last-reading-v1", JSON.stringify({
      page: 120,
      positionMs: 0,
      reciter: 6,
      viewMode: "text",
      readingMode: "page",
      updatedAt: Date.now(),
    }))
    window.localStorage.setItem("wird-player-settings", JSON.stringify({
      viewMode: "text",
      readingMode: "page",
      lineSpacing: "spacious",
      continuousScrollSpeed: 0.05,
    }))
  })

  await openMushaf(page)
  await page.getByRole("button", { name: "بدء التمرير التلقائي" }).click()
  await expect(page.locator('[data-large-reading-page="121"]')).toBeAttached()
  await page.getByRole("button", { name: "إيقاف التمرير التلقائي مؤقتًا" }).click()
  await page.getByRole("button", { name: "عرض المصحف بملء الشاشة" }).first().click()
  await expect(page.getByRole("button", { name: "العودة إلى واجهة المصحف" })).toBeVisible()

  const geometry = await page.locator('[data-large-reading-page="120"], [data-large-reading-page="121"]')
    .evaluateAll((wrappers) => wrappers.map((wrapper) => {
      const pageElement = wrapper.querySelector<HTMLElement>("[data-quran-text-page]")!
      const lineLayout = pageElement.querySelector<HTMLElement>("[data-qcf-line]")!.parentElement!
      const pageBounds = pageElement.getBoundingClientRect()
      const layoutStyle = getComputedStyle(lineLayout)
      return {
        className: pageElement.className,
        width: pageBounds.width,
        height: pageBounds.height,
        lineCount: lineLayout.querySelectorAll("[data-qcf-line]").length,
        display: layoutStyle.display,
        justifyContent: layoutStyle.justifyContent,
        paddingTop: layoutStyle.paddingTop,
        paddingBottom: layoutStyle.paddingBottom,
      }
    }))

  expect(geometry).toHaveLength(2)
  expect(geometry[0].className).toBe(geometry[1].className)
  expect(Math.abs(geometry[0].width - geometry[1].width)).toBeLessThanOrEqual(1)
  expect(Math.abs(geometry[0].height - geometry[1].height)).toBeLessThanOrEqual(1)
  expect(geometry.map((item) => item.lineCount)).toEqual([15, 15])
  expect(geometry.map((item) => item.display)).toEqual(["flex", "flex"])
  expect(geometry.map((item) => item.justifyContent)).toEqual(["space-between", "space-between"])
  expect(geometry[0].paddingTop).toBe(geometry[1].paddingTop)
  expect(geometry[0].paddingBottom).toBe(geometry[1].paddingBottom)
})

test("يبقي التمرير مفعّلًا دون اتصال ويستأنف التحميل عند عودته", async ({ page, context }) => {
  test.setTimeout(120_000)
  const pageErrors: string[] = []
  const failedScripts: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("requestfailed", (request) => {
    if (request.resourceType() === "script") failedScripts.push(request.url())
  })
  await page.addInitScript(() => {
    window.localStorage.setItem("wird-last-reading-v1", JSON.stringify({
      page: 120,
      positionMs: 0,
      reciter: 6,
      viewMode: "text",
      readingMode: "page",
      updatedAt: Date.now(),
    }))
  })

  await openMushaf(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js?release=offline-auto-scroll-test", {
      scope: "/",
      updateViaCache: "none",
    })
    await navigator.serviceWorker.ready
  })
  await page.reload({ waitUntil: "networkidle" })
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect(page.getByLabel("صفحة 120 من المصحف الشريف")).toBeVisible()

  await context.setOffline(true)
  try {
    await page.getByRole("button", { name: "إعدادات التطبيق" }).click()
    await expect(page.getByRole("heading", { name: "إعدادات وِردي" })).toBeVisible()
    await page.getByRole("button", { name: "إغلاق الإعدادات" }).click()
    await page.getByRole("button", { name: "فتح لوحة وِردي" }).click()
    await expect(page.getByRole("heading", { name: "لوحة وِردي" })).toBeAttached()
    await page.getByRole("button", { name: "العودة إلى المصحف" }).click()

    await page.getByRole("button", { name: "بدء التمرير التلقائي" }).click()
    const scrollContainer = page.locator("[data-quran-scroll-container]")
    await expect(scrollContainer).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("data-wird-auto-scroll", "true")

    await scrollContainer.evaluate((element) => { element.scrollTop = element.scrollHeight })
    await page.waitForTimeout(1800)
    await expect(page.getByRole("button", { name: "الخروج من التمرير التلقائي" })).toBeVisible()
    await expect(page.locator("html")).toHaveAttribute("data-wird-auto-scroll", "true")
    await expect(page.getByText("لا يوجد اتصال بالإنترنت")).toHaveCount(0)
    await expect(page.getByText(/غير متصل بالإنترنت، وتلاوة القارئ/)).toHaveCount(0)
    await expect(page.locator('[data-large-reading-page="120"]')).toBeVisible()

    await context.setOffline(false)
    await expect(page.locator('[data-large-reading-page="122"]')).toBeAttached()
    await expect(page.getByRole("button", { name: "الخروج من التمرير التلقائي" })).toBeVisible()
    await expect(page.getByText("تعذر إكمال هذه الشاشة")).toHaveCount(0)
    await expect(page.getByText("Something went wrong")).toHaveCount(0)
    await expect(page.getByText("نسخة جديدة جاهزة")).toHaveCount(0)
    expect(pageErrors).toEqual([])
    expect(failedScripts).toEqual([])
  } finally {
    await context.setOffline(false)
  }
})

test("يعيد فتح رابط التطبيق المحفوظ دون شبكة", async ({ page, context }) => {
  await openMushaf(page)
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js?release=offline-release-test", {
      scope: "/",
      updateViaCache: "none",
    })
    await navigator.serviceWorker.ready
  })
  await page.reload({ waitUntil: "networkidle" })
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  await expect(page.locator("[data-qcf-line]").first()).toBeVisible()

  await context.setOffline(true)
  try {
    await page.goto("/?khatma=1", { waitUntil: "domcontentloaded" })
    await expect(page.locator("[data-qcf-line]").first()).toBeVisible()
    await expect(page.getByText("لا يوجد اتصال بالإنترنت")).toHaveCount(0)
  } finally {
    await context.setOffline(false)
  }
})

test("يبقي زر التشغيل مفعّلًا ويوضح غياب التلاوة دون اتصال", async ({ page, context }) => {
  await openMushaf(page)
  const playButton = page.getByRole("button", { name: "تشغيل", exact: true })
  await expect(playButton).toBeEnabled()
  const audioSource = await page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.currentSrc)
  await page.evaluate(async (source) => {
    for (const cacheName of await window.caches.keys()) {
      await (await window.caches.open(cacheName)).delete(source)
    }
  }, audioSource)

  await context.setOffline(true)
  try {
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false)
    await expect(playButton).toBeEnabled()
    await playButton.click()
    await expect(page.getByText(/غير متصل بالإنترنت، وتلاوة القارئ .* غير محمّلة على هذا الجهاز/)).toBeVisible()
    await expect(playButton).toHaveAttribute("aria-label", "تشغيل")
    await expect.poll(() => page.locator("audio").evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true)
  } finally {
    await context.setOffline(false)
  }
})

test("يدعم الصفحات والبحث وبكرة التنقل دون شبكة", async ({ page, context }) => {
  test.setTimeout(120_000)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true })
    window.localStorage.setItem("wird-last-reading-v1", JSON.stringify({
      page: 120,
      positionMs: 0,
      reciter: 6,
      viewMode: "text",
      readingMode: "page",
      updatedAt: Date.now(),
    }))
  })

  await openMushaf(page)
  await expect(page.getByLabel("صفحة 120 من المصحف الشريف")).toBeVisible()
  await expect.poll(() => page.evaluate(async () => Boolean(
    await window.caches.match("/api/quran?page=128&content=reading"),
  )), { timeout: 60_000 }).toBe(true)
  await expect.poll(() => page.evaluate(async () => Boolean(
    await window.caches.match("/api/quran/navigation"),
  ))).toBe(true)
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("wird-offline-quran-search-v1", 1)
      request.onupgradeneeded = () => request.result.createObjectStore("index")
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction("index", "readwrite")
      transaction.objectStore("index").put([{
        kind: "verse",
        verseKey: "1:1",
        surahName: "الفاتحة",
        ayah: 1,
        text: "بسم الله الرحمن الرحيم",
        page: 1,
        normalizedText: "بسم الله الرحمن الرحيم",
      }], "verses")
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  })

  await context.setOffline(true)
  try {
    for (let targetPage = 121; targetPage <= 128; targetPage += 1) {
      await page.locator('button[aria-label="الصفحة التالية"]:visible').first().click()
      await expect(page.getByLabel(`صفحة ${targetPage} من المصحف الشريف`)).toBeVisible()
    }
    await expect(page.getByText("تعذر تحميل الصفحة")).toHaveCount(0)

    await page.getByRole("button", { name: /فتح البحث والتنقل/ }).click()
    const navigatorTabs = page.locator("[data-quick-navigator-tabs]")
    await navigatorTabs.getByRole("tab", { name: "الأجزاء" }).click()
    await expect(page.getByRole("button", { name: /الجزء 7، صفحة/ })).toBeVisible()
    await navigatorTabs.getByRole("tab", { name: "السور" }).click()
    await expect(page.locator('[data-quick-browse="surahs"]').getByRole("button", { name: /سورة الأنعَام، صفحة/ })).toBeVisible()
    await page.locator('input[aria-label="البحث السريع في القرآن"]:visible').fill("خلق السماوات والارض")
    const offlineResult = page.locator('button[data-verse-key="6:1"]')
    await expect(offlineResult).toBeVisible()
    expect(await offlineResult.innerText()).not.toMatch(/[\u06D6-\u06ED\uFD3E\uFD3F|¦]/)
  } finally {
    await context.setOffline(false)
  }
})

test("ينزّل صفحة PDF متجهية دون صورة مضمّنة", async ({ page }) => {
  test.setTimeout(120_000)
  await openMushaf(page)
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "المزيد من أدوات الصفحة" }).click()
  await page.getByRole("menuitem", { name: "حفظ الصفحة PDF" }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe("wird-page-1.pdf")
  expect(await download.failure()).toBeNull()

  const filePath = await download.path()
  expect(filePath).not.toBeNull()
  const bytes = await readFile(filePath!)
  const document = await PDFDocument.load(bytes)
  const imageObjects = document.context.enumerateIndirectObjects().filter(([, object]) =>
    object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image",
  )
  expect(document.getPageCount()).toBe(1)
  expect(imageObjects).toHaveLength(0)
  expect(bytes.toString("latin1")).toContain("/FontFile2")
})

test("يبدأ التلاوة فعليًا من الآية المختارة", async ({ page }) => {
  await openMushaf(page)
  await page.locator('[data-verse-key="1:1"]').first().dispatchEvent("contextmenu", {
    button: 2,
    clientX: 100,
    clientY: 200,
  })
  await page.getByRole("button", { name: "بدء التلاوة من هذه الآية" }).click()

  await expect.poll(() => page.locator("audio").evaluate((element: HTMLAudioElement) => element.paused)).toBe(false)
  await expect.poll(() => page.locator("audio").evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0)
})

test("يشغل التلاوة دون خطأ ويتقدم الصوت", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "تشغيل", exact: true }).click()
  await expect.poll(() => page.locator("audio").evaluate((element: HTMLAudioElement) => ({
    paused: element.paused,
    readyState: element.readyState,
    source: element.currentSrc,
    error: element.error?.message ?? null,
  }))).toMatchObject({ paused: false, error: null })
  await expect.poll(() => page.locator("audio").evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0)
})
