export const WIRD_BACKUP_VERSION = 1
export const WIRD_BACKUP_TIMESTAMP_KEY = "wird-backup-last-exported-at"
export const WIRD_BACKUP_CHANGE_EVENT = "wird-backup-changed"

export type WirdBackup = {
  app: "wird"
  version: number
  exportedAt: string
  data: Record<string, string>
}

function isWirdKey(key: string) {
  return key.startsWith("wird-") && key.length <= 120
}

export function readLastWirdBackupAt(storage: Storage) {
  const value = storage.getItem(WIRD_BACKUP_TIMESTAMP_KEY)
  if (!value || Number.isNaN(new Date(value).getTime())) return null
  return value
}

export function markWirdBackupCreated(storage: Storage, exportedAt = new Date().toISOString()) {
  storage.setItem(WIRD_BACKUP_TIMESTAMP_KEY, exportedAt)
  window.dispatchEvent(new Event(WIRD_BACKUP_CHANGE_EVENT))
  return exportedAt
}

export function createWirdBackup(storage: Storage): WirdBackup {
  const data: Record<string, string> = {}
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (!key || !isWirdKey(key)) continue
    const value = storage.getItem(key)
    if (value !== null) data[key] = value
  }
  return {
    app: "wird",
    version: WIRD_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

export function parseWirdBackup(value: string): WirdBackup {
  if (value.length > 10 * 1024 * 1024) throw new Error("حجم ملف النسخة الاحتياطية أكبر من المسموح")
  const parsed = JSON.parse(value) as Partial<WirdBackup>
  if (parsed.app !== "wird" || parsed.version !== WIRD_BACKUP_VERSION || !parsed.data || typeof parsed.data !== "object") {
    throw new Error("هذا الملف ليس نسخة احتياطية صالحة من وِردي")
  }
  const entries = Object.entries(parsed.data)
  if (entries.length > 500) throw new Error("تحتوي النسخة الاحتياطية على بيانات غير متوقعة")
  for (const [key, item] of entries) {
    if (!isWirdKey(key) || typeof item !== "string" || item.length > 3 * 1024 * 1024) {
      throw new Error("تحتوي النسخة الاحتياطية على بيانات غير صالحة")
    }
  }
  return {
    app: "wird",
    version: WIRD_BACKUP_VERSION,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date(0).toISOString(),
    data: Object.fromEntries(entries) as Record<string, string>,
  }
}

export function restoreWirdBackup(storage: Storage, backup: WirdBackup) {
  const currentKeys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => Boolean(key && isWirdKey(key)))
  currentKeys.forEach((key) => storage.removeItem(key))
  Object.entries(backup.data).forEach(([key, value]) => storage.setItem(key, value))
}
