"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Download, LoaderCircle, X } from "lucide-react"
import { toast } from "sonner"

import type { NavigationRange } from "@/components/quran-navigation"
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
import { Progress } from "@/components/ui/progress"
import {
  OFFLINE_AUDIO_CACHE,
  OFFLINE_PAGE_CACHE,
  formatOfflineBytes,
  loadOfflineRangePackages,
  saveOfflineRangePackages,
  type OfflineRangePackage,
} from "@/lib/offline-audio"
import { getOfflineQuranPageUrl } from "@/lib/offline-quran"

type RangeDescriptor = Omit<OfflineRangePackage, "key" | "reciterName">
type RangeReadiness = {
  textReady: number
  textTotal: number
  audioReady: number
  audioTotal: number
  remainingSize: number
}

type SessionRangeDownloadProps = {
  range: NavigationRange
  reciter: number
  reciterName: string
  compact?: boolean
}

async function requestRangeDescriptor(range: NavigationRange, reciter: number, signal?: AbortSignal) {
  const params = new URLSearchParams({
    reciter: String(reciter),
    startPage: String(range.startPage),
    endPage: String(range.endPage),
  })
  if (range.startVerseKey) params.set("startVerseKey", range.startVerseKey)
  if (range.endVerseKey) params.set("endVerseKey", range.endVerseKey)
  const response = await fetch(`/api/quran/offline-range?${params}`, { signal })
  const data = (await response.json()) as RangeDescriptor & { error?: string }
  if (!response.ok || !data.files?.length) throw new Error(data.error || "تعذر حساب الملفات")
  return data
}

export function SessionRangeDownload({ range, reciter, reciterName, compact = false }: SessionRangeDownloadProps) {
  const controllerRef = useRef<AbortController | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [descriptor, setDescriptor] = useState<RangeDescriptor | null>(null)
  const [preparedDescriptor, setPreparedDescriptor] = useState<RangeDescriptor | null>(null)
  const [readiness, setReadiness] = useState<RangeReadiness | null>(null)
  const [checkingReadiness, setCheckingReadiness] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [availableStorage, setAvailableStorage] = useState(0)

  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    if (!("caches" in window) || reciter === 22) return
    setPreparedDescriptor(null)
    setReadiness(null)
    const controller = new AbortController()
    const checkedRange: NavigationRange = {
      startPage: range.startPage,
      endPage: range.endPage,
      startVerseKey: range.startVerseKey,
      endVerseKey: range.endVerseKey,
    }
    const timer = window.setTimeout(async () => {
      setCheckingReadiness(true)
      try {
        const data = await requestRangeDescriptor(checkedRange, reciter, controller.signal)
        const [audioCache, pageCache] = await Promise.all([
          window.caches.open(OFFLINE_AUDIO_CACHE),
          window.caches.open(OFFLINE_PAGE_CACHE),
        ])
        const audioMatches = await Promise.all(data.files.map((file) => audioCache.match(file.audioUrl).catch(() => undefined)))
        const pages = Array.from({ length: checkedRange.endPage - checkedRange.startPage + 1 }, (_, index) => checkedRange.startPage + index)
        const pageMatches = await Promise.all(pages.map((page) => pageCache.match(getOfflineQuranPageUrl(page)).catch(() => undefined)))
        setPreparedDescriptor(data)
        setReadiness({
          textReady: pageMatches.filter(Boolean).length,
          textTotal: pages.length,
          audioReady: audioMatches.filter(Boolean).length,
          audioTotal: data.files.length,
          remainingSize: data.files.reduce((total, file, index) => total + (audioMatches[index] ? 0 : file.fileSize), 0),
        })
      } catch (error) {
        if ((error as Error).name !== "AbortError") setReadiness(null)
      } finally {
        if (!controller.signal.aborted) setCheckingReadiness(false)
      }
    }, 350)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [range.endPage, range.endVerseKey, range.startPage, range.startVerseKey, reciter])

  const prepareRange = async () => {
    if (!("caches" in window)) {
      toast.error("التنزيل دون اتصال غير مدعوم في هذا المتصفح")
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    setPreparing(true)
    try {
      const [data, estimate] = await Promise.all([
        preparedDescriptor ?? requestRangeDescriptor(range, reciter, controller.signal),
        navigator.storage?.estimate?.(),
      ])
      setAvailableStorage(Math.max((estimate?.quota ?? 0) - (estimate?.usage ?? 0), 0))
      setPreparedDescriptor(data)
      setDescriptor(data)
    } catch (error) {
      if ((error as Error).name !== "AbortError") toast.error((error as Error).message || "تعذر حساب ملفات النطاق")
    } finally {
      controllerRef.current = null
      setPreparing(false)
    }
  }

  const downloadRange = async () => {
    if (!descriptor) return
    const currentDescriptor = descriptor
    const packageEntry: OfflineRangePackage = {
      ...currentDescriptor,
      key: currentDescriptor.fileMode === "pages"
        ? `range-${reciter}-pages-${currentDescriptor.startPage}-${currentDescriptor.endPage}`
        : `range-${reciter}-${currentDescriptor.startAyahId}-${currentDescriptor.endAyahId}`,
      reciterName,
    }
    saveOfflineRangePackages([
      packageEntry,
      ...loadOfflineRangePackages().filter((item) => item.key !== packageEntry.key),
    ])
    const controller = new AbortController()
    controllerRef.current = controller
    setDescriptor(null)
    setDownloading(true)
    setProgress(0)

    try {
      await navigator.storage?.persist?.()
      const [audioCache, pageCache] = await Promise.all([
        window.caches.open(OFFLINE_AUDIO_CACHE),
        window.caches.open(OFFLINE_PAGE_CACHE),
      ])
      const pages = Array.from(
        { length: currentDescriptor.endPage - currentDescriptor.startPage + 1 },
        (_, index) => currentDescriptor.startPage + index,
      )
      const [audioMatches, pageMatches] = await Promise.all([
        Promise.all(currentDescriptor.files.map((file) => audioCache.match(file.audioUrl).catch(() => undefined))),
        Promise.all(pages.map((page) => pageCache.match(getOfflineQuranPageUrl(page)).catch(() => undefined))),
      ])
      const remainingSize = currentDescriptor.files.reduce(
        (total, file, index) => total + (audioMatches[index] ? 0 : file.fileSize),
        0,
      )
      const estimate = await navigator.storage?.estimate?.()
      if (estimate?.quota && estimate.quota - (estimate.usage ?? 0) < remainingSize) {
        throw new Error("المساحة المتاحة لا تكفي لتنزيل هذا النطاق")
      }

      const totalItems = pages.length + currentDescriptor.files.length
      let completedItems = pageMatches.filter(Boolean).length + audioMatches.filter(Boolean).length
      const updateProgress = () => setProgress(Math.round((completedItems / totalItems) * 100))
      updateProgress()

      for (let index = 0; index < pages.length; index += 1) {
        if (pageMatches[index]) continue
        const url = getOfflineQuranPageUrl(pages[index])
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error(`تعذر تنزيل نص الصفحة ${pages[index]}`)
        await pageCache.put(url, response)
        completedItems += 1
        updateProgress()
      }
      for (let index = 0; index < currentDescriptor.files.length; index += 1) {
        if (audioMatches[index]) continue
        const file = currentDescriptor.files[index]
        const response = await fetch(file.audioUrl, { mode: "cors", signal: controller.signal })
        if (!response.ok) throw new Error(`تعذر تنزيل ${file.label}`)
        await audioCache.put(file.audioUrl, response)
        completedItems += 1
        updateProgress()
      }

      setReadiness({
        textReady: pages.length,
        textTotal: pages.length,
        audioReady: currentDescriptor.files.length,
        audioTotal: currentDescriptor.files.length,
        remainingSize: 0,
      })
      setProgress(100)
      toast.success("أصبح نص النطاق وتلاوته جاهزين دون إنترنت")
    } catch (error) {
      if ((error as Error).name !== "AbortError") toast.error((error as Error).message || "تعذر تنزيل نطاق الجلسة")
    } finally {
      controllerRef.current = null
      setDownloading(false)
      setProgress(0)
    }
  }

  if (reciter === 22) return null
  const rangeReady = Boolean(readiness && readiness.textReady === readiness.textTotal && readiness.audioReady === readiness.audioTotal)

  return (
    <>
      {downloading ? (
        <div className="space-y-2 border-y py-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold">تحميل نص النطاق وتلاوته</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => controllerRef.current?.abort()}>
            <X /> إلغاء التنزيل
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {(checkingReadiness || readiness) && (
            <p className="text-center text-[11px] text-muted-foreground" aria-live="polite">
              {checkingReadiness && !readiness
                ? "جاري فحص جاهزية النطاق..."
                : `النص ${readiness?.textReady}/${readiness?.textTotal} · التلاوة ${readiness?.audioReady}/${readiness?.audioTotal}${readiness?.remainingSize ? ` · ${formatOfflineBytes(readiness.remainingSize)}` : ""}`}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            className={compact ? "h-9 w-full px-2 text-xs" : "w-full"}
            disabled={preparing || rangeReady}
            onClick={() => void prepareRange()}
          >
            {rangeReady ? <CheckCircle2 /> : preparing ? <LoaderCircle className="animate-spin" /> : <Download />}
            {rangeReady ? "النطاق جاهز دون إنترنت" : preparing ? "حساب الحجم..." : "تنزيل الملفات الناقصة"}
          </Button>
        </div>
      )}

      <AlertDialog open={Boolean(descriptor)} onOpenChange={(open) => !open && setDescriptor(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>تحميل نطاق الجلسة</AlertDialogTitle>
            <AlertDialogDescription>
              النص والتلاوة من {descriptor?.startVerseKey} إلى {descriptor?.endVerseKey} بصوت {reciterName}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {descriptor && (
            <div className="space-y-3 border-y py-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>حجم الصوت المتبقي</span>
                <span className="font-semibold tabular-nums">{formatOfflineBytes(readiness?.remainingSize ?? descriptor.totalSize)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>صفحات النص</span><span>{readiness?.textReady ?? 0} / {readiness?.textTotal ?? range.endPage - range.startPage + 1}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>ملفات التلاوة</span><span>{readiness?.audioReady ?? 0} / {readiness?.audioTotal ?? descriptor.files.length}</span>
              </div>
              {availableStorage > 0 && (
                <div className="flex items-center justify-between gap-3 text-muted-foreground">
                  <span>المساحة المتاحة</span><span>{formatOfflineBytes(availableStorage)}</span>
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => void downloadRange()}><Download /> بدء التحميل</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
