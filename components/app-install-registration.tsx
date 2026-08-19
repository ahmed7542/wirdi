"use client"

import { useEffect } from "react"

import {
  clearDeferredInstallPrompt,
  setDeferredInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/app-install"

export function AppInstallRegistration() {
  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent)
    }
    const handleInstalled = () => clearDeferredInstallPrompt()

    window.addEventListener("beforeinstallprompt", handleInstallPrompt)
    window.addEventListener("appinstalled", handleInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt)
      window.removeEventListener("appinstalled", handleInstalled)
    }
  }, [])

  return null
}
