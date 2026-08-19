"use client"

import { useEffect } from "react"

import { loadLastReading } from "@/lib/last-reading"
import { downloadOfflineQuran } from "@/lib/offline-quran"

const RETRY_DELAY_MS = 30_000

function isRunningInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
}

export function OfflineQuranSync() {
  useEffect(() => {
    let disposed = false
    let retryTimer: number | null = null

    const clearRetry = () => {
      if (retryTimer) window.clearTimeout(retryTimer)
      retryTimer = null
    }
    const sync = (force = false) => {
      clearRetry()
      if (disposed || navigator.onLine === false || (!force && !isRunningInstalled())) return
      const startingPage = loadLastReading()?.page ?? 1
      void downloadOfflineQuran(startingPage)
        .then((status) => {
          if (
            !disposed &&
            navigator.onLine !== false &&
            status.completed < status.total
          ) {
            retryTimer = window.setTimeout(() => sync(force), RETRY_DELAY_MS)
          }
        })
        .catch(() => {
          if (!disposed && navigator.onLine !== false) {
            retryTimer = window.setTimeout(() => sync(force), RETRY_DELAY_MS)
          }
        })
    }
    const handleOnline = () => sync()
    const handlePageShow = () => sync()
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") sync()
    }
    const handleInstalled = () => sync(true)

    sync()
    window.addEventListener("online", handleOnline)
    window.addEventListener("appinstalled", handleInstalled)
    window.addEventListener("pageshow", handlePageShow)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      disposed = true
      clearRetry()
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("appinstalled", handleInstalled)
      window.removeEventListener("pageshow", handlePageShow)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  return null
}
