"use client"

import { type ReactNode, useState } from "react"
import { ChevronDown, LoaderCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

export type MutashabihatContextVerse = {
  verseKey: string
  surah: number
  ayah: number
  surahName: string
  page: number
  text: string
}

function formatAyahNumber(number: number) {
  return String(number).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)])
}

function AyahNumber({ number }: { number: number }) {
  return (
    <span className="whitespace-nowrap" aria-label={`الآية ${number}`}>
      {`\u00A0${formatAyahNumber(number)}`}
    </span>
  )
}

export function MutashabihatFollowingContext({
  children,
  verseKey,
  followingVerses = [],
  hasMoreFollowing = false,
  className,
}: {
  children: ReactNode
  verseKey: string
  followingVerses?: MutashabihatContextVerse[]
  hasMoreFollowing?: boolean
  className?: string
}) {
  const [loadedVerses, setLoadedVerses] = useState(followingVerses)
  const [visibleCount, setVisibleCount] = useState(0)
  const [hasMoreRemote, setHasMoreRemote] = useState(hasMoreFollowing)
  const [loadingNext, setLoadingNext] = useState(false)
  const hasMore = visibleCount < loadedVerses.length || hasMoreRemote

  const revealNext = async () => {
    if (visibleCount < loadedVerses.length) {
      setVisibleCount((current) => current + 1)
      return
    }
    if (!hasMoreRemote || loadingNext) return
    setLoadingNext(true)
    try {
      const afterVerseKey = loadedVerses.at(-1)?.verseKey ?? verseKey
      const response = await fetch(`/api/quran/mutashabihat?mode=following&verseKey=${encodeURIComponent(afterVerseKey)}`)
      const data = await response.json() as {
        verses?: MutashabihatContextVerse[]
        hasMoreFollowing?: boolean
      }
      if (!response.ok) throw new Error("تعذر تحميل الآية التالية")
      const nextVerses = data.verses ?? []
      setLoadedVerses((current) => [...current, ...nextVerses])
      if (nextVerses.length > 0) setVisibleCount((current) => current + 1)
      setHasMoreRemote(Boolean(data.hasMoreFollowing))
    } catch {
      // Keep the arrow available so the user can retry.
    } finally {
      setLoadingNext(false)
    }
  }

  const revealButton = (afterAyah?: number) => (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="ms-1 inline-flex align-middle text-primary"
      aria-label={afterAyah ? `عرض الآية التالية بعد الآية ${afterAyah}` : "عرض الآية التالية"}
      title="عرض الآية التالية"
      disabled={loadingNext}
      onClick={() => void revealNext()}
    >
      {loadingNext ? <LoaderCircle className="animate-spin" /> : <ChevronDown />}
    </Button>
  )

  const currentAyah = Number(verseKey.split(":")[1])

  return (
    <div className={className} data-mutashabihat-following-context={verseKey}>
      {children}
      <AyahNumber number={currentAyah} />
      {visibleCount === 0 && hasMore && revealButton(currentAyah)}
      {loadedVerses.slice(0, visibleCount).map((verse, index) => (
        <span key={verse.verseKey}>
          {" "}{verse.text}<AyahNumber number={verse.ayah} />
          {index === visibleCount - 1 && hasMore && revealButton(verse.ayah)}
        </span>
      ))}
    </div>
  )
}
