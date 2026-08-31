import { readFile } from "node:fs/promises"
import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib"

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
  await page.locator('button[data-verse-key="2:255"]').click()
  await expect(page.getByLabel("صفحة 42 من المصحف الشريف")).toBeVisible()
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

  await page.getByRole("button", { name: "فتح لوحة وِرد" }).click()
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

test("يوضح منتقي الموضع ويرتب الخطط والمتشابهات قبل اليوم", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.removeItem("wird-khatma-plan-v1")
    window.localStorage.removeItem("wird-learning-plan-v1")
  })
  await openMushaf(page)
  await page.getByRole("button", { name: "فتح لوحة وِرد" }).click()

  const picker = page.getByRole("combobox", { name: "البحث والانتقال في المصحف" })
  const plans = page.getByRole("heading", { name: "الخطط", exact: true })
  const today = page.getByRole("heading", { name: "اليوم", exact: true })
  await expect(picker).toBeVisible()
  await expect(plans).toBeVisible()
  await expect(page.getByRole("button", { name: /^خطط الحفظ والمراجعة/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /^المتشابهات/ })).toBeVisible()
  await expect(today).toBeVisible()
  expect((await plans.boundingBox())!.y).toBeLessThan((await today.boundingBox())!.y)
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
  await page.getByRole("button", { name: "فتح لوحة وِرد" }).click()
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
  await page.getByRole("button", { name: "فتح لوحة وِرد" }).click()
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
  await page.getByRole("button", { name: "فتح لوحة وِرد" }).click()
  await page.getByRole("button", { name: "فتح إعدادات النسخ الاحتياطي" }).click()

  await expect(page.getByRole("heading", { name: "إعدادات وِرد" })).toBeVisible()
  await expect(page.getByRole("tab", { name: "التطبيق" })).toHaveAttribute("data-state", "active")
  await expect(page.locator("[data-backup-settings]")).toBeVisible()
})

test("يعرض المصحف المفتوح في رأس الهاتف ويستخدم أهداف لمس أوضح", async ({ page }) => {
  await openMushaf(page)
  const appButton = page.getByRole("button", { name: "فتح لوحة وِرد" })
  await expect(appButton.locator("svg.lucide-book-open")).toHaveCount(1)
  const settingsButton = page.getByRole("button", { name: "إعدادات التطبيق" })
  await expect(settingsButton.locator("svg.lucide-settings")).toHaveCount(1)
  expect((await settingsButton.boundingBox())!.x).toBeLessThanOrEqual(12)
  const labels = ["فتح لوحة وِرد", "أدوات القراءة", "إعدادات التطبيق", "المزيد من أدوات الصفحة"]
  for (const label of labels) {
    const bounds = await page.getByRole("button", { name: label }).boundingBox()
    expect(bounds?.width).toBeGreaterThanOrEqual(36)
    expect(bounds?.height).toBeGreaterThanOrEqual(36)
  }
  await expect(page.getByRole("button", { name: "عرض المصحف بملء الشاشة" })).toHaveCount(0)
  await page.getByRole("button", { name: "المزيد من أدوات الصفحة" }).click()
  await expect(page.getByRole("menuitem", { name: "ملء الشاشة" })).toBeVisible()
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
  await page.getByRole("button", { name: "فتح لوحة وِرد" }).click()
  await expect(page.getByRole("heading", { name: "لوحة وِرد" })).toBeAttached()
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test("يحمل الإعدادات عند الطلب ويحافظ على تباين التبويبات", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()
  await expect(page.getByRole("heading", { name: "إعدادات وِرد" })).toBeVisible()
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
  await page.setContent('<iframe title="معاينة وِرد" src="http://127.0.0.1:3000/" style="width:390px;height:844px"></iframe>')
  const preview = page.frameLocator('iframe[title="معاينة وِرد"]')
  await expect(preview.locator("[data-qcf-line]").first()).toBeVisible()
  await preview.getByRole("button", { name: "إعدادات التطبيق" }).click()
  await preview.getByRole("tab", { name: "التطبيق" }).click()
  await expect(preview.getByText("افتح التطبيق مباشرة", { exact: true })).toBeVisible()
  await expect(preview.getByRole("button", { name: "فتح في تبويب مستقل" })).toBeVisible()
})

test("يثبت الثيم المختار قبل تشغيل الواجهة", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("wird-color-palette-v1", "beige")
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
  expect(themeState.palette).toBe("beige")
  expect(themeState.changes).not.toContain("olive")
  expect(themeState.themeColors.every((color) => color === "#806b58")).toBeTruthy()

  await page.getByRole("button", { name: "إعدادات التطبيق" }).click()
  await page.getByRole("button", { name: "الألوان" }).click()
  await expect(page.getByRole("radio", { name: "بيج هادئ" })).toBeChecked()
})

test("يوضح أن تذكير الختمة يعمل داخل التطبيق", async ({ page }) => {
  await openMushaf(page)
  await page.getByRole("button", { name: "فتح لوحة وِرد" }).click()
  await page.locator("button").filter({ hasText: "إنشاء مسار ختمة" }).click()
  await expect(page.getByRole("heading", { name: "مسار الختمة" })).toBeVisible()
  await expect(page.getByText("تذكير يومي داخل التطبيق", { exact: true })).toBeVisible()
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

test("يعترض Service Worker مصدر حدر أحمد ديبان", async ({ request }) => {
  const [workerResponse, pageResponse] = await Promise.all([
    request.get("/sw.js"),
    request.get("/api/quran", { params: { page: "2", reciter: "2001" } }),
  ])
  expect(workerResponse.ok()).toBeTruthy()
  expect(pageResponse.ok()).toBeTruthy()
  const workerSource = await workerResponse.text()
  expect(workerSource).toContain('"archive.org"')
  expect(workerSource).toContain('VERSION = `wird-v47-')
  expect(workerSource).toContain('QURAN_CACHE = "wird-quran-v1"')
  expect(workerSource).toContain("APP_CACHE_GENERATIONS = 3")
  expect(workerSource).toContain("precacheAppShell()")
  expect((await pageResponse.json()).tracks[0].audioUrl).toContain("archive.org")
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
