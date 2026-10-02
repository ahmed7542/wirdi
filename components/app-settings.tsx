"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Accessibility,
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Download,
  Eye,
  ExternalLink,
  FileDown,
  HardDrive,
  Headphones,
  ImageIcon,
  Languages,
  LoaderCircle,
  Monitor,
  Moon,
  Palette,
  Paintbrush,
  Pencil,
  Plus,
  Search,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { getSurahMeta, type Surah } from "quran-meta/hafs"
import { useTheme } from "next-themes"
import { toast } from "sonner"

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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { ViewMode } from "@/components/quran-player"
import type { LineSpacing, ReadingMode } from "@/components/quran-page"
import { APP_PALETTES, useAppPalette, type AppPalette } from "@/components/theme-provider"
import { useInterfaceLanguage } from "@/components/interface-language-provider"
import {
  APP_INSTALL_PROMPT_CHANGE_EVENT,
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/app-install"
import {
  OFFLINE_AUDIO_CACHE,
  OFFLINE_PAGE_CACHE,
  cacheOfflineRecitationMetadata,
  getOfflineRecitationPages,
  hasOfflineRecitationMetadata,
  loadOfflineRangePackages,
  saveOfflineRangePackages,
  type OfflineRangePackage,
} from "@/lib/offline-audio"
import {
  OFFLINE_QURAN_PROGRESS_EVENT,
  downloadOfflineQuran,
  inspectOfflineQuran,
  type OfflineQuranStatus,
} from "@/lib/offline-quran"
import { loadQuranNavigation } from "@/lib/offline-quran-navigation"
import {
  inspectOfflineMutashabihat,
  prepareOfflineMutashabihat,
  type OfflineMutashabihatStatus,
} from "@/lib/offline-mutashabihat"
import {
  deleteOfflineTafsir,
  downloadOfflineTafsir,
  inspectOfflineTafsir,
  OFFLINE_TAFSIR_PROGRESS_EVENT,
  type OfflineTafsirStatus,
} from "@/lib/offline-tafsir"
import {
  createBookmarkCategoryId,
  MAX_BOOKMARK_CATEGORIES,
  MAX_BOOKMARK_CATEGORY_LABEL_LENGTH,
  type BookmarkCategory,
} from "@/lib/bookmark-categories"
import { cn } from "@/lib/utils"
import {
  createWirdBackup,
  markWirdBackupCreated,
  parseWirdBackup,
  readLastWirdBackupAt,
  restoreWirdBackup,
  type WirdBackup,
} from "@/lib/wird-backup"

const OFFLINE_SURAH_STORAGE_KEY = "wird-offline-surahs"

export type AppTextScale = "normal" | "large" | "xlarge"
export type AudioReviewRevealMode = "progressive" | "verse"
export type SearchGestureDirection = "down" | "up"

type Chapter = {
  id: number
  name: string
}

type PendingDownload = {
  chapter: Chapter
  chapterName: string
  reciter: number
  reciterName: string
  fileMode: OfflineRangePackage["fileMode"]
  files: OfflineRangePackage["files"]
  totalSize: number
}

export type DownloadReciter = {
  id: number
  name: string
  detail: string
}

type OfflineMissingFile = {
  audioUrl: string
  label: string
  fileSize: number
}

type OfflineSurah = {
  key: string
  chapterId: number
  chapterName: string
  reciter: number
  reciterName: string
  audioUrl: string
  files?: OfflineRangePackage["files"]
  fileMode?: OfflineRangePackage["fileMode"]
  size: number
  qualityLabel?: string
}

export type AppSettingsTab = "reading" | "bookmarks" | "downloads" | "install"

type AppSettingsProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTab?: AppSettingsTab
  focusBackup?: boolean
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  readingMode: ReadingMode
  onReadingModeChange: (mode: ReadingMode) => void
  lineSpacing: LineSpacing
  onLineSpacingChange: (spacing: LineSpacing) => void
  audioReviewRevealMode: AudioReviewRevealMode
  onAudioReviewRevealModeChange: (mode: AudioReviewRevealMode) => void
  centerTapFullscreen: boolean
  onCenterTapFullscreenChange: (enabled: boolean) => void
  searchGestureEnabled: boolean
  onSearchGestureEnabledChange: (enabled: boolean) => void
  searchGestureDirection: SearchGestureDirection
  onSearchGestureDirectionChange: (direction: SearchGestureDirection) => void
  largeTextSize: number
  onLargeTextSizeChange: (size: number) => void
  autoScroll: boolean
  onAutoScrollChange: (enabled: boolean) => void
  screenRotationLocked: boolean
  onScreenRotationLockedChange: (locked: boolean) => void
  keepScreenAwake: boolean
  onKeepScreenAwakeChange: (enabled: boolean) => void
  wakeLockSupported: boolean
  highContrast: boolean
  onHighContrastChange: (enabled: boolean) => void
  largeControls: boolean
  onLargeControlsChange: (enabled: boolean) => void
  appTextScale: AppTextScale
  onAppTextScaleChange: (scale: AppTextScale) => void
  simplifiedPlayer: boolean
  onSimplifiedPlayerChange: (enabled: boolean) => void
  speechLabels: boolean
  onSpeechLabelsChange: (enabled: boolean) => void
  bookmarkCategories: BookmarkCategory[]
  bookmarkCategoryCounts: Record<string, number>
  onBookmarkCategoriesChange: (categories: BookmarkCategory[]) => void
  reciter: number
  reciterName: string
  downloadReciters: readonly DownloadReciter[]
}

function normalizeReciterSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .replace(/\s+/g, "")
    .toLowerCase()
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 MB"
  if (value < 1024 ** 2) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / 1024 ** 2).toFixed(value >= 100 * 1024 ** 2 ? 0 : 1)} MB`
}

function formatBackupDate(value: string | null, language: "ar" | "en") {
  if (!value) return "لم تُنشأ"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "لم تُنشأ"
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "ar-AE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

function getOfflineSurahFiles(entry: OfflineSurah): OfflineRangePackage["files"] {
  return entry.files?.length
    ? entry.files
    : [{ id: String(entry.chapterId), label: `سورة ${entry.chapterName}`, audioUrl: entry.audioUrl, fileSize: entry.size }]
}

function loadOfflineEntries() {
  try {
    return JSON.parse(window.localStorage.getItem(OFFLINE_SURAH_STORAGE_KEY) ?? "[]") as OfflineSurah[]
  } catch {
    window.localStorage.removeItem(OFFLINE_SURAH_STORAGE_KEY)
    return []
  }
}

export function AppSettings({
  open,
  onOpenChange,
  initialTab = "reading",
  focusBackup = false,
  viewMode,
  onViewModeChange,
  readingMode,
  onReadingModeChange,
  lineSpacing,
  onLineSpacingChange,
  audioReviewRevealMode,
  onAudioReviewRevealModeChange,
  centerTapFullscreen,
  onCenterTapFullscreenChange,
  searchGestureEnabled,
  onSearchGestureEnabledChange,
  searchGestureDirection,
  onSearchGestureDirectionChange,
  largeTextSize,
  onLargeTextSizeChange,
  autoScroll,
  onAutoScrollChange,
  screenRotationLocked,
  onScreenRotationLockedChange,
  keepScreenAwake,
  onKeepScreenAwakeChange,
  wakeLockSupported,
  highContrast,
  onHighContrastChange,
  largeControls,
  onLargeControlsChange,
  appTextScale,
  onAppTextScaleChange,
  simplifiedPlayer,
  onSimplifiedPlayerChange,
  speechLabels,
  onSpeechLabelsChange,
  bookmarkCategories,
  bookmarkCategoryCounts,
  onBookmarkCategoriesChange,
  reciter,
  reciterName,
  downloadReciters,
}: AppSettingsProps) {
  const { theme, setTheme } = useTheme()
  const { palette, customPalette, setPalette, setCustomPalette } = useAppPalette()
  const { language, direction, setLanguage } = useInterfaceLanguage()
  const downloadControllerRef = useRef<AbortController | null>(null)
  const backupInputRef = useRef<HTMLInputElement>(null)
  const backupSectionRef = useRef<HTMLDivElement>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [entries, setEntries] = useState<OfflineSurah[]>([])
  const [rangePackages, setRangePackages] = useState<OfflineRangePackage[]>([])
  const [query, setQuery] = useState("")
  const [preparingChapter, setPreparingChapter] = useState<number | null>(null)
  const [pendingDownload, setPendingDownload] = useState<PendingDownload | null>(null)
  const [pendingBackup, setPendingBackup] = useState<WirdBackup | null>(null)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [pendingCategoryDeletion, setPendingCategoryDeletion] = useState<BookmarkCategory | null>(null)
  const [editingBookmarkCategoryId, setEditingBookmarkCategoryId] = useState<string | null>(null)
  const [bookmarkCategoryNames, setBookmarkCategoryNames] = useState<Record<string, string>>({})
  const [newBookmarkCategoryName, setNewBookmarkCategoryName] = useState("")
  const [downloadReciter, setDownloadReciter] = useState(reciter)
  const [downloadReciterOpen, setDownloadReciterOpen] = useState(false)
  const [downloadReciterQuery, setDownloadReciterQuery] = useState("")
  const [selectedChapterIds, setSelectedChapterIds] = useState<number[]>([])
  const [downloadingChapter, setDownloadingChapter] = useState<number | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [bulkDownloading, setBulkDownloading] = useState(false)
  const [bulkDownloadProgress, setBulkDownloadProgress] = useState(0)
  const [bulkDownloadLabel, setBulkDownloadLabel] = useState("")
  const [repairingOffline, setRepairingOffline] = useState(false)
  const [repairingRecitationMetadata, setRepairingRecitationMetadata] = useState(false)
  const [repairProgress, setRepairProgress] = useState(0)
  const [offlinePageCount, setOfflinePageCount] = useState(0)
  const [offlineQuranStatus, setOfflineQuranStatus] = useState<OfflineQuranStatus>({
    completed: 0,
    total: 0,
    pagesCompleted: 0,
    pagesTotal: 604,
    running: false,
    failed: 0,
  })
  const [offlineMutashabihatStatus, setOfflineMutashabihatStatus] = useState<OfflineMutashabihatStatus>({
    ready: false,
    verses: 0,
    total: 6236,
  })
  const [preparingOfflineMutashabihat, setPreparingOfflineMutashabihat] = useState(false)
  const [offlineTafsirStatus, setOfflineTafsirStatus] = useState<OfflineTafsirStatus>({ completed: 0, total: 114, running: false, failed: 0 })
  const [pendingTafsirDeletion, setPendingTafsirDeletion] = useState(false)
  const [offlineFileCount, setOfflineFileCount] = useState({ cached: 0, total: 0 })
  const [offlineMissingFiles, setOfflineMissingFiles] = useState<OfflineMissingFile[]>([])
  const [loadingChapters, setLoadingChapters] = useState(false)
  const [storageUsage, setStorageUsage] = useState(0)
  const [storageQuota, setStorageQuota] = useState(0)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(() => getDeferredInstallPrompt())
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIos, setIsIos] = useState(false)
  const [isEmbedded, setIsEmbedded] = useState(false)
  const bookmarkCountTotal = useMemo(
    () => bookmarkCategories.reduce((total, category) => total + (bookmarkCategoryCounts[category.id] ?? 0), 0),
    [bookmarkCategories, bookmarkCategoryCounts],
  )

  const persistEntries = (next: OfflineSurah[]) => {
    setEntries(next)
    window.localStorage.setItem(OFFLINE_SURAH_STORAGE_KEY, JSON.stringify(next))
  }

  const refreshStorage = async () => {
    const estimate = await navigator.storage?.estimate?.()
    setStorageUsage(estimate?.usage ?? 0)
    setStorageQuota(estimate?.quota ?? 0)
  }

  useEffect(() => {
    if (!open) return
    setBookmarkCategoryNames(Object.fromEntries(bookmarkCategories.map((category) => [category.id, category.label])))
    setEditingBookmarkCategoryId(null)
    setLastBackupAt(readLastWirdBackupAt(window.localStorage))
  }, [bookmarkCategories, open])

  useEffect(() => {
    if (!open || !focusBackup) return
    const frame = window.requestAnimationFrame(() => {
      backupSectionRef.current?.scrollIntoView({ block: "start" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusBackup, open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setNewBookmarkCategoryName("")
    setLoadingChapters(true)
    const savedEntries = loadOfflineEntries()
    const savedRangePackages = loadOfflineRangePackages()
    setEntries(savedEntries)
    setRangePackages(savedRangePackages)
    setSelectedChapterIds([])
    if (!downloadReciters.some((item) => item.id === downloadReciter)) {
      setDownloadReciter(downloadReciters.find((item) => item.id === reciter)?.id ?? downloadReciters[0]?.id ?? reciter)
    }
    void refreshStorage()
    void inspectOfflineMutashabihat().then(setOfflineMutashabihatStatus).catch(() => undefined)
    void inspectOfflineTafsir().then(setOfflineTafsirStatus).catch(() => undefined)
    void loadQuranNavigation<{ chapters?: Chapter[] }>()
      .then((data) => {
        if (!cancelled) setChapters(data.chapters ?? [])
      })
      .catch(() => {
        if (!cancelled) toast.error("تعذر تحميل قائمة السور")
      })
      .finally(() => {
        if (!cancelled) setLoadingChapters(false)
      })
    return () => {
      cancelled = true
    }
  }, [downloadReciter, downloadReciters, open, reciter])

  useEffect(() => () => downloadControllerRef.current?.abort(), [])

  useEffect(() => {
    const refreshRanges = () => setRangePackages(loadOfflineRangePackages())
    window.addEventListener("wird-offline-ranges-changed", refreshRanges)
    return () => window.removeEventListener("wird-offline-ranges-changed", refreshRanges)
  }, [])

  useEffect(() => {
    if (!open || navigator.onLine === false || entries.length === 0) return
    const controller = new AbortController()
    let cancelled = false

    void (async () => {
      const missingEntries: OfflineSurah[] = []
      for (const entry of entries) {
        const audioUrls = getOfflineSurahFiles(entry).map((file) => file.audioUrl)
        if (!await hasOfflineRecitationMetadata(entry.chapterId, entry.reciter, audioUrls)) {
          missingEntries.push(entry)
        }
      }
      if (cancelled || missingEntries.length === 0) return
      setRepairingRecitationMetadata(true)
      for (const entry of missingEntries) {
        await cacheOfflineRecitationMetadata({
          chapterId: entry.chapterId,
          reciter: entry.reciter,
          audioUrls: getOfflineSurahFiles(entry).map((file) => file.audioUrl),
          signal: controller.signal,
        })
      }
      if (!cancelled) toast.success("اكتملت بيانات تشغيل التلاوات المحفوظة دون إنترنت")
    })().catch((error: Error) => {
      if (!cancelled && error.name !== "AbortError") {
        toast.error("تعذر استكمال بيانات بعض التلاوات المحفوظة")
      }
    }).finally(() => {
      if (!cancelled) setRepairingRecitationMetadata(false)
    })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [entries, open])

  useEffect(() => {
    if (!open || !("caches" in window)) return
    let cancelled = false
    const refreshOfflineStatus = async () => {
      const files = new Map<string, OfflineMissingFile>()
      entries.forEach((entry) => {
        getOfflineSurahFiles(entry).forEach((file) => files.set(file.audioUrl, {
          audioUrl: file.audioUrl,
          label: file.label,
          fileSize: file.fileSize,
        }))
      })
      rangePackages.forEach((rangePackage) => {
        rangePackage.files.forEach((file) => files.set(file.audioUrl, {
          audioUrl: file.audioUrl,
          label: file.label,
          fileSize: file.fileSize,
        }))
      })
      const [audioCache, pageCache] = await Promise.all([
        window.caches.open(OFFLINE_AUDIO_CACHE),
        window.caches.open(OFFLINE_PAGE_CACHE),
      ])
      const fileList = [...files.values()]
      const cachedChecks = await Promise.all(
        fileList.map(async (file) => Boolean(await audioCache.match(file.audioUrl))),
      )
      const pageRequests = await pageCache.keys()
      const pages = new Set(pageRequests.flatMap((request) => {
        const url = new URL(request.url)
        const page = url.pathname === "/api/quran" ? Number(url.searchParams.get("page")) : 0
        return page >= 1 && page <= 604 ? [page] : []
      }))
      if (cancelled) return
      setOfflinePageCount(pages.size)
      setOfflineFileCount({ cached: cachedChecks.filter(Boolean).length, total: fileList.length })
      setOfflineMissingFiles(fileList.filter((_, index) => !cachedChecks[index]))
    }
    void refreshOfflineStatus().catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [entries, open, rangePackages])

  useEffect(() => {
    const handleOfflineQuranProgress = (event: Event) => {
      const status = (event as CustomEvent<OfflineQuranStatus>).detail
      setOfflineQuranStatus(status)
      setOfflinePageCount(status.pagesCompleted)
    }
    const handleOfflineTafsirProgress = (event: Event) => {
      setOfflineTafsirStatus((event as CustomEvent<OfflineTafsirStatus>).detail)
    }
    window.addEventListener(OFFLINE_QURAN_PROGRESS_EVENT, handleOfflineQuranProgress)
    window.addEventListener(OFFLINE_TAFSIR_PROGRESS_EVENT, handleOfflineTafsirProgress)
    void inspectOfflineQuran().then((status) => {
      setOfflineQuranStatus(status)
      setOfflinePageCount(status.pagesCompleted)
    }).catch(() => undefined)
    void inspectOfflineMutashabihat()
      .then(setOfflineMutashabihatStatus)
      .catch(() => undefined)
    void inspectOfflineTafsir().then(setOfflineTafsirStatus).catch(() => undefined)
    return () => {
      window.removeEventListener(OFFLINE_QURAN_PROGRESS_EVENT, handleOfflineQuranProgress)
      window.removeEventListener(OFFLINE_TAFSIR_PROGRESS_EVENT, handleOfflineTafsirProgress)
    }
  }, [])

  useEffect(() => {
    const isRunningInstalled = () => window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    const standalone = isRunningInstalled()
    setIsInstalled(standalone)
    if (standalone && navigator.onLine !== false) void downloadOfflineQuran().catch(() => undefined)
    setIsIos(
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    )
    setIsEmbedded(window.top !== window.self)

    const refreshInstallPrompt = () => setInstallPrompt(getDeferredInstallPrompt())
    const handleInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      void downloadOfflineQuran().catch(() => undefined)
    }
    const handleOnline = () => {
      if (isRunningInstalled()) void downloadOfflineQuran().catch(() => undefined)
    }
    refreshInstallPrompt()
    window.addEventListener(APP_INSTALL_PROMPT_CHANGE_EVENT, refreshInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)
    window.addEventListener("online", handleOnline)
    return () => {
      window.removeEventListener(APP_INSTALL_PROMPT_CHANGE_EVENT, refreshInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
      window.removeEventListener("online", handleOnline)
    }
  }, [])

  const selectedDownloadReciter = useMemo(
    () => downloadReciters.find((item) => item.id === downloadReciter) ?? downloadReciters[0],
    [downloadReciter, downloadReciters],
  )
  const filteredDownloadReciters = useMemo(() => {
    const normalizedQuery = normalizeReciterSearch(downloadReciterQuery)
    if (!normalizedQuery) return downloadReciters
    return downloadReciters.filter((item) =>
      normalizeReciterSearch(item.name).includes(normalizedQuery),
    )
  }, [downloadReciterQuery, downloadReciters])
  const downloadedForSelectedReciter = useMemo(
    () => new Map(
      entries
        .filter((entry) => entry.reciter === downloadReciter)
        .map((entry) => [entry.chapterId, entry]),
    ),
    [downloadReciter, entries],
  )
  const filteredChapters = useMemo(() => {
    const normalized = query.trim().replace(/[\u064B-\u065F\u0670]/g, "")
    if (!normalized) return chapters
    return chapters.filter((chapter) =>
      chapter.name.replace(/[\u064B-\u065F\u0670]/g, "").includes(normalized) ||
      String(chapter.id) === normalized,
    )
  }, [chapters, query])
  const offlineMissingUrlSet = useMemo(
    () => new Set(offlineMissingFiles.map((file) => file.audioUrl)),
    [offlineMissingFiles],
  )
  const downloadedSize = useMemo(() => {
    const files = new Map<string, number>()
    for (const entry of entries) {
      for (const file of getOfflineSurahFiles(entry)) files.set(file.audioUrl, file.fileSize)
    }
    for (const rangePackage of rangePackages) {
      for (const file of rangePackage.files) files.set(file.audioUrl, file.fileSize)
    }
    return [...files.values()].reduce((total, size) => total + size, 0)
  }, [entries, rangePackages])

  const requestChapterDownload = async (chapter: Chapter, targetReciter: DownloadReciter, signal?: AbortSignal) => {
    const pages = getOfflineRecitationPages(chapter.id)
    const chapterMeta = getSurahMeta(chapter.id as Surah)
    const query = new URLSearchParams({
      reciter: String(targetReciter.id),
      startPage: String(pages[0]),
      endPage: String(pages.at(-1)),
      startVerseKey: `${chapter.id}:1`,
      endVerseKey: `${chapter.id}:${chapterMeta.ayahCount}`,
    })
    const response = await fetch(`/api/quran/offline-range?${query}`, { signal })
    const descriptor = await response.json() as {
      fileMode?: OfflineRangePackage["fileMode"]
      files?: OfflineRangePackage["files"]
      totalSize?: number
      error?: string
    }
    if (!response.ok || !descriptor.files?.length || !descriptor.fileMode) {
      throw new Error(descriptor.error || "تعذر تجهيز ملفات السورة")
    }
    return {
      chapter,
      chapterName: chapter.name,
      reciter: targetReciter.id,
      reciterName: targetReciter.name,
      fileMode: descriptor.fileMode,
      files: descriptor.files,
      totalSize: descriptor.totalSize ?? descriptor.files.reduce((total, file) => total + file.fileSize, 0),
    } satisfies PendingDownload
  }

  const cacheChapterDownload = async (
    descriptor: PendingDownload,
    signal: AbortSignal,
    onProgress?: (completed: number, total: number) => void,
  ) => {
    const cache = await window.caches.open(OFFLINE_AUDIO_CACHE)
    let completed = 0
    for (const file of descriptor.files) {
      if (!await cache.match(file.audioUrl)) {
        const response = await fetch(file.audioUrl, { mode: "cors", signal })
        if (!response.ok) throw new Error(`تعذر تنزيل ${file.label}`)
        await cache.put(file.audioUrl, response)
      }
      completed += 1
      onProgress?.(completed, descriptor.files.length)
    }
    await cacheOfflineRecitationMetadata({
      chapterId: descriptor.chapter.id,
      reciter: descriptor.reciter,
      audioUrls: descriptor.files.map((file) => file.audioUrl),
      signal,
    })
  }

  const prepareDownload = async (chapter: Chapter) => {
    if (!("caches" in window)) {
      toast.error("التنزيل دون اتصال غير مدعوم في هذا المتصفح")
      return
    }
    setPreparingChapter(chapter.id)
    try {
      const targetReciter = selectedDownloadReciter
      if (!targetReciter) throw new Error("القارئ المحدد غير متاح")
      setPendingDownload(await requestChapterDownload(chapter, targetReciter))
    } catch (error) {
      toast.error((error as Error).message || "تعذر معرفة حجم ملفات السورة الآن")
    } finally {
      setPreparingChapter(null)
    }
  }

  const downloadChapter = async () => {
    if (!pendingDownload) return
    const descriptor = pendingDownload
    const chapter = descriptor.chapter
    const controller = new AbortController()
    downloadControllerRef.current = controller
    setPendingDownload(null)
    setDownloadingChapter(chapter.id)
    setDownloadProgress(0)

    try {
      await navigator.storage?.persist?.()
      const estimate = await navigator.storage?.estimate?.()
      const remainingStorage = (estimate?.quota ?? 0) - (estimate?.usage ?? 0)
      if (descriptor.totalSize > 0 && estimate?.quota && remainingStorage < descriptor.totalSize) {
        throw new Error("INSUFFICIENT_STORAGE")
      }

      const existingEntry = entries.find((item) => item.key === `${descriptor.reciter}-${chapter.id}`)
      await cacheChapterDownload(descriptor, controller.signal, (completed, total) => {
        setDownloadProgress(Math.round((completed / total) * 100))
      })

      const retainedUrls = new Set(descriptor.files.map((file) => file.audioUrl))
      if (existingEntry) {
        const cache = await window.caches.open(OFFLINE_AUDIO_CACHE)
        await Promise.all(getOfflineSurahFiles(existingEntry).map((file) => (
          retainedUrls.has(file.audioUrl) ? false : cache.delete(file.audioUrl)
        )))
      }

      const entry: OfflineSurah = {
        key: `${descriptor.reciter}-${chapter.id}`,
        chapterId: chapter.id,
        chapterName: descriptor.chapterName,
        reciter: descriptor.reciter,
        reciterName: descriptor.reciterName,
        audioUrl: descriptor.files[0].audioUrl,
        files: descriptor.files,
        fileMode: descriptor.fileMode,
        size: descriptor.totalSize,
        qualityLabel: descriptor.fileMode === "chapters"
          ? "ملف السورة"
          : descriptor.fileMode === "pages"
            ? `${descriptor.files.length} ملفات صفحات`
            : `${descriptor.files.length} ملفات آيات`,
      }
      persistEntries([entry, ...entries.filter((item) => item.key !== entry.key)])
      await refreshStorage()
      toast.success(`تم تنزيل سورة ${entry.chapterName}`)
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error(
          (error as Error).message === "INSUFFICIENT_STORAGE"
            ? "المساحة المتاحة لا تكفي لتنزيل هذه السورة"
            : "تعذر تنزيل السورة. تحقق من المساحة والاتصال.",
        )
      }
    } finally {
      downloadControllerRef.current = null
      setDownloadingChapter(null)
      setDownloadProgress(0)
    }
  }

  const downloadSelectedChapters = async () => {
    const targetReciter = selectedDownloadReciter
    const selectedChapters = chapters.filter((chapter) =>
      selectedChapterIds.includes(chapter.id) && !downloadedForSelectedReciter.has(chapter.id))
    if (!targetReciter || selectedChapters.length === 0) {
      toast.info("حدد سورة واحدة على الأقل للتنزيل")
      return
    }
    if (!("caches" in window)) {
      toast.error("التنزيل دون اتصال غير مدعوم في هذا المتصفح")
      return
    }

    const controller = new AbortController()
    downloadControllerRef.current = controller
    setBulkDownloading(true)
    setBulkDownloadProgress(0)
    let failed = 0
    let nextEntries = loadOfflineEntries()

    try {
      await navigator.storage?.persist?.()
      const cache = await window.caches.open(OFFLINE_AUDIO_CACHE)
      for (let index = 0; index < selectedChapters.length; index += 1) {
        const chapter = selectedChapters[index]
        setBulkDownloadLabel(`سورة ${chapter.name} · ${index + 1} من ${selectedChapters.length}`)
        try {
          const descriptor = await requestChapterDownload(chapter, targetReciter, controller.signal)
          const estimate = await navigator.storage?.estimate?.()
          const availableStorage = (estimate?.quota ?? 0) - (estimate?.usage ?? 0)
          if (estimate?.quota && descriptor.totalSize > 0 && availableStorage < descriptor.totalSize) {
            throw new Error("INSUFFICIENT_STORAGE")
          }

          const existingEntry = nextEntries.find((item) =>
            item.reciter === targetReciter.id && item.chapterId === chapter.id)
          await cacheChapterDownload(descriptor, controller.signal, (completed, total) => {
            const fileProgress = completed / total
            setBulkDownloadProgress(Math.round(((index + fileProgress) / selectedChapters.length) * 100))
          })
          if (existingEntry) {
            const retainedUrls = new Set(descriptor.files.map((file) => file.audioUrl))
            await Promise.all(getOfflineSurahFiles(existingEntry).map((file) => (
              retainedUrls.has(file.audioUrl) ? false : cache.delete(file.audioUrl)
            )))
          }

          const entry: OfflineSurah = {
            key: `${targetReciter.id}-${chapter.id}`,
            chapterId: chapter.id,
            chapterName: descriptor.chapterName,
            reciter: targetReciter.id,
            reciterName: targetReciter.name,
            audioUrl: descriptor.files[0].audioUrl,
            files: descriptor.files,
            fileMode: descriptor.fileMode,
            size: descriptor.totalSize,
            qualityLabel: descriptor.fileMode === "chapters"
              ? "ملف السورة"
              : descriptor.fileMode === "pages"
                ? `${descriptor.files.length} ملفات صفحات`
                : `${descriptor.files.length} ملفات آيات`,
          }
          nextEntries = [entry, ...nextEntries.filter((item) => item.key !== entry.key)]
          window.localStorage.setItem(OFFLINE_SURAH_STORAGE_KEY, JSON.stringify(nextEntries))
          setEntries([...nextEntries])
          setSelectedChapterIds((current) => current.filter((id) => id !== chapter.id))
        } catch (error) {
          if ((error as Error).name === "AbortError") throw error
          if ((error as Error).message === "INSUFFICIENT_STORAGE") throw error
          failed += 1
        }
        setBulkDownloadProgress(Math.round(((index + 1) / selectedChapters.length) * 100))
      }
      await refreshStorage()
      if (failed > 0) toast.error(`اكتمل التنزيل مع تعذر ${failed} سورة`)
      else toast.success(`تم تنزيل ${selectedChapters.length} سورة بصوت ${targetReciter.name}`)
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error((error as Error).message === "INSUFFICIENT_STORAGE"
          ? "المساحة المتاحة لا تكفي لإكمال السور المحددة"
          : "تعذر إكمال تنزيل السور")
      }
    } finally {
      downloadControllerRef.current = null
      setBulkDownloading(false)
      setBulkDownloadProgress(0)
      setBulkDownloadLabel("")
    }
  }

  const deleteEntry = async (entry: OfflineSurah) => {
    const cache = await window.caches.open(OFFLINE_AUDIO_CACHE)
    const referencedUrls = new Set(rangePackages.flatMap((rangePackage) =>
      rangePackage.files.map((file) => file.audioUrl)))
    await Promise.all(getOfflineSurahFiles(entry).map((file) => (
      referencedUrls.has(file.audioUrl) ? false : cache.delete(file.audioUrl)
    )))
    persistEntries(entries.filter((item) => item.key !== entry.key))
    await refreshStorage()
    toast.success(`تم حذف سورة ${entry.chapterName}`)
  }

  const deleteRangePackage = async (target: OfflineRangePackage) => {
    const remainingPackages = rangePackages.filter((item) => item.key !== target.key)
    const retainedUrls = new Set([
      ...entries.flatMap((entry) => getOfflineSurahFiles(entry).map((file) => file.audioUrl)),
      ...remainingPackages.flatMap((rangePackage) => rangePackage.files.map((file) => file.audioUrl)),
    ])
    const cache = await window.caches.open(OFFLINE_AUDIO_CACHE)
    await Promise.all(
      target.files.map((file) => retainedUrls.has(file.audioUrl) ? false : cache.delete(file.audioUrl)),
    )
    setRangePackages(remainingPackages)
    saveOfflineRangePackages(remainingPackages)
    await refreshStorage()
    toast.success("تم حذف نطاق الجلسة المحفوظ")
  }

  const repairOfflineFiles = async () => {
    if (offlineMissingFiles.length === 0 || repairingOffline) return
    setRepairingOffline(true)
    setRepairProgress(0)
    try {
      await navigator.storage?.persist?.()
      const estimate = await navigator.storage?.estimate?.()
      const requiredSize = offlineMissingFiles.reduce((total, file) => total + file.fileSize, 0)
      const availableSize = (estimate?.quota ?? 0) - (estimate?.usage ?? 0)
      if (estimate?.quota && requiredSize > 0 && availableSize < requiredSize) {
        throw new Error("المساحة المتاحة لا تكفي لإكمال الملفات الناقصة")
      }
      const cache = await window.caches.open(OFFLINE_AUDIO_CACHE)
      for (let index = 0; index < offlineMissingFiles.length; index += 1) {
        const file = offlineMissingFiles[index]
        const response = await fetch(file.audioUrl, { mode: "cors" })
        if (!response.ok) throw new Error(`تعذر تنزيل ${file.label}`)
        await cache.put(file.audioUrl, response)
        setRepairProgress(Math.round(((index + 1) / offlineMissingFiles.length) * 100))
      }
      setOfflineFileCount((current) => ({ ...current, cached: current.total }))
      setOfflineMissingFiles([])
      await refreshStorage()
      toast.success("اكتملت ملفات التلاوة الناقصة")
    } catch (error) {
      toast.error((error as Error).message || "تعذر إكمال الملفات الناقصة")
    } finally {
      setRepairingOffline(false)
      setRepairProgress(0)
    }
  }

  const installApp = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    const choice = await installPrompt.userChoice
    clearDeferredInstallPrompt()
    if (choice.outcome === "accepted") void downloadOfflineQuran().catch(() => undefined)
  }

  const downloadCompleteQuran = async () => {
    if (!("caches" in window)) {
      toast.error("التنزيل دون اتصال غير مدعوم في هذا المتصفح")
      return
    }
    try {
      const status = await downloadOfflineQuran()
      if (status.failed > 0) {
        toast.error(`تعذر تنزيل ${status.failed} ملف. يمكنك الاستكمال لاحقًا.`)
      } else {
        toast.success("أصبح المصحف النصي كاملًا متاحًا دون اتصال")
      }
    } catch (error) {
      toast.error((error as Error).message === "OFFLINE"
        ? "اتصل بالإنترنت أولًا لتنزيل المصحف النصي"
        : "تعذر بدء تنزيل المصحف النصي")
    }
  }

  const prepareCompleteOfflineMutashabihat = async () => {
    setPreparingOfflineMutashabihat(true)
    try {
      if (offlineQuranStatus.pagesCompleted < offlineQuranStatus.pagesTotal) {
        const quranStatus = await downloadOfflineQuran()
        setOfflineQuranStatus(quranStatus)
        if (quranStatus.pagesCompleted < quranStatus.pagesTotal) {
          throw new Error("تعذر إكمال المصحف النصي المطلوب للمتشابهات")
        }
      }
      const status = await prepareOfflineMutashabihat()
      setOfflineMutashabihatStatus(status)
      if (status.ready) toast.success("أصبحت المتشابهات متاحة دون اتصال")
      else toast.error("تعذر فهرسة جميع الآيات. استكمل تنزيل المصحف ثم أعد المحاولة.")
    } catch (error) {
      toast.error((error as Error).message || "تعذر إعداد المتشابهات دون اتصال")
    } finally {
      setPreparingOfflineMutashabihat(false)
    }
  }

  const downloadCompleteTafsir = async () => {
    try {
      const status = await downloadOfflineTafsir()
      setOfflineTafsirStatus(status)
      await refreshStorage()
      if (status.failed > 0) toast.error(`تعذر تنزيل ${status.failed} سورة من التفسير. يمكنك الاستكمال لاحقًا.`)
      else toast.success("أصبح تفسير السعدي متاحًا دون إنترنت")
    } catch (error) {
      toast.error((error as Error).message === "OFFLINE" ? "اتصل بالإنترنت لتنزيل التفسير" : "تعذر تنزيل تفسير السعدي")
    }
  }

  const confirmTafsirDeletion = async () => {
    await deleteOfflineTafsir()
    setPendingTafsirDeletion(false)
    setOfflineTafsirStatus({ completed: 0, total: 114, running: false, failed: 0 })
    await refreshStorage()
    toast.success("تم حذف تفسير السعدي المحفوظ")
  }

  const exportBackup = () => {
    const backup = createWirdBackup(window.localStorage)
    setLastBackupAt(markWirdBackupCreated(window.localStorage, backup.exportedAt))
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `wird-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success("تم إنشاء النسخة الاحتياطية")
  }

  const selectBackup = async (file: File | undefined) => {
    if (!file) return
    try {
      setPendingBackup(parseWirdBackup(await file.text()))
    } catch (error) {
      toast.error((error as Error).message || "تعذر قراءة النسخة الاحتياطية")
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = ""
    }
  }

  const confirmBackupRestore = () => {
    if (!pendingBackup) return
    restoreWirdBackup(window.localStorage, pendingBackup)
    markWirdBackupCreated(window.localStorage, pendingBackup.exportedAt)
    setPendingBackup(null)
    window.location.reload()
  }

  const bookmarkCategoryNameExists = (name: string, excludedId?: string) => {
    const normalizedName = name.trim().toLocaleLowerCase("ar")
    return bookmarkCategories.some((category) =>
      category.id !== excludedId && category.label.toLocaleLowerCase("ar") === normalizedName,
    )
  }

  const renameBookmarkCategory = (category: BookmarkCategory) => {
    const nextLabel = (bookmarkCategoryNames[category.id] ?? "").trim()
    if (!nextLabel) {
      toast.error("اكتب اسمًا للقسم")
      return
    }
    if (bookmarkCategoryNameExists(nextLabel, category.id)) {
      toast.error("يوجد قسم بهذا الاسم")
      return
    }
    if (nextLabel === category.label) {
      setEditingBookmarkCategoryId(null)
      return
    }
    onBookmarkCategoriesChange(bookmarkCategories.map((item) =>
      item.id === category.id ? { ...item, label: nextLabel } : item,
    ))
    setBookmarkCategoryNames((current) => ({ ...current, [category.id]: nextLabel }))
    setEditingBookmarkCategoryId(null)
    toast.success("تم تعديل اسم القسم")
  }

  const cancelBookmarkCategoryRename = (category: BookmarkCategory) => {
    setBookmarkCategoryNames((current) => ({ ...current, [category.id]: category.label }))
    setEditingBookmarkCategoryId(null)
  }

  const addBookmarkCategory = () => {
    const label = newBookmarkCategoryName.trim()
    if (!label) {
      toast.error("اكتب اسمًا للقسم")
      return
    }
    if (bookmarkCategories.length >= MAX_BOOKMARK_CATEGORIES) {
      toast.error(`الحد الأقصى ${MAX_BOOKMARK_CATEGORIES} قسمًا`)
      return
    }
    if (bookmarkCategoryNameExists(label)) {
      toast.error("يوجد قسم بهذا الاسم")
      return
    }
    const category = { id: createBookmarkCategoryId(), label }
    onBookmarkCategoriesChange([...bookmarkCategories, category])
    setBookmarkCategoryNames((current) => ({ ...current, [category.id]: category.label }))
    setNewBookmarkCategoryName("")
    toast.success("تمت إضافة القسم")
  }

  const confirmBookmarkCategoryDeletion = () => {
    if (!pendingCategoryDeletion) return
    const category = pendingCategoryDeletion
    onBookmarkCategoriesChange(bookmarkCategories.filter((item) => item.id !== category.id))
    setBookmarkCategoryNames((current) => {
      const next = { ...current }
      delete next[category.id]
      return next
    })
    if (editingBookmarkCategoryId === category.id) setEditingBookmarkCategoryId(null)
    setPendingCategoryDeletion(null)
    toast.success(`تم حذف قسم ${category.label}`)
  }

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex h-full w-full flex-col gap-0 p-0 text-right sm:max-w-md"
        dir={direction}
      >
        <SheetHeader className="flex flex-row items-start justify-between gap-4 border-b px-5 py-4 text-right">
          <div className="min-w-0 space-y-1 text-right">
            <SheetTitle>إعدادات وِردي</SheetTitle>
            <SheetDescription>المظهر والقراءة والعلامات والتخزين دون اتصال</SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label="إغلاق الإعدادات"
            onClick={() => onOpenChange(false)}
          >
            <X />
          </Button>
        </SheetHeader>

        <Tabs defaultValue={initialTab} className="flex min-h-0 flex-1 flex-col gap-0 text-right" dir={direction}>
          <TabsList className="grid h-14 min-h-14 w-full grid-cols-4 gap-0 rounded-none border-b bg-muted/20 p-0" dir={direction} data-settings-tabs>
            {([
              ["reading", "القراءة", BookOpen],
              ["bookmarks", "العلامات", Bookmark],
              ["downloads", "التنزيلات", Download],
              ["install", "التطبيق", Smartphone],
            ] as const).map(([value, label, Icon]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="group relative h-14 min-h-14 min-w-0 max-h-14 flex-col gap-0.5 rounded-none border-0 bg-transparent px-1 py-1.5 text-[11px] font-semibold text-muted-foreground shadow-none data-[state=active]:bg-background/75 data-[state=active]:text-primary data-[state=active]:shadow-none sm:text-xs"
              >
                <Icon className="size-[17px] shrink-0" aria-hidden="true" />
                <span className="leading-4">{label}</span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-transparent group-data-[state=active]:bg-primary"
                  data-settings-tab-indicator
                />
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="reading" className="space-y-5 overflow-y-auto px-5 py-5" data-settings-content="reading">
            <section className="space-y-2 border-b pb-5" data-language-settings>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Languages className="size-[17px] text-primary" aria-hidden="true" />
                <span>لغة الواجهة</span>
              </div>
              <ToggleGroup
                type="single"
                value={language}
                onValueChange={(value) => value && setLanguage(value as "ar" | "en")}
                variant="outline"
                className="grid h-10 w-full grid-cols-2 gap-0"
                aria-label="اختر لغة واجهة التطبيق"
                data-language-control
              >
                <ToggleGroupItem value="ar" className="h-10 min-w-0 rounded-e-none text-sm font-semibold" data-language-option="ar">
                  <span data-no-interface-translation>العربية</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="en" className="h-10 min-w-0 rounded-s-none text-sm font-semibold" data-language-option="en">
                  <span data-no-interface-translation>English</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </section>

            <Accordion type="multiple" defaultValue={["display"]} className="border-y">
              <AccordionItem value="display">
                <AccordionTrigger className="py-3.5 text-right hover:no-underline">
                  <span className="flex items-center gap-2 font-bold"><BookOpen className="size-4 text-primary" />عرض المصحف</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-5">
            <div className="space-y-2">
              <Label>نوع القراءة</Label>
              <ToggleGroup
                type="single"
                value={viewMode === "image" ? "image" : readingMode === "large" ? "large" : "page"}
                onValueChange={(value) => {
                  if (value === "image") {
                    onViewModeChange("image")
                    return
                  }
                  if (value === "page") {
                    onViewModeChange("text")
                    onReadingModeChange("page")
                    return
                  }
                  if (value === "large") {
                    onViewModeChange("text")
                    onReadingModeChange("large")
                  }
                }}
                variant="outline"
                className="grid w-full grid-cols-3"
                aria-label="نوع قراءة المصحف"
              >
                <ToggleGroupItem value="image" className="h-auto min-h-16 min-w-0 flex-col gap-1 px-1 text-xs">
                  <ImageIcon />
                  <span>صورة المصحف</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="page" className="h-auto min-h-16 min-w-0 flex-col gap-1 px-1 text-xs">
                  <BookOpen />
                  <span>مصحف نصي</span>
                  <small className="text-[10px] text-muted-foreground">صفحة كاملة</small>
                </ToggleGroupItem>
                <ToggleGroupItem value="large" className="h-auto min-h-16 min-w-0 flex-col gap-1 px-1 text-xs">
                  <Accessibility />
                  <span>قراءة مكبرة</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="space-y-2 border-y py-4">
              <div className="space-y-2 pt-1">
                <Label>نمط الإضاءة</Label>
                <ToggleGroup
                  type="single"
                  value={theme ?? "system"}
                  onValueChange={(value) => value && setTheme(value)}
                  variant="outline"
                  className="grid w-full grid-cols-3"
                >
                  <ToggleGroupItem value="system">
                    <Monitor />
                    تلقائي
                  </ToggleGroupItem>
                  <ToggleGroupItem value="light">
                    <Sun />
                    نهاري
                  </ToggleGroupItem>
                  <ToggleGroupItem value="dark">
                    <Moon />
                    ليلي
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {viewMode === "text" && (readingMode === "page" || readingMode === "large") && (
              <div className="space-y-3 border-y py-4">
                <Label>{readingMode === "large" ? "تباعد أسطر القراءة المكبرة" : "تباعد أسطر الصفحة الكاملة"}</Label>
                <ToggleGroup
                  type="single"
                  value={lineSpacing}
                  onValueChange={(value) => value && onLineSpacingChange(value as LineSpacing)}
                  variant="outline"
                  className="grid grid-cols-3"
                  aria-label={readingMode === "large" ? "تباعد أسطر القراءة المكبرة" : "تباعد أسطر الصفحة الكاملة"}
                >
                  <ToggleGroupItem value="normal">{readingMode === "large" ? "عادي" : "أصلي"}</ToggleGroupItem>
                  <ToggleGroupItem value="comfortable">{readingMode === "large" ? "مريح" : "متوسط"}</ToggleGroupItem>
                  <ToggleGroupItem value="spacious">{readingMode === "large" ? "واسع" : "ملء الصفحة"}</ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}

            {viewMode === "text" && readingMode === "large" && (
              <div className="space-y-3 border-y py-4">
                <div className="flex items-center justify-between gap-3">
                  <Label>حجم خط الآيات في القراءة المكبرة</Label>
                  <span className="text-sm font-semibold tabular-nums">{largeTextSize}px</span>
                </div>
                <Slider
                  value={[largeTextSize]}
                  min={28}
                  max={52}
                  step={2}
                  onValueChange={(value) => onLargeTextSizeChange(value[0])}
                  aria-label="حجم خط الآيات في القراءة المكبرة"
                />
              </div>
            )}

                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="playback">
                <AccordionTrigger className="py-3.5 text-right hover:no-underline">
                  <span className="flex items-center gap-2 font-bold"><Headphones className="size-4 text-primary" />التشغيل والمتابعة</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Eye className="size-4 text-primary" />
                  طريقة كشف الآيات مع القارئ
                </Label>
                <ToggleGroup
                  type="single"
                  value={audioReviewRevealMode}
                  onValueChange={(value) => {
                    if (value) onAudioReviewRevealModeChange(value as AudioReviewRevealMode)
                  }}
                  variant="outline"
                  className="grid grid-cols-2"
                  aria-label="طريقة كشف الآيات مع القارئ"
                >
                  <ToggleGroupItem value="progressive">تدريجي</ToggleGroupItem>
                  <ToggleGroupItem value="verse">الآية كاملة</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="auto-scroll">التمرير إلى الآية الحالية</Label>
                <Switch
                  id="auto-scroll"
                  dir="ltr"
                  checked={autoScroll}
                  onCheckedChange={onAutoScrollChange}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="center-tap-fullscreen">ملء الشاشة عند النقر في المنتصف</Label>
                <Switch
                  id="center-tap-fullscreen"
                  dir="ltr"
                  checked={centerTapFullscreen}
                  onCheckedChange={onCenterTapFullscreenChange}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="search-swipe-gesture">فتح البحث وشريط التنقل بالسحب</Label>
                  <Switch
                    id="search-swipe-gesture"
                    dir="ltr"
                    checked={searchGestureEnabled}
                    onCheckedChange={onSearchGestureEnabledChange}
                  />
                </div>
                {searchGestureEnabled && (
                  <ToggleGroup
                    type="single"
                    value={searchGestureDirection}
                    onValueChange={(value) => {
                      if (value) onSearchGestureDirectionChange(value as SearchGestureDirection)
                    }}
                    variant="outline"
                    className="grid grid-cols-2"
                    aria-label="اتجاه سحب فتح البحث والمساطر"
                  >
                    <ToggleGroupItem value="down">من أعلى لأسفل</ToggleGroupItem>
                    <ToggleGroupItem value="up">من أسفل لأعلى</ToggleGroupItem>
                  </ToggleGroup>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="screen-rotation-lock">قفل اتجاه الشاشة</Label>
                <Switch
                  id="screen-rotation-lock"
                  dir="ltr"
                  checked={screenRotationLocked}
                  onCheckedChange={onScreenRotationLockedChange}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="keep-screen-awake">إبقاء الشاشة مستيقظة</Label>
                <Switch
                  id="keep-screen-awake"
                  dir="ltr"
                  checked={keepScreenAwake}
                  disabled={!wakeLockSupported}
                  onCheckedChange={onKeepScreenAwakeChange}
                />
              </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="accessibility">
                <AccordionTrigger className="py-3.5 text-right hover:no-underline">
                  <span className="flex items-center gap-2 font-bold"><Accessibility className="size-4 text-primary" />إمكانية الوصول</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
              <Label className="flex items-center gap-2 text-sm font-bold">
                <Accessibility className="size-4 text-primary" />
                خيارات العرض المبسط
              </Label>
              {([
                ["high-contrast", "تباين عالٍ", highContrast, onHighContrastChange],
                ["large-controls", "أزرار أكبر", largeControls, onLargeControlsChange],
                ["simple-player", "شريط تشغيل مبسط", simplifiedPlayer, onSimplifiedPlayerChange],
                ["speech-labels", "قراءة الأزرار وأسماء السور", speechLabels, onSpeechLabelsChange],
              ] as const).map(([id, label, checked, onChange]) => (
                <div key={id} className="flex items-center justify-between gap-4">
                  <Label htmlFor={id}>{label}</Label>
                  <Switch id={id} dir="ltr" checked={checked} onCheckedChange={onChange} />
                </div>
              ))}
              <div className="space-y-2">
                <Label>حجم خط الواجهة</Label>
                <ToggleGroup
                  type="single"
                  value={appTextScale}
                  onValueChange={(value) => {
                    if (value) onAppTextScaleChange(value as AppTextScale)
                  }}
                  variant="outline"
                  className="grid grid-cols-3"
                  aria-label="حجم خط الواجهة"
                >
                  <ToggleGroupItem value="normal">عادي</ToggleGroupItem>
                  <ToggleGroupItem value="large">كبير</ToggleGroupItem>
                  <ToggleGroupItem value="xlarge">أكبر</ToggleGroupItem>
                </ToggleGroup>
              </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="colors">
                <AccordionTrigger className="py-3.5 text-right hover:no-underline">
                  <span className="flex items-center gap-2 font-bold"><Palette className="size-4 text-primary" />الألوان</span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Palette className="size-3.5 text-primary" />
                لون التطبيق
              </Label>
              <RadioGroup
                value={palette}
                onValueChange={(value) => setPalette(value as AppPalette)}
                className="flex flex-wrap items-center gap-2"
                aria-label="لون التطبيق"
              >
                {APP_PALETTES.map((option) => (
                  <Label
                    key={option.id}
                    htmlFor={`palette-${option.id}`}
                    title={option.label}
                    data-palette-option={option.id}
                    className={cn(
                      "grid size-9 cursor-pointer place-items-center rounded-full border p-1 transition-colors hover:bg-accent/40",
                      palette === option.id && "border-primary bg-primary/5 text-primary ring-1 ring-primary/25",
                    )}
                  >
                    <RadioGroupItem
                      id={`palette-${option.id}`}
                      value={option.id}
                      className="sr-only"
                      aria-label={option.label}
                    />
                    {option.id === "custom" ? (
                      <Paintbrush className="size-4" aria-hidden="true" />
                    ) : (
                      <span className="flex overflow-hidden rounded-full border" aria-hidden="true">
                        {option.swatches.map((swatch) => (
                          <span key={swatch} className={cn("size-2.5", swatch)} />
                        ))}
                      </span>
                    )}
                  </Label>
                ))}
              </RadioGroup>
              {palette === "custom" && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {([
                    ["primary", "الأساسي"],
                    ["accent", "المساند"],
                    ["background", "الخلفية"],
                  ] as const).map(([key, label]) => (
                    <Label key={key} className="flex items-center gap-1.5 text-[11px]">
                      <Input
                        type="color"
                        value={customPalette[key]}
                        onChange={(event) => setCustomPalette({ ...customPalette, [key]: event.target.value })}
                        className="size-7 cursor-pointer p-0.5"
                        aria-label={`لون ${label}`}
                      />
                      <span>{label}</span>
                    </Label>
                  ))}
                </div>
              )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onViewModeChange("image")
                onReadingModeChange("page")
                onLineSpacingChange("comfortable")
                onLargeTextSizeChange(36)
                onAudioReviewRevealModeChange("progressive")
                onAutoScrollChange(true)
                onSearchGestureEnabledChange(false)
                onSearchGestureDirectionChange("up")
                onScreenRotationLockedChange(false)
                onKeepScreenAwakeChange(false)
                onHighContrastChange(false)
                onLargeControlsChange(false)
                onAppTextScaleChange("normal")
                onSimplifiedPlayerChange(false)
                onSpeechLabelsChange(false)
              }}
            >
              استعادة إعدادات القراءة
            </Button>
          </TabsContent>

          <TabsContent value="bookmarks" className="min-h-0 overflow-y-auto px-5 py-5" data-bookmark-settings>
            <div className="flex items-center justify-between gap-3 pb-4">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Bookmark className="size-4 text-primary" aria-hidden="true" />
                  أقسام العلامات
                </h2>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {bookmarkCategories.length}/{MAX_BOOKMARK_CATEGORIES}
              </span>
            </div>

            <div className="grid grid-cols-2 divide-x divide-x-reverse border-y" aria-label="ملخص العلامات">
              <div className="px-3 py-3 text-center">
                <span className="block text-lg font-bold tabular-nums text-foreground">{bookmarkCountTotal}</span>
                <span className="block text-[11px] text-muted-foreground">علامة مصنفة</span>
              </div>
              <div className="px-3 py-3 text-center">
                <span className="block text-lg font-bold tabular-nums text-foreground">{bookmarkCategories.length}</span>
                <span className="block text-[11px] text-muted-foreground">قسم</span>
              </div>
            </div>

            <div className="space-y-2 border-b py-4">
              <Label htmlFor="new-bookmark-category" className="text-xs font-semibold">قسم جديد</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="new-bookmark-category"
                  value={newBookmarkCategoryName}
                  maxLength={MAX_BOOKMARK_CATEGORY_LABEL_LENGTH}
                  placeholder="اسم القسم"
                  className="h-10"
                  onChange={(event) => setNewBookmarkCategoryName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addBookmarkCategory()
                  }}
                />
                <Button
                  className="h-10 shrink-0 px-3"
                  disabled={!newBookmarkCategoryName.trim() || bookmarkCategories.length >= MAX_BOOKMARK_CATEGORIES}
                  aria-label="إضافة قسم علامات"
                  onClick={addBookmarkCategory}
                >
                  <Plus />
                  إضافة
                </Button>
              </div>
            </div>

            <div className="pt-4">
              <Label className="mb-2 block text-xs font-semibold">الأقسام</Label>
              <div className="divide-y border-y" data-bookmark-category-list>
                {bookmarkCategories.length === 0 ? (
                  <div className="grid min-h-28 place-items-center gap-2 px-2 py-6 text-center text-sm text-muted-foreground">
                    <Bookmark className="size-5" aria-hidden="true" />
                    <span>لا توجد أقسام مضافة</span>
                  </div>
                ) : bookmarkCategories.map((category) => {
                  const draftName = bookmarkCategoryNames[category.id] ?? category.label
                  const categoryCount = bookmarkCategoryCounts[category.id] ?? 0
                  const canSave = Boolean(draftName.trim()) && draftName.trim() !== category.label
                  const editing = editingBookmarkCategoryId === category.id
                  return (
                    <div key={category.id} className="py-2.5" data-bookmark-category={category.id}>
                      {editing ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={draftName}
                            maxLength={MAX_BOOKMARK_CATEGORY_LABEL_LENGTH}
                            className="h-9 min-w-0 flex-1"
                            aria-label={`اسم قسم ${category.label}`}
                            autoFocus
                            onChange={(event) => setBookmarkCategoryNames((current) => ({
                              ...current,
                              [category.id]: event.target.value,
                            }))}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") renameBookmarkCategory(category)
                              if (event.key === "Escape") cancelBookmarkCategoryRename(category)
                            }}
                          />
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="size-9 shrink-0"
                            disabled={!canSave}
                            aria-label={`حفظ اسم قسم ${category.label}`}
                            onClick={() => renameBookmarkCategory(category)}
                          >
                            <Check />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-9 shrink-0"
                            aria-label={`إلغاء تعديل قسم ${category.label}`}
                            onClick={() => cancelBookmarkCategoryRename(category)}
                          >
                            <X />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex min-h-11 items-center gap-2">
                          <Bookmark className="size-4 shrink-0 text-primary" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">{category.label}</span>
                            <span className="block text-[11px] tabular-nums text-muted-foreground">{categoryCount} علامة</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-9 shrink-0"
                            aria-label={`تعديل قسم ${category.label}`}
                            onClick={() => setEditingBookmarkCategoryId(category.id)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="size-9 shrink-0 text-destructive hover:text-destructive"
                            aria-label={`حذف قسم ${category.label}`}
                            onClick={() => setPendingCategoryDeletion(category)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="downloads" className="min-h-0 overflow-y-auto px-5 py-4" data-settings-content="downloads">
            <div className="mb-5 space-y-4 border-b pb-5">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="size-4" />المحتوى دون اتصال</h3>
                <p className="mt-1 text-xs text-muted-foreground">يُنزل المصحف النصي تلقائيًا في التطبيق المثبت، والمتشابهات اختيارية.</p>
              </div>
              <div className="space-y-2 border-y py-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">المصحف النصي</span>
                  <span className="tabular-nums text-muted-foreground">{offlineQuranStatus.pagesCompleted}/{offlineQuranStatus.pagesTotal}</span>
                </div>
                <Progress
                  value={offlineQuranStatus.total > 0
                    ? Math.round((offlineQuranStatus.completed / offlineQuranStatus.total) * 100)
                    : 0}
                  className="h-1.5"
                />
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>{offlineQuranStatus.running
                    ? "يُنزّل تلقائيًا في الخلفية"
                    : offlineQuranStatus.pagesCompleted === offlineQuranStatus.pagesTotal
                      ? "متاح بالكامل دون إنترنت"
                      : isInstalled
                        ? "سيُستكمل تلقائيًا عند توفر الإنترنت"
                        : "نزّله الآن أو ثبّت التطبيق للتنزيل تلقائيًا"}</span>
                  {!offlineQuranStatus.running && offlineQuranStatus.pagesCompleted < offlineQuranStatus.pagesTotal && (
                    <Button variant="ghost" size="sm" onClick={() => void downloadCompleteQuran()}><Download /> استكمال الآن</Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">المتشابهات</span>
                  <span className="tabular-nums text-muted-foreground">{offlineMutashabihatStatus.verses}/{offlineMutashabihatStatus.total}</span>
                </div>
                <Progress
                  value={Math.round((offlineMutashabihatStatus.verses / Math.max(offlineMutashabihatStatus.total, 1)) * 100)}
                  className="h-1.5"
                />
                <Button
                  className="w-full"
                  variant={offlineMutashabihatStatus.ready ? "outline" : "default"}
                  disabled={preparingOfflineMutashabihat || offlineMutashabihatStatus.ready}
                  onClick={() => void prepareCompleteOfflineMutashabihat()}
                >
                  {preparingOfflineMutashabihat ? <LoaderCircle className="animate-spin" /> : offlineMutashabihatStatus.ready ? <CheckCircle2 /> : <Download />}
                  {preparingOfflineMutashabihat ? "جاري فهرسة الآيات..." : offlineMutashabihatStatus.ready ? "المتشابهات جاهزة دون إنترنت" : "تنزيل المتشابهات"}
                </Button>
              </div>
              <div className="space-y-2 border-t pt-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">تفسير السعدي</span>
                  <span className="tabular-nums text-muted-foreground">{offlineTafsirStatus.completed}/{offlineTafsirStatus.total} سورة</span>
                </div>
                <Progress
                  value={Math.round((offlineTafsirStatus.completed / Math.max(offlineTafsirStatus.total, 1)) * 100)}
                  className="h-1.5"
                />
                {offlineTafsirStatus.completed === offlineTafsirStatus.total ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Button variant="outline" disabled><CheckCircle2 /> التفسير متاح دون إنترنت</Button>
                    <Button variant="ghost" size="icon" aria-label="حذف تفسير السعدي" onClick={() => setPendingTafsirDeletion(true)}><Trash2 /></Button>
                  </div>
                ) : (
                  <Button className="w-full" disabled={offlineTafsirStatus.running} onClick={() => void downloadCompleteTafsir()}>
                    {offlineTafsirStatus.running ? <LoaderCircle className="animate-spin" /> : <Download />}
                    {offlineTafsirStatus.running
                      ? `تنزيل التفسير ${Math.round((offlineTafsirStatus.completed / Math.max(offlineTafsirStatus.total, 1)) * 100)}%`
                      : offlineTafsirStatus.completed > 0
                        ? "استكمال تفسير السعدي"
                        : "تنزيل تفسير السعدي كاملًا"}
                  </Button>
                )}
                {offlineTafsirStatus.failed > 0 && <p className="text-xs text-destructive">تعذر تنزيل {offlineTafsirStatus.failed} سورة في المحاولة الأخيرة.</p>}
              </div>
            </div>

            <div className="mb-5 space-y-2 border-b pb-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 font-semibold"><HardDrive className="size-4" />المحفوظ</span>
                <span className="tabular-nums">{formatBytes(downloadedSize)}</span>
              </div>
              {storageQuota > 0 && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>استخدام التطبيق {formatBytes(storageUsage)}</span>
                  <span>المتاح {formatBytes(Math.max(storageQuota - storageUsage, 0))}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 border-y py-2 text-xs">
                <div><span className="block text-muted-foreground">صفحات النص</span><strong className="tabular-nums">{offlinePageCount}/604</strong></div>
                <div><span className="block text-muted-foreground">ملفات التلاوة</span><strong className="tabular-nums">{offlineFileCount.cached}/{offlineFileCount.total}</strong></div>
              </div>
              {repairingRecitationMetadata && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
                  <LoaderCircle className="size-3.5 animate-spin" />
                  جاري استكمال بيانات تشغيل التلاوات المحفوظة دون إنترنت
                </div>
              )}
              {offlineMissingFiles.length > 0 && (
                <div className="space-y-2">
                  {repairingOffline && <Progress value={repairProgress} className="h-1.5" />}
                  <Button variant="outline" size="sm" className="w-full" disabled={repairingOffline} onClick={() => void repairOfflineFiles()}>
                    {repairingOffline ? <LoaderCircle className="animate-spin" /> : <Download />}
                    {repairingOffline ? `${repairProgress}%` : `إكمال ${offlineMissingFiles.length} ملف ناقص`}
                  </Button>
                </div>
              )}
            </div>

            <div className="mb-5 space-y-3 border-b pb-5">
              <div>
                <h3 className="text-sm font-semibold">تنزيل التلاوات</h3>
                <p className="mt-1 text-xs text-muted-foreground">اختر القارئ، ثم سورة واحدة أو عدة سور.</p>
              </div>
              <div className="space-y-2">
                <Label>القارئ</Label>
                <Popover
                  open={downloadReciterOpen}
                  onOpenChange={(nextOpen) => {
                    setDownloadReciterOpen(nextOpen)
                    if (!nextOpen) setDownloadReciterQuery("")
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={downloadReciterOpen}
                      aria-label={`اختيار قارئ التنزيل، الحالي ${selectedDownloadReciter?.name ?? reciterName}`}
                      disabled={bulkDownloading || downloadingChapter !== null}
                      className="h-auto min-h-10 w-full justify-between px-3 font-normal"
                    >
                      <span className="min-w-0 text-right">
                        <span className="block truncate font-medium">{selectedDownloadReciter?.name ?? reciterName}</span>
                        {selectedDownloadReciter?.detail && (
                          <span className="block truncate text-xs text-muted-foreground">{selectedDownloadReciter.detail}</span>
                        )}
                      </span>
                      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="max-h-[min(70dvh,24rem)] w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
                    dir="rtl"
                  >
                    <Command className="max-h-[min(70dvh,24rem)]" shouldFilter={false}>
                      <CommandInput
                        value={downloadReciterQuery}
                        onValueChange={setDownloadReciterQuery}
                        placeholder="ابحث باسم القارئ..."
                      />
                      <CommandList
                        className="h-72 max-h-[min(60dvh,18rem)] touch-pan-y overscroll-contain overflow-y-auto [scrollbar-gutter:stable]"
                        data-download-reciter-list
                        onWheelCapture={(event) => event.stopPropagation()}
                        onTouchMoveCapture={(event) => event.stopPropagation()}
                      >
                        <CommandEmpty>لا يوجد قارئ بهذا الاسم</CommandEmpty>
                        {filteredDownloadReciters.map((item) => (
                          <CommandItem
                            key={item.id}
                            value={`${item.name} ${item.detail}`}
                            onSelect={() => {
                              setDownloadReciter(item.id)
                              setDownloadReciterQuery("")
                              setDownloadReciterOpen(false)
                            }}
                            className="min-h-11"
                          >
                            <Check className={cn("size-4 shrink-0 text-primary", item.id !== downloadReciter && "opacity-0")} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{item.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">تم تحديد {selectedChapterIds.length} سورة</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={bulkDownloading}
                    onClick={() => setSelectedChapterIds(chapters.filter((chapter) => !downloadedForSelectedReciter.has(chapter.id)).map((chapter) => chapter.id))}
                  >
                    تحديد الكل
                  </Button>
                  {selectedChapterIds.length > 0 && (
                    <Button variant="ghost" size="sm" disabled={bulkDownloading} onClick={() => setSelectedChapterIds([])}>إلغاء التحديد</Button>
                  )}
                </div>
              </div>
              {bulkDownloading && (
                <div className="space-y-2 border-y py-3">
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="truncate">{bulkDownloadLabel}</span><span className="tabular-nums">{bulkDownloadProgress}%</span></div>
                  <Progress value={bulkDownloadProgress} className="h-1.5" />
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => downloadControllerRef.current?.abort()}><X /> إلغاء التنزيل</Button>
                </div>
              )}
              <Button
                className="w-full"
                disabled={selectedChapterIds.length === 0 || bulkDownloading || downloadingChapter !== null}
                onClick={() => void downloadSelectedChapters()}
              >
                {bulkDownloading ? <LoaderCircle className="animate-spin" /> : <Download />}
                {selectedChapterIds.length === chapters.length && chapters.length > 0
                  ? "تنزيل المصحف كاملًا"
                  : selectedChapterIds.length > 0
                    ? `تنزيل ${selectedChapterIds.length} سورة`
                    : "تنزيل السور المحددة"}
              </Button>
              {downloadingChapter !== null && <Progress value={downloadProgress} className="h-1.5" />}
            </div>

            {rangePackages.length > 0 && (
              <div className="mb-4 border-b pb-4">
                <h3 className="mb-2 text-sm font-semibold">نطاقات الجلسات المحفوظة</h3>
                <div className="max-h-44 overflow-y-auto">
                  {rangePackages.map((rangePackage) => (
                    <div key={rangePackage.key} className="flex items-center gap-2 border-b py-2 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {rangePackage.startVerseKey} إلى {rangePackage.endVerseKey}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {rangePackage.reciterName} · {formatBytes(rangePackage.totalSize)} · {rangePackage.files.length} ملف
                          {rangePackage.files.some((file) => offlineMissingUrlSet.has(file.audioUrl))
                            ? ` · ناقص ${rangePackage.files.filter((file) => offlineMissingUrlSet.has(file.audioUrl)).length}`
                            : " · مكتمل"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          الصفحات {rangePackage.startPage}–{rangePackage.endPage}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`حذف النطاق ${rangePackage.startVerseKey} إلى ${rangePackage.endVerseKey}`}
                        onClick={() => void deleteRangePackage(rangePackage)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {entries.length > 0 && (
              <div className="mb-4 border-b pb-4">
                <h3 className="mb-2 text-sm font-semibold">السور المحفوظة</h3>
                <div className="max-h-32 overflow-y-auto">
                  {entries.map((entry) => (
                    <div key={entry.key} className="flex items-center gap-2 border-b py-2 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">سورة {entry.chapterName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.reciterName} · {formatBytes(entry.size)}
                          {entry.qualityLabel ? ` · ${entry.qualityLabel}` : ""}
                          {getOfflineSurahFiles(entry).some((file) => offlineMissingUrlSet.has(file.audioUrl))
                            ? " · ناقص"
                            : " · مكتمل"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`حذف سورة ${entry.chapterName}`}
                        onClick={() => void deleteEntry(entry)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="relative mb-3">
              <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث عن سورة..."
                className="pr-9"
              />
            </div>

            <ScrollArea className="h-80 min-h-52">
              {loadingChapters ? (
                <div className="grid h-32 place-items-center"><LoaderCircle className="animate-spin text-primary" /></div>
              ) : (
                filteredChapters.map((chapter) => {
                  const downloaded = downloadedForSelectedReciter.get(chapter.id)
                  const selected = selectedChapterIds.includes(chapter.id)
                  const isDownloading = downloadingChapter === chapter.id
                  const isPreparing = preparingChapter === chapter.id
                  return (
                    <div key={chapter.id} className="flex items-center gap-2 border-b py-2.5 last:border-0">
                      <Checkbox
                        checked={downloaded ? true : selected}
                        disabled={Boolean(downloaded) || bulkDownloading || downloadingChapter !== null}
                        aria-label={`تحديد سورة ${chapter.name}`}
                        onCheckedChange={(checked) => setSelectedChapterIds((current) =>
                          checked ? [...new Set([...current, chapter.id])] : current.filter((id) => id !== chapter.id))}
                      />
                      <span className="w-7 text-center text-xs tabular-nums text-muted-foreground">{chapter.id}</span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">سورة {chapter.name}</span>
                        {downloaded && <span className="block text-[10px] text-muted-foreground">منزلة بصوت {downloaded.reciterName}</span>}
                      </div>
                      {downloaded ? (
                        <Button variant="ghost" size="icon-sm" aria-label={`حذف سورة ${chapter.name}`} onClick={() => void deleteEntry(downloaded)}><Trash2 /></Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size={isDownloading ? "sm" : "icon-sm"}
                          aria-label={`تنزيل سورة ${chapter.name}`}
                          disabled={bulkDownloading || downloadingChapter !== null || preparingChapter !== null}
                          onClick={() => void prepareDownload(chapter)}
                        >
                          {isDownloading ? <><LoaderCircle className="animate-spin" /><span className="tabular-nums">{downloadProgress}%</span></> : isPreparing ? <LoaderCircle className="animate-spin" /> : <Download />}
                        </Button>
                      )}
                    </div>
                  )
                })
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="install" className="space-y-5 overflow-y-auto px-5 py-6" data-settings-content="install">
            <div className="flex flex-col items-center border-b pb-6 text-center">
              <div className="mb-3 grid size-14 place-items-center rounded-md bg-primary text-primary-foreground">
                {isInstalled ? <CheckCircle2 className="size-7" /> : <Smartphone className="size-7" />}
              </div>
              <h3 className="font-bold">{isInstalled ? "وِردي مثبت على الجهاز" : "تثبيت وِردي"}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {isInstalled ? "يفتح كتطبيق مستقل" : "وصول أسرع وتشغيل واجهة التطبيق دون اتصال"}
              </p>
            </div>

            {!isInstalled && isIos && (
              <div className="space-y-2 border-b pb-5 text-sm">
                <p className="font-semibold">على iPhone وiPad</p>
                <p className="text-muted-foreground">افتح التطبيق في Safari، ثم اختر مشاركة، وبعدها إضافة إلى الشاشة الرئيسية.</p>
              </div>
            )}

            {!isInstalled && !isIos && installPrompt && (
              <Button className="w-full" onClick={() => void installApp()}>
                <Download />
                تثبيت التطبيق
              </Button>
            )}

            {!isInstalled && !isIos && !installPrompt && (
              <div className="space-y-3 border-b pb-5 text-sm">
                <p className="font-semibold">{isEmbedded ? "افتح التطبيق مباشرة" : "التثبيت من المتصفح"}</p>
                <p className="leading-6 text-muted-foreground">
                  {isEmbedded
                    ? "المعاينة المضمّنة قد تمنع التثبيت. افتح التطبيق في تبويب مستقل، ثم اختر تثبيت التطبيق من قائمة المتصفح."
                    : "لا يتيح هذا المتصفح نافذة التثبيت التلقائي الآن. افتح قائمة المتصفح، ثم اختر تثبيت التطبيق أو إضافة إلى الشاشة الرئيسية."}
                </p>
                {isEmbedded && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(window.location.href, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink />
                    فتح في تبويب مستقل
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-2 border-b pb-5 text-sm text-muted-foreground">
              <p>التلاوات تعمل دون اتصال بعد تنزيل السور المطلوبة من تبويب التنزيلات.</p>
            </div>

            <div ref={backupSectionRef} className="scroll-mt-4 space-y-3" data-backup-settings>
              <div>
                <h3 className="font-semibold text-foreground">النسخ الاحتياطي</h3>
                <p className="mt-1 text-xs text-muted-foreground">العلامات والخطط والمراجعات والإعدادات، دون ملفات الصوت.</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  آخر نسخة احتياطية: <span className="font-medium text-foreground">{formatBackupDate(lastBackupAt, language)}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={exportBackup}>
                  <FileDown /> تصدير
                </Button>
                <Button variant="outline" onClick={() => backupInputRef.current?.click()}>
                  <Upload /> استعادة
                </Button>
              </div>
              <input
                ref={backupInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void selectBackup(event.target.files?.[0])}
              />
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>

    <AlertDialog
      open={Boolean(pendingDownload)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setPendingDownload(null)
      }}
    >
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right">
          <AlertDialogTitle>تنزيل سورة {pendingDownload?.chapterName}</AlertDialogTitle>
          <AlertDialogDescription>
            بصوت {pendingDownload?.reciterName}. راجع حجم ملف التلاوة قبل بدء التنزيل.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {pendingDownload && (
          <div className="space-y-3 border-y py-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>صيغة التنزيل</span>
              <span className="font-medium text-foreground">
                {pendingDownload.fileMode === "chapters"
                  ? "ملف سورة كامل"
                  : pendingDownload.fileMode === "pages"
                    ? `${pendingDownload.files.length} ملفات صفحات`
                    : `${pendingDownload.files.length} ملفات آيات`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>الحجم</span>
              <span>{formatBytes(pendingDownload.totalSize)}</span>
            </div>
            {storageQuota > 0 && (
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>المتاح</span>
                <span>{formatBytes(Math.max(storageQuota - storageUsage, 0))}</span>
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={() => void downloadChapter()}>
            <Download />
            بدء التنزيل
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={pendingTafsirDeletion} onOpenChange={setPendingTafsirDeletion}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right">
          <AlertDialogTitle>حذف تفسير السعدي؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيُحذف التفسير المحفوظ من هذا الجهاز، ويمكنك استخدامه عبر الإنترنت أو تنزيله مرة أخرى لاحقًا.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void confirmTafsirDeletion()}><Trash2 /> حذف التفسير</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={Boolean(pendingBackup)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setPendingBackup(null)
      }}
    >
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right">
          <AlertDialogTitle>استعادة نسخة وِردي</AlertDialogTitle>
          <AlertDialogDescription>
            ستستبدل النسخة البيانات المحلية الحالية. لا تشمل العملية ملفات التلاوة المنزلة.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {pendingBackup && (
          <div className="border-y py-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>عناصر البيانات</span>
              <span className="font-semibold tabular-nums">{Object.keys(pendingBackup.data).length}</span>
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={confirmBackupRestore}>
            <Upload /> استعادة البيانات
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={Boolean(pendingCategoryDeletion)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setPendingCategoryDeletion(null)
      }}
    >
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right">
          <AlertDialogTitle>حذف قسم {pendingCategoryDeletion?.label}</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingCategoryDeletion && (bookmarkCategoryCounts[pendingCategoryDeletion.id] ?? 0) > 0
              ? `ستنتقل ${bookmarkCategoryCounts[pendingCategoryDeletion.id]} علامة إلى بدون تصنيف.`
              : "سيُحذف القسم من خيارات العلامات."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirmBookmarkCategoryDeletion}>
            <Trash2 /> حذف القسم
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
