"use client"

import { useEffect, useRef, useState } from "react"
import { Download, LoaderCircle, X } from "lucide-react"
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
  formatOfflineBytes,
  loadOfflineRangePackages,
  saveOfflineRangePackages,
  type OfflineRangePackage,
} from "@/lib/offline-audio"

type RangeDescriptor = Omit<OfflineRangePackage, "key" | "reciterName">

type SessionRangeDownloadProps = {
  range: NavigationRange
  reciter: number
  reciterName: string
  compact?: boolean
}

export function SessionRangeDownload({ range, reciter, reciterName, compact = false }: SessionRangeDownloadProps) {
  const controllerRef = useRef<AbortController | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [descriptor, setDescriptor] = useState<RangeDescriptor | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [availableStorage, setAvailableStorage] = useState(0)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const prepareRange = async () => {
    if (!("caches" in window)) {
      toast.error("التنزيل دون اتصال غير مدعوم في هذا المتصفح")
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    setPreparing(true)
    try {
      const params = new URLSearchParams({
        reciter: String(reciter),
        startPage: String(range.startPage),
        endPage: String(range.endPage),
      })
      if (range.startVerseKey) params.set("startVerseKey", range.startVerseKey)
      if (range.endVerseKey) params.set("endVerseKey", range.endVerseKey)
      const [response, estimate] = await Promise.all([
        fetch(`/api/quran/offline-range?${params}`, { signal: controller.signal }),
        navigator.storage?.estimate?.(),
      ])
      const data = (await response.json()) as RangeDescriptor & { error?: string }
      if (!response.ok || !data.files?.length) {
        throw new Error(data.error || "تعذر حساب الملفات")
      }
      setAvailableStorage(Math.max((estimate?.quota ?? 0) - (estimate?.usage ?? 0), 0))
      setDescriptor(data)
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error((error as Error).message || "تعذر حساب ملفات النطاق")
      }
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
    const existingPackages = loadOfflineRangePackages()
    saveOfflineRangePackages([
      packageEntry,
      ...existingPackages.filter((item) => item.key !== packageEntry.key),
    ])
    const controller = new AbortController()
    controllerRef.current = controller
    setDescriptor(null)
    setDownloading(true)
    setProgress(0)

    try {
      await navigator.storage?.persist?.()
      const cache = await window.caches.open(OFFLINE_AUDIO_CACHE)
      const cachedChecks = await Promise.all(
        currentDescriptor.files.map(async (file) => Boolean(await cache.match(file.audioUrl))),
      )
      const remainingSize = currentDescriptor.files.reduce(
        (total, file, index) => total + (cachedChecks[index] ? 0 : file.fileSize),
        0,
      )
      const estimate = await navigator.storage?.estimate?.()
      const remainingStorage = (estimate?.quota ?? 0) - (estimate?.usage ?? 0)
      if (estimate?.quota && remainingStorage < remainingSize) {
        throw new Error("المساحة المتاحة لا تكفي لتنزيل هذا النطاق")
      }

      let completedBytes = currentDescriptor.files.reduce(
        (total, file, index) => total + (cachedChecks[index] ? file.fileSize : 0),
        0,
      )
      let lastProgress = -1
      const updateProgress = (received = 0) => {
        const next = currentDescriptor.totalSize > 0
          ? Math.min(99, Math.round(((completedBytes + received) / currentDescriptor.totalSize) * 100))
          : 0
        if (next !== lastProgress) {
          lastProgress = next
          setProgress(next)
        }
      }
      updateProgress()

      for (let index = 0; index < currentDescriptor.files.length; index += 1) {
        if (cachedChecks[index]) continue
        const file = currentDescriptor.files[index]
        const response = await fetch(file.audioUrl, { mode: "cors", signal: controller.signal })
        if (!response.ok) throw new Error(`تعذر تنزيل ${file.label}`)

        if (response.body) {
          const reader = response.body.getReader()
          let received = 0
          const stream = new ReadableStream<Uint8Array>({
            async pull(streamController) {
              const result = await reader.read()
              if (result.done) {
                streamController.close()
                return
              }
              received += result.value.byteLength
              updateProgress(received)
              streamController.enqueue(result.value)
            },
            cancel(reason) {
              return reader.cancel(reason)
            },
          })
          await cache.put(
            file.audioUrl,
            new Response(stream, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            }),
          )
        } else {
          await cache.put(file.audioUrl, response)
        }
        completedBytes += file.fileSize
        updateProgress()
      }

      setProgress(100)
      toast.success("تم تحميل تلاوة النطاق للاستماع دون إنترنت")
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        toast.error((error as Error).message || "تعذر تنزيل نطاق الجلسة")
      }
    } finally {
      controllerRef.current = null
      setDownloading(false)
      setProgress(0)
    }
  }

  if (reciter === 22) return null

  return (
    <>
      {downloading ? (
        <div className="space-y-2 border-y py-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold">تحميل تلاوة النطاق</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => controllerRef.current?.abort()}
          >
            <X />
            إلغاء التنزيل
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={compact ? "h-9 w-full px-2 text-xs" : "w-full"}
          disabled={preparing}
          onClick={() => void prepareRange()}
        >
          {preparing ? <LoaderCircle className="animate-spin" /> : <Download />}
          {preparing ? "حساب الحجم..." : "تحميل تلاوة النطاق دون إنترنت"}
        </Button>
      )}

      <AlertDialog
        open={Boolean(descriptor)}
        onOpenChange={(open) => {
          if (!open) setDescriptor(null)
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>تحميل تلاوة النطاق</AlertDialogTitle>
            <AlertDialogDescription>
              {descriptor?.startVerseKey} إلى {descriptor?.endVerseKey} بصوت {reciterName}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {descriptor && (
            <div className="space-y-3 border-y py-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>حجم الملفات</span>
                <span className="font-semibold tabular-nums">{formatOfflineBytes(descriptor.totalSize)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-muted-foreground">
                <span>
                  {descriptor.fileMode === "chapters"
                    ? "ملفات السور"
                    : descriptor.fileMode === "pages"
                      ? "ملفات الصفحات"
                      : "ملفات الآيات"}
                </span>
                <span className="tabular-nums">{descriptor.files.length}</span>
              </div>
              {availableStorage > 0 && (
                <div className="flex items-center justify-between gap-3 text-muted-foreground">
                  <span>المساحة المتاحة</span>
                  <span className="tabular-nums">{formatOfflineBytes(availableStorage)}</span>
                </div>
              )}
              {descriptor.fileMode === "chapters" && (
                <p className="text-xs leading-5 text-muted-foreground">
                  {reciter === 2001
                    ? "يشمل الحجم ملفات السور كاملة، وتبدأ تلاوة الحدر من أول السورة."
                    : "يشمل الحجم ملفات السور كاملة لضمان التشغيل من أي آية داخل النطاق."}
                </p>
              )}
              {descriptor.fileMode === "pages" && (
                <p className="text-xs leading-5 text-muted-foreground">
                  يشمل الحجم ملفات صفحات المصحف، وتبدأ التلاوة من أول الصفحة.
                </p>
              )}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => void downloadRange()}>
              <Download />
              بدء التحميل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
