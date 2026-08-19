"use client"

import { useEffect } from "react"
import { RefreshCw, WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"

const RECOVERY_ATTEMPT_KEY = "wird-asset-recovery-attempt-v1"
const RECOVERY_COOLDOWN_MS = 30 * 1000
const ASSET_ERROR_PATTERN = /ChunkLoadError|Loading chunk|dynamically imported module|module script failed|Failed to fetch.*chunk/i

export default function ErrorPage({
  error,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
    if (!ASSET_ERROR_PATTERN.test(`${error.name} ${error.message}`)) return

    const lastAttempt = Number(window.sessionStorage.getItem(RECOVERY_ATTEMPT_KEY) ?? 0)
    if (Date.now() - lastAttempt < RECOVERY_COOLDOWN_MS) return
    window.sessionStorage.setItem(RECOVERY_ATTEMPT_KEY, String(Date.now()))
    window.location.reload()
  }, [error])

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-foreground">
      <div className="max-w-sm">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <WifiOff className="size-7" />
        </div>
        <h1 className="text-xl font-bold">تعذر إكمال هذه الشاشة</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          بياناتك المحفوظة لم تتأثر. أعد فتح التطبيق لاستعادة الصفحة.
        </p>
        <Button className="mt-5 gap-2" onClick={() => window.location.reload()}>
          <RefreshCw />
          إعادة فتح التطبيق
        </Button>
      </div>
    </main>
  )
}
