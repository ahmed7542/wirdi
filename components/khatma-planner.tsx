"use client"

import { useEffect, useState } from "react"
import {
  Bell,
  BellOff,
  BookOpen,
  CalendarCheck2,
  Check,
  Minus,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { BoundedNumberInput } from "@/components/bounded-number-input"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  KHATMA_CHANGE_EVENT,
  KHATMA_TOTAL_PAGES as TOTAL_PAGES,
  readKhatmaPlan as readPlan,
  saveKhatmaPlan as savePlan,
  type KhatmaMethod,
  type KhatmaPlan,
} from "@/lib/khatma-plan"

type KhatmaPlannerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentPage: number
  onOpenRange: (startPage: number, endPage: number) => void
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.round(value || min), min), max)
}

function localDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return { year, month, day }
}

function daysBetween(start: string, end: string) {
  const first = dateParts(start)
  const second = dateParts(end)
  return Math.max(0, Math.floor(
    (Date.UTC(second.year, second.month - 1, second.day) -
      Date.UTC(first.year, first.month - 1, first.day)) /
      86_400_000,
  ))
}

function addDays(value: string, amount: number) {
  const parts = dateParts(value)
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount))
  return localDateKey(date)
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-")
  return `${day}/${month}/${year}`
}

function totalPlanDays(plan: KhatmaPlan) {
  return plan.method === "duration"
    ? plan.durationDays
    : Math.ceil(TOTAL_PAGES / plan.dailyPages)
}

export function KhatmaPlanner({ open, onOpenChange, currentPage, onOpenRange }: KhatmaPlannerProps) {
  const [loaded, setLoaded] = useState(false)
  const [todayKey, setTodayKey] = useState("1970-01-01")
  const [plan, setPlan] = useState<KhatmaPlan | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [method, setMethod] = useState<KhatmaMethod>("duration")
  const [durationDays, setDurationDays] = useState(30)
  const [dailyPages, setDailyPages] = useState(20)
  const [setupReminder, setSetupReminder] = useState(false)
  const [setupReminderTime, setSetupReminderTime] = useState("20:00")
  const [extraPages, setExtraPages] = useState(0)

  useEffect(() => {
    const refreshPlan = () => setPlan(readPlan())
    setTodayKey(localDateKey(new Date()))
    refreshPlan()
    setLoaded(true)
    window.addEventListener(KHATMA_CHANGE_EVENT, refreshPlan)
    return () => window.removeEventListener(KHATMA_CHANGE_EVENT, refreshPlan)
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const scheduleRollover = () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 1, 0)
      timer = setTimeout(() => {
        setTodayKey(localDateKey(new Date()))
        scheduleRollover()
      }, midnight.getTime() - now.getTime())
    }
    scheduleRollover()
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!loaded || !plan || plan.lastOpenedDate === todayKey) return
    const nextPlan = { ...plan, lastOpenedDate: todayKey }
    setPlan(nextPlan)
    savePlan(nextPlan)
    onOpenChange(true)
  }, [loaded, onOpenChange, plan, todayKey])

  useEffect(() => {
    if (open) setExtraPages(0)
  }, [open])

  const elapsedDays = plan ? daysBetween(plan.startDate, todayKey) : 0
  const planDays = plan ? totalPlanDays(plan) : 0
  const elapsedPlanDay = plan ? Math.min(elapsedDays + 1, planDays) : 0
  const remainingPages = plan ? TOTAL_PAGES - plan.completedPage : TOTAL_PAGES
  const remainingDays = plan ? Math.max(planDays - elapsedDays, 1) : 1
  const adaptivePages = plan
    ? plan.method === "duration"
      ? Math.ceil(remainingPages / remainingDays)
      : plan.dailyPages
    : 1
  const todayStart = plan ? Math.min(plan.completedPage + 1, TOTAL_PAGES) : 1
  const baseEnd = plan ? Math.min(plan.completedPage + adaptivePages, TOTAL_PAGES) : 1
  const todayEnd = plan ? Math.min(baseEnd + extraPages, TOTAL_PAGES) : 1
  const expectedPage = plan
    ? plan.method === "duration"
      ? Math.min(TOTAL_PAGES, Math.floor((elapsedPlanDay * TOTAL_PAGES) / planDays))
      : Math.min(TOTAL_PAGES, elapsedPlanDay * plan.dailyPages)
    : 0
  const completedPercent = plan ? Math.round((plan.completedPage / TOTAL_PAGES) * 100) : 0
  const isComplete = plan?.completedPage === TOTAL_PAGES
  const isAhead = plan ? plan.completedPage >= expectedPage : false
  const finishDate = plan ? addDays(plan.startDate, planDays - 1) : ""
  const setupPlanDays = method === "duration" ? durationDays : Math.ceil(TOTAL_PAGES / dailyPages)

  const persistPlan = (nextPlan: KhatmaPlan) => {
    setPlan(nextPlan)
    savePlan(nextPlan)
  }

  const requestNotificationPermission = async () => {
    if (!("Notification" in window) || !window.isSecureContext) {
      toast.error("إشعارات التذكير تحتاج تشغيل التطبيق عبر HTTPS")
      return false
    }
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission()
    if (permission !== "granted") {
      toast.error("لم يُسمح للتطبيق بإرسال التنبيهات")
      return false
    }
    return true
  }

  const createPlan = async () => {
    const reminderAllowed = setupReminder ? await requestNotificationPermission() : false
    const startDate = localDateKey(new Date())
    const nextPlan: KhatmaPlan = {
      version: 1,
      method,
      durationDays: clampInteger(durationDays, 1, 365),
      dailyPages: clampInteger(dailyPages, 1, 100),
      startDate,
      completedPage: 0,
      reminderEnabled: reminderAllowed,
      reminderTime: setupReminderTime,
      lastOpenedDate: startDate,
    }
    persistPlan(nextPlan)
    if (setupOpen) {
      setSetupOpen(false)
      onOpenChange(true)
    }
    toast.success("تم إنشاء مسار الختمة")
  }

  const updateReminder = async (enabled: boolean) => {
    if (!plan) return
    if (enabled && !(await requestNotificationPermission())) return
    persistPlan({ ...plan, reminderEnabled: enabled })
    toast.success(enabled ? "تم تفعيل التذكير داخل التطبيق" : "تم إيقاف التذكير")
  }

  useEffect(() => {
    if (!plan?.reminderEnabled || !("Notification" in window) || Notification.permission !== "granted") return
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false

    const scheduleReminder = () => {
      const now = new Date()
      const [hour, minute] = plan.reminderTime.split(":").map(Number)
      const today = localDateKey(now)
      const target = new Date(now)
      target.setHours(hour, minute, 0, 0)
      if (target.getTime() <= now.getTime() && plan.lastNotifiedDate === today) {
        target.setDate(target.getDate() + 1)
      }
      const delay = Math.max(1000, target.getTime() - now.getTime())
      timer = setTimeout(async () => {
        if (cancelled) return
        const title = "موعد وِرد الختمة"
        const body = isComplete
          ? "أتممت الختمة. افتح وِرد لبدء مسار جديد."
          : `مقرر اليوم من الصفحة ${todayStart} إلى الصفحة ${baseEnd}`
        try {
          if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
            const registration = await navigator.serviceWorker.ready
            await registration.showNotification(title, {
              body,
              icon: "/icons/wird-192.png",
              badge: "/icons/wird-192.png",
              tag: "wird-khatma-reminder",
              data: { url: "/?khatma=1" },
            })
          } else {
            new Notification(title, { body, icon: "/icons/wird-192.png", tag: "wird-khatma-reminder" })
          }
          const notifiedDate = localDateKey(new Date())
          setPlan((current) => {
            if (!current) return current
            const nextPlan = { ...current, lastNotifiedDate: notifiedDate }
            savePlan(nextPlan)
            return nextPlan
          })
        } catch {
          // The browser may suspend notification access outside an installed PWA.
        }
      }, delay)
    }

    scheduleReminder()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [baseEnd, isComplete, plan?.lastNotifiedDate, plan?.reminderEnabled, plan?.reminderTime, todayStart])

  const markThroughPage = (page: number) => {
    if (!plan || page <= plan.completedPage) return
    const completedPage = Math.min(page, TOTAL_PAGES)
    persistPlan({ ...plan, completedPage })
    setExtraPages(0)
    if (completedPage === TOTAL_PAGES) toast.success("أتممت الختمة. تقبل الله منك")
    else if (completedPage > baseEnd) toast.success("أحسنت، تجاوزت مقرر اليوم")
    else toast.success("تم تسجيل إنجاز مقرر اليوم")
  }

  const openTodayReading = () => {
    if (!plan) return
    const nextPlan = {
      ...plan,
      startPage: todayStart,
      pageCount: todayEnd - todayStart + 1,
    }
    persistPlan(nextPlan)
    onOpenRange(todayStart, todayEnd)
    onOpenChange(false)
  }

  const resetSetup = () => {
    setMethod(plan?.method ?? "duration")
    setDurationDays(plan?.durationDays ?? 30)
    setDailyPages(plan?.dailyPages ?? 20)
    setSetupReminder(plan?.reminderEnabled ?? false)
    setSetupReminderTime(plan?.reminderTime ?? "20:00")
    onOpenChange(false)
    setSetupOpen(true)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto p-0 [&>button]:left-4 [&>button]:right-auto" dir="rtl">
          <DialogHeader className="border-b px-5 py-4 text-right">
            <div className="flex items-center justify-between gap-3 pe-7">
              <DialogTitle className="flex items-center gap-2">
                <CalendarCheck2 className="size-5 text-primary" />
                مسار الختمة
              </DialogTitle>
              {plan && (
                <Button variant="ghost" size="icon-sm" aria-label="إعداد مسار جديد" onClick={resetSetup}>
                  <Settings2 />
                </Button>
              )}
            </div>
            <DialogDescription>
              {plan ? `موعد الإتمام المتوقع ${displayDate(finishDate)}` : "حدّد المدة أو مقدار القراءة اليومي"}
            </DialogDescription>
          </DialogHeader>

          {!loaded ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">جاري تحميل المسار...</div>
          ) : !plan ? (
            <div className="space-y-5 px-5 py-5">
              <SetupForm
                method={method}
                onMethodChange={setMethod}
                durationDays={durationDays}
                onDurationDaysChange={setDurationDays}
                dailyPages={dailyPages}
                onDailyPagesChange={setDailyPages}
                reminder={setupReminder}
                onReminderChange={setSetupReminder}
                reminderTime={setupReminderTime}
                onReminderTimeChange={setSetupReminderTime}
                planDays={setupPlanDays}
              />
              <Button className="h-11 w-full" onClick={() => void createPlan()}>
                <CalendarCheck2 />
                بدء مسار الختمة
              </Button>
            </div>
          ) : (
            <div className="space-y-5 px-5 py-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-semibold">تقدم الختمة</span>
                  <span className="tabular-nums">{plan.completedPage} / {TOTAL_PAGES}</span>
                </div>
                <Progress value={completedPercent} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>اليوم {elapsedDays + 1} من المسار</span>
                  <span className="tabular-nums">{completedPercent}%</span>
                </div>
              </div>

              {isComplete ? (
                <div className="border-y py-8 text-center">
                  <Check className="mx-auto mb-3 size-8 text-primary" />
                  <h3 className="font-bold">اكتملت الختمة</h3>
                  <p className="mt-1 text-sm text-muted-foreground">تقبل الله منك وبارك في وِردك</p>
                </div>
              ) : (
                <>
                  <div className="border-y py-5 text-center">
                    <p className="text-xs font-semibold text-muted-foreground">مقرر اليوم</p>
                    <p className="mt-2 text-xl font-bold tabular-nums">
                      صفحة {todayStart} إلى {todayEnd}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {todayEnd - todayStart + 1} صفحة
                      {extraPages > 0 ? `، منها ${extraPages} إضافية` : ""}
                    </p>
                    <p className="mt-3 text-xs text-primary">
                      {isAhead
                        ? "أنت على المسار. الاستمرار القليل الدائم يصنع الختمة."
                        : `الموضع المتوقع اليوم صفحة ${expectedPage}. ابدأ بمقرر اليوم وستقترب منه.`}
                    </p>
                  </div>

                  <Button className="h-11 w-full" onClick={openTodayReading}>
                    <BookOpen />
                    افتح مقرر اليوم
                  </Button>

                  <div className="flex items-center justify-between gap-3 border-b pb-4">
                    <div>
                      <Label>زيادة مقرر اليوم</Label>
                      <p className="text-xs text-muted-foreground">تُضاف بعد المقدار الأساسي</p>
                    </div>
                    <div className="flex items-center gap-1" dir="ltr">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="تقليل الصفحات الإضافية"
                        disabled={extraPages === 0}
                        onClick={() => setExtraPages((value) => Math.max(0, value - 1))}
                      >
                        <Minus />
                      </Button>
                      <span className="w-10 text-center font-semibold tabular-nums">{extraPages}</span>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="زيادة الصفحات الإضافية"
                        disabled={todayEnd >= TOTAL_PAGES}
                        onClick={() => setExtraPages((value) => Math.min(100, value + 1))}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full" onClick={() => markThroughPage(todayEnd)}>
                    <Check />
                    تسجيل إتمام المقرر حتى صفحة {todayEnd}
                  </Button>
                  {currentPage > plan.completedPage && currentPage !== todayEnd && (
                    <Button variant="ghost" className="w-full" onClick={() => markThroughPage(currentPage)}>
                      تسجيل القراءة حتى الصفحة الحالية {currentPage}
                    </Button>
                  )}
                </>
              )}

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="khatma-reminder" className="flex items-center gap-2">
                    {plan.reminderEnabled ? <Bell className="size-4 text-primary" /> : <BellOff className="size-4" />}
                    تذكير يومي داخل التطبيق
                  </Label>
                  <Switch
                    id="khatma-reminder"
                    dir="ltr"
                    checked={plan.reminderEnabled}
                    onCheckedChange={(enabled) => void updateReminder(enabled)}
                  />
                </div>
                {plan.reminderEnabled && (
                  <div className="flex items-center justify-between gap-4">
                    <Label htmlFor="khatma-reminder-time" className="text-xs text-muted-foreground">موعد التذكير</Label>
                    <Input
                      id="khatma-reminder-time"
                      type="time"
                      value={plan.reminderTime}
                      onChange={(event) => persistPlan({ ...plan, reminderTime: event.target.value })}
                      className="w-32"
                      dir="ltr"
                    />
                  </div>
                )}
                <p className="text-xs leading-5 text-muted-foreground">
                  يظهر التنبيه ما دام التطبيق مفتوحًا. التذكير بعد إغلاق التطبيق غير مدعوم حاليًا.
                </p>
              </div>

              <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 />
                حذف مسار الختمة
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto [&>button]:left-4 [&>button]:right-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>بدء مسار جديد</DialogTitle>
            <DialogDescription>سيبدأ المسار الجديد من الصفحة 1 ويلغي التقدم الحالي.</DialogDescription>
          </DialogHeader>
          <SetupForm
            method={method}
            onMethodChange={setMethod}
            durationDays={durationDays}
            onDurationDaysChange={setDurationDays}
            dailyPages={dailyPages}
            onDailyPagesChange={setDailyPages}
            reminder={setupReminder}
            onReminderChange={setSetupReminder}
            reminderTime={setupReminderTime}
            onReminderTimeChange={setSetupReminderTime}
            planDays={setupPlanDays}
          />
          <Button className="w-full" onClick={() => void createPlan()}>
            <CalendarCheck2 />
            حفظ وبدء المسار الجديد
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>حذف مسار الختمة؟</AlertDialogTitle>
            <AlertDialogDescription>سيُحذف التقدم وموعد التذكير من هذا الجهاز.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setPlan(null)
                savePlan(null)
                setDeleteOpen(false)
                toast.success("تم حذف مسار الختمة")
              }}
            >
              <Trash2 />
              حذف المسار
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

type SetupFormProps = {
  method: KhatmaMethod
  onMethodChange: (method: KhatmaMethod) => void
  durationDays: number
  onDurationDaysChange: (days: number) => void
  dailyPages: number
  onDailyPagesChange: (pages: number) => void
  reminder: boolean
  onReminderChange: (enabled: boolean) => void
  reminderTime: string
  onReminderTimeChange: (time: string) => void
  planDays: number
}

function SetupForm({
  method,
  onMethodChange,
  durationDays,
  onDurationDaysChange,
  dailyPages,
  onDailyPagesChange,
  reminder,
  onReminderChange,
  reminderTime,
  onReminderTimeChange,
  planDays,
}: SetupFormProps) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>طريقة تحديد الختمة</Label>
        <ToggleGroup
          type="single"
          value={method}
          onValueChange={(value) => value && onMethodChange(value as KhatmaMethod)}
          variant="outline"
          className="grid w-full grid-cols-2"
        >
          <ToggleGroupItem value="duration">مدة الختمة</ToggleGroupItem>
          <ToggleGroupItem value="daily">مقدار يومي</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {method === "duration" ? (
        <div className="space-y-2">
          <Label htmlFor="khatma-days">المدة بالأيام</Label>
          <BoundedNumberInput
            id="khatma-days"
            min={1}
            max={365}
            value={durationDays}
            onValueChange={onDurationDaysChange}
            className="text-center"
          />
          <div className="grid grid-cols-4 gap-1">
            {[30, 60, 90, 120].map((days) => (
              <Button key={days} type="button" variant={durationDays === days ? "secondary" : "ghost"} size="sm" onClick={() => onDurationDaysChange(days)}>
                {days} يومًا
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="khatma-pages">عدد الصفحات يوميًا</Label>
          <BoundedNumberInput
            id="khatma-pages"
            min={1}
            max={100}
            value={dailyPages}
            onValueChange={onDailyPagesChange}
            className="text-center"
          />
        </div>
      )}

      <div className="flex items-center justify-between border-y py-3 text-sm">
        <span>المدة المتوقعة</span>
        <span className="font-semibold tabular-nums">{planDays} يومًا</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="setup-khatma-reminder" className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            تذكير يومي داخل التطبيق
          </Label>
          <Switch id="setup-khatma-reminder" dir="ltr" checked={reminder} onCheckedChange={onReminderChange} />
        </div>
        {reminder && (
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="setup-khatma-time" className="text-xs text-muted-foreground">موعد التذكير</Label>
            <Input
              id="setup-khatma-time"
              type="time"
              value={reminderTime}
              onChange={(event) => onReminderTimeChange(event.target.value)}
              className="w-32"
              dir="ltr"
            />
          </div>
        )}
        <p className="text-xs leading-5 text-muted-foreground">
          يظهر التنبيه ما دام التطبيق مفتوحًا، ولا يعمل بعد إغلاقه حاليًا.
        </p>
      </div>
    </div>
  )
}
