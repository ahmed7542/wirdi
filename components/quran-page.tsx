"use client"

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { LoaderCircle, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ReadingMode = "page" | "large"
export type LineSpacing = "normal" | "comfortable" | "spacious"

export type HighlightCategory = "mistake" | "hesitation" | "reinforce"

export type VerseHighlight = {
  verseKey: string
  startPosition: number
  endPosition: number
  pageNumber?: number
  chapterName?: string
  verseText?: string
  category?: HighlightCategory
  reviewStep?: number
  nextReviewDate?: string
  lastReviewDate?: string
}

export type HighlightDraft = {
  verseKey: string
  startPosition?: number
  endPosition?: number
  anchorPosition?: number
  category?: HighlightCategory
}

export type HighlightEdge = "start" | "end"

export type QuranWord = {
  id: number
  verseKey: string
  position: number
  charType: string
  textQpcHafs: string
  pageNumber: number
  lineNumber: number
}

export type QuranVerse = {
  id: number
  verseKey: string
  verseNumber: number
  pageNumber: number
  juzNumber: number
  hizbNumber: number
  rubAlHizbNumber: number
  chapterId: number
  chapterName: string
  isChapterEnd: boolean
  text: string
  words: QuranWord[]
  wordTimings?: Array<{
    position: number
    startMs: number
    endMs: number
  }>
  timestampFrom: number
  timestampTo: number
}

export type Qcf4Glyph = {
  code: number
  char: string
  font: string
  text: string
  type: "word" | "end" | "surah_header" | "bismillah" | "quarter"
  verseKey?: string
  position?: number
  chapterId?: number
}

export type Qcf4Page = {
  font: string
  lines: Array<{
    lineNumber: number
    glyphs: Qcf4Glyph[]
  }>
}

export const QCF4_CDN_URL = "https://cdn.jsdelivr.net/npm/quran-qcf4@1.0.3"
export const QPC_HAFS_FONT_URL =
  "https://verses.quran.foundation/fonts/quran/hafs/uthmanic_hafs/UthmanicHafs1Ver18.woff2"

export const SURAH_NAME_FONT_URL = "/api/quran/surah-name-font?v=1"
export const SURAH_NAME_FONT_NAME = "Wird_SurahName_V4"

const OPENING_PAGE_LINE_POSITIONS = [24, 36, 43.75, 50.25, 56.75, 63.25, 69.75, 76.25]
const BISMILLAH_QCF_GLYPHS = "\uF100\uF101\uF102\uF103"
const loadedFonts = new Set<string>()
const fontPromises = new Map<string, Promise<void>>()

export function getQcf4FontUrl(fontName: string) {
  if (fontName === "QCF4_QBSML") {
    return `${QCF4_CDN_URL}/fonts-woff2/QCF4_QBSML.woff2`
  }
  if (!/^QCF4_Hafs_\d{2}$/.test(fontName)) {
    throw new Error(`Unknown QCF4 font: ${fontName}`)
  }
  return `${QCF4_CDN_URL}/fonts-woff2/${fontName}_W.woff2`
}

async function cachedFontObjectUrl(url: string) {
  if (!("caches" in window)) return null
  try {
    const response = await window.caches.match(url)
    if (!response?.ok) return null
    return URL.createObjectURL(await response.blob())
  } catch {
    return null
  }
}

async function loadFontFace(fontName: string, url: string) {
  const objectUrl = await cachedFontObjectUrl(url)
  const face = new FontFace(fontName, `url("${objectUrl ?? url}")`, { display: "block" })
  try {
    const loadedFace = await face.load()
    document.fonts.add(loadedFace)
    if (loadedFace.status !== "loaded") throw new Error(`Font loading failed: ${fontName}`)
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

async function loadQcf4Font(fontName: string) {
  if (loadedFonts.has(fontName)) return

  let promise = fontPromises.get(fontName)
  if (!promise) {
    promise = (async () => {
      await loadFontFace(fontName, getQcf4FontUrl(fontName))
      loadedFonts.add(fontName)
    })().catch((error) => {
      fontPromises.delete(fontName)
      throw error
    })
    fontPromises.set(fontName, promise)
  }

  await promise
}

async function loadQcf4FontWithRetry(fontName: string) {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await loadQcf4Font(fontName)
      return
    } catch (error) {
      lastError = error
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)))
      }
    }
  }
  throw lastError
}

async function loadSurahNameFont() {
  if (loadedFonts.has(SURAH_NAME_FONT_NAME)) return
  let promise = fontPromises.get(SURAH_NAME_FONT_NAME)
  if (!promise) {
    promise = (async () => {
      await loadFontFace(SURAH_NAME_FONT_NAME, SURAH_NAME_FONT_URL)
      loadedFonts.add(SURAH_NAME_FONT_NAME)
    })().catch((error) => {
      fontPromises.delete(SURAH_NAME_FONT_NAME)
      throw error
    })
    fontPromises.set(SURAH_NAME_FONT_NAME, promise)
  }
  await promise
}

async function loadSurahNameFontWithRetry() {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await loadSurahNameFont()
      return
    } catch (error) {
      lastError = error
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)))
    }
  }
  throw lastError
}

function getQcf4PageFontNames(qcfPage?: Qcf4Page) {
  return new Set(qcfPage?.lines.flatMap((line) => line.glyphs.map((glyph) => glyph.font)) ?? [])
}

export function areQcf4PageFontsReady(qcfPage?: Qcf4Page) {
  const fontNames = getQcf4PageFontNames(qcfPage)
  return fontNames.size > 0 && [...fontNames].every((fontName) => loadedFonts.has(fontName))
}

export async function preloadQcf4PageFonts(qcfPage?: Qcf4Page) {
  if (!qcfPage) return
  const fontNames = getQcf4PageFontNames(qcfPage)
  const needsSurahNameFont = qcfPage.lines.some((line) =>
    line.glyphs.some((glyph) => glyph.type === "surah_header"),
  )
  await Promise.all([
    ...[...fontNames].map((fontName) => loadQcf4FontWithRetry(fontName)),
    ...(needsSurahNameFont ? [loadSurahNameFontWithRetry()] : []),
  ])
}

function getSurahNameLigature(chapterId: number) {
  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > 114) return ""
  return `surah${String(chapterId).padStart(3, "0")}`
}

function DecoratedSurahName({ chapterId, className }: { chapterId: number; className: string }) {
  return (
    <span
      className={cn("inline-flex items-center justify-center gap-[0.12em] leading-none text-[var(--mushaf-meta)] opacity-80", className)}
      style={{
        fontFamily: `"${SURAH_NAME_FONT_NAME}"`,
        fontFeatureSettings: `"liga" 1, "dlig" 1`,
      }}
      dir="rtl"
      translate="no"
      aria-hidden="true"
    >
      <span dir="ltr">surah-icon</span>
      <span dir="ltr">{getSurahNameLigature(chapterId)}</span>
    </span>
  )
}

const HIZB_QUARTER_SEGMENTS = [
  {
    clip: "[clip-path:polygon(50%_50%,50%_0,100%_0,100%_50%)]",
    offset: "translate-x-[0.5px] -translate-y-[0.5px]",
  },
  {
    clip: "[clip-path:polygon(50%_50%,100%_50%,100%_100%,50%_100%)]",
    offset: "translate-x-[0.5px] translate-y-[0.5px]",
  },
  {
    clip: "[clip-path:polygon(50%_50%,50%_100%,0_100%,0_50%)]",
    offset: "-translate-x-[0.5px] translate-y-[0.5px]",
  },
  {
    clip: "[clip-path:polygon(50%_50%,0_50%,0_0,50%_0)]",
    offset: "-translate-x-[0.5px] -translate-y-[0.5px]",
  },
] as const

export function HizbQuarterIndicator({ hizbNumber, rubAlHizbNumber }: {
  hizbNumber: number
  rubAlHizbNumber: number
}) {
  const quarter = ((rubAlHizbNumber - 1) % 4) + 1
  const completedQuarters = quarter - 1

  return (
    <span
      className="inline-flex size-3.5 shrink-0 items-center justify-center"
      role="img"
      data-qcf-hizb-indicator={completedQuarters}
      aria-label={`الربع ${quarter} من الحزب ${hizbNumber}، اكتمل قبله ${completedQuarters} من 4 أرباع`}
    >
      <span className="relative size-3" aria-hidden="true">
        {HIZB_QUARTER_SEGMENTS.map((segment, index) => (
          <span
            key={segment.clip}
            className={cn(
              "absolute inset-0 rounded-full",
              segment.clip,
              segment.offset,
              index < completedQuarters
                ? "bg-[var(--mushaf-meta)] opacity-[0.62]"
                : "bg-[var(--mushaf-meta)] opacity-[0.14]",
            )}
          />
        ))}
      </span>
    </span>
  )
}

type QuranTextPageProps = {
  page: number
  verses: QuranVerse[]
  qcfPage?: Qcf4Page
  activeVerseKey?: string
  selectedVerseKey?: string
  visibleVerseKeys?: string[]
  progressiveReveal?: {
    verseKey: string
    visibleWordPosition: number
    transitionDurationMs: number
  }
  readingMode?: ReadingMode
  largeTextSize?: number
  autoScroll?: boolean
  showOrnamentsWhenMasked?: boolean
  hidePageIdentity?: boolean
  hidePageNumber?: boolean
  floatingPageIdentity?: boolean
  reserveTopChrome?: false | "page" | "fullscreen"
  isLoading?: boolean
  className?: string
  standardPageAspect?: boolean
  fluidPageAspect?: boolean
  compactHorizontalMargins?: boolean
  relaxedLineSpacing?: boolean
  lineSpacing?: "normal" | "comfortable" | "spacious"
  pageIdentityGap?: boolean
  highlights?: VerseHighlight[]
  highlightDraft?: HighlightDraft | null
  onVerseLongPress?: (verseKey: string, position?: number) => void
  onHighlightPositionSelect?: (position: number) => void
  onHighlightRangeChange?: (edge: HighlightEdge, position: number) => void
  onPageTap?: () => void
  onCenterTap?: () => void
  onUnicodeCopy?: (text: string) => void
  onTextBoundsChange?: (bounds: { left: number; right: number }) => void
}

export function QuranTextPage({
  page,
  verses,
  qcfPage,
  activeVerseKey,
  selectedVerseKey,
  visibleVerseKeys,
  progressiveReveal,
  readingMode = "page",
  largeTextSize = 36,
  autoScroll = true,
  showOrnamentsWhenMasked = false,
  hidePageIdentity = false,
  hidePageNumber = false,
  floatingPageIdentity = false,
  reserveTopChrome = false,
  isLoading = false,
  className,
  standardPageAspect = false,
  fluidPageAspect = false,
  compactHorizontalMargins = false,
  relaxedLineSpacing = false,
  lineSpacing = relaxedLineSpacing ? "comfortable" : "normal",
  pageIdentityGap = false,
  highlights = [],
  highlightDraft,
  onVerseLongPress,
  onHighlightPositionSelect,
  onHighlightRangeChange,
  onPageTap,
  onCenterTap,
  onUnicodeCopy,
  onTextBoundsChange,
}: QuranTextPageProps) {
  const pageRef = useRef<HTMLDivElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null)
  const suppressNextClickRef = useRef(false)
  const highlightDragEdgeRef = useRef<HighlightEdge | null>(null)
  const highlightDragPointerRef = useRef<number | null>(null)
  const highlightDragPositionRef = useRef<number | null>(null)
  const highlightVerseKeyRef = useRef<string | null>(null)
  const highlightRangeChangeRef = useRef(onHighlightRangeChange)
  const [fontState, setFontState] = useState<"loading" | "ready" | "error">(() =>
    readingMode === "large" || areQcf4PageFontsReady(qcfPage) ? "ready" : "loading",
  )
  const [fontRetryKey, setFontRetryKey] = useState(0)
  const [surahNameFontReady, setSurahNameFontReady] = useState(false)
  const requiredFonts = useMemo(
    () => new Set(qcfPage?.lines.flatMap((line) => line.glyphs.map((glyph) => glyph.font)) ?? []),
    [qcfPage],
  )
  const needsSurahNameFont = useMemo(
    () => readingMode === "large"
      ? verses.some((verse) => verse.verseNumber === 1)
      : Boolean(qcfPage?.lines.some((line) => line.glyphs.some((glyph) => glyph.type === "surah_header"))),
    [qcfPage, readingMode, verses],
  )

  useEffect(() => {
    let cancelled = false
    if (!needsSurahNameFont) {
      setSurahNameFontReady(false)
      return () => {
        cancelled = true
      }
    }
    setSurahNameFontReady(false)
    loadSurahNameFontWithRetry()
      .then(() => {
        if (!cancelled) setSurahNameFontReady(true)
      })
      .catch((error) => {
        console.error("Failed to load the Surah header font", error)
      })
    return () => {
      cancelled = true
    }
  }, [fontRetryKey, needsSurahNameFont])

  useEffect(() => {
    let cancelled = false
    if (readingMode === "large") {
      setFontState("ready")
      return () => {
        cancelled = true
      }
    }
    if (!qcfPage || requiredFonts.size === 0) {
      setFontState("loading")
      return () => {
        cancelled = true
      }
    }

    if (areQcf4PageFontsReady(qcfPage)) {
      setFontState("ready")
      return () => {
        cancelled = true
      }
    }

    setFontState("loading")
    preloadQcf4PageFonts(qcfPage)
      .then(() => {
        if (!cancelled) setFontState("ready")
      })
      .catch((error) => {
        console.error("Failed to load QCF4 page fonts", error)
        if (!cancelled) setFontState("error")
      })

    return () => {
      cancelled = true
    }
  }, [fontRetryKey, qcfPage, readingMode, requiredFonts])

  useLayoutEffect(() => {
    if (readingMode !== "page" || fontState !== "ready") return
    const pageElement = pageRef.current
    if (!pageElement) return

    let frame = 0
    let lastMeasuredWidth = -1
    const scheduleFit = (force = false) => {
      const width = pageElement.getBoundingClientRect().width
      if (!force && Math.abs(width - lastMeasuredWidth) < 0.5) return
      lastMeasuredWidth = width
      window.cancelAnimationFrame(frame)

      frame = window.requestAnimationFrame(() => {
        const lines = [...pageElement.querySelectorAll<HTMLElement>("[data-qcf-fit-line]")]
        for (const line of lines) line.style.removeProperty("font-size")
        for (const line of lines) {
          const glyphs = [...line.children] as HTMLElement[]
          if (glyphs.length === 0) continue
          const lineRect = line.getBoundingClientRect()
          const glyphRects = glyphs.map((glyph) => glyph.getBoundingClientRect())
          const contentWidth = Math.max(...glyphRects.map((rect) => rect.right)) -
            Math.min(...glyphRects.map((rect) => rect.left))
          const standardDesktopLayout = standardPageAspect && window.matchMedia("(min-width: 640px)").matches
          const reservedWidth = standardDesktopLayout ? 4 : lineRect.width * 0.056
          const availableWidth = Math.max(0, lineRect.width - reservedWidth)
          const baseFontSize = Number.parseFloat(window.getComputedStyle(line).fontSize)
          if (!Number.isFinite(baseFontSize) || baseFontSize <= 0) continue
          if (contentWidth > availableWidth + 0.5) {
            line.style.fontSize = `${baseFontSize * (availableWidth / contentWidth) * 0.995}px`
          }

          let fittedGlyphRects = glyphs.map((glyph) => glyph.getBoundingClientRect())
          let fittedLeft = Math.min(...fittedGlyphRects.map((rect) => rect.left))
          let fittedRight = Math.max(...fittedGlyphRects.map((rect) => rect.right))
          const fittedWidth = fittedRight - fittedLeft
          if (fittedWidth > availableWidth + 0.5) {
            const fittedFontSize = Number.parseFloat(window.getComputedStyle(line).fontSize)
            line.style.fontSize = `${fittedFontSize * (availableWidth / fittedWidth) * 0.995}px`
            fittedGlyphRects = glyphs.map((glyph) => glyph.getBoundingClientRect())
            fittedLeft = Math.min(...fittedGlyphRects.map((rect) => rect.left))
            fittedRight = Math.max(...fittedGlyphRects.map((rect) => rect.right))
          }
        }

        const pageRect = pageElement.getBoundingClientRect()
        const glyphRects = lines.flatMap((line) =>
          ([...line.children] as HTMLElement[]).map((glyph) => glyph.getBoundingClientRect()),
        )
        if (glyphRects.length > 0) {
          const contentLeft = Math.min(...glyphRects.map((rect) => rect.left))
          const contentRight = Math.max(...glyphRects.map((rect) => rect.right))
          const measuredInset = Math.min(contentLeft - pageRect.left, pageRect.right - contentRight)
          const minimumInset = pageRect.width * 0.028
          const textInset = Math.max(minimumInset, measuredInset)
          pageElement.style.setProperty("--qcf-text-inset", `${textInset}px`)
          onTextBoundsChange?.({
            left: contentLeft,
            right: window.innerWidth - contentRight,
          })
        }
      })
    }

    scheduleFit(true)
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => scheduleFit())
    observer?.observe(pageElement)
    const handleWindowResize = () => scheduleFit()
    window.addEventListener("resize", handleWindowResize)
    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener("resize", handleWindowResize)
      pageElement.style.removeProperty("--qcf-text-inset")
      for (const line of pageElement.querySelectorAll<HTMLElement>("[data-qcf-fit-line]")) {
        line.style.removeProperty("font-size")
      }
    }
  }, [compactHorizontalMargins, fluidPageAspect, fontState, lineSpacing, onTextBoundsChange, qcfPage, readingMode, standardPageAspect])

  const verseText = useMemo(
    () => new Map(verses.map((verse) => [verse.verseKey, verse.text])),
    [verses],
  )
  const chapterNames = useMemo(
    () => new Map(verses.map((verse) => [verse.chapterId, verse.chapterName])),
    [verses],
  )
  const visibleVerseKeySet = useMemo(
    () => visibleVerseKeys ? new Set(visibleVerseKeys) : undefined,
    [visibleVerseKeys],
  )
  const visibleVerseText = (verse: QuranVerse) => progressiveReveal?.verseKey === verse.verseKey
    ? verse.words
        .filter((word) => word.position <= progressiveReveal.visibleWordPosition)
        .map((word) => word.textQpcHafs)
        .join(" ")
    : verse.text
  const pageIdentityVerse =
    verses.find((verse) => verse.verseKey === selectedVerseKey) ??
    verses.find((verse) => verse.verseKey === activeVerseKey) ??
    verses[0]
  const copyText = visibleVerseKeySet
    ? verses.filter((verse) => visibleVerseKeySet.has(verse.verseKey)).map(visibleVerseText).join(" ")
    : verseText.get(selectedVerseKey ?? activeVerseKey ?? "") ?? verses.map((verse) => verse.text).join(" ")
  const accessibleText = visibleVerseKeySet
    ? verses.filter((verse) => visibleVerseKeySet.has(verse.verseKey)).map(visibleVerseText).join(" ")
    : verses.map((verse) => verse.text).join(" ")
  const lastVisibleVerseKey = visibleVerseKeys?.[visibleVerseKeys.length - 1]
  const focusVerseKey = visibleVerseKeys !== undefined
    ? lastVisibleVerseKey
    : activeVerseKey ?? selectedVerseKey
  const showLoader = isLoading || !qcfPage || fontState === "loading"
  const lineCount = qcfPage?.lines.length ?? (page <= 2 ? 8 : 15)
  const isCenterTap = (element: HTMLElement, clientX: number, clientY: number) => {
    const pageRect = element.getBoundingClientRect()
    const scrollContainer = element.closest<HTMLElement>("[data-quran-scroll-container]")
    const viewportRect = scrollContainer?.getBoundingClientRect() ?? {
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      left: 0,
    }
    const left = Math.max(pageRect.left, viewportRect.left)
    const right = Math.min(pageRect.right, viewportRect.right)
    const top = Math.max(pageRect.top, viewportRect.top)
    const bottom = Math.min(pageRect.bottom, viewportRect.bottom)
    const width = right - left
    const height = bottom - top
    if (width <= 0 || height <= 0) return false
    const relativeX = (clientX - left) / width
    const relativeY = (clientY - top) / height
    return relativeX >= 0.3 && relativeX <= 0.7 && relativeY >= 0.28 && relativeY <= 0.72
  }
  const clearLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
    longPressStartRef.current = null
  }
  const brieflySuppressClick = () => {
    suppressNextClickRef.current = true
    if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current)
    suppressClickTimerRef.current = setTimeout(() => {
      suppressNextClickRef.current = false
      suppressClickTimerRef.current = null
    }, 800)
  }
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!onVerseLongPress || highlightDraft || event.button !== 0) return
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-verse-key]")
    const verseKey = target?.dataset.verseKey
    if (!verseKey) return
    const position = Number(target.closest<HTMLElement>("[data-word-position]")?.dataset.wordPosition)
    clearLongPress()
    longPressStartRef.current = { x: event.clientX, y: event.clientY }
    longPressTimerRef.current = setTimeout(() => {
      brieflySuppressClick()
      onVerseLongPress(verseKey, position > 0 ? position : undefined)
      clearLongPress()
    }, 480)
  }
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = longPressStartRef.current
    if (!start) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) clearLongPress()
  }
  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onVerseLongPress || highlightDraft) return
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-verse-key]")
    const verseKey = target?.dataset.verseKey
    if (!verseKey) return
    const position = Number(target.closest<HTMLElement>("[data-word-position]")?.dataset.wordPosition)
    event.preventDefault()
    if (suppressNextClickRef.current) return
    if (longPressStartRef.current) brieflySuppressClick()
    clearLongPress()
    onVerseLongPress(verseKey, position > 0 ? position : undefined)
  }
  const isStoredHighlight = (verseKey: string, position: number) => highlights.some((highlight) => {
    const start = Math.min(highlight.startPosition, highlight.endPosition)
    const end = Math.max(highlight.startPosition, highlight.endPosition)
    return highlight.verseKey === verseKey && position >= start && position <= end
  })
  const isDraftHighlight = (verseKey: string, position: number) => {
    if (highlightDraft?.verseKey !== verseKey || highlightDraft.startPosition === undefined) return false
    const endPosition = highlightDraft.endPosition ?? highlightDraft.startPosition
    const start = Math.min(highlightDraft.startPosition, endPosition)
    const end = Math.max(highlightDraft.startPosition, endPosition)
    return position >= start && position <= end
  }
  const draftStartPosition = highlightDraft?.startPosition === undefined
    ? undefined
    : Math.min(highlightDraft.startPosition, highlightDraft.endPosition ?? highlightDraft.startPosition)
  const draftEndPosition = highlightDraft?.startPosition === undefined
    ? undefined
    : Math.max(highlightDraft.startPosition, highlightDraft.endPosition ?? highlightDraft.startPosition)
  const draftWordCount = highlightDraft
    ? Math.max(1, verseText.get(highlightDraft.verseKey)?.split(/\s+/).length ?? 1)
    : 1

  useEffect(() => {
    highlightVerseKeyRef.current = highlightDraft?.verseKey ?? null
    highlightRangeChangeRef.current = onHighlightRangeChange
  }, [highlightDraft?.verseKey, onHighlightRangeChange])

  useEffect(() => {
    const resolvePosition = (clientX: number, clientY: number) => {
      const verseKey = highlightVerseKeyRef.current
      if (!verseKey) return null
      const elements = document.elementsFromPoint(clientX, clientY)
      for (const element of elements) {
        const word = element.closest("[data-word-position]") as HTMLElement | null
        const position = Number(word?.dataset.wordPosition)
        if (word?.dataset.verseKey === verseKey && position > 0) return position
      }

      let nearestPosition: number | null = null
      let nearestDistance = Number.POSITIVE_INFINITY
      const words = pageRef.current?.querySelectorAll<HTMLElement>("[data-word-position]") ?? []
      for (const word of words) {
        if (word.dataset.verseKey !== verseKey) continue
        const position = Number(word.dataset.wordPosition)
        if (position <= 0) continue
        const rect = word.getBoundingClientRect()
        const horizontalDistance = clientX < rect.left
          ? rect.left - clientX
          : clientX > rect.right
            ? clientX - rect.right
            : 0
        const verticalDistance = clientY < rect.top
          ? rect.top - clientY
          : clientY > rect.bottom
            ? clientY - rect.bottom
            : 0
        const distance = Math.hypot(horizontalDistance, verticalDistance)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestPosition = position
        }
      }
      return nearestPosition
    }
    const updateRange = (event: PointerEvent) => {
      if (
        highlightDragEdgeRef.current === null ||
        highlightDragPointerRef.current !== event.pointerId
      ) return
      event.preventDefault()
      const position = resolvePosition(event.clientX, event.clientY)
      if (position === null || position === highlightDragPositionRef.current) return
      highlightDragPositionRef.current = position
      highlightRangeChangeRef.current?.(highlightDragEdgeRef.current, position)
    }
    const resetDrag = () => {
      highlightDragEdgeRef.current = null
      highlightDragPointerRef.current = null
      highlightDragPositionRef.current = null
      brieflySuppressClick()
    }
    const finishDrag = (event: PointerEvent) => {
      if (highlightDragPointerRef.current !== event.pointerId) return
      updateRange(event)
      resetDrag()
    }
    const cancelDrag = (event: PointerEvent) => {
      if (highlightDragPointerRef.current === event.pointerId) resetDrag()
    }
    window.addEventListener("pointermove", updateRange, { passive: false })
    window.addEventListener("pointerup", finishDrag)
    window.addEventListener("pointercancel", cancelDrag)
    return () => {
      window.removeEventListener("pointermove", updateRange)
      window.removeEventListener("pointerup", finishDrag)
      window.removeEventListener("pointercancel", cancelDrag)
    }
  }, [])

  const renderHighlightHandle = (edge: HighlightEdge, position: number) => (
    <span
      data-highlight-handle={edge}
      className={cn(
        "font-sans absolute top-1/2 z-30 h-9 w-7 -translate-y-1/2 touch-none cursor-ew-resize select-none",
        edge === "start" ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2",
      )}
      role={readingMode === "large" ? "slider" : undefined}
      tabIndex={readingMode === "large" ? 0 : -1}
      aria-hidden={readingMode === "large" ? undefined : true}
      aria-label={edge === "start" ? "مقبض بداية التظليل" : "مقبض نهاية التظليل"}
      aria-valuemin={1}
      aria-valuemax={draftWordCount}
      aria-valuenow={position}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        clearLongPress()
        brieflySuppressClick()
        highlightDragEdgeRef.current = edge
        highlightDragPointerRef.current = event.pointerId
        highlightDragPositionRef.current = position
      }}
      onTouchStart={(event) => event.stopPropagation()}
      onTouchEnd={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
        event.preventDefault()
        event.stopPropagation()
        const step = event.key === "ArrowRight" ? -1 : 1
        highlightRangeChangeRef.current?.(edge, Math.max(1, position + step))
      }}
    >
      <span className="pointer-events-none absolute top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--quran-highlight)] shadow-sm" />
      <span
        className={cn(
          "pointer-events-none absolute left-1/2 size-3 -translate-x-1/2 rounded-full border-2 border-card bg-[var(--quran-highlight)] shadow-md",
          edge === "start" ? "top-0.5" : "bottom-0.5",
        )}
      />
    </span>
  )

  useEffect(() => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current)
  }, [])

  useEffect(() => {
    if (
      !autoScroll ||
      !focusVerseKey ||
      (readingMode === "page" && fontState !== "ready")
    ) return
    const frame = window.requestAnimationFrame(() => {
      const glyphs = pageRef.current?.querySelectorAll<HTMLElement>(
        `[data-verse-key="${focusVerseKey}"]`,
      )
      if (!glyphs?.length) return
      const firstRect = glyphs[0].getBoundingClientRect()
      const lastRect = glyphs[glyphs.length - 1].getBoundingClientRect()
      const scrollContainer = pageRef.current?.closest<HTMLElement>("[data-quran-scroll-container]")
      const containerRect = scrollContainer?.getBoundingClientRect()
      const topBoundary = containerRect ? containerRect.top + 16 : 72
      const viewportBottom = containerRect ? containerRect.bottom - 16 : window.innerHeight - 24
      const playerRect = document.querySelector<HTMLElement>("[data-quran-player]")?.getBoundingClientRect()
      const bottomBoundary = playerRect && playerRect.height > 0
        ? Math.min(viewportBottom, playerRect.top - 12)
        : viewportBottom
      if (firstRect.top >= topBoundary && lastRect.bottom <= bottomBoundary) return
      const verseCenter = (firstRect.top + lastRect.bottom) / 2
      const viewportCenter = (topBoundary + bottomBoundary) / 2
      const top = verseCenter - viewportCenter
      if (scrollContainer) {
        scrollContainer.scrollBy({ top, behavior: "smooth" })
      } else {
        window.scrollBy({ top, behavior: "smooth" })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [autoScroll, focusVerseKey, fontState, readingMode])

  if (readingMode === "large") {
    const displayedVerses = visibleVerseKeySet
      ? verses.filter((verse) => visibleVerseKeySet.has(verse.verseKey))
      : verses

    return (
      <div
        ref={pageRef}
        className={cn(
          "relative overflow-visible rounded-none border-y border-[var(--mushaf-border)] bg-[var(--mushaf-paper)] text-[var(--mushaf-ink)] sm:rounded-md sm:border",
          onPageTap && "cursor-pointer",
          className,
        )}
        data-quran-text-page
        aria-label={`قراءة مكبرة لصفحة ${page}`}
        role={!highlightDraft && (onPageTap || onCenterTap) ? "button" : undefined}
        tabIndex={highlightDraft ? -1 : 0}
        onKeyDown={(event) => {
          if ((!onPageTap && !onCenterTap) || event.target !== event.currentTarget) return
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            if (onPageTap) onPageTap()
            else onCenterTap?.()
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onContextMenu={handleContextMenu}
        onClick={(event) => {
          const target = event.target as HTMLElement
          if (suppressNextClickRef.current) {
            suppressNextClickRef.current = false
            return
          }
          const wordPosition = Number(target.closest<HTMLElement>("[data-word-position]")?.dataset.wordPosition)
          const wordVerseKey = target.closest<HTMLElement>("[data-verse-key]")?.dataset.verseKey
          if (highlightDraft && wordVerseKey === highlightDraft.verseKey && wordPosition > 0) {
            onHighlightPositionSelect?.(wordPosition)
            return
          }
          if (onPageTap) {
            onPageTap()
            return
          }
          if (onCenterTap && isCenterTap(event.currentTarget, event.clientX, event.clientY)) {
            onCenterTap()
          }
        }}
        onCopy={(event) => {
          event.preventDefault()
          event.clipboardData.setData("text/plain", copyText)
          onUnicodeCopy?.(copyText)
        }}
      >
        {!hidePageIdentity && pageIdentityVerse && (
          <div className={cn(
            "sticky top-0 z-[2] flex items-center justify-between gap-3 border-b bg-[var(--mushaf-paper)] px-3 py-2 text-xs font-semibold text-[var(--mushaf-meta)] backdrop-blur sm:px-5",
            pageIdentityGap && "mb-3 sm:mb-5",
          )}>
            <span>الجزء {pageIdentityVerse.juzNumber} · الحزب {pageIdentityVerse.hizbNumber}</span>
            <span className="truncate">سورة {pageIdentityVerse.chapterName}</span>
          </div>
        )}
        <div
          className={cn(
            "font-quran px-4 py-5 text-right sm:px-10 sm:py-8 lg:px-14",
            lineSpacing === "normal" && "leading-[2.15] sm:leading-[2.05]",
            lineSpacing === "comfortable" && "leading-[2.38] sm:leading-[2.28]",
            lineSpacing === "spacious" && "leading-[2.62] sm:leading-[2.5]",
          )}
          style={{ fontSize: `${largeTextSize}px` }}
          translate="no"
        >
          {displayedVerses.map((verse) => {
            const isCurrent = verse.verseKey === activeVerseKey
            const isSelected = verse.verseKey === selectedVerseKey
            const showChapterHeading = verse.verseNumber === 1 && !hidePageIdentity
            const textWords = verse.text.split(/\s+/)
            return (
              <Fragment key={verse.verseKey}>
                {showChapterHeading && (
                  <>
                    <div className="my-5 flex min-h-12 w-full items-center justify-center overflow-hidden" aria-label={`سورة ${verse.chapterName}`}>
                      {surahNameFontReady ? (
                        <DecoratedSurahName chapterId={verse.chapterId} className="text-[68px]" />
                      ) : (
                        <span className="font-sans text-[0.62em] font-semibold text-[var(--mushaf-meta)] opacity-80">
                          سورة {verse.chapterName}
                        </span>
                      )}
                    </div>
                    {verse.chapterId !== 1 && verse.chapterId !== 9 && (
                      <p className="my-4 text-center text-[0.82em]">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
                    )}
                  </>
                )}
                <span
                  data-verse-key={verse.verseKey}
                  className={cn(
                    "scroll-mt-24 transition-colors",
                    isCurrent && "text-[var(--quran-active)] [text-shadow:0_0_0.22rem_color-mix(in_oklab,var(--quran-active)_25%,transparent)]",
                    isSelected && !isCurrent && "text-primary/75",
                    verse.isChapterEnd && "inline-block pb-[0.42em]",
                  )}
                >
                  {textWords.map((word, index) => {
                    const position = index + 1
                    const stored = isStoredHighlight(verse.verseKey, position)
                    const draft = isDraftHighlight(verse.verseKey, position)
                    const isProgressiveWord = progressiveReveal?.verseKey === verse.verseKey
                    const isProgressiveHidden = isProgressiveWord &&
                      position > progressiveReveal.visibleWordPosition
                    const isProgressiveTarget = isProgressiveWord &&
                      position === progressiveReveal.visibleWordPosition
                    return (
                      <Fragment key={`${verse.verseKey}-${position}`}>
                        <span
                          data-verse-key={verse.verseKey}
                          data-word-position={position}
                          className={cn(
                            "inline transition-opacity ease-linear",
                            stored && "text-[var(--quran-highlight)] [text-shadow:0_0_0.28rem_color-mix(in_oklab,var(--quran-highlight)_40%,transparent)]",
                            draft && "relative z-[3] text-[var(--quran-highlight)] [text-shadow:0_0_0.48rem_color-mix(in_oklab,var(--quran-highlight)_65%,transparent)]",
                            isProgressiveHidden && "opacity-0",
                          )}
                          style={isProgressiveHidden
                            ? { transitionDuration: "0ms" }
                            : isProgressiveTarget
                              ? { transitionDuration: `${progressiveReveal.transitionDurationMs}ms` }
                              : undefined}
                          aria-hidden={isProgressiveHidden || undefined}
                        >
                          {word}
                          {draft && draftStartPosition === position && renderHighlightHandle("start", position)}
                          {draft && draftEndPosition === position && renderHighlightHandle("end", position)}
                        </span>
                        {index < textWords.length - 1 ? " " : " "}
                      </Fragment>
                    )
                  })}

                </span>
                {verse.isChapterEnd && <span className="block h-[0.38em]" aria-hidden="true" />}
              </Fragment>
            )
          })}
        </div>
        <div
          className={cn(
            "font-sans absolute bottom-2 bg-[var(--mushaf-paper)] px-1 text-xs font-bold tabular-nums text-[var(--mushaf-meta)]",
            page % 2 === 1 ? "right-3" : "left-3",
          )}
        >
          {page}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={pageRef}
      className={cn(
        "@container relative overflow-hidden rounded-none border-y border-[var(--mushaf-border)] bg-[var(--mushaf-paper)] text-[var(--mushaf-ink)] sm:rounded-[0.35cqw] sm:border",
        fluidPageAspect
          ? "aspect-auto"
          : standardPageAspect ? "aspect-[672/958]" : "aspect-[672/1080]",
        onPageTap && "cursor-pointer",
        className,
      )}
      data-quran-text-page
      aria-busy={showLoader}
      aria-label={`صفحة ${page} من المصحف الشريف`}
      role={!highlightDraft && (onPageTap || onCenterTap) ? "button" : undefined}
      tabIndex={highlightDraft ? -1 : 0}
      onKeyDown={(event) => {
        if ((!onPageTap && !onCenterTap) || event.target !== event.currentTarget) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          if (onPageTap) onPageTap()
          else onCenterTap?.()
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onContextMenu={handleContextMenu}
      onClick={(event) => {
        const target = event.target as HTMLElement
        if (target.closest("button")) return
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false
          return
        }
        const wordPosition = Number(target.closest<HTMLElement>("[data-word-position]")?.dataset.wordPosition)
        const wordVerseKey = target.closest<HTMLElement>("[data-verse-key]")?.dataset.verseKey
        if (highlightDraft && wordVerseKey === highlightDraft.verseKey && wordPosition > 0) {
          onHighlightPositionSelect?.(wordPosition)
          return
        }
        if (onPageTap) {
          onPageTap()
          return
        }
        if (onCenterTap && isCenterTap(event.currentTarget, event.clientX, event.clientY)) {
          onCenterTap()
        }
      }}
      onCopy={(event) => {
        event.preventDefault()
        event.clipboardData.setData("text/plain", copyText)
        onUnicodeCopy?.(copyText)
      }}
    >
      <span className="sr-only">{accessibleText}</span>
      {!hidePageNumber && (
        <div
          className={cn(
            "font-sans pointer-events-none absolute z-[2] bg-[var(--mushaf-paper)] px-1 text-[11px] font-bold leading-none tabular-nums text-[var(--mushaf-meta)] sm:text-[12px]",
            page > 2 && lineSpacing === "normal" && "bottom-[0.65cqw]",
            page > 2 && lineSpacing === "comfortable" && "bottom-[0.4cqw]",
            page > 2 && lineSpacing === "spacious" && "bottom-[0.2cqw]",
            page <= 2 && "bottom-[0.65cqw]",
            page % 2 === 1
              ? "right-[var(--qcf-text-inset,2.8cqw)]"
              : "left-[var(--qcf-text-inset,2.8cqw)]",
          )}
          aria-label={`رقم الصفحة ${page}`}
          data-qcf-page-number
        >
          {page}
        </div>
      )}
      {pageIdentityVerse && !hidePageIdentity && (
        <div
          className={cn(
            "font-sans pointer-events-none flex items-center justify-between gap-3 text-[9px] font-semibold text-[var(--mushaf-meta)] sm:text-[10px]",
            floatingPageIdentity
              ? "fixed top-[max(0.75rem,env(safe-area-inset-top))] right-12 left-12 z-30 h-6 bg-[var(--mushaf-paper)] px-2"
              : cn(
                  "absolute inset-x-[var(--qcf-text-inset,2.8cqw)] z-[1]",
                  page > 2 && lineSpacing === "normal" && "top-[0.9cqw]",
                  page > 2 && lineSpacing === "comfortable" && "top-[0.55cqw]",
                  page > 2 && lineSpacing === "spacious" && "top-[0.25cqw]",
                  page <= 2 && "top-[0.9cqw]",
                ),
          )}
        >
          <span className="flex shrink-0 items-center gap-1" data-qcf-page-identity>
            <span>
              الجزء {pageIdentityVerse.juzNumber}
              {pageIdentityVerse.hizbNumber ? ` · الحزب ${pageIdentityVerse.hizbNumber}` : ""}
            </span>
            {pageIdentityVerse.hizbNumber > 0 && pageIdentityVerse.rubAlHizbNumber > 0 && (
              <HizbQuarterIndicator
                hizbNumber={pageIdentityVerse.hizbNumber}
                rubAlHizbNumber={pageIdentityVerse.rubAlHizbNumber}
              />
            )}
          </span>
          <span className="min-w-0 truncate" data-qcf-page-identity>سورة {pageIdentityVerse.chapterName}</span>
        </div>
      )}
      {showLoader && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[var(--mushaf-paper)]">
          <LoaderCircle className="size-7 animate-spin text-primary" />
        </div>
      )}
      {fontState === "error" && !isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--mushaf-paper)] px-6 text-center text-sm">
          <p>تعذر تحميل خط المصحف.</p>
          <Button variant="outline" size="sm" onClick={() => setFontRetryKey((key) => key + 1)}>
            <RefreshCw />
            إعادة تحميل الخط
          </Button>
        </div>
      )}
      {qcfPage && fontState === "ready" && (
        <div
          className={cn(
            "relative h-full [text-rendering:optimizeLegibility]",
            standardPageAspect ? "px-0 sm:px-[1.3cqw]" : "px-0",
            page > 2 && (lineSpacing === "normal"
              ? cn(
                  "grid pb-[5.4cqw]",
                  reserveTopChrome === "fullscreen" ? "pt-[max(7.2cqw,2.75rem)]" : "pt-[7.2cqw]",
                )
              : lineSpacing === "comfortable"
                ? cn(
                    "grid",
                    reserveTopChrome === "fullscreen"
                      ? "pt-[max(6cqw,2.75rem)]"
                      : reserveTopChrome === "page" ? "pt-[max(4.5cqw,1.85rem)]" : "pt-[max(2cqw,0.8rem)]",
                    hidePageNumber ? "pb-[max(1.2cqw,0.6rem)]" : "pb-[max(3cqw,1.65rem)]",
                  )
                : cn(
                    "flex flex-col justify-between",
                    reserveTopChrome === "fullscreen"
                      ? "pt-[max(5cqw,2.5rem)]"
                      : reserveTopChrome === "page" ? "pt-[max(3.1cqw,1.7rem)]" : "pt-[max(1cqw,0.45rem)]",
                    hidePageNumber ? "pb-[max(0.8cqw,0.4rem)]" : "pb-[max(2.6cqw,1.5rem)]",
                  )),
          )}
          style={page > 2 && lineSpacing !== "spacious"
            ? { gridTemplateRows: `repeat(${lineCount}, minmax(0, 1fr))` }
            : undefined}
          translate="no"
        >
          {qcfPage.lines.map((line) => {
            const isSurahHeader = line.glyphs.some((glyph) => glyph.type === "surah_header")
            const isBismillah = line.glyphs.some((glyph) => glyph.type === "bismillah")
            return (
              <div
                key={line.lineNumber}
                dir="rtl"
                className={cn(
                  "flex w-full min-w-0 self-center items-center justify-center gap-0 whitespace-nowrap leading-none",
                  page > 2 && lineSpacing === "spacious" && "shrink-0",
                  page <= 2
                    ? standardPageAspect
                      ? "absolute inset-x-0 h-[8cqw] -translate-y-1/2 text-[6.65cqw] sm:inset-x-[1.3cqw] sm:text-[6.05cqw]"
                      : "absolute inset-x-0 h-[8cqw] -translate-y-1/2 text-[6.65cqw]"
                    : standardPageAspect ? "text-[5.65cqw] sm:text-[5.05cqw]" : "text-[5.65cqw]",
                  isBismillah && (standardPageAspect ? "text-[6cqw] sm:text-[5.55cqw]" : "text-[6cqw]"),
                  isSurahHeader && "text-[4.25cqw]",
                  isSurahHeader && (visibleVerseKeySet === undefined || showOrnamentsWhenMasked) && "relative h-[6.8cqw] w-full self-center overflow-visible bg-transparent px-0",
                  isSurahHeader && page <= 2 && "h-[6.8cqw]",
                )}
                style={page <= 2 ? { top: `${OPENING_PAGE_LINE_POSITIONS[line.lineNumber - 1]}%` } : undefined}
                data-qcf-line={line.lineNumber}
                data-qcf-fit-line={!isSurahHeader && !isBismillah ? "" : undefined}
              >
                {line.glyphs.map((glyph, index) => {
                  const isCurrent = glyph.verseKey === activeVerseKey
                  const isSelected = glyph.verseKey === selectedVerseKey
                  const canHighlight =
                    glyph.type === "word" &&
                    Boolean(glyph.verseKey) &&
                    typeof glyph.position === "number"
                  const storedHighlight = canHighlight && isStoredHighlight(glyph.verseKey!, glyph.position!)
                  const draftHighlight = canHighlight && isDraftHighlight(glyph.verseKey!, glyph.position!)
                  const isPracticeHidden = visibleVerseKeySet !== undefined && (
                    glyph.verseKey
                      ? !visibleVerseKeySet.has(glyph.verseKey)
                      : !showOrnamentsWhenMasked
                  )
                  const isProgressiveWord = progressiveReveal?.verseKey === glyph.verseKey &&
                    typeof glyph.position === "number"
                  const isProgressiveHidden = isProgressiveWord &&
                    glyph.position! > progressiveReveal.visibleWordPosition
                  const isProgressiveTarget = isProgressiveWord &&
                    glyph.position === progressiveReveal.visibleWordPosition
                  const isMasked = isPracticeHidden || isProgressiveHidden

                  return (
                    <span
                      key={`${line.lineNumber}-${glyph.code}-${index}`}
                      className={cn(
                        "inline-block shrink-0 cursor-default select-none transition-[color,opacity,background-color,text-shadow] duration-300 ease-linear",
                        !isMasked && isCurrent && "text-[var(--quran-active)] [text-shadow:0_0_0.22rem_color-mix(in_oklab,var(--quran-active)_25%,transparent)]",
                        !isMasked && isSelected && !isCurrent && "text-primary/75",
                        !isMasked && glyph.type === "end" && "text-[var(--mushaf-meta)] opacity-[0.72]",
                        !isMasked && storedHighlight && "text-[var(--quran-highlight)] [text-shadow:0_0_0.28rem_color-mix(in_oklab,var(--quran-highlight)_40%,transparent)]",
                        !isMasked && draftHighlight && "relative z-[3] text-[var(--quran-highlight)] [text-shadow:0_0_0.48rem_color-mix(in_oklab,var(--quran-highlight)_65%,transparent)]",
                        highlightDraft?.verseKey === glyph.verseKey && canHighlight && "cursor-crosshair",
                        isMasked && "opacity-0",
                      )}
                      style={{
                        fontFamily: `"${glyph.font}"`,
                        transitionDuration: isProgressiveHidden
                          ? "0ms"
                          : isProgressiveTarget
                            ? `${progressiveReveal.transitionDurationMs}ms`
                            : undefined,
                      }}
                      data-qcf-type={glyph.type}
                      data-verse-key={glyph.verseKey}
                      data-word-position={canHighlight ? glyph.position : undefined}
                      aria-hidden="true"
                    >
                      {glyph.type === "surah_header" ? (
                        glyph.chapterId && surahNameFontReady ? (
                          <DecoratedSurahName chapterId={glyph.chapterId} className="text-[9.6cqw]" />
                        ) : (
                          <span className="font-sans inline-block font-semibold leading-none text-[var(--mushaf-meta)] opacity-80">
                            سورة {glyph.chapterId ? chapterNames.get(glyph.chapterId) : ""}
                          </span>
                        )
                      ) : glyph.type === "bismillah" ? (
                        <span className="inline-flex" dir="rtl">
                          {[...BISMILLAH_QCF_GLYPHS].map((wordGlyph) => (
                            <span key={wordGlyph} className="inline-block">{wordGlyph}</span>
                          ))}
                        </span>
                      ) : glyph.char}
                      {draftHighlight && draftStartPosition === glyph.position && renderHighlightHandle("start", glyph.position!)}
                      {draftHighlight && draftEndPosition === glyph.position && renderHighlightHandle("end", glyph.position!)}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
