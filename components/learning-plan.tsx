"use client"

import { useCallback, useEffect, useState } from "react"
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  History,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Target,
  Trash2,
} from "lucide-react"

import { QuranSessionRangePicker, type NavigationRange } from "@/components/quran-navigation"
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  addLearningPlanDays,
  deleteLearningPlan,
  getLearningPlanStatus,
  learningPlanDateKey,
  learningPlanVerseKey,
  LEARNING_PLAN_LABELS,
  LEARNING_PLAN_TYPES,
  loadLearningPlans,
  redistributeLearningPlanOverdue,
  resolveLearningPlanRange,
  saveLearningPlan,
  WEEKDAY_LABELS,
  type LearningPlan,
  type LearningPlanType,
  type LearningScheduleMode,
} from "@/lib/learning-plan"

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

export type LearningPlanRange = {
  startPage: number
  endPage: number
  type: LearningPlanType
  planType?: LearningPlanType
  startVerseKey?: string
  endVerseKey?: string
}

type LearningPlanDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPage: number
  onOpenRange: (range: LearningPlanRange) => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.round(value || min), min), max)
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

export function LearningPlanDialog({ open, onOpenChange, currentPage, onOpenRange }: LearningPlanDialogProps) {
  const [plans, setPlans] = useState<LearningPlan[]>([])
  const [selectedType, setSelectedType] = useState<LearningPlanType>("new")
  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [todayKey, setTodayKey] = useState("1970-01-01")
  const [startPage, setStartPage] = useState(currentPage)
  const [endPage, setEndPage] = useState(Math.min(604, currentPage + 29))
  const [startVerseKey, setStartVerseKey] = useState<string | undefined>()
  const [endVerseKey, setEndVerseKey] = useState<string | undefined>()
  const [scheduleMode, setScheduleMode] = useState<LearningScheduleMode>("deadline")
  const [dailyPages, setDailyPages] = useState(1)
  const [endDate, setEndDate] = useState("1970-01-30")
  const [activeDays, setActiveDays] = useState<number[]>(ALL_DAYS)
  const [reviewEnabled, setReviewEnabled] = useState(true)
  const [reviewPages, setReviewPages] = useState(2)

  const applyPlanToForm = useCallback((saved: LearningPlan) => {
    setStartPage(saved.startPage)
    setEndPage(Math.min(604, saved.startPage + saved.targetPages - 1))
    setStartVerseKey(saved.startVerseKey)
    setEndVerseKey(saved.endVerseKey)
    setScheduleMode(saved.scheduleMode)
    setDailyPages(saved.dailyPages)
    setEndDate(saved.endDate)
    setActiveDays(saved.activeDays)
    setReviewEnabled(saved.reviewEnabled)
    setReviewPages(saved.reviewPages)
  }, [])

  const resetForm = useCallback((planType: LearningPlanType, today: string) => {
    setStartPage(currentPage)
    setEndPage(Math.min(604, currentPage + 29))
    setStartVerseKey(undefined)
    setEndVerseKey(undefined)
    setScheduleMode("deadline")
    setDailyPages(1)
    setEndDate(addLearningPlanDays(today, 29))
    setActiveDays(ALL_DAYS)
    setReviewEnabled(planType === "new")
    setReviewPages(2)
  }, [currentPage])

  useEffect(() => {
    if (!open) return
    const today = learningPlanDateKey(new Date())
    const savedPlans = loadLearningPlans()
    const initialPlan = savedPlans[0]
    const initialType = initialPlan?.type ?? "new"
    setTodayKey(today)
    setPlans(savedPlans)
    setSelectedType(initialType)
    setEditing(!initialPlan)
    if (initialPlan) applyPlanToForm(initialPlan)
    else resetForm(initialType, today)
  }, [applyPlanToForm, open, resetForm])

  const plan = plans.find((item) => item.type === selectedType) ?? null
  const status = plan ? getLearningPlanStatus(plan) : null
  const targetPages = Math.max(1, endPage - startPage + 1)
  const rangeChanged = Boolean(plan && (
    plan.startPage !== startPage ||
    plan.targetPages !== targetPages ||
    plan.startVerseKey !== startVerseKey ||
    plan.endVerseKey !== endVerseKey
  ))

  const setRange = (range: NavigationRange) => {
    setStartPage(range.startPage)
    setEndPage(range.endPage)
    setStartVerseKey(range.startVerseKey)
    setEndVerseKey(range.endVerseKey)
  }

  const selectPlanType = (nextType: LearningPlanType) => {
    const saved = plans.find((item) => item.type === nextType)
    setSelectedType(nextType)
    if (saved) {
      applyPlanToForm(saved)
      setEditing(false)
      return
    }
    resetForm(nextType, todayKey)
    setEditing(true)
  }

  const persistPlan = () => {
    const safeStartPage = clamp(startPage, 1, 604)
    const safeEndPage = clamp(endPage, safeStartPage, 604)
    const nextTargetPages = safeEndPage - safeStartPage + 1
    const resolvedRange = resolveLearningPlanRange(safeStartPage, safeEndPage, startVerseKey, endVerseKey)
    saveLearningPlan({
      version: 3,
      type: selectedType,
      startPage: safeStartPage,
      targetPages: nextTargetPages,
      startVerseKey: learningPlanVerseKey(resolvedRange.startAyahId),
      endVerseKey: learningPlanVerseKey(resolvedRange.endAyahId),
      startAyahId: resolvedRange.startAyahId,
      endAyahId: resolvedRange.endAyahId,
      completedAyahs: plan && !rangeChanged ? Math.min(plan.completedAyahs, resolvedRange.endAyahId - resolvedRange.startAyahId + 1) : 0,
      scheduleMode,
      dailyPages: clamp(dailyPages, 1, 100),
      endDate: endDate >= todayKey ? endDate : todayKey,
      activeDays: activeDays.length ? activeDays : ALL_DAYS,
      reviewEnabled: selectedType === "new" && reviewEnabled,
      reviewPages: clamp(reviewPages, 1, 30),
      redistributeOverdue: plan && !rangeChanged ? plan.redistributeOverdue : false,
      completedPages: plan && !rangeChanged
        ? Math.min(plan.completedPages, nextTargetPages)
        : 0,
      startedAt: plan && !rangeChanged ? plan.startedAt : todayKey,
      // eslint-disable-next-line react-hooks/purity
      updatedAt: Date.now(),
    })
    setPlans(loadLearningPlans())
    setEditing(false)
  }

  const openTodayAssignment = () => {
    if (!plan || !status || status.todayPages === 0) return
    onOpenRange({
      startPage: status.startPage,
      endPage: status.endPage,
      type: plan.type,
      planType: plan.type,
      startVerseKey: status.startVerseKey,
      endVerseKey: status.endVerseKey,
    })
    onOpenChange(false)
  }

  const openReviewRange = (range: { startPage: number; endPage: number; startVerseKey?: string; endVerseKey?: string }) => {
    onOpenRange({ ...range, type: "review" })
    onOpenChange(false)
  }

  const deletePlan = () => {
    const nextPlans = deleteLearningPlan(selectedType)
    setPlans(nextPlans)
    setDeleteOpen(false)
    resetForm(selectedType, todayKey)
    setEditing(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto text-right sm:max-w-2xl [&>button]:left-4 [&>button]:right-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="flex items-center gap-2">
              <Target className="size-5 text-primary" />
              خطط الحفظ والمراجعة
            </DialogTitle>
            <DialogDescription>
              أنشئ خطة مستقلة للحفظ أو التثبيت أو المراجعة، وتابع مقرر كل خطة دون التأثير في الأخرى.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2" data-learning-plans-selector>
            <ToggleGroup
              type="single"
              value={selectedType}
              onValueChange={(value) => value && selectPlanType(value as LearningPlanType)}
              variant="outline"
              className="grid grid-cols-3"
              aria-label="اختيار نوع الخطة"
            >
              {LEARNING_PLAN_TYPES.map((planType) => {
                const savedPlan = plans.find((item) => item.type === planType)
                const savedStatus = savedPlan ? getLearningPlanStatus(savedPlan) : null
                return (
                  <ToggleGroupItem
                    key={planType}
                    value={planType}
                    className="h-14 min-w-0 flex-col gap-1 px-1"
                    data-learning-plan-type={planType}
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold sm:text-sm">
                      {planType === "new" ? <BookOpen className="size-3.5" /> : planType === "reinforce" ? <ShieldCheck className="size-3.5" /> : <History className="size-3.5" />}
                      {LEARNING_PLAN_LABELS[planType]}
                    </span>
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {savedStatus ? `${savedStatus.progress}% مكتملة` : "غير منشأة"}
                    </span>
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>{plans.length} من 3 خطط نشطة</span>
              <span>{plan ? `الخطة المحددة: ${LEARNING_PLAN_LABELS[selectedType]}` : `جاهزة لإنشاء خطة ${LEARNING_PLAN_LABELS[selectedType]}`}</span>
            </div>
          </div>

          {plan && status && !editing ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-md border bg-muted/25 p-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">الخطة المحددة</p>
                  <p className="mt-1 text-lg font-bold">{LEARNING_PLAN_LABELS[plan.type]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    الصفحات {plan.startPage}–{status.rangeEndPage}
                    {plan.startVerseKey && plan.endVerseKey ? ` · الآيات ${plan.startVerseKey}–${plan.endVerseKey}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-left">
                  <p className="text-2xl font-bold tabular-nums">{status.progress}%</p>
                  <p className="text-xs text-muted-foreground">{status.completedAyahs}/{status.totalAyahs} آية</p>
                </div>
              </div>

              <Progress value={status.progress} className="h-2" />

              <div className="grid grid-cols-3 overflow-hidden rounded-md border bg-muted/15 text-center">
                <div className="border-l px-2 py-3">
                  <p className="text-xs text-muted-foreground">مقرر النشاط</p>
                  <p className="mt-1 font-bold tabular-nums">{status.dailyAyahs} آية</p>
                </div>
                <div className="border-l px-2 py-3">
                  <p className="text-xs text-muted-foreground">المتبقي</p>
                  <p className="mt-1 font-bold tabular-nums">{status.remainingAyahs} آية</p>
                </div>
                <div className="px-2 py-3">
                  <p className="text-xs text-muted-foreground">الإكمال المتوقع</p>
                  <p className="mt-1 font-bold tabular-nums">{displayDate(status.estimatedFinishDate)}</p>
                </div>
              </div>

              {status.remainingPages === 0 ? (
                <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-4 text-primary">
                  <CheckCircle2 /> اكتملت الخطة
                </div>
              ) : status.activeToday ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/5 p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{LEARNING_PLAN_LABELS[plan.type]} اليوم</p>
                    <p className="mt-1 text-lg font-bold">الآيات {status.startVerseKey}–{status.endVerseKey}</p>
                    <p className="text-xs text-muted-foreground">الصفحات {status.startPage}–{status.endPage} · {status.todayAyahs} آية</p>
                  </div>
                  <Button onClick={openTodayAssignment}>
                    <BookOpen /> فتح مقرر اليوم
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 p-4">
                  <div>
                    <p className="font-semibold">راحة مجدولة اليوم</p>
                    <p className="text-xs text-muted-foreground">النشاط القادم {displayDate(status.nextActiveDate)}</p>
                  </div>
                  <CalendarDays className="size-5 text-primary" />
                </div>
              )}

              {status.isOverdue && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4">
                  <div>
                    <p className="font-semibold text-destructive">متأخر {status.overdueAyahs} آية</p>
                    <p className="text-xs text-muted-foreground">
                      {status.redistributed ? "تم توزيع المتأخر على أيام النشاط القادمة." : "يمكن توزيع المقدار المتأخر على الأيام القادمة."}
                    </p>
                  </div>
                  {!status.redistributed && (
                    <Button variant="outline" size="sm" onClick={() => {
                      const next = redistributeLearningPlanOverdue(selectedType)
                      if (next) setPlans((current) => current.map((item) => item.type === next.type ? next : item))
                    }}>
                      توزيع المتأخر
                    </Button>
                  )}
                </div>
              )}

              {plan.reviewEnabled && (status.recentReview || status.distantReview) && (
                <div className="space-y-2 rounded-md border p-4">
                  <div className="mb-3 flex items-center gap-2 font-semibold">
                    <History className="size-4 text-primary" /> مراجعة اليوم
                  </div>
                  {status.recentReview && (
                    <div className="flex items-center justify-between gap-3 py-1">
                      <div>
                        <p className="text-sm font-medium">مراجعة قريبة</p>
                        <p className="text-xs text-muted-foreground">الصفحات {status.recentReview.startPage}–{status.recentReview.endPage}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openReviewRange(status.recentReview!)}>
                        فتح
                      </Button>
                    </div>
                  )}
                  {status.distantReview && (
                    <div className="flex items-center justify-between gap-3 py-1">
                      <div>
                        <p className="text-sm font-medium">مراجعة بعيدة</p>
                        <p className="text-xs text-muted-foreground">الصفحات {status.distantReview.startPage}–{status.distantReview.endPage}</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => openReviewRange(status.distantReview!)}>
                        فتح
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  applyPlanToForm(plan)
                  setEditing(true)
                }}>
                  <Pencil /> تعديل الخطة
                </Button>
                <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 /> حذف الخطة
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                <div>
                  <p className="font-semibold">{plan ? `تعديل خطة ${LEARNING_PLAN_LABELS[selectedType]}` : `إنشاء خطة ${LEARNING_PLAN_LABELS[selectedType]}`}</p>
                  <p className="text-xs text-muted-foreground">حدّد نطاقًا وجدولًا مستقلين لهذه الخطة.</p>
                </div>
                {plan ? <Pencil className="size-5 text-primary" /> : <Plus className="size-5 text-primary" />}
              </div>

              <div className="space-y-3 rounded-md border p-4">
                <div className="flex items-center justify-between gap-3">
                  <Label className="font-bold">نطاق الخطة</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{targetPages} صفحة</span>
                </div>
                <QuranSessionRangePicker
                  currentPage={currentPage}
                  pageStart={startPage}
                  pageCount={targetPages}
                  startVerseKey={startVerseKey}
                  endVerseKey={endVerseKey}
                  onSetRange={setRange}
                />
              </div>

              <div className="space-y-3 rounded-md border p-4">
                <Label className="font-bold">جدول الخطة</Label>
                <ToggleGroup
                  type="single"
                  value={scheduleMode}
                  onValueChange={(value) => value && setScheduleMode(value as LearningScheduleMode)}
                  variant="outline"
                  className="grid grid-cols-2"
                >
                  <ToggleGroupItem value="deadline">تاريخ نهاية</ToggleGroupItem>
                  <ToggleGroupItem value="daily">مقدار يومي</ToggleGroupItem>
                </ToggleGroup>
                {scheduleMode === "deadline" ? (
                  <div className="space-y-2">
                    <Label htmlFor="learning-plan-end-date">تاريخ الإكمال</Label>
                    <Input
                      id="learning-plan-end-date"
                      type="date"
                      min={todayKey}
                      max={addLearningPlanDays(todayKey, 1825)}
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="learning-plan-daily-pages">صفحات كل يوم نشاط</Label>
                    <Input
                      id="learning-plan-daily-pages"
                      type="number"
                      min={1}
                      max={100}
                      value={dailyPages}
                      onChange={(event) => setDailyPages(Number(event.target.value))}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-md border p-4">
                <Label className="font-bold">أيام النشاط</Label>
                <ToggleGroup
                  type="multiple"
                  value={activeDays.map(String)}
                  onValueChange={(values) => {
                    const next = values.map(Number).filter((day) => day >= 0 && day <= 6)
                    if (next.length) setActiveDays(next)
                  }}
                  variant="outline"
                  size="sm"
                  className="grid grid-cols-4 sm:grid-cols-7"
                >
                  {WEEKDAY_LABELS.map((label, day) => (
                    <ToggleGroupItem key={day} value={String(day)} className="min-w-0 px-1 text-xs">
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {selectedType === "new" && (
                <div className="space-y-3 rounded-md border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="learning-plan-review" className="font-bold">مراجعة مصاحبة للحفظ</Label>
                    <Switch id="learning-plan-review" dir="ltr" checked={reviewEnabled} onCheckedChange={setReviewEnabled} />
                  </div>
                  {reviewEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="learning-plan-review-pages">صفحات كل مراجعة</Label>
                      <Input
                        id="learning-plan-review-pages"
                        type="number"
                        min={1}
                        max={30}
                        value={reviewPages}
                        onChange={(event) => setReviewPages(Number(event.target.value))}
                      />
                    </div>
                  )}
                </div>
              )}

              {rangeChanged && (
                <p className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">تغيير نطاق الخطة سيعيد تقدم هذه الخطة إلى البداية، ولن تتأثر الخطط الأخرى.</p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                {plan && (
                  <Button variant="ghost" onClick={() => setEditing(false)}>إلغاء</Button>
                )}
                <Button className="w-full sm:w-auto" onClick={persistPlan}>
                  {plan ? <RotateCcw /> : <Plus />}
                  {plan ? "حفظ التعديلات" : `إنشاء خطة ${LEARNING_PLAN_LABELS[selectedType]}`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>حذف خطة {LEARNING_PLAN_LABELS[selectedType]}؟</AlertDialogTitle>
            <AlertDialogDescription>سيُحذف تقدم هذه الخطة ومقررها فقط، ولن تتأثر الخطط الأخرى أو العلامات أو الجلسات السابقة.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deletePlan}>
              <Trash2 /> حذف الخطة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
