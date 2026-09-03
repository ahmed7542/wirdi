"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown, LoaderCircle, Search } from "lucide-react"

import { useInterfaceLanguage, type InterfaceLanguage } from "@/components/interface-language-provider"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { searchOfflineQuran } from "@/lib/offline-quran-search"
import { rankQuranSearchResults } from "@/lib/quran-search-ranking"
import {
  isQuranSearchQueryReady,
  isStructuralQuranSearch,
  searchQuranNavigationLocally,
} from "@/lib/quran-smart-search"

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

type NavigationRange = {
  startPage: number
  endPage: number
  startVerseKey?: string
  endVerseKey?: string
}

type BoundaryKind = "surah" | "juz" | "hizb" | "page" | "ayah"
type RangeBrowseTab = "nearby" | "surahs" | "divisions" | "pages"

type ResolvedBoundary = {
  page: number
  verseKey: string
  label: string
  ordinal: number
}

type RangeSearchResult = {
  id: string
  kind: BoundaryKind
  start: ResolvedBoundary
  end: ResolvedBoundary
  detail: string
  text?: string
}

type VerseSearchResponse = {
  results?: Array<{
    verseKey: string
    surahName?: string
    ayah?: number
    text: string
    page: number
  }>
}

type SessionRangeSearchPickerProps = {
  data: NavigationData
  currentPage: number
  pageStart: number
  pageCount: number
  startVerseKey?: string
  endVerseKey?: string
  onSetRange: (range: NavigationRange) => void
}

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
}

function normalizeArabic(value: string) {
  return normalizeDigits(value)
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ـ/g, "")
    .replace(/[،,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function verseOrdinal(data: NavigationData, verseKey: string) {
  const [chapterId, ayah] = verseKey.split(":").map(Number)
  return data.chapters
    .filter((chapter) => chapter.id < chapterId)
    .reduce((total, chapter) => total + chapter.verseCount, ayah)
}

function resolveVerse(data: NavigationData, verseKey: string, label?: string): ResolvedBoundary | null {
  const [chapterId, ayah] = verseKey.split(":").map(Number)
  const chapter = data.chapters.find((item) => item.id === chapterId)
  if (!chapter || !Number.isInteger(ayah) || ayah < 1 || ayah > chapter.verseCount) return null
  return {
    page: chapter.versePages[ayah - 1],
    verseKey,
    label: label ?? `سورة ${chapter.name}، الآية ${ayah}`,
    ordinal: verseOrdinal(data, verseKey),
  }
}

function rangeResultForSurah(data: NavigationData, chapter: Chapter): RangeSearchResult {
  const start = resolveVerse(data, `${chapter.id}:1`, `بداية سورة ${chapter.name}`)!
  const end = resolveVerse(data, `${chapter.id}:${chapter.verseCount}`, `نهاية سورة ${chapter.name}`)!
  return {
    id: `surah-${chapter.id}`,
    kind: "surah",
    start,
    end,
    detail: `${chapter.verseCount} آية · الصفحات ${chapter.startPage}–${chapter.endPage}`,
  }
}

function rangeResultForDivision(data: NavigationData, division: Division, kind: "juz" | "hizb"): RangeSearchResult {
  const label = kind === "juz" ? "الجزء" : "الحزب"
  const start = resolveVerse(data, division.firstVerseKey, `بداية ${label} ${division.number}`)!
  const end = resolveVerse(data, division.lastVerseKey, `نهاية ${label} ${division.number}`)!
  return {
    id: `${kind}-${division.number}`,
    kind,
    start,
    end,
    detail: `الصفحات ${division.startPage}–${division.endPage}`,
  }
}

function rangeResultForPage(data: NavigationData, page: PageDivision): RangeSearchResult {
  const start = resolveVerse(data, page.firstVerseKey, `بداية الصفحة ${page.number}`)!
  const end = resolveVerse(data, page.lastVerseKey, `نهاية الصفحة ${page.number}`)!
  return {
    id: `page-${page.number}`,
    kind: "page",
    start,
    end,
    detail: `صفحة ${page.number} من المصحف`,
  }
}

function rangeResultForVerse(data: NavigationData, verseKey: string, text?: string): RangeSearchResult | null {
  const boundary = resolveVerse(data, verseKey)
  if (!boundary) return null
  return {
    id: `ayah-${verseKey}`,
    kind: "ayah",
    start: boundary,
    end: boundary,
    detail: `صفحة ${boundary.page} · ${verseKey}`,
    text,
  }
}

function localRangeSearch(data: NavigationData, query: string, language: InterfaceLanguage) {
  return searchQuranNavigationLocally(data, query, language).flatMap((result) => {
    const startLabel = result.kind === "verse"
      ? language === "en" ? result.title : undefined
      : `${language === "en" ? "Start of" : "بداية"} ${result.title}`
    const endLabel = result.kind === "verse"
      ? language === "en" ? result.title : undefined
      : `${language === "en" ? "End of" : "نهاية"} ${result.title}`
    const start = resolveVerse(data, result.startVerseKey, startLabel)
    const end = resolveVerse(data, result.endVerseKey, endLabel)
    if (!start || !end) return []
    return [{
      id: result.id,
      kind: result.kind === "verse" ? "ayah" as const : result.kind,
      start,
      end,
      detail: result.detail,
      text: result.text,
    }]
  })
}

function mergeAndFilterResults(
  localResults: RangeSearchResult[],
  remoteResults: RangeSearchResult[],
  edge: "start" | "end",
  query: string,
  minimumOrdinal?: number,
) {
  const seen = new Set<string>()
  const filtered = [...localResults, ...remoteResults]
    .filter((result) => {
      if (seen.has(result.id)) return false
      seen.add(result.id)
      const target = edge === "start" ? result.start : result.end
      return minimumOrdinal === undefined || target.ordinal >= minimumOrdinal
    })

  if (isStructuralQuranSearch(query)) {
    return filtered
      .sort((first, second) => {
        const firstTarget = edge === "start" ? first.start : first.end
        const secondTarget = edge === "start" ? second.start : second.end
        return firstTarget.ordinal - secondTarget.ordinal || first.id.localeCompare(second.id)
      })
      .slice(0, 30)
  }

  return rankQuranSearchResults(filtered.map((result) => ({
    result,
    verseKey: (edge === "start" ? result.start : result.end).verseKey,
    text: result.text ?? "",
  })), query).map(({ result }) => result).slice(0, 30)
}

function isRangeResultAvailable(
  result: RangeSearchResult,
  edge: "start" | "end",
  minimumOrdinal?: number,
) {
  const target = edge === "start" ? result.start : result.end
  return minimumOrdinal === undefined || target.ordinal >= minimumOrdinal
}

function RangeSearchField({
  edge,
  data,
  selected,
  nearbyResults,
  minimumOrdinal,
  navigation = false,
  onSelect,
}: {
  edge: "start" | "end"
  data: NavigationData
  selected: ResolvedBoundary
  nearbyResults: RangeSearchResult[]
  minimumOrdinal?: number
  navigation?: boolean
  onSelect: (result: RangeSearchResult) => void
}) {
  const { language } = useInterfaceLanguage()
  const requestRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [remoteResults, setRemoteResults] = useState<RangeSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [activeTab, setActiveTab] = useState<RangeBrowseTab>("nearby")
  const [divisionKind, setDivisionKind] = useState<"juz" | "hizb">("juz")
  const [pageCursor, setPageCursor] = useState(selected.page)
  const [isMobile, setIsMobile] = useState(false)
  const localResults = useMemo(() => localRangeSearch(data, query, language), [data, language, query])
  const results = useMemo(
    () => mergeAndFilterResults(localResults, remoteResults, edge, query, minimumOrdinal),
    [edge, localResults, minimumOrdinal, query, remoteResults],
  )
  const visibleNearbyResults = useMemo(
    () => nearbyResults.filter((result) => isRangeResultAvailable(result, edge, minimumOrdinal)),
    [edge, minimumOrdinal, nearbyResults],
  )
  const surahResults = useMemo(
    () => data.chapters
      .map((chapter) => rangeResultForSurah(data, chapter))
      .filter((result) => isRangeResultAvailable(result, edge, minimumOrdinal)),
    [data, edge, minimumOrdinal],
  )
  const divisionResults = useMemo(() => {
    const divisions = divisionKind === "juz" ? data.juzs : data.hizbs
    return divisions
      .map((division) => rangeResultForDivision(data, division, divisionKind))
      .filter((result) => isRangeResultAvailable(result, edge, minimumOrdinal))
  }, [data, divisionKind, edge, minimumOrdinal])
  const minimumPage = useMemo(() => {
    if (minimumOrdinal === undefined) return 1
    return data.pages.find((page) => verseOrdinal(data, page.lastVerseKey) >= minimumOrdinal)?.number ?? 604
  }, [data, minimumOrdinal])
  const nearbyPages = useMemo(() => {
    const start = Math.max(minimumPage, Math.min(pageCursor - 4, Math.max(minimumPage, 596)))
    return data.pages
      .slice(start - 1, start + 8)
      .map((page) => rangeResultForPage(data, page))
      .filter((result) => isRangeResultAvailable(result, edge, minimumOrdinal))
  }, [data, edge, minimumOrdinal, minimumPage, pageCursor])

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)")
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    const normalizedQuery = query.trim()
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setRemoteResults([])

    if (!isQuranSearchQueryReady(normalizedQuery) || isStructuralQuranSearch(normalizedQuery)) {
      setSearching(false)
      return
    }

    setSearching(true)
    const timer = window.setTimeout(async () => {
      try {
        let verseResults: VerseSearchResponse["results"] = []
        if (navigator.onLine !== false) {
          const response = await fetch(`/api/quran/navigation?q=${encodeURIComponent(normalizedQuery)}`)
          if (!response.ok) throw new Error("تعذر البحث")
          verseResults = ((await response.json()) as VerseSearchResponse).results ?? []
        } else {
          const offline = await searchOfflineQuran(normalizedQuery)
          verseResults = offline.results
        }
        if (requestRef.current !== requestId) return
        setRemoteResults((verseResults ?? []).flatMap((result) => {
          const option = rangeResultForVerse(data, result.verseKey, result.text)
          return option ? [option] : []
        }))
      } catch {
        try {
          const offline = await searchOfflineQuran(normalizedQuery)
          if (requestRef.current !== requestId) return
          setRemoteResults(offline.results.flatMap((result) => {
            const option = rangeResultForVerse(data, result.verseKey, result.text)
            return option ? [option] : []
          }))
        } catch {
          if (requestRef.current === requestId) setRemoteResults([])
        }
      } finally {
        if (requestRef.current === requestId) setSearching(false)
      }
    }, 280)

    return () => window.clearTimeout(timer)
  }, [data, query])

  useEffect(() => {
    if (!open) return
    setPageCursor(Math.max(minimumPage, selected.page))
    const frame = window.requestAnimationFrame(() => {
      if (!isMobile) inputRef.current?.focus()
      if (query.trim()) return
      const activeOption = optionsRef.current?.querySelector<HTMLElement>("[data-range-active='true']")
      const viewport = optionsRef.current
      if (activeOption && viewport) {
        viewport.scrollTop = activeOption.offsetTop - (viewport.clientHeight - activeOption.clientHeight) / 2
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeTab, divisionKind, isMobile, minimumPage, open, query, selected.page])

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuery("")
      setRemoteResults([])
    }
  }

  const choose = (result: RangeSearchResult) => {
    onSelect(result)
    handleOpenChange(false)
  }

  const isActiveResult = (result: RangeSearchResult) =>
    selected.ordinal >= result.start.ordinal && selected.ordinal <= result.end.ordinal

  const renderResultRows = (items: RangeSearchResult[]) => items.length > 0 ? items.map((result) => {
    const target = edge === "start" ? result.start : result.end
    return (
      <button
        key={result.id}
        type="button"
        className={cn(
          "block w-full border-b px-3 py-2.5 text-right transition-colors last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActiveResult(result) && "bg-secondary/65",
        )}
        data-range-active={isActiveResult(result)}
        data-search-id={result.id}
        onClick={() => choose(result)}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium">{target.label}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">ص {target.page}</span>
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{result.detail}</span>
        {result.text && <span className="font-quran mt-1 block line-clamp-2 text-base leading-7 text-foreground" data-quran-content>{result.text}</span>}
      </button>
    )
  }) : (
    <p className="px-3 py-7 text-center text-sm text-muted-foreground">
      {edge === "end" ? "لا توجد خيارات بعد بداية النطاق." : "لا توجد خيارات مطابقة."}
    </p>
  )

  const renderCompactGrid = (items: RangeSearchResult[], columns: "two" | "five") => (
    <div className={cn("grid gap-1 p-1.5", columns === "two" ? "grid-cols-2" : "grid-cols-5")} dir="rtl">
      {items.map((result) => {
        const target = edge === "start" ? result.start : result.end
        const active = isActiveResult(result)
        return (
          <button
            key={result.id}
            type="button"
            className={cn(
              "min-w-0 border bg-background px-1.5 text-center transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              columns === "two" ? "h-11 text-right" : "h-10 text-sm font-semibold tabular-nums",
              active && "border-primary/40 bg-secondary text-primary",
            )}
            data-range-active={active}
            data-search-id={result.id}
            aria-label={target.label}
            onClick={() => choose(result)}
          >
            {columns === "two" ? (
              <>
                <span className="block truncate text-xs font-semibold">{result.id.split("-")[1]} · {target.label.replace(/^(?:بداية|نهاية) سورة /, "")}</span>
                <span className="block truncate text-[9px] text-muted-foreground">ص {target.page}</span>
              </>
            ) : result.id.split("-")[1]}
          </button>
        )
      })}
    </div>
  )

  const renderTrigger = () => navigation ? (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-label="البحث والانتقال في المصحف"
      className="h-auto min-h-12 w-full justify-between gap-3 bg-background/80 px-3 text-right font-normal"
    >
      <Search className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">ابحث أو اختر موضعًا</span>
        <span className="block truncate text-[11px] text-muted-foreground">{selected.label} · ص {selected.page}</span>
      </span>
      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
    </Button>
  ) : (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-label={edge === "start" ? "اختيار بداية النطاق" : "اختيار نهاية النطاق"}
      className="h-9 w-full justify-between gap-2 bg-background/80 px-2.5 text-right font-normal"
    >
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{selected.label}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">ص {selected.page}</span>
      <Search className="size-3.5 shrink-0 text-muted-foreground" />
    </Button>
  )

  const renderPickerContent = (mobile: boolean) => (
    <div className={cn("flex min-h-0 flex-col", mobile ? "h-[min(72dvh,620px)]" : "max-h-[430px]")} dir="rtl">
      <div className="relative shrink-0 border-b p-2">
        <Search className="pointer-events-none absolute right-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              event.preventDefault()
              choose(results[0])
            }
          }}
          placeholder="سورة، آية، جزء، حزب أو صفحة..."
          aria-label={navigation ? "البحث في المصحف" : edge === "start" ? "البحث عن بداية النطاق" : "البحث عن نهاية النطاق"}
          className="pr-9 pl-8 text-right"
        />
        {searching && <LoaderCircle className="absolute left-5 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary" />}
      </div>

      {query.trim() ? (
        <div ref={optionsRef} className="min-h-0 flex-1 overflow-y-auto p-1">
          {results.length > 0
            ? renderResultRows(results)
            : searching
              ? <div className="grid min-h-24 place-items-center"><LoaderCircle className="size-5 animate-spin text-primary" /></div>
              : renderResultRows([])}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RangeBrowseTab)} className="min-h-0 flex-1 gap-0">
          <TabsList className="mx-2 mt-2 grid h-11 w-[calc(100%-1rem)] shrink-0 grid-cols-4 p-1" dir="rtl">
            <TabsTrigger value="nearby" className="h-9 min-w-0 px-2 text-xs font-semibold sm:text-sm">الأقرب</TabsTrigger>
            <TabsTrigger value="surahs" className="h-9 min-w-0 px-2 text-xs font-semibold sm:text-sm">السور</TabsTrigger>
            <TabsTrigger value="divisions" className="h-9 min-w-0 px-2 text-xs font-semibold sm:text-sm">الأجزاء</TabsTrigger>
            <TabsTrigger value="pages" className="h-9 min-w-0 px-2 text-xs font-semibold sm:text-sm">الصفحات</TabsTrigger>
          </TabsList>

          <div ref={optionsRef} className="min-h-0 flex-1 overflow-y-auto px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
            <TabsContent value="nearby" className="mt-0">
              {renderResultRows(visibleNearbyResults)}
            </TabsContent>
            <TabsContent value="surahs" className="mt-0">
              {renderCompactGrid(surahResults, "two")}
            </TabsContent>
            <TabsContent value="divisions" className="mt-0">
              <ToggleGroup
                type="single"
                value={divisionKind}
                onValueChange={(value) => value && setDivisionKind(value as "juz" | "hizb")}
                variant="outline"
                className="sticky top-0 z-10 mx-auto grid w-40 grid-cols-2 bg-background py-1"
                dir="rtl"
              >
                <ToggleGroupItem value="juz" className="h-8 text-xs">جزء</ToggleGroupItem>
                <ToggleGroupItem value="hizb" className="h-8 text-xs">حزب</ToggleGroupItem>
              </ToggleGroup>
              {renderCompactGrid(divisionResults, "five")}
            </TabsContent>
            <TabsContent value="pages" className="mt-0 space-y-3 p-2">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={minimumPage}
                  max={604}
                  value={pageCursor}
                  aria-label="رقم الصفحة"
                  className="h-10 text-center tabular-nums"
                  onChange={(event) => setPageCursor(Math.min(604, Math.max(minimumPage, Number(event.target.value) || minimumPage)))}
                />
                <Button
                  type="button"
                  size="icon"
                  className="size-10 shrink-0"
                  aria-label={`اختيار الصفحة ${pageCursor}`}
                  onClick={() => {
                    const page = data.pages[pageCursor - 1]
                    if (page) choose(rangeResultForPage(data, page))
                  }}
                >
                  <Check />
                </Button>
              </div>
              <Slider
                value={[pageCursor]}
                min={minimumPage}
                max={604}
                step={1}
                dir="rtl"
                aria-label="التنقل بين صفحات المصحف"
                onValueChange={(value) => setPageCursor(value[0])}
              />
              {renderCompactGrid(nearbyPages, "five")}
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  )

  return (
    <div className={cn(navigation ? "block" : "grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2")}>
      {!navigation && <Label>{edge === "start" ? "من" : "إلى"}</Label>}
      {isMobile ? (
        <Drawer open={open} onOpenChange={handleOpenChange} direction="bottom">
          <DrawerTrigger asChild>{renderTrigger()}</DrawerTrigger>
          <DrawerContent className="z-[90] max-h-[78dvh] p-0 sm:hidden" dir="rtl">
            <DrawerHeader className="sr-only">
              <DrawerTitle>{navigation ? "البحث والانتقال في المصحف" : edge === "start" ? "اختيار بداية النطاق" : "اختيار نهاية النطاق"}</DrawerTitle>
            </DrawerHeader>
            {renderPickerContent(true)}
          </DrawerContent>
        </Drawer>
      ) : (
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>{renderTrigger()}</PopoverTrigger>
          <PopoverContent align="start" className="w-[min(380px,calc(100vw-2rem))] p-0" dir="rtl">
            {renderPickerContent(false)}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

function inferCompleteRange(
  data: NavigationData,
  startVerseKey: string | undefined,
  endVerseKey: string | undefined,
) {
  if (!startVerseKey || !endVerseKey) return null
  const chapter = data.chapters.find((item) => `${item.id}:1` === startVerseKey && `${item.id}:${item.verseCount}` === endVerseKey)
  if (chapter) return rangeResultForSurah(data, chapter)
  const juz = data.juzs.find((item) => item.firstVerseKey === startVerseKey && item.lastVerseKey === endVerseKey)
  if (juz) return rangeResultForDivision(data, juz, "juz")
  const hizb = data.hizbs.find((item) => item.firstVerseKey === startVerseKey && item.lastVerseKey === endVerseKey)
  if (hizb) return rangeResultForDivision(data, hizb, "hizb")
  const page = data.pages.find((item) => item.firstVerseKey === startVerseKey && item.lastVerseKey === endVerseKey)
  return page ? rangeResultForPage(data, page) : null
}

function boundaryFromRange(
  data: NavigationData,
  verseKey: string | undefined,
  page: number,
  edge: "start" | "end",
) {
  const pageMeta = data.pages.find((item) => item.number === page) ?? data.pages[0]
  const fallbackKey = edge === "start" ? pageMeta.firstVerseKey : pageMeta.lastVerseKey
  return resolveVerse(data, verseKey ?? fallbackKey) ?? resolveVerse(data, fallbackKey)!
}

function smartStartSuggestions(data: NavigationData, current: ResolvedBoundary) {
  const [chapterId] = current.verseKey.split(":").map(Number)
  const chapter = data.chapters.find((item) => item.id === chapterId)
  const page = data.pages.find((item) => item.number === current.page)
  const juz = data.juzs.find((item) => {
    const first = verseOrdinal(data, item.firstVerseKey)
    const last = verseOrdinal(data, item.lastVerseKey)
    return current.ordinal >= first && current.ordinal <= last
  })
  const hizb = data.hizbs.find((item) => {
    const first = verseOrdinal(data, item.firstVerseKey)
    const last = verseOrdinal(data, item.lastVerseKey)
    return current.ordinal >= first && current.ordinal <= last
  })
  return [
    rangeResultForVerse(data, current.verseKey),
    page ? rangeResultForPage(data, page) : null,
    chapter ? rangeResultForSurah(data, chapter) : null,
    hizb ? rangeResultForDivision(data, hizb, "hizb") : null,
    juz ? rangeResultForDivision(data, juz, "juz") : null,
  ].filter((item): item is RangeSearchResult => Boolean(item))
}

function smartEndSuggestions(data: NavigationData, start: ResolvedBoundary, preferredKind: BoundaryKind) {
  const [chapterId] = start.verseKey.split(":").map(Number)
  const chapter = data.chapters.find((item) => item.id === chapterId)
  const page = data.pages.find((item) => item.number === start.page)
  const juz = data.juzs.find((item) => {
    const first = verseOrdinal(data, item.firstVerseKey)
    const last = verseOrdinal(data, item.lastVerseKey)
    return start.ordinal >= first && start.ordinal <= last
  })
  const hizb = data.hizbs.find((item) => {
    const first = verseOrdinal(data, item.firstVerseKey)
    const last = verseOrdinal(data, item.lastVerseKey)
    return start.ordinal >= first && start.ordinal <= last
  })
  const candidates = [
    chapter ? rangeResultForSurah(data, chapter) : null,
    juz ? rangeResultForDivision(data, juz, "juz") : null,
    hizb ? rangeResultForDivision(data, hizb, "hizb") : null,
    page ? rangeResultForPage(data, page) : null,
  ].filter((item): item is RangeSearchResult => Boolean(item && item.end.ordinal >= start.ordinal))
  const priority: Record<BoundaryKind, BoundaryKind[]> = {
    surah: ["surah", "page", "juz", "hizb"],
    juz: ["juz", "hizb", "surah", "page"],
    hizb: ["hizb", "surah", "page", "juz"],
    page: ["page", "surah", "hizb", "juz"],
    ayah: ["surah", "page", "hizb", "juz"],
  }
  return candidates.sort((first, second) =>
    priority[preferredKind].indexOf(first.kind) - priority[preferredKind].indexOf(second.kind),
  )
}

export function QuranLocationPicker({
  data,
  currentPage,
  currentVerseKey,
  onNavigate,
}: {
  data: NavigationData
  currentPage: number
  currentVerseKey?: string
  onNavigate: (page: number, verseKey: string) => void
}) {
  const current = useMemo(
    () => boundaryFromRange(data, currentVerseKey, currentPage, "start"),
    [currentPage, currentVerseKey, data],
  )
  const nearbyResults = useMemo(() => smartStartSuggestions(data, current), [current, data])

  return (
    <RangeSearchField
      edge="start"
      data={data}
      selected={current}
      nearbyResults={nearbyResults}
      navigation
      onSelect={(result) => onNavigate(result.start.page, result.start.verseKey)}
    />
  )
}

export function SessionRangeSearchPicker({
  data,
  currentPage,
  pageStart,
  pageCount,
  startVerseKey,
  endVerseKey,
  onSetRange,
}: SessionRangeSearchPickerProps) {
  const initialStartPage = pageStart || currentPage
  const initialEndPage = Math.min(initialStartPage + Math.max(pageCount, 1) - 1, 604)
  const inferredRange = useMemo(
    () => inferCompleteRange(data, startVerseKey, endVerseKey),
    [data, endVerseKey, startVerseKey],
  )
  const incomingStart = useMemo(
    () => inferredRange?.start ?? boundaryFromRange(data, startVerseKey, initialStartPage, "start"),
    [data, inferredRange, initialStartPage, startVerseKey],
  )
  const incomingEnd = useMemo(
    () => inferredRange?.end ?? boundaryFromRange(data, endVerseKey, initialEndPage, "end"),
    [data, endVerseKey, inferredRange, initialEndPage],
  )
  const [start, setStart] = useState(incomingStart)
  const [end, setEnd] = useState(incomingEnd.ordinal >= incomingStart.ordinal ? incomingEnd : incomingStart)
  const [startKind, setStartKind] = useState<BoundaryKind>(inferredRange?.kind ?? "ayah")
  const [startTouched, setStartTouched] = useState(false)
  const [endChoiceId, setEndChoiceId] = useState(inferredRange?.id ?? `ayah-${incomingEnd.verseKey}`)
  const appliedRangeRef = useRef("")
  const incomingKey = `${incomingStart.verseKey}-${incomingEnd.verseKey}`

  useEffect(() => {
    if (appliedRangeRef.current === incomingKey) return
    setStart(incomingStart)
    setEnd(incomingEnd.ordinal >= incomingStart.ordinal ? incomingEnd : incomingStart)
    setStartKind(inferredRange?.kind ?? "ayah")
    setStartTouched(false)
    setEndChoiceId(inferredRange?.id ?? `ayah-${incomingEnd.verseKey}`)
  }, [incomingEnd, incomingKey, incomingStart, inferredRange])

  const applyRange = (nextStart: ResolvedBoundary, nextEnd: ResolvedBoundary, choiceId: string) => {
    const safeEnd = nextEnd.ordinal >= nextStart.ordinal ? nextEnd : nextStart
    appliedRangeRef.current = `${nextStart.verseKey}-${safeEnd.verseKey}`
    setStart(nextStart)
    setEnd(safeEnd)
    setEndChoiceId(choiceId)
    onSetRange({
      startPage: nextStart.page,
      endPage: safeEnd.page,
      startVerseKey: nextStart.verseKey,
      endVerseKey: safeEnd.verseKey,
    })
  }

  const startSuggestions = useMemo(() => smartStartSuggestions(data, start), [data, start])
  const suggestions = useMemo(() => smartEndSuggestions(data, start, startKind), [data, start, startKind])

  return (
    <div data-session-range-picker className="space-y-3 border-y border-primary/25 bg-secondary/25 px-3 py-3" dir="rtl">
      <RangeSearchField
        edge="start"
        data={data}
        selected={start}
        nearbyResults={startSuggestions}
        onSelect={(result) => {
          setStartKind(result.kind)
          setStartTouched(true)
          applyRange(result.start, result.end, result.id)
        }}
      />

      {startTouched && (
        <div className="space-y-2 border-y py-2.5">
          <p className="text-[11px] font-semibold text-foreground/75">نهايات مقترحة</p>
          <div data-suggested-endings className="grid grid-cols-2 gap-1.5">
            {suggestions.map((suggestion) => {
              const selectedSuggestion = endChoiceId === suggestion.id
              const kindLabel = suggestion.kind === "surah"
                ? "السورة"
                : suggestion.kind === "juz"
                  ? "الجزء"
                  : suggestion.kind === "hizb"
                    ? "الحزب"
                    : "الصفحة"
              return (
                <Button
                  key={`${suggestion.kind}-${suggestion.end.verseKey}`}
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-full min-h-[58px] min-w-0 flex-col items-stretch gap-0.5 whitespace-normal px-2.5 py-1.5 text-right",
                    selectedSuggestion ? "border-primary/40 bg-secondary" : "bg-background/65",
                  )}
                  data-ending-kind={suggestion.kind}
                  aria-label={`${suggestion.end.label}، صفحة ${suggestion.end.page}`}
                  aria-pressed={selectedSuggestion}
                  onClick={() => applyRange(start, suggestion.end, suggestion.id)}
                >
                  <span className="flex w-full items-center justify-between gap-2 text-[9px] font-medium text-muted-foreground">
                    <span>نهاية {kindLabel}</span>
                    {selectedSuggestion && <Check className="size-3 shrink-0 text-primary" />}
                  </span>
                  <span className="block min-w-0 text-xs leading-4 font-semibold text-foreground">{suggestion.end.label}</span>
                  <span className="block text-[9px] font-normal text-muted-foreground tabular-nums">صفحة {suggestion.end.page}</span>
                </Button>
              )
            })}
          </div>
        </div>
      )}

      <RangeSearchField
        edge="end"
        data={data}
        selected={end}
        nearbyResults={suggestions}
        minimumOrdinal={start.ordinal}
        onSelect={(result) => applyRange(start, result.end, result.id)}
      />
    </div>
  )
}
