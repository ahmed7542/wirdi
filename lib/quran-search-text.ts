export function sanitizeQuranSearchText(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;|&#xA0;/gi, " ")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/[\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]/g, "")
    .replace(/[\u06DD\u06DE\u06E9\uFD3E\uFD3F|¦]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
