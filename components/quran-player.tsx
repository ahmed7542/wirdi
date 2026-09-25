"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent, type TouchEvent, type WheelEvent as ReactWheelEvent } from "react"
import { flushSync } from "react-dom"
import { getSurahMeta, type Surah } from "quran-meta/hafs"
import {
  Bookmark,
  BookMarked,
  BookOpen,
  CalendarCheck2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Columns2,
  Copy,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileDown,
  Gauge,
  Headphones,
  Highlighter,
  Ellipsis,
  GitCompareArrows,
  LoaderCircle,
  Maximize2,
  Mic,
  Minimize2,
  Pause,
  Pencil,
  Play,
  Repeat2,
  RectangleHorizontal,
  RotateCcw,
  RotateCw,
  Search,
  Settings,
  Settings2,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
  Star,
  TimerOff,
  Trash2,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react"
import { toast } from "sonner"

import {
  AppSettings,
  type AppTextScale,
  type AppSettingsTab,
  type AudioReviewRevealMode,
  type DownloadReciter,
  type SearchGestureDirection,
} from "@/components/app-settings"
import { useInterfaceLanguage, type InterfaceLanguage } from "@/components/interface-language-provider"
import { KhatmaPlanner } from "@/components/khatma-planner"
import { LearningPlanDialog, type LearningPlanRange } from "@/components/learning-plan"
import {
  MutashabihatFollowingContext,
  type MutashabihatContextVerse,
} from "@/components/mutashabihat-following-context"
import {
  QuranNavigation,
  QuranSessionRangePicker,
  type BrowseActivity,
  type NavigationRange,
} from "@/components/quran-navigation"
import { SessionRangeDownload } from "@/components/session-range-download"
import {
  WirdDashboard,
  type DashboardBookmark,
  type DashboardReviewDetail,
} from "@/components/wird-dashboard"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  getQcf4FontUrl,
  HizbQuarterIndicator,
  preloadQcf4PageFonts,
  QPC_HAFS_FONT_URL,
  QuranTextPage,
  SURAH_NAME_FONT_URL,
  type HighlightCategory,
  type HighlightDraft,
  type HighlightEdge,
  type Qcf4Page,
  type QuranVerse,
  type LineSpacing,
  type ReadingMode,
  type VerseHighlight,
} from "@/components/quran-page"
import { loadLastReading, saveLastReading } from "@/lib/last-reading"
import { saveRecentReadingLocation } from "@/lib/recent-reading"
import {
  readKhatmaPlan,
  saveKhatmaPlan,
} from "@/lib/khatma-plan"
import { addLearningPlanProgress, type LearningPlanType } from "@/lib/learning-plan"
import { OFFLINE_PAGE_CACHE } from "@/lib/offline-audio"
import { downloadOfflineQuran, loadOfflineQuranPage, loadOfflineQuranReadingPage } from "@/lib/offline-quran"
import { loadQuranNavigation } from "@/lib/offline-quran-navigation"
import { searchOfflineQuran } from "@/lib/offline-quran-search"
import {
  isQuranSearchQueryReady,
  isStructuralQuranSearch,
  searchQuranNavigationLocally,
  type QuranSearchNavigationData,
} from "@/lib/quran-smart-search"
import {
  downloadOfflineTafsir,
  inspectOfflineTafsir,
  OFFLINE_TAFSIR_PROGRESS_EVENT,
  readOfflineTafsir,
  storeOfflineTafsirVerse,
  type OfflineTafsirStatus,
  type TafsirResponse,
} from "@/lib/offline-tafsir"
import {
  findOfflineMutashabihat,
  inspectOfflineMutashabihat,
  prepareOfflineMutashabihat,
  storeExactMutashabihat,
} from "@/lib/offline-mutashabihat"
import {
  DEFAULT_BOOKMARK_CATEGORIES,
  loadBookmarkCategories,
  saveBookmarkCategories,
  type BookmarkCategory,
} from "@/lib/bookmark-categories"
import { rankQuranSearchResults } from "@/lib/quran-search-ranking"
import { sanitizeQuranSearchText } from "@/lib/quran-search-text"
import { cn } from "@/lib/utils"
import {
  countReviewsForDate,
  getDueReviews,
  loadVerseHighlights,
  recordReviewOutcome,
  saveVerseHighlights,
  scheduleHighlight,
} from "@/lib/wird-review"
import {
  addReadingTime,
  completeSessionHistory,
  deleteSavedSession,
  incrementCompletedSessions,
  loadSavedSessions,
  loadSessionHistory,
  saveSavedSession,
  upsertSessionHistory,
  type SavedSessionPreset,
  type SessionHistoryItem,
  type WirdMutashabihatType,
  type WirdSessionMode,
  type WirdTestKind,
} from "@/lib/wird-activity"

type AudioTrack = {
  chapterId: number
  audioUrl: string
  startMs: number
  endMs: number
  firstVerseIndex: number
  lastVerseIndex: number
  timingMode?: "exact" | "approximate" | "verse" | "bismillah" | "chapter" | "page"
  previousPage?: number
  advanceToPage?: number
}

type LoadedPage = {
  page: number
  reciter?: number
  verses: QuranVerse[]
  tracks: AudioTrack[]
  qcfPage?: Qcf4Page
  recitationSync?: "verse" | "chapter" | "page"
}

type PageResponse = LoadedPage & {
  error?: string
}

export type ViewMode = "image" | "text"
type MobileWorkspaceTab = "browse" | "khatma" | "marks"
type ScreenOrientationLock =
  | "portrait"
  | "landscape"
  | "portrait-primary"
  | "portrait-secondary"
  | "landscape-primary"
  | "landscape-secondary"
type LockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: ScreenOrientationLock) => Promise<void>
  unlock?: () => void
}
type ScreenWakeLock = {
  request: (type: "screen") => Promise<{ released: boolean; release: () => Promise<void> }>
}
type SpreadMode = "single" | "double"
type PageSwipeDirection = -1 | 0 | 1
type PhysicalOrientation = "portrait" | "landscape"
type PendingPlaybackScope = { page: number; reciter: number }
type AudioReviewState = {
  page: number
  revealIndex: number
  visibleWordPosition?: number
  wordTransitionDurationMs?: number
  transitionPlaybackRate?: number
}
type SessionMode = WirdSessionMode
type PlaybackStopMode = "off" | "10m" | "20m" | "30m" | "60m" | "page" | "surah" | "session"

const MUTASHABIHAT_TEST_TYPE_OPTIONS: Array<{ value: WirdMutashabihatType; label: string }> = [
  { value: "identical", label: "التطابق التام" },
  { value: "similar", label: "المتشابهة العالية" },
  { value: "beginning", label: "فواتح الآيات" },
  { value: "ending", label: "خواتم الآيات" },
]

function normalizeMutashabihatTypes(value: unknown): WirdMutashabihatType[] {
  if (!Array.isArray(value)) return ["identical", "similar"]
  const types = value.filter((item): item is WirdMutashabihatType =>
    item === "identical" || item === "similar" || item === "beginning" || item === "ending",
  )
  return types.length > 0 ? [...new Set(types)] : ["identical", "similar"]
}

type MutashabihatSegment = {
  text: string
  highlighted: boolean
}

type MutashabihatVerse = MutashabihatContextVerse & {
  kind?: WirdMutashabihatType
  similarity: number
  sharedWords: number
  segments: MutashabihatSegment[]
  sourceSegments: MutashabihatSegment[]
  followingVerses?: MutashabihatContextVerse[]
  hasMoreFollowing?: boolean
}

type MutashabihatTestVerse = {
  verseKey: string
  surah: number
  ayah: number
  surahName: string
  page: number
  text: string
  similarCount: number
  matchingTypes?: WirdMutashabihatType[]
}

function shuffleMutashabihatCandidates(candidates: MutashabihatTestVerse[]) {
  const shuffled = [...candidates]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    const candidate = shuffled[index]
    shuffled[index] = shuffled[swapIndex]
    shuffled[swapIndex] = candidate
  }
  return shuffled
}

function moveMutashabihatCandidateToFront(candidates: MutashabihatTestVerse[], verseKey?: string) {
  if (!verseKey) return candidates
  const targetIndex = candidates.findIndex((candidate) => candidate.verseKey === verseKey)
  if (targetIndex <= 0) return candidates
  const reordered = [...candidates]
  const firstCandidate = reordered[0]
  reordered[0] = reordered[targetIndex]
  reordered[targetIndex] = firstCandidate
  return reordered
}

async function requestMutashabihatTestCandidates(
  range: Pick<NavigationRange, "startPage" | "endPage" | "startVerseKey" | "endVerseKey">,
  types: WirdMutashabihatType[],
) {
  const params = new URLSearchParams({
    mode: "range",
    startPage: String(range.startPage),
    endPage: String(range.endPage),
    types: types.join(","),
  })
  if (range.startVerseKey) params.set("startVerseKey", range.startVerseKey)
  if (range.endVerseKey) params.set("endVerseKey", range.endVerseKey)
  const response = await fetch(`/api/quran/mutashabihat?${params.toString()}`)
  const data = (await response.json()) as { verses?: MutashabihatTestVerse[]; error?: string }
  if (!response.ok) throw new Error(data.error || "تعذر تجهيز اختبار المتشابهات")
  return data.verses ?? []
}

type MutashabihatResponse = {
  verseKey: string
  source: (MutashabihatContextVerse & {
    followingVerses?: MutashabihatContextVerse[]
    hasMoreFollowing?: boolean
  }) | null
  similar: MutashabihatVerse[]
  categoryCounts?: Record<WirdMutashabihatType, number>
  selectedTypes?: WirdMutashabihatType[]
  totalSimilar?: number
  methodology?: "similar" | "local"
  offline?: boolean
  cached?: boolean
  attribution?: { name: string; url: string }
  error?: string
}

type TafsirTarget = {
  verseKey: string
  chapterId: number
  chapterName: string
  ayah: number
  text: string
  page?: number
}

type ReadingReturnLocation = {
  page: number
  verseKey?: string
}

type QuickNavigationData = QuranSearchNavigationData

type QuickNavigatorResult = {
  id?: string
  kind?: "verse" | "surah" | "juz" | "hizb" | "page"
  verseKey: string
  surahName: string
  ayah: number
  text: string
  page: number
  title?: string
}

type QuickNavigatorBrowseTab = "nearby" | "surahs" | "juzs" | "hizbs" | "pages"

type SearchTextSegment = {
  text: string
  highlighted: boolean
}

function normalizeSearchCharacter(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
}

function localQuickNavigationSearch(
  data: QuickNavigationData | null,
  query: string,
  language: InterfaceLanguage,
): QuickNavigatorResult[] {
  if (!data) return []
  return searchQuranNavigationLocally(data, query, language).map((result) => {
    const [chapterId, ayah] = result.startVerseKey.split(":").map(Number)
    const chapter = data.chapters.find((item) => item.id === chapterId)
    return {
      id: result.id,
      kind: result.kind,
      verseKey: result.startVerseKey,
      surahName: chapter?.name ?? "",
      ayah: Number.isInteger(ayah) ? ayah : 1,
      text: result.text ?? result.detail,
      page: result.startPage,
      title: result.title,
    }
  })
}

function searchTextSegments(text: string, query: string): SearchTextSegment[] {
  const cleanedText = sanitizeQuranSearchText(text)
  const cleanedQuery = sanitizeQuranSearchText(query)
    .replace(/^(?:سورة|سوره|الجزء|جزء|الحزب|حزب)\s+/i, "")
    .trim()
  if (!cleanedText || !cleanedQuery || /^\d+\s*[:：]\s*\d+$/.test(cleanedQuery)) {
    return [{ text: cleanedText, highlighted: false }]
  }

  let normalizedText = ""
  const sourceIndexes: number[] = []
  Array.from(cleanedText).forEach((character, sourceIndex) => {
    const normalizedCharacter = normalizeSearchCharacter(character)
    Array.from(normalizedCharacter).forEach((item) => {
      normalizedText += item
      sourceIndexes.push(sourceIndex)
    })
  })
  const normalizedQuery = normalizeSearchCharacter(cleanedQuery)
  const matchIndex = normalizedText.indexOf(normalizedQuery)
  if (matchIndex < 0 || !normalizedQuery) return [{ text: cleanedText, highlighted: false }]
  const matchStart = sourceIndexes[matchIndex]
  const matchEnd = (sourceIndexes[matchIndex + normalizedQuery.length - 1] ?? matchStart) + 1
  return [
    { text: cleanedText.slice(0, matchStart), highlighted: false },
    { text: cleanedText.slice(matchStart, matchEnd), highlighted: true },
    { text: cleanedText.slice(matchEnd), highlighted: false },
  ].filter((segment) => segment.text)
}

type SessionSummary = {
  durationSeconds: number
  pages: number
  troubledVerses: number
  tomorrowReviews: number
}

export type BookmarkItem = {
  id: string
  page: number
  verseKey: string
  chapterId: number
  chapterName?: string
  category?: string
  positionMs: number
  reciter: number
  createdAt: number
}

function getBookmarkCategoryLabel(categories: BookmarkCategory[], categoryId?: string) {
  return categories.find((category) => category.id === categoryId)?.label
}

function getBookmarkChapterName(chapterId: number, chapterName?: string) {
  if (chapterName) return chapterName
  if (Number.isInteger(chapterId) && chapterId >= 1 && chapterId <= 114) {
    return getSurahMeta(chapterId as Surah).name
  }
  return String(chapterId)
}

const RECITERS = [
  { id: 6, name: "محمود خليل الحصري", detail: "مرتل" },
  { id: 12, name: "محمود خليل الحصري", detail: "المعلم" },
  { id: 7, name: "مشاري راشد العفاسي", detail: "مرتل" },
  { id: 9, name: "محمد صديق المنشاوي", detail: "مرتل" },
  { id: 8, name: "محمد صديق المنشاوي", detail: "مجود · آية بآية" },
  { id: 88, name: "مصطفى إسماعيل", detail: "مجود" },
  { id: 91, name: "محمد محمود الطبلاوي", detail: "مجود" },
  { id: 2, name: "عبد الباسط عبد الصمد", detail: "مرتل" },
  { id: 1, name: "عبد الباسط عبد الصمد", detail: "مجود" },
  { id: 3, name: "عبد الرحمن السديس", detail: "مرتل" },
  { id: 10, name: "سعود الشريم", detail: "مرتل سريع" },
  { id: 11, name: "عبد المحسن القاسم", detail: "مرتل سريع" },
  { id: 43, name: "صلاح البدير", detail: "مرتل سريع" },
  { id: 4, name: "أبو بكر الشاطري", detail: "مرتل" },
  { id: 5, name: "هاني الرفاعي", detail: "مرتل" },
  { id: 13, name: "سعد الغامدي", detail: "مرتل" },
  { id: 14, name: "فارس عباد", detail: "مرتل" },
  { id: 97, name: "ياسر الدوسري", detail: "مرتل" },
  { id: 104, name: "ناصر القطامي", detail: "مرتل" },
  { id: 17, name: "سهل ياسين", detail: "مرتل" },
  { id: 18, name: "صلاح بو خاطر", detail: "مرتل" },
  { id: 19, name: "أحمد بن علي العجمي", detail: "مرتل" },
  { id: 22, name: "محمد أيوب", detail: "مرتل" },
  { id: 109, name: "عبدالرشيد صوفي", detail: "حفص" },
  { id: 1001, name: "محمود علي البنا", detail: "مرتل" },
  { id: 1002, name: "علي بن عبدالرحمن الحذيفي", detail: "مرتل · آية بآية" },
  { id: 2001, name: "أحمد ديبان", detail: "مصحف الحدر · مزامنة بالسورة", syncScope: "chapter" },
  { id: 2002, name: "ياسر سلامة", detail: "مصحف الحدر · مزامنة بالصفحة", syncScope: "page" },
] as const

const CHAPTER_DOWNLOAD_UNSUPPORTED_RECITERS = new Set([8, 22, 1001, 1002, 2002])
const DOWNLOAD_RECITERS: readonly DownloadReciter[] = RECITERS
  .filter((item) => !CHAPTER_DOWNLOAD_UNSUPPORTED_RECITERS.has(item.id))
  .map(({ id, name, detail }) => ({ id, name, detail }))

const AHMED_DEBAN_RECITER_ID = 2001
const YASSER_SALAMA_RECITER_ID = 2002
const COARSE_SYNC_RECITER_IDS = new Set([AHMED_DEBAN_RECITER_ID, YASSER_SALAMA_RECITER_ID])
const MAX_PAGE = 604
const KHATMA_REMINDER_PROMPT_TIMEOUT_MS = 10_000
const MIN_SPEED = 0.5
const SLIDER_MAX_SPEED = 3
const EXTENDED_MIN_SPEED = 3.25
const MAX_SPEED = 10
const CONTINUOUS_SCROLL_MIN_SPEED = 0.05
const CONTINUOUS_SCROLL_MAX_SPEED = 3
const CONTINUOUS_SCROLL_SPEED_STEP = 0.05
const CONTINUOUS_SCROLL_SPEED_PRESETS = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3] as const
const READING_PAGE_RETRY_DELAYS_MS = [120, 300, 700] as const
const SPEED_LONG_PRESS_MS = 480
const PAGE_SWIPE_SETTLE_MS = 220
const FULLSCREEN_ORIENTATION_CONTROL_MS = 4_500
const RECITER_STORAGE_KEY = "wird-reciter"
const FAVORITES_STORAGE_KEY = "wird-favorite-reciters"
const SETTINGS_STORAGE_KEY = "wird-player-settings"
const BOOKMARKS_STORAGE_KEY = "wird-bookmarks"

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.round(value || min), min), max)
}

function normalizeRepeatTarget(value?: string) {
  const count = Number(value)
  return String(Number.isInteger(count) ? clamp(count, 1, 99) : 3)
}

function normalizeContinuousScrollSpeed(value: number) {
  const bounded = Math.min(Math.max(value || CONTINUOUS_SCROLL_MIN_SPEED, CONTINUOUS_SCROLL_MIN_SPEED), CONTINUOUS_SCROLL_MAX_SPEED)
  return Math.round(bounded / CONTINUOUS_SCROLL_SPEED_STEP) * CONTINUOUS_SCROLL_SPEED_STEP
}

function formatContinuousScrollSpeed(value: number) {
  return value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
}

function getVisibleContinuousLocation(container: HTMLElement) {
  const containerRect = container.getBoundingClientRect()
  const readerBar = container.querySelector<HTMLElement>("[data-continuous-reader-bar]")
  const readingLine = Math.min(
    containerRect.bottom - 1,
    Math.max(containerRect.top + 1, readerBar?.getBoundingClientRect().bottom ?? containerRect.top + 32),
  )
  const pages = [...container.querySelectorAll<HTMLElement>("[data-large-reading-page]")]
    .map((element) => ({
      element,
      page: Number(element.dataset.largeReadingPage),
      rect: element.getBoundingClientRect(),
    }))
    .filter((item) => item.page > 0)
  const pageLocation = pages.find((item) => item.rect.top <= readingLine && item.rect.bottom > readingLine)
    ?? pages.sort((first, second) => {
      const firstDistance = readingLine < first.rect.top
        ? first.rect.top - readingLine
        : Math.max(0, readingLine - first.rect.bottom)
      const secondDistance = readingLine < second.rect.top
        ? second.rect.top - readingLine
        : Math.max(0, readingLine - second.rect.bottom)
      return firstDistance - secondDistance
    })[0]
  if (!pageLocation) return undefined

  const qcfLines = [...pageLocation.element.querySelectorAll<HTMLElement>("[data-qcf-line]")]
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter((line) => line.rect.width > 0 || line.rect.height > 0)
    .sort((first, second) => first.rect.top - second.rect.top)
  if (qcfLines.length > 0) {
    const nextLineIndex = qcfLines.findIndex((line) => line.rect.bottom > readingLine)
    const lineIndex = nextLineIndex === -1 ? qcfLines.length - 1 : nextLineIndex
    const visibleVerseKey = qcfLines.slice(lineIndex)
      .map((line) => line.element.querySelector<HTMLElement>("[data-verse-key]")?.dataset.verseKey)
      .find(Boolean)
      ?? qcfLines.slice(0, lineIndex).reverse()
        .map((line) => line.element.querySelector<HTMLElement>("[data-verse-key]")?.dataset.verseKey)
        .find(Boolean)
    return { page: pageLocation.page, verseKey: visibleVerseKey }
  }

  const verseBounds = new Map<string, { verseKey: string; top: number; bottom: number }>()
  pageLocation.element.querySelectorAll<HTMLElement>("[data-verse-key]").forEach((element) => {
    const verseKey = element.dataset.verseKey
    if (!verseKey) return
    const rect = element.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return
    const existing = verseBounds.get(verseKey)
    if (existing) {
      existing.top = Math.min(existing.top, rect.top)
      existing.bottom = Math.max(existing.bottom, rect.bottom)
    } else {
      verseBounds.set(verseKey, { verseKey, top: rect.top, bottom: rect.bottom })
    }
  })
  const verses = [...verseBounds.values()].sort((first, second) => first.top - second.top)
  const visibleVerse = verses.find((verse) => verse.top <= readingLine && verse.bottom > readingLine)
    ?? verses.find((verse) => verse.bottom > readingLine)
    ?? verses.at(-1)
  return { page: pageLocation.page, verseKey: visibleVerse?.verseKey }
}

function validatePageResponse(data: PageResponse, requestedPage: number) {
  if (data.page !== requestedPage || data.verses.length === 0) {
    throw new Error(`بيانات صفحة المصحف لا تطابق الصفحة ${requestedPage}`)
  }
  let previousChapter = 0
  let previousVerse = 0
  for (const verse of data.verses) {
    const [chapter, ayah] = verse.verseKey.split(":").map(Number)
    const followsQuranOrder = chapter > previousChapter || (
      chapter === previousChapter && ayah > previousVerse
    )
    if (
      verse.pageNumber !== requestedPage ||
      !Number.isInteger(chapter) ||
      !Number.isInteger(ayah) ||
      chapter < 1 || chapter > 114 || ayah < 1 ||
      !followsQuranOrder
    ) {
      throw new Error(`ترتيب آيات صفحة ${requestedPage} غير صالح`)
    }
    previousChapter = chapter
    previousVerse = ayah
  }
  if (data.tracks.some((track) => (
    track.firstVerseIndex < 0 ||
    track.lastVerseIndex < track.firstVerseIndex ||
    track.lastVerseIndex >= data.verses.length ||
    track.endMs <= track.startMs
  ))) {
    throw new Error(`بيانات تلاوة صفحة ${requestedPage} غير متطابقة`)
  }
}

function normalizeContinuousPageSequence(pages: LoadedPage[]) {
  const byPage = new Map<number, LoadedPage>()
  pages.forEach((page) => byPage.set(page.page, page))
  const ordered = [...byPage.values()].sort((first, second) => first.page - second.page)
  if (ordered.length < 2) return ordered
  const contiguous = [ordered[0]]
  for (let index = 1; index < ordered.length; index += 1) {
    const page = ordered[index]
    if (page.page !== contiguous.at(-1)!.page + 1) break
    contiguous.push(page)
  }
  return contiguous
}

function findTrackIndexForVerse(tracks: AudioTrack[], verseIndex: number) {
  return tracks.findIndex(
    (track) =>
      track.timingMode !== "bismillah" &&
      verseIndex >= track.firstVerseIndex &&
      verseIndex <= track.lastVerseIndex,
  )
}

function findPlaybackTrackIndex(tracks: AudioTrack[], verses: QuranVerse[], verseIndex: number) {
  const verseTrackIndex = findTrackIndexForVerse(tracks, verseIndex)
  const verse = verses[verseIndex]
  if (
    verseTrackIndex > 0 &&
    verse?.verseNumber === 1 &&
    verse.chapterId !== 1 &&
    verse.chapterId !== 9 &&
    tracks[verseTrackIndex - 1]?.timingMode === "bismillah"
  ) return verseTrackIndex - 1
  return verseTrackIndex
}

function getPlaybackStartMs(track: AudioTrack | undefined, verse: QuranVerse | undefined) {
  if (!track || !verse) return track?.startMs ?? 0
  return verse.verseNumber === 1 && verse.chapterId !== 9
    ? track.startMs
    : verse.timestampFrom
}

const AUDIO_REVIEW_REVEAL_LEAD_MS = 450

function getWordRevealPlan(verse: QuranVerse, revealMs: number, playbackRate: number) {
  const spokenWords = verse.words.filter((word) => word.charType === "word")
  const spokenWordPosition = spokenWords.at(-1)?.position ?? 0
  const finalPosition = verse.words.at(-1)?.position ?? spokenWordPosition
  if (spokenWordPosition === 0) {
    return { visibleWordPosition: finalPosition, wordTransitionDurationMs: 0 }
  }

  const timingAnchors = [...(verse.wordTimings ?? [])]
    .filter((timing) => timing.position >= 1 && timing.position <= spokenWordPosition)
    .sort((first, second) => first.position - second.position)
  const durationMs = Math.max(verse.timestampTo - verse.timestampFrom, 1)
  const finishBufferMs = Math.min(Math.max(durationMs * 0.08, 300), 1_200)
  const revealDurationMs = Math.max(durationMs - finishBufferMs, 1)
  const wordStarts = spokenWords.map((word, index) => {
    if (!timingAnchors.length) {
      return verse.timestampFrom + (index / Math.max(spokenWords.length, 1)) * revealDurationMs
    }
    const exact = timingAnchors.find((timing) => timing.position === word.position)
    if (exact) return exact.startMs
    const before = timingAnchors.findLast((timing) => timing.position < word.position)
    const after = timingAnchors.find((timing) => timing.position > word.position)
    if (before && after) {
      const ratio = (word.position - before.position) / (after.position - before.position)
      return before.startMs + (after.startMs - before.startMs) * ratio
    }
    if (after) {
      const ratio = word.position / Math.max(after.position, 1)
      return verse.timestampFrom + (after.startMs - verse.timestampFrom) * ratio
    }
    if (before) {
      const remainingPositions = Math.max(spokenWordPosition + 1 - before.position, 1)
      const ratio = (word.position - before.position) / remainingPositions
      return before.startMs + (verse.timestampTo - before.startMs) * ratio
    }
    return verse.timestampFrom + (index / Math.max(spokenWords.length, 1)) * revealDurationMs
  })

  const currentWordIndex = wordStarts.findLastIndex((startMs) => startMs <= revealMs)
  const targetWordIndex = Math.min(Math.max(currentWordIndex + 1, 0), spokenWords.length - 1)
  const currentTargetIsLastWord = targetWordIndex === spokenWords.length - 1
  const targetPosition = currentWordIndex >= spokenWords.length - 1 && finalPosition > spokenWordPosition
    ? finalPosition
    : spokenWords[targetWordIndex].position
  const targetStartMs = targetPosition === finalPosition && finalPosition > spokenWordPosition
    ? verse.timestampTo
    : wordStarts[targetWordIndex]
  const remainingAudioMs = Math.max(targetStartMs - revealMs, 0)
  const transitionDurationMs = Math.min(
    1_600,
    Math.max(180, Math.round(remainingAudioMs / Math.max(playbackRate, 0.1))),
  )

  return {
    visibleWordPosition: targetPosition,
    wordTransitionDurationMs: currentTargetIsLastWord && targetPosition === spokenWordPosition
      ? Math.min(transitionDurationMs, 900)
      : transitionDurationMs,
  }
}

function findAudioReviewReveal(
  track: AudioTrack,
  verses: QuranVerse[],
  currentMs: number,
  playbackRate: number,
  revealMode: AudioReviewRevealMode,
) {
  const revealMs = currentMs + (revealMode === "progressive" ? AUDIO_REVIEW_REVEAL_LEAD_MS * playbackRate : 0)
  for (let index = track.firstVerseIndex; index <= track.lastVerseIndex; index += 1) {
    const verse = verses[index]
    if (verse && revealMs >= verse.timestampFrom && revealMs < verse.timestampTo) {
      return revealMode === "progressive"
        ? {
            revealIndex: index,
            ...getWordRevealPlan(verse, revealMs, playbackRate),
            transitionPlaybackRate: playbackRate,
          }
        : {
            revealIndex: index,
            visibleWordPosition: undefined,
            wordTransitionDurationMs: undefined,
            transitionPlaybackRate: undefined,
          }
    }
  }
  return null
}

function findSeamlessPageContinuation(
  currentTrack: AudioTrack,
  endingVerse: QuranVerse,
  currentPage: number,
  nextPage: LoadedPage | null | undefined,
  reciter: number,
) {
  if (nextPage?.page !== currentPage + 1 || nextPage.reciter !== reciter) return null
  const expectedVerseKey = adjacentVerseKey(endingVerse.verseKey, 1)
  if (!expectedVerseKey) return null
  const verseIndex = nextPage.verses.findIndex((verse) => verse.verseKey === expectedVerseKey)
  if (verseIndex < 0) return null
  const trackIndex = findTrackIndexForVerse(nextPage.tracks, verseIndex)
  const track = nextPage.tracks[trackIndex]
  const verse = nextPage.verses[verseIndex]
  if (
    !track ||
    track.audioUrl !== currentTrack.audioUrl ||
    track.chapterId !== currentTrack.chapterId ||
    track.startMs < currentTrack.endMs - 2_000 ||
    track.startMs > currentTrack.endMs + 5_000 ||
    track.endMs <= currentTrack.endMs
  ) return null
  return { page: nextPage, track, trackIndex, verse, verseIndex }
}

function clampSpeed(value: number) {
  const safeValue = Number.isFinite(value) ? value : 1
  return Math.round(Math.min(Math.max(safeValue, MIN_SPEED), MAX_SPEED) * 100) / 100
}

function syncAudioPlaybackSpeed(audio: HTMLAudioElement, speed: number) {
  audio.defaultPlaybackRate = speed
  audio.playbackRate = speed
  audio.preservesPitch = true
}

function formatNumber(value: number) {
  return String(value)
}

function sessionModeLabel(mode: WirdSessionMode) {
  return mode === "listen" ? "استماع" : mode === "recite" ? "تسميع" : "اختبار"
}

function sessionRangeLabel(session: Pick<SessionHistoryItem, "startPage" | "endPage" | "startVerseKey" | "endVerseKey">) {
  if (session.startVerseKey && session.endVerseKey) {
    return `من الآية ${session.startVerseKey} إلى الآية ${session.endVerseKey}`
  }
  return `الصفحات ${session.startPage}–${session.endPage}`
}

function releaseStaleModalPointerLock() {
  let attempts = 0
  const timer = window.setInterval(() => {
    attempts += 1
    const openModal = document.querySelector('[role="dialog"][data-state="open"], [data-slot="drawer-content"][data-state="open"]')
    if (!openModal) document.body.style.removeProperty("pointer-events")
    if (attempts >= 20) window.clearInterval(timer)
  }, 100)
}

function adjacentVerseKey(verseKey: string, direction: -1 | 1) {
  const [chapter, ayah] = verseKey.split(":").map(Number)
  if (!Number.isInteger(chapter) || !Number.isInteger(ayah) || chapter < 1 || chapter > 114) return null
  const currentMeta = getSurahMeta(chapter as Surah)
  const nextAyah = ayah + direction
  if (nextAyah >= 1 && nextAyah <= currentMeta.ayahCount) return `${chapter}:${nextAyah}`
  const nextChapter = chapter + direction
  if (nextChapter < 1 || nextChapter > 114) return null
  const nextMeta = getSurahMeta(nextChapter as Surah)
  return `${nextChapter}:${direction === 1 ? 1 : nextMeta.ayahCount}`
}

function sessionChapterRangeLabel(
  session: Pick<SessionHistoryItem, "startPage" | "endPage">,
  navigationData: QuickNavigationData | null,
) {
  const startChapter = navigationData?.chapters.find((item) =>
    session.startPage >= item.startPage && session.startPage <= item.endPage)
  const endChapter = navigationData?.chapters.find((item) =>
    session.endPage >= item.startPage && session.endPage <= item.endPage)
  if (startChapter && endChapter && startChapter.id === endChapter.id) return `سورة ${startChapter.name}`
  if (startChapter && endChapter) return `من سورة ${startChapter.name} إلى سورة ${endChapter.name}`
  return null
}

function sessionPageRangeLabel(
  session: Pick<SessionHistoryItem, "startPage" | "endPage">,
  navigationData: QuickNavigationData | null,
) {
  const chapterRange = sessionChapterRangeLabel(session, navigationData)
  const pageRange = `من صفحة ${session.startPage} إلى صفحة ${session.endPage}`
  return chapterRange ? `${chapterRange} · ${pageRange}` : pageRange
}

function offlineAudioUnavailableMessage(reciterName: string) {
  return `أنت غير متصل بالإنترنت، وتلاوة القارئ ${reciterName} غير محمّلة على هذا الجهاز للاستخدام دون اتصال.`
}

async function isAudioStoredForOffline(audioUrl: string) {
  if (!("caches" in window)) return false
  try {
    return Boolean(await window.caches.match(audioUrl))
  } catch {
    return false
  }
}

function audioPlaybackErrorMessage(error: unknown, reciterName: string, online: boolean) {
  const errorName = error && typeof error === "object" && "name" in error
    ? String(error.name)
    : ""
  if (errorName === "AbortError") return null
  if (!online) return offlineAudioUnavailableMessage(reciterName)
  if (errorName === "NotAllowedError") {
    return "منع المتصفح التشغيل التلقائي. اضغط زر التشغيل لبدء التلاوة."
  }
  if (errorName === "NotSupportedError") {
    return `تسجيل القارئ ${reciterName} غير متاح أو غير مدعوم حاليًا. اختر قارئًا آخر.`
  }
  return `تعذر تشغيل تلاوة القارئ ${reciterName} حاليًا. أعد المحاولة أو اختر قارئًا آخر.`
}

function audioSourceErrorMessage(error: MediaError | null, reciterName: string, online: boolean) {
  if (error?.code === MediaError.MEDIA_ERR_ABORTED) return null
  if (!online) return offlineAudioUnavailableMessage(reciterName)
  if (error?.code === MediaError.MEDIA_ERR_DECODE) {
    return `تعذر فك ترميز تسجيل القارئ ${reciterName} على هذا الجهاز. اختر قارئًا آخر.`
  }
  if (error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return `تسجيل القارئ ${reciterName} غير متاح من المصدر حاليًا. اختر قارئًا آخر.`
  }
  return `تعذر الوصول إلى مصدر تلاوة القارئ ${reciterName} حاليًا. أعد المحاولة أو اختر قارئًا آخر.`
}

async function copyPlainText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Embedded previews may reject Clipboard API even after a user gesture.
    }
  }

  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.inset = "0"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, text.length)
  const copied = document.execCommand("copy")
  textarea.remove()
  if (!copied) throw new Error("Copy command failed")
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00"
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, "0")}`
}

function formatSessionDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00"
  const rounded = Math.round(seconds)
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.floor((rounded % 3600) / 60)
  const remaining = rounded % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`
}

export function QuranPlayer() {
  const { language } = useInterfaceLanguage()
  const audioRef = useRef<HTMLAudioElement>(null)
  const advancingRef = useRef(false)
  const isPlayingRef = useRef(false)
  const pendingBookmarkRef = useRef<BookmarkItem | null>(null)
  const tafsirRequestRef = useRef(0)
  const pendingVerseTargetRef = useRef<string | null>(null)
  const pendingVerseEdgeRef = useRef<"first" | "last" | null>(null)
  const pendingVerseSeekMsRef = useRef<number | null>(null)
  const pendingPlaybackScopeRef = useRef<PendingPlaybackScope | null>(null)
  const seamlessAudioTransitionRef = useRef<(PendingPlaybackScope & { audioUrl: string }) | null>(null)
  const draftSessionRangeRef = useRef<NavigationRange>({ startPage: 1, endPage: 3 })
  const sessionBoundsRef = useRef<{
    start: number
    end: number
    startVerseKey?: string
    endVerseKey?: string
  }>({ start: 1, end: 3 })
  const practicePendingRef = useRef<"start" | "await-tap" | "random" | null>(null)
  const activeSessionIdRef = useRef<string | null>(null)
  const pendingResumeSessionIdRef = useRef<string | null>(null)
  const pendingLearningPlanTypeRef = useRef<LearningPlanType | undefined>(undefined)
  const activeKhatmaRangeRef = useRef<{ startPage: number; pageCount: number } | null>(null)
  const readingStartedAtRef = useRef<number | null>(null)
  const mushafStageRef = useRef<HTMLDivElement>(null)
  const headerShellRef = useRef<HTMLElement>(null)
  const playerShellRef = useRef<HTMLDivElement>(null)
  const playerCollapsedRef = useRef(false)
  const playerCollapsedBeforeFullscreenRef = useRef(false)
  const fullscreenAutoCollapseActiveRef = useRef(false)
  const currentPageExportRef = useRef<HTMLDivElement>(null)
  const chromePanelsRef = useRef({ navigation: false, session: false, marks: false })
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)
  const quickNavigatorTrackStartXRef = useRef<number | null>(null)
  const quickNavigatorTrackStartPageRef = useRef(1)
  const quickNavigatorPressedPageRef = useRef<number | null>(null)
  const quickNavigatorSuppressClickUntilRef = useRef(0)
  const quickNavigatorArrowHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const quickNavigatorArrowHeldRef = useRef(false)
  const touchStartTimeRef = useRef(0)
  const touchAxisRef = useRef<"pending" | "horizontal" | "vertical" | null>(null)
  const pageSwipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suppressPageClickUntilRef = useRef(0)
  const pageCacheRef = useRef(new Map<string, LoadedPage>())
  const largeReadingPagesRef = useRef<LoadedPage[]>([])
  const largeReadingGenerationRef = useRef(0)
  const largeReadingLoadingRef = useRef(false)
  const largeReadingRetryAtRef = useRef(0)
  const continuousPageScrollStartedRef = useRef(false)
  const continuousScrollPositionRef = useRef<number | null>(null)
  const continuousScrollPausedAtRef = useRef<number | null>(null)
  const continuousAutoScrollRef = useRef(false)
  const continuousScrollPausedRef = useRef(false)
  const continuousScrollModeRef = useRef<"free" | "recitation">("free")
  const continuousRecitationManualVerseRef = useRef<string | null>(null)
  const continuousRecitationScrollFrameRef = useRef<number | null>(null)
  const currentPageRef = useRef(1)
  const continuousVisiblePageRef = useRef<number | null>(null)
  const currentVerseKeyRef = useRef<string | null>(null)
  const continuousScrollInteractionPauseRef = useRef(false)
  const continuousScrollResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageRequestRef = useRef(new Map<string, Promise<LoadedPage>>())
  const readingPageCacheRef = useRef(new Map<number, LoadedPage>())
  const readingPageRequestRef = useRef(new Map<number, Promise<LoadedPage>>())
  const imagePageCacheRef = useRef(new Set<number>())
  const previousVolumeRef = useRef(1)
  const speedRef = useRef(1)
  const speedLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionLongPressTimerRef = useRef<number | null>(null)
  const sessionLongPressSuppressionTimerRef = useRef<number | null>(null)
  const sessionLongPressSuppressClickRef = useRef(false)
  const wheelPageLockRef = useRef(false)
  const speedClickSuppressionUntilRef = useRef(0)
  const fullscreenOrientationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fullscreenPhysicalOrientationRef = useRef<PhysicalOrientation | null>(null)
  const acceptedOrientationRef = useRef<PhysicalOrientation>("portrait")
  const lastOfferedOrientationRef = useRef<PhysicalOrientation | null>(null)
  const orientationInitializedRef = useRef(false)
  const verseRepeatKeyRef = useRef<string | null>(null)
  const verseRepeatIterationRef = useRef(0)
  const verseRepeatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wakeLockRef = useRef<{ released: boolean; release: () => Promise<void> } | null>(null)
  const audioErrorToastRef = useRef({ message: "", shownAt: 0 })
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [savedSessions, setSavedSessions] = useState<SavedSessionPreset[]>([])
  const [previousSessions, setPreviousSessions] = useState<SessionHistoryItem[]>([])
  const [savedSessionName, setSavedSessionName] = useState("")
  const [editingSavedSessionId, setEditingSavedSessionId] = useState<string | null>(null)
  const [renameSavedSessionTarget, setRenameSavedSessionTarget] = useState<SavedSessionPreset | null>(null)
  const [renameSavedSessionName, setRenameSavedSessionName] = useState("")
  const [deleteSavedSessionTarget, setDeleteSavedSessionTarget] = useState<SavedSessionPreset | null>(null)
  const [draftStart, setDraftStart] = useState(1)
  const [draftCount, setDraftCount] = useState(3)
  const [draftStartVerseKey, setDraftStartVerseKey] = useState<string | undefined>()
  const [draftEndVerseKey, setDraftEndVerseKey] = useState<string | undefined>()
  const [sessionStart, setSessionStart] = useState(1)
  const [sessionCount, setSessionCount] = useState(3)
  const [sessionStartVerseKey, setSessionStartVerseKey] = useState<string | undefined>()
  const [sessionEndVerseKey, setSessionEndVerseKey] = useState<string | undefined>()
  const [currentPage, setCurrentPage] = useState(1)
  const [reciter, setReciter] = useState(6)
  const [reciterPickerOpen, setReciterPickerOpen] = useState(false)
  const [compactReciterPickerOpen, setCompactReciterPickerOpen] = useState(false)
  const [mobileReciterPickerOpen, setMobileReciterPickerOpen] = useState(false)
  const [favoriteReciters, setFavoriteReciters] = useState<number[]>([])
  const [speed, setSpeed] = useState(1)
  const [extendedSpeedOpen, setExtendedSpeedOpen] = useState(false)
  const [volume, setVolume] = useState(1)
  const [repeatTarget, setRepeatTarget] = useState("3")
  const [completedCycles, setCompletedCycles] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>("text")
  const [centerTapFullscreen, setCenterTapFullscreen] = useState(true)
  const [searchGestureEnabled, setSearchGestureEnabled] = useState(false)
  const [searchGestureDirection, setSearchGestureDirection] = useState<SearchGestureDirection>("up")
  const [selectedVerseKey, setSelectedVerseKey] = useState<string | undefined>()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenOrientationSuggestion, setFullscreenOrientationSuggestion] = useState<PhysicalOrientation | null>(null)
  const [spreadMode, setSpreadMode] = useState<SpreadMode>("single")
  const [ayahRepeatEnabled, setAyahRepeatEnabled] = useState(false)
  const [ayahRepeatCount, setAyahRepeatCount] = useState(3)
  const [ayahPauseSeconds, setAyahPauseSeconds] = useState(1)
  const [sessionMode, setSessionMode] = useState<SessionMode>("listen")
  const [boundedSessionActive, setBoundedSessionActive] = useState(false)
  const [browseActivity, setBrowseActivity] = useState<BrowseActivity>("read")
  const [practiceActive, setPracticeActive] = useState(false)
  const [activePracticeMode, setActivePracticeMode] = useState<"recite" | "test">("recite")
  const [testKind, setTestKind] = useState<WirdTestKind>("standard")
  const [mutashabihatTestTypes, setMutashabihatTestTypes] = useState<WirdMutashabihatType[]>(["identical", "similar"])
  const [activeTestKind, setActiveTestKind] = useState<WirdTestKind>("standard")
  const [activeMutashabihatTypes, setActiveMutashabihatTypes] = useState<WirdMutashabihatType[]>(["identical", "similar"])
  const [activeMutashabihatTypePickerOpen, setActiveMutashabihatTypePickerOpen] = useState(false)
  const [activeMutashabihatTypeDraft, setActiveMutashabihatTypeDraft] = useState<WirdMutashabihatType[]>(["identical", "similar"])
  const [mutashabihatTestCandidates, setMutashabihatTestCandidates] = useState<MutashabihatTestVerse[]>([])
  const [mutashabihatTestQuestionIndex, setMutashabihatTestQuestionIndex] = useState(0)
  const [mutashabihatTestTarget, setMutashabihatTestTarget] = useState<MutashabihatTestVerse | null>(null)
  const [mutashabihatTestLoading, setMutashabihatTestLoading] = useState(false)
  const [practiceReady, setPracticeReady] = useState(false)
  const [practiceStartOffset, setPracticeStartOffset] = useState(0)
  const [practiceRevealCount, setPracticeRevealCount] = useState(1)
  const [practiceQuestionKey, setPracticeQuestionKey] = useState(0)
  const [audioReviewState, setAudioReviewState] = useState<AudioReviewState | null>(null)
  const [pageData, setPageData] = useState<LoadedPage>({ page: 0, verses: [], tracks: [] })
  const [previousPageData, setPreviousPageData] = useState<LoadedPage | null>(null)
  const [nextPageData, setNextPageData] = useState<LoadedPage | null>(null)
  const [pageSwipeOffset, setPageSwipeOffset] = useState(0)
  const [pageSwipeDirection, setPageSwipeDirection] = useState<PageSwipeDirection>(0)
  const [pageSwipeAnimating, setPageSwipeAnimating] = useState(false)
  const [largeReadingPages, setLargeReadingPages] = useState<LoadedPage[]>([])
  const [continuousVisiblePage, setContinuousVisiblePage] = useState<number | null>(null)
  const [continuousVisibleVerseKey, setContinuousVisibleVerseKey] = useState<string | null>(null)
  const [continuousAutoScroll, setContinuousAutoScroll] = useState(false)
  const [continuousScrollPaused, setContinuousScrollPaused] = useState(false)
  const [continuousScrollMode, setContinuousScrollMode] = useState<"free" | "recitation">("free")
  const [continuousScrollSpeed, setContinuousScrollSpeed] = useState(1)
  const [continuousScrollStopAt, setContinuousScrollStopAt] = useState<number | null>(null)
  const [continuousScrollTimerRemaining, setContinuousScrollTimerRemaining] = useState<number | null>(null)
  const [trackIndex, setTrackIndex] = useState(0)
  const [verseIndex, setVerseIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [audioPlaybackError, setAudioPlaybackError] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [sessionDuration, setSessionDuration] = useState<{ seconds: number; approximate: boolean } | null>(null)
  const [sessionDurationLoading, setSessionDurationLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [bookmarkCategories, setBookmarkCategories] = useState<BookmarkCategory[]>(DEFAULT_BOOKMARK_CATEGORIES)
  const [bookmarksOpen, setBookmarksOpen] = useState(false)
  const [mobileMarksOpen, setMobileMarksOpen] = useState(false)
  const [bookmarkCategoryFilter, setBookmarkCategoryFilter] = useState("all")
  const [bookmarkChapterFilter, setBookmarkChapterFilter] = useState("all")
  const [verseHighlights, setVerseHighlights] = useState<VerseHighlight[]>([])
  const [verseActionKey, setVerseActionKey] = useState<string | null>(null)
  const [verseActionPosition, setVerseActionPosition] = useState<number | null>(null)
  const [highlightDraft, setHighlightDraft] = useState<HighlightDraft | null>(null)
  const [mutashabihatOpen, setMutashabihatOpen] = useState(false)
  const [mutashabihatLoading, setMutashabihatLoading] = useState(false)
  const [mutashabihatError, setMutashabihatError] = useState<string | null>(null)
  const [mutashabihatData, setMutashabihatData] = useState<MutashabihatResponse | null>(null)
  const [tafsirOpen, setTafsirOpen] = useState(false)
  const [tafsirTarget, setTafsirTarget] = useState<TafsirTarget | null>(null)
  const [tafsirData, setTafsirData] = useState<TafsirResponse | null>(null)
  const [tafsirLoading, setTafsirLoading] = useState(false)
  const [tafsirError, setTafsirError] = useState<string | null>(null)
  const [offlineTafsirStatus, setOfflineTafsirStatus] = useState<OfflineTafsirStatus>({ completed: 0, total: 114, running: false, failed: 0 })
  const [networkOnline, setNetworkOnline] = useState(true)
  const [offerOfflineMutashabihat, setOfferOfflineMutashabihat] = useState(false)
  const [preparingOfflineMutashabihat, setPreparingOfflineMutashabihat] = useState(false)
  const [readingReturnLocation, setReadingReturnLocation] = useState<ReadingReturnLocation | null>(null)
  const [quickNavigatorOpen, setQuickNavigatorOpen] = useState(false)
  const [quickNavigatorQuery, setQuickNavigatorQuery] = useState("")
  const [quickNavigatorBrowseTab, setQuickNavigatorBrowseTab] = useState<QuickNavigatorBrowseTab>("nearby")
  const [quickNavigatorResults, setQuickNavigatorResults] = useState<QuickNavigatorResult[]>([])
  const [quickNavigatorResultCount, setQuickNavigatorResultCount] = useState(0)
  const [quickNavigationData, setQuickNavigationData] = useState<QuickNavigationData | null>(null)
  const [quickNavigatorPage, setQuickNavigatorPage] = useState(currentPage)
  const [quickNavigatorDragging, setQuickNavigatorDragging] = useState(false)
  const quickNavigatorPageRef = useRef(currentPage)
  const largeReadingScrollRef = useRef<HTMLDivElement>(null)
  const continuousScrollContentRef = useRef<HTMLDivElement>(null)
  const [offlineSaving, setOfflineSaving] = useState(false)
  const [pdfSaving, setPdfSaving] = useState(false)
  const [sessionSettingsOpen, setSessionSettingsOpen] = useState(false)
  const [appSettingsOpen, setAppSettingsOpen] = useState(false)
  const [appSettingsInitialTab, setAppSettingsInitialTab] = useState<AppSettingsTab>("reading")
  const [focusBackupSettings, setFocusBackupSettings] = useState(false)
  const [dashboardOpen, setDashboardOpen] = useState(false)
  const [khatmaReminderPrompt, setKhatmaReminderPrompt] = useState(false)
  const [khatmaOpen, setKhatmaOpen] = useState(false)
  const [khatmaMounted, setKhatmaMounted] = useState(false)
  const [learningPlanOpen, setLearningPlanOpen] = useState(false)
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null)
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [readingMode, setReadingMode] = useState<ReadingMode>("page")
  const [lineSpacing, setLineSpacing] = useState<LineSpacing>("normal")
  const [audioReviewRevealMode, setAudioReviewRevealMode] = useState<AudioReviewRevealMode>("progressive")
  const [wideReading, setWideReading] = useState(false)
  const [compactLandscape, setCompactLandscape] = useState(false)
  const [landscapeReadingMode, setLandscapeReadingMode] = useState(false)
  const [largeTextSize, setLargeTextSize] = useState(36)
  const [autoScroll, setAutoScroll] = useState(true)
  const [screenRotationLocked, setScreenRotationLocked] = useState(false)
  const [keepScreenAwake, setKeepScreenAwake] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const [largeControls, setLargeControls] = useState(false)
  const [appTextScale, setAppTextScale] = useState<AppTextScale>("normal")
  const [simplifiedPlayer, setSimplifiedPlayer] = useState(false)
  const [speechLabels, setSpeechLabels] = useState(false)
  const [playerCollapsed, setPlayerCollapsed] = useState(false)
  const [stopAtSurahEnd, setStopAtSurahEnd] = useState(false)
  const [playbackStopMode, setPlaybackStopMode] = useState<PlaybackStopMode>("off")
  const [sleepTimerEndAt, setSleepTimerEndAt] = useState<number | null>(null)
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null)
  const [quietMode, setQuietMode] = useState(false)
  const [readerChromeVisible, setReaderChromeVisible] = useState(true)

  const readerFocusActive = quietMode && !readerChromeVisible
  const landscapeFullscreenPlayer = isFullscreen && landscapeReadingMode && !practiceActive
  const fullscreenLineReading = landscapeFullscreenPlayer && viewMode === "text" && readingMode === "page"
  const adaptivePageSpacing = viewMode === "text" && readingMode === "page" && lineSpacing !== "normal"
  const fullscreenSpaciousPage = isFullscreen && adaptivePageSpacing && lineSpacing === "spacious"
  const fullscreenComfortablePage = isFullscreen && adaptivePageSpacing && lineSpacing === "comfortable"
  const lineReadingLayout = fullscreenLineReading || (wideReading && (!isFullscreen || compactLandscape))
  const continuousPageReading = viewMode === "text" && readingMode === "page" && (wideReading || landscapeReadingMode)
  const continuousPageAutoScroll = continuousAutoScroll && continuousPageReading
  const continuousRecitationFollow = continuousAutoScroll && continuousScrollMode === "recitation"
  const continuousReadingLayout = readingMode === "large" || continuousPageReading
  const compactPlaybackChrome = wideReading || compactLandscape
  const sessionEnd = Math.min(sessionStart + sessionCount - 1, MAX_PAGE)
  const draftEnd = Math.min(draftStart + draftCount - 1, MAX_PAGE)
  const verses = useMemo(
    () => pageData.page === currentPage && pageData.reciter === reciter ? pageData.verses : [],
    [currentPage, pageData, reciter],
  )
  const tracks = useMemo(
    () => pageData.page === currentPage && pageData.reciter === reciter ? pageData.tracks : [],
    [currentPage, pageData, reciter],
  )
  const currentTrack = tracks[trackIndex]
  const currentVerse = verses[verseIndex]
  const landscapePageIdentity = currentVerse ?? verses[0]
  const continuousInfoPage = continuousVisiblePage ?? currentPage
  const continuousInfoPageData = largeReadingPages.find((page) => page.page === continuousInfoPage)
  const continuousScrollIdentity = continuousInfoPageData?.verses.find(
    (verse) => verse.verseKey === continuousVisibleVerseKey,
  ) ?? continuousInfoPageData?.verses[0] ?? landscapePageIdentity
  const pageSwipePreviewData = pageSwipeDirection === 1
    ? nextPageData
    : pageSwipeDirection === -1
      ? previousPageData
      : null
  const recitationSyncScope = reciter === AHMED_DEBAN_RECITER_ID
    ? "chapter"
    : reciter === YASSER_SALAMA_RECITER_ID
      ? "page"
      : "verse"
  const hasVerseSynchronization = recitationSyncScope === "verse"
  const surahEndStopAvailable = !practiceActive &&
    !boundedSessionActive &&
    recitationSyncScope !== "page"
  const surahEndStopActive = surahEndStopAvailable && stopAtSurahEnd
  const firstSessionVerseIndex = currentPage === sessionStart && sessionStartVerseKey
    ? Math.max(verses.findIndex((verse) => verse.verseKey === sessionStartVerseKey), 0)
    : 0
  const endVerseIndex = currentPage === sessionEnd && sessionEndVerseKey
    ? verses.findIndex((verse) => verse.verseKey === sessionEndVerseKey)
    : -1
  const lastSessionVerseIndex = endVerseIndex >= 0 ? endVerseIndex : verses.length - 1
  const canGoToPreviousVerse = hasVerseSynchronization
    ? verseIndex > firstSessionVerseIndex || currentPage > sessionStart
    : trackIndex > 0 || Boolean(currentTrack?.previousPage && currentTrack.previousPage >= sessionStart)
  const canGoToNextVerse = hasVerseSynchronization
    ? verseIndex < lastSessionVerseIndex || currentPage < sessionEnd
    : trackIndex < tracks.length - 1 || Boolean(currentTrack?.advanceToPage && currentTrack.advanceToPage <= sessionEnd)
  const adjustedSessionDuration = sessionDuration ? sessionDuration.seconds / speed : null
  const selectedReciter = RECITERS.find((item) => item.id === reciter) ?? RECITERS[0]
  const currentModeSavedSessions = useMemo(
    () => savedSessions.filter((session) => session.mode === sessionMode),
    [savedSessions, sessionMode],
  )
  const showAudioError = useCallback((message: string | null) => {
    if (!message) return
    const now = Date.now()
    if (audioErrorToastRef.current.message === message && now - audioErrorToastRef.current.shownAt < 2_500) return
    audioErrorToastRef.current = { message, shownAt: now }
    setAudioPlaybackError(message)
  }, [])
  const reportAudioPlaybackFailure = useCallback((error: unknown) => {
    const message = audioPlaybackErrorMessage(error, selectedReciter.name, navigator.onLine)
    if (!message) return
    isPlayingRef.current = false
    setIsPlaying(false)
    showAudioError(message)
  }, [selectedReciter.name, showAudioError])
  const reportAudioSourceFailure = useCallback((audio: HTMLAudioElement) => {
    const message = audioSourceErrorMessage(audio.error, selectedReciter.name, navigator.onLine)
    if (!message) return
    isPlayingRef.current = false
    setIsPlaying(false)
    showAudioError(message)
  }, [selectedReciter.name, showAudioError])
  const startPlayback = useCallback(() => {
    if (!currentTrack && navigator.onLine === false) {
      isPlayingRef.current = false
      setIsPlaying(false)
      showAudioError(offlineAudioUnavailableMessage(selectedReciter.name))
      return
    }
    if (continuousAutoScroll && hasVerseSynchronization) {
      continuousScrollModeRef.current = "recitation"
      continuousRecitationManualVerseRef.current = null
      continuousScrollPausedRef.current = false
      setContinuousScrollStopAt(null)
      setContinuousScrollTimerRemaining(null)
      setContinuousScrollMode("recitation")
      setContinuousScrollPaused(false)
    }
    isPlayingRef.current = true
    setIsPlaying(true)
  }, [continuousAutoScroll, currentTrack, hasVerseSynchronization, selectedReciter.name, showAudioError])
  const togglePlayback = useCallback(async () => {
    if (isPlaying) {
      isPlayingRef.current = false
      setIsPlaying(false)
      return
    }
    if (!currentTrack) {
      if (navigator.onLine === false) {
        showAudioError(offlineAudioUnavailableMessage(selectedReciter.name))
      }
      return
    }
    if (navigator.onLine === false && !await isAudioStoredForOffline(currentTrack.audioUrl)) {
      isPlayingRef.current = false
      setIsPlaying(false)
      showAudioError(offlineAudioUnavailableMessage(selectedReciter.name))
      return
    }
    startPlayback()
  }, [currentTrack, isPlaying, selectedReciter.name, showAudioError, startPlayback])
  const currentBookmark = currentVerse
    ? bookmarks.find((bookmark) => bookmark.page === currentPage && bookmark.verseKey === currentVerse.verseKey)
    : undefined
  const bookmarkChapterOptions = useMemo(() => {
    const chapters = new Map<number, string>()
    for (const bookmark of bookmarks) {
      chapters.set(bookmark.chapterId, bookmark.chapterName || String(bookmark.chapterId))
    }
    return [...chapters.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((first, second) => first.id - second.id)
  }, [bookmarks])
  const filteredBookmarks = useMemo(() => bookmarks.filter((bookmark) =>
    (bookmarkCategoryFilter === "all" || bookmark.category === bookmarkCategoryFilter) &&
    (bookmarkChapterFilter === "all" || bookmark.chapterId === Number(bookmarkChapterFilter)),
  ), [bookmarkCategoryFilter, bookmarkChapterFilter, bookmarks])
  const filteredBookmarkIds = useMemo(() => filteredBookmarks.map((bookmark) => bookmark.id), [filteredBookmarks])
  const bookmarkCategoryCounts = useMemo(() => bookmarks.reduce<Record<string, number>>((counts, bookmark) => {
    if (bookmark.category) counts[bookmark.category] = (counts[bookmark.category] ?? 0) + 1
    return counts
  }, {}), [bookmarks])
  const verseAction = verseActionKey
    ? verses.find((verse) => verse.verseKey === verseActionKey)
    : undefined
  const actionHighlight = verseActionKey
    ? verseHighlights.find((highlight) => highlight.verseKey === verseActionKey)
    : undefined
  const actionBookmark = verseActionKey
    ? bookmarks.find((bookmark) => bookmark.verseKey === verseActionKey)
    : undefined
  const highlightDraftVerse = highlightDraft
    ? verses.find((verse) => verse.verseKey === highlightDraft.verseKey)
    : undefined
  const highlightDraftStart = highlightDraft?.startPosition === undefined
    ? undefined
    : Math.min(highlightDraft.startPosition, highlightDraft.endPosition ?? highlightDraft.startPosition)
  const highlightDraftEnd = highlightDraft?.startPosition === undefined
    ? undefined
    : Math.max(highlightDraft.startPosition, highlightDraft.endPosition ?? highlightDraft.startPosition)
  const highlightDraftText = highlightDraftVerse && highlightDraftStart !== undefined && highlightDraftEnd !== undefined
    ? highlightDraftVerse.text.split(/\s+/).slice(highlightDraftStart - 1, highlightDraftEnd).join(" ")
    : ""
  const favoriteReaderItems = RECITERS.filter((item) => favoriteReciters.includes(item.id))
  const otherReaderItems = RECITERS.filter((item) => !favoriteReciters.includes(item.id))
  const currentCycle = completedCycles + 1
  const mutashabihatQuestionPosition = mutashabihatTestCandidates.length > 0
    ? Math.min(mutashabihatTestQuestionIndex + 1, mutashabihatTestCandidates.length)
    : 0
  const mutashabihatQuestionsRemaining = Math.max(
    mutashabihatTestCandidates.length - mutashabihatQuestionPosition,
    0,
  )
  const pagePosition = currentPage - sessionStart + 1
  const sessionProgress = Math.min(
    100,
    Math.max(
      0,
      ((pagePosition - 1 + (verses.length ? verseIndex / verses.length : 0)) / sessionCount) * 100,
    ),
  )
  const practiceVerses = useMemo(() => {
    let startIndex = 0
    let endIndex = verses.length - 1
    if (currentPage === sessionStart && sessionStartVerseKey) {
      const index = verses.findIndex((verse) => verse.verseKey === sessionStartVerseKey)
      if (index >= 0) startIndex = index
    }
    if (currentPage === sessionEnd && sessionEndVerseKey) {
      const index = verses.findIndex((verse) => verse.verseKey === sessionEndVerseKey)
      if (index >= 0) endIndex = index
    }
    return endIndex >= startIndex ? verses.slice(startIndex, endIndex + 1) : []
  }, [currentPage, sessionEnd, sessionEndVerseKey, sessionStart, sessionStartVerseKey, verses])
  const practiceVisibleVerseKeys = useMemo(
    () => practiceVerses
      .slice(practiceStartOffset, practiceStartOffset + practiceRevealCount)
      .map((verse) => verse.verseKey),
    [practiceRevealCount, practiceStartOffset, practiceVerses],
  )
  const audioReviewActive = audioReviewState !== null
  const audioReviewActionLabel = audioReviewRevealMode === "progressive"
    ? "كشف الآيات تدريجيًا مع القارئ"
    : "كشف الآية كاملة مع القارئ"
  const audioReviewVisibleVerseKeys = useMemo(() => {
    if (!audioReviewState) return undefined
    if (audioReviewState.page !== currentPage) return []
    return verses
      .slice(0, Math.max(0, audioReviewState.revealIndex + 1))
      .map((verse) => verse.verseKey)
  }, [audioReviewState, currentPage, verses])

  const getAudioReviewVisibleVerseKeys = (page: number, pageVerses: QuranVerse[]) => {
    if (!audioReviewState) return undefined
    if (page < audioReviewState.page) return pageVerses.map((verse) => verse.verseKey)
    if (page > audioReviewState.page) return []
    return pageVerses
      .slice(0, Math.max(0, audioReviewState.revealIndex + 1))
      .map((verse) => verse.verseKey)
  }

  const getAudioReviewProgressiveReveal = (page: number, pageVerses: QuranVerse[]) => {
    if (
      !audioReviewState ||
      audioReviewState.page !== page ||
      audioReviewState.visibleWordPosition === undefined
    ) return undefined
    const verse = pageVerses[audioReviewState.revealIndex]
    if (!verse) return undefined
    return {
      verseKey: verse.verseKey,
      visibleWordPosition: audioReviewState.visibleWordPosition,
      transitionDurationMs: audioReviewState.wordTransitionDurationMs ?? 0,
    }
  }

  useEffect(() => {
    if (khatmaOpen) setKhatmaMounted(true)
  }, [khatmaOpen])

  useEffect(() => {
    const handleProgress = (event: Event) => {
      setOfflineTafsirStatus((event as CustomEvent<OfflineTafsirStatus>).detail)
    }
    const handleOnline = () => {
      largeReadingRetryAtRef.current = 0
      setNetworkOnline(true)
    }
    const handleOffline = () => setNetworkOnline(false)
    setNetworkOnline(navigator.onLine)
    window.addEventListener(OFFLINE_TAFSIR_PROGRESS_EVENT, handleProgress)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    void inspectOfflineTafsir().then(setOfflineTafsirStatus).catch(() => undefined)
    return () => {
      window.removeEventListener(OFFLINE_TAFSIR_PROGRESS_EVENT, handleProgress)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    currentPageRef.current = currentPage
    continuousVisiblePageRef.current = continuousVisiblePage
    continuousAutoScrollRef.current = continuousAutoScroll
    continuousScrollPausedRef.current = continuousScrollPaused
    continuousScrollModeRef.current = continuousScrollMode
    currentVerseKeyRef.current = currentVerse?.verseKey ?? null
  }, [continuousAutoScroll, continuousScrollMode, continuousScrollPaused, continuousVisiblePage, currentPage, currentVerse?.verseKey])

  const getVisibleReadingPage = useCallback(() => {
    const container = largeReadingScrollRef.current
    const visibleLocation = container?.isConnected ? getVisibleContinuousLocation(container) : undefined
    return visibleLocation?.page ?? continuousVisiblePageRef.current ?? currentPageRef.current
  }, [])

  const persistActiveKhatmaProgress = useCallback((visiblePage = getVisibleReadingPage()) => {
    const range = activeKhatmaRangeRef.current
    if (!range || !Number.isInteger(visiblePage) || visiblePage < range.startPage) return
    const rangeEnd = range.startPage + range.pageCount - 1
    const completedPage = Math.min(visiblePage, rangeEnd)
    const plan = readKhatmaPlan()
    if (!plan) return
    const nextCompletedPage = Math.max(plan.completedPage, completedPage)
    if (
      nextCompletedPage === plan.completedPage &&
      plan.startPage === range.startPage &&
      plan.pageCount === range.pageCount
    ) return
    saveKhatmaPlan({
      ...plan,
      completedPage: nextCompletedPage,
      startPage: range.startPage,
      pageCount: range.pageCount,
    })
  }, [getVisibleReadingPage])

  useEffect(() => {
    const persist = () => persistActiveKhatmaProgress()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") persist()
    }
    const interval = window.setInterval(persist, 15_000)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("wird-before-app-update", persist)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("wird-before-app-update", persist)
    }
  }, [persistActiveKhatmaProgress])

  useEffect(() => {
    if (dashboardOpen) persistActiveKhatmaProgress()
  }, [dashboardOpen, persistActiveKhatmaProgress])

  useEffect(() => {
    if (!continuousAutoScroll || !isPlaying || !hasVerseSynchronization) return
    continuousScrollModeRef.current = "recitation"
    continuousRecitationManualVerseRef.current = null
    continuousScrollPausedRef.current = false
    setContinuousScrollStopAt(null)
    setContinuousScrollTimerRemaining(null)
    setContinuousScrollMode("recitation")
    setContinuousScrollPaused(false)
  }, [continuousAutoScroll, hasVerseSynchronization, isPlaying])

  useEffect(() => {
    if (!continuousAutoScroll || continuousScrollMode !== "recitation" || hasVerseSynchronization) return
    continuousScrollModeRef.current = "free"
    continuousScrollPausedRef.current = true
    setContinuousScrollMode("free")
    setContinuousScrollPaused(true)
  }, [continuousAutoScroll, continuousScrollMode, hasVerseSynchronization])

  useEffect(() => {
    if (hasVerseSynchronization) return
    setAyahRepeatEnabled(false)
    setAudioReviewState(null)
  }, [hasVerseSynchronization])

  useEffect(() => {
    const player = playerShellRef.current
    if (!player || !("ResizeObserver" in window)) return
    let frame = 0
    let lastHeight = -1
    const scheduleOffsetUpdate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const height = readerFocusActive && !landscapeFullscreenPlayer
          ? 0
          : player.getBoundingClientRect().height
        if (Math.abs(height - lastHeight) < 0.5) return
        lastHeight = height
        document.documentElement.style.setProperty("--wird-player-height", `${height}px`)
      })
    }
    scheduleOffsetUpdate()
    const observer = new ResizeObserver(scheduleOffsetUpdate)
    observer.observe(player)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      document.documentElement.style.removeProperty("--wird-player-height")
    }
  }, [landscapeFullscreenPlayer, readerFocusActive])

  useEffect(() => {
    const header = headerShellRef.current
    if (!header || !("ResizeObserver" in window)) return
    let frame = 0
    let lastHeight = -1
    const scheduleOffsetUpdate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const height = header.getBoundingClientRect().height
        if (Math.abs(height - lastHeight) < 0.5) return
        lastHeight = height
        document.documentElement.style.setProperty("--wird-header-height", `${height}px`)
      })
    }
    scheduleOffsetUpdate()
    const observer = new ResizeObserver(scheduleOffsetUpdate)
    observer.observe(header)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      document.documentElement.style.removeProperty("--wird-header-height")
    }
  }, [])

  useEffect(() => {
    if (!settingsLoaded || dashboardOpen) return
    const flush = () => {
      const startedAt = readingStartedAtRef.current
      if (startedAt === null) return
      const seconds = Math.floor((Date.now() - startedAt) / 1000)
      readingStartedAtRef.current = null
      if (seconds > 0) addReadingTime(seconds, currentPage)
    }
    const start = () => {
      if (document.visibilityState === "visible") readingStartedAtRef.current = Date.now()
    }
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flush()
      else start()
    }
    start()
    const interval = window.setInterval(() => {
      flush()
      start()
    }, 30_000)
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("wird-before-app-update", flush)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("wird-before-app-update", flush)
      flush()
    }
  }, [currentPage, dashboardOpen, settingsLoaded])

  useEffect(() => {
    if (!settingsLoaded) return
    const persist = () => saveLastReading({
      page: currentPage,
      verseKey: currentVerse?.verseKey,
      chapterId: currentVerse?.chapterId,
      positionMs: (audioRef.current?.currentTime ?? (currentVerse?.timestampFrom ?? 0) / 1000) * 1000,
      reciter,
      viewMode,
      readingMode,
      updatedAt: Date.now(),
    })
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") persist()
    }
    const interval = window.setInterval(persist, 15_000)
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("wird-before-app-update", persist)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("wird-before-app-update", persist)
      persist()
    }
  }, [currentPage, currentVerse?.chapterId, currentVerse?.timestampFrom, currentVerse?.verseKey, readingMode, reciter, settingsLoaded, viewMode])

  useEffect(() => {
    if (!settingsLoaded || pageData.page !== currentPage) return
    const locationVerse = verses.find((verse) => verse.verseKey === selectedVerseKey) ?? verses[0]
    if (!locationVerse) return
    saveRecentReadingLocation({
      page: currentPage,
      verseKey: locationVerse.verseKey,
      chapterId: locationVerse.chapterId,
      chapterName: locationVerse.chapterName,
      updatedAt: Date.now(),
    })
  }, [currentPage, pageData.page, selectedVerseKey, settingsLoaded, verses])

  useEffect(() => {
    const activeId = activeSessionIdRef.current
    if (
      !settingsLoaded ||
      !activeId ||
      !currentVerse ||
      pageData.page !== currentPage ||
      pageData.reciter !== reciter
    ) return
    const existing = loadSessionHistory().find((session) => session.id === activeId)
    if (!existing || existing.completed) return
    upsertSessionHistory({
      ...existing,
      currentPage,
      currentVerseKey: practiceActive && activeTestKind === "mutashabihat"
        ? mutashabihatTestTarget?.verseKey ?? currentVerse.verseKey
        : currentVerse.verseKey,
      reciter,
      reciterName: selectedReciter.name,
      updatedAt: Date.now(),
    })
  }, [activeTestKind, currentPage, currentVerse, mutashabihatTestTarget?.verseKey, pageData.page, pageData.reciter, practiceActive, reciter, selectedReciter.name, settingsLoaded])

  useEffect(() => {
    sessionBoundsRef.current = {
      start: sessionStart,
      end: sessionEnd,
      startVerseKey: sessionStartVerseKey,
      endVerseKey: sessionEndVerseKey,
    }
  }, [sessionEnd, sessionEndVerseKey, sessionStart, sessionStartVerseKey])

  useEffect(() => {
    if (!settingsLoaded || !extendedSpeedOpen) return
    const controller = new AbortController()
    const query = new URLSearchParams({
      reciter: String(reciter),
      startPage: String(sessionStart),
      endPage: String(sessionEnd),
    })
    if (sessionStartVerseKey) query.set("startVerseKey", sessionStartVerseKey)
    if (sessionEndVerseKey) query.set("endVerseKey", sessionEndVerseKey)
    setSessionDurationLoading(true)
    setSessionDuration(null)
    fetch(`/api/quran/session-duration?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { seconds?: number; approximate?: boolean; error?: string }
        if (!response.ok || typeof data.seconds !== "number") {
          throw new Error(data.error || "Unable to calculate session duration")
        }
        setSessionDuration({ seconds: data.seconds, approximate: Boolean(data.approximate) })
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setSessionDuration(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) setSessionDurationLoading(false)
      })
    return () => controller.abort()
  }, [extendedSpeedOpen, reciter, sessionEnd, sessionEndVerseKey, sessionStart, sessionStartVerseKey, settingsLoaded])

  const toggleReaderChrome = () => {
    if (readerFocusActive) {
      setQuietMode(false)
      setReaderChromeVisible(true)
      setNavigationOpen(chromePanelsRef.current.navigation)
      setSessionSettingsOpen(chromePanelsRef.current.session)
      setMobileMarksOpen(chromePanelsRef.current.marks)
      return
    }
    chromePanelsRef.current = {
      navigation: navigationOpen,
      session: sessionSettingsOpen,
      marks: mobileMarksOpen,
    }
    setAppSettingsOpen(false)
    setNavigationOpen(false)
    setSessionSettingsOpen(false)
    setMobileMarksOpen(false)
    setQuietMode(true)
    setReaderChromeVisible(false)
  }

  const persistVerseHighlights = (next: VerseHighlight[]) => {
    setVerseHighlights(next)
    saveVerseHighlights(next)
  }

  const openVerseActions = (verseKey: string, position?: number) => {
    if (practiceActive || audioReviewActive) return
    setSelectedVerseKey(verseKey)
    setVerseActionPosition(position ?? null)
    setVerseActionKey(verseKey)
  }

  const startActionVersePlayback = () => {
    if (!verseAction) return
    const target = verseAction
    activeSessionIdRef.current = null
    pendingResumeSessionIdRef.current = null
    setBoundedSessionActive(false)
    setSessionStart(target.pageNumber)
    setSessionCount(MAX_PAGE - target.pageNumber + 1)
    setSessionStartVerseKey(target.verseKey)
    setSessionEndVerseKey(undefined)
    setVerseActionKey(null)
    setVerseActionPosition(null)
    moveToPage(target.pageNumber, recitationSyncScope === "page" ? undefined : target.verseKey)
    startPlayback()
    if (!hasVerseSynchronization) {
      toast.info(`تبدأ تلاوة الحدر من أول ${recitationSyncScope === "chapter" ? "السورة" : "الصفحة"}`)
    }
  }

  const copyActionVerse = async () => {
    if (!verseAction) return
    const target = verseAction
    try {
      await copyPlainText(target.text)
      setVerseActionKey(null)
      setVerseActionPosition(null)
      toast.success(`تم نسخ الآية ${target.verseKey}`)
    } catch {
      toast.error("تعذر نسخ الآية في هذا المتصفح")
    }
  }

  const beginVerseHighlight = () => {
    if (!verseAction) return
    if (readerFocusActive) toggleReaderChrome()
    const wordCount = Math.max(1, verseAction.text.split(/\s+/).length)
    const initialPosition = Math.min(Math.max(verseActionPosition ?? 1, 1), wordCount)
    setViewMode("text")
    setHighlightDraft({
      verseKey: verseAction.verseKey,
      startPosition: actionHighlight?.startPosition ?? initialPosition,
      endPosition: actionHighlight?.endPosition ?? initialPosition,
      anchorPosition: initialPosition,
      category: actionHighlight?.category ?? "reinforce",
    })
    setVerseActionKey(null)
  }

  const updateHighlightRange = (edge: HighlightEdge, position: number) => {
    setHighlightDraft((draft) => {
      if (!draft) return draft
      const verse = verses.find((item) => item.verseKey === draft.verseKey)
      const wordCount = Math.max(1, verse?.text.split(/\s+/).length ?? 1)
      const nextPosition = Math.min(Math.max(position, 1), wordCount)
      const startPosition = Math.min(
        draft.startPosition ?? nextPosition,
        draft.endPosition ?? draft.startPosition ?? nextPosition,
      )
      const endPosition = Math.max(
        draft.startPosition ?? nextPosition,
        draft.endPosition ?? draft.startPosition ?? nextPosition,
      )
      if (edge === "start") {
        return { ...draft, startPosition: Math.min(nextPosition, endPosition), endPosition }
      }
      return { ...draft, startPosition, endPosition: Math.max(nextPosition, startPosition) }
    })
  }

  const selectHighlightPosition = (position: number) => {
    setHighlightDraft((draft) => {
      if (!draft) return draft
      if (draft.startPosition === undefined) {
        return { ...draft, startPosition: position, endPosition: position }
      }
      const startPosition = Math.min(draft.startPosition, draft.endPosition ?? draft.startPosition)
      const endPosition = Math.max(draft.startPosition, draft.endPosition ?? draft.startPosition)
      return Math.abs(position - startPosition) <= Math.abs(position - endPosition)
        ? { ...draft, startPosition: Math.min(position, endPosition), endPosition }
        : { ...draft, startPosition, endPosition: Math.max(position, startPosition) }
    })
  }

  const saveVerseHighlight = () => {
    if (!highlightDraft || highlightDraft.startPosition === undefined) return
    const startPosition = Math.min(
      highlightDraft.startPosition,
      highlightDraft.endPosition ?? highlightDraft.startPosition,
    )
    const endPosition = Math.max(
      highlightDraft.startPosition,
      highlightDraft.endPosition ?? highlightDraft.startPosition,
    )
    const previousHighlight = verseHighlights.find((highlight) => highlight.verseKey === highlightDraft.verseKey)
    const nextHighlight = scheduleHighlight({
      ...previousHighlight,
      verseKey: highlightDraft.verseKey,
      startPosition,
      endPosition,
      chapterName: highlightDraftVerse?.chapterName ?? previousHighlight?.chapterName,
      verseText: highlightDraftVerse?.text ?? previousHighlight?.verseText,
    }, highlightDraft.category ?? "reinforce", highlightDraftVerse?.pageNumber)
    persistVerseHighlights([
      nextHighlight,
      ...verseHighlights.filter((highlight) => highlight.verseKey !== nextHighlight.verseKey),
    ])
    setHighlightDraft(null)
    toast.success(`تم حفظ تظليل الآية ${nextHighlight.verseKey}`)
  }

  const removeActionHighlight = () => {
    if (!verseActionKey) return
    persistVerseHighlights(verseHighlights.filter((highlight) => highlight.verseKey !== verseActionKey))
    setVerseActionKey(null)
    setHighlightDraft(null)
    toast.success("تمت إزالة التظليل")
  }

  const resolveTafsirTarget = async (verseKey: string): Promise<TafsirTarget> => {
    const currentVerse = verses.find((verse) => verse.verseKey === verseKey)
    if (currentVerse) {
      return {
        verseKey,
        chapterId: currentVerse.chapterId,
        chapterName: currentVerse.chapterName,
        ayah: currentVerse.verseNumber,
        text: currentVerse.text,
        page: currentVerse.pageNumber,
      }
    }

    const [chapterId, ayah] = verseKey.split(":").map(Number)
    let result: { surahName: string; text: string; page: number } | undefined
    try {
      if (navigator.onLine === false) throw new Error("OFFLINE")
      const response = await fetch(`/api/quran/navigation?q=${encodeURIComponent(verseKey)}`)
      const data = await response.json() as { results?: Array<{ verseKey: string; surahName: string; text: string; page: number }> }
      result = data.results?.find((item) => item.verseKey === verseKey)
    } catch {
      const offline = await searchOfflineQuran(verseKey).catch(() => ({ results: [] }))
      result = offline.results.find((item) => item.verseKey === verseKey)
    }
    return {
      verseKey,
      chapterId,
      chapterName: result?.surahName ?? getSurahMeta(chapterId as Surah).name,
      ayah,
      text: result?.text ?? "",
      page: result?.page,
    }
  }

  const loadTafsir = async (target: TafsirTarget) => {
    const requestId = tafsirRequestRef.current + 1
    tafsirRequestRef.current = requestId
    setTafsirTarget(target)
    setTafsirData(null)
    setTafsirError(null)
    setTafsirLoading(true)
    try {
      let data: TafsirResponse | null = null
      if (navigator.onLine !== false) {
        try {
          const response = await fetch(`/api/quran/tafsir?tafsir=saadi&verseKey=${encodeURIComponent(target.verseKey)}`)
          const onlineData = await response.json() as TafsirResponse
          if (!response.ok || !onlineData.entry) throw new Error(onlineData.error || "تعذر تحميل التفسير")
          data = onlineData
          void storeOfflineTafsirVerse(target.verseKey, onlineData).catch(() => undefined)
        } catch {
          data = await readOfflineTafsir(target.verseKey).catch(() => null)
        }
      } else {
        data = await readOfflineTafsir(target.verseKey).catch(() => null)
      }
      if (requestId !== tafsirRequestRef.current) return
      if (!data?.entry) throw new Error(navigator.onLine === false
        ? "هذا الموضع غير محفوظ. نزّل تفسير السعدي من قسم التنزيلات عند توفر الإنترنت."
        : "تعذر تحميل تفسير هذه الآية الآن")
      setTafsirData(data)
    } catch (error) {
      if (requestId === tafsirRequestRef.current) {
        setTafsirError((error as Error).message || "تعذر تحميل التفسير")
      }
    } finally {
      if (requestId === tafsirRequestRef.current) setTafsirLoading(false)
    }
  }

  const openTafsir = () => {
    if (!verseAction) return
    const target: TafsirTarget = {
      verseKey: verseAction.verseKey,
      chapterId: verseAction.chapterId,
      chapterName: verseAction.chapterName,
      ayah: verseAction.verseNumber,
      text: verseAction.text,
      page: verseAction.pageNumber,
    }
    setVerseActionKey(null)
    setVerseActionPosition(null)
    window.setTimeout(() => {
      setTafsirOpen(true)
      void inspectOfflineTafsir().then(setOfflineTafsirStatus).catch(() => undefined)
      void loadTafsir(target)
    }, 220)
  }

  const navigateTafsir = async (direction: -1 | 1) => {
    if (!tafsirTarget) return
    const verseKey = adjacentVerseKey(tafsirTarget.verseKey, direction)
    if (!verseKey) return
    setTafsirLoading(true)
    const target = await resolveTafsirTarget(verseKey)
    await loadTafsir(target)
  }

  const downloadTafsirForOffline = async () => {
    try {
      const status = await downloadOfflineTafsir()
      setOfflineTafsirStatus(status)
      if (status.failed > 0) toast.error(`تعذر تنزيل ${status.failed} سورة من التفسير. يمكنك الاستكمال لاحقًا.`)
      else toast.success("أصبح تفسير السعدي متاحًا دون إنترنت")
    } catch (error) {
      toast.error((error as Error).message === "OFFLINE" ? "اتصل بالإنترنت لتنزيل التفسير" : "تعذر تنزيل تفسير السعدي")
    }
  }

  const loadMutashabihat = async (
    target: { verseKey: string },
    types?: WirdMutashabihatType[],
  ) => {
    setMutashabihatOpen(true)
    setMutashabihatLoading(true)
    setMutashabihatError(null)
    setMutashabihatData(null)
    setOfferOfflineMutashabihat(false)
    if (!types?.length) {
      void inspectOfflineMutashabihat()
        .then((status) => setOfferOfflineMutashabihat(navigator.onLine && !status.ready))
        .catch(() => undefined)
    }
    try {
      const params = new URLSearchParams({
        verseKey: target.verseKey,
        source: "categories-v1",
      })
      if (types?.length) params.set("types", types.join(","))
      const response = await fetch(`/api/quran/mutashabihat?${params.toString()}`)
      const data = (await response.json()) as MutashabihatResponse
      if (!response.ok) throw new Error(data.error || "تعذر تحميل المتشابهات")
      setMutashabihatData(data)
      if (!types?.length) void storeExactMutashabihat(data).catch(() => undefined)
    } catch (error) {
      const offline = types?.length ? null : await findOfflineMutashabihat(target.verseKey).catch(() => null)
      if (offline) {
        setMutashabihatData(offline)
      } else {
        setMutashabihatError(error instanceof Error ? error.message : "تعذر تحميل المتشابهات")
      }
    } finally {
      setMutashabihatLoading(false)
    }
  }

  const openMutashabihat = () => {
    if (!verseAction) return
    const target = verseAction
    setVerseActionKey(null)
    setVerseActionPosition(null)
    window.setTimeout(() => void loadMutashabihat(target), 220)
  }

  const downloadMutashabihatForOffline = async () => {
    if (preparingOfflineMutashabihat) return
    setPreparingOfflineMutashabihat(true)
    try {
      const quranStatus = await downloadOfflineQuran()
      if (quranStatus.pagesCompleted < quranStatus.pagesTotal) {
        throw new Error("تعذر إكمال تنزيل المصحف النصي")
      }
      const status = await prepareOfflineMutashabihat()
      if (!status.ready) throw new Error("تعذر فهرسة جميع الآيات")
      setOfferOfflineMutashabihat(false)
      toast.success("أصبحت المتشابهات متاحة دون إنترنت")
    } catch (error) {
      toast.error((error as Error).message || "تعذر تنزيل المتشابهات")
    } finally {
      setPreparingOfflineMutashabihat(false)
    }
  }

  const renderMutashabihatText = (segments: MutashabihatSegment[]) => (
    <span className="font-quran text-base leading-8" data-quran-content>
      {segments.map((segment, index) => (
        <span
          key={`${index}-${segment.text.slice(0, 8)}`}
          className={segment.highlighted ? "bg-primary/12 text-foreground" : undefined}
        >
          {segment.text}
        </span>
      ))}
    </span>
  )

  useEffect(() => {
    const savedLastReading = loadLastReading()
    let initialPage = clamp(savedLastReading?.page ?? 1, 1, MAX_PAGE)
    const savedReciter = Number(window.localStorage.getItem(RECITER_STORAGE_KEY))
    if (RECITERS.some((item) => item.id === savedReciter)) setReciter(savedReciter)

    try {
      const savedFavorites = JSON.parse(
        window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]",
      ) as number[]
      setFavoriteReciters(
        savedFavorites.filter((id) => RECITERS.some((item) => item.id === id)),
      )
    } catch {
      window.localStorage.removeItem(FAVORITES_STORAGE_KEY)
    }

    try {
      const saved = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}") as {
        startPage?: number
        pageCount?: number
        reciter?: number
        startVerseKey?: string
        endVerseKey?: string
        speed?: number
        volume?: number
        repeatTarget?: string
        viewMode?: ViewMode
        spreadMode?: SpreadMode
        ayahRepeatEnabled?: boolean
        ayahRepeatCount?: number
        ayahPauseSeconds?: number
        sessionMode?: SessionMode
        testKind?: WirdTestKind
        mutashabihatTestTypes?: WirdMutashabihatType[]
        readingMode?: ReadingMode
        lineSpacing?: LineSpacing
        audioReviewRevealMode?: AudioReviewRevealMode
        wideReading?: boolean
        largeTextSize?: number
        autoScroll?: boolean
        continuousAutoScroll?: boolean
        continuousScrollSpeed?: number
        centerTapFullscreen?: boolean
        searchGestureEnabled?: boolean
        searchGestureDirection?: SearchGestureDirection
        screenRotationLocked?: boolean
        keepScreenAwake?: boolean
        highContrast?: boolean
        largeControls?: boolean
        largeAppText?: boolean
        appTextScale?: AppTextScale
        simplifiedPlayer?: boolean
        speechLabels?: boolean
      }
      const start = clamp(saved.startPage ?? 1, 1, MAX_PAGE)
      initialPage = clamp(savedLastReading?.page ?? start, 1, MAX_PAGE)
      const count = clamp(saved.pageCount ?? 3, 1, MAX_PAGE - start + 1)
      const preferredReciter = saved.reciter ?? savedReciter
      if (RECITERS.some((item) => item.id === preferredReciter)) {
        setReciter(preferredReciter)
        window.localStorage.setItem(RECITER_STORAGE_KEY, String(preferredReciter))
      }
      const savedSpeed = clampSpeed(saved.speed ?? 1)
      const startVerseKey = saved.startVerseKey || undefined
      const endVerseKey = saved.endVerseKey || undefined
      draftSessionRangeRef.current = {
        startPage: start,
        endPage: start + count - 1,
        startVerseKey,
        endVerseKey,
      }
      setDraftStart(start)
      setSessionStart(start)
      setCurrentPage(initialPage)
      setDraftCount(count)
      setSessionCount(count)
      setDraftStartVerseKey(startVerseKey)
      setSessionStartVerseKey(startVerseKey)
      setDraftEndVerseKey(endVerseKey)
      setSessionEndVerseKey(endVerseKey)
      setSpeed(savedSpeed)
      const savedVolume = Math.min(Math.max(saved.volume ?? 1, 0), 1)
      setVolume(savedVolume)
      if (savedVolume > 0) previousVolumeRef.current = savedVolume
      setRepeatTarget(normalizeRepeatTarget(saved.repeatTarget))
      if (saved.viewMode === "image" || saved.viewMode === "text") setViewMode(saved.viewMode)
      if (saved.spreadMode === "single" || saved.spreadMode === "double") setSpreadMode(saved.spreadMode)
      setAyahRepeatEnabled(Boolean(saved.ayahRepeatEnabled))
      setAyahRepeatCount(clamp(saved.ayahRepeatCount ?? 3, 1, 20))
      setAyahPauseSeconds(Math.min(Math.max(saved.ayahPauseSeconds ?? 1, 0), 10))
      if (["listen", "recite", "test"].includes(saved.sessionMode ?? "")) {
        setSessionMode(saved.sessionMode ?? "listen")
      }
      setTestKind(saved.testKind === "mutashabihat" ? "mutashabihat" : "standard")
      setMutashabihatTestTypes(normalizeMutashabihatTypes(saved.mutashabihatTestTypes))
      if (saved.readingMode === "page" || saved.readingMode === "large") {
        setReadingMode(saved.readingMode)
      }
      if (saved.lineSpacing === "normal" || saved.lineSpacing === "comfortable" || saved.lineSpacing === "spacious") {
        setLineSpacing(saved.lineSpacing)
      }
      setAudioReviewRevealMode(saved.audioReviewRevealMode === "verse" ? "verse" : "progressive")
      setContinuousAutoScroll(Boolean(saved.continuousAutoScroll))
      setContinuousScrollSpeed(normalizeContinuousScrollSpeed(saved.continuousScrollSpeed ?? 1))
      setCenterTapFullscreen(saved.centerTapFullscreen !== false)
      setSearchGestureEnabled(Boolean(saved.searchGestureEnabled))
      setSearchGestureDirection(saved.searchGestureDirection === "down" ? "down" : "up")
      setWideReading(Boolean(saved.wideReading) && saved.viewMode === "text" && saved.readingMode !== "large")
      setLargeTextSize(clamp(saved.largeTextSize ?? 36, 28, 52))
      setAutoScroll(saved.autoScroll !== false)
      setScreenRotationLocked(Boolean(saved.screenRotationLocked))
      setKeepScreenAwake(Boolean(saved.keepScreenAwake))
      setHighContrast(Boolean(saved.highContrast))
      setLargeControls(Boolean(saved.largeControls))
      setAppTextScale(
        saved.appTextScale === "large" || saved.appTextScale === "xlarge"
          ? saved.appTextScale
          : saved.largeAppText
            ? "large"
            : "normal",
      )
      setSimplifiedPlayer(Boolean(saved.simplifiedPlayer))
      setSpeechLabels(Boolean(saved.speechLabels))
    } catch {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY)
      setCurrentPage(initialPage)
    }

    const savedBookmarkCategories = loadBookmarkCategories(window.localStorage)
    const savedBookmarkCategoryIds = new Set(savedBookmarkCategories.map((category) => category.id))
    setBookmarkCategories(savedBookmarkCategories)
    saveBookmarkCategories(window.localStorage, savedBookmarkCategories)

    try {
      const savedBookmarks = JSON.parse(
        window.localStorage.getItem(BOOKMARKS_STORAGE_KEY) ?? "[]",
      ) as BookmarkItem[]
      setBookmarks(savedBookmarks
        .filter((bookmark) => bookmark.page >= 1 && bookmark.page <= MAX_PAGE)
        .map((bookmark) => ({
          ...bookmark,
          chapterName: getBookmarkChapterName(
            bookmark.chapterId,
            typeof bookmark.chapterName === "string" ? bookmark.chapterName : undefined,
          ),
          category: typeof bookmark.category === "string" && savedBookmarkCategoryIds.has(bookmark.category)
            ? bookmark.category
            : undefined,
        })))
    } catch {
      window.localStorage.removeItem(BOOKMARKS_STORAGE_KEY)
    }

    const savedHighlights = loadVerseHighlights()
    setVerseHighlights(savedHighlights)
    saveVerseHighlights(savedHighlights)

    const query = new URLSearchParams(window.location.search)
    if (query.get("khatma") === "1") {
      setKhatmaReminderPrompt(true)
      query.delete("khatma")
      const nextQuery = query.toString()
      window.history.replaceState(null, "", `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`)
    }

    setSettingsLoaded(true)
  }, [])

  useEffect(() => {
    const refreshSavedSessions = () => setSavedSessions(loadSavedSessions())
    const refreshPreviousSessions = () => setPreviousSessions(loadSessionHistory())
    refreshSavedSessions()
    refreshPreviousSessions()
    window.addEventListener("wird-saved-sessions-changed", refreshSavedSessions)
    window.addEventListener("wird-activity-changed", refreshPreviousSessions)
    return () => {
      window.removeEventListener("wird-saved-sessions-changed", refreshSavedSessions)
      window.removeEventListener("wird-activity-changed", refreshPreviousSessions)
    }
  }, [])

  useEffect(() => {
    if (!khatmaReminderPrompt) return
    const timeout = window.setTimeout(
      () => setKhatmaReminderPrompt(false),
      KHATMA_REMINDER_PROMPT_TIMEOUT_MS,
    )
    return () => window.clearTimeout(timeout)
  }, [khatmaReminderPrompt])

  useEffect(() => {
    if (!settingsLoaded) return
    window.localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        startPage: draftStart,
        pageCount: draftCount,
        reciter,
        startVerseKey: draftStartVerseKey,
        endVerseKey: draftEndVerseKey,
        speed,
        volume,
        repeatTarget,
        viewMode,
        spreadMode,
        ayahRepeatEnabled,
        ayahRepeatCount,
        ayahPauseSeconds,
        sessionMode,
        testKind,
        mutashabihatTestTypes,
        readingMode,
        lineSpacing,
        audioReviewRevealMode,
        wideReading,
        largeTextSize,
        autoScroll,
        continuousAutoScroll,
        continuousScrollSpeed,
        centerTapFullscreen,
        searchGestureEnabled,
        searchGestureDirection,
        screenRotationLocked,
        keepScreenAwake,
        highContrast,
        largeControls,
        appTextScale,
        simplifiedPlayer,
        speechLabels,
      }),
    )
  }, [
    settingsLoaded,
    draftStart,
    draftCount,
    reciter,
    draftStartVerseKey,
    draftEndVerseKey,
    speed,
    volume,
    repeatTarget,
    viewMode,
    spreadMode,
    ayahRepeatEnabled,
    ayahRepeatCount,
    ayahPauseSeconds,
    sessionMode,
    testKind,
    mutashabihatTestTypes,
    readingMode,
    lineSpacing,
    audioReviewRevealMode,
    wideReading,
    largeTextSize,
    autoScroll,
    continuousAutoScroll,
    continuousScrollSpeed,
    centerTapFullscreen,
    searchGestureEnabled,
    searchGestureDirection,
    screenRotationLocked,
    keepScreenAwake,
    highContrast,
    largeControls,
    appTextScale,
    simplifiedPlayer,
    speechLabels,
  ])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.wirdFullscreen = String(isFullscreen)
    root.dataset.wirdPracticeActive = String(practiceActive)
    root.dataset.wirdAutoScroll = String(continuousAutoScroll)
    window.dispatchEvent(new Event("wird-player-state-changed"))
  }, [continuousAutoScroll, isFullscreen, practiceActive])

  useEffect(() => () => {
    delete document.documentElement.dataset.wirdFullscreen
    delete document.documentElement.dataset.wirdPracticeActive
    delete document.documentElement.dataset.wirdAutoScroll
  }, [])

  useEffect(() => {
    const compactMedia = window.matchMedia("(orientation: landscape) and (max-height: 600px)")
    const landscapeMedia = window.matchMedia("(orientation: landscape)")
    const coarsePointerMedia = window.matchMedia("(pointer: coarse)")
    const hideSuggestion = () => {
      if (fullscreenOrientationTimerRef.current) clearTimeout(fullscreenOrientationTimerRef.current)
      fullscreenOrientationTimerRef.current = null
      setFullscreenOrientationSuggestion(null)
    }
    const acceptOrientation = (orientation: PhysicalOrientation) => {
      acceptedOrientationRef.current = orientation
      lastOfferedOrientationRef.current = null
      const landscape = orientation === "landscape"
      const touchViewport = coarsePointerMedia.matches || navigator.maxTouchPoints > 0
      setLandscapeReadingMode(landscape && (touchViewport || compactMedia.matches))
      setCompactLandscape(landscape && compactMedia.matches)
      hideSuggestion()
    }
    const offerOrientation = (orientation: PhysicalOrientation) => {
      if (orientation === acceptedOrientationRef.current) {
        lastOfferedOrientationRef.current = null
        hideSuggestion()
        return
      }
      if (lastOfferedOrientationRef.current === orientation) return
      lastOfferedOrientationRef.current = orientation
      setFullscreenOrientationSuggestion(orientation)
      if (fullscreenOrientationTimerRef.current) clearTimeout(fullscreenOrientationTimerRef.current)
      fullscreenOrientationTimerRef.current = setTimeout(() => {
        fullscreenOrientationTimerRef.current = null
        setFullscreenOrientationSuggestion(null)
      }, FULLSCREEN_ORIENTATION_CONTROL_MS)
    }
    const processPhysicalOrientation = (physical: PhysicalOrientation) => {
      if (fullscreenPhysicalOrientationRef.current === physical && orientationInitializedRef.current) return
      fullscreenPhysicalOrientationRef.current = physical
      if (!orientationInitializedRef.current) {
        orientationInitializedRef.current = true
        acceptOrientation("portrait")
        if (!screenRotationLocked && physical !== "portrait") offerOrientation(physical)
        return
      }
      if (screenRotationLocked) {
        lastOfferedOrientationRef.current = null
        hideSuggestion()
        return
      }
      offerOrientation(physical)
    }
    const updatePhysicalOrientation = () => {
      processPhysicalOrientation(landscapeMedia.matches ? "landscape" : "portrait")
    }
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null) return
      const gamma = Math.abs(event.gamma)
      if (gamma >= 55) processPhysicalOrientation("landscape")
      else if (gamma <= 25 && event.beta !== null && Math.abs(event.beta) >= 35) processPhysicalOrientation("portrait")
    }
    fullscreenPhysicalOrientationRef.current = null
    updatePhysicalOrientation()
    compactMedia.addEventListener("change", updatePhysicalOrientation)
    landscapeMedia.addEventListener("change", updatePhysicalOrientation)
    coarsePointerMedia.addEventListener("change", updatePhysicalOrientation)
    window.addEventListener("orientationchange", updatePhysicalOrientation)
    window.addEventListener("resize", updatePhysicalOrientation)
    window.addEventListener("deviceorientation", handleDeviceOrientation, { passive: true })
    return () => {
      compactMedia.removeEventListener("change", updatePhysicalOrientation)
      landscapeMedia.removeEventListener("change", updatePhysicalOrientation)
      coarsePointerMedia.removeEventListener("change", updatePhysicalOrientation)
      window.removeEventListener("orientationchange", updatePhysicalOrientation)
      window.removeEventListener("resize", updatePhysicalOrientation)
      window.removeEventListener("deviceorientation", handleDeviceOrientation)
    }
  }, [screenRotationLocked])

  useEffect(() => {
    playerCollapsedRef.current = playerCollapsed
  }, [playerCollapsed])

  useEffect(() => {
    if (landscapeFullscreenPlayer) {
      if (!fullscreenAutoCollapseActiveRef.current) {
        playerCollapsedBeforeFullscreenRef.current = playerCollapsedRef.current
        fullscreenAutoCollapseActiveRef.current = true
      }
      setPlayerCollapsed(true)
      return
    }
    if (!isFullscreen && fullscreenAutoCollapseActiveRef.current) {
      setPlayerCollapsed(playerCollapsedBeforeFullscreenRef.current)
      fullscreenAutoCollapseActiveRef.current = false
    }
  }, [isFullscreen, landscapeFullscreenPlayer])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.highContrast = String(highContrast)
    root.dataset.largeControls = String(largeControls)
    root.dataset.appTextScale = appTextScale
    return () => {
      delete root.dataset.highContrast
      delete root.dataset.largeControls
      delete root.dataset.appTextScale
    }
  }, [appTextScale, highContrast, largeControls])

  useEffect(() => {
    if (!settingsLoaded || typeof screen === "undefined" || !screen.orientation) return
    const orientation = screen.orientation as LockableScreenOrientation
    const applyRotationPreference = () => {
      const target: ScreenOrientationLock = acceptedOrientationRef.current
      if (!orientation.lock) return
      void orientation.lock(target).catch(() => {
        // iOS Safari does not expose reliable orientation locking; the app layout remains locked instead.
      })
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") applyRotationPreference()
    }
    applyRotationPreference()
    document.addEventListener("fullscreenchange", applyRotationPreference)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pageshow", applyRotationPreference)
    return () => {
      document.removeEventListener("fullscreenchange", applyRotationPreference)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pageshow", applyRotationPreference)
    }
  }, [isFullscreen, screenRotationLocked, settingsLoaded])

  useEffect(() => {
    const wakeLock = (navigator as Navigator & { wakeLock?: ScreenWakeLock }).wakeLock
    const releaseWakeLock = async () => {
      const current = wakeLockRef.current
      wakeLockRef.current = null
      if (current && !current.released) await current.release().catch(() => undefined)
    }
    if (!settingsLoaded || !keepScreenAwake || !wakeLock) {
      void releaseWakeLock()
      return
    }
    let cancelled = false
    const requestWakeLock = async () => {
      if (document.visibilityState !== "visible" || wakeLockRef.current && !wakeLockRef.current.released) return
      try {
        const sentinel = await wakeLock.request("screen")
        if (cancelled) {
          await sentinel.release()
          return
        }
        wakeLockRef.current = sentinel
      } catch {
        wakeLockRef.current = null
      }
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void requestWakeLock()
      else void releaseWakeLock()
    }
    void requestWakeLock()
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      void releaseWakeLock()
    }
  }, [keepScreenAwake, settingsLoaded])

  useEffect(() => {
    if (!speechLabels || !("speechSynthesis" in window)) return
    let lastLabel = ""
    let lastSpokenAt = 0
    const speakTarget = (event: Event) => {
      const origin = event.target
      if (!(origin instanceof Element)) return
      const target = origin.closest<HTMLElement>("button, a, [role='menuitem'], [role='tab']")
      if (!target || target.getAttribute("aria-disabled") === "true") return
      const label = target.getAttribute("aria-label") || target.textContent?.replace(/\s+/g, " ").trim()
      if (!label) return
      const now = Date.now()
      if (label === lastLabel && now - lastSpokenAt < 700) return
      lastLabel = label
      lastSpokenAt = now
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(label)
      utterance.lang = "ar-SA"
      utterance.rate = 0.86
      const arabicVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith("ar"))
      if (arabicVoice) utterance.voice = arabicVoice
      window.speechSynthesis.speak(utterance)
    }
    document.addEventListener("focusin", speakTarget)
    document.addEventListener("click", speakTarget)
    return () => {
      document.removeEventListener("focusin", speakTarget)
      document.removeEventListener("click", speakTarget)
      window.speechSynthesis.cancel()
    }
  }, [speechLabels])

  useEffect(() => {
    if (!continuousReadingLayout) {
      persistActiveKhatmaProgress()
      largeReadingGenerationRef.current += 1
      setLargeReadingPages([])
      largeReadingPagesRef.current = []
      setContinuousVisiblePage(null)
      setContinuousVisibleVerseKey(null)
      setContinuousAutoScroll(false)
      return
    }
    setViewMode("text")
    setSpreadMode("single")
    if (readingMode === "large") setWideReading(false)
  }, [continuousReadingLayout, persistActiveKhatmaProgress, readingMode])

  const rememberLoadedPage = useCallback((data: LoadedPage) => {
    if (data.reciter === undefined) return
    const cache = pageCacheRef.current
    const key = `${data.reciter}:${data.page}`
    cache.delete(key)
    cache.set(key, data)
    while (cache.size > 12) {
      const oldestKey = cache.keys().next().value as string | undefined
      if (!oldestKey) break
      cache.delete(oldestKey)
    }
  }, [])

  const requestLoadedPage = useCallback((page: number, targetReciter: number) => {
    const cacheKey = `${targetReciter}:${page}`
    const cachedPage = pageCacheRef.current.get(cacheKey)
    if (cachedPage) return Promise.resolve(cachedPage)
    const pendingRequest = pageRequestRef.current.get(cacheKey)
    if (pendingRequest) return pendingRequest

    const request = (async () => {
      let data: PageResponse
      let sourceReciter = targetReciter
      const locallyCachedPage = await loadOfflineQuranPage<PageResponse>(page, targetReciter, false)
        .catch(() => null)
      if (locallyCachedPage?.data.tracks.length) {
        data = locallyCachedPage.data
      } else {
        try {
          const response = await fetch(`/api/quran?page=${page}&reciter=${targetReciter}`)
          const responseData = await response.json().catch(() => null) as PageResponse | null
          if (!response.ok || !responseData?.verses?.length) {
            throw new Error(responseData?.error || "تعذر تحميل الصفحة")
          }
          data = responseData
        } catch (error) {
          const offlinePage = await loadOfflineQuranPage<PageResponse>(page, targetReciter)
            .catch(() => null)
          if (!offlinePage) throw error
          data = offlinePage.data
          sourceReciter = offlinePage.reciter
        }
      }

      validatePageResponse(data, page)
      const hasSelectedReciterData = sourceReciter === targetReciter
      const loadedPage: LoadedPage = {
        page: data.page,
        reciter: targetReciter,
        verses: data.verses,
        tracks: hasSelectedReciterData ? data.tracks : [],
        qcfPage: data.qcfPage,
        recitationSync: hasSelectedReciterData ? data.recitationSync : undefined,
      }
      rememberLoadedPage(loadedPage)
      return loadedPage
    })().finally(() => {
      if (pageRequestRef.current.get(cacheKey) === request) pageRequestRef.current.delete(cacheKey)
    })
    pageRequestRef.current.set(cacheKey, request)
    return request
  }, [rememberLoadedPage])

  const requestReadingPage = useCallback((page: number, targetReciter: number) => {
    const cachedPage = readingPageCacheRef.current.get(page)
    if (cachedPage) return Promise.resolve({ ...cachedPage, reciter: targetReciter })
    const pendingRequest = readingPageRequestRef.current.get(page)
    if (pendingRequest) {
      return pendingRequest.then((data) => ({ ...data, reciter: targetReciter }))
    }

    const request = (async () => {
      const loadLocalPage = () => loadOfflineQuranReadingPage<PageResponse>(page).catch(() => null)
      let data = await loadLocalPage()
      let lastError: Error | null = null

      for (let attempt = 0; !data && attempt <= READING_PAGE_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const response = await fetch(`/api/quran?page=${page}&content=reading`)
          const responseData = await response.json().catch(() => null) as PageResponse | null
          if (!response.ok || !responseData?.verses?.length) {
            throw new Error(responseData?.error || "تعذر تحميل نص الصفحة")
          }
          data = responseData
        } catch (error) {
          lastError = error instanceof Error ? error : new Error("تعذر تحميل نص الصفحة")
          if (attempt >= READING_PAGE_RETRY_DELAYS_MS.length) break
          data = await loadLocalPage()
          if (!data) {
            await new Promise((resolve) => window.setTimeout(resolve, READING_PAGE_RETRY_DELAYS_MS[attempt]))
          }
        }
      }

      if (!data) throw lastError ?? new Error("تعذر تحميل نص الصفحة")
      validatePageResponse(data, page)
      const loadedPage: LoadedPage = {
        page: data.page,
        reciter: targetReciter,
        verses: data.verses,
        tracks: [],
        qcfPage: data.qcfPage,
      }
      readingPageCacheRef.current.set(page, loadedPage)
      return loadedPage
    })().finally(() => {
      if (readingPageRequestRef.current.get(page) === request) readingPageRequestRef.current.delete(page)
    })
    readingPageRequestRef.current.set(page, request)
    return request
  }, [])

  const preloadNavigationPage = useCallback((page: number) => {
    if (page < 1 || page > MAX_PAGE || page === currentPage) return
    void requestReadingPage(page, reciter)
      .then((data) => preloadQcf4PageFonts(data.qcfPage))
      .catch(() => undefined)
    void requestLoadedPage(page, reciter).catch(() => undefined)
  }, [currentPage, reciter, requestLoadedPage, requestReadingPage])

  const appendNextContinuousPage = useCallback(async () => {
    const normalizedPages = normalizeContinuousPageSequence(largeReadingPagesRef.current)
    if (normalizedPages.length !== largeReadingPagesRef.current.length) {
      largeReadingPagesRef.current = normalizedPages
      setLargeReadingPages(normalizedPages)
    }
    const lastPage = normalizedPages.at(-1)?.page
    if (
      !lastPage ||
      lastPage >= MAX_PAGE ||
      largeReadingLoadingRef.current ||
      Date.now() < largeReadingRetryAtRef.current
    ) return false

    const generation = largeReadingGenerationRef.current
    largeReadingLoadingRef.current = true
    try {
      const data = await requestReadingPage(lastPage + 1, reciter)
      await preloadQcf4PageFonts(data.qcfPage).catch(() => undefined)
      if (generation !== largeReadingGenerationRef.current) return false
      const currentPages = largeReadingPagesRef.current
      if (currentPages.some((item) => item.page === data.page)) return true
      if (data.page !== currentPages.at(-1)!.page + 1) return false
      const nextPages = [...currentPages, data]
      largeReadingPagesRef.current = nextPages
      setLargeReadingPages(nextPages)
      largeReadingRetryAtRef.current = 0
      return true
    } catch {
      largeReadingRetryAtRef.current = Date.now() + 1500
      return false
    } finally {
      largeReadingLoadingRef.current = false
    }
  }, [reciter, requestReadingPage])

  const applyLoadedPage = useCallback((data: LoadedPage) => {
    const pendingScope = pendingPlaybackScopeRef.current
    if (pendingScope && (pendingScope.page !== data.page || pendingScope.reciter !== data.reciter)) return
    rememberLoadedPage(data)
    setPageData(data)
    const pendingBookmark = pendingBookmarkRef.current
    if (pendingBookmark?.page === data.page) {
      const pendingVerseIndex = data.verses.findIndex(
        (verse) => verse.verseKey === pendingBookmark.verseKey,
      )
      const pendingTrackIndex = findTrackIndexForVerse(data.tracks, pendingVerseIndex)
      if (pendingTrackIndex >= 0) setTrackIndex(pendingTrackIndex)
      if (pendingVerseIndex >= 0) {
        setVerseIndex(pendingVerseIndex)
        setSelectedVerseKey(pendingBookmark.verseKey)
      }
    }

    const targetVerseKey = pendingVerseTargetRef.current
    if (targetVerseKey) {
      const targetVerseIndex = data.verses.findIndex((verse) => verse.verseKey === targetVerseKey)
      const targetVerse = data.verses[targetVerseIndex]
      const targetTrackIndex = findPlaybackTrackIndex(data.tracks, data.verses, targetVerseIndex)
      if (targetVerseIndex < 0 || !targetVerse || targetTrackIndex < 0) {
        pendingVerseSeekMsRef.current = null
        pendingVerseTargetRef.current = null
        pendingVerseEdgeRef.current = null
        pendingPlaybackScopeRef.current = null
        setIsPlaying(false)
        setError("تعذر تثبيت موضع التلاوة في الصفحة الحالية")
        setIsLoading(false)
        return
      }
      setVerseIndex(targetVerseIndex)
      setSelectedVerseKey(targetVerseKey)
      pendingVerseSeekMsRef.current = getPlaybackStartMs(data.tracks[targetTrackIndex], targetVerse)
      setTrackIndex(targetTrackIndex)
      pendingVerseTargetRef.current = null
      pendingVerseEdgeRef.current = null
      pendingPlaybackScopeRef.current = null
    } else if (pendingVerseEdgeRef.current && data.verses.length > 0) {
      let firstVerseIndex = 0
      let lastVerseIndex = data.verses.length - 1
      const sessionBounds = sessionBoundsRef.current
      if (data.page === sessionBounds.start && sessionBounds.startVerseKey) {
        const index = data.verses.findIndex(
          (verse) => verse.verseKey === sessionBounds.startVerseKey,
        )
        if (index >= 0) firstVerseIndex = index
      }
      if (data.page === sessionBounds.end && sessionBounds.endVerseKey) {
        const index = data.verses.findIndex(
          (verse) => verse.verseKey === sessionBounds.endVerseKey,
        )
        if (index >= 0) lastVerseIndex = index
      }
      const targetVerseIndex = pendingVerseEdgeRef.current === "first"
        ? firstVerseIndex
        : lastVerseIndex
      const targetVerse = data.verses[targetVerseIndex]
      const targetTrackIndex = findPlaybackTrackIndex(data.tracks, data.verses, targetVerseIndex)
      if (!targetVerse || targetTrackIndex < 0) {
        pendingVerseSeekMsRef.current = null
        pendingVerseEdgeRef.current = null
        pendingPlaybackScopeRef.current = null
        setIsPlaying(false)
        setError("تعذر تثبيت بداية الصفحة التالية")
        setIsLoading(false)
        return
      }
      setVerseIndex(targetVerseIndex)
      setSelectedVerseKey(targetVerse.verseKey)
      pendingVerseSeekMsRef.current = getPlaybackStartMs(data.tracks[targetTrackIndex], targetVerse)
      setTrackIndex(targetTrackIndex)
      pendingVerseEdgeRef.current = null
      pendingPlaybackScopeRef.current = null
    } else if (pendingScope) {
      pendingPlaybackScopeRef.current = null
    }
    setIsLoading(false)
  }, [rememberLoadedPage])

  useEffect(() => {
    setImageLoading(viewMode === "image" && !imagePageCacheRef.current.has(currentPage))
  }, [currentPage, viewMode])

  useEffect(() => {
    if (!continuousReadingLayout || viewMode !== "text") return
    let cancelled = false
    const existingPages = largeReadingPagesRef.current
    const normalizedPages = normalizeContinuousPageSequence(existingPages)
    const firstPage = normalizedPages[0]?.page
    const lastPage = normalizedPages.at(-1)?.page
    const canReuseSequence = normalizedPages.length === existingPages.length &&
      normalizedPages.every((page) => page.reciter === reciter) &&
      firstPage !== undefined &&
      lastPage !== undefined &&
      currentPage >= firstPage &&
      currentPage <= lastPage

    if (!canReuseSequence) {
      largeReadingGenerationRef.current += 1
      largeReadingPagesRef.current = []
      setLargeReadingPages([])
    }
    const generation = largeReadingGenerationRef.current
    const targetPage = Math.min(currentPage + 2, MAX_PAGE)
    const loadPages = async () => {
      while (!cancelled && generation === largeReadingGenerationRef.current) {
        const currentPages = largeReadingPagesRef.current
        const loadedThrough = currentPages.at(-1)?.page
        const nextPage = loadedThrough === undefined ? currentPage : loadedThrough + 1
        if (nextPage > targetPage) return
        try {
          const data = await requestReadingPage(nextPage, reciter)
          await preloadQcf4PageFonts(data.qcfPage).catch(() => undefined)
          if (cancelled || generation !== largeReadingGenerationRef.current) return
          const latestPages = largeReadingPagesRef.current
          if (latestPages.some((page) => page.page === data.page)) continue
          const expectedPage = latestPages.at(-1)?.page !== undefined
            ? latestPages.at(-1)!.page + 1
            : currentPage
          if (data.page !== expectedPage) return
          const nextPages = [...latestPages, data]
          largeReadingPagesRef.current = nextPages
          setLargeReadingPages(nextPages)
          largeReadingRetryAtRef.current = 0
        } catch {
          largeReadingRetryAtRef.current = Date.now() + 1500
          await new Promise((resolve) => window.setTimeout(resolve, 1500))
        }
      }
    }
    void loadPages()
    return () => { cancelled = true }
  }, [continuousReadingLayout, currentPage, reciter, requestReadingPage, reloadKey, viewMode])

  useEffect(() => {
    if (!continuousReadingLayout || viewMode !== "text") return
    const container = largeReadingScrollRef.current
    if (!container) return
    let frame = 0
    let active = true
    const updateCurrentPageFromScroll = () => {
      frame = 0
      if (!active || largeReadingScrollRef.current !== container || !container.isConnected) return
      const visibleLocation = getVisibleContinuousLocation(container)
      if (visibleLocation) {
        continuousVisiblePageRef.current = visibleLocation.page
        setContinuousVisiblePage((page) => page === visibleLocation.page ? page : visibleLocation.page)
        setContinuousVisibleVerseKey((verseKey) => (
          verseKey === visibleLocation.verseKey ? verseKey : visibleLocation.verseKey ?? null
        ))
        if (continuousScrollModeRef.current !== "recitation" && visibleLocation.page !== currentPageRef.current) {
          currentPageRef.current = visibleLocation.page
          setCurrentPage(visibleLocation.page)
        }
      }
      const last = container.querySelector<HTMLElement>("[data-large-reading-page]:last-child")
      if (last && last.getBoundingClientRect().bottom < container.getBoundingClientRect().bottom + container.clientHeight * 2) {
        void appendNextContinuousPage()
      }
    }
    const handleScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateCurrentPageFromScroll)
    }
    container.addEventListener("scroll", handleScroll, { passive: true })
    updateCurrentPageFromScroll()
    return () => {
      active = false
      container.removeEventListener("scroll", handleScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [appendNextContinuousPage, continuousReadingLayout, largeReadingPages, viewMode])

  useEffect(() => {
    if (!continuousPageAutoScroll) {
      continuousPageScrollStartedRef.current = false
      return
    }
    if (continuousPageScrollStartedRef.current) return
    const container = largeReadingScrollRef.current
    const currentPageElement = container?.querySelector<HTMLElement>(`[data-large-reading-page="${currentPage}"]`)
    if (!container || !currentPageElement) return
    continuousPageScrollStartedRef.current = true
    container.scrollTop = currentPageElement.offsetTop
  }, [continuousPageAutoScroll, currentPage, largeReadingPages])

  useEffect(() => {
    if (!continuousAutoScroll || continuousScrollStopAt === null) {
      setContinuousScrollTimerRemaining(null)
      if (!continuousAutoScroll) setContinuousScrollStopAt(null)
      return
    }
    if (continuousScrollPaused) {
      setContinuousScrollTimerRemaining(Math.max(0, Math.ceil((continuousScrollStopAt - Date.now()) / 1000)))
      return
    }
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((continuousScrollStopAt - Date.now()) / 1000))
      setContinuousScrollTimerRemaining(remaining)
      if (remaining <= 0) {
        persistActiveKhatmaProgress()
        setContinuousAutoScroll(false)
        setContinuousScrollStopAt(null)
        toast.success("انتهى مؤقت التمرير التلقائي")
      }
    }
    updateRemaining()
    const timer = window.setInterval(updateRemaining, 1000)
    return () => window.clearInterval(timer)
  }, [continuousAutoScroll, continuousScrollPaused, continuousScrollStopAt, persistActiveKhatmaProgress])

  useEffect(() => {
    if (
      !continuousRecitationFollow ||
      !isPlaying ||
      continuousScrollPaused ||
      !currentVerse?.verseKey ||
      !continuousReadingLayout ||
      viewMode !== "text"
    ) return
    if (continuousRecitationManualVerseRef.current === currentVerse.verseKey) return
    continuousRecitationManualVerseRef.current = null
    if (continuousRecitationScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(continuousRecitationScrollFrameRef.current)
    }
    continuousRecitationScrollFrameRef.current = window.requestAnimationFrame(() => {
      continuousRecitationScrollFrameRef.current = null
      const container = largeReadingScrollRef.current
      if (!container) return
      const glyphs = container.querySelectorAll<HTMLElement>(`[data-verse-key="${currentVerse.verseKey}"]`)
      if (!glyphs.length) return
      let top = Number.POSITIVE_INFINITY
      let bottom = Number.NEGATIVE_INFINITY
      glyphs.forEach((glyph) => {
        const rect = glyph.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return
        top = Math.min(top, rect.top)
        bottom = Math.max(bottom, rect.bottom)
      })
      if (!Number.isFinite(top) || !Number.isFinite(bottom)) return
      const containerRect = container.getBoundingClientRect()
      const readingTop = containerRect.top + 44
      const readingBottom = containerRect.bottom - 20
      const verseCenter = (top + bottom) / 2
      const targetCenter = readingTop + (readingBottom - readingTop) * 0.42
      const comfortableTop = readingTop + (readingBottom - readingTop) * 0.2
      const comfortableBottom = readingTop + (readingBottom - readingTop) * 0.66
      if (top >= comfortableTop && bottom <= comfortableBottom) return

      const startPosition = container.scrollTop
      const targetPosition = Math.max(
        0,
        Math.min(container.scrollHeight - container.clientHeight, startPosition + verseCenter - targetCenter),
      )
      const distance = targetPosition - startPosition
      if (Math.abs(distance) < 1) return
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        container.scrollTop = targetPosition
        return
      }
      const duration = Math.min(1500, Math.max(700, Math.abs(distance) * 1.15))
      const startedAt = performance.now()
      const animate = (time: number) => {
        const progress = Math.min(1, (time - startedAt) / duration)
        const eased = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2
        container.scrollTop = startPosition + distance * eased
        if (progress < 1) {
          continuousRecitationScrollFrameRef.current = window.requestAnimationFrame(animate)
        } else {
          continuousRecitationScrollFrameRef.current = null
        }
      }
      continuousRecitationScrollFrameRef.current = window.requestAnimationFrame(animate)
    })
    return () => {
      if (continuousRecitationScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(continuousRecitationScrollFrameRef.current)
        continuousRecitationScrollFrameRef.current = null
      }
    }
  }, [
    continuousReadingLayout,
    continuousRecitationFollow,
    continuousScrollPaused,
    currentVerse?.verseKey,
    isPlaying,
    largeReadingPages,
    viewMode,
  ])

  useEffect(() => {
    const content = continuousScrollContentRef.current
    if (
      !continuousAutoScroll ||
      continuousScrollMode !== "free" ||
      continuousScrollPaused ||
      !continuousReadingLayout ||
      viewMode !== "text"
    ) {
      continuousScrollPositionRef.current = null
      if (content) content.style.removeProperty("transform")
      return
    }
    const container = largeReadingScrollRef.current
    if (!container || !content) return
    let frame = 0
    let lastTime = performance.now()
    continuousScrollPositionRef.current = container.scrollTop
    const tick = (time: number) => {
      const delta = Math.min(50, time - lastTime)
      lastTime = time
      const renderedPosition = container.scrollTop
      const trackedPosition = continuousScrollPositionRef.current ?? renderedPosition
      const position = Math.abs(renderedPosition - Math.floor(trackedPosition)) > 2 ? renderedPosition : trackedPosition
      const nextPosition = position + delta * continuousScrollSpeed * 0.045
      const wholePosition = Math.floor(nextPosition)
      const fractionalOffset = nextPosition - wholePosition
      continuousScrollPositionRef.current = nextPosition
      container.scrollTop = wholePosition
      content.style.transform = `translate3d(0, ${-fractionalOffset}px, 0)`
      const remainingDistance = container.scrollHeight - container.scrollTop - container.clientHeight
      if (remainingDistance < container.clientHeight * 2) void appendNextContinuousPage()
      const reachedEnd = remainingDistance <= 1
      if (reachedEnd && largeReadingPagesRef.current.at(-1)?.page === MAX_PAGE) {
        persistActiveKhatmaProgress()
        setContinuousAutoScroll(false)
        setContinuousScrollStopAt(null)
        setContinuousScrollTimerRemaining(null)
        return
      }
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(frame)
      continuousScrollPositionRef.current = null
      content.style.removeProperty("transform")
    }
  }, [appendNextContinuousPage, continuousAutoScroll, continuousReadingLayout, continuousScrollMode, continuousScrollPaused, continuousScrollSpeed, persistActiveKhatmaProgress, viewMode])

  useEffect(() => {
    if (!continuousReadingLayout || viewMode !== "text") return
    const container = largeReadingScrollRef.current
    if (!container) return
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      event.preventDefault()
      const recitationFollow = continuousAutoScrollRef.current && continuousScrollModeRef.current === "recitation"
      if (recitationFollow) {
        if (continuousRecitationScrollFrameRef.current !== null) {
          window.cancelAnimationFrame(continuousRecitationScrollFrameRef.current)
          continuousRecitationScrollFrameRef.current = null
        }
        continuousRecitationManualVerseRef.current = currentVerseKeyRef.current
      } else if (continuousAutoScrollRef.current && !continuousScrollPausedRef.current) {
        continuousScrollInteractionPauseRef.current = true
        continuousScrollPausedAtRef.current = Date.now()
        continuousScrollContentRef.current?.style.removeProperty("transform")
        continuousScrollPositionRef.current = null
        continuousScrollPausedRef.current = true
        setContinuousScrollPaused(true)
      }
      if (!recitationFollow && continuousScrollResumeTimerRef.current) {
        window.clearTimeout(continuousScrollResumeTimerRef.current)
      }
      container.scrollBy({ top: event.deltaY, behavior: "auto" })
      if (!recitationFollow && continuousAutoScrollRef.current && continuousScrollInteractionPauseRef.current) {
        continuousScrollResumeTimerRef.current = setTimeout(() => {
          continuousScrollResumeTimerRef.current = null
          continuousScrollInteractionPauseRef.current = false
          const pausedAt = continuousScrollPausedAtRef.current
          if (pausedAt !== null) {
            setContinuousScrollStopAt((stopAt) => stopAt === null ? null : stopAt + (Date.now() - pausedAt))
          }
          continuousScrollPausedAtRef.current = null
          continuousScrollPausedRef.current = false
          setContinuousScrollPaused(false)
        }, 180)
      }
    }
    container.addEventListener("wheel", handleWheel, { passive: false })
    return () => {
      container.removeEventListener("wheel", handleWheel)
      if (continuousScrollResumeTimerRef.current) window.clearTimeout(continuousScrollResumeTimerRef.current)
      continuousScrollResumeTimerRef.current = null
    }
  }, [continuousReadingLayout, viewMode])

  useEffect(() => {
    const cacheKey = `${reciter}:${currentPage}`
    const cachedPage = pageCacheRef.current.get(cacheKey)
    setError(null)
    setAudioPlaybackError(null)
    setSelectedVerseKey(undefined)
    setTrackIndex(0)
    setVerseIndex(0)
    setElapsed(0)

    if (cachedPage) {
      setIsLoading(false)
      applyLoadedPage(cachedPage)
      return
    }

    let cancelled = false
    const applyReadingPage = (data: LoadedPage) => {
      setPageData({ ...data, reciter })
      const focusVerseKey = pendingVerseTargetRef.current ?? (
        pendingBookmarkRef.current?.page === data.page ? pendingBookmarkRef.current.verseKey : undefined
      )
      if (focusVerseKey) {
        const targetVerseIndex = data.verses.findIndex((verse) => verse.verseKey === focusVerseKey)
        if (targetVerseIndex >= 0) {
          setVerseIndex(targetVerseIndex)
          setSelectedVerseKey(focusVerseKey)
        }
      }
      setIsLoading(false)
    }
    const cachedReadingPage = readingPageCacheRef.current.get(currentPage)
    if (cachedReadingPage) {
      applyReadingPage(cachedReadingPage)
    } else {
      setIsLoading(true)
      setPageData((current) => current.page === currentPage
        ? current.reciter === reciter
          ? current
          : { ...current, reciter, tracks: [] }
        : { page: currentPage, reciter, verses: [], tracks: [] })
    }

    let fullPageApplied = false
    let readingPageSettled = Boolean(cachedReadingPage)
    let readingPageApplied = Boolean(cachedReadingPage)
    let fullPageError: Error | null = null
    const showPageError = (fetchError: Error) => {
      if (cancelled) return
      const continuousPage = largeReadingPagesRef.current.find((page) => page.page === currentPage)
      if (continuousReadingLayout && continuousPage?.verses.length) {
        setError(null)
        setIsLoading(false)
        return
      }
      setError(fetchError.message)
      setIsLoading(false)
      setIsPlaying(false)
    }

    requestReadingPage(currentPage, reciter)
      .then((data) => {
        readingPageSettled = true
        if (cancelled || fullPageApplied || readingPageApplied) return
        readingPageApplied = true
        applyReadingPage(data)
      })
      .catch((readingError: Error) => {
        readingPageSettled = true
        if (fullPageError) showPageError(readingError)
      })

    requestLoadedPage(currentPage, reciter)
      .then((data) => {
        if (cancelled) return
        fullPageApplied = true
        applyLoadedPage(data)
      })
      .catch((fetchError: Error) => {
        fullPageError = fetchError
        if (readingPageSettled && !readingPageApplied) showPageError(fetchError)
      })

    return () => {
      cancelled = true
    }
  }, [applyLoadedPage, continuousReadingLayout, currentPage, reciter, reloadKey, requestLoadedPage, requestReadingPage])

  useEffect(() => {
    let cancelled = false
    const preloadPage = (
      page: number,
      setData: (data: LoadedPage | null) => void,
    ) => {
      if (page < 1 || page > MAX_PAGE) {
        setData(null)
        return
      }

      if (!imagePageCacheRef.current.has(page)) {
        const pageImage = new window.Image()
        pageImage.onload = () => imagePageCacheRef.current.add(page)
        pageImage.src = `https://cdn.myquran.com/img/page/${page}.png`
        if (pageImage.complete && pageImage.naturalWidth > 0) imagePageCacheRef.current.add(page)
      }

      requestReadingPage(page, reciter)
        .then((data) => {
          if (!cancelled) setData(data)
        })
        .catch(() => undefined)
      requestLoadedPage(page, reciter)
        .then((data) => {
          if (!cancelled) setData(data)
        })
        .catch(() => {
          if (!cancelled && !readingPageCacheRef.current.has(page)) setData(null)
        })
    }

    preloadPage(currentPage - 1, setPreviousPageData)
    preloadPage(currentPage + 1, setNextPageData)
    return () => {
      cancelled = true
    }
  }, [currentPage, readingMode, reciter, requestLoadedPage, requestReadingPage, viewMode])

  useEffect(() => {
    isPlayingRef.current = isPlaying
    if (!isPlaying && verseRepeatTimerRef.current) {
      clearTimeout(verseRepeatTimerRef.current)
      verseRepeatTimerRef.current = null
    }
  }, [isPlaying])

  useEffect(() => {
    if (
      !audioReviewActive ||
      !isPlaying ||
      !currentTrack ||
      ["bismillah", "chapter", "page"].includes(currentTrack.timingMode ?? "")
    ) return
    let frame = 0
    const syncReviewVerse = () => {
      const audio = audioRef.current
      if (audio && !audio.paused && audio.src === currentTrack.audioUrl) {
        const reveal = findAudioReviewReveal(
          currentTrack,
          verses,
          audio.currentTime * 1000,
          audio.playbackRate,
          audioReviewRevealMode,
        )
        if (reveal) {
          setAudioReviewState((state) => {
            if (!state) return null
            if (
              state.page === currentPage &&
              state.revealIndex === reveal.revealIndex &&
              state.visibleWordPosition === reveal.visibleWordPosition &&
              state.transitionPlaybackRate === reveal.transitionPlaybackRate
            ) return state
            return { page: currentPage, ...reveal }
          })
        }
      }
      frame = window.requestAnimationFrame(syncReviewVerse)
    }
    frame = window.requestAnimationFrame(syncReviewVerse)
    return () => window.cancelAnimationFrame(frame)
  }, [audioReviewActive, audioReviewRevealMode, currentPage, currentTrack, isPlaying, verses])

  useEffect(() => {
    if (!dashboardOpen) return
    quickNavigatorPageRef.current = currentPage
    setQuickNavigatorPage(currentPage)
  }, [currentPage, dashboardOpen])

  useEffect(() => {
    if ((!quickNavigatorOpen && !dashboardOpen && !navigationOpen && browseActivity === "read") || quickNavigationData) return
    void loadQuranNavigation<QuickNavigationData>()
      .then(setQuickNavigationData)
      .catch(() => setQuickNavigationData(null))
  }, [browseActivity, dashboardOpen, navigationOpen, quickNavigationData, quickNavigatorOpen])

  useEffect(() => {
    const query = quickNavigatorQuery.trim()
    if (!isQuranSearchQueryReady(query)) {
      setQuickNavigatorResults([])
      setQuickNavigatorResultCount(0)
      return
    }

    const localResults = localQuickNavigationSearch(quickNavigationData, query, language)
    if (isStructuralQuranSearch(query)) {
      if (localResults[0]) preloadNavigationPage(localResults[0].page)
      setQuickNavigatorResults(localResults)
      setQuickNavigatorResultCount(localResults.length)
      return
    }

    setQuickNavigatorResults(localResults)
    setQuickNavigatorResultCount(localResults.length)
    let cancelled = false
    const timer = window.setTimeout(() => {
      const runSearch = async () => {
        try {
          if (navigator.onLine === false) throw new Error("OFFLINE")
          const response = await fetch(`/api/quran/navigation?v=4&q=${encodeURIComponent(query)}`)
          const data = await response.json() as { results?: QuickNavigatorResult[]; totalResults?: number }
          if (!response.ok) throw new Error("تعذر البحث")
          if (cancelled) return
          const results = data.results ?? []
          const seen = new Set<string>()
          const merged = rankQuranSearchResults(
            [...localResults, ...results]
              .map((result) => ({ ...result, id: result.id ?? `${result.kind ?? "verse"}-${result.verseKey}` }))
              .filter((result) => {
                if (seen.has(result.id)) return false
                seen.add(result.id)
                return true
              }),
            query,
          )
          if (merged[0]) preloadNavigationPage(merged[0].page)
          setQuickNavigatorResults(merged)
          setQuickNavigatorResultCount(Math.max(merged.length, (data.totalResults ?? results.length) + localResults.length))
        } catch {
          const offline = await searchOfflineQuran(query)
          if (cancelled) return
          const merged = rankQuranSearchResults([...localResults, ...offline.results.map((result) => ({
            ...result,
            id: `verse-${result.verseKey}`,
            kind: "verse" as const,
          }))], query)
          if (merged[0]) preloadNavigationPage(merged[0].page)
          setQuickNavigatorResults(merged)
          setQuickNavigatorResultCount(Math.max(merged.length, offline.totalResults + localResults.length))
        }
      }
      void runSearch()
    }, 220)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [language, preloadNavigationPage, quickNavigationData, quickNavigatorQuery])

  useEffect(() => {
    if (!quickNavigatorOpen && !dashboardOpen) return
    const query = quickNavigatorQuery.trim()
    if (isQuranSearchQueryReady(query)) {
      const localTarget = localQuickNavigationSearch(quickNavigationData, query, language)[0]
      const targetPage = localTarget?.page ?? quickNavigatorResults[0]?.page
      if (targetPage && targetPage !== currentPage) preloadNavigationPage(targetPage)
      return
    }

    const targetPage = Math.round(quickNavigatorPage)
    if (targetPage === currentPage) return
    const timer = window.setTimeout(() => preloadNavigationPage(targetPage), 100)
    return () => window.clearTimeout(timer)
  }, [
    currentPage,
    dashboardOpen,
    language,
    preloadNavigationPage,
    quickNavigationData,
    quickNavigatorOpen,
    quickNavigatorPage,
    quickNavigatorQuery,
    quickNavigatorResults,
  ])

  useEffect(() => {
    return () => {
      if (verseRepeatTimerRef.current) clearTimeout(verseRepeatTimerRef.current)
      if (speedLongPressTimerRef.current) clearTimeout(speedLongPressTimerRef.current)
      if (quickNavigatorArrowHoldTimerRef.current) clearTimeout(quickNavigatorArrowHoldTimerRef.current)
    }
  }, [])

  useEffect(() => {
    speedRef.current = speed
    const audio = audioRef.current
    if (!audio) return
    syncAudioPlaybackSpeed(audio, speed)
  }, [speed])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (!currentTrack) {
      audio.pause()
      return
    }

    if (audio.src !== currentTrack.audioUrl) {
      audio.src = currentTrack.audioUrl
      audio.load()
      return
    }

    const startTime = currentTrack.startMs / 1000
    const endTime = currentTrack.endMs / 1000
    const pendingBookmark = pendingBookmarkRef.current
    const pendingVerseSeekMs = pendingVerseSeekMsRef.current
    const seamlessTransition = seamlessAudioTransitionRef.current
    const preserveContinuousAudio = Boolean(
      seamlessTransition &&
      seamlessTransition.page === currentPage &&
      seamlessTransition.reciter === reciter &&
      seamlessTransition.audioUrl === currentTrack.audioUrl,
    )
    if (seamlessTransition && !preserveContinuousAudio) seamlessAudioTransitionRef.current = null
    if (preserveContinuousAudio) {
      pendingVerseSeekMsRef.current = null
    } else if (
      pendingBookmark?.page === currentPage &&
      pendingBookmark.chapterId === currentTrack.chapterId
    ) {
      audio.currentTime = pendingBookmark.positionMs / 1000
      pendingBookmarkRef.current = null
    } else if (
      pendingVerseSeekMs !== null &&
      pendingVerseSeekMs >= currentTrack.startMs &&
      pendingVerseSeekMs <= currentTrack.endMs
    ) {
      audio.currentTime = pendingVerseSeekMs / 1000
      pendingVerseSeekMsRef.current = null
    } else {
      if (pendingVerseSeekMs !== null) pendingVerseSeekMsRef.current = null
      if (audio.currentTime < startTime - 0.1 || audio.currentTime >= endTime) {
        audio.currentTime = startTime
      }
    }

    if (isPlaying) {
      if (audio.paused) audio.play().catch(reportAudioPlaybackFailure)
    } else {
      audio.pause()
    }
  }, [currentPage, currentTrack, isPlaying, reciter, reportAudioPlaybackFailure])

  useEffect(() => {
    if (!currentTrack || !["verse", "bismillah"].includes(currentTrack.timingMode ?? "") || !isPlaying) return
    const nextTrack = tracks[trackIndex + 1]
    if (!nextTrack) return
    const nextAudio = new Audio()
    nextAudio.preload = "auto"
    nextAudio.src = nextTrack.audioUrl
    nextAudio.load()
    return () => {
      nextAudio.src = ""
    }
  }, [currentTrack, isPlaying, trackIndex, tracks])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    if (sleepTimerEndAt === null) {
      setSleepTimerRemaining(null)
      if (audioRef.current) audioRef.current.volume = volume
      return
    }
    const audio = audioRef.current
    const tick = () => {
      const remainingMs = sleepTimerEndAt - Date.now()
      setSleepTimerRemaining(Math.max(0, Math.ceil(remainingMs / 1000)))
      if (audio && remainingMs <= 10_000) {
        audio.volume = volume * Math.max(0, remainingMs / 10_000)
      }
      if (remainingMs > 0) return
      audio?.pause()
      if (audio) audio.volume = volume
      isPlayingRef.current = false
      setIsPlaying(false)
      setSleepTimerEndAt(null)
      setPlaybackStopMode("off")
      setStopAtSurahEnd(false)
      toast.success("توقف الصوت بعد انتهاء المؤقت")
    }
    tick()
    const timer = window.setInterval(tick, 250)
    return () => {
      window.clearInterval(timer)
      if (audio) audio.volume = volume
    }
  }, [sleepTimerEndAt, volume])

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        setIsFullscreen(
          document.fullscreenElement === document.documentElement ||
          document.fullscreenElement === mushafStageRef.current,
        )
        return
      }
      if (!document.fullscreenEnabled) return
      setIsFullscreen(false)
      setQuietMode(false)
      setReaderChromeVisible(true)
      setNavigationOpen(chromePanelsRef.current.navigation)
      setSessionSettingsOpen(chromePanelsRef.current.session)
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!isFullscreen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isFullscreen])

  useEffect(() => {
    if (!autoScroll || viewMode !== "image" || !currentVerse || isFullscreen) return
    const frame = window.requestAnimationFrame(() => {
      const pageElement = currentPageExportRef.current
      if (!pageElement) return
      const lineNumbers = currentVerse.words.map((word) => word.lineNumber).filter(Boolean)
      if (lineNumbers.length === 0) return
      const lineNumber = lineNumbers.reduce((total, line) => total + line, 0) / lineNumbers.length
      const ratio = currentPage <= 2
        ? 0.2 + ((lineNumber - 1) / 7) * 0.58
        : 0.1 + ((lineNumber - 1) / 14) * 0.82
      const pageRect = pageElement.getBoundingClientRect()
      const verseY = pageRect.top + pageRect.height * ratio
      const topBoundary = 72
      const playerRect = document.querySelector<HTMLElement>("[data-quran-player]")?.getBoundingClientRect()
      const bottomBoundary = playerRect && playerRect.height > 0
        ? playerRect.top - 12
        : window.innerHeight - 24
      if (verseY >= topBoundary && verseY <= bottomBoundary) return
      window.scrollBy({
        top: verseY - (topBoundary + bottomBoundary) / 2,
        behavior: "smooth",
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [autoScroll, currentPage, currentVerse, isFullscreen, viewMode])

  useEffect(() => {
    advancingRef.current = false
  }, [currentPage, trackIndex])

  const moveToPage = useCallback((page: number, targetVerseKey?: string, targetReciter = reciter) => {
    const nextPage = Math.min(Math.max(page, 1), MAX_PAGE)
    pendingVerseTargetRef.current = null
    pendingVerseEdgeRef.current = null
    pendingVerseSeekMsRef.current = null
    pendingPlaybackScopeRef.current = null
    seamlessAudioTransitionRef.current = null
    setHighlightDraft(null)
    setIsPlaying(false)
    setElapsed(0)
    setAudioReviewState((state) => state ? { page: nextPage, revealIndex: -1 } : null)

    if (targetVerseKey) {
      setSelectedVerseKey(targetVerseKey)
      pendingVerseTargetRef.current = targetVerseKey
      pendingPlaybackScopeRef.current = { page: nextPage, reciter: targetReciter }
      if (nextPage === currentPage && targetReciter === reciter) {
        const targetVerseIndex = verses.findIndex((verse) => verse.verseKey === targetVerseKey)
        if (targetVerseIndex >= 0) {
          const targetTrackIndex = findPlaybackTrackIndex(tracks, verses, targetVerseIndex)
          const seekMs = getPlaybackStartMs(tracks[targetTrackIndex], verses[targetVerseIndex])
          setVerseIndex(targetVerseIndex)
          setAudioReviewState((state) => state
            ? { page: nextPage, revealIndex: targetVerseIndex - 1 }
            : null)
          pendingVerseSeekMsRef.current = seekMs
          if (targetTrackIndex >= 0) setTrackIndex(targetTrackIndex)
          if (
            audioRef.current &&
            targetTrackIndex >= 0 &&
            audioRef.current.src === tracks[targetTrackIndex].audioUrl
          ) {
            audioRef.current.currentTime = seekMs / 1000
            pendingVerseSeekMsRef.current = null
          }
          pendingVerseTargetRef.current = null
          pendingPlaybackScopeRef.current = null
        }
      }
    } else {
      setSelectedVerseKey(undefined)
    }

    if (nextPage !== currentPage) {
      if (window.matchMedia("(min-width: 640px)").matches) {
        mushafStageRef.current?.scrollTo({ top: 0 })
      }
      setTrackIndex(0)
      setVerseIndex(0)
      setCurrentPage(nextPage)
    }
  }, [currentPage, reciter, setElapsed, setIsPlaying, tracks, verses])

  const navigateToMutashabih = (item: MutashabihatVerse) => {
    setReadingReturnLocation((current) => current ?? {
      page: currentPage,
      verseKey: currentVerse?.verseKey,
    })
    setMutashabihatOpen(false)
    moveToPage(item.page, item.verseKey)
  }

  const returnFromMutashabihat = () => {
    if (!readingReturnLocation) return
    const location = readingReturnLocation
    setReadingReturnLocation(null)
    moveToPage(location.page, location.verseKey)
  }

  const finishQuickNavigation = (page: number, verseKey?: string) => {
    setDashboardOpen(false)
    setQuickNavigatorOpen(false)
    setQuickNavigatorQuery("")
    moveToPage(page, verseKey)
  }

  const openQuickNavigator = () => {
    quickNavigatorPageRef.current = currentPage
    setQuickNavigatorPage(currentPage)
    setQuickNavigatorOpen(true)
  }

  const updateQuickNavigatorPage = (page: number) => {
    const nextPage = clamp(page, 1, MAX_PAGE)
    quickNavigatorPageRef.current = nextPage
    setQuickNavigatorPage(nextPage)
    return nextPage
  }

  const handleQuickNavigatorTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const pressedPage = Number((event.target as Element).closest<HTMLButtonElement>("button[data-page]")?.dataset.page)
    setQuickNavigatorDragging(true)
    quickNavigatorTrackStartXRef.current = event.clientX
    quickNavigatorTrackStartPageRef.current = quickNavigatorPageRef.current
    quickNavigatorPressedPageRef.current = Number.isFinite(pressedPage) ? pressedPage : null
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const quickNavigatorSnapStations = (track: string | undefined) => {
    if (!quickNavigationData) return { pages: [] as number[], threshold: 0 }
    if (track === "chapters") {
      return { pages: quickNavigationData.chapters.map((item) => item.startPage), threshold: 2.4 }
    }
    if (track === "juzs") {
      return { pages: quickNavigationData.juzs.map((item) => item.startPage), threshold: 2.4 }
    }
    return {
      pages: [
        ...quickNavigationData.chapters.map((item) => item.startPage),
        ...quickNavigationData.juzs.map((item) => item.startPage),
      ],
      threshold: 1.2,
    }
  }

  const snapQuickNavigatorTrackPage = (rawPage: number, track: string | undefined, settle = false) => {
    const { pages, threshold } = quickNavigatorSnapStations(track)
    const nearestStation = pages.reduce<number | null>((nearest, station) => {
      if (Math.abs(station - rawPage) > threshold) return nearest
      if (nearest === null || Math.abs(station - rawPage) < Math.abs(nearest - rawPage)) return station
      return nearest
    }, null)
    if (nearestStation === null) return rawPage
    if (settle) return nearestStation
    const distance = rawPage - nearestStation
    const easedDistance = Math.sign(distance) * Math.pow(Math.abs(distance) / threshold, 1.7) * threshold
    return nearestStation + easedDistance
  }

  const handleQuickNavigatorTrackPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (quickNavigatorTrackStartXRef.current === null) return
    if (Math.abs(event.clientX - quickNavigatorTrackStartXRef.current) > 4) {
      quickNavigatorPressedPageRef.current = null
      // eslint-disable-next-line react-hooks/purity
      quickNavigatorSuppressClickUntilRef.current = Date.now() + 300
    }
    const trackWidth = event.currentTarget.getBoundingClientRect().width
    const rawPage = clamp(
      quickNavigatorTrackStartPageRef.current +
        (event.clientX - quickNavigatorTrackStartXRef.current) / Math.max(1, trackWidth / quickNavigatorWindowSpan),
      1,
      MAX_PAGE,
    )
    updateQuickNavigatorPage(snapQuickNavigatorTrackPage(rawPage, event.currentTarget.dataset.navigatorTrack))
  }

  const releaseQuickNavigatorPointer = (event: PointerEvent<HTMLDivElement>) => {
    quickNavigatorTrackStartXRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleQuickNavigatorTrackPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const startX = quickNavigatorTrackStartXRef.current
    const moved = startX !== null && Math.abs(event.clientX - startX) > 4
    let targetPage = quickNavigatorPageRef.current
    if (!moved) {
      if (quickNavigatorPressedPageRef.current !== null) {
        targetPage = quickNavigatorPressedPageRef.current
      } else {
        const bounds = event.currentTarget.getBoundingClientRect()
        targetPage += (bounds.left + bounds.width / 2 - event.clientX) / Math.max(1, bounds.width / quickNavigatorWindowSpan)
      }
    }
    const page = clamp(
      Math.round(
        !moved && quickNavigatorPressedPageRef.current !== null
          ? targetPage
          : snapQuickNavigatorTrackPage(
              targetPage,
              event.currentTarget.dataset.navigatorTrack,
              true,
            ),
      ),
      1,
      MAX_PAGE,
    )
    // eslint-disable-next-line react-hooks/purity
    if (!moved) quickNavigatorSuppressClickUntilRef.current = Date.now() + 120
    quickNavigatorPressedPageRef.current = null
    releaseQuickNavigatorPointer(event)
    updateQuickNavigatorPage(page)
    setQuickNavigatorDragging(false)
  }

  const cancelQuickNavigatorPointer = () => {
    quickNavigatorTrackStartXRef.current = null
    quickNavigatorPressedPageRef.current = null
    setQuickNavigatorDragging(false)
  }

  const quickNavigatorButtonPage = (event: MouseEvent<HTMLButtonElement>) =>
    clamp(Number(event.currentTarget.dataset.page), 1, MAX_PAGE)

  const handleQuickNavigatorPageClick = (event: MouseEvent<HTMLButtonElement>) => {
    // eslint-disable-next-line react-hooks/purity
    if (Date.now() < quickNavigatorSuppressClickUntilRef.current) return
    updateQuickNavigatorPage(quickNavigatorButtonPage(event))
  }

  const startContinuousAutoScroll = () => {
    if (readingMode !== "large") {
      setViewMode("text")
      setReadingMode("page")
      setWideReading(true)
      setSpreadMode("single")
    }
    const mode = isPlaying && hasVerseSynchronization ? "recitation" : "free"
    continuousScrollPausedAtRef.current = null
    continuousScrollPausedRef.current = false
    continuousScrollModeRef.current = mode
    continuousRecitationManualVerseRef.current = null
    continuousAutoScrollRef.current = true
    setContinuousVisiblePage(currentPage)
    setContinuousVisibleVerseKey(currentVerse?.verseKey ?? null)
    setContinuousScrollMode(mode)
    setContinuousScrollPaused(false)
    setContinuousAutoScroll(true)
  }

  const stopContinuousAutoScroll = () => {
    continuousScrollContentRef.current?.style.removeProperty("transform")
    continuousScrollPositionRef.current = null
    const scrollContainer = largeReadingScrollRef.current
    const visibleLocation = scrollContainer ? getVisibleContinuousLocation(scrollContainer) : undefined
    const visiblePage = visibleLocation?.page ?? continuousVisiblePageRef.current ?? currentPageRef.current
    persistActiveKhatmaProgress(visiblePage)
    currentPageRef.current = visiblePage
    flushSync(() => setCurrentPage(visiblePage))
    if (continuousScrollResumeTimerRef.current) window.clearTimeout(continuousScrollResumeTimerRef.current)
    continuousScrollResumeTimerRef.current = null
    continuousScrollInteractionPauseRef.current = false
    continuousRecitationManualVerseRef.current = null
    if (continuousRecitationScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(continuousRecitationScrollFrameRef.current)
      continuousRecitationScrollFrameRef.current = null
    }
    continuousScrollPausedAtRef.current = null
    continuousScrollPausedRef.current = false
    continuousScrollModeRef.current = "free"
    continuousAutoScrollRef.current = false
    continuousVisiblePageRef.current = null
    setContinuousVisiblePage(null)
    setContinuousVisibleVerseKey(null)
    setContinuousScrollMode("free")
    setContinuousScrollPaused(false)
    setContinuousAutoScroll(false)
    setContinuousScrollStopAt(null)
    setContinuousScrollTimerRemaining(null)
  }

  const pauseContinuousScroll = () => {
    if (!continuousAutoScroll || continuousScrollPaused) return
    continuousScrollPausedAtRef.current = Date.now()
    continuousScrollContentRef.current?.style.removeProperty("transform")
    continuousScrollPositionRef.current = null
    continuousScrollPausedRef.current = true
    setContinuousScrollPaused(true)
  }

  const resumeContinuousScroll = () => {
    const pausedAt = continuousScrollPausedAtRef.current
    if (pausedAt !== null) {
      const pausedDuration = Date.now() - pausedAt
      setContinuousScrollStopAt((stopAt) => stopAt === null ? null : stopAt + pausedDuration)
    }
    continuousScrollPausedAtRef.current = null
    continuousScrollPausedRef.current = false
    setContinuousScrollPaused(false)
  }

  const toggleContinuousScrollPause = () => {
    if (continuousScrollPaused) resumeContinuousScroll()
    else pauseContinuousScroll()
  }

  const pauseContinuousScrollForInteraction = () => {
    if (!continuousAutoScroll) return
    if (continuousScrollModeRef.current === "recitation") {
      if (continuousRecitationScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(continuousRecitationScrollFrameRef.current)
        continuousRecitationScrollFrameRef.current = null
      }
      continuousRecitationManualVerseRef.current = currentVerseKeyRef.current
      return
    }
    if (continuousScrollPaused) return
    continuousScrollInteractionPauseRef.current = true
    pauseContinuousScroll()
  }

  const resumeContinuousScrollAfterInteraction = () => {
    if (continuousScrollModeRef.current === "recitation") return
    if (!continuousScrollInteractionPauseRef.current) return
    continuousScrollInteractionPauseRef.current = false
    resumeContinuousScroll()
  }

  const cycleContinuousScrollSpeed = () => {
    const nextSpeed = CONTINUOUS_SCROLL_SPEED_PRESETS.find((speed) => speed > continuousScrollSpeed + 0.001)
      ?? CONTINUOUS_SCROLL_SPEED_PRESETS[0]
    setContinuousScrollSpeed(nextSpeed)
  }

  const setContinuousScrollTimer = (minutes: number | null) => {
    if (minutes === null) {
      setContinuousScrollStopAt(null)
      setContinuousScrollTimerRemaining(null)
      return
    }
    setContinuousScrollStopAt(Date.now() + minutes * 60_000)
  }

  const stepQuickNavigatorTrack = (track: "pages" | "chapters" | "juzs", direction: -1 | 1) => {
    if (track === "pages") {
      updateQuickNavigatorPage(clamp(Math.round(quickNavigatorPageRef.current) + direction, 1, MAX_PAGE))
      return
    }
    const items = track === "chapters" ? quickNavigationData?.chapters : quickNavigationData?.juzs
    if (!items?.length) return
    const displayPage = clamp(Math.round(quickNavigatorPageRef.current), 1, MAX_PAGE)
    const currentIndex = items.findIndex((item) =>
      displayPage >= item.startPage && displayPage <= item.endPage)
    const target = items[clamp(currentIndex + direction, 0, items.length - 1)]
    if (target) updateQuickNavigatorPage(target.startPage)
  }

  const stopQuickNavigatorArrowHold = () => {
    if (quickNavigatorArrowHoldTimerRef.current) clearTimeout(quickNavigatorArrowHoldTimerRef.current)
    quickNavigatorArrowHoldTimerRef.current = null
  }

  const startQuickNavigatorArrowHold = (
    track: "pages" | "chapters" | "juzs",
    direction: -1 | 1,
  ) => {
    stopQuickNavigatorArrowHold()
    quickNavigatorArrowHeldRef.current = false
    let repeats = 0
    const repeat = () => {
      quickNavigatorArrowHeldRef.current = true
      stepQuickNavigatorTrack(track, direction)
      repeats += 1
      quickNavigatorArrowHoldTimerRef.current = setTimeout(repeat, Math.max(55, 170 - repeats * 12))
    }
    quickNavigatorArrowHoldTimerRef.current = setTimeout(repeat, 420)
  }

  const clickQuickNavigatorArrow = (
    track: "pages" | "chapters" | "juzs",
    direction: -1 | 1,
  ) => {
    stopQuickNavigatorArrowHold()
    if (quickNavigatorArrowHeldRef.current) {
      quickNavigatorArrowHeldRef.current = false
      return
    }
    stepQuickNavigatorTrack(track, direction)
  }

  const handleQuickNavigatorCommit = () => {
    finishQuickNavigation(clamp(Math.round(quickNavigatorPage), 1, MAX_PAGE))
  }

  const handleQuickNavigatorResultClick = (event: MouseEvent<HTMLButtonElement>) => {
    finishQuickNavigation(
      clamp(Number(event.currentTarget.dataset.page), 1, MAX_PAGE),
      event.currentTarget.dataset.verseKey,
    )
  }

  const clearPageSwipeTimer = () => {
    if (!pageSwipeTimerRef.current) return
    clearTimeout(pageSwipeTimerRef.current)
    pageSwipeTimerRef.current = null
  }

  const resetTouchTracking = () => {
    touchStartXRef.current = null
    touchStartYRef.current = null
    touchStartTimeRef.current = 0
    touchAxisRef.current = null
  }

  const settlePageSwipe = (direction: Exclude<PageSwipeDirection, 0> | null) => {
    const stageWidth = mushafStageRef.current?.getBoundingClientRect().width ?? window.innerWidth
    clearPageSwipeTimer()
    setPageSwipeAnimating(true)
    // eslint-disable-next-line react-hooks/purity
    suppressPageClickUntilRef.current = Date.now() + PAGE_SWIPE_SETTLE_MS + 120

    if (direction === null) {
      setPageSwipeOffset(0)
      pageSwipeTimerRef.current = setTimeout(() => {
        pageSwipeTimerRef.current = null
        setPageSwipeAnimating(false)
        setPageSwipeDirection(0)
      }, PAGE_SWIPE_SETTLE_MS)
      return
    }

    const targetPage = currentPage + (direction === 1 ? 1 : -1)
    if (pageData.page === currentPage && pageData.reciter === reciter) rememberLoadedPage(pageData)
    setPageSwipeDirection(direction)
    setPageSwipeOffset(direction * stageWidth)
    pageSwipeTimerRef.current = setTimeout(() => {
      pageSwipeTimerRef.current = null
      const completePageSwipe = (targetData?: LoadedPage) => {
        if (targetData) setPageData(targetData)
        setPreviousPageData(pageCacheRef.current.get(`${reciter}:${targetPage - 1}`) ?? null)
        setNextPageData(pageCacheRef.current.get(`${reciter}:${targetPage + 1}`) ?? null)
        moveToPage(targetPage)
        setPageSwipeAnimating(false)
        setPageSwipeOffset(0)
        setPageSwipeDirection(0)
      }
      const prepareAndCompletePageSwipe = async (targetData: LoadedPage) => {
        if (viewMode === "text" && readingMode === "page") {
          await preloadQcf4PageFonts(targetData.qcfPage).catch(() => undefined)
        }
        completePageSwipe(targetData)
      }
      const targetData = pageCacheRef.current.get(`${reciter}:${targetPage}`)
      if (targetData) {
        void prepareAndCompletePageSwipe(targetData)
        return
      }
      requestLoadedPage(targetPage, reciter)
        .then(prepareAndCompletePageSwipe)
        .catch(() => completePageSwipe())
    }, PAGE_SWIPE_SETTLE_MS)
  }

  const handlePageWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (
      readingMode === "large" ||
      practiceActive ||
      quickNavigatorOpen ||
      (lineReadingLayout && readerFocusActive) ||
      (viewMode === "text" && readingMode === "page" && window.matchMedia("(min-width: 640px)").matches)
    ) return
    if (Math.abs(event.deltaY) < 16 || wheelPageLockRef.current) return
    event.preventDefault()
    wheelPageLockRef.current = true
    window.setTimeout(() => { wheelPageLockRef.current = false }, 260)
    moveToPage(currentPage + (event.deltaY > 0 ? 1 : -1))
  }

  const handlePageTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (readingMode === "large") {
      resetTouchTracking()
      return
    }
    const target = event.target as HTMLElement
    if (continuousAutoScroll && target.closest("[data-quran-scroll-container]")) {
      resetTouchTracking()
      return
    }
    if (
      practiceActive ||
      pageSwipeAnimating ||
      event.touches.length !== 1 ||
      target.closest("button, input, select, textarea, [data-highlight-handle], [contenteditable='true']")
    ) {
      resetTouchTracking()
      return
    }
    const touch = event.touches[0]
    touchStartXRef.current = touch.clientX
    touchStartYRef.current = touch.clientY
    // eslint-disable-next-line react-hooks/purity
    touchStartTimeRef.current = performance.now()
    touchAxisRef.current = "pending"
    setPageSwipeDirection(0)
    setPageSwipeOffset(0)
  }

  const handlePageTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null || event.touches.length !== 1) return
    const touch = event.touches[0]
    const distanceX = touch.clientX - touchStartXRef.current
    const distanceY = touch.clientY - touchStartYRef.current
    if (touchAxisRef.current === "pending") {
      if (Math.max(Math.abs(distanceX), Math.abs(distanceY)) < 8) return
      touchAxisRef.current = Math.abs(distanceX) > Math.abs(distanceY) * 1.15 ? "horizontal" : "vertical"
    }
    if (touchAxisRef.current === "vertical") {
      const matchesSearchGesture = searchGestureDirection === "up"
        ? distanceY < -24
        : distanceY > 24
      if (
        searchGestureEnabled &&
        matchesSearchGesture &&
        !practiceActive &&
        !quickNavigatorOpen &&
        readingMode !== "large" &&
        !(lineReadingLayout && readerFocusActive)
      ) {
        event.preventDefault()
        // eslint-disable-next-line react-hooks/purity
        suppressPageClickUntilRef.current = Date.now() + 400
        openQuickNavigator()
        resetTouchTracking()
      }
      return
    }
    if (touchAxisRef.current !== "horizontal") return

    event.preventDefault()
    // eslint-disable-next-line react-hooks/purity
    suppressPageClickUntilRef.current = Date.now() + 500
    const direction: Exclude<PageSwipeDirection, 0> = distanceX < 0 ? -1 : 1
    const atBoundary = (direction === 1 && currentPage >= MAX_PAGE) || (direction === -1 && currentPage <= 1)
    const stageWidth = mushafStageRef.current?.getBoundingClientRect().width ?? window.innerWidth
    const boundedDistance = Math.max(-stageWidth, Math.min(stageWidth, distanceX * (atBoundary ? 0.18 : 1)))
    setPageSwipeDirection(direction)
    setPageSwipeOffset(boundedDistance)
  }

  const handlePageTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null || touchAxisRef.current !== "horizontal") {
      resetTouchTracking()
      return
    }
    const distance = (event.changedTouches[0]?.clientX ?? touchStartXRef.current) - touchStartXRef.current
    // eslint-disable-next-line react-hooks/purity
    const duration = Math.max(1, performance.now() - touchStartTimeRef.current)
    const direction: Exclude<PageSwipeDirection, 0> = distance < 0 ? -1 : 1
    const targetAvailable = direction === 1 ? currentPage < MAX_PAGE : currentPage > 1
    const stageWidth = mushafStageRef.current?.getBoundingClientRect().width ?? window.innerWidth
    const threshold = Math.min(96, Math.max(55, stageWidth * 0.16))
    const shouldTurn = targetAvailable && (Math.abs(distance) >= threshold || Math.abs(distance) / duration >= 0.5)
    resetTouchTracking()
    settlePageSwipe(shouldTurn ? direction : null)
  }

  const handlePageTouchCancel = () => {
    const wasHorizontal = touchAxisRef.current === "horizontal"
    resetTouchTracking()
    if (wasHorizontal) settlePageSwipe(null)
  }

  useEffect(() => () => {
    clearPageSwipeTimer()
    if (sessionLongPressTimerRef.current !== null) window.clearTimeout(sessionLongPressTimerRef.current)
    if (sessionLongPressSuppressionTimerRef.current !== null) window.clearTimeout(sessionLongPressSuppressionTimerRef.current)
  }, [])

  const setSessionNavigationRange = useCallback((range: NavigationRange) => {
    const start = Math.min(Math.max(range.startPage, 1), MAX_PAGE)
    const end = Math.min(Math.max(range.endPage, start), MAX_PAGE)
    draftSessionRangeRef.current = {
      startPage: start,
      endPage: end,
      startVerseKey: range.startVerseKey,
      endVerseKey: range.endVerseKey,
    }
    setDraftStart(start)
    setDraftCount(end - start + 1)
    setDraftStartVerseKey(range.startVerseKey)
    setDraftEndVerseKey(range.endVerseKey)
    setAyahRepeatEnabled(Boolean(range.repeatVerse))
    try {
      const savedSettings = JSON.parse(
        window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "{}",
      ) as Record<string, unknown>
      window.localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          ...savedSettings,
          startPage: start,
          pageCount: end - start + 1,
          startVerseKey: range.startVerseKey,
          endVerseKey: range.endVerseKey,
        }),
      )
    } catch {
      // The regular settings effect retries persistence after the state update.
    }
  }, [])

  const configureSession = (session: SavedSessionPreset | SessionHistoryItem) => {
    const savedSession = "name" in session ? session : null
    setSessionNavigationRange({
      startPage: session.startPage,
      endPage: session.endPage,
      startVerseKey: session.startVerseKey,
      endVerseKey: session.endVerseKey,
    })
    setSessionMode(session.mode)
    setBrowseActivity(session.mode)
    setTestKind(session.testKind === "mutashabihat" ? "mutashabihat" : "standard")
    setMutashabihatTestTypes(normalizeMutashabihatTypes(session.mutashabihatTypes))
    setSessionSettingsOpen(true)
    setEditingSavedSessionId(savedSession?.id ?? null)
    setSavedSessionName(savedSession?.name ?? "")
    if (RECITERS.some((item) => item.id === session.reciter)) {
      setReciter(session.reciter)
      window.localStorage.setItem(RECITER_STORAGE_KEY, String(session.reciter))
    }
    setRepeatTarget(normalizeRepeatTarget(session.repeatTarget))
    setAyahRepeatEnabled(Boolean(session.ayahRepeatEnabled))
    setAyahRepeatCount(session.ayahRepeatCount ?? 3)
    setAyahPauseSeconds(session.ayahPauseSeconds ?? 1)
    toast.success(savedSession ? `يمكنك الآن تعديل ${savedSession.name}` : "تم فتح إعدادات الجلسة السابقة")
  }

  const editSavedSession = (session: SavedSessionPreset) => configureSession(session)

  const cancelSessionLongPress = () => {
    if (sessionLongPressTimerRef.current !== null) {
      window.clearTimeout(sessionLongPressTimerRef.current)
      sessionLongPressTimerRef.current = null
    }
  }

  const suppressNextSessionClick = () => {
    if (sessionLongPressSuppressionTimerRef.current !== null) {
      window.clearTimeout(sessionLongPressSuppressionTimerRef.current)
    }
    sessionLongPressSuppressClickRef.current = true
    sessionLongPressSuppressionTimerRef.current = window.setTimeout(() => {
      sessionLongPressSuppressionTimerRef.current = null
      sessionLongPressSuppressClickRef.current = false
    }, 700)
  }

  const scheduleSessionLongPress = (session: SavedSessionPreset | SessionHistoryItem) => {
    cancelSessionLongPress()
    sessionLongPressTimerRef.current = window.setTimeout(() => {
      sessionLongPressTimerRef.current = null
      suppressNextSessionClick()
      configureSession(session)
    }, 520)
  }

  const openSessionFromRecent = (session: SavedSessionPreset | SessionHistoryItem) => {
    if (sessionLongPressSuppressClickRef.current) {
      sessionLongPressSuppressClickRef.current = false
      return
    }
    startSavedSession(session)
  }

  const toggleSessionConfiguration = () => {
    if (sessionSettingsOpen) {
      setSessionSettingsOpen(false)
      pendingLearningPlanTypeRef.current = undefined
      setEditingSavedSessionId(null)
      setSavedSessionName("")
      return
    }
    pendingLearningPlanTypeRef.current = undefined
    setEditingSavedSessionId(null)
    setSavedSessionName("")
    setSessionSettingsOpen(true)
  }

  const startSavedSession = (session: SavedSessionPreset | SessionHistoryItem) => {
    const previousListeningSession = "currentPage" in session && session.mode === "listen"
    const targetPage = previousListeningSession
      ? session.startPage
      : "currentPage" in session ? session.currentPage : session.startPage
    const targetVerseKey = previousListeningSession
      ? session.startVerseKey
      : "currentVerseKey" in session ? session.currentVerseKey : session.startVerseKey
    setSessionNavigationRange({
      startPage: session.startPage,
      endPage: session.endPage,
      startVerseKey: session.startVerseKey,
      endVerseKey: session.endVerseKey,
    })
    const savedTestKind = session.testKind === "mutashabihat" ? "mutashabihat" : "standard"
    const savedMutashabihatTypes = normalizeMutashabihatTypes(session.mutashabihatTypes)
    setSessionMode(session.mode)
    setBrowseActivity(session.mode)
    setTestKind(savedTestKind)
    setMutashabihatTestTypes(savedMutashabihatTypes)
    setReciter(session.reciter)
    setDashboardOpen(false)
    setNavigationOpen(false)
    setSessionSettingsOpen(false)
    pendingResumeSessionIdRef.current = null
    pendingLearningPlanTypeRef.current = "learningPlanType" in session ? session.learningPlanType : undefined
    void startSession(session.mode, session.reciter, targetPage, {
      repeatTarget: session.repeatTarget ?? "3",
      ayahRepeatEnabled: Boolean(session.ayahRepeatEnabled),
      ayahRepeatCount: session.ayahRepeatCount ?? 3,
      ayahPauseSeconds: session.ayahPauseSeconds ?? 1,
    }, targetVerseKey, savedTestKind, savedMutashabihatTypes)
  }

  const saveCurrentSession = () => {
    if (sessionMode === "test" && testKind === "mutashabihat" && mutashabihatTestTypes.length === 0) {
      toast.error("اختر نوعًا واحدًا على الأقل لاختبار المتشابهات")
      return
    }
    const defaultModeName = sessionMode === "test" && testKind === "mutashabihat"
      ? "اختبار المتشابهات"
      : sessionModeLabel(sessionMode)
    const defaultName = `${defaultModeName} · ${sessionRangeLabel({
      startPage: draftStart,
      endPage: draftEnd,
      startVerseKey: draftStartVerseKey,
      endVerseKey: draftEndVerseKey,
    })}`
    const name = savedSessionName.trim() || defaultName
    const editingSession = editingSavedSessionId
      ? savedSessions.find((session) => session.id === editingSavedSessionId)
      : undefined
    const sameNameSession = editingSession
      ? undefined
      : savedSessions.find((session) => session.name.trim() === name)
    const existing = editingSession ?? sameNameSession
    const now = Date.now()
    saveSavedSession({
      id: existing?.id ?? `saved-session-${now}`,
      name,
      mode: sessionMode,
      testKind: sessionMode === "test" ? testKind : undefined,
      mutashabihatTypes: sessionMode === "test" && testKind === "mutashabihat" ? mutashabihatTestTypes : undefined,
      startPage: draftStart,
      endPage: draftEnd,
      startVerseKey: draftStartVerseKey,
      endVerseKey: draftEndVerseKey,
      reciter,
      repeatTarget,
      ayahRepeatEnabled,
      ayahRepeatCount,
      ayahPauseSeconds,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
    setEditingSavedSessionId(null)
    setSavedSessionName("")
    toast.success(editingSession ? "تم حفظ تعديلات الجلسة" : sameNameSession ? "تم تحديث الجلسة المحفوظة" : "تم حفظ الجلسة")
  }

  const openRenameSavedSession = (session: SavedSessionPreset) => {
    setRenameSavedSessionTarget(session)
    setRenameSavedSessionName(session.name)
  }

  const renameSavedSession = () => {
    if (!renameSavedSessionTarget) return
    const name = renameSavedSessionName.trim()
    if (!name) {
      toast.error("اكتب اسمًا للجلسة")
      return
    }
    if (savedSessions.some((session) => session.id !== renameSavedSessionTarget.id && session.name.trim() === name)) {
      toast.error("يوجد اسم جلسة مطابق بالفعل")
      return
    }
    saveSavedSession({
      ...renameSavedSessionTarget,
      name,
      updatedAt: Date.now(),
    })
    if (editingSavedSessionId === renameSavedSessionTarget.id) setSavedSessionName(name)
    setRenameSavedSessionTarget(null)
    setRenameSavedSessionName("")
    toast.success("تمت إعادة تسمية الجلسة")
  }

  const removeSavedSession = () => {
    if (!deleteSavedSessionTarget) return
    deleteSavedSession(deleteSavedSessionTarget.id)
    if (editingSavedSessionId === deleteSavedSessionTarget.id) {
      setEditingSavedSessionId(null)
      setSavedSessionName("")
      setSessionSettingsOpen(false)
    }
    setDeleteSavedSessionTarget(null)
    toast.success("تم حذف الجلسة المحفوظة")
  }

  const applyNavigationRange = (range: NavigationRange) => {
    const start = Math.min(Math.max(range.startPage, 1), MAX_PAGE)
    const end = Math.min(Math.max(range.endPage, start), MAX_PAGE)
    const count = end - start + 1
    setSessionNavigationRange(range)
    setSessionStart(start)
    setSessionCount(count)
    setSessionStartVerseKey(range.startVerseKey)
    setSessionEndVerseKey(range.endVerseKey)
    setCompletedCycles(0)
    setAyahRepeatEnabled(Boolean(range.repeatVerse))
    moveToPage(start, range.startVerseKey)
    toast.success(
      range.repeatVerse
        ? `تم تحديد الآية ${range.startVerseKey} للتكرار`
        : `تم تحديد الصفحات ${formatNumber(start)}–${formatNumber(end)}`,
    )
  }

  const openKhatmaReadingRange = (startPage: number, endPage: number) => {
    const start = Math.min(Math.max(startPage, 1), MAX_PAGE)
    const end = Math.min(Math.max(endPage, start), MAX_PAGE)
    const range = { startPage: start, pageCount: end - start + 1 }
    activeKhatmaRangeRef.current = range
    const plan = readKhatmaPlan()
    if (plan) saveKhatmaPlan({ ...plan, ...range })
    applyNavigationRange({ startPage: start, endPage: end })
  }

  const switchFullscreenOrientation = async (target?: PhysicalOrientation) => {
    const currentOrientation = acceptedOrientationRef.current
    const nextPhysical = target ?? (currentOrientation === "landscape" ? "portrait" : "landscape")
    acceptedOrientationRef.current = nextPhysical
    lastOfferedOrientationRef.current = null
    fullscreenPhysicalOrientationRef.current = nextPhysical
    const landscape = nextPhysical === "landscape"
    const compactPhysicalLandscape = window.matchMedia("(orientation: landscape) and (max-height: 600px)").matches
    setCompactLandscape(landscape && compactPhysicalLandscape)
    setLandscapeReadingMode(landscape)
    setFullscreenOrientationSuggestion(null)
    if (fullscreenOrientationTimerRef.current) {
      clearTimeout(fullscreenOrientationTimerRef.current)
      fullscreenOrientationTimerRef.current = null
    }

    const nextOrientation: ScreenOrientationLock = nextPhysical
    if (typeof screen === "undefined" || !screen.orientation) return
    const orientation = screen.orientation as LockableScreenOrientation
    orientation.unlock?.()
    if (!orientation.lock) return
    await orientation.lock(nextOrientation).catch(() => {
      // Regular browser tabs may reject locking; the accepted in-app layout still changes.
    })
  }

  const toggleFullscreen = async () => {
    if (readerFocusActive || isFullscreen || document.fullscreenElement) {
      try {
        if (document.fullscreenElement) await document.exitFullscreen()
      } catch {
        // The in-app fallback still exits below.
      }
      setIsFullscreen(false)
      setQuietMode(false)
      setReaderChromeVisible(true)
      setNavigationOpen(chromePanelsRef.current.navigation)
      setSessionSettingsOpen(chromePanelsRef.current.session)
      setMobileMarksOpen(chromePanelsRef.current.marks)
      return
    }

    chromePanelsRef.current = {
      navigation: navigationOpen,
      session: sessionSettingsOpen,
      marks: mobileMarksOpen,
    }
    setDashboardOpen(false)
    setAppSettingsOpen(false)
    setNavigationOpen(false)
    setSessionSettingsOpen(false)
    setMobileMarksOpen(false)
    setQuietMode(true)
    setReaderChromeVisible(false)
    setSpreadMode("single")
    try {
      if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      } else {
        setIsFullscreen(true)
      }
    } catch {
      setIsFullscreen(true)
    }
  }

  const enterRecitationFullscreen = () => {
    chromePanelsRef.current = {
      navigation: navigationOpen,
      session: sessionSettingsOpen,
      marks: mobileMarksOpen,
    }
    setDashboardOpen(false)
    setAppSettingsOpen(false)
    setNavigationOpen(false)
    setSessionSettingsOpen(false)
    setMobileMarksOpen(false)
    setQuietMode(true)
    setReaderChromeVisible(false)
    setSpreadMode("single")
    try {
      if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
        void document.documentElement.requestFullscreen().catch(() => setIsFullscreen(true))
      } else {
        setIsFullscreen(true)
      }
    } catch {
      setIsFullscreen(true)
    }
  }

  const leaveRecitationFullscreen = () => {
    chromePanelsRef.current = { navigation: false, session: false, marks: false }
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {
        // The in-app fullscreen state still exits below.
      })
    }
    setIsFullscreen(false)
    setQuietMode(false)
    setReaderChromeVisible(true)
  }

  const handleImageCenterTap = (event: MouseEvent<HTMLDivElement>) => {
    if (practiceActive) return
    const pageRect = event.currentTarget.getBoundingClientRect()
    const left = Math.max(pageRect.left, 0)
    const right = Math.min(pageRect.right, window.innerWidth)
    const top = Math.max(pageRect.top, 0)
    const bottom = Math.min(pageRect.bottom, window.innerHeight)
    const width = right - left
    const height = bottom - top
    if (width <= 0 || height <= 0) return
    const relativeX = (event.clientX - left) / width
    const relativeY = (event.clientY - top) / height
    if (relativeX >= 0.3 && relativeX <= 0.7 && relativeY >= 0.28 && relativeY <= 0.72) {
      void toggleFullscreen()
    }
  }

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode === "image") {
      setReadingMode("page")
      setWideReading(false)
      setAudioReviewState(null)
    }
  }

  const changeReadingMode = (mode: ReadingMode) => {
    setReadingMode(mode)
    if (mode === "large") {
      setWideReading(false)
      setSpreadMode("single")
    } else if (continuousAutoScroll) {
      stopContinuousAutoScroll()
    }
  }

  const changeBrowseActivity = (activity: BrowseActivity) => {
    setBrowseActivity(activity)
    setSessionSettingsOpen(activity !== "read")
    if (activity !== "read") {
      setSessionMode(activity)
      setEditingSavedSessionId(null)
      setSavedSessionName("")
    }
  }

  const mobileWorkspaceTab: MobileWorkspaceTab = navigationOpen ? "browse" : "marks"
  const mobileWorkspaceOpen = navigationOpen || mobileMarksOpen

  const closeMobileWorkspace = () => {
    setNavigationOpen(false)
    setSessionSettingsOpen(false)
    setMobileMarksOpen(false)
  }

  const selectMobileWorkspaceTab = (tab: MobileWorkspaceTab) => {
    setDashboardOpen(false)
    setQuietMode(false)
    closeMobileWorkspace()
    if (tab === "browse") {
      setBrowseActivity("read")
      setNavigationOpen(true)
    }
    if (tab === "marks") setMobileMarksOpen(true)
    if (tab === "khatma") {
      setReaderChromeVisible(true)
      setAppSettingsOpen(false)
      setKhatmaOpen(true)
    }
  }

  const updateVolume = (nextVolume: number) => {
    setVolume(nextVolume)
    if (nextVolume > 0) previousVolumeRef.current = nextVolume
  }

  const toggleMute = () => {
    if (volume > 0) {
      previousVolumeRef.current = volume
      setVolume(0)
    } else {
      setVolume(previousVolumeRef.current || 1)
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches("input, textarea, select, [contenteditable='true']") || practiceActive) return
      if (event.key === "ArrowLeft" && currentPage < MAX_PAGE) moveToPage(currentPage + 1)
      if (event.key === "ArrowRight" && currentPage > 1) moveToPage(currentPage - 1)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentPage, moveToPage, practiceActive])

  useEffect(() => {
    if (
      !practiceActive ||
      pageData.page !== currentPage ||
      practicePendingRef.current === null ||
      practiceVerses.length === 0
    ) return

    const randomCandidateCount = currentPage === sessionEnd && practiceVerses.length > 1
      ? practiceVerses.length - 1
      : practiceVerses.length
    const pendingMode = practicePendingRef.current
    const verifiedTargetOffset = activePracticeMode === "test" && activeTestKind === "mutashabihat"
      ? practiceVerses.findIndex((verse) => verse.verseKey === mutashabihatTestTarget?.verseKey)
      : -1
    let startOffset = verifiedTargetOffset >= 0
      ? verifiedTargetOffset
      : activePracticeMode === "test" && pendingMode === "random"
        ? Math.floor(Math.random() * randomCandidateCount)
        : 0
    if (
      verifiedTargetOffset < 0 &&
      activePracticeMode === "test" &&
      pendingMode === "random" &&
      randomCandidateCount > 1 &&
      startOffset === practiceStartOffset
    ) {
      startOffset = (startOffset + 1) % randomCandidateCount
    }
    practicePendingRef.current = null
    setPracticeStartOffset(startOffset)
    setPracticeRevealCount(pendingMode === "await-tap" ? 0 : 1)
    setSelectedVerseKey(pendingMode === "await-tap" ? undefined : practiceVerses[startOffset]?.verseKey)
    setPracticeReady(true)
  }, [activePracticeMode, activeTestKind, currentPage, mutashabihatTestTarget?.verseKey, pageData.page, practiceActive, practiceQuestionKey, practiceStartOffset, practiceVerses, sessionEnd])

  const beginSession = (
    modeOverride?: SessionMode,
    reciterOverride?: number,
    targetPageOverride?: number,
    savedSettings?: Pick<SavedSessionPreset, "repeatTarget" | "ayahRepeatEnabled" | "ayahRepeatCount" | "ayahPauseSeconds">,
    targetVerseKeyOverride?: string,
    testKindOverride: WirdTestKind = "standard",
    mutashabihatTypesOverride: WirdMutashabihatType[] = ["identical", "similar"],
  ) => {
    const activeMode = modeOverride ?? sessionMode
    const selectedTestKind = activeMode === "test" ? testKindOverride : "standard"
    const selectedMutashabihatTypes = selectedTestKind === "mutashabihat"
      ? normalizeMutashabihatTypes(mutashabihatTypesOverride)
      : []
    setActiveTestKind(selectedTestKind)
    setActiveMutashabihatTypes(selectedMutashabihatTypes)
    const activeReciter = reciterOverride ?? reciter
    const activeReciterName = RECITERS.find((item) => item.id === activeReciter)?.name ?? selectedReciter.name
    const activeRepeatTarget = normalizeRepeatTarget(savedSettings?.repeatTarget ?? repeatTarget)
    const activeAyahRepeatEnabled = savedSettings?.ayahRepeatEnabled ?? ayahRepeatEnabled
    const activeAyahRepeatCount = savedSettings?.ayahRepeatCount ?? ayahRepeatCount
    const activeAyahPauseSeconds = savedSettings?.ayahPauseSeconds ?? ayahPauseSeconds
    setRepeatTarget(activeRepeatTarget)
    setAyahRepeatEnabled(activeAyahRepeatEnabled)
    setAyahRepeatCount(activeAyahRepeatCount)
    setAyahPauseSeconds(activeAyahPauseSeconds)
    const selectedRange = draftSessionRangeRef.current
    const start = clamp(selectedRange.startPage, 1, MAX_PAGE)
    const end = Math.min(Math.max(selectedRange.endPage, start), MAX_PAGE)
    const count = end - start + 1
    const startVerseKey = selectedRange.startVerseKey
    const endVerseKey = selectedRange.endVerseKey
    setDraftStart(start)
    setDraftCount(count)
    setSessionStart(start)
    setSessionCount(count)
    setSessionStartVerseKey(startVerseKey)
    setSessionEndVerseKey(endVerseKey)
    setStopAtSurahEnd(false)
    setPlaybackStopMode("off")
    setSleepTimerEndAt(null)
    setCompletedCycles(0)
    advancingRef.current = false
    pendingVerseTargetRef.current = null
    pendingVerseEdgeRef.current = null
    pendingVerseSeekMsRef.current = null
    pendingPlaybackScopeRef.current = null
    seamlessAudioTransitionRef.current = null
    setTrackIndex(0)
    setVerseIndex(0)
    setElapsed(0)
    if (audioRef.current) {
      const firstTrack = start === currentPage ? tracks[0] : undefined
      audioRef.current.currentTime =
        firstTrack && audioRef.current.src === firstTrack.audioUrl ? firstTrack.startMs / 1000 : 0
    }
    const isPractice = activeMode !== "listen"
    const targetPage = targetPageOverride !== undefined
      ? Math.min(Math.max(targetPageOverride, start), end)
      : activeMode === "test"
        // eslint-disable-next-line react-hooks/purity
        ? start + Math.floor(Math.random() * count)
        : start
    // eslint-disable-next-line react-hooks/purity
    const historyId = pendingResumeSessionIdRef.current ?? `session-${Date.now()}`
    pendingResumeSessionIdRef.current = null
    const learningPlanType = pendingLearningPlanTypeRef.current
    pendingLearningPlanTypeRef.current = undefined
    activeSessionIdRef.current = historyId
    setBoundedSessionActive(true)
    upsertSessionHistory({
      id: historyId,
      mode: activeMode,
      testKind: activeMode === "test" ? selectedTestKind : undefined,
      mutashabihatTypes: selectedTestKind === "mutashabihat" ? selectedMutashabihatTypes : undefined,
      learningPlanType,
      startPage: start,
      endPage: end,
      startVerseKey,
      endVerseKey,
      currentPage: targetPage,
      currentVerseKey: activeMode === "test"
        ? selectedTestKind === "mutashabihat" ? targetVerseKeyOverride : undefined
        : targetVerseKeyOverride ?? startVerseKey,
      reciter: activeReciter,
      reciterName: activeReciterName,
      repeatTarget: activeRepeatTarget,
      ayahRepeatEnabled: activeAyahRepeatEnabled,
      ayahRepeatCount: activeAyahRepeatCount,
      ayahPauseSeconds: activeAyahPauseSeconds,
      // eslint-disable-next-line react-hooks/purity
      startedAt: Date.now(),
      // eslint-disable-next-line react-hooks/purity
      updatedAt: Date.now(),
      completed: false,
    })
    setPracticeActive(isPractice)
    if (isPractice) {
      setActivePracticeMode(activeMode as "recite" | "test")
      setAudioReviewState(null)
    } else if (audioReviewActive) {
      setAudioReviewState({ page: targetPage, revealIndex: -1 })
    }
    setPracticeReady(false)
    practicePendingRef.current = isPractice
      ? activeMode === "test" ? "random" : "start"
      : null
    if (isPractice) {
      setViewMode("text")
      setSpreadMode("single")
      setPlayerCollapsed(true)
      if (activeMode === "recite") {
        enterRecitationFullscreen()
        toast.info("اضغط على صفحة المصحف لإظهار الآية التالية", { duration: 6_000 })
      } else {
        setIsFullscreen(false)
        if (document.fullscreenElement) void document.exitFullscreen()
      }
      setPracticeStartOffset(0)
      setPracticeRevealCount(1)
      setPracticeQuestionKey((key) => key + 1)
    }
    const targetVerseKey = targetVerseKeyOverride ?? (
      targetPage === start ? startVerseKey : undefined
    )
    if (targetVerseKey && activeMode !== "test") {
      moveToPage(targetPage, targetVerseKey, activeReciter)
    } else {
      pendingVerseTargetRef.current = null
      const requiresPlaybackLoad = activeMode === "listen" && (
        targetPage !== currentPage || activeReciter !== reciter
      )
      pendingVerseEdgeRef.current = requiresPlaybackLoad ? "first" : null
      pendingPlaybackScopeRef.current = requiresPlaybackLoad
        ? { page: targetPage, reciter: activeReciter }
        : null
      setCurrentPage(targetPage)
    }
    setDashboardOpen(false)
    setSessionSettingsOpen(false)
    setNavigationOpen(false)
    if (isPractice) setIsPlaying(false)
    else startPlayback()
  }

  const startSession = async (
    modeOverride?: SessionMode,
    reciterOverride?: number,
    targetPageOverride?: number,
    savedSettings?: Pick<SavedSessionPreset, "repeatTarget" | "ayahRepeatEnabled" | "ayahRepeatCount" | "ayahPauseSeconds">,
    targetVerseKeyOverride?: string,
    testKindOverride?: WirdTestKind,
    mutashabihatTypesOverride?: WirdMutashabihatType[],
  ) => {
    const activeMode = modeOverride ?? sessionMode
    const selectedTestKind = activeMode === "test" ? testKindOverride ?? testKind : "standard"
    const selectedMutashabihatTypes = mutashabihatTypesOverride ?? mutashabihatTestTypes
    if (selectedTestKind === "mutashabihat" && selectedMutashabihatTypes.length === 0) {
      toast.error("اختر نوعًا واحدًا على الأقل لاختبار المتشابهات")
      return
    }
    if (activeMode !== "test" || selectedTestKind !== "mutashabihat") {
      setMutashabihatTestCandidates([])
      setMutashabihatTestQuestionIndex(0)
      setMutashabihatTestTarget(null)
      beginSession(
        modeOverride,
        reciterOverride,
        targetPageOverride,
        savedSettings,
        targetVerseKeyOverride,
        selectedTestKind,
        selectedMutashabihatTypes,
      )
      return
    }

    const range = draftSessionRangeRef.current
    setMutashabihatTestLoading(true)
    try {
      const candidates = await requestMutashabihatTestCandidates(range, selectedMutashabihatTypes)
      if (candidates.length === 0) {
        toast.error("لا توجد آيات متشابهة موثقة داخل النطاق المختار")
        return
      }
      const shuffledCandidates = shuffleMutashabihatCandidates(candidates)
      const preferredTarget = targetVerseKeyOverride
        ? candidates.find((candidate) => candidate.verseKey === targetVerseKeyOverride)
        : undefined
      const pageTarget = targetPageOverride
        ? shuffledCandidates.find((candidate) => candidate.page === targetPageOverride)
        : undefined
      const orderedCandidates = moveMutashabihatCandidateToFront(
        shuffledCandidates,
        (preferredTarget ?? pageTarget)?.verseKey,
      )
      const target = orderedCandidates[0]
      setMutashabihatTestCandidates(orderedCandidates)
      setMutashabihatTestQuestionIndex(0)
      setMutashabihatTestTarget(target)
      beginSession(
        activeMode,
        reciterOverride,
        target.page,
        savedSettings,
        target.verseKey,
        selectedTestKind,
        selectedMutashabihatTypes,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تجهيز اختبار المتشابهات")
    } finally {
      setMutashabihatTestLoading(false)
    }
  }

  const applyActiveMutashabihatTypes = async () => {
    const selectedTypes = MUTASHABIHAT_TEST_TYPE_OPTIONS
      .map((option) => option.value)
      .filter((type) => activeMutashabihatTypeDraft.includes(type))
    if (selectedTypes.length === 0) {
      toast.error("اختر نوعًا واحدًا على الأقل لاختبار المتشابهات")
      return
    }

    setActiveMutashabihatTypePickerOpen(false)
    setMutashabihatTestLoading(true)
    try {
      const range = {
        startPage: sessionStart,
        endPage: sessionEnd,
        startVerseKey: sessionStartVerseKey,
        endVerseKey: sessionEndVerseKey,
      }
      const candidates = await requestMutashabihatTestCandidates(range, selectedTypes)
      if (candidates.length === 0) {
        toast.error("لا توجد آيات متشابهة موثقة من التصنيفات المختارة داخل النطاق")
        return
      }
      const currentTarget = candidates.find((candidate) => candidate.verseKey === mutashabihatTestTarget?.verseKey)
      const orderedCandidates = moveMutashabihatCandidateToFront(
        shuffleMutashabihatCandidates(candidates),
        currentTarget?.verseKey,
      )
      const target = orderedCandidates[0]
      setActiveMutashabihatTypes(selectedTypes)
      setMutashabihatTestTypes(selectedTypes)
      setMutashabihatTestCandidates(orderedCandidates)
      setMutashabihatTestQuestionIndex(0)
      setMutashabihatTestTarget(target)
      practicePendingRef.current = "random"
      setPracticeReady(false)
      setPracticeRevealCount(0)
      setSelectedVerseKey(undefined)
      setPracticeQuestionKey((key) => key + 1)
      if (target.page !== currentPage) moveToPage(target.page, target.verseKey)

      const activeId = activeSessionIdRef.current
      const activeHistory = activeId
        ? loadSessionHistory().find((session) => session.id === activeId)
        : undefined
      if (activeHistory) {
        upsertSessionHistory({
          ...activeHistory,
          mutashabihatTypes: selectedTypes,
          currentPage: target.page,
          currentVerseKey: target.verseKey,
          updatedAt: Date.now(),
        })
      }
      toast.success("تم تحديث تصنيفات الاختبار")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر تحديث اختبار المتشابهات")
    } finally {
      setMutashabihatTestLoading(false)
    }
  }

  const completeActiveSession = () => {
    const activeId = activeSessionIdRef.current
    if (!activeId) return
    const session = loadSessionHistory().find((item) => item.id === activeId)
    completeSessionHistory(activeId)
    incrementCompletedSessions()
    activeSessionIdRef.current = null
    setBoundedSessionActive(false)
    if (!session) return
    const pages = Math.max(1, session.endPage - session.startPage + 1)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    addLearningPlanProgress(
      session.startPage,
      session.endPage,
      session.startVerseKey,
      session.endVerseKey,
      session.learningPlanType,
    )
    setSessionSummary({
      durationSeconds: Math.max(0, Math.round((Date.now() - (session.startedAt ?? session.updatedAt)) / 1000)),
      pages,
      troubledVerses: verseHighlights.filter((highlight) =>
        highlight.pageNumber && highlight.pageNumber >= session.startPage && highlight.pageNumber <= session.endPage,
      ).length,
      tomorrowReviews: countReviewsForDate(verseHighlights, tomorrow),
    })
  }

  const openNewTestQuestion = () => {
    if (activeTestKind === "mutashabihat" && mutashabihatTestCandidates.length > 0) {
      let queue = mutashabihatTestCandidates
      let targetIndex = mutashabihatTestQuestionIndex + 1
      if (targetIndex >= queue.length) {
        queue = shuffleMutashabihatCandidates(queue)
        if (queue.length > 1 && queue[0].verseKey === mutashabihatTestTarget?.verseKey) {
          const firstCandidate = queue[0]
          queue[0] = queue[1]
          queue[1] = firstCandidate
        }
        targetIndex = 0
        setMutashabihatTestCandidates(queue)
      }
      const target = queue[targetIndex]
      setMutashabihatTestQuestionIndex(targetIndex)
      setMutashabihatTestTarget(target)
      practicePendingRef.current = "random"
      setPracticeReady(false)
      setPracticeRevealCount(0)
      setSelectedVerseKey(undefined)
      setPracticeQuestionKey((key) => key + 1)
      if (target.page !== currentPage) moveToPage(target.page, target.verseKey)
      return
    }

    const currentOffset = Math.min(Math.max(currentPage - sessionStart, 0), sessionCount - 1)
    const randomOffset = sessionCount > 1
      ? Math.floor(Math.random() * (sessionCount - 1))
      : 0
    const targetOffset = sessionCount > 1 && randomOffset >= currentOffset
      ? randomOffset + 1
      : randomOffset
    const targetPage = sessionStart + targetOffset
    practicePendingRef.current = "random"
    setPracticeReady(false)
    setPracticeRevealCount(0)
    setSelectedVerseKey(undefined)
    setPracticeQuestionKey((key) => key + 1)
    if (targetPage !== currentPage) moveToPage(targetPage)
  }

  const advancePractice = () => {
    if (!practiceActive || practiceVerses.length === 0) return
    const availableCount = practiceVerses.length - practiceStartOffset
    if (practiceRevealCount < availableCount) {
      const nextCount = practiceRevealCount + 1
      setPracticeRevealCount(nextCount)
      setSelectedVerseKey(practiceVerses[practiceStartOffset + nextCount - 1]?.verseKey)
      return
    }
    if (activePracticeMode === "test") {
      if (currentPage < sessionEnd) {
        practicePendingRef.current = "await-tap"
        setPracticeReady(false)
        setPracticeRevealCount(0)
        setSelectedVerseKey(undefined)
        setPracticeQuestionKey((key) => key + 1)
        moveToPage(currentPage + 1)
        return
      }
      openNewTestQuestion()
      return
    }
    if (currentPage < sessionEnd) {
      practicePendingRef.current = "await-tap"
      setPracticeReady(false)
      setPracticeRevealCount(0)
      setSelectedVerseKey(undefined)
      setPracticeQuestionKey((key) => key + 1)
      moveToPage(currentPage + 1)
      return
    }
    const boundedSessionComplete = Boolean(activeSessionIdRef.current)
    completeActiveSession()
    if (boundedSessionComplete) {
      practicePendingRef.current = null
      leaveRecitationFullscreen()
      setPracticeActive(false)
      setPracticeReady(false)
      setPracticeStartOffset(0)
      setPracticeRevealCount(1)
      setSelectedVerseKey(undefined)
    }
    toast.success("اكتمل نطاق التسميع")
  }

  const toggleAudioReview = () => {
    if (audioReviewActive) {
      setAudioReviewState(null)
      toast.success("تم إظهار جميع الآيات")
      return
    }
    if (!isPlaying) {
      activeSessionIdRef.current = null
      pendingResumeSessionIdRef.current = null
      practicePendingRef.current = null
      setBoundedSessionActive(false)
      setPracticeActive(false)
      setPracticeReady(false)
      setSessionMode("recite")
      setSessionStart(currentPage)
      setSessionCount(MAX_PAGE - currentPage + 1)
      setSessionStartVerseKey(currentVerse?.verseKey)
      setSessionEndVerseKey(undefined)
      setStopAtSurahEnd(false)
      setPlaybackStopMode("off")
      setSleepTimerEndAt(null)
      setAudioReviewState({ page: currentPage, revealIndex: -1 })
      setSelectedVerseKey(undefined)
      setViewMode("text")
      toast.info("اضغط على صفحة المصحف لإظهار الآية التالية", { duration: 6_000 })
      return
    }
    const followsAudio = hasVerseSynchronization
    const audio = audioRef.current
    const reveal = followsAudio && audio && currentTrack && !audio.paused
      ? findAudioReviewReveal(
          currentTrack,
          verses,
          audio.currentTime * 1000,
          audio.playbackRate,
          audioReviewRevealMode,
        )
      : null
    setAudioReviewState({
      page: currentPage,
      revealIndex: followsAudio ? (reveal?.revealIndex ?? verseIndex - 1) : verseIndex,
      visibleWordPosition: reveal?.visibleWordPosition,
      wordTransitionDurationMs: reveal?.wordTransitionDurationMs,
      transitionPlaybackRate: reveal?.transitionPlaybackRate,
    })
    setSelectedVerseKey(undefined)
    setViewMode("text")
    setSpreadMode("single")
    toast.success(followsAudio
      ? `بدأ ${audioReviewActionLabel}`
      : "بدأ التسميع. اضغط على صفحة المصحف لإظهار الآية التالية")
  }

  const advanceManualAudioReview = () => {
    if (!audioReviewState || (isPlaying && hasVerseSynchronization) || verses.length === 0) return
    if (audioReviewState.page !== currentPage) {
      setAudioReviewState({ page: currentPage, revealIndex: 0 })
      return
    }
    if (audioReviewState.revealIndex < verses.length - 1) {
      const nextRevealIndex = audioReviewState.revealIndex + 1
      setAudioReviewState({ page: currentPage, revealIndex: nextRevealIndex })
      setSelectedVerseKey(verses[nextRevealIndex]?.verseKey)
      return
    }
    if (currentPage < sessionEnd) {
      moveToPage(currentPage + 1)
      setAudioReviewState({ page: currentPage + 1, revealIndex: 0 })
      return
    }
    toast.success("وصلت إلى نهاية نطاق التسميع")
  }

  const startOpenRecitation = (page: number, verseKey?: string) => {
    const startPage = clamp(page, 1, MAX_PAGE)
    activeSessionIdRef.current = null
    pendingResumeSessionIdRef.current = null
    setBoundedSessionActive(false)
    setAudioReviewState(null)
    setSessionMode("recite")
    setStopAtSurahEnd(false)
    setPlaybackStopMode("off")
    setSleepTimerEndAt(null)
    setSessionStart(startPage)
    setSessionCount(MAX_PAGE - startPage + 1)
    setSessionStartVerseKey(verseKey)
    setSessionEndVerseKey(undefined)
    setActivePracticeMode("recite")
    setPracticeActive(true)
    setPracticeReady(false)
    setPracticeStartOffset(0)
    setPracticeRevealCount(1)
    practicePendingRef.current = "start"
    setPracticeQuestionKey((key) => key + 1)
    setViewMode("text")
    setReadingMode("page")
    setSpreadMode("single")
    setPlayerCollapsed(true)
    setIsPlaying(false)
    enterRecitationFullscreen()
    toast.info("اضغط على صفحة المصحف لإظهار الآية التالية", { duration: 6_000 })
    moveToPage(startPage, verseKey)
  }

  const startPageReveal = () => {
    startOpenRecitation(currentPage)
  }

  const startActionVerseRecitation = () => {
    if (!verseAction) return
    const target = verseAction
    setVerseActionKey(null)
    setVerseActionPosition(null)
    startOpenRecitation(target.pageNumber, target.verseKey)
  }

  const stopPractice = () => {
    if (activePracticeMode === "recite") leaveRecitationFullscreen()
    activeSessionIdRef.current = null
    setBoundedSessionActive(false)
    practicePendingRef.current = null
    setPracticeActive(false)
    setPracticeReady(false)
    setPracticeStartOffset(0)
    setPracticeRevealCount(1)
    setActiveMutashabihatTypePickerOpen(false)
    setMutashabihatTestCandidates([])
    setMutashabihatTestQuestionIndex(0)
    setMutashabihatTestTarget(null)
    setSelectedVerseKey(undefined)
  }

  const finishSessionCycle = () => {
    verseRepeatKeyRef.current = null
    verseRepeatIterationRef.current = 0
    const nextCompletedCycles = completedCycles + 1
    const stopAfterSession = playbackStopMode === "session"
    const shouldRepeat = !stopAfterSession && nextCompletedCycles < Number(repeatTarget)
    setCompletedCycles(nextCompletedCycles)

    if (shouldRepeat) {
      advancingRef.current = false
      if (audioReviewActive) {
        const restartVerseIndex = currentPage === sessionStart && sessionStartVerseKey
          ? Math.max(verses.findIndex((verse) => verse.verseKey === sessionStartVerseKey), 0)
          : 0
        setAudioReviewState({ page: sessionStart, revealIndex: restartVerseIndex - 1 })
      }
      if (currentPage === sessionStart) {
        const targetVerseIndex = sessionStartVerseKey
          ? verses.findIndex((verse) => verse.verseKey === sessionStartVerseKey)
          : 0
        const safeVerseIndex = Math.max(targetVerseIndex, 0)
        const targetVerse = verses[safeVerseIndex]
        const targetTrackIndex = targetVerse
          ? findPlaybackTrackIndex(tracks, verses, safeVerseIndex)
          : 0
        const safeTrackIndex = Math.max(targetTrackIndex, 0)
        const seekMs = getPlaybackStartMs(tracks[safeTrackIndex], targetVerse)
        setTrackIndex(safeTrackIndex)
        setVerseIndex(safeVerseIndex)
        setElapsed(0)
        if (audioRef.current && seekMs !== undefined) {
          audioRef.current.currentTime = seekMs / 1000
          audioRef.current.play().catch(reportAudioPlaybackFailure)
        }
      } else {
        pendingVerseSeekMsRef.current = null
        pendingPlaybackScopeRef.current = { page: sessionStart, reciter }
        pendingVerseTargetRef.current = sessionStartVerseKey ?? null
        pendingVerseEdgeRef.current = sessionStartVerseKey ? null : "first"
        setTrackIndex(0)
        setVerseIndex(0)
        setCurrentPage(sessionStart)
      }
      return
    }

    setIsPlaying(false)
    if (stopAfterSession) setPlaybackStopMode("off")
    completeActiveSession()
    toast.success(stopAfterSession ? "توقف الصوت عند نهاية الجلسة" : "اكتملت جلسة المراجعة")
  }

  const advanceToNextPageWithoutStoppingAudio = (audio: HTMLAudioElement) => {
    if (
      !currentTrack ||
      trackIndex !== tracks.length - 1 ||
      playbackStopMode === "page" ||
      currentPage >= (surahEndStopActive ? MAX_PAGE : sessionEnd) ||
      audio.paused ||
      audio.src !== currentTrack.audioUrl
    ) return false
    const followingPage = currentPage + 1
    const cachedFollowingPage = pageCacheRef.current.get(`${reciter}:${followingPage}`)
    const loadedFollowingPage = nextPageData?.page === followingPage && nextPageData.reciter === reciter
      ? nextPageData
      : cachedFollowingPage
    const endingVerse = verses[currentTrack.lastVerseIndex]
    if (!endingVerse) return false
    const continuation = findSeamlessPageContinuation(
      currentTrack,
      endingVerse,
      currentPage,
      loadedFollowingPage,
      reciter,
    )
    if (!continuation) return false

    pendingVerseTargetRef.current = null
    pendingVerseEdgeRef.current = null
    pendingVerseSeekMsRef.current = null
    pendingPlaybackScopeRef.current = null
    seamlessAudioTransitionRef.current = {
      page: followingPage,
      reciter,
      audioUrl: currentTrack.audioUrl,
    }
    const reviewReveal = findAudioReviewReveal(
      continuation.track,
      continuation.page.verses,
      audio.currentTime * 1000,
      audio.playbackRate,
      audioReviewRevealMode,
    )
    setPageData(continuation.page)
    setTrackIndex(continuation.trackIndex)
    setVerseIndex(continuation.verseIndex)
    setSelectedVerseKey(continuation.verse.verseKey)
    setElapsed(Math.max(0, audio.currentTime - continuation.track.startMs / 1000))
    setAudioReviewState((state) => state
      ? {
          page: followingPage,
          revealIndex: reviewReveal?.revealIndex ?? continuation.verseIndex - 1,
          visibleWordPosition: reviewReveal?.visibleWordPosition,
          wordTransitionDurationMs: reviewReveal?.wordTransitionDurationMs,
          transitionPlaybackRate: reviewReveal?.transitionPlaybackRate,
        }
      : null)
    setCurrentPage(followingPage)
    return true
  }

  const finishTrack = () => {
    seamlessAudioTransitionRef.current = null
    const endingVerse = currentTrack ? verses[currentTrack.lastVerseIndex] : undefined
    const currentTrackEndsSurah = currentTrack?.timingMode === "chapter" || Boolean(
      currentTrack &&
      currentTrack.timingMode !== "bismillah" &&
      currentTrack.timingMode !== "page" &&
      endingVerse?.isChapterEnd,
    )
    if (surahEndStopActive && currentTrackEndsSurah) {
      const nextTrack = tracks[trackIndex + 1]
      audioRef.current?.pause()
      isPlayingRef.current = false
      setIsPlaying(false)
      setStopAtSurahEnd(false)
      setPlaybackStopMode("off")
      if (nextTrack) {
        setTrackIndex(trackIndex + 1)
        setVerseIndex(nextTrack.firstVerseIndex)
        setElapsed(0)
      } else {
        const nextPage = currentTrack?.advanceToPage && currentTrack.advanceToPage > currentPage
          ? currentTrack.advanceToPage
          : currentPage + 1
        if (nextPage <= MAX_PAGE) {
          pendingVerseSeekMsRef.current = null
          pendingVerseEdgeRef.current = "first"
          pendingPlaybackScopeRef.current = { page: nextPage, reciter }
          setTrackIndex(0)
          setCurrentPage(nextPage)
        }
      }
      toast.success(`توقفت التلاوة عند نهاية سورة ${endingVerse?.chapterName ?? "الحالية"}`)
      return
    }

    if (trackIndex < tracks.length - 1) {
      const nextTrack = tracks[trackIndex + 1]
      if (currentPage === sessionEnd && nextTrack.firstVerseIndex > lastSessionVerseIndex) {
        finishSessionCycle()
        return
      }
      setTrackIndex((index) => index + 1)
      setVerseIndex(nextTrack.firstVerseIndex)
      setElapsed(0)
      return
    }

    if (playbackStopMode === "page") {
      audioRef.current?.pause()
      isPlayingRef.current = false
      setIsPlaying(false)
      setPlaybackStopMode("off")
      const nextPage = currentTrack?.advanceToPage && currentTrack.advanceToPage > currentPage
        ? currentTrack.advanceToPage
        : currentPage + 1
      if (nextPage <= MAX_PAGE) {
        pendingVerseSeekMsRef.current = null
        pendingVerseEdgeRef.current = "first"
        pendingPlaybackScopeRef.current = { page: nextPage, reciter }
        setTrackIndex(0)
        setCurrentPage(nextPage)
      } else {
        advancingRef.current = false
      }
      toast.success("توقف الصوت عند نهاية الصفحة")
      return
    }

    if (
      !hasVerseSynchronization &&
      currentTrack?.advanceToPage &&
      currentTrack.advanceToPage <= (surahEndStopActive ? MAX_PAGE : sessionEnd) &&
      currentTrack.advanceToPage <= MAX_PAGE
    ) {
      pendingVerseSeekMsRef.current = null
      pendingVerseEdgeRef.current = "first"
      pendingPlaybackScopeRef.current = { page: currentTrack.advanceToPage, reciter }
      setTrackIndex(0)
      setCurrentPage(currentTrack.advanceToPage)
      return
    }

    if (hasVerseSynchronization && currentPage < (surahEndStopActive ? MAX_PAGE : sessionEnd)) {
      const followingPage = currentPage + 1
      pendingVerseSeekMsRef.current = null
      pendingVerseEdgeRef.current = "first"
      pendingPlaybackScopeRef.current = { page: followingPage, reciter }
      if (nextPageData?.page === followingPage && nextPageData.reciter === reciter) {
        setPageData(nextPageData)
      }
      setTrackIndex(0)
      setCurrentPage(followingPage)
      return
    }

    finishSessionCycle()
  }

  const handleTimeUpdate = (audio: HTMLAudioElement) => {
    if (!currentTrack || audio.src !== currentTrack.audioUrl) return

    const currentMs = audio.currentTime * 1000
    const seamlessTransition = seamlessAudioTransitionRef.current
    if (
      seamlessTransition?.page === currentPage &&
      seamlessTransition.reciter === reciter &&
      seamlessTransition.audioUrl === currentTrack.audioUrl &&
      currentMs >= currentTrack.startMs - 100
    ) {
      seamlessAudioTransitionRef.current = null
    }
    const trackPosition = Math.max(0, (currentMs - currentTrack.startMs) / 1000)
    setElapsed(trackPosition)
    if ("mediaSession" in navigator && currentTrack.endMs > currentTrack.startMs) {
      try {
        navigator.mediaSession.setPositionState({
          duration: (currentTrack.endMs - currentTrack.startMs) / 1000,
          playbackRate: speed,
          position: Math.min(trackPosition, (currentTrack.endMs - currentTrack.startMs) / 1000),
        })
      } catch {
        // Position updates are optional on older Media Session implementations.
      }
    }

    let activeVerse: QuranVerse | undefined
    let activeVerseIndex = verseIndex
    if (!["bismillah", "chapter", "page"].includes(currentTrack.timingMode ?? "")) {
      for (let index = currentTrack.firstVerseIndex; index <= currentTrack.lastVerseIndex; index += 1) {
        const verse = verses[index]
        if (verse && currentMs >= verse.timestampFrom && currentMs < verse.timestampTo) {
          activeVerse = verse
          activeVerseIndex = index
          setVerseIndex(index)
          break
        }
      }
    }

    if (audioReviewActive && !audio.paused && isPlayingRef.current) {
      const reveal = findAudioReviewReveal(
        currentTrack,
        verses,
        currentMs,
        audio.playbackRate,
        audioReviewRevealMode,
      )
      if (reveal) {
        setAudioReviewState((state) => {
          if (!state) return null
          if (
            state.page === currentPage &&
            state.revealIndex === reveal.revealIndex &&
            state.visibleWordPosition === reveal.visibleWordPosition &&
            state.transitionPlaybackRate === reveal.transitionPlaybackRate
          ) return state
          return { page: currentPage, ...reveal }
        })
      }
    }

    if (activeVerse && verseRepeatKeyRef.current !== activeVerse.verseKey) {
      verseRepeatKeyRef.current = activeVerse.verseKey
      verseRepeatIterationRef.current = 0
    }

    if (
      ayahRepeatEnabled &&
      activeVerse &&
      currentMs >= activeVerse.timestampTo - 80 &&
      verseRepeatIterationRef.current < ayahRepeatCount - 1 &&
      !verseRepeatTimerRef.current
    ) {
      audio.pause()
      verseRepeatIterationRef.current += 1
      verseRepeatTimerRef.current = setTimeout(() => {
        audio.currentTime = activeVerse.timestampFrom / 1000
        setVerseIndex(activeVerseIndex)
        if (isPlayingRef.current) audio.play().catch(reportAudioPlaybackFailure)
        verseRepeatTimerRef.current = null
      }, ayahPauseSeconds * 1000)
      return
    }

    if (
      !surahEndStopActive &&
      sessionEndVerseKey &&
      currentPage === sessionEnd &&
      activeVerse?.verseKey === sessionEndVerseKey &&
      currentMs >= activeVerse.timestampTo - 80 &&
      !advancingRef.current
    ) {
      advancingRef.current = true
      audio.pause()
      finishSessionCycle()
      return
    }

    if (currentMs >= currentTrack.endMs - 80 && !advancingRef.current) {
      advancingRef.current = true
      if (!advanceToNextPageWithoutStoppingAudio(audio)) {
        audio.pause()
        finishTrack()
      }
    }
  }

  const handleAudioEnded = (audio: HTMLAudioElement) => {
    if (!currentTrack) return
    if (currentTrack.timingMode === "verse") {
      const activeVerseIndex = currentTrack.firstVerseIndex
      if (
        ayahRepeatEnabled &&
        verseRepeatIterationRef.current < ayahRepeatCount - 1 &&
        !verseRepeatTimerRef.current
      ) {
        verseRepeatIterationRef.current += 1
        verseRepeatTimerRef.current = setTimeout(() => {
          audio.currentTime = 0
          if (isPlayingRef.current) audio.play().catch(reportAudioPlaybackFailure)
          verseRepeatTimerRef.current = null
        }, ayahPauseSeconds * 1000)
        return
      }
      verseRepeatIterationRef.current = 0
      if (currentPage === sessionEnd && activeVerseIndex >= lastSessionVerseIndex) {
        advancingRef.current = true
        finishSessionCycle()
        return
      }
    }

    if (advancingRef.current) return
    advancingRef.current = true
    finishTrack()
  }

  const restartSession = () => {
    pendingVerseTargetRef.current = null
    pendingVerseEdgeRef.current = null
    pendingVerseSeekMsRef.current = null
    pendingPlaybackScopeRef.current = null
    if (audioReviewActive) {
      const restartVerseIndex = currentPage === sessionStart && sessionStartVerseKey
        ? Math.max(verses.findIndex((verse) => verse.verseKey === sessionStartVerseKey), 0)
        : 0
      setAudioReviewState({ page: sessionStart, revealIndex: restartVerseIndex - 1 })
    }
    if (verseRepeatTimerRef.current) clearTimeout(verseRepeatTimerRef.current)
    verseRepeatTimerRef.current = null
    verseRepeatKeyRef.current = null
    verseRepeatIterationRef.current = 0
    setIsPlaying(false)
    setCompletedCycles(0)
    advancingRef.current = false
    setTrackIndex(0)
    setVerseIndex(0)
    setElapsed(0)
    if (sessionStartVerseKey) {
      moveToPage(sessionStart, sessionStartVerseKey)
    } else if (currentPage !== sessionStart) {
      pendingVerseEdgeRef.current = "first"
      pendingPlaybackScopeRef.current = { page: sessionStart, reciter }
      setCurrentPage(sessionStart)
    } else if (audioRef.current && tracks[0] && audioRef.current.src === tracks[0].audioUrl) {
      audioRef.current.currentTime = tracks[0].startMs / 1000
    }
  }

  const seekToVerse = useCallback((targetVerseIndex: number) => {
    const targetVerse = verses[targetVerseIndex]
    if (!targetVerse) return
    const targetTrackIndex = findPlaybackTrackIndex(tracks, verses, targetVerseIndex)
    const targetTrack = tracks[targetTrackIndex]
    if (!targetTrack) return
    const seekMs = getPlaybackStartMs(targetTrack, targetVerse)
    if (verseRepeatTimerRef.current) clearTimeout(verseRepeatTimerRef.current)
    verseRepeatTimerRef.current = null
    verseRepeatKeyRef.current = null
    verseRepeatIterationRef.current = 0
    advancingRef.current = false
    setVerseIndex(targetVerseIndex)
    if (audioReviewActive) {
      setAudioReviewState({ page: currentPage, revealIndex: targetVerseIndex - 1 })
    }
    setSelectedVerseKey(targetVerse.verseKey)
    setTrackIndex(targetTrackIndex)
    setElapsed(Math.max(0, (seekMs - targetTrack.startMs) / 1000))
    pendingVerseSeekMsRef.current = seekMs
    if (audioRef.current && audioRef.current.src === targetTrack.audioUrl) {
      audioRef.current.currentTime = seekMs / 1000
      pendingVerseSeekMsRef.current = null
    }
  }, [audioReviewActive, currentPage, setElapsed, tracks, verses])

  const goToPreviousVerse = useCallback(() => {
    if (!canGoToPreviousVerse || isLoading) return
    if (!hasVerseSynchronization) {
      if (trackIndex > 0) {
        const previousTrack = tracks[trackIndex - 1]
        setTrackIndex((index) => index - 1)
        setVerseIndex(previousTrack.firstVerseIndex)
        setElapsed(0)
      } else if (currentTrack?.previousPage && currentTrack.previousPage >= sessionStart) {
        const previousPage = currentTrack.previousPage
        pendingVerseSeekMsRef.current = null
        pendingVerseEdgeRef.current = "last"
        pendingPlaybackScopeRef.current = { page: previousPage, reciter }
        setTrackIndex(0)
        setCurrentPage(previousPage)
      }
      return
    }
    if (verseIndex > firstSessionVerseIndex) {
      seekToVerse(verseIndex - 1)
      return
    }
    const previousPage = currentPage - 1
    pendingVerseSeekMsRef.current = null
    pendingVerseEdgeRef.current = "last"
    pendingPlaybackScopeRef.current = { page: previousPage, reciter }
    advancingRef.current = false
    setCurrentPage(previousPage)
  }, [
    canGoToPreviousVerse,
    currentPage,
    currentTrack,
    firstSessionVerseIndex,
    hasVerseSynchronization,
    isLoading,
    reciter,
    seekToVerse,
    sessionStart,
    setElapsed,
    trackIndex,
    tracks,
    verseIndex,
  ])

  const goToNextVerse = useCallback(() => {
    if (!canGoToNextVerse || isLoading) return
    if (!hasVerseSynchronization) {
      if (trackIndex < tracks.length - 1) {
        const nextTrack = tracks[trackIndex + 1]
        setTrackIndex((index) => index + 1)
        setVerseIndex(nextTrack.firstVerseIndex)
        setElapsed(0)
      } else if (currentTrack?.advanceToPage && currentTrack.advanceToPage <= sessionEnd) {
        const followingPage = currentTrack.advanceToPage
        pendingVerseSeekMsRef.current = null
        pendingVerseEdgeRef.current = "first"
        pendingPlaybackScopeRef.current = { page: followingPage, reciter }
        setTrackIndex(0)
        setCurrentPage(followingPage)
      }
      return
    }
    if (verseIndex < lastSessionVerseIndex) {
      seekToVerse(verseIndex + 1)
      return
    }
    const followingPage = currentPage + 1
    pendingVerseSeekMsRef.current = null
    pendingVerseEdgeRef.current = "first"
    pendingPlaybackScopeRef.current = { page: followingPage, reciter }
    advancingRef.current = false
    if (nextPageData?.page === followingPage && nextPageData.reciter === reciter) {
      setPageData(nextPageData)
    }
    setCurrentPage(followingPage)
  }, [
    canGoToNextVerse,
    currentPage,
    currentTrack,
    hasVerseSynchronization,
    isLoading,
    lastSessionVerseIndex,
    nextPageData,
    reciter,
    seekToVerse,
    sessionEnd,
    setElapsed,
    trackIndex,
    tracks,
    verseIndex,
  ])

  const selectPlaybackStopMode = (mode: PlaybackStopMode) => {
    setPlaybackStopMode(mode)
    setStopAtSurahEnd(mode === "surah")
    const minutes = mode === "10m" ? 10 : mode === "20m" ? 20 : mode === "30m" ? 30 : mode === "60m" ? 60 : 0
    setSleepTimerEndAt(minutes > 0 ? Date.now() + minutes * 60_000 : null)
    if (mode === "off") {
      toast.info("تم إلغاء مؤقت التلاوة")
      return
    }
    const label = minutes > 0
      ? `بعد ${minutes} دقيقة`
      : mode === "page"
        ? "عند نهاية الصفحة"
        : mode === "surah"
          ? "عند نهاية السورة"
          : "عند نهاية الجلسة"
    toast.info(`سيتوقف الصوت ${label}`)
  }

  const applyPlaybackSpeed = (value: number) => {
    const nextSpeed = clampSpeed(value)
    const audio = audioRef.current
    speedRef.current = nextSpeed
    if (audio) syncAudioPlaybackSpeed(audio, nextSpeed)
    setSpeed(nextSpeed)
    return nextSpeed
  }

  const updateSpeed = (value: number) => {
    applyPlaybackSpeed(value)
  }

  const cyclePlaybackSpeed = () => {
    const presetSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]
    const nextSpeed = presetSpeeds.find((preset) => preset > speed + 0.01) ?? presetSpeeds[0]
    updateSpeed(nextSpeed)
  }

  const clearSpeedLongPress = () => {
    if (!speedLongPressTimerRef.current) return
    clearTimeout(speedLongPressTimerRef.current)
    speedLongPressTimerRef.current = null
  }

  const beginSpeedLongPress = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return
    clearSpeedLongPress()
    speedClickSuppressionUntilRef.current = 0
    speedLongPressTimerRef.current = setTimeout(() => {
      speedLongPressTimerRef.current = null
      speedClickSuppressionUntilRef.current = Date.now() + 1_000
      setSessionDuration(null)
      setSessionDurationLoading(true)
      setExtendedSpeedOpen(true)
      navigator.vibrate?.(10)
    }, SPEED_LONG_PRESS_MS)
  }

  const handleSpeedButtonClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    clearSpeedLongPress()
    if (Date.now() < speedClickSuppressionUntilRef.current) {
      speedClickSuppressionUntilRef.current = 0
      return
    }
    setExtendedSpeedOpen(false)
    cyclePlaybackSpeed()
  }

  const handleSpeedContextMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    clearSpeedLongPress()
    speedClickSuppressionUntilRef.current = Date.now() + 1_000
    setSessionDuration(null)
    setSessionDurationLoading(true)
    setExtendedSpeedOpen(true)
  }

  const selectReciter = (id: number) => {
    if (id !== reciter) {
      const audioMs = (audioRef.current?.currentTime ?? 0) * 1000
      const timedVerse = hasVerseSynchronization && currentTrack
        ? verses.find((verse, index) => (
            index >= currentTrack.firstVerseIndex &&
            index <= currentTrack.lastVerseIndex &&
            audioMs >= verse.timestampFrom &&
            audioMs < verse.timestampTo
          ))
        : undefined
      const targetVerse = !practiceActive ? timedVerse ?? currentVerse ?? verses[0] : undefined
      const targetVerseKey = targetVerse?.verseKey
      // eslint-disable-next-line react-hooks/purity
      const changedAt = Date.now()
      saveLastReading({
        page: currentPage,
        verseKey: targetVerseKey,
        chapterId: targetVerse?.chapterId,
        positionMs: audioMs,
        reciter,
        viewMode,
        readingMode,
        updatedAt: changedAt,
      })
      const activeId = activeSessionIdRef.current
      const activeHistory = activeId
        ? loadSessionHistory().find((session) => session.id === activeId)
        : undefined
      if (activeHistory && !activeHistory.completed) {
        upsertSessionHistory({
          ...activeHistory,
          currentPage,
          currentVerseKey: targetVerseKey ?? activeHistory.currentVerseKey,
          reciter,
          reciterName: selectedReciter.name,
          updatedAt: changedAt,
        })
      }
      if (!practiceActive) {
        upsertSessionHistory({
          id: `reciter-change-${changedAt}`,
          mode: "listen",
          startPage: currentPage,
          endPage: currentPage,
          currentPage,
          currentVerseKey: targetVerseKey,
          reciter,
          reciterName: selectedReciter.name,
          updatedAt: changedAt,
          completed: true,
        })
      }
      pendingBookmarkRef.current = null
      pendingVerseSeekMsRef.current = null
      seamlessAudioTransitionRef.current = null
      pendingVerseTargetRef.current = targetVerseKey ?? null
      pendingVerseEdgeRef.current = targetVerseKey ? null : "first"
      pendingPlaybackScopeRef.current = { page: currentPage, reciter: id }
      if (targetVerseKey) setSelectedVerseKey(targetVerseKey)
      if (verseRepeatTimerRef.current) {
        window.clearTimeout(verseRepeatTimerRef.current)
        verseRepeatTimerRef.current = null
      }
      verseRepeatKeyRef.current = null
      verseRepeatIterationRef.current = 0
      advancingRef.current = false
      setReciter(id)
    }
    setReciterPickerOpen(false)
    setCompactReciterPickerOpen(false)
    setMobileReciterPickerOpen(false)
    window.localStorage.setItem(RECITER_STORAGE_KEY, String(id))
    if (COARSE_SYNC_RECITER_IDS.has(id)) {
      setAyahRepeatEnabled(false)
      if (id === YASSER_SALAMA_RECITER_ID) {
        setStopAtSurahEnd(false)
        if (playbackStopMode === "surah") setPlaybackStopMode("off")
      }
      const scope = id === AHMED_DEBAN_RECITER_ID ? "السورة" : "الصفحة"
      toast.info(`مصحف الحدر: المزامنة مع ${scope}، وليست مع الآيات`)
    }
  }

  const toggleFavoriteReciter = (id: number) => {
    setFavoriteReciters((current) => {
      const next = current.includes(id)
        ? current.filter((favoriteId) => favoriteId !== id)
        : [...current, id]
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const saveBookmarkForVerse = (verse: QuranVerse, category: string | null | undefined, createdAt: number) => {
    const existing = bookmarks.find((bookmark) => bookmark.verseKey === verse.verseKey)
    const isCurrentVerse = currentVerse?.verseKey === verse.verseKey
    const bookmark: BookmarkItem = {
      id: existing?.id ?? `${verse.pageNumber}-${verse.verseKey}`,
      page: verse.pageNumber,
      verseKey: verse.verseKey,
      chapterId: verse.chapterId,
      chapterName: verse.chapterName,
      category: category === null ? undefined : category ?? existing?.category,
      positionMs: isCurrentVerse
        ? (audioRef.current?.currentTime ?? verse.timestampFrom / 1000) * 1000
        : verse.timestampFrom,
      reciter,
      createdAt: existing?.createdAt ?? createdAt,
    }
    setBookmarks((current) => {
      const next = [
        bookmark,
        ...current.filter((item) => item.id !== bookmark.id),
      ].slice(0, 50)
      window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
    setVerseActionKey(null)
    const categoryLabel = getBookmarkCategoryLabel(bookmarkCategories, bookmark.category)
    toast.success(`تم حفظ العلامة عند الآية ${verse.verseKey}${categoryLabel ? ` · ${categoryLabel}` : ""}`)
  }

  const updateBookmarkCategory = (id: string, category?: string) => {
    setBookmarks((current) => {
      const next = current.map((bookmark) => bookmark.id === id ? { ...bookmark, category } : bookmark)
      window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const changeBookmarkCategories = (nextCategories: BookmarkCategory[]) => {
    const categoryIds = new Set(nextCategories.map((category) => category.id))
    setBookmarkCategories(nextCategories)
    saveBookmarkCategories(window.localStorage, nextCategories)
    setBookmarkCategoryFilter((current) => current === "all" || categoryIds.has(current) ? current : "all")
    setBookmarks((current) => {
      let changed = false
      const next = current.map((bookmark) => {
        if (!bookmark.category || categoryIds.has(bookmark.category)) return bookmark
        changed = true
        return { ...bookmark, category: undefined }
      })
      if (changed) window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const saveCurrentBookmark = (event?: Event) => {
    if (currentVerse) saveBookmarkForVerse(currentVerse, undefined, event?.timeStamp ?? 0)
  }

  const removeBookmark = (id: string) => {
    setBookmarks((current) => {
      const next = current.filter((bookmark) => bookmark.id !== id)
      window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const moveBookmark = (id: string, direction: "up" | "down", orderedIds?: string[]) => {
    setBookmarks((current) => {
      const order = orderedIds ?? current.map((bookmark) => bookmark.id)
      const sourceOrderIndex = order.indexOf(id)
      const targetOrderIndex = direction === "up" ? sourceOrderIndex - 1 : sourceOrderIndex + 1
      if (sourceOrderIndex < 0 || targetOrderIndex < 0 || targetOrderIndex >= order.length) return current
      const sourceIndex = current.findIndex((bookmark) => bookmark.id === id)
      const targetIndex = current.findIndex((bookmark) => bookmark.id === order[targetOrderIndex])
      if (sourceIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const sourceBookmark = next[sourceIndex]
      next[sourceIndex] = next[targetIndex]
      next[targetIndex] = sourceBookmark
      window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  const savePageOffline = async () => {
    if (!("caches" in window)) {
      toast.error("الحفظ دون اتصال غير مدعوم في هذا المتصفح")
      return
    }

    setOfflineSaving(true)
    const qcfFontUrls = pageData.qcfPage
      ? [...new Set(pageData.qcfPage.lines.flatMap((line) => line.glyphs.map((glyph) => glyph.font)))].map(
          getQcf4FontUrl,
        )
      : []
    const urls = [
      `/api/quran?page=${currentPage}&reciter=${reciter}`,
      `https://cdn.myquran.com/img/page/${currentPage}.png`,
      "/fonts/IBMPlexSansArabic-Regular.ttf",
      QPC_HAFS_FONT_URL,
      ...(pageData.qcfPage?.lines.some((line) => line.glyphs.some((glyph) => glyph.type === "surah_header"))
        ? [SURAH_NAME_FONT_URL]
        : []),
      ...qcfFontUrls,
    ]

    try {
      await navigator.storage?.persist?.()
      const cache = await window.caches.open(OFFLINE_PAGE_CACHE)
      await Promise.all(
        urls.map(async (url) => {
          const response = await fetch(url, { mode: url.startsWith("http") ? "cors" : "same-origin" })
          if (!response.ok) throw new Error("Unable to cache page")
          await cache.put(url, response)
        }),
      )
      toast.success(`تم حفظ صفحة ${formatNumber(currentPage)} دون اتصال`)
    } catch {
      toast.error("تعذر حفظ الصفحة الآن")
    } finally {
      setOfflineSaving(false)
    }
  }

  const savePageAsPdf = async () => {
    if (readingMode === "large") {
      toast.error("اختر عرض الصفحة الكاملة قبل حفظ PDF")
      return
    }
    const pageElement = currentPageExportRef.current
    if (!pageElement) {
      toast.error("الصفحة غير جاهزة للتصدير")
      return
    }

    setPdfSaving(true)
    try {
      const { downloadVectorQuranPagePdf } = await import("@/lib/quran-page-pdf")
      await downloadVectorQuranPagePdf(pageElement, currentPage)
      toast.success(`تم حفظ صفحة ${formatNumber(currentPage)} بصيغة PDF متجهية`)
    } catch (error) {
      console.error("Failed to create vector Quran PDF", error)
      toast.error("تعذر إنشاء ملف PDF. أعد المحاولة بعد اكتمال تحميل الصفحة.")
    } finally {
      setPdfSaving(false)
    }
  }

  const openBookmark = (bookmark: BookmarkItem) => {
    pendingVerseTargetRef.current = null
    pendingVerseEdgeRef.current = null
    pendingVerseSeekMsRef.current = null
    pendingPlaybackScopeRef.current = null
    seamlessAudioTransitionRef.current = null
    pendingBookmarkRef.current = bookmark
    setIsPlaying(false)
    setReciter(bookmark.reciter)
    window.localStorage.setItem(RECITER_STORAGE_KEY, String(bookmark.reciter))
    setDraftStart(bookmark.page)
    setSessionStart(bookmark.page)
    setDraftStartVerseKey(undefined)
    setDraftEndVerseKey(undefined)
    setSessionStartVerseKey(undefined)
    setSessionEndVerseKey(undefined)
    setCurrentPage(bookmark.page)
    setDraftCount(1)
    setSessionCount(1)
    setReloadKey((key) => key + 1)
    setBookmarksOpen(false)
  }

  const openDashboardView = () => {
    persistActiveKhatmaProgress()
    activeKhatmaRangeRef.current = null
    activeSessionIdRef.current = null
    pendingResumeSessionIdRef.current = null
    setBoundedSessionActive(false)
    setIsPlaying(false)
    if (practiceActive) stopPractice()
    setQuietMode(false)
    setReaderChromeVisible(true)
    setBrowseActivity("read")
    setSessionSettingsOpen(false)
    setNavigationOpen(false)
    setMobileMarksOpen(false)
    setAppSettingsOpen(false)
    setDashboardOpen(true)
  }

  const openLearningPlanRange = (range: LearningPlanRange) => {
    pendingLearningPlanTypeRef.current = range.planType
    setSessionNavigationRange({
      startPage: range.startPage,
      endPage: range.endPage,
      startVerseKey: range.startVerseKey,
      endVerseKey: range.endVerseKey,
    })
    setSessionMode(range.type === "review" ? "test" : "recite")
    setDashboardOpen(false)
    setNavigationOpen(false)
    setSessionSettingsOpen(true)
    moveToPage(range.startPage)
  }

  const openDashboardBookmark = (item: DashboardBookmark) => {
    const bookmark = bookmarks.find((current) => current.id === item.id)
    if (!bookmark) return
    setDashboardOpen(false)
    openBookmark(bookmark)
  }

  const resolveDashboardReviewPage = async (highlight: VerseHighlight) => {
    if (highlight.pageNumber) return highlight.pageNumber
    try {
      const response = await fetch(`/api/quran/navigation?q=${encodeURIComponent(highlight.verseKey)}`)
      const data = (await response.json()) as { results?: Array<{ verseKey: string; page: number }> }
      return data.results?.find((result) => result.verseKey === highlight.verseKey)?.page
    } catch {
      return undefined
    }
  }

  const openDashboardReview = async (highlight: VerseHighlight) => {
    const page = await resolveDashboardReviewPage(highlight)
    if (!page) {
      toast.error("تعذر تحديد صفحة موضع المراجعة")
      return
    }
    setDashboardOpen(false)
    setViewMode("text")
    moveToPage(page, highlight.verseKey)
  }

  const listenDashboardReview = async (highlight: VerseHighlight) => {
    const page = await resolveDashboardReviewPage(highlight)
    if (!page) {
      toast.error("تعذر تحديد صفحة موضع المراجعة")
      return
    }
    setDashboardOpen(false)
    setViewMode("text")
    moveToPage(page, highlight.verseKey)
    startPlayback()
  }

  const reciteDashboardReview = async (highlight: VerseHighlight) => {
    const page = await resolveDashboardReviewPage(highlight)
    if (!page) {
      toast.error("تعذر تحديد صفحة موضع المراجعة")
      return
    }
    setDashboardOpen(false)
    startOpenRecitation(page, highlight.verseKey)
  }

  const hydrateDashboardReviewDetails = useCallback((details: DashboardReviewDetail[]) => {
    const detailsByKey = new Map(details.map((detail) => [detail.verseKey, detail]))
    let changed = false
    const next = verseHighlights.map((highlight) => {
      const detail = detailsByKey.get(highlight.verseKey)
      if (!detail || (highlight.chapterName && highlight.verseText && highlight.pageNumber)) return highlight
      changed = true
      return {
        ...highlight,
        chapterName: highlight.chapterName ?? detail.chapterName,
        verseText: highlight.verseText ?? detail.verseText,
        pageNumber: highlight.pageNumber ?? detail.pageNumber,
      }
    })
    if (!changed) return
    setVerseHighlights(next)
    saveVerseHighlights(next)
  }, [verseHighlights])

  const updateDashboardReview = (verseKey: string, outcome: "mastered" | "retry") => {
    const next = recordReviewOutcome(verseHighlights, verseKey, outcome)
    persistVerseHighlights(next)
    toast.success(outcome === "mastered" ? "تم تحديد موعد المراجعة التالية" : "سيعود الموضع غدًا")
  }

  useEffect(() => {
    if (!("mediaSession" in navigator)) return

    navigator.mediaSession.metadata = new MediaMetadata({
      title: recitationSyncScope === "chapter"
        ? `سورة ${currentVerse?.chapterName ?? ""}`
        : recitationSyncScope === "page"
          ? `صفحة ${currentPage}`
          : currentVerse ? `الآية ${currentVerse.verseKey}` : `صفحة ${currentPage}`,
      artist: selectedReciter.name,
      album: "وِرد · المصحف الشريف",
      artwork: [
        {
          src: `https://cdn.myquran.com/img/page/${currentPage}.png`,
          sizes: "672x958",
          type: "image/png",
        },
      ],
    })
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused"

    const setAction = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // Some browsers expose Media Session without every action.
      }
    }

    setAction("play", startPlayback)
    setAction("pause", () => setIsPlaying(false))
    setAction("previoustrack", canGoToPreviousVerse ? goToPreviousVerse : null)
    setAction("nexttrack", canGoToNextVerse ? goToNextVerse : null)
    setAction("seekbackward", (details) => {
      if (!audioRef.current || !currentTrack) return
      audioRef.current.currentTime = Math.max(
        currentTrack.startMs / 1000,
        audioRef.current.currentTime - (details.seekOffset ?? 10),
      )
    })
    setAction("seekforward", (details) => {
      if (!audioRef.current || !currentTrack) return
      audioRef.current.currentTime = Math.min(
        currentTrack.endMs / 1000,
        audioRef.current.currentTime + (details.seekOffset ?? 10),
      )
    })
    setAction("seekto", (details) => {
      if (!audioRef.current || !currentTrack || details.seekTime === undefined) return
      audioRef.current.currentTime = Math.min(
        currentTrack.endMs / 1000,
        currentTrack.startMs / 1000 + details.seekTime,
      )
    })

    return () => {
      setAction("play", null)
      setAction("pause", null)
      setAction("previoustrack", null)
      setAction("nexttrack", null)
      setAction("seekbackward", null)
      setAction("seekforward", null)
      setAction("seekto", null)
    }
  }, [
    canGoToNextVerse,
    canGoToPreviousVerse,
    currentPage,
    currentTrack,
    currentVerse,
    goToNextVerse,
    goToPreviousVerse,
    isPlaying,
    recitationSyncScope,
    selectedReciter.name,
    startPlayback,
  ])

  const renderReciterItem = (item: (typeof RECITERS)[number]) => {
    const isFavorite = favoriteReciters.includes(item.id)
    const isSelected = reciter === item.id
    const synchronizationLabel = item.id === AHMED_DEBAN_RECITER_ID
      ? "متزامن بالسورة"
      : item.id === YASSER_SALAMA_RECITER_ID
        ? "متزامن بالصفحة"
        : "متزامن بالآية"

    return (
      <CommandItem
        key={item.id}
        value={`${item.name} ${item.detail} ${item.id}`}
        onSelect={() => selectReciter(item.id)}
        className="min-h-11"
      >
        <Check className={cn("size-4 text-primary", !isSelected && "opacity-0")} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.detail} · {synchronizationLabel}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="ms-auto"
          aria-label={isFavorite ? `إزالة ${item.name} من المفضلة` : `إضافة ${item.name} إلى المفضلة`}
          aria-pressed={isFavorite}
          onMouseDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            toggleFavoriteReciter(item.id)
          }}
        >
          <Star className={cn(isFavorite && "fill-amber-400 text-amber-500")} />
        </Button>
      </CommandItem>
    )
  }

  const renderReciterCommand = (mobile = false) => (
    <Command className={cn(mobile && "h-full")}>
      <CommandInput placeholder="ابحث عن قارئ..." />
      <CommandList className={cn(mobile ? "max-h-[58dvh]" : "max-h-72")}>
        <CommandEmpty>لا يوجد قارئ بهذا الاسم</CommandEmpty>
        {favoriteReaderItems.length > 0 && (
          <CommandGroup heading="المفضلة">
            {favoriteReaderItems.map(renderReciterItem)}
          </CommandGroup>
        )}
        <CommandGroup heading="جميع القراء">
          {otherReaderItems.map(renderReciterItem)}
        </CommandGroup>
      </CommandList>
    </Command>
  )

  const renderExtendedSpeedContent = () => (
    <PopoverContent align="start" side="top" className="w-64 space-y-3 p-3" dir="rtl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">السرعات الأعلى</p>
          <p className="text-[11px] text-muted-foreground">المتاح بالنقر العادي حتى {SLIDER_MAX_SPEED}×</p>
        </div>
        <span className="text-sm font-semibold tabular-nums">{speed}×</span>
      </div>
      <Slider
        value={[Math.max(speed, EXTENDED_MIN_SPEED)]}
        min={EXTENDED_MIN_SPEED}
        max={MAX_SPEED}
        step={0.25}
        aria-label="السرعات الأعلى"
        onValueChange={(value) => updateSpeed(value[0])}
      />
      <div className="flex justify-between text-[10px] font-medium text-muted-foreground" dir="ltr">
        <span>{EXTENDED_MIN_SPEED}×</span>
        <span>{MAX_SPEED}×</span>
      </div>
      <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs">
        <span className="text-muted-foreground">مدة الجزء المحدد</span>
        <span className="font-semibold tabular-nums" aria-live="polite">
          {sessionDurationLoading
            ? "جاري الحساب..."
            : adjustedSessionDuration !== null
              ? `${sessionDuration?.approximate ? "≈" : ""}${formatSessionDuration(adjustedSessionDuration)}`
              : "غير متاحة"}
        </span>
      </div>
    </PopoverContent>
  )

  const renderPlaybackSpeedControl = () => (
    <Popover open={extendedSpeedOpen} onOpenChange={setExtendedSpeedOpen}>
      <PopoverAnchor asChild>
        <Button
          variant="ghost"
          size={largeControls ? "icon-sm" : "xs"}
          className={cn(
            "relative size-[28px] shrink-0 touch-manipulation p-0 text-muted-foreground sm:size-8",
            largeControls && "size-11",
            compactPlaybackChrome && "sm:size-7",
          )}
          aria-label={`تغيير سرعة التلاوة، السرعة الحالية ${speed}×. اضغط مطولًا للسرعات الأعلى`}
          aria-haspopup="dialog"
          aria-expanded={extendedSpeedOpen}
          onPointerDown={beginSpeedLongPress}
          onPointerUp={clearSpeedLongPress}
          onPointerCancel={clearSpeedLongPress}
          onPointerLeave={clearSpeedLongPress}
          onContextMenu={handleSpeedContextMenu}
          onClick={handleSpeedButtonClick}
        >
          <Gauge className="size-4" />
          <span className="absolute -right-0.5 -bottom-0.5 min-w-[2.4ch] rounded-sm bg-secondary px-0.5 text-[7px] font-bold leading-3 text-secondary-foreground tabular-nums sm:text-[8px]">
            {speed}×
          </span>
        </Button>
      </PopoverAnchor>
      {renderExtendedSpeedContent()}
    </Popover>
  )

  const renderPlaybackStopControl = () => (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          variant={playbackStopMode !== "off" ? "secondary" : "ghost"}
          size="icon-sm"
          className={cn(
            "relative size-[28px] shrink-0 sm:size-8",
            largeControls && "size-11",
            compactPlaybackChrome && "sm:size-7",
          )}
          aria-label={sleepTimerRemaining !== null
            ? `مؤقت التلاوة، متبقي ${Math.max(1, Math.ceil(sleepTimerRemaining / 60))} دقيقة`
            : playbackStopMode === "off" ? "مؤقت إيقاف التلاوة" : "مؤقت التلاوة مفعل"}
          aria-pressed={playbackStopMode !== "off"}
        >
          <TimerOff />
          {sleepTimerRemaining !== null && (
            <span className="absolute -right-0.5 -bottom-0.5 min-w-[2.4ch] rounded-sm bg-primary px-0.5 text-[7px] font-bold leading-3 text-primary-foreground tabular-nums">
              {Math.max(1, Math.ceil(sleepTimerRemaining / 60))}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-52">
        <DropdownMenuRadioGroup value={playbackStopMode} onValueChange={(value) => selectPlaybackStopMode(value as PlaybackStopMode)}>
          <DropdownMenuRadioItem value="off">بدون مؤقت</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="10m">بعد 10 دقائق</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="20m">بعد 20 دقيقة</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="30m">بعد 30 دقيقة</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="60m">بعد 60 دقيقة</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuRadioItem value="page" disabled={recitationSyncScope === "chapter"}>نهاية الصفحة</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="surah" disabled={!surahEndStopAvailable}>نهاية السورة</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="session" disabled={!boundedSessionActive}>نهاية الجلسة</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const renderPlayerReviewControl = () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={audioReviewActive ? "secondary" : "ghost"}
          size="icon-sm"
          className={cn("size-[28px] shrink-0 sm:size-8", largeControls && "size-11")}
          aria-label={audioReviewActive
            ? "إظهار جميع الآيات"
            : isPlaying && hasVerseSynchronization ? audioReviewActionLabel : "بدء التسميع المفتوح"}
          aria-pressed={audioReviewActive}
          onClick={toggleAudioReview}
        >
          {audioReviewActive ? <Eye /> : <EyeOff />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{audioReviewActive ? "إظهار جميع الآيات" : isPlaying && hasVerseSynchronization ? audioReviewActionLabel : "بدء التسميع المفتوح"}</TooltipContent>
    </Tooltip>
  )

  const renderPlayerScrollControl = () => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("size-[28px] shrink-0 sm:size-8", largeControls && "size-11")}
          aria-label="بدء التمرير التلقائي"
          onClick={startContinuousAutoScroll}
        >
          <ChevronsUpDown />
        </Button>
      </TooltipTrigger>
      <TooltipContent>تمرير تلقائي</TooltipContent>
    </Tooltip>
  )

  const renderPlayerReciterControl = () => (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("size-[28px] shrink-0 sm:hidden", largeControls && "size-11")}
            aria-label={`اختيار القارئ، الحالي ${selectedReciter.name}`}
            aria-expanded={mobileReciterPickerOpen}
            onClick={() => setMobileReciterPickerOpen(true)}
          >
            <Headphones />
          </Button>
        </TooltipTrigger>
        <TooltipContent>اختيار القارئ</TooltipContent>
      </Tooltip>
      <Popover open={compactReciterPickerOpen} onOpenChange={setCompactReciterPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn("hidden size-8 shrink-0 sm:inline-flex", largeControls && "size-11")}
            aria-label={`اختيار القارئ، الحالي ${selectedReciter.name}`}
            aria-expanded={compactReciterPickerOpen}
          >
            <Headphones />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="z-[80] w-[min(340px,calc(100vw-2rem))] p-0" dir="rtl">
          {renderReciterCommand()}
        </PopoverContent>
      </Popover>
    </>
  )

  const renderPlayerVolumeControl = () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("size-[28px] shrink-0 sm:size-8", largeControls && "size-11")}
          aria-label={`مستوى الصوت ${Math.round(volume * 100)}%`}
        >
          {volume === 0 ? <VolumeX /> : volume < 0.5 ? <Volume1 /> : <Volume2 />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-64 space-y-3" dir="rtl">
        <div className="flex items-center justify-between gap-3">
          <Label>مستوى الصوت</Label>
          <span className="text-sm font-semibold tabular-nums">{Math.round(volume * 100)}%</span>
        </div>
        <Slider
          value={[volume]}
          min={0}
          max={1}
          step={0.05}
          aria-label="مستوى الصوت"
          onValueChange={(value) => updateVolume(value[0])}
        />
        <Button variant="outline" size="sm" className="w-full" onClick={toggleMute}>
          {volume === 0 ? <Volume2 /> : <VolumeX />}
          {volume === 0 ? "إلغاء كتم الصوت" : "كتم الصوت"}
        </Button>
      </PopoverContent>
    </Popover>
  )

  const renderBookmarkFilters = () => (
    <div className="grid grid-cols-2 gap-2 border-b p-2" dir="rtl">
      <Select
        value={bookmarkCategoryFilter}
        onValueChange={setBookmarkCategoryFilter}
      >
        <SelectTrigger className="h-8 min-w-0 text-xs" aria-label="تصفية العلامات حسب النوع">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">كل الأنواع</SelectItem>
          {bookmarkCategories.map((category) => (
            <SelectItem key={category.id} value={category.id}>{category.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={bookmarkChapterFilter} onValueChange={setBookmarkChapterFilter}>
        <SelectTrigger className="h-8 min-w-0 text-xs" aria-label="تصفية العلامات حسب السورة">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">كل السور</SelectItem>
          {bookmarkChapterOptions.map((chapter) => (
            <SelectItem key={chapter.id} value={String(chapter.id)}>سورة {chapter.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const renderBookmarkOrderControls = (bookmark: BookmarkItem) => {
    const bookmarkIndex = filteredBookmarks.findIndex((item) => item.id === bookmark.id)
    return (
      <div className="grid shrink-0 grid-rows-2" aria-label={`ترتيب علامة الآية ${bookmark.verseKey}`}>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6"
          disabled={bookmarkIndex <= 0}
          aria-label={`تحريك علامة الآية ${bookmark.verseKey} لأعلى`}
          onClick={() => moveBookmark(bookmark.id, "up", filteredBookmarkIds)}
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6"
          disabled={bookmarkIndex < 0 || bookmarkIndex >= filteredBookmarks.length - 1}
          aria-label={`تحريك علامة الآية ${bookmark.verseKey} لأسفل`}
          onClick={() => moveBookmark(bookmark.id, "down", filteredBookmarkIds)}
        >
          <ChevronDown />
        </Button>
      </div>
    )
  }

  const renderBookmarkCategoryMenu = (bookmark: BookmarkItem) => (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="h-7 max-w-24 gap-1 px-1.5 text-[10px] font-normal text-muted-foreground"
          aria-label={`تصنيف العلامة ${bookmark.verseKey}`}
        >
          <span className="truncate">{getBookmarkCategoryLabel(bookmarkCategories, bookmark.category) ?? "تصنيف"}</span>
          <ChevronDown className="size-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onSelect={() => updateBookmarkCategory(bookmark.id)}>
          <Check className={cn("size-4", bookmark.category && "opacity-0")} />
          بدون تصنيف
        </DropdownMenuItem>
        {bookmarkCategories.map((category) => (
          <DropdownMenuItem
            key={category.id}
            onSelect={() => updateBookmarkCategory(bookmark.id, category.id)}
          >
            <Check className={cn("size-4", bookmark.category !== category.id && "opacity-0")} />
            {category.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const renderBookmarkRows = (closeMobile = false) => {
    if (filteredBookmarks.length === 0) {
      return <p className="px-3 py-8 text-center text-xs text-muted-foreground">لا توجد علامات مطابقة للتصفية</p>
    }
    return filteredBookmarks.map((bookmark) => (
      <div key={bookmark.id} className="flex items-center gap-1 border-b last:border-0">
        {renderBookmarkOrderControls(bookmark)}
        <button
          type="button"
          className="min-w-0 flex-1 px-3 py-2.5 text-right hover:bg-accent/50"
          onClick={() => {
            if (closeMobile) setMobileMarksOpen(false)
            openBookmark(bookmark)
          }}
        >
          <span className="block truncate text-base font-semibold">
            سورة {getBookmarkChapterName(bookmark.chapterId, bookmark.chapterName)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            الآية {bookmark.verseKey} · صفحة {formatNumber(bookmark.page)}
          </span>
        </button>
        {renderBookmarkCategoryMenu(bookmark)}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="حذف العلامة"
          onClick={() => removeBookmark(bookmark.id)}
        >
          <Trash2 />
        </Button>
      </div>
    ))
  }

  const renderMushafPage = (
    page: number,
    pageVerses: QuranVerse[],
    qcfPage: Qcf4Page | undefined,
    isCurrentPage: boolean,
    loading = false,
    matchCurrentLayout = false,
    continuousLayout = false,
  ) => {
    const useCurrentLayout = isCurrentPage || matchCurrentLayout
    if (viewMode === "text") {
      return (
        <QuranTextPage
          page={page}
          verses={pageVerses}
          qcfPage={qcfPage}
          activeVerseKey={isCurrentPage && !practiceActive && hasVerseSynchronization &&
            (isPlaying || elapsed > 0 || audioReviewActive) && (
              !continuousLayout || (continuousRecitationFollow && isPlaying)
            ) ? currentVerse?.verseKey : undefined}
          selectedVerseKey={!continuousLayout && isCurrentPage ? selectedVerseKey : undefined}
          visibleVerseKeys={continuousLayout
            ? getAudioReviewVisibleVerseKeys(page, pageVerses)
            : isCurrentPage
              ? practiceActive
                ? practiceReady ? practiceVisibleVerseKeys : []
                : audioReviewVisibleVerseKeys
              : undefined}
          progressiveReveal={audioReviewActive
            ? getAudioReviewProgressiveReveal(page, pageVerses)
            : undefined}
          readingMode={readingMode}
          lineSpacing={lineSpacing}
          largeTextSize={largeTextSize}
          autoScroll={!continuousLayout && autoScroll}
          showOrnamentsWhenMasked={continuousLayout
            ? audioReviewActive
            : isCurrentPage && (audioReviewActive || (practiceActive && activePracticeMode === "recite"))}
          hidePageIdentity={continuousLayout || landscapeReadingMode || (!isCurrentPage && pageSwipeDirection !== 0) || (isCurrentPage && practiceActive && activePracticeMode === "test")}
          hidePageNumber={continuousLayout}
          floatingPageIdentity={!continuousLayout && isCurrentPage && isFullscreen && !landscapeReadingMode}
          reserveTopChrome={continuousLayout
            ? false
            : useCurrentLayout && isFullscreen
              ? "fullscreen"
              : !landscapeReadingMode && !(isCurrentPage && practiceActive && activePracticeMode === "test")
                ? "page"
                : false}
          isLoading={loading}
          className={cn(
            useCurrentLayout && !practiceActive && !readerFocusActive && !mobileWorkspaceOpen &&
              readingMode === "page" && "max-sm:border-y-0",
            useCurrentLayout && adaptivePageSpacing && !continuousLayout &&
              "h-full w-full aspect-auto rounded-none border-0",
            continuousLayout && "aspect-[672/1080] border-x-0",
            readerFocusActive && useCurrentLayout && !continuousLayout
              ? readingMode === "page"
                ? lineReadingLayout
                  ? "w-full rounded-none border-0"
                  : "h-full aspect-auto rounded-none border-0 sm:h-auto sm:aspect-[672/1080]"
                : "h-full rounded-none border-0"
              : undefined,
          )}
          standardPageAspect={useCurrentLayout && pdfSaving}
          fluidPageAspect={useCurrentLayout && adaptivePageSpacing && !continuousLayout}
          compactHorizontalMargins={!continuousLayout && useCurrentLayout && readerFocusActive && readingMode === "page"}
          pageIdentityGap={readingMode === "large"}
          highlights={continuousLayout ? [] : verseHighlights}
          highlightDraft={!continuousLayout && isCurrentPage ? highlightDraft : null}
          onVerseLongPress={!continuousLayout && isCurrentPage && !practiceActive && !audioReviewActive ? openVerseActions : undefined}
          onHighlightPositionSelect={!continuousLayout && isCurrentPage && highlightDraft ? selectHighlightPosition : undefined}
          onHighlightRangeChange={!continuousLayout && isCurrentPage && highlightDraft ? updateHighlightRange : undefined}
          onPageTap={!continuousLayout && isCurrentPage
            ? practiceActive && practiceReady
              ? advancePractice
              : audioReviewActive && (!isPlaying || !hasVerseSynchronization)
                ? advanceManualAudioReview
                : undefined
            : undefined}
          onCenterTap={!continuousLayout && isCurrentPage && !practiceActive && centerTapFullscreen ? () => void toggleFullscreen() : undefined}
          onUnicodeCopy={() => toast.success("تم نسخ النص القرآني بصيغة Unicode")}
        />
      )
    }

    return (
      <div
        className={cn(
          "relative aspect-[672/958] overflow-hidden rounded-none border border-[var(--mushaf-border)] bg-[var(--mushaf-paper)] sm:rounded-sm",
          readerFocusActive && useCurrentLayout && "rounded-none border-0",
        )}
        aria-label={`صفحة ${page} من المصحف الشريف`}
        role={isCurrentPage && !practiceActive ? "button" : undefined}
        tabIndex={isCurrentPage && !practiceActive ? 0 : undefined}
        onClick={isCurrentPage && centerTapFullscreen ? handleImageCenterTap : undefined}
        onKeyDown={isCurrentPage && !practiceActive && centerTapFullscreen ? (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            void toggleFullscreen()
          }
        } : undefined}
      >
        {isCurrentPage && imageLoading && (
          <div className="absolute inset-0 grid place-items-center bg-[var(--mushaf-paper)]">
            <LoaderCircle className="size-7 animate-spin text-primary" />
          </div>
        )}
        <Image
          key={page}
          src={`https://cdn.myquran.com/img/page/${page}.png`}
          alt={`صفحة ${page} من المصحف الشريف`}
          width={672}
          height={958}
          priority={isCurrentPage}
          className={cn(
            "h-full w-full object-contain transition-[filter,opacity] dark:brightness-[0.82] dark:contrast-[0.96]",
            isCurrentPage && imageLoading && "opacity-0",
          )}
          onLoad={() => {
            imagePageCacheRef.current.add(page)
            if (isCurrentPage) setImageLoading(false)
          }}
        />
      </div>
    )
  }

  const renderSavedSessionMenu = (session: SavedSessionPreset) => (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`إدارة الجلسة ${session.name}`}>
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={() => editSavedSession(session)}>
          <Settings2 />
          تعديل الإعدادات
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => openRenameSavedSession(session)}>
          <Pencil />
          إعادة التسمية
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => setDeleteSavedSessionTarget(session)}
        >
          <Trash2 />
          حذف الجلسة
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const recentActivitySection = (
    <div className="space-y-1.5 border-t bg-card px-3 py-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
          <Bookmark className="size-3 text-primary" />
          الأخيرة في {sessionMode === "listen" ? "الاستماع" : sessionMode === "recite" ? "التسميع" : "الاختبار"}
        </p>
        {(currentModeSavedSessions.length > 0 || previousSessions.some((session) => session.mode === sessionMode)) ? (
          <div className="grid max-h-28 grid-cols-2 gap-px overflow-y-auto border bg-border">
            {currentModeSavedSessions.slice(0, 3).map((session) => (
              <div key={`saved-${session.id}`} className="flex min-w-0 items-center gap-1 bg-card">
                <button
                  type="button"
                  className="min-w-0 flex-1 touch-manipulation px-2 py-1.5 text-right hover:bg-accent"
                  onClick={() => openSessionFromRecent(session)}
                  onPointerDown={() => scheduleSessionLongPress(session)}
                  onPointerUp={cancelSessionLongPress}
                  onPointerCancel={cancelSessionLongPress}
                  onPointerLeave={cancelSessionLongPress}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    cancelSessionLongPress()
                    suppressNextSessionClick()
                    configureSession(session)
                  }}
                >
                  <span className="block truncate text-xs font-semibold">{session.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    محفوظة · {sessionPageRangeLabel(session, quickNavigationData)}
                  </span>
                </button>
                {renderSavedSessionMenu(session)}
              </div>
            ))}
            {previousSessions.filter((session) => session.mode === sessionMode).slice(0, 3).map((session) => (
              <button
                key={`previous-${session.id}`}
                type="button"
                className="col-span-2 block min-w-0 touch-manipulation bg-card px-2 py-1.5 text-right hover:bg-accent"
                onClick={() => openSessionFromRecent(session)}
                onPointerDown={() => scheduleSessionLongPress(session)}
                onPointerUp={cancelSessionLongPress}
                onPointerCancel={cancelSessionLongPress}
                onPointerLeave={cancelSessionLongPress}
                onContextMenu={(event) => {
                  event.preventDefault()
                  cancelSessionLongPress()
                  suppressNextSessionClick()
                  configureSession(session)
                }}
              >
                <span className="block truncate text-xs font-semibold leading-5">
                  {sessionChapterRangeLabel(session, quickNavigationData) ?? "الجلسة السابقة"}
                </span>
                <span className="block truncate text-xs font-semibold leading-5">
                  من صفحة {session.startPage} إلى صفحة {session.endPage}
                  {session.currentVerseKey ? ` · آية ${session.currentVerseKey}` : ""}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="border-y py-1.5 text-xs text-muted-foreground">لا توجد مواضع سابقة بعد.</p>
        )}
    </div>
  )

  const activityControls = (
    <div className="border-b bg-secondary/20" dir="rtl">
      {sessionSettingsOpen ? (
        <div className="flex items-center justify-between gap-3 border-b bg-card px-3 py-2">
          <p className="text-sm font-semibold">
            {sessionMode === "listen" ? "اختيار الاستماع" : sessionMode === "recite" ? "اختيار التسميع" : "اختيار الاختبار"}
          </p>
          <Button
            variant="ghost"
            size="xs"
            className="shrink-0"
            onClick={() => {
              pendingLearningPlanTypeRef.current = undefined
              setSessionSettingsOpen(false)
            }}
          >
            <Bookmark /> جلساتي
          </Button>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-2 text-xs">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-semibold">النطاق الأخير</p>
              <p className="text-muted-foreground">
                {sessionRangeLabel({
                  startPage: draftStart,
                  endPage: draftEnd,
                  startVerseKey: draftStartVerseKey,
                  endVerseKey: draftEndVerseKey,
                })}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={toggleSessionConfiguration}>
            <Settings2 /> جلسة جديدة
          </Button>
        </div>
      )}

      {sessionSettingsOpen && (
        <div className={cn(
          "border-t bg-card",
          dashboardOpen
            ? "grid max-h-none gap-3 overflow-visible p-3 sm:grid-cols-2 sm:items-start [&>*]:min-w-0"
            : "max-h-[48dvh] space-y-5 overflow-y-auto p-4",
        )}>
          <QuranSessionRangePicker
            currentPage={currentPage}
            pageStart={draftStart}
            pageCount={draftCount}
            startVerseKey={draftStartVerseKey}
            endVerseKey={draftEndVerseKey}
            onSetRange={setSessionNavigationRange}
          />

          <div className="space-y-3">
          {sessionMode === "listen" && (
            <div className="space-y-2 border-y py-2">
              <div className={cn(
                "grid items-center gap-2",
                hasVerseSynchronization
                  ? "grid-cols-[minmax(0,1fr)_auto_auto]"
                  : "grid-cols-[minmax(0,1fr)_auto]",
              )}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <Label className="shrink-0 text-[11px]">القارئ</Label>
                  <Popover open={reciterPickerOpen} onOpenChange={setReciterPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={reciterPickerOpen}
                        className="h-8 min-w-0 flex-1 justify-between gap-1 px-2 font-normal"
                      >
                        <span className="min-w-0 truncate text-right text-[11px] font-medium">
                          {selectedReciter.name}
                        </span>
                        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(340px,calc(100vw-2rem))] p-0">
                      {renderReciterCommand()}
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex items-center gap-1">
                  <Label htmlFor="session-repeat-count" className="shrink-0 text-[10px] text-muted-foreground">
                    التكرار
                  </Label>
                  <Input
                    id="session-repeat-count"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    value={repeatTarget}
                    onChange={(event) => setRepeatTarget(String(clamp(Number(event.target.value) || 1, 1, 99)))}
                    className="h-8 w-11 px-1 text-center text-xs font-semibold tabular-nums"
                    aria-label="مرات تكرار النطاق"
                  />
                </div>

                {hasVerseSynchronization && (
                  <div className="flex items-center gap-0.5">
                    <Label htmlFor="ayah-repeat" className="whitespace-nowrap text-[10px] text-muted-foreground">
                      تكرار الآية
                    </Label>
                    <Switch
                      id="ayah-repeat"
                      dir="ltr"
                      checked={ayahRepeatEnabled}
                      onCheckedChange={setAyahRepeatEnabled}
                      className="-mx-1 scale-75"
                    />
                  </div>
                )}
              </div>

              {hasVerseSynchronization ? (
                ayahRepeatEnabled && (
                  <div className="flex items-center justify-end gap-3 border-t pt-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="ayah-repeat-count" className="text-[10px] text-muted-foreground">مرات الآية</Label>
                      <Input
                        id="ayah-repeat-count"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={20}
                        value={ayahRepeatCount}
                        onChange={(event) => setAyahRepeatCount(clamp(Number(event.target.value) || 1, 1, 20))}
                        className="h-7 w-12 px-1 text-center text-xs tabular-nums"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label htmlFor="ayah-pause" className="text-[10px] text-muted-foreground">الفاصل (ث)</Label>
                      <Input
                        id="ayah-pause"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={10}
                        step={0.5}
                        value={ayahPauseSeconds}
                        onChange={(event) => {
                          const value = Number(event.target.value)
                          setAyahPauseSeconds(Math.min(Math.max(value || 0, 0), 10))
                        }}
                        className="h-7 w-12 px-1 text-center text-xs tabular-nums"
                      />
                    </div>
                  </div>
                )
              ) : (
                <div className="flex items-start gap-2 border-t pt-2 text-xs leading-5 text-muted-foreground">
                  <Headphones className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p>
                    مصحف حدر متزامن مع {recitationSyncScope === "chapter" ? "السور" : "صفحات المصحف"} فقط؛
                    لا تتوفر إضاءة الآيات أو تكرار آية منفردة.
                  </p>
                </div>
              )}
            </div>
          )}

          {sessionMode === "test" && (
            <div className="space-y-2 border-y py-2">
              <div className="flex items-center gap-2">
                <GitCompareArrows className="size-4 shrink-0 text-primary" />
                <Label htmlFor="mutashabihat-test" className="min-w-0 flex-1 text-xs font-semibold">
                  اختبار المتشابهات
                </Label>
                <Switch
                  id="mutashabihat-test"
                  dir="ltr"
                  checked={testKind === "mutashabihat"}
                  onCheckedChange={(checked) => setTestKind(checked ? "mutashabihat" : "standard")}
                />
              </div>
              {testKind === "mutashabihat" && (
                <div className="grid grid-cols-2 gap-px border bg-border">
                  {MUTASHABIHAT_TEST_TYPE_OPTIONS.map((option) => {
                    const checked = mutashabihatTestTypes.includes(option.value)
                    return (
                      <Label
                        key={option.value}
                        htmlFor={`mutashabihat-test-${option.value}`}
                        className="flex min-h-9 cursor-pointer items-center gap-2 bg-card px-2 text-[11px] font-medium"
                      >
                        <Checkbox
                          id={`mutashabihat-test-${option.value}`}
                          checked={checked}
                          onCheckedChange={(nextChecked) => setMutashabihatTestTypes((current) =>
                            nextChecked
                              ? [...new Set([...current, option.value])]
                              : current.filter((type) => type !== option.value),
                          )}
                        />
                        {option.label}
                      </Label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <Button
            size="sm"
            className="w-full"
            disabled={mutashabihatTestLoading || (sessionMode === "test" && testKind === "mutashabihat" && mutashabihatTestTypes.length === 0)}
            onClick={() => void startSession()}
          >
            {mutashabihatTestLoading
              ? <LoaderCircle className="animate-spin" />
              : sessionMode === "listen" ? <Play className="fill-current" /> : sessionMode === "recite" ? <Mic /> : <Shuffle />}
            {sessionMode === "listen" ? "ابدأ الاستماع" : sessionMode === "recite" ? "ابدأ التسميع" : "ابدأ الاختبار"}
          </Button>

          {sessionMode === "listen" && (
            <SessionRangeDownload
              range={{
                startPage: draftStart,
                endPage: draftEnd,
                startVerseKey: draftStartVerseKey,
                endVerseKey: draftEndVerseKey,
              }}
              reciter={reciter}
              reciterName={`${selectedReciter.name} · ${selectedReciter.detail}`}
              compact
            />
          )}

          <div className="space-y-2 border-t pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="session-name">
                حفظ جلسة {sessionMode === "listen" ? "الاستماع" : sessionMode === "recite" ? "التسميع" : "الاختبار"} <span className="font-normal text-muted-foreground">(اختياري)</span>
              </Label>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Input
                  id="session-name"
                  value={savedSessionName}
                  onChange={(event) => setSavedSessionName(event.target.value)}
                  placeholder="اسم الجلسة"
                  className="h-9"
                />
                <Button variant="outline" size="sm" onClick={saveCurrentSession}>
                  <Bookmark />
                  {editingSavedSessionId ? "حفظ التعديلات" : "حفظ الجلسة"}
                </Button>
              </div>
            </div>
            {editingSavedSessionId && (
              <div className="flex items-center justify-between gap-2 bg-secondary/35 px-2.5 py-2 text-xs">
                <span className="truncate">تعديل جلسة محفوظة</span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setEditingSavedSessionId(null)
                    setSavedSessionName("")
                  }}
                >
                  إلغاء التعديل
                </Button>
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {recentActivitySection}
    </div>
  )

  const renderLandscapeReaderBar = (fullscreen: boolean) => {
    if (!landscapeReadingMode || !landscapePageIdentity || dashboardOpen || practiceActive) return null
    const hizbQuarter = landscapePageIdentity.rubAlHizbNumber > 0
      ? ((landscapePageIdentity.rubAlHizbNumber - 1) % 4) + 1
      : null
    return (
      <div
        className={cn(
          "pointer-events-none right-0 left-0 h-7 border-b border-border/25 bg-card/90 text-[9px] font-semibold text-muted-foreground shadow-sm backdrop-blur-sm sm:text-[10px]",
          fullscreen
            ? "fixed top-[max(0rem,env(safe-area-inset-top))] z-30"
            : "absolute inset-y-0 z-10",
        )}
        aria-label={`الجزء ${landscapePageIdentity.juzNumber}، الحزب ${landscapePageIdentity.hizbNumber}${hizbQuarter ? `، الربع ${hizbQuarter}` : ""}، سورة ${landscapePageIdentity.chapterName}`}
        data-landscape-reader-bar
        dir="rtl"
      >
        <span className="absolute top-1/2 left-1/2 flex w-[min(52vw,520px)] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-4 overflow-hidden whitespace-nowrap">
          <span className="flex shrink-0 items-center gap-1">
            <span>الجزء {landscapePageIdentity.juzNumber}</span>
            <span aria-hidden="true">·</span>
            <span>الحزب {landscapePageIdentity.hizbNumber}</span>
            {landscapePageIdentity.hizbNumber > 0 && landscapePageIdentity.rubAlHizbNumber > 0 && (
              <HizbQuarterIndicator
                hizbNumber={landscapePageIdentity.hizbNumber}
                rubAlHizbNumber={landscapePageIdentity.rubAlHizbNumber}
              />
            )}
          </span>
          <span className="min-w-0 truncate">سورة {landscapePageIdentity.chapterName}</span>
        </span>
      </div>
    )
  }

  const quickNavigatorDisplayPage = clamp(Math.round(quickNavigatorPage), 1, MAX_PAGE)
  const quickNavigatorChapter = quickNavigationData?.chapters.find((item) =>
    quickNavigatorDisplayPage >= item.startPage && quickNavigatorDisplayPage <= item.endPage)
  const quickNavigatorJuz = quickNavigationData?.juzs.find((item) =>
    quickNavigatorDisplayPage >= item.startPage && quickNavigatorDisplayPage <= item.endPage)
  const quickNavigatorHizb = quickNavigationData?.hizbs.find((item) =>
    quickNavigatorDisplayPage >= item.startPage && quickNavigatorDisplayPage <= item.endPage)
  const nearbyChapterStarts = quickNavigationData?.chapters.filter((item) =>
    Math.abs(item.startPage - quickNavigatorDisplayPage) <= 20).length ?? 0
  const quickNavigatorWindowPageCount = nearbyChapterStarts >= 16 ? 3 : nearbyChapterStarts >= 9 ? 15 : 41
  const quickNavigatorWindowSpan = quickNavigatorWindowPageCount - 1
  const quickNavigatorWindowRadius = Math.floor(quickNavigatorWindowSpan / 2)
  const quickNavigatorWindowStart = Math.max(
    1,
    Math.min(MAX_PAGE - quickNavigatorWindowSpan, Math.floor(quickNavigatorPage) - quickNavigatorWindowRadius),
  )
  const quickNavigatorWindowPages = Array.from(
    { length: quickNavigatorWindowPageCount },
    (_, index) => quickNavigatorWindowStart + index,
  )
  const quickNavigatorWindowEnd = quickNavigatorWindowStart + quickNavigatorWindowSpan
  const quickNavigatorPageScale = 100 / quickNavigatorWindowSpan
  const quickNavigatorTrackPosition = (page: number) =>
    `calc(50% + ${(quickNavigatorPage - page) * quickNavigatorPageScale}%)`
  const quickNavigatorTrackRangeStyle = (startPage: number, endPage: number) => {
    const visibleStart = Math.max(startPage, quickNavigatorWindowStart)
    const visibleEnd = Math.min(endPage, quickNavigatorWindowEnd)
    const centerPage = (visibleStart + visibleEnd) / 2
    return {
      left: quickNavigatorTrackPosition(centerPage),
      width: `${Math.max(1, visibleEnd - visibleStart + 1) * quickNavigatorPageScale}%`,
    }
  }
  const quickNavigatorVisibleChapters = quickNavigationData?.chapters.filter((item) =>
    item.endPage >= quickNavigatorWindowStart && item.startPage <= quickNavigatorWindowEnd) ?? []
  const quickNavigatorChapterLanes = quickNavigatorVisibleChapters.reduce<Array<{
    chapter: QuickNavigationData["chapters"][number]
    lane: number
  }>>((items, chapter) => {
    const laneLastPages = [0, 0, 0]
    for (const item of items) laneLastPages[item.lane] = item.chapter.startPage
    const minimumPageGap = quickNavigatorWindowPageCount <= 3 ? 1 : 5
    const availableLane = laneLastPages.findIndex((page) => chapter.startPage - page >= minimumPageGap)
    const lane = availableLane >= 0
      ? availableLane
      : laneLastPages.indexOf(Math.min(...laneLastPages))
    items.push({ chapter, lane })
    return items
  }, [])
  const quickNavigatorVisibleJuzs = quickNavigationData?.juzs.filter((item) =>
    item.endPage >= quickNavigatorWindowStart && item.startPage <= quickNavigatorWindowEnd) ?? []
  const quickNavigatorBrowsePageStart = Math.max(1, Math.min(MAX_PAGE - 24, quickNavigatorDisplayPage - 12))
  const quickNavigatorBrowsePages = Array.from({ length: 25 }, (_, index) => quickNavigatorBrowsePageStart + index)
  const quickNavigatorNearbyChapters = [...(quickNavigationData?.chapters ?? [])]
    .filter((chapter) => chapter.id !== quickNavigatorChapter?.id)
    .sort((first, second) =>
      Math.abs(first.startPage - quickNavigatorDisplayPage) - Math.abs(second.startPage - quickNavigatorDisplayPage))
    .slice(0, 4)
    .sort((first, second) => first.startPage - second.startPage)

  const renderQuickNavigatorBrowseButton = ({
    itemKey,
    label,
    detail,
    page,
    verseKey,
    accessibleLabel,
    compact = false,
    active = false,
  }: {
    itemKey: string
    label: string
    detail?: string
    page: number
    verseKey?: string
    accessibleLabel?: string
    compact?: boolean
    active?: boolean
  }) => (
    <button
      key={itemKey}
      type="button"
      className={cn(
        "w-full min-w-0 border-b border-l border-border/55 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        compact
          ? "flex h-10 items-center justify-center px-1 text-center text-xs font-semibold tabular-nums"
          : "flex min-h-11 items-center justify-between gap-2 px-2.5 py-2 text-right",
        active && "bg-secondary/65 text-primary",
      )}
      data-page={page}
      data-quick-browse-item={itemKey}
      aria-label={`${accessibleLabel ?? label}، صفحة ${page}`}
      onClick={() => finishQuickNavigation(page, verseKey)}
    >
      <span className="min-w-0 truncate">{label}</span>
      {!compact && <span className="shrink-0 text-[10px] font-normal text-muted-foreground">{detail ?? `ص ${page}`}</span>}
    </button>
  )

  const renderQuickNavigatorBrowse = () => {
    if (!quickNavigationData) {
      return <div className="grid min-h-28 place-items-center"><LoaderCircle className="size-5 animate-spin text-primary" /></div>
    }

    if (quickNavigatorBrowseTab === "surahs") {
      return (
        <div className="grid grid-cols-2" data-quick-browse="surahs" dir="rtl">
          {quickNavigationData.chapters.map((chapter) => renderQuickNavigatorBrowseButton({
            itemKey: `surah-${chapter.id}`,
            label: `${chapter.id} · ${chapter.name}`,
            detail: `ص ${chapter.startPage}`,
            page: chapter.startPage,
            verseKey: `${chapter.id}:1`,
            accessibleLabel: `سورة ${chapter.name}`,
            active: chapter.id === quickNavigatorChapter?.id,
          }))}
        </div>
      )
    }

    if (quickNavigatorBrowseTab === "juzs") {
      return (
        <div className="grid grid-cols-5" data-quick-browse="juzs" dir="rtl">
          {quickNavigationData.juzs.map((juz) => renderQuickNavigatorBrowseButton({
            itemKey: `juz-${juz.number}`,
            label: String(juz.number),
            page: juz.startPage,
            verseKey: juz.firstVerseKey,
            accessibleLabel: `الجزء ${juz.number}`,
            compact: true,
            active: juz.number === quickNavigatorJuz?.number,
          }))}
        </div>
      )
    }

    if (quickNavigatorBrowseTab === "hizbs") {
      return (
        <div className="grid grid-cols-5" data-quick-browse="hizbs" dir="rtl">
          {quickNavigationData.hizbs.map((hizb) => renderQuickNavigatorBrowseButton({
            itemKey: `hizb-${hizb.number}`,
            label: String(hizb.number),
            page: hizb.startPage,
            verseKey: hizb.firstVerseKey,
            accessibleLabel: `الحزب ${hizb.number}`,
            compact: true,
            active: hizb.number === quickNavigatorHizb?.number,
          }))}
        </div>
      )
    }

    if (quickNavigatorBrowseTab === "pages") {
      return (
        <div data-quick-browse="pages">
          <div className="flex items-center gap-2 border-b border-border/55 px-2 py-2">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PAGE}
              value={quickNavigatorDisplayPage}
              aria-label="رقم صفحة المصحف"
              className="h-9 min-w-0 flex-1 text-center tabular-nums"
              onChange={(event) => updateQuickNavigatorPage(Number(event.target.value) || 1)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleQuickNavigatorCommit()
              }}
            />
            <Button type="button" size="sm" className="h-9 shrink-0 px-4" onClick={handleQuickNavigatorCommit}>
              انتقل
            </Button>
          </div>
          <div className="grid grid-cols-5" dir="rtl">
            {quickNavigatorBrowsePages.map((page) => renderQuickNavigatorBrowseButton({
              itemKey: `page-${page}`,
              label: String(page),
              page,
              verseKey: quickNavigationData.pages[page - 1]?.firstVerseKey,
              accessibleLabel: `الصفحة ${page}`,
              compact: true,
              active: page === currentPage,
            }))}
          </div>
        </div>
      )
    }

    return (
      <div data-quick-browse="nearby">
        {renderQuickNavigatorBrowseButton({
          itemKey: "nearby-current-page",
          label: `الصفحة ${quickNavigatorDisplayPage}`,
          detail: "الموضع الحالي",
          page: quickNavigatorDisplayPage,
          verseKey: quickNavigationData.pages[quickNavigatorDisplayPage - 1]?.firstVerseKey,
          active: quickNavigatorDisplayPage === currentPage,
        })}
        {quickNavigatorChapter && renderQuickNavigatorBrowseButton({
          itemKey: `nearby-surah-${quickNavigatorChapter.id}`,
          label: `سورة ${quickNavigatorChapter.name}`,
          detail: `ص ${quickNavigatorChapter.startPage}`,
          page: quickNavigatorChapter.startPage,
          verseKey: `${quickNavigatorChapter.id}:1`,
        })}
        {quickNavigatorJuz && renderQuickNavigatorBrowseButton({
          itemKey: `nearby-juz-${quickNavigatorJuz.number}`,
          label: `الجزء ${quickNavigatorJuz.number}`,
          detail: `ص ${quickNavigatorJuz.startPage}`,
          page: quickNavigatorJuz.startPage,
          verseKey: quickNavigatorJuz.firstVerseKey,
        })}
        {quickNavigatorHizb && renderQuickNavigatorBrowseButton({
          itemKey: `nearby-hizb-${quickNavigatorHizb.number}`,
          label: `الحزب ${quickNavigatorHizb.number}`,
          detail: `ص ${quickNavigatorHizb.startPage}`,
          page: quickNavigatorHizb.startPage,
          verseKey: quickNavigatorHizb.firstVerseKey,
        })}
        {quickNavigatorNearbyChapters.map((chapter) => renderQuickNavigatorBrowseButton({
          itemKey: `nearby-surah-${chapter.id}`,
          label: `سورة ${chapter.name}`,
          detail: `ص ${chapter.startPage}`,
          page: chapter.startPage,
          verseKey: `${chapter.id}:1`,
        }))}
      </div>
    )
  }

  const renderQuickNavigatorTrackArrows = (
    track: "pages" | "chapters" | "juzs",
    label: string,
    children: React.ReactNode,
  ) => {
    const atFirst = track === "pages"
      ? quickNavigatorDisplayPage <= 1
      : track === "chapters"
        ? quickNavigatorChapter?.id === 1
        : quickNavigatorJuz?.number === 1
    const atLast = track === "pages"
      ? quickNavigatorDisplayPage >= MAX_PAGE
      : track === "chapters"
        ? quickNavigatorChapter?.id === 114
        : quickNavigatorJuz?.number === 30
    return (
      <div className="grid grid-cols-[44px_24px_minmax(0,1fr)_24px] items-center gap-1">
        <span className="text-[10px] font-semibold text-muted-foreground sm:text-xs">{label}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6 rounded-sm text-primary/75 hover:bg-primary/10 hover:text-primary"
          disabled={quickNavigatorDragging || atFirst}
          aria-label={`${label} السابق`}
          title={`${label} السابق`}
          onPointerDown={() => startQuickNavigatorArrowHold(track, -1)}
          onPointerUp={stopQuickNavigatorArrowHold}
          onPointerCancel={stopQuickNavigatorArrowHold}
          onPointerLeave={stopQuickNavigatorArrowHold}
          onClick={() => clickQuickNavigatorArrow(track, -1)}
        >
          <ChevronRight className="size-4" />
        </Button>
        {children}
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6 rounded-sm text-primary/75 hover:bg-primary/10 hover:text-primary"
          disabled={quickNavigatorDragging || atLast}
          aria-label={`${label} التالي`}
          title={`${label} التالي`}
          onPointerDown={() => startQuickNavigatorArrowHold(track, 1)}
          onPointerUp={stopQuickNavigatorArrowHold}
          onPointerCancel={stopQuickNavigatorArrowHold}
          onPointerLeave={stopQuickNavigatorArrowHold}
          onClick={() => clickQuickNavigatorArrow(track, 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
      </div>
    )
  }

  const renderQuickNavigatorTools = (
    dashboard = false,
    section: "all" | "search" | "tracks" = "all",
  ) => (
    <div className={cn("mx-auto flex w-full max-w-[1100px] flex-col", dashboard && section !== "tracks" && "max-w-[900px]")} dir="rtl">
      <div className={cn("order-1 flex items-center gap-2", section === "tracks" && "hidden")}>
        <Search className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <Input
          autoFocus={!dashboard}
          value={quickNavigatorQuery}
          onChange={(event) => setQuickNavigatorQuery(event.target.value)}
          placeholder="آية، سورة، الجزء 5، الحزب 12، أو 2:255"
          aria-label="البحث السريع في القرآن"
          className={cn("min-w-0 flex-1 border-0 bg-transparent px-0 text-right shadow-none focus-visible:ring-0", dashboard ? "h-9 text-sm" : "h-10 text-base")}
        />
        {!dashboard && (
          <Button variant="ghost" size="icon-sm" aria-label="إغلاق البحث السريع" onClick={() => setQuickNavigatorOpen(false)}>
            <X />
          </Button>
        )}
      </div>

      {section === "search" && !quickNavigatorQuery.trim() && (
        <Tabs
          value={quickNavigatorBrowseTab}
          onValueChange={(value) => setQuickNavigatorBrowseTab(value as QuickNavigatorBrowseTab)}
          className="order-2 mt-1 min-h-0 gap-0"
          dir="rtl"
        >
          <TabsList
            className="grid h-10 w-full grid-cols-5 rounded-none border-b bg-transparent p-0"
            data-quick-navigator-tabs
          >
            {([
              ["nearby", "الأقرب"],
              ["surahs", "السور"],
              ["juzs", "الأجزاء"],
              ["hizbs", "الأحزاب"],
              ["pages", "الصفحات"],
            ] as const).map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-10 min-w-0 rounded-none border-x-0 border-t-0 border-b-2 border-transparent bg-transparent px-0.5 text-[11px] font-semibold shadow-none focus-visible:ring-0 data-[state=active]:border-x-0 data-[state=active]:border-t-0 data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:text-sm"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="max-h-[min(52dvh,430px)] overflow-y-auto overscroll-contain" data-quick-navigator-options>
            {renderQuickNavigatorBrowse()}
          </div>
        </Tabs>
      )}

      <div className={cn("order-3 overflow-hidden bg-background/35", section === "search" && "hidden", dashboard ? "mt-0" : "mt-3 border-y py-2")}>
        <div className={cn("space-y-1.5", dashboard ? "py-1" : "py-1.5")}>
          {renderQuickNavigatorTrackArrows("juzs", "الجزء", (
            <div
              className="relative h-12 cursor-grab touch-none select-none overflow-hidden border-y border-border/45 active:cursor-grabbing"
              onPointerDown={handleQuickNavigatorTrackPointerDown}
              onPointerMove={handleQuickNavigatorTrackPointerMove}
              onPointerUp={handleQuickNavigatorTrackPointerUp}
              onPointerCancel={cancelQuickNavigatorPointer}
              aria-label={`مسطرة الأجزاء، الجزء ${quickNavigatorJuz?.number ?? "غير محدد"}`}
              data-navigator-track="juzs"
            >
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              {quickNavigatorVisibleJuzs.map((juz) => (
                <button
                  key={`quick-juz-${juz.number}`}
                  type="button"
                  className={cn(
                    "absolute inset-y-1 -translate-x-1/2 overflow-hidden border-x border-primary/45 bg-secondary/55 text-primary",
                    !quickNavigatorDragging && "transition-[left,background-color,border-color] duration-200 ease-out motion-reduce:transition-none",
                    quickNavigatorDisplayPage >= juz.startPage && quickNavigatorDisplayPage <= juz.endPage && "z-[2] border-primary bg-primary/20 text-foreground",
                  )}
                  style={quickNavigatorTrackRangeStyle(juz.startPage, juz.endPage)}
                  data-page={juz.startPage}
                  onClick={handleQuickNavigatorPageClick}
                  aria-label={`الجزء ${juz.number}، الصفحات ${juz.startPage} إلى ${juz.endPage}`}
                >
                  <span className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-[11px] font-semibold">الجزء {juz.number}</span>
                </button>
              ))}
              <span className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-primary" aria-hidden="true" />
              <span className="pointer-events-none absolute inset-y-0 right-0 z-20 w-4 bg-background/85" aria-hidden="true" />
              <span className="pointer-events-none absolute inset-y-0 left-0 z-20 w-4 bg-background/85" aria-hidden="true" />
            </div>
          ))}

          {renderQuickNavigatorTrackArrows("chapters", "السورة", (
            <div
              className={cn(
                "relative cursor-grab touch-none select-none overflow-hidden border-y border-border/45 active:cursor-grabbing",
                nearbyChapterStarts >= 9 ? "h-[84px]" : "h-12",
              )}
              onPointerDown={handleQuickNavigatorTrackPointerDown}
              onPointerMove={handleQuickNavigatorTrackPointerMove}
              onPointerUp={handleQuickNavigatorTrackPointerUp}
              onPointerCancel={cancelQuickNavigatorPointer}
              aria-label={`مسطرة السور، سورة ${quickNavigatorChapter?.name ?? "غير محددة"}`}
              data-navigator-track="chapters"
            >
              <div className="absolute inset-x-0 bottom-1.5 h-px bg-border" />
              {quickNavigatorChapterLanes.map(({ chapter, lane }) => {
                const denseTrack = nearbyChapterStarts >= 9 && chapter.startPage >= quickNavigatorWindowStart
                return (
                  <button
                    key={`quick-chapter-${chapter.id}`}
                    type="button"
                    className={cn(
                      "absolute -translate-x-1/2 overflow-hidden border border-primary/35 bg-primary/10 text-primary",
                      denseTrack ? "h-6 min-w-[72px] max-w-[96px] rounded-sm px-1" : "inset-y-1",
                      !quickNavigatorDragging && "transition-[left,background-color,border-color] duration-200 ease-out motion-reduce:transition-none",
                      quickNavigatorDisplayPage >= chapter.startPage && quickNavigatorDisplayPage <= chapter.endPage && "z-[2] border-primary bg-primary/22 text-foreground",
                    )}
                    style={denseTrack
                      ? { left: quickNavigatorTrackPosition(chapter.startPage), top: `${4 + lane * 25}px` }
                      : quickNavigatorTrackRangeStyle(chapter.startPage, chapter.endPage)}
                    data-page={chapter.startPage}
                    onClick={handleQuickNavigatorPageClick}
                    aria-label={`سورة ${chapter.name}، الصفحات ${chapter.startPage} إلى ${chapter.endPage}`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center truncate whitespace-nowrap px-1 font-quran text-xs font-semibold">{chapter.name}</span>
                    {denseTrack && (
                      <span className="pointer-events-none absolute top-full left-1/2 h-2 w-px -translate-x-1/2 bg-primary/55" aria-hidden="true" />
                    )}
                  </button>
                )
              })}
              <span className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-primary" aria-hidden="true" />
              <span className="pointer-events-none absolute inset-y-0 right-0 z-20 w-4 bg-background/85" aria-hidden="true" />
              <span className="pointer-events-none absolute inset-y-0 left-0 z-20 w-4 bg-background/85" aria-hidden="true" />
            </div>
          ))}

          {renderQuickNavigatorTrackArrows("pages", "الصفحة", (
            <div
              className="relative h-12 cursor-grab touch-none select-none overflow-hidden border-y border-border/45 active:cursor-grabbing"
              onPointerDown={handleQuickNavigatorTrackPointerDown}
              onPointerMove={handleQuickNavigatorTrackPointerMove}
              onPointerUp={handleQuickNavigatorTrackPointerUp}
              onPointerCancel={cancelQuickNavigatorPointer}
              aria-label={`مسطرة الصفحات، الصفحة ${quickNavigatorDisplayPage}`}
              data-navigator-track="pages"
            >
              <div className="absolute inset-x-0 top-[19px] h-px bg-border" />
              {quickNavigatorWindowPages.map((page) => {
                const isCurrent = page === quickNavigatorDisplayPage
                return (
                  <button
                    key={`quick-page-${page}`}
                    type="button"
                    className={cn(
                      "absolute top-0 flex h-full -translate-x-1/2 flex-col items-center pt-3.5 text-muted-foreground transition-colors duration-150",
                      !quickNavigatorDragging && "transition-[left,color] duration-200 ease-out motion-reduce:transition-none",
                      isCurrent && "z-[2] text-primary",
                    )}
                    style={{ left: quickNavigatorTrackPosition(page), width: `${quickNavigatorPageScale}%` }}
                    data-page={page}
                    onClick={handleQuickNavigatorPageClick}
                    aria-label={`الصفحة ${page}`}
                  >
                    <span
                      className={cn(
                        "w-px shrink-0 bg-muted-foreground/50",
                        page % 5 === 0 ? "h-3.5 bg-foreground/65" : "h-2",
                        isCurrent && "h-5 w-0.5 bg-primary",
                      )}
                      aria-hidden="true"
                    />
                    {(isCurrent || page % 5 === 0 || page === quickNavigatorWindowStart || page === quickNavigatorWindowEnd) && (
                      <span className={cn("mt-0.5 text-[8px] tabular-nums", isCurrent && "font-bold text-primary")}>{page}</span>
                    )}
                  </button>
                )
              })}
              <span className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-primary" aria-hidden="true" />
              <span className="pointer-events-none absolute inset-y-0 right-0 z-20 w-4 bg-background/85" aria-hidden="true" />
              <span className="pointer-events-none absolute inset-y-0 left-0 z-20 w-4 bg-background/85" aria-hidden="true" />
            </div>
          ))}
        </div>
        <div className="flex min-w-0 items-center justify-center gap-2 border-t border-border/45 px-1 pt-1.5 text-[10px] font-semibold text-muted-foreground sm:text-xs">
          <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
            <span>الجزء {quickNavigatorJuz?.number ?? "—"}</span>
            <span>·</span>
            <span className="font-quran text-sm text-primary sm:text-base">سورة {quickNavigatorChapter?.name ?? "—"}</span>
            <span>·</span>
            <span>الحزب {quickNavigatorHizb?.number ?? "—"}</span>
            <span>·</span>
            <span className="tabular-nums">ص {quickNavigatorDisplayPage}</span>
          </div>
          <Button
            size="sm"
            className="h-8 shrink-0 px-3 sm:px-4"
            disabled={quickNavigatorDragging || quickNavigatorDisplayPage === currentPage}
            onClick={handleQuickNavigatorCommit}
          >
            انتقل
          </Button>
        </div>
      </div>

      {section !== "tracks" && quickNavigatorQuery.trim() && (
        <div className={cn("order-2 mt-2 overflow-y-auto border-y", dashboard ? "max-h-[42dvh]" : "max-h-64")}>
          <div className="sticky top-0 z-10 border-b bg-background/95 px-2 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
            {quickNavigatorResultCount > 0 ? `${quickNavigatorResultCount} نتيجة` : "لا توجد نتائج"}
          </div>
          {quickNavigatorResults.length > 0 ? quickNavigatorResults.slice(0, dashboard ? 12 : 10).map((result) => (
            <button
              key={result.id ?? `${result.kind ?? "verse"}-${result.verseKey}`}
              type="button"
              className={cn("block w-full border-b text-right last:border-b-0 hover:bg-secondary/60", dashboard ? "px-2 py-2" : "px-3 py-3")}
              data-page={result.page}
              data-search-id={result.id}
              data-verse-key={result.verseKey}
              onClick={handleQuickNavigatorResultClick}
            >
              <span className="mb-1 block text-xs font-semibold text-primary sm:text-sm">
                {result.title ?? `سورة ${result.surahName} · الآية ${result.ayah}`} · صفحة {result.page}
              </span>
              <span
                className={cn("block text-foreground", dashboard ? "line-clamp-3 text-lg leading-8" : "text-xl leading-9", result.kind === "verse" || !result.kind ? "font-quran" : "text-sm")}
                data-quran-content={result.kind === "verse" || !result.kind ? "" : undefined}
              >
                {searchTextSegments(result.text, quickNavigatorQuery).map((segment, index) => (
                  <span
                    key={`${result.verseKey}-${index}`}
                    className={segment.highlighted ? "rounded-sm bg-[var(--quran-highlight)]/18 px-0.5 text-foreground" : undefined}
                  >
                    {segment.text}
                  </span>
                ))}
              </span>
            </button>
          )) : <p className="px-3 py-4 text-sm text-muted-foreground">لا توجد نتائج مطابقة</p>}
        </div>
      )}
    </div>
  )

  return (
    <TooltipProvider>
      <div
        className={cn(
          "min-h-screen bg-background text-foreground",
          dashboardOpen
            ? "pb-0"
            : practiceActive
              ? "pb-4"
              : readerFocusActive
                ? "h-dvh overflow-hidden pb-0"
                : "pb-0 sm:pb-[calc(var(--wird-player-height,96px)+0.5rem)]",
        )}
      >
        <header
          ref={headerShellRef}
          className={cn(
            "top-0 z-30 border-b bg-card/95 backdrop-blur transition-[transform,opacity] duration-200",
            quietMode ? "fixed inset-x-0" : "sticky",
            readerFocusActive && "pointer-events-none -translate-y-full opacity-0",
          )}
        >
          {!dashboardOpen && <h1 className="sr-only">المصحف الشريف</h1>}
          <div className={cn(
            "relative mx-auto flex h-[48px] max-w-[1600px] items-center justify-between px-[10px] sm:h-16 sm:px-6 lg:px-8",
            largeControls && "h-auto min-h-14 flex-wrap gap-2 py-2 sm:h-auto",
            compactPlaybackChrome && "h-10 min-h-0 gap-1 px-2 py-0 sm:h-10 sm:px-3 sm:py-0 lg:px-4",
            compactPlaybackChrome && largeControls && "h-auto min-h-12 py-1 sm:h-auto sm:py-1",
            landscapeReadingMode && "flex-nowrap overflow-hidden",
            landscapeReadingMode && !largeControls && "h-10 min-h-10 py-0 sm:h-10 sm:min-h-10 sm:py-0",
            landscapeReadingMode && largeControls && "h-12 min-h-12 py-0 sm:h-12 sm:min-h-12 sm:py-0",
          )}>
            <div
              data-wird-update-host
              className="pointer-events-none absolute top-1/2 left-1/2 z-40 -translate-x-1/2 -translate-y-1/2"
            />
            <div className="relative z-20 flex min-w-0 items-center gap-[6px] sm:gap-1.5">
              <button
                type="button"
                className="flex min-w-0 items-center gap-[6px] rounded-md text-right sm:gap-3"
                aria-label={dashboardOpen ? "العودة إلى المصحف" : "فتح لوحة وِرد"}
                onClick={() => {
                  if (dashboardOpen) setDashboardOpen(false)
                  else openDashboardView()
                }}
              >
                <span className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground sm:size-10",
                  compactPlaybackChrome && "sm:size-8",
                )}>
                  <BookOpen className={cn("size-[18px] sm:size-5", compactPlaybackChrome && "sm:size-4")} />
                </span>
                {dashboardOpen && <span className="truncate text-xs font-semibold sm:text-sm">وِرد</span>}
              </button>
              {!dashboardOpen && landscapePageIdentity && (
                <button
                  type="button"
                  className="flex min-w-0 max-w-[56vw] items-center gap-1.5 overflow-hidden whitespace-nowrap border-r pr-2 font-semibold text-muted-foreground transition-colors hover:text-primary sm:max-w-[48vw] lg:max-w-[42vw]"
                  aria-label={`فتح البحث والتنقل، سورة ${landscapePageIdentity.chapterName}، صفحة ${currentPage}`}
                  onClick={() => {
                    setDashboardOpen(false)
                    setQuietMode(false)
                    setSessionSettingsOpen(false)
                    openQuickNavigator()
                  }}
                >
                  <span className="min-w-0 truncate font-quran text-sm text-foreground sm:text-base">{landscapePageIdentity.chapterName}</span>
                  <span className="shrink-0 text-[10px] tabular-nums sm:text-xs">ص {currentPage}</span>
                  <Search className="size-3 shrink-0 text-primary/65 sm:size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
            <div className={cn(
              "relative z-20 flex items-center gap-[2px] sm:gap-0.5 lg:hidden",
              landscapeReadingMode && "lg:flex",
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={mobileWorkspaceOpen ? "secondary" : "ghost"}
                    size="icon-sm"
                    className="size-9 sm:size-8"
                    aria-label="أدوات القراءة"
                    aria-expanded={mobileWorkspaceOpen}
                    onClick={() => {
                      if (mobileWorkspaceOpen) closeMobileWorkspace()
                      else selectMobileWorkspaceTab("browse")
                    }}
                  >
                    <BookOpen />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>أدوات القراءة</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={appSettingsOpen ? "secondary" : "ghost"}
                    size="icon-sm"
                    className="order-last size-9 sm:size-8"
                    aria-label="إعدادات التطبيق"
                    aria-expanded={appSettingsOpen}
                    onClick={() => {
                      setDashboardOpen(false)
                      setQuietMode(false)
                      closeMobileWorkspace()
                      setAppSettingsInitialTab("reading")
                      setFocusBackupSettings(false)
                      setAppSettingsOpen(true)
                    }}
                  >
                    <Settings />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>إعدادات التطبيق</TooltipContent>
              </Tooltip>
              {compactPlaybackChrome && !dashboardOpen && !practiceActive && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-9 sm:size-8"
                      aria-label="عرض المصحف بملء الشاشة"
                      onClick={() => void toggleFullscreen()}
                    >
                      <Maximize2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>ملء الشاشة</TooltipContent>
                </Tooltip>
              )}
              {!dashboardOpen && !practiceActive && (
                <>
                  <span
                    className={cn("mx-[2px] h-[20px] border-r sm:hidden", compactPlaybackChrome && "sm:block")}
                    aria-hidden="true"
                  />
                  <div className={cn("flex items-center gap-[2px] sm:hidden", compactPlaybackChrome && "sm:flex")}>
                    <DropdownMenu dir="rtl">
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="size-9 sm:size-8" aria-label="المزيد من أدوات الصفحة">
                          <Ellipsis />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={() => void toggleFullscreen()}>
                          <Maximize2 />
                          ملء الشاشة
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem
                          checked={wideReading}
                          onCheckedChange={(checked) => {
                            setWideReading(checked)
                            if (checked) {
                              setViewMode("text")
                              setReadingMode("page")
                              setSpreadMode("single")
                            }
                          }}
                        >
                          <RectangleHorizontal />
                          القراءة بعرض الشاشة
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuItem onSelect={startPageReveal}>
                          <Mic />
                          بدء تسميع مفتوح من الصفحة
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled={pdfSaving || isLoading} onSelect={() => void savePageAsPdf()}>
                          {pdfSaving ? <LoaderCircle className="animate-spin" /> : <FileDown />}
                          حفظ الصفحة PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={offlineSaving} onSelect={() => void savePageOffline()}>
                          {offlineSaving ? <LoaderCircle className="animate-spin" /> : <Download />}
                          حفظ دون اتصال
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={saveCurrentBookmark}>
                          <Bookmark className={cn(currentBookmark && "fill-current")} />
                          حفظ علامة
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </>
              )}
            </div>
            <div className={cn(
              "relative z-20 hidden items-center gap-2 text-sm text-muted-foreground lg:flex",
              largeControls && "flex-wrap justify-end",
              landscapeReadingMode && "lg:hidden",
            )}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={navigationOpen ? "secondary" : "ghost"}
                    size="sm"
                    aria-label="تصفح المصحف"
                    aria-expanded={navigationOpen}
                    onClick={() => {
                      setDashboardOpen(false)
                      setQuietMode(false)
                      setSessionSettingsOpen(false)
                      if (!navigationOpen) setBrowseActivity("read")
                      setNavigationOpen((open) => !open)
                    }}
                  >
                    <BookOpen />
                    <span className="hidden sm:inline">تصفح</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>تصفح المصحف</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={khatmaOpen ? "secondary" : "ghost"}
                    size="sm"
                    aria-label="مسار الختمة"
                    aria-expanded={khatmaOpen}
                    onClick={() => {
                      setDashboardOpen(false)
                      setQuietMode(false)
                      setReaderChromeVisible(true)
                      setSessionSettingsOpen(false)
                      setNavigationOpen(false)
                      setAppSettingsOpen(false)
                      setKhatmaOpen(true)
                    }}
                  >
                    <CalendarCheck2 />
                    <span className="hidden md:inline">الختمة</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>مسار الختمة</TooltipContent>
              </Tooltip>
              {!dashboardOpen && !practiceActive && (
                <>
                  <span className="h-6 border-r" aria-hidden="true" />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="عرض المصحف بملء الشاشة"
                        onClick={() => void toggleFullscreen()}
                      >
                        <Maximize2 />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>ملء الشاشة</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={spreadMode === "double" ? "secondary" : "ghost"}
                        size="icon-sm"
                        aria-label={spreadMode === "double" ? "عرض صفحة واحدة" : "عرض صفحتين متجاورتين"}
                        aria-pressed={spreadMode === "double"}
                        disabled={readingMode === "large" || audioReviewActive || isFullscreen}
                        onClick={() => setSpreadMode((mode) => mode === "single" ? "double" : "single")}
                      >
                        <Columns2 />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{spreadMode === "double" ? "صفحة واحدة" : "صفحتان متجاورتان"}</TooltipContent>
                  </Tooltip>
                  <DropdownMenu dir="rtl">
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="المزيد من أدوات الصفحة">
                        <Ellipsis />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuCheckboxItem
                        checked={wideReading}
                        onCheckedChange={(checked) => {
                          setWideReading(checked)
                          if (checked) {
                            setViewMode("text")
                            setReadingMode("page")
                            setSpreadMode("single")
                          }
                        }}
                      >
                        <RectangleHorizontal />
                        القراءة بعرض الشاشة
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuItem onSelect={startPageReveal}>
                        <Mic />
                        بدء تسميع مفتوح من الصفحة
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={pdfSaving || isLoading} onSelect={() => void savePageAsPdf()}>
                        {pdfSaving ? <LoaderCircle className="animate-spin" /> : <FileDown />}
                        حفظ الصفحة PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={offlineSaving} onSelect={() => void savePageOffline()}>
                        {offlineSaving ? <LoaderCircle className="animate-spin" /> : <Download />}
                        حفظ دون اتصال
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={saveCurrentBookmark}>
                        <Bookmark className={cn(currentBookmark && "fill-current")} />
                        حفظ علامة
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Popover open={bookmarksOpen} onOpenChange={setBookmarksOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="عرض العلامات">
                        <BookMarked />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-[min(340px,calc(100vw-2rem))] p-2">
                      <div className="border-b px-2 py-2 text-sm font-semibold">العلامات</div>
                      <div className="max-h-72 overflow-y-auto py-1">
                        {bookmarks.length === 0 ? (
                          <p className="px-2 py-6 text-center text-sm text-muted-foreground">لا توجد علامات محفوظة</p>
                        ) : (
                          <>
                            {renderBookmarkFilters()}
                            {renderBookmarkRows()}
                          </>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={appSettingsOpen ? "secondary" : "ghost"}
                    size="icon-sm"
                    aria-label="إعدادات التطبيق"
                    aria-expanded={appSettingsOpen}
                    onClick={() => {
                      setDashboardOpen(false)
                      setQuietMode(false)
                      setSessionSettingsOpen(false)
                      setNavigationOpen(false)
                      setAppSettingsInitialTab("reading")
                      setFocusBackupSettings(false)
                      setAppSettingsOpen(true)
                    }}
                  >
                    <Settings />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>إعدادات التطبيق</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {khatmaReminderPrompt && !dashboardOpen && !practiceActive && (
            <div className="pointer-events-none absolute top-full left-1/2 z-40 mt-1 w-max max-w-[calc(100vw-1rem)] -translate-x-1/2" dir="rtl">
              <div className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-md border border-primary/15 bg-card/95 px-2 text-foreground shadow-sm backdrop-blur">
                <CalendarCheck2 className="size-3.5 shrink-0 text-primary" />
                <span className="truncate text-[11px] font-medium sm:text-xs">موعد وِرد الختمة</span>
                <Button
                  size="xs"
                  className="h-6 px-1.5 text-[11px]"
                  onClick={() => {
                    setKhatmaReminderPrompt(false)
                    setKhatmaOpen(true)
                  }}
                >
                  عرض المقرر
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-6 shrink-0 text-muted-foreground"
                  aria-label="إخفاء تذكير الختمة"
                  onClick={() => setKhatmaReminderPrompt(false)}
                >
                  <X />
                </Button>
              </div>
            </div>
          )}
        </header>

        {dashboardOpen && (
        <WirdDashboard
          open
          bookmarks={bookmarks}
          reviews={getDueReviews(verseHighlights)}
          navigationPanel={(
            <QuranNavigation
              currentPage={currentPage}
              currentChapterId={currentVerse?.chapterId}
              currentVerseKey={currentVerse?.verseKey}
              currentJuzNumber={currentVerse?.juzNumber}
              currentHizbNumber={currentVerse?.hizbNumber}
              activity={browseActivity}
              onActivityChange={changeBrowseActivity}
              activityControls={activityControls}
              onNavigate={moveToPage}
              onPrefetch={preloadNavigationPage}
              onSetRange={(range) => {
                setSessionNavigationRange(range)
                setSessionSettingsOpen(true)
              }}
              onClose={() => setDashboardOpen(false)}
              dashboard
            />
          )}
          onOpenKhatma={() => {
            setDashboardOpen(false)
            setKhatmaOpen(true)
          }}
          onOpenLearningPlan={() => setLearningPlanOpen(true)}
          onOpenBackupSettings={() => {
            setDashboardOpen(false)
            setAppSettingsInitialTab("install")
            setFocusBackupSettings(true)
            setAppSettingsOpen(true)
          }}
          onStartLearningPlanRange={openLearningPlanRange}
          onOpenMutashabihatVerse={(verse) => finishQuickNavigation(verse.page, verse.verseKey)}
          onOpenBookmark={openDashboardBookmark}
          onDeleteBookmark={(bookmark) => removeBookmark(bookmark.id)}
          onMoveBookmark={(bookmark, direction) => moveBookmark(bookmark.id, direction)}
          onOpenReview={(highlight) => void openDashboardReview(highlight)}
          onListenReview={(highlight) => void listenDashboardReview(highlight)}
          onReciteReview={(highlight) => void reciteDashboardReview(highlight)}
          onReviewDetailsLoaded={hydrateDashboardReviewDetails}
          onReviewOutcome={updateDashboardReview}
        />
        )}

        {learningPlanOpen && (
          <LearningPlanDialog
            open
            onOpenChange={setLearningPlanOpen}
            currentPage={currentPage}
            onOpenRange={openLearningPlanRange}
          />
        )}

        {(khatmaOpen || khatmaMounted) && (
          <KhatmaPlanner
            open={khatmaOpen}
            onOpenChange={setKhatmaOpen}
            currentPage={currentPage}
            onOpenRange={openKhatmaReadingRange}
          />
        )}

        <Dialog
          open={Boolean(renameSavedSessionTarget)}
          onOpenChange={(open) => {
            if (!open) {
              setRenameSavedSessionTarget(null)
              setRenameSavedSessionName("")
            }
          }}
        >
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle>إعادة تسمية الجلسة</DialogTitle>
              <DialogDescription>غيّر الاسم فقط مع الإبقاء على النطاق والقارئ وإعدادات التكرار.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                renameSavedSession()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="rename-saved-session">اسم الجلسة</Label>
                <Input
                  id="rename-saved-session"
                  value={renameSavedSessionName}
                  onChange={(event) => setRenameSavedSessionName(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setRenameSavedSessionTarget(null)
                    setRenameSavedSessionName("")
                  }}
                >
                  إلغاء
                </Button>
                <Button type="submit">حفظ الاسم</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={Boolean(deleteSavedSessionTarget)}
          onOpenChange={(open) => {
            if (!open) setDeleteSavedSessionTarget(null)
          }}
        >
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader className="text-right">
              <AlertDialogTitle>حذف الجلسة المحفوظة؟</AlertDialogTitle>
              <AlertDialogDescription>
                سيتم حذف «{deleteSavedSessionTarget?.name}» من الجلسات المحفوظة. لن تُحذف سجلات الاستماع السابقة.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={removeSavedSession}>
                حذف الجلسة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog
          open={Boolean(verseAction)}
          onOpenChange={(open) => {
            if (!open) {
              setVerseActionKey(null)
              setVerseActionPosition(null)
            }
          }}
        >
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle>الآية {verseAction?.verseKey}</DialogTitle>
              <DialogDescription className="line-clamp-2 font-quran text-base leading-8 text-foreground" data-quran-content>
                {verseAction?.text}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Button className="justify-start" onClick={startActionVerseRecitation}>
                <Mic />
                بدء التسميع من هذه الآية
              </Button>
              <Button variant="outline" className="justify-start" onClick={startActionVersePlayback}>
                <Play />
                {hasVerseSynchronization
                  ? "بدء التلاوة من هذه الآية"
                  : `بدء تلاوة الحدر من أول ${recitationSyncScope === "chapter" ? "السورة" : "الصفحة"}`}
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => void copyActionVerse()}>
                <Copy />
                نسخ نص الآية
              </Button>
              <Button variant="outline" className="justify-start" onClick={openTafsir}>
                <BookOpen />
                التفسير
              </Button>
              <Button variant="outline" className="justify-start" onClick={() => void openMutashabihat()}>
                <GitCompareArrows />
                المتشابهات
              </Button>
              <Button variant="outline" className="justify-start" onClick={beginVerseHighlight}>
                <Highlighter />
                {actionHighlight ? "تعديل الجزء المظلل" : "تظليل جزء من الآية"}
              </Button>
              {actionHighlight && (
                <Button variant="ghost" className="justify-start text-destructive hover:text-destructive" onClick={removeActionHighlight}>
                  <Eraser />
                  إزالة التظليل
                </Button>
              )}
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Bookmark className={cn("size-4", actionBookmark && "fill-current text-primary")} />
                  حفظ إشارة مرجعية
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {bookmarkCategories.map((category) => (
                    <Button
                      key={category.id}
                      variant={actionBookmark?.category === category.id ? "secondary" : "outline"}
                      size="sm"
                      onClick={(event) => verseAction && saveBookmarkForVerse(verseAction, category.id, event.timeStamp)}
                    >
                      {category.label}
                    </Button>
                  ))}
                  <Button
                    variant={actionBookmark && !actionBookmark.category ? "secondary" : "outline"}
                    size="sm"
                    onClick={(event) => verseAction && saveBookmarkForVerse(verseAction, null, event.timeStamp)}
                  >
                    بدون تصنيف
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Drawer
          open={tafsirOpen}
          onOpenChange={(open) => {
            setTafsirOpen(open)
            if (!open) {
              tafsirRequestRef.current += 1
              releaseStaleModalPointerLock()
            }
          }}
          direction="bottom"
        >
          <DrawerContent className="z-[95] mx-auto max-h-[88dvh] w-full sm:max-w-3xl" dir="rtl">
            <DrawerHeader className="border-b px-4 pt-2 pb-3 text-right sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <DrawerTitle className="flex items-center gap-2 text-right">
                  <BookOpen className="size-4 text-primary" />
                  التفسير
                </DrawerTitle>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="إغلاق التفسير"
                  onClick={() => {
                    setTafsirOpen(false)
                    releaseStaleModalPointerLock()
                  }}
                >
                  <X />
                </Button>
              </div>
              <DrawerDescription className="text-right">
                {tafsirTarget ? `سورة ${tafsirTarget.chapterName} · الآية ${tafsirTarget.ayah}` : "تفسير الآية"}
              </DrawerDescription>
              <Select value="saadi" disabled>
                <SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="saadi">تفسير السعدي</SelectItem></SelectContent>
              </Select>
            </DrawerHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              {tafsirTarget?.text && (
                <div className="mb-4 border-y bg-secondary/20 py-3">
                  <p className="font-quran text-lg leading-9 text-foreground" data-quran-content>{tafsirTarget.text}</p>
                </div>
              )}

              {tafsirLoading ? (
                <div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" /></div>
              ) : tafsirError ? (
                <div className="space-y-3 py-10 text-center">
                  <p className="text-sm text-destructive">{tafsirError}</p>
                  {tafsirTarget && (
                    <Button variant="outline" size="sm" onClick={() => void loadTafsir(tafsirTarget)}><RotateCw /> إعادة المحاولة</Button>
                  )}
                </div>
              ) : tafsirData?.entry ? (
                <div className="space-y-4">
                  <p className="whitespace-pre-line text-base leading-8 text-foreground">{tafsirData.entry.text}</p>
                  <div className="border-t pt-3 text-xs leading-5 text-muted-foreground">
                    <span>{tafsirData.resource.name} · {tafsirData.resource.author}</span>
                    {tafsirData.offline && <span className="mr-2">· محفوظ على الجهاز</span>}
                  </div>
                </div>
              ) : null}

              {offlineTafsirStatus.completed < offlineTafsirStatus.total && networkOnline && (
                <div className="mt-4 space-y-1 border-t pt-2">
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-7 px-2 text-[11px] text-muted-foreground"
                      disabled={offlineTafsirStatus.running}
                      onClick={() => void downloadTafsirForOffline()}
                    >
                      {offlineTafsirStatus.running ? <LoaderCircle className="size-3 animate-spin" /> : <Download className="size-3" />}
                      {offlineTafsirStatus.running
                        ? `جاري تنزيل تفسير السعدي ${Math.round((offlineTafsirStatus.completed / Math.max(offlineTafsirStatus.total, 1)) * 100)}%`
                        : "تنزيل تفسير السعدي كاملًا للعمل دون إنترنت"}
                    </Button>
                  </div>
                  {offlineTafsirStatus.running && (
                    <Progress value={Math.round((offlineTafsirStatus.completed / Math.max(offlineTafsirStatus.total, 1)) * 100)} className="h-1" />
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
              <Button
                variant="outline"
                disabled={!tafsirTarget || !adjacentVerseKey(tafsirTarget.verseKey, -1) || tafsirLoading}
                onClick={() => void navigateTafsir(-1)}
              >
                <ChevronRight /> السابقة
              </Button>
              <Button
                variant="outline"
                disabled={!tafsirTarget || !adjacentVerseKey(tafsirTarget.verseKey, 1) || tafsirLoading}
                onClick={() => void navigateTafsir(1)}
              >
                التالية <ChevronLeft />
              </Button>
            </div>
          </DrawerContent>
        </Drawer>

        <Dialog open={mutashabihatOpen} onOpenChange={setMutashabihatOpen}>
          <DialogContent showCloseButton={false} className="max-h-[min(82dvh,720px)] max-w-2xl overflow-hidden p-0" dir="rtl">
            <DialogHeader className="border-b px-4 pt-4 pb-3 text-right sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-secondary text-primary">
                    <GitCompareArrows className="size-4" />
                  </span>
                  <div className="min-w-0 space-y-1">
                    <DialogTitle className="text-base leading-6">المتشابهات اللفظية</DialogTitle>
                    <DialogDescription className="flex flex-wrap items-center gap-2 text-right">
                      <span>
                        {mutashabihatData?.source
                          ? `سورة ${mutashabihatData.source.surahName}، الآية ${mutashabihatData.source.ayah}`
                          : "الآيات المنتقاة المتشابهة في اللفظ"}
                      </span>
                      {mutashabihatData?.offline && (
                        <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
                          {mutashabihatData.cached ? "محفوظة على الجهاز" : "تطابق محلي دون اتصال"}
                        </span>
                      )}
                    </DialogDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="إغلاق المتشابهات" onClick={() => setMutashabihatOpen(false)}>
                  <X />
                </Button>
              </div>
            </DialogHeader>
            <div className="max-h-[calc(min(82dvh,720px)-7rem)] overflow-y-auto px-4 py-3 sm:px-5">
              {mutashabihatLoading ? (
                <div className="grid min-h-40 place-items-center">
                  <LoaderCircle className="size-6 animate-spin text-primary" />
                </div>
              ) : mutashabihatError ? (
                <p className="py-10 text-center text-sm text-destructive">{mutashabihatError}</p>
              ) : !mutashabihatData?.similar.length ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <p>{mutashabihatData?.methodology === "local"
                    ? "لا توجد تطابقات لفظية محلية قوية لهذه الآية."
                    : "لا توجد مواضع من الأنواع المحددة لهذه الآية."}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {mutashabihatData.source && (
                    <section className="border-b px-1 pb-3">
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold">
                        <span className="text-primary">الآية الأصلية</span>
                        <span className="text-muted-foreground">صفحة {mutashabihatData.source.page}</span>
                      </div>
                      <MutashabihatFollowingContext
                        key={`dialog-source:${mutashabihatData.source.verseKey}`}
                        verseKey={mutashabihatData.source.verseKey}
                        followingVerses={mutashabihatData.source.followingVerses}
                        hasMoreFollowing={mutashabihatData.source.hasMoreFollowing}
                        className="font-quran text-base leading-8 sm:text-lg sm:leading-9"
                      >
                        {mutashabihatData.source.text}
                      </MutashabihatFollowingContext>
                    </section>
                  )}
                  {mutashabihatData.totalSimilar && mutashabihatData.totalSimilar > mutashabihatData.similar.length && (
                    <p className="pb-1 text-center text-[10px] text-muted-foreground">
                      أعلى {mutashabihatData.similar.length} نتيجة من {mutashabihatData.totalSimilar}
                    </p>
                  )}
                  {mutashabihatData.similar.map((item) => (
                    <article
                      key={`${item.kind ?? "local"}-${item.verseKey}`}
                      className="border-b px-1 py-3 last:border-b-0"
                    >
                      <button
                        type="button"
                        className="mb-1 flex w-full flex-wrap items-center justify-between gap-1 text-right text-xs font-semibold text-primary transition-colors hover:text-primary/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`فتح سورة ${item.surahName} الآية ${item.ayah} في المصحف`}
                        onClick={() => navigateToMutashabih(item)}
                      >
                        <span>
                          {item.kind ? `${MUTASHABIHAT_TEST_TYPE_OPTIONS.find((option) => option.value === item.kind)?.label ?? "متشابهات"} · ` : ""}
                          سورة {item.surahName} · الآية {item.ayah} · صفحة {item.page}
                        </span>
                        <span className="text-muted-foreground">
                          {mutashabihatData.methodology === "local"
                            ? "تطابق محلي"
                            : item.similarity > 0 ? `${item.similarity}% · ` : ""}{item.sharedWords} كلمة مشتركة
                        </span>
                      </button>
                      <MutashabihatFollowingContext
                        key={`dialog:${item.kind ?? "local"}:${item.verseKey}`}
                        verseKey={item.verseKey}
                        followingVerses={item.followingVerses}
                        hasMoreFollowing={item.hasMoreFollowing}
                        className="font-quran text-base leading-8 sm:text-lg sm:leading-9"
                      >
                        {renderMutashabihatText(item.segments)}
                      </MutashabihatFollowingContext>
                    </article>
                  ))}
                </div>
              )}

              {offerOfflineMutashabihat && (
                <div className="mt-3 flex justify-end border-t pt-2">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-7 px-2 text-[11px] text-muted-foreground"
                    disabled={preparingOfflineMutashabihat}
                    onClick={() => void downloadMutashabihatForOffline()}
                  >
                    {preparingOfflineMutashabihat ? <LoaderCircle className="size-3 animate-spin" /> : <Download className="size-3" />}
                    {preparingOfflineMutashabihat ? "جاري تنزيل المتشابهات..." : "تنزيل المتشابهات كاملة للعمل دون إنترنت"}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {readingReturnLocation && !mutashabihatOpen && (
          <Button
            variant="secondary"
            size="sm"
            className="fixed bottom-[calc(var(--wird-player-height,80px)+0.75rem)] left-3 z-[45] border bg-card/95 shadow-md backdrop-blur"
            onClick={returnFromMutashabihat}
          >
            <ChevronRight />
            العودة للموضع السابق
          </Button>
        )}

        <Dialog open={Boolean(sessionSummary)} onOpenChange={(open) => !open && setSessionSummary(null)}>
          <DialogContent className="max-w-md text-right" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle>ملخص الجلسة</DialogTitle>
              <DialogDescription>تم حفظ التقدم وتحديث المراجعات القادمة.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 border-y">
              <div className="border-b border-l p-4">
                <p className="text-xs text-muted-foreground">المدة</p>
                <p className="mt-1 font-bold tabular-nums">{formatTime(sessionSummary?.durationSeconds ?? 0)}</p>
              </div>
              <div className="border-b p-4">
                <p className="text-xs text-muted-foreground">الصفحات</p>
                <p className="mt-1 font-bold tabular-nums">{sessionSummary?.pages ?? 0}</p>
              </div>
              <div className="border-l p-4">
                <p className="text-xs text-muted-foreground">الآيات المتعثرة</p>
                <p className="mt-1 font-bold tabular-nums">{sessionSummary?.troubledVerses ?? 0}</p>
              </div>
              <div className="p-4">
                <p className="text-xs text-muted-foreground">مراجعة الغد</p>
                <p className="mt-1 font-bold tabular-nums">{sessionSummary?.tomorrowReviews ?? 0}</p>
              </div>
            </div>
            <Button onClick={() => setSessionSummary(null)}>تم</Button>
          </DialogContent>
        </Dialog>

        {appSettingsOpen && (
        <AppSettings
          open
          onOpenChange={(nextOpen) => {
            setAppSettingsOpen(nextOpen)
            if (!nextOpen) {
              setAppSettingsInitialTab("reading")
              setFocusBackupSettings(false)
            }
          }}
          initialTab={appSettingsInitialTab}
          focusBackup={focusBackupSettings}
          viewMode={viewMode}
          onViewModeChange={changeViewMode}
          readingMode={readingMode}
          onReadingModeChange={changeReadingMode}
          lineSpacing={lineSpacing}
          onLineSpacingChange={setLineSpacing}
          audioReviewRevealMode={audioReviewRevealMode}
          onAudioReviewRevealModeChange={setAudioReviewRevealMode}
          centerTapFullscreen={centerTapFullscreen}
          onCenterTapFullscreenChange={setCenterTapFullscreen}
          searchGestureEnabled={searchGestureEnabled}
          onSearchGestureEnabledChange={setSearchGestureEnabled}
          searchGestureDirection={searchGestureDirection}
          onSearchGestureDirectionChange={setSearchGestureDirection}
          largeTextSize={largeTextSize}
          onLargeTextSizeChange={setLargeTextSize}
          autoScroll={autoScroll}
          onAutoScrollChange={setAutoScroll}
          screenRotationLocked={screenRotationLocked}
          onScreenRotationLockedChange={setScreenRotationLocked}
          keepScreenAwake={keepScreenAwake}
          onKeepScreenAwakeChange={setKeepScreenAwake}
          wakeLockSupported={typeof navigator !== "undefined" && "wakeLock" in navigator}
          highContrast={highContrast}
          onHighContrastChange={setHighContrast}
          largeControls={largeControls}
          onLargeControlsChange={setLargeControls}
          appTextScale={appTextScale}
          onAppTextScaleChange={setAppTextScale}
          simplifiedPlayer={simplifiedPlayer}
          onSimplifiedPlayerChange={setSimplifiedPlayer}
          speechLabels={speechLabels}
          onSpeechLabelsChange={setSpeechLabels}
          bookmarkCategories={bookmarkCategories}
          bookmarkCategoryCounts={bookmarkCategoryCounts}
          onBookmarkCategoriesChange={changeBookmarkCategories}
          reciter={reciter}
          reciterName={selectedReciter.name}
          downloadReciters={DOWNLOAD_RECITERS}
        />
        )}

        <main
          className={cn(
            "mx-auto grid max-w-[1900px] gap-2 px-0 py-0 sm:px-2 sm:py-2 lg:px-3",
            navigationOpen && !quietMode
              ? "lg:grid-cols-[380px_minmax(0,1fr)]"
              : "lg:grid-cols-1",
            readerFocusActive && "fixed inset-0 z-20 block max-w-none overflow-hidden p-0",
            !practiceActive && !readerFocusActive && !dashboardOpen &&
              "max-sm:min-h-[calc(100dvh-48px)] max-sm:pb-[var(--wird-player-height,96px)]",
            dashboardOpen && "hidden",
          )}
        >
          {mobileWorkspaceOpen && !quietMode && (
            <div className="flex items-center border-b bg-card lg:hidden" dir="rtl">
              <Tabs
                value={mobileWorkspaceTab}
                onValueChange={(value) => selectMobileWorkspaceTab(value as MobileWorkspaceTab)}
                className="min-w-0 flex-1 gap-0"
                dir="rtl"
              >
                <TabsList className="grid h-10 w-full grid-cols-3 rounded-none bg-transparent p-0">
                  {([
                    ["browse", "تصفح"],
                    ["khatma", "الختمة"],
                    ["marks", "العلامات"],
                  ] as const).map(([value, label]) => (
                    <TabsTrigger
                      key={value}
                      value={value}
                      className="h-10 rounded-none border-b-2 border-transparent bg-transparent px-1 text-xs shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <Button
                variant="ghost"
                size="icon-sm"
                className="mx-1 shrink-0"
                aria-label="إغلاق أدوات القراءة"
                onClick={closeMobileWorkspace}
              >
                <X />
              </Button>
            </div>
          )}

          {navigationOpen && !quietMode && (
            <QuranNavigation
              currentPage={currentPage}
              currentChapterId={currentVerse?.chapterId}
              currentVerseKey={currentVerse?.verseKey}
              currentJuzNumber={currentVerse?.juzNumber}
              currentHizbNumber={currentVerse?.hizbNumber}
              activity={browseActivity}
              onActivityChange={changeBrowseActivity}
              activityControls={activityControls}
              onNavigate={moveToPage}
              onPrefetch={preloadNavigationPage}
              onSetRange={(range) => {
                setSessionNavigationRange(range)
                setSessionSettingsOpen(false)
              }}
              onClose={() => setNavigationOpen(false)}
              compactMobileHeader
            />
          )}

          {mobileMarksOpen && !quietMode && (
            <aside className="h-fit border-b bg-card lg:hidden" dir="rtl">
              <div className="max-h-[48dvh] overflow-y-auto px-2 py-1">
                {bookmarks.length === 0 ? (
                  <div className="px-4 py-10 text-center">
                    <BookMarked className="mx-auto mb-3 size-7 text-muted-foreground" />
                    <p className="text-sm font-medium">لا توجد علامات محفوظة</p>
                    <p className="mt-1 text-xs text-muted-foreground">أضف علامة من قائمة أدوات الآية أو الصفحة.</p>
                  </div>
                ) : (
                  <>
                    {renderBookmarkFilters()}
                    {renderBookmarkRows(true)}
                  </>
                )}
              </div>
            </aside>
          )}

          <section className={cn(
            "min-w-0",
            readerFocusActive && "h-dvh w-full",
            !practiceActive && !readerFocusActive && !mobileWorkspaceOpen &&
              "max-sm:flex max-sm:flex-col max-sm:justify-center",
            !practiceActive && !readerFocusActive && !mobileWorkspaceOpen &&
              viewMode === "text" && readingMode === "page" &&
              "max-sm:bg-[var(--mushaf-paper)]",
          )}>
            <div
              className={cn(
                "mb-1 items-center justify-end gap-1 px-1 sm:mb-2 sm:gap-1.5 sm:px-0",
                practiceActive && !readerFocusActive ? "flex" : "hidden",
              )}
            >
              <div className="relative flex w-full min-w-0 items-center justify-end gap-1.5">
                {practiceActive ? (
                  <>
                    {activePracticeMode === "test" && activeTestKind === "mutashabihat" ? (
                      <Popover
                        open={activeMutashabihatTypePickerOpen}
                        onOpenChange={(open) => {
                          setActiveMutashabihatTypePickerOpen(open)
                          if (open) setActiveMutashabihatTypeDraft(activeMutashabihatTypes)
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            data-active-mutashabihat-types-trigger=""
                            variant="secondary"
                            size="sm"
                            className="absolute left-1/2 h-7 max-w-[calc(100%_-_3.5rem)] -translate-x-1/2 gap-1.5 border px-2 text-xs font-semibold"
                            aria-label="تعديل تصنيفات اختبار المتشابهات"
                          >
                            <GitCompareArrows className="size-3.5 shrink-0" />
                            <span className="truncate">اختبار المتشابهات</span>
                            {mutashabihatTestCandidates.length > 0 && (
                              <span
                                data-mutashabihat-question-counter=""
                                className="min-w-9 border-r border-foreground/15 pr-1.5 text-center text-[10px] font-bold tabular-nums text-muted-foreground"
                                aria-label={`السؤال ${mutashabihatQuestionPosition} من ${mutashabihatTestCandidates.length}، متبقي ${mutashabihatQuestionsRemaining}`}
                              >
                                {mutashabihatQuestionPosition}/{mutashabihatTestCandidates.length}
                              </span>
                            )}
                            <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="center"
                          sideOffset={6}
                          className="w-[min(18rem,calc(100vw-1rem))] p-3"
                          dir="rtl"
                        >
                          <p className="mb-2 text-sm font-semibold">طبيعة الاختبار</p>
                          <div className="grid grid-cols-2 gap-px border bg-border">
                            {MUTASHABIHAT_TEST_TYPE_OPTIONS.map((option) => {
                              const checked = activeMutashabihatTypeDraft.includes(option.value)
                              return (
                                <Label
                                  key={`active-${option.value}`}
                                  htmlFor={`active-mutashabihat-${option.value}`}
                                  className="flex min-h-10 cursor-pointer items-center gap-2 bg-popover px-2.5 text-xs font-medium"
                                >
                                  <Checkbox
                                    id={`active-mutashabihat-${option.value}`}
                                    checked={checked}
                                    onCheckedChange={(nextChecked) => setActiveMutashabihatTypeDraft((current) =>
                                      nextChecked
                                        ? MUTASHABIHAT_TEST_TYPE_OPTIONS.map((item) => item.value)
                                            .filter((type) => current.includes(type) || type === option.value)
                                        : current.filter((type) => type !== option.value),
                                    )}
                                  />
                                  {option.label}
                                </Label>
                              )
                            })}
                          </div>
                          <Button
                            size="sm"
                            className="mt-3 w-full"
                            disabled={activeMutashabihatTypeDraft.length === 0 || mutashabihatTestLoading}
                            onClick={() => void applyActiveMutashabihatTypes()}
                          >
                            {mutashabihatTestLoading && <LoaderCircle className="animate-spin" />}
                            تطبيق
                          </Button>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <div className="absolute left-1/2 flex h-7 -translate-x-1/2 items-center gap-1.5 border bg-secondary px-2 text-xs font-semibold">
                        {activePracticeMode === "recite" ? <Mic className="size-3.5" /> : <Shuffle className="size-3.5" />}
                        {activePracticeMode === "recite" ? "تسميع" : "اختبار"}
                      </div>
                    )}
                    <Button variant="ghost" size="icon-xs" aria-label="إنهاء التدريب" onClick={stopPractice}>
                      <X />
                    </Button>
                  </>
                ) : (
                  <>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7"
                      aria-label="عرض المصحف بملء الشاشة"
                      onClick={() => void toggleFullscreen()}
                    >
                      <Maximize2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>ملء الشاشة</TooltipContent>
                </Tooltip>

                <DropdownMenu dir="rtl">
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label="المزيد من أدوات الصفحة">
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      className="hidden xl:flex"
                      disabled={readingMode === "large" || audioReviewActive}
                      onSelect={() => setSpreadMode((mode) => mode === "single" ? "double" : "single")}
                    >
                      <Columns2 />
                      {spreadMode === "double" ? "عرض صفحة واحدة" : "عرض صفحتين"}
                    </DropdownMenuItem>
                    <DropdownMenuCheckboxItem
                      checked={wideReading}
                      onCheckedChange={(checked) => {
                        setWideReading(checked)
                        if (checked) {
                          setViewMode("text")
                          setReadingMode("page")
                          setSpreadMode("single")
                        }
                      }}
                    >
                      <RectangleHorizontal />
                      القراءة بعرض الشاشة
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuItem onSelect={startPageReveal}>
                      <Mic />
                      بدء تسميع مفتوح من الصفحة
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={pdfSaving || isLoading} onSelect={() => void savePageAsPdf()}>
                      {pdfSaving ? <LoaderCircle className="animate-spin" /> : <FileDown />}
                      حفظ الصفحة PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={offlineSaving} onSelect={() => void savePageOffline()}>
                      {offlineSaving ? <LoaderCircle className="animate-spin" /> : <Download />}
                      حفظ دون اتصال
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={saveCurrentBookmark}>
                      <Bookmark className={cn(currentBookmark && "fill-current")} />
                      حفظ علامة
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Popover open={bookmarksOpen} onOpenChange={setBookmarksOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon-xs" className="hidden lg:inline-flex" aria-label="عرض العلامات">
                      <BookMarked />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-[min(340px,calc(100vw-2rem))] p-2">
                    <div className="border-b px-2 py-2 text-sm font-semibold">العلامات</div>
                    <div className="max-h-72 overflow-y-auto py-1">
                      {bookmarks.length === 0 ? (
                        <p className="px-2 py-6 text-center text-sm text-muted-foreground">لا توجد علامات محفوظة</p>
                      ) : (
                        <>
                          {renderBookmarkFilters()}
                          {renderBookmarkRows()}
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                  </>
                )}

              </div>
            </div>

            {practiceActive && activePracticeMode === "test" && (
              <div
                data-practice-bottom-actions=""
                className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2"
              >
                {activeTestKind === "mutashabihat" && mutashabihatTestTarget && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-10 border px-4 text-sm font-semibold shadow-lg"
                    onClick={() => void loadMutashabihat(mutashabihatTestTarget, activeMutashabihatTypes)}
                  >
                    <GitCompareArrows className="size-4" />
                    المواضع
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-10 min-w-32 border border-primary-foreground/15 px-4 text-sm font-semibold shadow-lg"
                  onClick={openNewTestQuestion}
                >
                  <Shuffle className="size-4" />
                  سؤال جديد
                </Button>
              </div>
            )}

            {highlightDraft && (
              <div className="sticky top-2 z-20 mb-2 flex flex-wrap items-center gap-2 border border-amber-600/35 bg-card/95 px-3 py-2 shadow-sm backdrop-blur">
                <Highlighter className="size-4 shrink-0 text-amber-700 dark:text-amber-400" />
                <span className="min-w-32 flex-1">
                  <strong className="block text-xs">
                    {highlightDraftStart === undefined || highlightDraftEnd === undefined
                      ? "لم يُحدد نطاق"
                      : `الكلمات ${highlightDraftStart}–${highlightDraftEnd} · ${highlightDraftEnd - highlightDraftStart + 1} ${highlightDraftEnd === highlightDraftStart ? "كلمة" : "كلمات"}`}
                  </strong>
                  {highlightDraftText && (
                    <small className="font-quran mt-0.5 block max-w-xl truncate text-sm font-normal text-foreground/80" data-quran-content>
                      {highlightDraftText}
                    </small>
                  )}
                </span>
                <ToggleGroup
                  type="single"
                  value={highlightDraft.category ?? "reinforce"}
                  onValueChange={(value) => value && setHighlightDraft((draft) => draft
                    ? { ...draft, category: value as HighlightCategory }
                    : draft)}
                  variant="outline"
                  size="sm"
                  className="grid w-full grid-cols-3 sm:w-auto"
                  aria-label="تصنيف موضع المراجعة"
                >
                  <ToggleGroupItem value="mistake" className="h-7 px-2 text-xs">خطأ</ToggleGroupItem>
                  <ToggleGroupItem value="hesitation" className="h-7 px-2 text-xs">تردد</ToggleGroupItem>
                  <ToggleGroupItem value="reinforce" className="h-7 px-2 text-xs">يحتاج تثبيت</ToggleGroupItem>
                </ToggleGroup>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    const anchorPosition = highlightDraft.anchorPosition ?? highlightDraft.startPosition ?? 1
                    setHighlightDraft({
                      verseKey: highlightDraft.verseKey,
                      startPosition: anchorPosition,
                      endPosition: anchorPosition,
                      anchorPosition,
                      category: highlightDraft.category ?? "reinforce",
                    })
                  }}
                >
                  <RotateCcw />
                  كلمة واحدة
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={highlightDraft.startPosition === undefined}
                  onClick={saveVerseHighlight}
                >
                  <Check />
                  حفظ
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="إلغاء التظليل"
                  onClick={() => setHighlightDraft(null)}
                >
                  <X />
                </Button>
              </div>
            )}

            <div
              ref={mushafStageRef}
              className={cn(
                "relative mx-auto w-full max-w-[1080px] touch-pan-y",
                spreadMode === "double" && "xl:max-w-none",
                viewMode === "text" && readingMode === "page" && "sm:max-w-none",
                readerFocusActive && !isFullscreen && "flex h-dvh max-w-none flex-col overflow-hidden bg-background",
                isFullscreen && "fixed inset-0 z-50 flex h-dvh max-w-none flex-col overflow-hidden bg-background",
                viewMode === "text" && readingMode === "page" && "sm:overflow-x-hidden sm:overflow-y-auto sm:overscroll-contain",
                isFullscreen && adaptivePageSpacing && "overflow-x-hidden overflow-y-auto overscroll-contain",
                adaptivePageSpacing && "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                lineReadingLayout && readerFocusActive && viewMode === "text" && readingMode === "page" && "block overflow-x-hidden overflow-y-auto overscroll-contain",
                fullscreenLineReading && "pb-[var(--wird-player-height,48px)]",
              )}
              data-quran-scroll-container={lineReadingLayout && readerFocusActive ? "" : undefined}
              onClickCapture={(event) => {
                if (Date.now() < suppressPageClickUntilRef.current) {
                  event.preventDefault()
                  event.stopPropagation()
                  return
                }
                if (quickNavigatorOpen && !(event.target as HTMLElement).closest("[data-quick-navigator]")) {
                  event.preventDefault()
                  event.stopPropagation()
                  setQuickNavigatorOpen(false)
                }
              }}
              onWheel={handlePageWheel}
              onTouchStart={handlePageTouchStart}
              onTouchMove={handlePageTouchMove}
              onTouchEnd={handlePageTouchEnd}
              onTouchCancel={handlePageTouchCancel}
            >
              {quickNavigatorOpen && !practiceActive && (
                <div
                  className="absolute inset-x-0 top-0 z-[35] max-h-[calc(100dvh-var(--wird-player-height,96px))] animate-in overflow-hidden border-b bg-card/97 px-3 pb-2 pt-3 shadow-xl slide-in-from-top-2 duration-200 sm:px-5"
                  data-quick-navigator
                  dir="rtl"
                  onTouchStart={(event) => event.stopPropagation()}
                  onTouchMove={(event) => event.stopPropagation()}
                  onTouchEnd={(event) => event.stopPropagation()}
                >
                  {renderQuickNavigatorTools(false, "search")}
                </div>
              )}
              {(readerFocusActive || isFullscreen) && (
                practiceActive && activePracticeMode === "recite" ? (
                  <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-40 flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon-sm"
                          className="border bg-card/90 shadow-sm backdrop-blur"
                          aria-label="إيقاف التسميع وإظهار الآيات"
                          onClick={stopPractice}
                        >
                          <Eye />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>إيقاف التسميع وإظهار الآيات</TooltipContent>
                    </Tooltip>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="border bg-card/90 shadow-sm backdrop-blur"
                      onClick={stopPractice}
                    >
                      <X />
                      خروج
                    </Button>
                  </div>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon-sm"
                        className={cn(
                          "absolute z-40 size-7 border bg-card/85 shadow-sm backdrop-blur",
                          isFullscreen
                            ? "fixed top-[max(0rem,env(safe-area-inset-top))] right-1 rounded-sm border-0 bg-transparent shadow-none backdrop-blur-none"
                            : "top-[max(0.5rem,env(safe-area-inset-top))] right-2",
                        )}
                        aria-label="العودة إلى واجهة المصحف"
                        onClick={() => void toggleFullscreen()}
                      >
                        <Minimize2 />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>العودة إلى الواجهة</TooltipContent>
                  </Tooltip>
                )
              )}

              {isFullscreen && renderLandscapeReaderBar(true)}

              {fullscreenOrientationSuggestion && !screenRotationLocked && !practiceActive && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      className={cn(
                        "fixed left-3 z-[70] size-9 animate-in border border-primary/20 bg-card/90 text-primary shadow-md fade-in-0 slide-in-from-bottom-1 backdrop-blur-sm duration-200 hover:bg-card motion-reduce:animate-none",
                        isFullscreen
                          ? "bottom-[max(0.75rem,env(safe-area-inset-bottom))]"
                          : "bottom-[calc(var(--wird-player-height,80px)+0.75rem)]",
                      )}
                      aria-label={fullscreenOrientationSuggestion === "landscape"
                        ? "اعتماد العرض الأفقي"
                        : "اعتماد العرض الرأسي"}
                      onClick={() => void switchFullscreenOrientation(fullscreenOrientationSuggestion)}
                    >
                      <span className="relative flex size-5 items-center justify-center" aria-hidden="true">
                        <Smartphone className={cn("size-[17px]", fullscreenOrientationSuggestion === "landscape" && "rotate-90")} />
                        <RotateCw className="absolute -right-1 -bottom-1 size-2.5 rounded-full bg-card stroke-[2.5]" />
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {fullscreenOrientationSuggestion === "landscape" ? "اعتماد العرض الأفقي" : "اعتماد العرض الرأسي"}
                  </TooltipContent>
                </Tooltip>
              )}

              <div
                className={cn(
                  "mx-auto grid w-full max-w-[1000px] gap-2",
                  (readingMode === "large" || continuousPageAutoScroll) && viewMode === "text" && "hidden",
                  spreadMode === "double" && !isFullscreen && "lg:max-w-none lg:grid-cols-2",
                  viewMode === "text" && readingMode === "page" && "sm:max-w-none",
                  readerFocusActive && "h-full max-w-none place-items-center gap-0",
                  lineReadingLayout && readerFocusActive && viewMode === "text" && readingMode === "page" && !adaptivePageSpacing && "h-auto min-h-full place-items-start",
                  adaptivePageSpacing && !landscapeReadingMode && "max-w-none place-items-center gap-0",
                  adaptivePageSpacing && landscapeReadingMode && "h-auto min-h-full max-w-none place-items-start gap-0",
                  adaptivePageSpacing && spreadMode === "double" && !isFullscreen && "lg:max-w-[1352px]",
                  isFullscreen && !landscapeReadingMode && "h-full max-w-none place-items-center",
                  isFullscreen && !readerFocusActive && !adaptivePageSpacing && "pt-12",
                  viewMode === "text" && readingMode === "page" && "sm:h-auto sm:min-h-full sm:place-items-start",
                )}
              >
                {/* Adaptive spacing owns height only; an aspect ratio here can widen the page past the phone viewport. */}
                <div
                  ref={currentPageExportRef}
                  className={cn(
                    "relative justify-self-center",
                    adaptivePageSpacing
                      ? landscapeReadingMode
                        ? "w-full min-w-0 max-w-none"
                        : "w-full min-w-0 max-w-none"
                      : "w-full",
                    pageSwipeDirection !== 0 && "isolate overflow-hidden",
                    adaptivePageSpacing && !isFullscreen && lineSpacing === "comfortable" && "h-[max(calc(100dvh-var(--wird-header-height,48px)-var(--wird-player-height,96px)-clamp(2rem,7dvh,5rem)),160.714vw)]",
                    adaptivePageSpacing && !isFullscreen && lineSpacing === "spacious" && "h-[max(calc(100dvh-var(--wird-header-height,48px)-var(--wird-player-height,96px)),160.714vw)]",
                    fullscreenComfortablePage && !landscapeReadingMode && "h-[max(calc(100dvh-var(--wird-player-height,0px)-clamp(2rem,7dvh,5rem)),160.714vw)]",
                    fullscreenSpaciousPage && !landscapeReadingMode && "h-[max(calc(100dvh-var(--wird-player-height,0px)),160.714vw)]",
                    fullscreenComfortablePage && landscapeReadingMode && "h-[max(calc(100dvh-var(--wird-player-height,0px)-clamp(2rem,7dvh,5rem)),160.714vw)]",
                    fullscreenSpaciousPage && landscapeReadingMode && "h-[max(calc(100dvh-var(--wird-player-height,0px)),160.714vw)]",
                    readerFocusActive && !adaptivePageSpacing && (viewMode === "text" && readingMode === "page"
                      ? lineReadingLayout
                        ? "aspect-[672/1080] h-auto w-full max-w-none"
                        : "aspect-[672/1087] w-[min(100vw,61.82dvh)] max-w-none sm:aspect-[672/1080] sm:h-auto sm:w-full"
                      : "aspect-[672/958] h-[min(100dvh,calc(100vw*958/672))] w-auto max-w-full"),
                    isFullscreen && !readerFocusActive && !adaptivePageSpacing && (viewMode === "text" && readingMode === "page"
                      ? "aspect-[672/1080] h-[calc(100dvh-3.5rem)] w-auto max-w-full sm:h-auto sm:w-full"
                      : "aspect-[672/958] h-[calc(100dvh-3.5rem)] w-auto max-w-full"),
                    viewMode === "text" && readingMode === "page" && !adaptivePageSpacing && "sm:aspect-[672/1080] sm:h-auto sm:w-full sm:max-w-none",
                  )}
                >
                  <div
                    className={cn(
                      "h-full w-full will-change-transform",
                      pageSwipeAnimating && "transition-transform duration-[220ms] ease-out motion-reduce:transition-none",
                    )}
                    style={{ transform: `translate3d(${pageSwipeOffset}px, 0, 0)` }}
                  >
                    {renderMushafPage(
                      currentPage,
                      verses,
                      pageData.qcfPage,
                      true,
                      isLoading && pageData.page !== currentPage,
                    )}
                  </div>
                  {pageSwipeDirection !== 0 && (
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 h-full w-full bg-background will-change-transform",
                        pageSwipeAnimating && "transition-transform duration-[220ms] ease-out motion-reduce:transition-none",
                      )}
                      style={{
                        transform: pageSwipeDirection === -1
                          ? `translate3d(calc(100% + ${pageSwipeOffset}px), 0, 0)`
                          : `translate3d(calc(-100% + ${pageSwipeOffset}px), 0, 0)`,
                      }}
                      aria-hidden="true"
                    >
                      {pageSwipePreviewData?.page === currentPage + (pageSwipeDirection === 1 ? 1 : -1)
                        ? renderMushafPage(
                            pageSwipePreviewData.page,
                            pageSwipePreviewData.verses,
                            pageSwipePreviewData.qcfPage,
                            false,
                            false,
                            true,
                          )
                        : <div className="h-full w-full bg-[var(--mushaf-paper)]" />}
                    </div>
                  )}
                </div>
                {spreadMode === "double" && !isFullscreen && currentPage < MAX_PAGE && (
                  <div className={cn("hidden lg:block", adaptivePageSpacing && "h-full w-full")}>
                    {nextPageData?.page === currentPage + 1 ? (
                      renderMushafPage(
                        nextPageData.page,
                        nextPageData.verses,
                        nextPageData.qcfPage,
                        false,
                        false,
                        true,
                      )
                    ) : (
                      <div className={cn("grid place-items-center rounded-md border bg-card", adaptivePageSpacing ? "h-full w-full" : "aspect-[672/958]")}>
                        <LoaderCircle className="size-7 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {(readingMode === "large" || continuousPageAutoScroll) && viewMode === "text" && (
                <div
                  ref={largeReadingScrollRef}
                  className={cn(
                    "relative mx-auto w-full overflow-y-auto overscroll-contain px-0",
                    readingMode === "large" && "max-w-[900px] sm:px-3",
                    continuousPageAutoScroll && "max-w-none",
                    isFullscreen
                      ? "h-[calc(100dvh-2.25rem)] pb-10"
                      : "h-[calc(100dvh-var(--wird-header-height,48px)-var(--wird-player-height,60px))] pb-16",
                  )}
                  data-quran-scroll-container=""
                  aria-label={readingMode === "large" ? "القراءة المكبرة المستمرة" : "المصحف الكامل المستمر"}
                  onTouchStart={pauseContinuousScrollForInteraction}
                  onTouchEnd={resumeContinuousScrollAfterInteraction}
                  onTouchCancel={resumeContinuousScrollAfterInteraction}
                >
                  {continuousAutoScroll && continuousScrollIdentity && (
                    <div
                      className="sticky top-0 z-30 flex h-8 items-center justify-center gap-2 overflow-hidden border-b border-primary/15 bg-card/95 px-10 text-[10px] font-semibold text-muted-foreground shadow-sm backdrop-blur sm:gap-3 sm:text-xs"
                      data-continuous-reader-bar=""
                      aria-label={`الجزء ${continuousScrollIdentity.juzNumber}، الحزب ${continuousScrollIdentity.hizbNumber}، سورة ${continuousScrollIdentity.chapterName}، الصفحة ${continuousInfoPage}`}
                      dir="rtl"
                    >
                      <span className="shrink-0">الجزء {continuousScrollIdentity.juzNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex shrink-0 items-center gap-1">
                        الحزب {continuousScrollIdentity.hizbNumber}
                        {continuousScrollIdentity.hizbNumber > 0 && continuousScrollIdentity.rubAlHizbNumber > 0 && (
                          <HizbQuarterIndicator
                            hizbNumber={continuousScrollIdentity.hizbNumber}
                            rubAlHizbNumber={continuousScrollIdentity.rubAlHizbNumber}
                          />
                        )}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="min-w-0 truncate font-quran text-sm text-foreground sm:text-base">
                        سورة {continuousScrollIdentity.chapterName}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="shrink-0 tabular-nums">ص {continuousInfoPage}</span>
                    </div>
                  )}
                  <div ref={continuousScrollContentRef} className="will-change-transform">
                    {largeReadingPages.map((loadedPage) => (
                      <div
                        key={`${loadedPage.reciter ?? reciter}-${loadedPage.page}`}
                        data-large-reading-page={loadedPage.page}
                        className={cn(
                          "mx-auto w-full",
                          readingMode === "large" ? "max-w-[760px] py-2 sm:py-4" : "max-w-none py-0",
                        )}
                      >
                        {renderMushafPage(
                          loadedPage.page,
                          loadedPage.verses,
                          loadedPage.qcfPage,
                          loadedPage.page === currentPage,
                          false,
                          false,
                          continuousAutoScroll,
                        )}
                      </div>
                    ))}
                    {largeReadingPages.length === 0 && (
                      <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground">
                        <LoaderCircle className="size-6 animate-spin" />
                      </div>
                    )}
                  </div>

                </div>
              )}

              <Button
                variant="outline"
                size="icon-sm"
                className={cn(
                  "absolute right-0 top-1/2 z-20 size-9 -translate-y-1/2 border-primary/10 bg-card/55 text-foreground opacity-25 shadow-none backdrop-blur-sm transition-opacity hover:bg-card/80 hover:opacity-65 focus-visible:opacity-75 sm:right-1",
                  readerFocusActive && "max-sm:opacity-0 max-sm:hover:opacity-0 max-sm:focus-visible:opacity-0 sm:opacity-20",
                  (landscapeReadingMode || (lineReadingLayout && readerFocusActive)) && "fixed",
                  (practiceActive || continuousAutoScroll) && "hidden",
                  readingMode === "large" && viewMode === "text" && "hidden",
                )}
                aria-label="الصفحة السابقة"
                disabled={currentPage <= 1}
                onClick={() => moveToPage(currentPage - 1)}
              >
                <ChevronRight className="size-3" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className={cn(
                  "absolute top-1/2 left-0 z-20 size-9 -translate-y-1/2 border-primary/10 bg-card/55 text-foreground opacity-25 shadow-none backdrop-blur-sm transition-opacity hover:bg-card/80 hover:opacity-65 focus-visible:opacity-75 sm:left-1",
                  readerFocusActive && "max-sm:opacity-0 max-sm:hover:opacity-0 max-sm:focus-visible:opacity-0 sm:opacity-20",
                  (landscapeReadingMode || (lineReadingLayout && readerFocusActive)) && "fixed",
                  (practiceActive || continuousAutoScroll) && "hidden",
                  readingMode === "large" && viewMode === "text" && "hidden",
                )}
                aria-label="الصفحة التالية"
                disabled={currentPage >= MAX_PAGE}
                onClick={() => moveToPage(currentPage + 1)}
              >
                <ChevronLeft className="size-3" />
              </Button>

              <Button
                variant="ghost"
                className={cn(
                  "group absolute right-0 bottom-0 z-20 h-[11%] w-[12%] items-center justify-end rounded-none bg-transparent p-1 text-[var(--mushaf-meta)] hover:bg-primary/3 hover:text-primary active:bg-primary/7",
                  readerFocusActive && "max-sm:opacity-0 max-sm:hover:opacity-0 max-sm:focus-visible:opacity-0",
                  (landscapeReadingMode || (lineReadingLayout && readerFocusActive)) && "hidden",
                  (practiceActive || continuousAutoScroll) && "hidden",
                  readingMode === "large" && viewMode === "text" && "hidden",
                )}
                aria-label="الصفحة السابقة"
                disabled={currentPage <= 1}
                onClick={() => moveToPage(currentPage - 1)}
              >
                <ChevronRight className="size-3 opacity-10 transition-opacity group-hover:opacity-45" />
              </Button>
              <Button
                variant="ghost"
                className={cn(
                  "group absolute bottom-0 left-0 z-20 h-[11%] w-[12%] items-center justify-start rounded-none bg-transparent p-1 text-[var(--mushaf-meta)] hover:bg-primary/3 hover:text-primary active:bg-primary/7",
                  readerFocusActive && "max-sm:opacity-0 max-sm:hover:opacity-0 max-sm:focus-visible:opacity-0",
                  (landscapeReadingMode || (lineReadingLayout && readerFocusActive)) && "hidden",
                  (practiceActive || continuousAutoScroll) && "hidden",
                  readingMode === "large" && viewMode === "text" && "hidden",
                )}
                aria-label="الصفحة التالية"
                disabled={currentPage >= MAX_PAGE}
                onClick={() => moveToPage(currentPage + 1)}
              >
                <ChevronLeft className="size-3 opacity-10 transition-opacity group-hover:opacity-45" />
              </Button>
            </div>
          </section>
        </main>

        <footer
          ref={playerShellRef}
          data-quran-player
          aria-label="مشغل تلاوة القرآن"
          className={cn(
            "fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 shadow-[0_-8px_24px_rgba(28,45,38,0.08)] backdrop-blur transition-[transform,opacity] duration-200",
            readerFocusActive && !landscapeFullscreenPlayer && !playerCollapsed && "pointer-events-none translate-y-full opacity-0",
            landscapeFullscreenPlayer && "z-[60]",
            playerCollapsed && "h-[12px] border-t-0 bg-transparent shadow-none backdrop-blur-none",
            (practiceActive || dashboardOpen) && "hidden",
          )}
        >
          {!continuousAutoScroll && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(
                    "absolute z-20 size-9 bg-transparent p-0 text-muted-foreground hover:bg-transparent hover:text-foreground",
                    playerCollapsed
                      ? "bottom-0 left-1/2 -translate-x-1/2"
                      : "-top-2 left-1",
                  )}
                  aria-label={playerCollapsed ? "توسيع شريط التشغيل" : "طي شريط التشغيل"}
                  aria-expanded={!playerCollapsed}
                  onClick={() => setPlayerCollapsed((collapsed) => !collapsed)}
                >
                  <span className={cn(
                    "flex items-center justify-center border border-border/80 bg-card/95 shadow-sm backdrop-blur",
                    playerCollapsed
                      ? "h-5 w-9 rounded-t-md rounded-b-none"
                      : "size-5 rounded-b-md rounded-t-none",
                  )}>
                    {playerCollapsed ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{playerCollapsed ? "توسيع شريط التشغيل" : "طي شريط التشغيل"}</TooltipContent>
            </Tooltip>
          )}
          {audioPlaybackError && !playerCollapsed && (
            <div className="flex items-start gap-2 border-b border-destructive/20 bg-destructive/5 px-3 py-2 text-right" role="alert" dir="rtl">
              <p className="min-w-0 flex-1 text-xs leading-5 text-foreground sm:text-sm">{audioPlaybackError}</p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                onClick={() => {
                  setAudioPlaybackError(null)
                  startPlayback()
                  setReloadKey((key) => key + 1)
                }}
              >
                <RotateCcw /> إعادة المحاولة
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-8 shrink-0"
                aria-label="إخفاء رسالة خطأ التلاوة"
                onClick={() => setAudioPlaybackError(null)}
              >
                <X />
              </Button>
            </div>
          )}
          {!continuousAutoScroll && viewMode === "image" && !playerCollapsed && !simplifiedPlayer && (
            <div className="border-b bg-secondary/55">
              <div className="mx-auto max-h-[20vh] max-w-[1100px] overflow-y-auto px-3 pt-4 pb-1.5 sm:max-h-[26vh] sm:px-6 sm:py-3 lg:max-h-[18vh]">
                <p className="font-quran whitespace-normal text-center text-lg leading-8 text-foreground sm:text-2xl sm:leading-12">
                  {isLoading
                    ? "جاري تحميل تلاوة الصفحة..."
                    : error
                      ? error
                      : currentVerse
                        ? <span data-quran-content>{currentVerse.text}</span>
                        : "التلاوة جاهزة"}
                </p>
              </div>
            </div>
          )}
          {continuousAutoScroll ? (
            <div className={cn(
              "mx-auto flex max-w-[760px] items-center justify-center gap-1.5 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] sm:gap-2.5",
              isFullscreen ? "min-h-[32px] px-1 py-0" : "min-h-[52px] pt-2 sm:pt-1.5",
            )}>
              <span className="sr-only" aria-live="polite">
                {continuousRecitationFollow ? "متابعة موضع تلاوة القارئ" : "تمرير حر بسرعة مستقلة"}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="size-7 shrink-0"
                    aria-label="الخروج من التمرير التلقائي"
                    onClick={stopContinuousAutoScroll}
                  >
                    <X className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>خروج من التمرير</TooltipContent>
              </Tooltip>
              {continuousRecitationFollow ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="size-7 shrink-0"
                        aria-label={isPlaying ? "إيقاف التلاوة مؤقتًا" : "استئناف التلاوة"}
                        onClick={togglePlayback}
                      >
                        {isPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5 fill-current" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isPlaying ? "إيقاف التلاوة مؤقتًا" : "استئناف التلاوة"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={audioReviewActive ? "secondary" : "ghost"}
                        size="icon-sm"
                        className="size-7 shrink-0"
                        aria-label={audioReviewActive ? "إظهار جميع الآيات" : audioReviewActionLabel}
                        aria-pressed={audioReviewActive}
                        onClick={toggleAudioReview}
                      >
                        {audioReviewActive ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{audioReviewActive ? "إظهار جميع الآيات" : audioReviewActionLabel}</TooltipContent>
                  </Tooltip>
                  <Popover open={extendedSpeedOpen} onOpenChange={setExtendedSpeedOpen}>
                    <PopoverAnchor asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 touch-manipulation gap-1 px-1.5 text-xs tabular-nums"
                        aria-label={`تغيير سرعة التلاوة، السرعة الحالية ${speed}×. اضغط مطولًا للسرعات الأعلى`}
                        aria-haspopup="dialog"
                        aria-expanded={extendedSpeedOpen}
                        onPointerDown={beginSpeedLongPress}
                        onPointerUp={clearSpeedLongPress}
                        onPointerCancel={clearSpeedLongPress}
                        onPointerLeave={clearSpeedLongPress}
                        onContextMenu={handleSpeedContextMenu}
                        onClick={handleSpeedButtonClick}
                      >
                        <Gauge className="size-4" />
                        {speed}×
                      </Button>
                    </PopoverAnchor>
                    {renderExtendedSpeedContent()}
                  </Popover>
                  <Slider
                    value={[Math.min(speed, SLIDER_MAX_SPEED)]}
                    min={MIN_SPEED}
                    max={SLIDER_MAX_SPEED}
                    step={0.25}
                    className={cn("w-[clamp(4.5rem,23vw,11rem)] shrink min-w-0 sm:w-[min(34vw,240px)]", isFullscreen && "w-[clamp(4rem,19vw,9rem)] sm:w-[min(24vw,180px)]")}
                    onValueChange={(value) => updateSpeed(value[0])}
                    aria-label="سرعة تلاوة القارئ حتى 3 أضعاف"
                  />
                </>
              ) : (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-7 shrink-0"
                        aria-label="تشغيل التلاوة ومتابعة القارئ"
                        disabled={isLoading || Boolean(error) || !currentTrack || !hasVerseSynchronization}
                        onClick={startPlayback}
                      >
                        <Headphones className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>تشغيل التلاوة ومتابعة القارئ</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={continuousScrollPaused ? "default" : "outline"}
                        size="icon-sm"
                        className="size-7 shrink-0"
                        aria-label={continuousScrollPaused ? "استئناف التمرير التلقائي" : "إيقاف التمرير التلقائي مؤقتًا"}
                        aria-pressed={continuousScrollPaused}
                        onClick={toggleContinuousScrollPause}
                      >
                        {continuousScrollPaused ? <Play className="size-3.5 fill-current" /> : <Pause className="size-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{continuousScrollPaused ? "استئناف" : "إيقاف مؤقت"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 gap-1 px-1.5 text-xs tabular-nums"
                        aria-label={`تغيير سرعة التمرير، السرعة الحالية ${formatContinuousScrollSpeed(continuousScrollSpeed)}×`}
                        onClick={cycleContinuousScrollSpeed}
                      >
                        <Gauge className="size-4" />
                        {formatContinuousScrollSpeed(continuousScrollSpeed)}×
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>تغيير سرعة التمرير</TooltipContent>
                  </Tooltip>
                  <Slider
                    value={[continuousScrollSpeed]}
                    min={CONTINUOUS_SCROLL_MIN_SPEED}
                    max={CONTINUOUS_SCROLL_MAX_SPEED}
                    step={CONTINUOUS_SCROLL_SPEED_STEP}
                    className={cn("w-[clamp(4.5rem,24vw,11rem)] shrink min-w-0 sm:w-[min(34vw,240px)]", isFullscreen && "w-[clamp(4rem,20vw,9rem)] sm:w-[min(24vw,180px)]")}
                    onValueChange={(value) => setContinuousScrollSpeed(normalizeContinuousScrollSpeed(value[0]))}
                    aria-label="سرعة التمرير التلقائي"
                  />
                  <DropdownMenu dir="rtl">
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant={continuousScrollStopAt !== null ? "secondary" : "ghost"}
                        size="icon-sm"
                        className="relative size-8 shrink-0"
                        aria-label={continuousScrollTimerRemaining !== null
                          ? `مؤقت التمرير، متبقي ${Math.max(1, Math.ceil(continuousScrollTimerRemaining / 60))} دقيقة`
                          : "مؤقت التمرير التلقائي"}
                      >
                        <TimerOff />
                        {continuousScrollTimerRemaining !== null && (
                          <span className="absolute -top-1 -left-1 min-w-5 rounded-sm bg-primary px-0.5 text-[8px] leading-4 text-primary-foreground tabular-nums">
                            {Math.max(1, Math.ceil(continuousScrollTimerRemaining / 60))}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="top" className="w-48">
                      <DropdownMenuItem onSelect={() => setContinuousScrollTimer(null)}>بدون مؤقت</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {[5, 10, 20, 30, 60].map((minutes) => (
                        <DropdownMenuItem key={minutes} onSelect={() => setContinuousScrollTimer(minutes)}>
                          بعد {minutes} دقيقة
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          ) : (
          <div className={cn(
            "mx-auto max-w-[1500px] px-[4px] pt-[18px] pb-[max(0.45rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-3 lg:px-8",
            largeControls && "max-sm:px-[4px]",
            compactPlaybackChrome && "px-2 pt-[12px] pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:px-3 sm:pt-[10px] sm:pb-1 lg:px-4",
            playerCollapsed && "hidden",
          )}>
            <Progress
              value={sessionProgress}
              className={cn(
                "absolute inset-x-1 -top-[3px] z-10 h-0.5 [transform:scaleX(-1)] sm:static sm:inset-auto sm:z-auto sm:mb-1 sm:h-1",
                simplifiedPlayer && "hidden",
              )}
              aria-label="تقدم جلسة التلاوة من اليمين إلى اليسار"
            />
            <div className={cn("mb-1 grid min-w-0 grid-cols-2 items-center gap-2 px-0.5 text-[9px] text-muted-foreground sm:text-[11px]", (playerCollapsed || compactPlaybackChrome) && "hidden")}>
              <button
                type="button"
                className="flex min-h-6 min-w-0 items-center gap-1 text-right hover:text-foreground"
                aria-label={`اختيار القارئ، الحالي ${selectedReciter.name}`}
                onClick={() => window.matchMedia("(max-width: 639px)").matches
                  ? setMobileReciterPickerOpen(true)
                  : setCompactReciterPickerOpen(true)}
              >
                <Headphones className="size-3 shrink-0 text-primary" />
                <span className="truncate">{selectedReciter.name} · {selectedReciter.detail}</span>
              </button>
              <span className="flex min-w-0 items-center justify-end gap-1 truncate text-left tabular-nums">
                <span className="sr-only">سرعة التلاوة {speed} أضعاف</span>
                <Gauge className="size-3 shrink-0 text-primary" aria-hidden="true" />
                <span aria-hidden="true">{speed}×</span>
              </span>
            </div>

            <div
              data-mobile-player-controls
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_clamp(120px,34vw,136px)_minmax(0,1fr)] items-center gap-1 px-1 sm:grid-cols-[minmax(132px,1fr)_160px_minmax(132px,1fr)] sm:gap-3 sm:px-0",
                playerCollapsed && "invisible",
              )}
              dir="ltr"
            >
              <div className="flex min-w-0 items-center justify-between gap-1 sm:justify-end sm:gap-2">
                {renderPlaybackStopControl()}
                {renderPlaybackSpeedControl()}
                {error ? (
                  <Button variant="outline" size="icon-sm" className="size-[28px] sm:size-8" aria-label="إعادة تحميل التلاوة" onClick={() => setReloadKey((key) => key + 1)}>
                    <RotateCcw />
                  </Button>
                ) : renderPlayerVolumeControl()}
              </div>

              <div data-mobile-player-center className="grid w-full grid-cols-[minmax(28px,1fr)_48px_minmax(28px,1fr)] items-center justify-items-center gap-1 sm:grid-cols-[40px_64px_40px] sm:gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={cn("size-8 sm:size-9", compactPlaybackChrome && "sm:size-8")}
                      aria-label={hasVerseSynchronization
                        ? "الآية السابقة"
                        : recitationSyncScope === "chapter" ? "السورة السابقة" : "الصفحة السابقة"}
                      disabled={isLoading || !canGoToPreviousVerse}
                      onClick={goToPreviousVerse}
                    >
                      <SkipBack />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {hasVerseSynchronization
                      ? "الآية السابقة"
                      : recitationSyncScope === "chapter" ? "السورة السابقة" : "الصفحة السابقة"}
                  </TooltipContent>
                </Tooltip>
                <Button
                  size="icon-lg"
                  className={cn("z-10 size-12 rounded-full sm:size-12", compactPlaybackChrome && "sm:size-8")}
                  aria-label={isPlaying ? "إيقاف مؤقت" : "تشغيل"}
                  disabled={Boolean(error)}
                  onClick={() => void togglePlayback()}
                >
                  {isPlaying ? <Pause className="fill-current" /> : <Play className="translate-x-px fill-current" />}
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={cn("size-8 sm:size-9", compactPlaybackChrome && "sm:size-8")}
                      aria-label={hasVerseSynchronization
                        ? "الآية التالية"
                        : recitationSyncScope === "chapter" ? "السورة التالية" : "الصفحة التالية"}
                      disabled={isLoading || !canGoToNextVerse}
                      onClick={goToNextVerse}
                    >
                      <SkipForward />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {hasVerseSynchronization
                      ? "الآية التالية"
                      : recitationSyncScope === "chapter" ? "السورة التالية" : "الصفحة التالية"}
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="flex min-w-0 items-center justify-between gap-1 sm:justify-start sm:gap-2">
                {renderPlayerReviewControl()}
                {renderPlayerScrollControl()}
                {renderPlayerReciterControl()}
              </div>
            </div>
          </div>
          )}
        </footer>

        <Drawer open={mobileReciterPickerOpen} onOpenChange={setMobileReciterPickerOpen} direction="bottom">
          <DrawerContent className="z-[90] max-h-[78dvh] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden" dir="rtl">
            <DrawerHeader className="border-b px-4 pt-2 pb-3 text-right">
              <DrawerTitle className="flex items-center gap-2 text-right">
                <Headphones className="size-4 text-primary" />
                اختيار القارئ
              </DrawerTitle>
              <DrawerDescription className="truncate text-right">
                الحالي: {selectedReciter.name} · {selectedReciter.detail}
              </DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-hidden px-2 py-2">
              {renderReciterCommand(true)}
            </div>
          </DrawerContent>
        </Drawer>

        <audio
          ref={audioRef}
          preload="metadata"
          onCanPlay={(event) => syncAudioPlaybackSpeed(event.currentTarget, speedRef.current)}
          onPlaying={(event) => syncAudioPlaybackSpeed(event.currentTarget, speedRef.current)}
          onEnded={(event) => handleAudioEnded(event.currentTarget)}
          onTimeUpdate={(event) => handleTimeUpdate(event.currentTarget)}
          onLoadedMetadata={(event) => {
            if (!currentTrack || event.currentTarget.src !== currentTrack.audioUrl) return
            syncAudioPlaybackSpeed(event.currentTarget, speedRef.current)
            const pendingBookmark = pendingBookmarkRef.current
            const pendingVerseSeekMs = pendingVerseSeekMsRef.current
            if (
              pendingBookmark?.page === currentPage &&
              pendingBookmark.chapterId === currentTrack.chapterId
            ) {
              event.currentTarget.currentTime = pendingBookmark.positionMs / 1000
              pendingBookmarkRef.current = null
            } else if (
              pendingVerseSeekMs !== null &&
              pendingVerseSeekMs >= currentTrack.startMs &&
              pendingVerseSeekMs <= currentTrack.endMs
            ) {
              event.currentTarget.currentTime = pendingVerseSeekMs / 1000
              pendingVerseSeekMsRef.current = null
            } else {
              pendingVerseSeekMsRef.current = null
              event.currentTarget.currentTime = currentTrack.startMs / 1000
            }
            setElapsed(0)
            if (isPlaying) {
              event.currentTarget.play().catch(reportAudioPlaybackFailure)
            }
          }}
          onError={(event) => {
            if (!currentTrack || !isPlayingRef.current) return
            reportAudioSourceFailure(event.currentTarget)
          }}
        />
      </div>
    </TooltipProvider>
  )
}
