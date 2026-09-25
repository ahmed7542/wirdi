"use client"

import { useEffect, useState, type ReactNode } from "react"
import {
  Bookmark,
  BookOpen,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CircleAlert,
  Clock3,
  FileDown,
  GitCompareArrows,
  Headphones,
  Mic,
  Play,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react"

import { useInterfaceLanguage } from "@/components/interface-language-provider"
import type { LearningPlanRange } from "@/components/learning-plan"
import {
  MutashabihatBrowser,
  type MutashabihatBrowseVerse,
} from "@/components/mutashabihat-browser"
import { Badge } from "@/components/ui/badge"
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
import type { VerseHighlight } from "@/components/quran-page"
import {
  loadReadingStats,
  loadReviewSignals,
  loadSessionHistory,
  localDateKey,
  type ReadingStats,
  type ReviewSignal,
  type SessionHistoryItem,
} from "@/lib/wird-activity"
import {
  readLastWirdBackupAt,
  WIRD_BACKUP_CHANGE_EVENT,
} from "@/lib/wird-backup"
import { HIGHLIGHT_CATEGORY_LABELS } from "@/lib/wird-review"
import {
  KHATMA_CHANGE_EVENT,
  KHATMA_STORAGE_KEY,
  readKhatmaPlan,
  type KhatmaPlan,
} from "@/lib/khatma-plan"
import {
  getLearningPlanStatus,
  LEARNING_PLAN_LABELS,
  LEARNING_PLAN_TYPES,
  loadLearningPlans,
  type LearningPlan,
} from "@/lib/learning-plan"

export type DashboardBookmark = {
  id: string
  page: number
  verseKey: string
  chapterId: number
  chapterName?: string
}

export type DashboardReviewDetail = {
  verseKey: string
  chapterName: string
  verseText: string
  pageNumber: number
}

type WirdDashboardProps = {
  open: boolean
  bookmarks: DashboardBookmark[]
  reviews: VerseHighlight[]
  navigationPanel: ReactNode
  onOpenKhatma: () => void
  onOpenLearningPlan: () => void
  onOpenBackupSettings: () => void
  onStartLearningPlanRange: (range: LearningPlanRange) => void
  onOpenMutashabihatVerse: (verse: MutashabihatBrowseVerse) => void
  onOpenBookmark: (bookmark: DashboardBookmark) => void
  onDeleteBookmark: (bookmark: DashboardBookmark) => void
  onMoveBookmark: (bookmark: DashboardBookmark, direction: "up" | "down") => void
  onOpenReview: (highlight: VerseHighlight) => void
  onListenReview: (highlight: VerseHighlight) => void
  onReciteReview: (highlight: VerseHighlight) => void
  onReviewDetailsLoaded: (details: DashboardReviewDetail[]) => void
  onReviewOutcome: (verseKey: string, outcome: "mastered" | "retry") => void
}

const EMPTY_STATS: ReadingStats = {
  totalSeconds: 0,
  sessionsCompleted: 0,
  days: {},
  pages: [],
}

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} دقيقة`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours} س ${remainder} د` : `${hours} ساعة`
}

function getHighlightedWords(highlight: VerseHighlight) {
  if (!highlight.verseText) return ""
  const words = highlight.verseText.trim().split(/\s+/)
  const start = Math.max(0, Math.min(highlight.startPosition, highlight.endPosition) - 1)
  const end = Math.min(words.length, Math.max(highlight.startPosition, highlight.endPosition))
  return words.slice(start, end).join(" ")
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

export function WirdDashboard({
  open,
  bookmarks,
  reviews,
  navigationPanel,
  onOpenKhatma,
  onOpenLearningPlan,
  onOpenBackupSettings,
  onStartLearningPlanRange,
  onOpenMutashabihatVerse,
  onOpenBookmark,
  onDeleteBookmark,
  onMoveBookmark,
  onOpenReview,
  onListenReview,
  onReciteReview,
  onReviewDetailsLoaded,
  onReviewOutcome,
}: WirdDashboardProps) {
  const { language } = useInterfaceLanguage()
  const [stats, setStats] = useState<ReadingStats>(EMPTY_STATS)
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([])
  const [reviewSignals, setReviewSignals] = useState<ReviewSignal[]>([])
  const [khatma, setKhatma] = useState<KhatmaPlan | null>(null)
  const [learningPlans, setLearningPlans] = useState<LearningPlan[]>([])
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<"home" | "mutashabihat">("home")
  const [pendingBookmarkDeletion, setPendingBookmarkDeletion] = useState<DashboardBookmark | null>(null)

  useEffect(() => {
    if (!open) {
      setActiveSection("home")
      return
    }
    const refresh = () => {
      setStats(loadReadingStats())
      setSessionHistory(loadSessionHistory())
      setReviewSignals(loadReviewSignals())
      setKhatma(readKhatmaPlan())
      setLearningPlans(loadLearningPlans())
      setLastBackupAt(readLastWirdBackupAt(window.localStorage))
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === KHATMA_STORAGE_KEY) refresh()
    }
    refresh()
    window.addEventListener("storage", handleStorage)
    window.addEventListener("wird-activity-changed", refresh)
    window.addEventListener("wird-learning-plan-changed", refresh)
    window.addEventListener(KHATMA_CHANGE_EVENT, refresh)
    window.addEventListener(WIRD_BACKUP_CHANGE_EVENT, refresh)
    return () => {
      window.removeEventListener("storage", handleStorage)
      window.removeEventListener("wird-activity-changed", refresh)
      window.removeEventListener("wird-learning-plan-changed", refresh)
      window.removeEventListener(KHATMA_CHANGE_EVENT, refresh)
      window.removeEventListener(WIRD_BACKUP_CHANGE_EVENT, refresh)
    }
  }, [open])

  const missingReviewKeys = reviews
    .filter((highlight) => !highlight.chapterName || !highlight.verseText)
    .slice(0, 20)
    .map((highlight) => highlight.verseKey)
    .join(",")

  useEffect(() => {
    if (!open || !missingReviewKeys) return
    const controller = new AbortController()
    fetch(`/api/quran/review-details?keys=${encodeURIComponent(missingReviewKeys)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Review details returned ${response.status}`)
        return response.json() as Promise<{ details?: DashboardReviewDetail[] }>
      })
      .then((data) => {
        if (data.details?.length) onReviewDetailsLoaded(data.details)
      })
      .catch((error) => {
        if ((error as Error).name !== "AbortError") console.error("Failed to load review details", error)
      })
    return () => controller.abort()
  }, [missingReviewKeys, onReviewDetailsLoaded, open])

  if (!open) return null
  if (activeSection === "mutashabihat") {
    return (
      <MutashabihatBrowser
        onBack={() => setActiveSection("home")}
        onOpenVerse={onOpenMutashabihatVerse}
      />
    )
  }

  const todaySeconds = stats.days[localDateKey(new Date())] ?? 0
  const weekStartedAt = new Date()
  weekStartedAt.setHours(0, 0, 0, 0)
  weekStartedAt.setDate(weekStartedAt.getDate() - 6)
  const weeklySeconds = Object.entries(stats.days).reduce((total, [date, seconds]) => {
    const [year, month, day] = date.split("-").map(Number)
    return new Date(year, month - 1, day).getTime() >= weekStartedAt.getTime() ? total + seconds : total
  }, 0)
  const weeklyCompletedSessions = sessionHistory.filter((session) => (
    session.completed && session.updatedAt >= weekStartedAt.getTime()
  )).length
  const activeWeekDays = Object.entries(stats.days).filter(([date, seconds]) => {
    const [year, month, day] = date.split("-").map(Number)
    return seconds > 0 && new Date(year, month - 1, day).getTime() >= weekStartedAt.getTime()
  }).length
  const khatmaCompleted = Math.min(Math.max(khatma?.completedPage ?? 0, 0), 604)
  const khatmaRemaining = 604 - khatmaCompleted
  const khatmaProgress = Math.round((khatmaCompleted / 604) * 100)
  const learningPlanEntries = learningPlans.map((plan) => ({ plan, status: getLearningPlanStatus(plan) }))
  const activeLearningPlan = learningPlanEntries.find(({ status }) => status.activeToday && status.todayAyahs > 0)
  const memorizationPlan = learningPlanEntries.find(({ plan }) => plan.type === "new")

  const nextActivity = activeLearningPlan
    ? {
        label: `ابدأ مقرر ${LEARNING_PLAN_LABELS[activeLearningPlan.plan.type]}`,
        run: () => onStartLearningPlanRange({
          startPage: activeLearningPlan.status.startPage,
          endPage: activeLearningPlan.status.endPage,
          startVerseKey: activeLearningPlan.status.startVerseKey,
          endVerseKey: activeLearningPlan.status.endVerseKey,
          type: activeLearningPlan.plan.type,
          planType: activeLearningPlan.plan.type,
        }),
      }
    : memorizationPlan?.status.recentReview
      ? {
          label: "راجع الموضع التالي",
          run: () => onStartLearningPlanRange({ ...memorizationPlan.status.recentReview!, type: "review" }),
        }
      : reviews[0]
        ? { label: "راجع الموضع التالي", run: () => onOpenReview(reviews[0]) }
        : khatma && khatmaRemaining > 0
          ? { label: "تابع الختمة", run: onOpenKhatma }
          : learningPlans.length
            ? { label: "عرض الخطط", run: onOpenLearningPlan }
            : { label: "أنشئ خطة", run: onOpenLearningPlan }

  const todaySection = (
    <section className="border-t py-7">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">اليوم</h2>
          <p className="text-xs text-muted-foreground">المقررات والمواضع التالية</p>
        </div>
        <Button size="sm" onClick={nextActivity.run}>
          {nextActivity.label === "أنشئ خطة" || nextActivity.label === "عرض الخطط" ? <Target /> : <Play />}
          {nextActivity.label}
        </Button>
      </div>
      <div className="grid grid-cols-2 divide-x divide-x-reverse border-y sm:grid-cols-4">
        <div className="px-3 py-3">
          <p className="text-xs text-muted-foreground">الختمة</p>
          <p className="mt-1 truncate text-sm font-semibold">{khatma ? `صفحة ${Math.min(604, khatmaCompleted + 1)}` : "غير مفعلة"}</p>
        </div>
        {LEARNING_PLAN_TYPES.map((planType) => {
          const entry = learningPlanEntries.find(({ plan }) => plan.type === planType)
          return (
            <div key={planType} className="px-3 py-3">
              <p className="text-xs text-muted-foreground">{LEARNING_PLAN_LABELS[planType]}</p>
              <p className="mt-1 truncate text-sm font-semibold">
                {entry
                  ? entry.status.activeToday && entry.status.todayAyahs > 0
                    ? `${entry.status.todayAyahs} آية`
                    : "راحة اليوم"
                  : "غير مفعلة"}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )

  return (
    <>
    <main className="mx-auto min-h-[calc(100dvh-3rem)] w-full max-w-[1600px] px-0 py-0 text-right sm:px-6 sm:py-4 lg:px-10" dir="rtl">
      <h1 className="sr-only">لوحة وِرد</h1>
      <section className="border-b sm:border-x">
        {navigationPanel}
      </section>

      <div className="px-3 sm:px-0">
      <section className="border-t py-6">
        <div className="mb-4">
          <h2 className="font-bold">الخطط</h2>
          <p className="text-sm text-muted-foreground">مقرر الختمة والحفظ والمراجعة</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="col-span-2 flex min-h-24 items-center gap-4 rounded-md border bg-card p-4 text-right transition-colors hover:bg-accent sm:col-span-1"
            onClick={onOpenKhatma}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-md border bg-background text-primary"><CalendarCheck2 /></span>
            <span className="min-w-0 flex-1">
              <strong className="block">الختمة</strong>
              <small className="block truncate text-muted-foreground">
                {khatma ? `${khatmaProgress}% · متبقي ${khatmaRemaining} صفحة` : "إنشاء مسار ختمة"}
              </small>
            </span>
            <ChevronLeft className="size-4 text-muted-foreground" />
          </button>
          <button
            type="button"
            className="flex min-h-24 min-w-0 items-center gap-3 rounded-md border bg-card p-3 text-right transition-colors hover:bg-accent sm:gap-4 sm:p-4"
            onClick={onOpenLearningPlan}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-md border bg-background text-primary"><Target /></span>
            <span className="min-w-0 flex-1">
              <strong className="block">خطط الحفظ والمراجعة</strong>
              <small className="block truncate text-xs text-muted-foreground">
                {learningPlans.length
                  ? `${learningPlans.length} من 3 · ${learningPlans.map((plan) => LEARNING_PLAN_LABELS[plan.type]).join("، ")}`
                  : "أنشئ خطة للحفظ أو التثبيت أو المراجعة"}
              </small>
            </span>
            <ChevronLeft className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
          </button>
          <button
            type="button"
            className="flex min-h-24 min-w-0 items-center gap-3 rounded-md border bg-card p-3 text-right transition-colors hover:bg-accent sm:gap-4 sm:p-4"
            onClick={() => setActiveSection("mutashabihat")}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-md border bg-background text-primary"><GitCompareArrows /></span>
            <span className="min-w-0 flex-1">
              <strong className="block">المتشابهات</strong>
              <small className="block truncate text-xs text-muted-foreground">تثبيت الحفظ والمراجعة</small>
            </span>
            <ChevronLeft className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
          </button>
        </div>
      </section>

      {todaySection}

      <section className="border-t py-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold"><CalendarClock className="size-4 text-primary" />مراجعة اليوم</h2>
            <p className="text-sm text-muted-foreground">المواضع المستحقة حسب جدول التثبيت</p>
          </div>
          <Badge variant={reviews.length ? "default" : "secondary"}>{reviews.length} موضع</Badge>
        </div>
        {reviews.length === 0 ? (
          <div className="flex items-center gap-2 border-y py-5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" />
            لا توجد مواضع مستحقة اليوم
          </div>
        ) : (
          <div className="divide-y border-y">
            {reviews.slice(0, 8).map((highlight) => {
              const verseNumber = highlight.verseKey.split(":")[1]
              const highlightedWords = getHighlightedWords(highlight)
              return (
                <div key={highlight.verseKey} className="py-4">
                  <button
                    type="button"
                    className="group flex w-full items-start gap-3 px-2 text-right"
                    onClick={() => onOpenReview(highlight)}
                  >
                    <CircleAlert className="mt-1 size-4 shrink-0 text-[var(--quran-highlight)]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <strong>سورة {highlight.chapterName ?? "..."}</strong>
                        <span className="text-muted-foreground">الآية {verseNumber}</span>
                      </span>
                      <span className="font-quran mt-2 block whitespace-normal text-lg leading-9 text-foreground group-hover:text-primary" data-quran-content>
                        {highlight.verseText ?? "جارٍ تحميل نص الآية..."}
                      </span>
                      <span className="mt-3 block border-s-2 border-[var(--quran-highlight)] ps-3">
                        <small className="block text-xs text-muted-foreground">
                          الكلمات التي تحتاج تثبيت · {HIGHLIGHT_CATEGORY_LABELS[highlight.category ?? "reinforce"]}
                        </small>
                        <strong className="font-quran mt-1 block whitespace-normal text-base leading-8 text-[var(--quran-highlight)]" data-quran-content>
                          {highlightedWords || "جارٍ تحميل الكلمات المحددة..."}
                        </strong>
                      </span>
                    </span>
                  </button>
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2 px-2">
                    <Button size="sm" variant="ghost" onClick={() => onListenReview(highlight)}>
                      <Headphones /> استماع
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onReciteReview(highlight)}>
                      <Mic /> تسميع
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onReviewOutcome(highlight.verseKey, "mastered")}>
                      <CheckCircle2 /> أتقنتها
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onReviewOutcome(highlight.verseKey, "retry")}>
                      <RotateCcw /> غدًا
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="border-t py-7">
        <div>
          <div className="mb-4">
            <h2 className="font-bold">علامات الوقوف</h2>
            <p className="text-sm text-muted-foreground">أقرب مواضع محفوظة</p>
          </div>
          <div className="divide-y border-y">
            {bookmarks.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">لا توجد علامات محفوظة</p>
            ) : bookmarks.slice(0, 5).map((bookmark, bookmarkIndex) => (
              <div key={bookmark.id} className="flex items-center gap-1">
                <div className="grid shrink-0 grid-rows-2" aria-label={`ترتيب علامة الآية ${bookmark.verseKey}`}>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6"
                    disabled={bookmarkIndex === 0}
                    aria-label={`تحريك علامة الآية ${bookmark.verseKey} لأعلى`}
                    onClick={() => onMoveBookmark(bookmark, "up")}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6"
                    disabled={bookmarkIndex === bookmarks.length - 1}
                    aria-label={`تحريك علامة الآية ${bookmark.verseKey} لأسفل`}
                    onClick={() => onMoveBookmark(bookmark, "down")}
                  >
                    <ChevronDown />
                  </Button>
                </div>
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-right hover:bg-accent"
                  onClick={() => onOpenBookmark(bookmark)}
                >
                  <Bookmark className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-base">سورة {bookmark.chapterName ?? bookmark.chapterId}</strong>
                    <small className="block truncate text-xs text-muted-foreground">
                      الآية {bookmark.verseKey} · صفحة {bookmark.page}
                    </small>
                  </span>
                  <ChevronLeft className="size-4 text-muted-foreground" />
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-destructive hover:text-destructive"
                  aria-label={`حذف علامة الآية ${bookmark.verseKey}`}
                  onClick={() => setPendingBookmarkDeletion(bookmark)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t py-7">
        <div className="mb-4">
          <h2 className="font-bold">الإحصائيات</h2>
          <p className="text-sm text-muted-foreground">ملخص نشاط القراءة والجلسات</p>
        </div>
        <div className="grid grid-cols-2 border-y sm:grid-cols-4">
          <div className="border-b p-4 text-right sm:border-b-0 sm:border-l">
            <Clock3 className="mb-3 size-5 text-primary" />
            <p className="text-xs text-muted-foreground">قراءة اليوم</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{formatDuration(todaySeconds)}</p>
          </div>
          <div className="border-b p-4 text-right sm:border-b-0 sm:border-l">
            <Target className="mb-3 size-5 text-primary" />
            <p className="text-xs text-muted-foreground">إجمالي القراءة</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{formatDuration(stats.totalSeconds)}</p>
          </div>
          <div className="p-4 text-right max-sm:border-l sm:border-l">
            <BookOpen className="mb-3 size-5 text-primary" />
            <p className="text-xs text-muted-foreground">صفحات فُتحت</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{stats.pages.length}</p>
          </div>
          <div className="p-4 text-right">
            <RotateCcw className="mb-3 size-5 text-primary" />
            <p className="text-xs text-muted-foreground">جلسات مكتملة</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{stats.sessionsCompleted}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-x-reverse border-b text-center text-xs">
          <div className="px-2 py-3">
            <p className="text-muted-foreground">قراءة الأسبوع</p>
            <strong className="mt-1 block text-sm tabular-nums">{formatDuration(weeklySeconds)}</strong>
          </div>
          <div className="px-2 py-3">
            <p className="text-muted-foreground">أيام النشاط</p>
            <strong className="mt-1 block text-sm tabular-nums">{activeWeekDays} / 7</strong>
          </div>
          <div className="px-2 py-3">
            <p className="text-muted-foreground">جلسات الأسبوع</p>
            <strong className="mt-1 block text-sm tabular-nums">{weeklyCompletedSessions}</strong>
          </div>
        </div>
        {reviewSignals.length > 0 && (
          <div className="border-b px-3 py-3">
            <p className="text-xs font-semibold">مقترحة للمراجعة من نمط الاستماع</p>
            <p className="mt-1 text-[11px] text-muted-foreground">مواضع تكرر الرجوع إليها أو إعادة تلاوتها على هذا الجهاز</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {reviewSignals.slice(0, 3).map((signal) => (
                <Badge key={signal.verseKey} variant="secondary">
                  {signal.chapterName} · {signal.verseKey} · {signal.count} مرات
                </Badge>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="border-t py-5" aria-label="حالة النسخ الاحتياطي">
        <button
          type="button"
          className="flex min-h-12 w-full items-start gap-3 rounded-md px-2 py-2 text-right text-sm text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="فتح إعدادات النسخ الاحتياطي"
          onClick={onOpenBackupSettings}
        >
          <FileDown className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block">آخر نسخة احتياطية: <strong className="font-medium text-foreground">{formatBackupDate(lastBackupAt, language)}</strong></span>
            {!lastBackupAt && (Boolean(khatma) || learningPlans.length > 0 || bookmarks.length >= 3) && (
              <span className="mt-1 block text-xs">بياناتك محفوظة على هذا الجهاز. يمكنك تصدير نسخة من تبويب التطبيق في الإعدادات.</span>
            )}
          </span>
          <ChevronLeft className="mt-0.5 size-4 shrink-0" />
        </button>
      </section>
      </div>
    </main>

    <AlertDialog
      open={Boolean(pendingBookmarkDeletion)}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setPendingBookmarkDeletion(null)
      }}
    >
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader className="text-right">
          <AlertDialogTitle>حذف علامة الوقوف؟</AlertDialogTitle>
          <AlertDialogDescription>
            ستُحذف علامة الآية {pendingBookmarkDeletion?.verseKey} من العلامات المسجلة.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (pendingBookmarkDeletion) onDeleteBookmark(pendingBookmarkDeletion)
              setPendingBookmarkDeletion(null)
            }}
          >
            <Trash2 /> حذف العلامة
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
