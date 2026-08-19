"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { LoaderCircle, RefreshCw, X } from "lucide-react"

import { Button } from "@/components/ui/button"

const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000
const MIN_UPDATE_CHECK_GAP_MS = 60 * 1000
const APP_SHELL_CACHE_TIMEOUT_MS = 8 * 1000
const DISMISSED_UPDATE_KEY = "wird-dismissed-update-v1"

function canDisplayUpdatePrompt() {
  const root = document.documentElement
  return document.visibilityState === "visible" &&
    !document.fullscreenElement &&
    root.dataset.wirdFullscreen !== "true" &&
    root.dataset.wirdPracticeActive !== "true"
}

function getDocumentStaticAssetUrls(target: Document) {
  const urls: string[] = []
  for (const element of target.querySelectorAll("script[src], link[href]")) {
    const source = element.getAttribute(element.tagName === "SCRIPT" ? "src" : "href")
    if (!source) continue
    const parsed = new URL(source, window.location.origin)
    if (parsed.origin === window.location.origin && parsed.pathname.startsWith("/_next/static/")) {
      urls.push(parsed.href)
    }
  }
  return [...new Set(urls)].sort()
}

function getLoadedStaticAssetUrls() {
  const loadedUrls = performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((url) => {
      const parsed = new URL(url)
      return parsed.origin === window.location.origin && parsed.pathname.startsWith("/_next/static/")
    })
  return [...new Set([...getDocumentStaticAssetUrls(document), ...loadedUrls])].sort()
}

function createReleaseId(urls: string[]) {
  let hash = 2166136261
  for (const character of urls.join("|")) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

async function getPublishedRelease() {
  const url = new URL("/", window.location.origin)
  url.searchParams.set("__wird_update", "1")
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) throw new Error("Unable to check app version")
  const target = new DOMParser().parseFromString(await response.text(), "text/html")
  const urls = getDocumentStaticAssetUrls(target)
  return { id: createReleaseId(urls), urls }
}

function cacheAppShell(worker: ServiceWorker | null, urls: string[]) {
  if (!worker) return Promise.resolve(false)
  return new Promise<boolean>((resolve) => {
    const channel = new MessageChannel()
    const timer = window.setTimeout(() => resolve(false), APP_SHELL_CACHE_TIMEOUT_MS)
    channel.port1.onmessage = (event) => {
      window.clearTimeout(timer)
      resolve(event.data?.type === "APP_SHELL_CACHED" && event.data.success === true)
    }
    worker.postMessage({ type: "CACHE_APP_SHELL", urls }, [channel.port2])
  })
}

export function ServiceWorkerRegistration() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const reloadRequestedRef = useRef(false)
  const staticUrlsRef = useRef<string[]>([])
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [canPrompt, setCanPrompt] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [promptHost, setPromptHost] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPromptHost(document.querySelector<HTMLElement>("[data-wird-update-host]"))
  }, [])

  const refreshPromptAvailability = useCallback(() => {
    setCanPrompt(canDisplayUpdatePrompt())
  }, [])

  const activateWaitingWorker = useCallback(async (worker: ServiceWorker) => {
    if (reloadRequestedRef.current) return
    window.localStorage.removeItem(DISMISSED_UPDATE_KEY)
    window.dispatchEvent(new Event("wird-before-app-update"))
    reloadRequestedRef.current = true
    setUpdating(true)
    await cacheAppShell(worker, staticUrlsRef.current)
    worker.postMessage({ type: "SKIP_WAITING" })
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return

    let disposed = false
    let registration: ServiceWorkerRegistration | null = null
    let updateTimer: ReturnType<typeof setInterval> | null = null
    let removeInstallingListener: (() => void) | null = null
    let staticUrls = getLoadedStaticAssetUrls()
    staticUrlsRef.current = staticUrls
    let registeredRelease = createReleaseId(getDocumentStaticAssetUrls(document))
    let lastUpdateCheck = 0
    let updateCheckInFlight = false
    let leftForeground = false

    const prepareAppShell = (worker: ServiceWorker | null) => {
      void cacheAppShell(worker, staticUrls)
    }

    const offerUpdate = (worker: ServiceWorker | null, activateOnOpen = false) => {
      if (disposed || !worker || !navigator.serviceWorker.controller) return
      if (activateOnOpen) {
        void activateWaitingWorker(worker)
        return
      }
      prepareAppShell(worker)
      if (document.visibilityState !== "visible") return
      setWaitingWorker(worker)
      setDismissed(window.localStorage.getItem(DISMISSED_UPDATE_KEY) === worker.scriptURL)
    }

    const watchInstallingWorker = () => {
      removeInstallingListener?.()
      removeInstallingListener = null
      const worker = registration?.installing
      if (!worker) return
      const handleStateChange = () => {
        if (worker.state === "installed") offerUpdate(registration?.waiting ?? worker)
        if (worker.state === "redundant") setWaitingWorker((current) => current === worker ? null : current)
      }
      worker.addEventListener("statechange", handleStateChange)
      removeInstallingListener = () => worker.removeEventListener("statechange", handleStateChange)
    }

    const bindRegistration = (nextRegistration: ServiceWorkerRegistration, activateWaitingOnOpen = false) => {
      if (registration !== nextRegistration) {
        registration?.removeEventListener("updatefound", watchInstallingWorker)
        removeInstallingListener?.()
        removeInstallingListener = null
        registration = nextRegistration
        registrationRef.current = nextRegistration
        nextRegistration.addEventListener("updatefound", watchInstallingWorker)
      }
      offerUpdate(nextRegistration.waiting, activateWaitingOnOpen)
      watchInstallingWorker()
      if (!nextRegistration.waiting) prepareAppShell(nextRegistration.active)
    }

    const requestUpdate = () => {
      if (
        reloadRequestedRef.current ||
        !registration ||
        document.visibilityState !== "visible" ||
        updateCheckInFlight
      ) return
      const now = Date.now()
      if (now - lastUpdateCheck < MIN_UPDATE_CHECK_GAP_MS) return
      lastUpdateCheck = now
      updateCheckInFlight = true
      void getPublishedRelease().then(async (published) => {
        if (disposed) return
        staticUrls = published.urls
        staticUrlsRef.current = staticUrls
        if (published.id !== registeredRelease) {
          const nextRegistration = await navigator.serviceWorker.register(
            `/sw.js?release=${encodeURIComponent(published.id)}`,
            { scope: "/", updateViaCache: "none" },
          )
          if (disposed) return
          registeredRelease = published.id
          bindRegistration(nextRegistration)
          return
        }
        await registration?.update()
      }).catch(() => undefined).finally(() => {
        updateCheckInFlight = false
      })
    }

    const handleVisibilityChange = () => {
      refreshPromptAvailability()
      if (document.visibilityState !== "visible") {
        leftForeground = true
        return
      }
      const resumed = leftForeground
      leftForeground = false
      if (resumed && registration?.waiting) {
        offerUpdate(registration.waiting, true)
        return
      }
      requestUpdate()
    }

    const handlePageShow = () => {
      refreshPromptAvailability()
      if (registration?.waiting) {
        offerUpdate(registration.waiting, true)
        return
      }
      requestUpdate()
    }

    const handleControllerChange = () => {
      setWaitingWorker(null)
      if (!reloadRequestedRef.current) return
      reloadRequestedRef.current = false
      window.location.reload()
    }

    refreshPromptAvailability()
    document.addEventListener("fullscreenchange", refreshPromptAvailability)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pageshow", handlePageShow)
    window.addEventListener("wird-player-state-changed", refreshPromptAvailability)
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange)

    void (async () => {
      const existingRegistration = await navigator.serviceWorker.getRegistration("/")
      if (disposed) return
      if (existingRegistration?.waiting && navigator.serviceWorker.controller) {
        bindRegistration(existingRegistration, true)
        return
      }

      const nextRegistration = await navigator.serviceWorker.register(
        `/sw.js?release=${encodeURIComponent(registeredRelease)}`,
        { scope: "/", updateViaCache: "none" },
      )
      if (disposed) return
      bindRegistration(nextRegistration, true)
      if (reloadRequestedRef.current) return
      requestUpdate()
      updateTimer = setInterval(requestUpdate, UPDATE_CHECK_INTERVAL_MS)
    })().catch(() => undefined)

    return () => {
      disposed = true
      registration?.removeEventListener("updatefound", watchInstallingWorker)
      removeInstallingListener?.()
      if (updateTimer) clearInterval(updateTimer)
      document.removeEventListener("fullscreenchange", refreshPromptAvailability)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pageshow", handlePageShow)
      window.removeEventListener("wird-player-state-changed", refreshPromptAvailability)
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange)
      registrationRef.current = null
    }
  }, [activateWaitingWorker, refreshPromptAvailability])

  const applyUpdate = () => {
    const worker = waitingWorker ?? registrationRef.current?.waiting
    if (worker) void activateWaitingWorker(worker)
  }

  const dismissUpdate = () => {
    if (waitingWorker) window.localStorage.setItem(DISMISSED_UPDATE_KEY, waitingWorker.scriptURL)
    setDismissed(true)
  }

  if (!waitingWorker || dismissed || !canPrompt || !promptHost) return null

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto flex h-8 w-max max-w-[min(58vw,240px)] items-center gap-1 rounded-md border border-primary/15 bg-secondary/95 px-1.5 text-secondary-foreground shadow-sm backdrop-blur"
      dir="rtl"
    >
      <span className="hidden truncate text-[11px] font-medium min-[390px]:inline sm:text-xs">نسخة جديدة جاهزة</span>
      <Button size="xs" className="h-6 gap-1 px-1.5 text-[11px]" disabled={updating} onClick={applyUpdate}>
        {updating ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
        تحديث
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        className="size-6 shrink-0 text-muted-foreground"
        aria-label="تأجيل تحديث التطبيق"
        disabled={updating}
        onClick={dismissUpdate}
      >
        <X />
      </Button>
    </div>,
    promptHost,
  )
}
