"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowRight,
  ExternalLink,
  GitCompareArrows,
  LoaderCircle,
  RotateCcw,
  Search,
  X,
} from "lucide-react"

import {
  MutashabihatFollowingContext as VerseWithFollowingContext,
  type MutashabihatContextVerse as ContextVerse,
} from "@/components/mutashabihat-following-context"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  readExactMutashabihat,
  storeExactMutashabihat,
  type OfflineMutashabihatResponse,
} from "@/lib/offline-mutashabihat"

const MIN_SEARCH_LENGTH = 2

type MutashabihatKind = "identical" | "similar" | "beginning" | "ending"

const TYPE_OPTIONS: Array<{ value: MutashabihatKind; label: string; shortLabel: string }> = [
  { value: "identical", label: "آيات متطابقة", shortLabel: "المتطابقة" },
  { value: "similar", label: "الآيات المتشابهة", shortLabel: "المتشابهة" },
  { value: "beginning", label: "فواتح الآيات", shortLabel: "الفواتح" },
  { value: "ending", label: "خواتم الآيات", shortLabel: "الخواتم" },
]

const ALL_TYPES = TYPE_OPTIONS.map((option) => option.value)

const TYPE_LABELS: Record<MutashabihatKind, string> = {
  identical: "آيات متطابقة",
  similar: "الآيات المتشابهة",
  beginning: "فواتح الآيات",
  ending: "خواتم الآيات",
}

type SurahSummary = {
  id: number
  name: string
  count: number
}

export type MutashabihatBrowseVerse = ContextVerse & {
  followingVerses?: ContextVerse[]
  hasMoreFollowing?: boolean
  similarCount?: number
  typeCounts?: Record<MutashabihatKind, number>
}

type BrowseVerse = MutashabihatBrowseVerse

type TextSegment = {
  text: string
  highlighted: boolean
}

type SimilarVerse = BrowseVerse & {
  kind: MutashabihatKind
  similarity: number
  sharedWords: number
  segments: TextSegment[]
  sourceSegments: TextSegment[]
}

type MutashabihatDetail = {
  verseKey: string
  source: BrowseVerse | null
  similar: SimilarVerse[]
  categoryCounts?: Record<MutashabihatKind, number>
  selectedTypes?: MutashabihatKind[]
  totalSimilar?: number
  methodology?: "similar" | "local"
  offline?: boolean
  cached?: boolean
  attribution?: { name: string; url: string }
  error?: string
}

type MutashabihatBrowserProps = {
  onBack: () => void
  onOpenVerse: (verse: BrowseVerse) => void
}

function renderSegments(segments: TextSegment[]) {
  return (
    <span className="font-quran text-lg leading-9 sm:text-xl sm:leading-10" data-quran-content>
      {segments.map((segment, index) => (
        <span
          key={`${index}-${segment.text.slice(0, 12)}`}
          className={segment.highlighted
            ? "bg-[var(--quran-highlight)]/18 text-[var(--quran-highlight)] [box-decoration-break:clone]"
            : undefined}
        >
          {segment.text}
        </span>
      ))}
    </span>
  )
}

function TypeFilters({
  selected,
  onChange,
}: {
  selected: MutashabihatKind[]
  onChange: (types: MutashabihatKind[]) => void
}) {
  const allSelected = selected.length === ALL_TYPES.length
  const allState = allSelected ? true : selected.length > 0 ? "indeterminate" : false

  return (
    <fieldset aria-label="أنواع المتشابهات">
      <legend className="sr-only">أنواع المتشابهات</legend>
      <div className="grid grid-cols-2 gap-px overflow-hidden border bg-border sm:grid-cols-5">
        <Label
          htmlFor="mutashabihat-type-all"
          className="col-span-2 flex min-h-9 cursor-pointer items-center gap-2 bg-background px-2.5 text-xs font-semibold sm:col-span-1"
        >
          <Checkbox
            id="mutashabihat-type-all"
            checked={allState}
            onCheckedChange={(checked) => onChange(checked ? ALL_TYPES : [])}
          />
          جميع الأنواع
        </Label>
        {TYPE_OPTIONS.map((option) => {
          const checked = selected.includes(option.value)
          return (
            <Label
              key={option.value}
              htmlFor={`mutashabihat-type-${option.value}`}
              className="flex min-h-9 cursor-pointer items-center gap-2 bg-background px-2.5 text-xs font-medium"
            >
              <Checkbox
                id={`mutashabihat-type-${option.value}`}
                checked={checked}
                onCheckedChange={(nextChecked) => onChange(nextChecked
                  ? ALL_TYPES.filter((type) => selected.includes(type) || type === option.value)
                  : selected.filter((type) => type !== option.value))}
              />
              {option.shortLabel}
            </Label>
          )
        })}
      </div>
    </fieldset>
  )
}

function ResultRows({
  verses,
  onSelect,
}: {
  verses: BrowseVerse[]
  onSelect: (verse: BrowseVerse) => void
}) {
  return (
    <div className="divide-y border-y">
      {verses.map((verse) => (
        <button
          key={verse.verseKey}
          type="button"
          className="block w-full px-3 py-4 text-right transition-colors hover:bg-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4"
          onClick={() => onSelect(verse)}
        >
          <span className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
            <span className="text-primary">سورة {verse.surahName} · الآية {verse.ayah}</span>
            <span className="text-muted-foreground">صفحة {verse.page}</span>
          </span>
          <span className="font-quran block text-lg leading-9 text-foreground sm:text-xl sm:leading-10" data-quran-content>
            {verse.text}
          </span>
        </button>
      ))}
    </div>
  )
}

export function MutashabihatBrowser({ onBack, onOpenVerse }: MutashabihatBrowserProps) {
  const detailRequestRef = useRef(0)
  const [selectedTypes, setSelectedTypes] = useState<MutashabihatKind[]>(ALL_TYPES)
  const [surahs, setSurahs] = useState<SurahSummary[]>([])
  const [surahsLoading, setSurahsLoading] = useState(true)
  const [surahsError, setSurahsError] = useState<string | null>(null)
  const [selectedSurah, setSelectedSurah] = useState<SurahSummary | null>(null)
  const [surahVerses, setSurahVerses] = useState<BrowseVerse[]>([])
  const [surahLoading, setSurahLoading] = useState(false)
  const [surahError, setSurahError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<BrowseVerse[]>([])
  const [searchTotal, setSearchTotal] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [detail, setDetail] = useState<MutashabihatDetail | null>(null)
  const [detailTarget, setDetailTarget] = useState<BrowseVerse | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const trimmedQuery = query.trim()
  const searchActive = trimmedQuery.length >= MIN_SEARCH_LENGTH
  const selectedTypesKey = selectedTypes.join(",")

  useEffect(() => {
    const controller = new AbortController()
    setSurahsLoading(true)
    setSurahsError(null)
    fetch(`/api/quran/mutashabihat?mode=surahs&types=${encodeURIComponent(selectedTypesKey)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { surahs?: SurahSummary[]; error?: string }
        if (!response.ok) throw new Error(data.error || "تعذر تحميل فهرس السور")
        setSurahs(data.surahs ?? [])
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setSurahsError(error instanceof Error ? error.message : "تعذر تحميل فهرس السور")
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSurahsLoading(false)
      })
    return () => controller.abort()
  }, [selectedTypesKey])

  useEffect(() => {
    if (!selectedSurah) {
      setSurahVerses([])
      setSurahError(null)
      return
    }
    const controller = new AbortController()
    setSurahLoading(true)
    setSurahError(null)
    fetch(`/api/quran/mutashabihat?mode=surah&surah=${selectedSurah.id}&types=${encodeURIComponent(selectedTypesKey)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json() as { verses?: BrowseVerse[]; error?: string }
        if (!response.ok) throw new Error(data.error || "تعذر تحميل آيات السورة")
        setSurahVerses(data.verses ?? [])
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") {
          setSurahError(error instanceof Error ? error.message : "تعذر تحميل آيات السورة")
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setSurahLoading(false)
      })
    return () => controller.abort()
  }, [selectedSurah, selectedTypesKey])

  useEffect(() => {
    if (!searchActive) {
      setSearchResults([])
      setSearchTotal(0)
      setSearchLoading(false)
      setSearchError(null)
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setSearchLoading(true)
      setSearchError(null)
      fetch(`/api/quran/mutashabihat?mode=search&types=${encodeURIComponent(selectedTypesKey)}&q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json() as { results?: BrowseVerse[]; total?: number; error?: string }
          if (!response.ok) throw new Error(data.error || "تعذر البحث في المتشابهات")
          setSearchResults(data.results ?? [])
          setSearchTotal(data.total ?? 0)
        })
        .catch((error) => {
          if ((error as Error).name !== "AbortError") {
            setSearchError(error instanceof Error ? error.message : "تعذر البحث في المتشابهات")
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchLoading(false)
        })
    }, 280)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [searchActive, trimmedQuery, selectedTypesKey])

  const openDetail = async (verse: BrowseVerse) => {
    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setDetail(null)
    setDetailTarget(verse)
    setDetailError(null)
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/quran/mutashabihat?verseKey=${encodeURIComponent(verse.verseKey)}&types=${encodeURIComponent(selectedTypesKey)}&source=categories-v1`)
      const data = await response.json() as MutashabihatDetail
      if (!response.ok) throw new Error(data.error || "تعذر تحميل المتشابهات")
      if (requestId !== detailRequestRef.current) return
      setDetail(data)
      if (selectedTypes.length === ALL_TYPES.length) {
        void storeExactMutashabihat(data as OfflineMutashabihatResponse).catch(() => undefined)
      }
    } catch (error) {
      const cached = await readExactMutashabihat(verse.verseKey).catch(() => null)
      if (requestId !== detailRequestRef.current) return
      if (cached && selectedTypes.length === ALL_TYPES.length) setDetail(cached as MutashabihatDetail)
      else setDetailError(error instanceof Error ? error.message : "تعذر تحميل المتشابهات")
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false)
    }
  }

  const goBack = () => {
    if (detail || detailLoading || detailError) {
      detailRequestRef.current += 1
      setDetail(null)
      setDetailTarget(null)
      setDetailLoading(false)
      setDetailError(null)
      return
    }
    if (searchActive || query) {
      setQuery("")
      return
    }
    if (selectedSurah) {
      setSelectedSurah(null)
      return
    }
    onBack()
  }

  const retryCurrentView = () => {
    if (detailError && detailTarget) {
      void openDetail(detailTarget)
      return
    }
    window.location.reload()
  }

  const titleVerse = detail?.source ?? detailTarget
  const title = titleVerse
    ? `سورة ${titleVerse.surahName} · الآية ${titleVerse.ayah}`
    : selectedSurah && !searchActive
      ? `سورة ${selectedSurah.name}`
      : "المتشابهات"

  return (
    <main className="mx-auto min-h-[calc(100dvh-3rem)] w-full max-w-[1600px] text-right" dir="rtl">
      <header className="sticky top-12 z-20 border-b bg-background/95 backdrop-blur sm:top-0">
        <div className="flex min-h-14 items-center gap-2 px-3 sm:px-6 lg:px-10">
          <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="الرجوع" onClick={goBack}>
            <ArrowRight />
          </Button>
          <span className="grid size-8 shrink-0 place-items-center rounded-sm bg-secondary text-primary">
            <GitCompareArrows className="size-4" />
          </span>
          <h2 className="min-w-0 flex-1 truncate font-bold">{title}</h2>
          {detail?.source && (
            <Button variant="outline" size="sm" onClick={() => onOpenVerse(detail.source!)}>
              <ExternalLink /> فتح في المصحف
            </Button>
          )}
        </div>
        {!detail && !detailLoading && !detailError && (
          <div className="border-t px-3 py-2 sm:px-6 lg:px-10">
            <div className="mx-auto max-w-5xl space-y-2">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ابحث بنص الآية أو اسم السورة"
                  className="pe-9 ps-9"
                  aria-label="البحث في المتشابهات"
                />
                {query && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="absolute left-2 top-1/2 -translate-y-1/2"
                    aria-label="مسح البحث"
                    onClick={() => setQuery("")}
                  >
                    <X />
                  </Button>
                )}
              </div>
              <TypeFilters selected={selectedTypes} onChange={setSelectedTypes} />
            </div>
          </div>
        )}
      </header>

      <div className="px-3 py-5 sm:px-6 sm:py-7 lg:px-10">
        {detailLoading ? (
          <div className="grid min-h-72 place-items-center"><LoaderCircle className="size-7 animate-spin text-primary" /></div>
        ) : detailError ? (
          <div className="grid min-h-72 place-items-center gap-3 text-center">
            <p className="text-sm text-destructive">{detailError}</p>
            <Button variant="outline" onClick={retryCurrentView}><RotateCcw /> إعادة المحاولة</Button>
          </div>
        ) : detail?.source ? (
          <div className="mx-auto max-w-5xl">
            <section className="border-y px-3 py-5 sm:px-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                <span className="text-primary">الآية الأصلية</span>
                <span className="text-muted-foreground">صفحة {detail.source.page}</span>
              </div>
              <VerseWithFollowingContext
                key={`source:${detail.source.verseKey}`}
                verseKey={detail.source.verseKey}
                followingVerses={detail.source.followingVerses}
                hasMoreFollowing={detail.source.hasMoreFollowing}
                className="font-quran text-xl leading-10 sm:text-2xl sm:leading-[2.2]"
              >
                {detail.source.text}
              </VerseWithFollowingContext>
            </section>

            <section className="mt-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-bold">المواضع المتشابهة</h3>
                <span className="text-xs text-muted-foreground">{detail.similar.length} موضع</span>
              </div>
              {detail.similar.length === 0 ? (
                <p className="border-y py-10 text-center text-sm text-muted-foreground">
                  لا توجد مواضع من النوع المحدد لهذه الآية.
                </p>
              ) : TYPE_OPTIONS.map((option) => {
                const items = detail.similar.filter((item) => item.kind === option.value)
                if (items.length === 0) return null
                return (
                  <div key={option.value} className="mb-6 last:mb-0">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-primary">{TYPE_LABELS[option.value]}</h4>
                      <span className="text-xs text-muted-foreground">{items.length} موضع</span>
                    </div>
                    <div className="divide-y border-y">
                      {items.map((item) => (
                        <article key={`${item.kind}-${item.verseKey}`} className="px-3 py-4 sm:px-5">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                            <span className="text-primary">سورة {item.surahName} · الآية {item.ayah}</span>
                            <span className="text-muted-foreground">
                              {item.similarity > 0 ? `${item.similarity}% · ` : ""}{item.sharedWords} كلمات مشتركة · صفحة {item.page}
                            </span>
                          </div>
                          <VerseWithFollowingContext
                            key={`${item.kind}:${item.verseKey}`}
                            verseKey={item.verseKey}
                            followingVerses={item.followingVerses}
                            hasMoreFollowing={item.hasMoreFollowing}
                            className="font-quran text-lg leading-9 text-foreground sm:text-xl sm:leading-10"
                          >
                            {renderSegments(item.segments)}
                          </VerseWithFollowingContext>
                          <div className="mt-3 flex justify-end">
                            <Button variant="ghost" size="sm" onClick={() => onOpenVerse(item)}>
                              <ExternalLink /> فتح في المصحف
                            </Button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )
              })}
            </section>

            {detail.attribution && (
              <p className="mt-5 text-center text-xs text-muted-foreground">
                المصدر: <a className="underline underline-offset-4" href={detail.attribution.url} target="_blank" rel="noreferrer">{detail.attribution.name}</a>
              </p>
            )}
          </div>
        ) : searchActive ? (
          <div className="mx-auto max-w-5xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold">نتائج البحث</h3>
              {!searchLoading && !searchError && <span className="text-xs text-muted-foreground">{searchTotal} نتيجة</span>}
            </div>
            {selectedTypes.length === 0 ? (
              <p className="border-y py-10 text-center text-sm text-muted-foreground">اختر نوعًا واحدًا على الأقل لعرض النتائج.</p>
            ) : searchLoading ? (
              <div className="grid min-h-52 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" /></div>
            ) : searchError ? (
              <p className="border-y py-10 text-center text-sm text-destructive">{searchError}</p>
            ) : searchResults.length === 0 ? (
              <p className="border-y py-10 text-center text-sm text-muted-foreground">لا توجد آيات مطابقة للبحث.</p>
            ) : (
              <>
                <ResultRows verses={searchResults} onSelect={(verse) => void openDetail(verse)} />
                {searchTotal > searchResults.length && (
                  <p className="pt-3 text-center text-xs text-muted-foreground">أول {searchResults.length} نتيجة من {searchTotal}</p>
                )}
              </>
            )}
          </div>
        ) : selectedSurah ? (
          <div className="mx-auto max-w-5xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold">آيات السورة</h3>
              {!surahLoading && !surahError && <span className="text-xs text-muted-foreground">{surahVerses.length} آية</span>}
            </div>
            {selectedTypes.length === 0 ? (
              <p className="border-y py-10 text-center text-sm text-muted-foreground">اختر نوعًا واحدًا على الأقل لعرض آيات السورة.</p>
            ) : surahLoading ? (
              <div className="grid min-h-52 place-items-center"><LoaderCircle className="size-6 animate-spin text-primary" /></div>
            ) : surahError ? (
              <p className="border-y py-10 text-center text-sm text-destructive">{surahError}</p>
            ) : (
              <ResultRows verses={surahVerses} onSelect={(verse) => void openDetail(verse)} />
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-6xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-bold">السور</h3>
              {!surahsLoading && !surahsError && <span className="text-xs text-muted-foreground">{surahs.length} سورة</span>}
            </div>
            {selectedTypes.length === 0 ? (
              <p className="border-y py-12 text-center text-sm text-muted-foreground">اختر نوعًا واحدًا على الأقل لعرض السور.</p>
            ) : surahsLoading ? (
              <div className="grid min-h-72 place-items-center"><LoaderCircle className="size-7 animate-spin text-primary" /></div>
            ) : surahsError ? (
              <div className="grid min-h-72 place-items-center gap-3 text-center">
                <p className="text-sm text-destructive">{surahsError}</p>
                <Button variant="outline" onClick={() => window.location.reload()}><RotateCcw /> إعادة المحاولة</Button>
              </div>
            ) : (
              <div className="grid border-x border-t sm:grid-cols-2 lg:grid-cols-3">
                {surahs.filter((surah) => surah.count > 0).map((surah) => (
                  <button
                    key={surah.id}
                    type="button"
                    className="flex min-h-14 items-center gap-3 border-b px-3 text-right transition-colors hover:bg-accent/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4 sm:[&:nth-child(odd)]:border-l lg:[&:nth-child(odd)]:border-l-0 lg:[&:not(:nth-child(3n))]:border-l"
                    onClick={() => setSelectedSurah(surah)}
                  >
                    <span className="w-7 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">{surah.id}</span>
                    <strong className="min-w-0 flex-1 truncate">{surah.name}</strong>
                    <span className="text-xs tabular-nums text-muted-foreground">{surah.count} آية</span>
                  </button>
                ))}
              </div>
            )}
            <p className="mt-5 text-center text-xs text-muted-foreground">المصدر: موسوعة القرآن الكريم - Quranpedia</p>
          </div>
        )}
      </div>
    </main>
  )
}
