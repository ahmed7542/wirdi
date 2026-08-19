import fontkit, { type Font, type Path } from "@pdf-lib/fontkit"
import { PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from "pdf-lib"

const PDF_WIDTH = 504
const PDF_HEIGHT = 718.5
const QCF4_CDN_URL = "https://cdn.jsdelivr.net/npm/quran-qcf4@1.0.3"
const PDF_UI_FONT_URL = "/fonts/IBMPlexSansArabic-Regular.ttf"
const SURAH_NAME_FONT_URL = "/api/quran/surah-name-font?v=1"
const SURAH_NAME_FONT_NAME = "Wird_SurahName_V4"

type RgbaColor = {
  red: number
  green: number
  blue: number
  alpha: number
}

type TextSnapshot = {
  text: string
  fontUrl: string
  fontSize: number
  color: RgbaColor
  opacity: number
  left: number
  top: number
  width: number
  height: number
}

type HizbSnapshot = {
  completedQuarters: number
  color: RgbaColor
  left: number
  top: number
  width: number
  height: number
}

type PageSnapshot = {
  background: RgbaColor
  border: RgbaColor
  borderWidth: number
  rootWidth: number
  rootHeight: number
  texts: TextSnapshot[]
  hizbIndicators: HizbSnapshot[]
}

type FontResource = {
  bytes: Uint8Array
  metrics: Font
}

type FontPathCommand = {
  command: "moveTo" | "lineTo" | "quadraticCurveTo" | "bezierCurveTo" | "closePath"
  args: number[]
}

function getQcf4FontUrl(fontName: string) {
  if (fontName === "QCF4_QBSML") return `${QCF4_CDN_URL}/fonts-woff2/QCF4_QBSML.woff2`
  if (!/^QCF4_Hafs_\d{2}$/.test(fontName)) throw new Error(`Unknown QCF4 font: ${fontName}`)
  return `${QCF4_CDN_URL}/fonts-woff2/${fontName}_W.woff2`
}

function resolveFontUrl(fontFamily: string) {
  const qcfFont = fontFamily.match(/QCF4_(?:Hafs_\d{2}|QBSML)/)?.[0]
  if (qcfFont) return getQcf4FontUrl(qcfFont)
  if (fontFamily.includes(SURAH_NAME_FONT_NAME)) return SURAH_NAME_FONT_URL
  return PDF_UI_FONT_URL
}

function isQcfFontUrl(url: string) {
  return url.startsWith(`${QCF4_CDN_URL}/fonts-woff2/`)
}

function vectorPathForPdf(fontPath: Path) {
  const commands = (fontPath as unknown as { commands: FontPathCommand[] }).commands
  return commands.map(({ command, args }) => {
    if (command === "moveTo") return `M${args[0]} ${-args[1]}`
    if (command === "lineTo") return `L${args[0]} ${-args[1]}`
    if (command === "quadraticCurveTo") return `Q${args[0]} ${-args[1]} ${args[2]} ${-args[3]}`
    if (command === "bezierCurveTo") {
      return `C${args[0]} ${-args[1]} ${args[2]} ${-args[3]} ${args[4]} ${-args[5]}`
    }
    return "Z"
  }).join("")
}

function createColorReader() {
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Canvas color conversion is unavailable")

  return (value: string): RgbaColor => {
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = "#000000"
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
    return { red, green, blue, alpha: alpha / 255 }
  }
}

function getEffectiveOpacity(element: HTMLElement, boundary: HTMLElement) {
  let opacity = 1
  let current: HTMLElement | null = element
  while (current) {
    const style = window.getComputedStyle(current)
    if (style.display === "none" || style.visibility === "hidden") return 0
    opacity *= Number.parseFloat(style.opacity || "1")
    if (current === boundary) break
    current = current.parentElement
  }
  return opacity
}

function snapshotPage(pageElement: HTMLElement): PageSnapshot {
  const root = pageElement.querySelector<HTMLElement>("[data-quran-text-page]")
  if (!root) throw new Error("Quran page is not ready for vector export")

  const rootRect = root.getBoundingClientRect()
  if (rootRect.width <= 0 || rootRect.height <= 0) throw new Error("Quran page has no exportable size")

  const readColor = createColorReader()
  const rootStyle = window.getComputedStyle(root)
  const exportRoots = [
    ...root.querySelectorAll<HTMLElement>("[data-qcf-line]"),
    ...root.querySelectorAll<HTMLElement>("[data-qcf-page-number], [data-qcf-page-identity]"),
  ]
  const seenTextNodes = new Set<Node>()
  const texts: TextSnapshot[] = []

  for (const exportRoot of exportRoots) {
    const walker = document.createTreeWalker(exportRoot, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      if (!seenTextNodes.has(node)) {
        seenTextNodes.add(node)
        const element = node.parentElement
        const text = node.nodeValue?.trim() ?? ""
        if (element && text && !element.closest(".sr-only, [data-highlight-handle], button")) {
          const opacity = getEffectiveOpacity(element, root)
          const style = window.getComputedStyle(element)
          const range = document.createRange()
          range.selectNodeContents(node)
          const rect = range.getBoundingClientRect()
          range.detach()
          const fontSize = Number.parseFloat(style.fontSize)
          if (opacity > 0 && rect.width > 0 && rect.height > 0 && Number.isFinite(fontSize)) {
            texts.push({
              text,
              fontUrl: resolveFontUrl(style.fontFamily),
              fontSize,
              color: readColor(style.color),
              opacity,
              left: rect.left - rootRect.left,
              top: rect.top - rootRect.top,
              width: rect.width,
              height: rect.height,
            })
          }
        }
      }
      node = walker.nextNode()
    }
  }

  const hizbIndicators = [...root.querySelectorAll<HTMLElement>("[data-qcf-hizb-indicator]")]
    .map((element): HizbSnapshot | null => {
      const rect = element.getBoundingClientRect()
      const completedQuarters = Number(element.dataset.qcfHizbIndicator)
      if (!Number.isFinite(completedQuarters) || rect.width <= 0 || rect.height <= 0) return null
      return {
        completedQuarters,
        color: readColor(window.getComputedStyle(element).color),
        left: rect.left - rootRect.left,
        top: rect.top - rootRect.top,
        width: rect.width,
        height: rect.height,
      }
    })
    .filter((indicator): indicator is HizbSnapshot => indicator !== null)

  return {
    background: readColor(rootStyle.backgroundColor),
    border: readColor(rootStyle.borderTopColor),
    borderWidth: Number.parseFloat(rootStyle.borderTopWidth) || 0,
    rootWidth: rootRect.width,
    rootHeight: rootRect.height,
    texts,
    hizbIndicators,
  }
}

function pdfColor(color: RgbaColor): Color {
  return rgb(color.red / 255, color.green / 255, color.blue / 255)
}

async function loadFontResources(urls: string[]) {
  const resources = new Map<string, FontResource>()
  await Promise.all([...new Set(urls)].map(async (url) => {
    const response = await fetch(url, { mode: url.startsWith("http") ? "cors" : "same-origin" })
    if (!response.ok) throw new Error(`Unable to load PDF font: ${url}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    resources.set(url, { bytes, metrics: fontkit.create(bytes) })
  }))
  return resources
}

function drawVectorText(
  page: PDFPage,
  item: TextSnapshot,
  resource: FontResource,
  scaleX: number,
  scaleY: number,
) {
  const run = resource.metrics.layout(item.text)
  const fontSize = item.fontSize * scaleX
  const fontScale = fontSize / resource.metrics.unitsPerEm
  const targetWidth = item.width * scaleX
  const runWidth = run.positions.reduce((total, position) => total + position.xAdvance * fontScale, 0)
  let cursorX = item.left * scaleX + (targetWidth - runWidth) / 2
  const baselineRatio = 0.5 +
    (resource.metrics.ascent + resource.metrics.descent) / (2 * resource.metrics.unitsPerEm)
  const baselineY = PDF_HEIGHT - (item.top + item.height * baselineRatio) * scaleY
  const color = pdfColor(item.color)
  const opacity = Math.min(1, item.opacity * item.color.alpha)

  run.glyphs.forEach((glyph, index) => {
    const position = run.positions[index]
    page.drawSvgPath(vectorPathForPdf(glyph.path), {
      x: cursorX + position.xOffset * fontScale,
      y: baselineY + position.yOffset * fontScale,
      scale: fontScale,
      color,
      opacity,
    })
    cursorX += position.xAdvance * fontScale
  })
}

function drawHizbIndicator(
  page: PDFPage,
  indicator: HizbSnapshot,
  scaleX: number,
  scaleY: number,
) {
  const centerX = (indicator.left + indicator.width / 2) * scaleX
  const centerY = PDF_HEIGHT - (indicator.top + indicator.height / 2) * scaleY
  const radius = Math.min(indicator.width * scaleX, indicator.height * scaleY) / 2
  const color = pdfColor(indicator.color)
  page.drawCircle({ x: centerX, y: centerY, size: radius, color, opacity: 0.14 })

  const quarterPaths = [
    "M0 0L0 -1C0.5523 -1 1 -0.5523 1 0Z",
    "M0 0L1 0C1 0.5523 0.5523 1 0 1Z",
    "M0 0L0 1C-0.5523 1 -1 0.5523 -1 0Z",
    "M0 0L-1 0C-1 -0.5523 -0.5523 -1 0 -1Z",
  ]
  for (let index = 0; index < indicator.completedQuarters; index += 1) {
    page.drawSvgPath(quarterPaths[index], {
      x: centerX,
      y: centerY,
      scale: radius,
      color,
      opacity: 0.62,
    })
  }
}

async function buildPdf(
  snapshot: PageSnapshot,
  pageNumber: number,
  resources: Map<string, FontResource>,
  subset: boolean,
) {
  const pdfDocument = await PDFDocument.create()
  pdfDocument.registerFontkit(fontkit)
  pdfDocument.setTitle(`ورد - صفحة ${pageNumber}`)
  pdfDocument.setSubject("صفحة متجهية من المصحف الشريف")
  pdfDocument.setCreator("ورد")
  pdfDocument.setProducer("ورد")

  const embeddedFonts = new Map<string, PDFFont>()
  await Promise.all([...resources.entries()].map(async ([url, resource]) => {
    if (!isQcfFontUrl(url)) embeddedFonts.set(url, await pdfDocument.embedFont(resource.bytes, { subset }))
  }))

  const page = pdfDocument.addPage([PDF_WIDTH, PDF_HEIGHT])
  const scaleX = PDF_WIDTH / snapshot.rootWidth
  const scaleY = PDF_HEIGHT / snapshot.rootHeight
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PDF_WIDTH,
    height: PDF_HEIGHT,
    color: pdfColor(snapshot.background),
    borderColor: pdfColor(snapshot.border),
    borderWidth: snapshot.borderWidth * scaleX,
    opacity: snapshot.background.alpha,
    borderOpacity: snapshot.border.alpha,
  })

  for (const item of snapshot.texts) {
    const resource = resources.get(item.fontUrl)
    if (!resource) continue
    if (isQcfFontUrl(item.fontUrl)) {
      drawVectorText(page, item, resource, scaleX, scaleY)
      continue
    }

    const font = embeddedFonts.get(item.fontUrl)
    if (!font) continue
    const text = item.text
    let fontSize = item.fontSize * scaleX
    const targetWidth = item.width * scaleX
    const measuredWidth = font.widthOfTextAtSize(text, fontSize)
    if (measuredWidth > targetWidth && targetWidth > 0) fontSize *= targetWidth / measuredWidth

    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const x = item.left * scaleX + (targetWidth - textWidth) / 2
    const metrics = resource.metrics
    const baselineRatio = 0.5 + (metrics.ascent + metrics.descent) / (2 * metrics.unitsPerEm)
    const baselineFromTop = item.height * baselineRatio
    const y = PDF_HEIGHT - (item.top + baselineFromTop) * scaleY
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: pdfColor(item.color),
      opacity: Math.min(1, item.opacity * item.color.alpha),
    })
  }

  for (const indicator of snapshot.hizbIndicators) drawHizbIndicator(page, indicator, scaleX, scaleY)
  return pdfDocument.save({ useObjectStreams: false })
}

export async function downloadVectorQuranPagePdf(pageElement: HTMLElement, pageNumber: number) {
  await document.fonts.ready
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))

  const snapshot = snapshotPage(pageElement)
  const resources = await loadFontResources(snapshot.texts.map((item) => item.fontUrl))
  let bytes: Uint8Array
  try {
    bytes = await buildPdf(snapshot, pageNumber, resources, true)
  } catch {
    bytes = await buildPdf(snapshot, pageNumber, resources, false)
  }

  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `wird-page-${pageNumber}.pdf`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
