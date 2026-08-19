export const OFFLINE_AUDIO_CACHE = "wird-offline-surahs-v1"
export const OFFLINE_PAGE_CACHE = "wird-manual-pages-v2"
export const OFFLINE_RANGE_STORAGE_KEY = "wird-offline-ranges-v1"

export type OfflineRangeFile = {
  id: string
  label: string
  audioUrl: string
  fileSize: number
}

export type OfflineRangePackage = {
  key: string
  reciter: number
  reciterName: string
  fileMode: "chapters" | "verses" | "pages"
  files: OfflineRangeFile[]
  totalSize: number
  startAyahId: number
  endAyahId: number
  startVerseKey: string
  endVerseKey: string
  startPage: number
  endPage: number
}

export function loadOfflineRangePackages() {
  try {
    return JSON.parse(
      window.localStorage.getItem(OFFLINE_RANGE_STORAGE_KEY) ?? "[]",
    ) as OfflineRangePackage[]
  } catch {
    window.localStorage.removeItem(OFFLINE_RANGE_STORAGE_KEY)
    return []
  }
}

export function saveOfflineRangePackages(packages: OfflineRangePackage[]) {
  window.localStorage.setItem(OFFLINE_RANGE_STORAGE_KEY, JSON.stringify(packages))
  window.dispatchEvent(new Event("wird-offline-ranges-changed"))
}

export function formatOfflineBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 MB"
  if (value < 1024 ** 2) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / 1024 ** 2).toFixed(value >= 100 * 1024 ** 2 ? 0 : 1)} MB`
}
