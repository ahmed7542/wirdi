"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { BookOpen, ChevronUp, Headphones, History, LoaderCircle, Mic, RefreshCw, Search, Shuffle } from "lucide-react"

import { useInterfaceLanguage } from "@/components/interface-language-provider"
import {
  QuranLocationPicker,
  SessionRangeSearchPicker,
} from "@/components/session-range-search-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { loadQuranNavigation } from "@/lib/offline-quran-navigation"
import { searchOfflineQuran } from "@/lib/offline-quran-search"
import { rankQuranSearchResults } from "@/lib/quran-search-ranking"
import {
  isQuranSearchQueryReady,
  isStructuralQuranSearch,
  searchQuranNavigationLocally,
} from "@/lib/quran-smart-search"
import { loadRecentReadingLocations, type RecentReadingLocation } from "@/lib/recent-reading"
import { cn } from "@/lib/utils"

export type NavigationRange = {
  startPage: number
  endPage: number
  startVerseKey?: string
  endVerseKey?: string
  repeatVerse?: boolean
}

type Chapter = {
  id: number
  name: string
  verseCount: number
  startPage: number
  endPage: number
  versePages: number[]
}

type Division = {
  number: number
  startPage: number
  endPage: number
  firstVerseKey: string
  lastVerseKey: string
}

type PageDivision = {
  number: number
  firstVerseKey: string
  lastVerseKey: string
}

type NavigationData = {
  chapters: Chapter[]
  juzs: Division[]
  hizbs: Division[]
  pages: PageDivision[]
}

type SearchResult = {
  id?: string
  kind?: "verse" | "surah" | "juz" | "hizb" | "page"
  verseKey: string
  text: string
  page: number
  title?: string
  detail?: string
}

let navigationDataCache: NavigationData | null = null

function hasPreciseNavigationData(data: NavigationData | null): data is NavigationData {
  return Boolean(
    data?.pages?.length === 604 &&
    data.chapters.length === 114 &&
    data.chapters.every((chapter) => chapter.versePages?.length === chapter.verseCount),
  )
}

function formatNumber(value: number) {
  return String(value)
}

function normalizeArabic(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .trim()
}

function useNavigationData() {
  const requestRef = useRef(false)
  const cachedData = hasPreciseNavigationData(navigationDataCache) ? navigationDataCache : null
  const [data, setData] = useState<NavigationData | null>(cachedData)
  const [loading, setLoading] = useState(!cachedData)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (data || requestRef.current) return
    requestRef.current = true
    setLoading(true)
    void loadQuranNavigation<NavigationData>()
      .then((navigationData) => {
        if (!hasPreciseNavigationData(navigationData)) throw new Error("فهرس المصحف غير مكتمل")
        navigationDataCache = navigationData
        setData(navigationData)
        setError(null)
      })
      .catch(() => setError("تعذر تحميل فهرس المصحف"))
      .finally(() => setLoading(false))
  }, [data, retryKey])

  const retry = () => {
    requestRef.current = false
    setError(null)
    setRetryKey((key) => key + 1)
  }

  return { data, loading, error, retry }
}

function IndexError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border border-destructive/30 px-3 py-2 text-sm text-destructive">
      <span>{message}</span>
      <Button variant="ghost" size="icon-xs" aria-label="إعادة تحميل الفهرس" onClick={onRetry}>
        <RefreshCw />
      </Button>
    </div>
  )
}

type NavigationIndexTab = "surah" | "juz" | "hizb" | "page"
export type BrowseActivity = "read" | "listen" | "recite" | "test"

type QuranNavigationProps = {
  onNavigate: (page: number, verseKey?: string) => void
  onPrefetch?: (page: number) => void
  onSetRange: (range: NavigationRange) => void
  onClose: () => void
  currentPage: number
  currentChapterId?: number
  currentVerseKey?: string
  currentJuzNumber?: number
  currentHizbNumber?: number
  activity: BrowseActivity
  onActivityChange: (activity: BrowseActivity) => void
  activityControls?: ReactNode
  compactMobileHeader?: boolean
  dashboard?: boolean
}

export function QuranNavigation({
  onNavigate,
  onPrefetch,
  onSetRange,
  onClose,
  currentPage,
  currentChapterId,
  currentVerseKey,
  currentJuzNumber,
  currentHizbNumber,
  activity,
  onActivityChange,
  activityControls,
  compactMobileHeader = false,
  dashboard = false,
}: QuranNavigationProps) {
  const { language } = useInterfaceLanguage()
  const { data, loading, error: indexError, retry } = useNavigationData()
  const panelRef = useRef<HTMLElement>(null)
  const searchRequestRef = useRef(0)
  const currentChapterRowRef = useRef<HTMLDivElement>(null)
  const currentJuzRowRef = useRef<HTMLDivElement>(null)
  const currentHizbRowRef = useRef<HTMLDivElement>(null)
  const alignedSelectionRef = useRef<string | null>(null)
  const [activeTab, setActiveTab] = useState<NavigationIndexTab>("surah")
  const [query, setQuery] = useState("")
  const [recentLocations, setRecentLocations] = useState<RecentReadingLocation[]>([])
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [pageInput, setPageInput] = useState(String(currentPage))

  const normalizedQuery = normalizeArabic(query)
  const localSearchResults = useMemo<SearchResult[]>(() => data
    ? searchQuranNavigationLocally(data, query, language).map((result) => ({
        id: result.id,
        kind: result.kind,
        verseKey: result.startVerseKey,
        text: result.text ?? result.detail,
        page: result.startPage,
        title: result.title,
        detail: result.detail,
      }))
    : [], [data, language, query])
  const currentChapter = data?.chapters.find((chapter) => chapter.id === currentChapterId)
    ?? data?.chapters.find((chapter) => currentPage >= chapter.startPage && currentPage <= chapter.endPage)
  const currentJuz = data?.juzs.find((juz) => juz.number === currentJuzNumber)
    ?? data?.juzs.find((juz) => currentPage >= juz.startPage && currentPage <= juz.endPage)
  const currentHizb = data?.hizbs.find((hizb) => hizb.number === currentHizbNumber)
    ?? data?.hizbs.find((hizb) => currentPage >= hizb.startPage && currentPage <= hizb.endPage)
  const activeChapterId = currentChapter?.id
  const activeSelectionKey = activeTab === "surah"
    ? activeChapterId ? `surah-${activeChapterId}` : null
    : activeTab === "juz"
      ? currentJuz ? `juz-${currentJuz.number}` : null
      : activeTab === "hizb"
        ? currentHizb ? `hizb-${currentHizb.number}` : null
        : `page-${currentPage}`
  const visibleRecentLocations = recentLocations
    .filter((location) => location.page !== currentPage)
    .slice(0, 4)

  useEffect(() => {
    setRecentLocations(loadRecentReadingLocations())
    if (dashboard) return
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView({ block: "start", behavior: "auto" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [dashboard])

  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  useEffect(() => {
    if (normalizedQuery || !activeSelectionKey || alignedSelectionRef.current === activeSelectionKey) return
    const frame = window.requestAnimationFrame(() => {
      const row = activeTab === "surah"
        ? currentChapterRowRef.current
        : activeTab === "juz"
          ? currentJuzRowRef.current
          : activeTab === "hizb"
            ? currentHizbRowRef.current
            : null
      if (!row) {
        if (activeTab === "page") alignedSelectionRef.current = activeSelectionKey
        return
      }
      const viewport = row.closest<HTMLElement>(
        "[data-radix-scroll-area-viewport], [data-slot='scroll-area-viewport']",
      )
      if (viewport) {
        const rowRect = row.getBoundingClientRect()
        const viewportRect = viewport.getBoundingClientRect()
        viewport.scrollTop += rowRect.top - viewportRect.top - (viewport.clientHeight - row.clientHeight) / 2
      }
      alignedSelectionRef.current = activeSelectionKey
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeSelectionKey, activeTab, normalizedQuery])

  useEffect(() => {
    const normalized = query.trim()
    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId
    setSearchError(null)

    if (!isQuranSearchQueryReady(normalized)) {
      setResults(null)
      setSearching(false)
      return
    }

    if (isStructuralQuranSearch(normalized)) {
      setResults(localSearchResults)
      setSearching(false)
      return
    }

    setSearching(true)
    setResults(localSearchResults)
    const timer = setTimeout(() => {
      const runSearch = async () => {
        try {
          let remoteResults: SearchResult[]
          if (navigator.onLine === false) {
            const offline = await searchOfflineQuran(normalized)
            remoteResults = offline.results.map((result) => ({ ...result, id: `verse-${result.verseKey}`, kind: "verse" }))
          } else {
            const response = await fetch(`/api/quran/navigation?q=${encodeURIComponent(normalized)}`)
            const body = (await response.json()) as { results?: SearchResult[]; error?: string }
            if (!response.ok) throw new Error(body.error || "تعذر البحث")
            remoteResults = body.results ?? []
          }
          if (searchRequestRef.current !== requestId) return
          const seen = new Set<string>()
          const merged = [...localSearchResults, ...remoteResults]
            .filter((result) => {
              const key = result.id ?? `${result.kind ?? "verse"}-${result.verseKey}`
              if (seen.has(key)) return false
              seen.add(key)
              return true
            })
          setResults(rankQuranSearchResults(merged, normalized))
        } catch (searchFailure) {
          try {
            const offline = await searchOfflineQuran(normalized)
            if (searchRequestRef.current !== requestId) return
            setResults([...localSearchResults, ...offline.results.map((result) => ({
              ...result,
              id: `verse-${result.verseKey}`,
              kind: "verse" as const,
            }))])
          } catch {
            if (searchRequestRef.current !== requestId) return
            setResults(localSearchResults)
            if (localSearchResults.length === 0) {
              setSearchError(searchFailure instanceof Error ? searchFailure.message : "تعذر البحث")
            }
          }
        } finally {
          if (searchRequestRef.current === requestId) setSearching(false)
        }
      }
      void runSearch()
    }, 320)

    return () => clearTimeout(timer)
  }, [localSearchResults, query])

  const suggestedPrefetchPage = activity === "read" ? results?.[0]?.page : undefined

  useEffect(() => {
    if (suggestedPrefetchPage) onPrefetch?.(suggestedPrefetchPage)
  }, [onPrefetch, suggestedPrefetchPage])

  const goTo = (page: number, verseKey?: string) => {
    onPrefetch?.(page)
    onNavigate(page, verseKey)
    onClose()
  }

  const chooseRange = (range: NavigationRange) => {
    onSetRange(range)
  }

  const chooseChapter = (chapter: Chapter, startVerseKey = `${chapter.id}:1`) => {
    if (activity === "read") {
      goTo(chapter.versePages[Math.max(Number(startVerseKey.split(":")[1]) - 1, 0)] ?? chapter.startPage, startVerseKey)
      return
    }
    chooseRange({
      startPage: chapter.versePages[Math.max(Number(startVerseKey.split(":")[1]) - 1, 0)] ?? chapter.startPage,
      endPage: chapter.endPage,
      startVerseKey,
      endVerseKey: `${chapter.id}:${chapter.verseCount}`,
    })
  }

  const chooseVerse = (page: number, verseKey: string) => {
    const chapterId = Number(verseKey.split(":")[0])
    const chapter = data?.chapters.find((item) => item.id === chapterId)
    if (chapter) chooseChapter(chapter, verseKey)
    else if (activity === "read") goTo(page, verseKey)
    else chooseRange({ startPage: page, endPage: page, startVerseKey: verseKey, endVerseKey: verseKey })
  }

  const changeActivity = (nextActivity: BrowseActivity) => {
    if (activity === "read" && nextActivity !== "read" && currentChapter) {
      const startVerseKey = currentVerseKey?.startsWith(`${currentChapter.id}:`)
        ? currentVerseKey
        : `${currentChapter.id}:1`
      chooseRange({
        startPage: currentChapter.versePages[Math.max(Number(startVerseKey.split(":")[1]) - 1, 0)] ?? currentPage,
        endPage: currentChapter.endPage,
        startVerseKey,
        endVerseKey: `${currentChapter.id}:${currentChapter.verseCount}`,
      })
    }
    onActivityChange(nextActivity)
  }

  const renderDivision = (item: Division, label: string) => {
    const isCurrent = label === "الجزء"
      ? item.number === currentJuz?.number
      : item.number === currentHizb?.number
    const rowRef = label === "الجزء" ? currentJuzRowRef : currentHizbRowRef
    return (
    <div
      key={item.number}
      ref={isCurrent ? rowRef : undefined}
      aria-current={isCurrent ? "true" : undefined}
      className={cn(
        "flex items-center gap-1 border-b py-1 last:border-0",
        isCurrent && "bg-secondary/55",
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 px-2 py-2 text-right text-sm hover:bg-accent"
        onClick={() => activity === "read"
          ? goTo(item.startPage, item.firstVerseKey)
          : chooseRange({
              startPage: item.startPage,
              endPage: item.endPage,
              startVerseKey: item.firstVerseKey,
              endVerseKey: item.lastVerseKey,
            })}
      >
        <span className="block font-medium">{label} {formatNumber(item.number)}</span>
        <span className="block text-xs text-muted-foreground">
          {activity === "read" ? "فتح" : "اختيار"} الصفحات {formatNumber(item.startPage)}–{formatNumber(item.endPage)}
        </span>
      </button>
    </div>
    )
  }

  const recentLocationsSection = activity === "read" && visibleRecentLocations.length > 0 ? (
    <div className={cn("border-t px-4 py-2", dashboard && "px-3 py-1.5")}>
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
        <History className="size-3" /> الأخيرة في التصفح
      </p>
      <div className="grid grid-cols-2 gap-px border bg-border sm:grid-cols-4">
        {visibleRecentLocations.map((location) => (
          <button
            key={`${location.page}-${location.verseKey}`}
            type="button"
            className="min-h-9 min-w-0 bg-card px-2 py-1 text-right transition-colors hover:bg-accent focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => chooseVerse(location.page, location.verseKey)}
          >
            <span className="block truncate text-xs font-medium">سورة {location.chapterName}</span>
            <span className="block truncate text-[10px] text-muted-foreground">
              آية {location.verseKey.split(":")[1]} · صفحة {location.page}
            </span>
          </button>
        ))}
      </div>
    </div>
  ) : null

  return (
    <section
      ref={panelRef}
      aria-label="تصفح المصحف"
      className={cn(
        "h-fit scroll-mt-16 overflow-hidden border bg-card lg:sticky lg:top-20",
        compactMobileHeader && "border-x-0 border-t-0 lg:border",
        dashboard && "scroll-mt-12 border-0 lg:static",
      )}
      dir="rtl"
    >
      <div className={cn("flex items-center justify-between border-b px-4 py-3", compactMobileHeader && "hidden lg:flex", dashboard && "hidden")}>
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-primary" />
          <h2 className="font-bold">تصفح المصحف</h2>
        </div>
        <Button variant="ghost" size="icon-xs" aria-label="طي لوحة التصفح" onClick={onClose}>
          <ChevronUp />
        </Button>
      </div>

      <div className={cn("border-b p-3", dashboard && "p-2")}>
        <ToggleGroup
          type="single"
          value={activity}
          onValueChange={(value) => value && changeActivity(value as BrowseActivity)}
          variant="outline"
          className="grid h-auto w-full grid-cols-4"
          dir="rtl"
        >
          <ToggleGroupItem value="read" className={cn("h-12 min-w-0 flex-col gap-0.5 px-1 text-[11px] font-semibold", dashboard && "h-10 flex-row text-xs")}>
            <BookOpen className="size-4" /> تصفح
          </ToggleGroupItem>
          <ToggleGroupItem value="listen" className={cn("h-12 min-w-0 flex-col gap-0.5 px-1 text-[11px] font-semibold", dashboard && "h-10 flex-row text-xs")}>
            <Headphones className="size-4" /> استماع
          </ToggleGroupItem>
          <ToggleGroupItem value="recite" className={cn("h-12 min-w-0 flex-col gap-0.5 px-1 text-[11px] font-semibold", dashboard && "h-10 flex-row text-xs")}>
            <Mic className="size-4" /> تسميع
          </ToggleGroupItem>
          <ToggleGroupItem value="test" className={cn("h-12 min-w-0 flex-col gap-0.5 px-1 text-[11px] font-semibold", dashboard && "h-10 flex-row text-xs")}>
            <Shuffle className="size-4" /> اختبار
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {activity !== "read" && activityControls}

      {activity === "read" && (dashboard ? (
        <div className="space-y-2 p-3">
          {indexError ? (
            <IndexError message={indexError} onRetry={retry} />
          ) : loading || !data ? (
            <Button variant="outline" className="h-12 w-full" disabled>
              <LoaderCircle className="animate-spin" /> تحميل فهرس المصحف
            </Button>
          ) : (
            <QuranLocationPicker
              data={data}
              currentPage={currentPage}
              currentVerseKey={currentVerseKey}
              onNavigate={goTo}
            />
          )}
        </div>
      ) : (
        <>
      <div className="relative mx-4 mt-4">
        <Search className={cn("pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground", dashboard && "sm:hidden")} />
        {dashboard && (
          <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 text-xs font-semibold sm:flex">
            <BookOpen className="size-4 text-primary" /> تصفح
          </span>
        )}
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث في القرآن أو اكتب 2:255"
          aria-label="البحث في القرآن"
          className={cn("pr-9 pl-9 text-right", dashboard && "sm:pr-24")}
          dir="rtl"
        />
        {searching && <LoaderCircle className="absolute left-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary" />}
      </div>

      {query.trim() ? (
        <div className="px-4 pb-4 pt-3">
          {searchError && <p className="mb-2 text-sm text-destructive">{searchError}</p>}
          <ScrollArea className="h-[min(56vh,590px)]">
            <p className="sticky top-0 bg-card py-2 text-xs font-semibold text-muted-foreground">النتائج</p>
            {!searching && results?.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة</p>
            ) : (
              results?.map((result) => (
                <div key={result.id ?? `${result.kind ?? "verse"}-${result.verseKey}`} className="flex items-center gap-1 border-b py-1">
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-2 py-2 text-right hover:bg-accent"
                    data-search-id={result.id}
                    onPointerDown={() => onPrefetch?.(result.page)}
                    onClick={() => chooseVerse(result.page, result.verseKey)}
                  >
                    <span className="block text-xs font-semibold text-primary">
                      {result.title ?? result.verseKey} · صفحة {formatNumber(result.page)}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block line-clamp-2",
                        result.kind === "verse" || !result.kind ? "font-quran text-xl leading-9" : "text-sm leading-6",
                      )}
                      data-quran-content={result.kind === "verse" || !result.kind ? "" : undefined}
                    >{result.text}</span>
                  </button>

                </div>
              ))
            )}
          </ScrollArea>
        </div>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as NavigationIndexTab)}
          className="min-h-0 gap-0"
        >
          <TabsList className="mr-4 ml-auto mt-3 flex h-auto w-fit justify-start" dir="rtl">
            <TabsTrigger value="surah" className="px-3 text-right text-foreground/75">السور</TabsTrigger>
            <TabsTrigger value="juz" className="px-3 text-right text-foreground/75">الأجزاء</TabsTrigger>
            <TabsTrigger value="hizb" className="px-3 text-right text-foreground/75">الأحزاب</TabsTrigger>
            <TabsTrigger value="page" className="px-3 text-right text-foreground/75">الصفحة</TabsTrigger>
          </TabsList>

          {indexError && <div className="m-4"><IndexError message={indexError} onRetry={retry} /></div>}

          <TabsContent value="surah" className="px-4 pb-4">
            <ScrollArea className="h-[min(52vh,560px)]">
              {loading ? (
                <div className="grid h-40 place-items-center"><LoaderCircle className="animate-spin" /></div>
              ) : (
                data?.chapters.map((chapter) => (
                  <div
                    key={chapter.id}
                    ref={chapter.id === activeChapterId ? currentChapterRowRef : undefined}
                    aria-current={chapter.id === activeChapterId ? "true" : undefined}
                    className={cn(
                      "flex items-center gap-1 border-b py-1",
                      chapter.id === activeChapterId && "bg-secondary/55",
                    )}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 px-2 py-2 text-right text-sm hover:bg-accent"
                      onPointerDown={() => onPrefetch?.(chapter.startPage)}
                      onClick={() => chooseChapter(chapter)}
                    >
                      <span className="flex items-center gap-2 font-medium" dir="rtl">
                        <span className="shrink-0 tabular-nums">{formatNumber(chapter.id)}</span>
                        <span>سورة {chapter.name}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatNumber(chapter.verseCount)} آية
                      </span>
                    </button>

                  </div>
                ))
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="juz" className="px-4 pb-4">
            <ScrollArea className="h-[min(52vh,560px)]">{data?.juzs.map((item) => renderDivision(item, "الجزء"))}</ScrollArea>
          </TabsContent>

          <TabsContent value="hizb" className="px-4 pb-4">
            <ScrollArea className="h-[min(52vh,560px)]">{data?.hizbs.map((item) => renderDivision(item, "الحزب"))}</ScrollArea>
          </TabsContent>

          <TabsContent value="page" className="space-y-4 px-4 py-5">
            <div className="space-y-2">
              <Label htmlFor="navigator-page">رقم الصفحة</Label>
              <Input
                id="navigator-page"
                type="number"
                min={1}
                max={604}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                className="text-right text-lg font-semibold tabular-nums"
                dir="rtl"
              />
            </div>
            <Button
              className="w-full"
              variant={activity === "read" ? "outline" : "default"}
              onClick={() => {
                const page = Math.min(Math.max(Number(pageInput), 1), 604)
                if (activity === "read") goTo(page)
                else {
                  const pageMeta = data?.pages.find((item) => item.number === page)
                  chooseRange({
                    startPage: page,
                    endPage: page,
                    startVerseKey: pageMeta?.firstVerseKey,
                    endVerseKey: pageMeta?.lastVerseKey,
                  })
                }
              }}
            >
              <BookOpen /> {activity === "read" ? "فتح الصفحة" : "اختيار الصفحة"}
            </Button>
          </TabsContent>
        </Tabs>
      )}
        </>
      ))}

      {recentLocationsSection}
    </section>
  )
}

type QuranSessionRangePickerProps = {
  currentPage: number
  pageStart: number
  pageCount: number
  startVerseKey?: string
  endVerseKey?: string
  onSetRange: (range: NavigationRange) => void
}

export function QuranSessionRangePicker({
  currentPage,
  pageStart,
  pageCount,
  startVerseKey,
  endVerseKey,
  onSetRange,
}: QuranSessionRangePickerProps) {
  const { data, loading, error, retry } = useNavigationData()

  if (loading) {
    return <div className="grid h-28 place-items-center"><LoaderCircle className="animate-spin text-primary" /></div>
  }
  if (error || !data) {
    return <IndexError message={error ?? "تعذر تحميل الفهرس"} onRetry={retry} />
  }

  return (
    <SessionRangeSearchPicker
      data={data}
      currentPage={currentPage}
      pageStart={pageStart}
      pageCount={pageCount}
      startVerseKey={startVerseKey}
      endVerseKey={endVerseKey}
      onSetRange={onSetRange}
    />
  )
}
