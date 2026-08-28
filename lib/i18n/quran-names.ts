const ENGLISH_SURAH_NAMES = [
  "Al-Fatihah", "Al-Baqarah", "Ali 'Imran", "An-Nisa", "Al-Ma'idah", "Al-An'am",
  "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus", "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim",
  "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Taha", "Al-Anbya", "Al-Hajj",
  "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara", "An-Naml", "Al-Qasas",
  "Al-'Ankabut", "Ar-Rum", "Luqman", "As-Sajdah", "Al-Ahzab", "Saba", "Fatir", "Ya-Sin",
  "As-Saffat", "Sad", "Az-Zumar", "Ghafir", "Fussilat", "Ash-Shuraa", "Az-Zukhruf",
  "Ad-Dukhan", "Al-Jathiyah", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf",
  "Adh-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid",
  "Al-Mujadilah", "Al-Hashr", "Al-Mumtahanah", "As-Saff", "Al-Jumu'ah", "Al-Munafiqun",
  "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij",
  "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah", "Al-Insan",
  "Al-Mursalat", "An-Naba", "An-Nazi'at", "'Abasa", "At-Takwir", "Al-Infitar",
  "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiyah",
  "Al-Fajr", "Al-Balad", "Ash-Shams", "Al-Layl", "Ad-Duhaa", "Ash-Sharh", "At-Tin",
  "Al-'Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-'Adiyat", "Al-Qari'ah",
  "At-Takathur", "Al-'Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar",
  "Al-Kafirun", "An-Nasr", "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas",
] as const

const ARABIC_SURAH_NAMES = [
  "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال",
  "التوبة", "يونس", "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء",
  "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء",
  "النمل", "القصص", "العنكبوت", "الروم", "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر",
  "يس", "الصافات", "ص", "الزمر", "غافر", "فصلت", "الشورى", "الزخرف", "الدخان",
  "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق", "الذاريات", "الطور", "النجم",
  "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف", "الجمعة",
  "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج", "نوح",
  "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
  "التكوير", "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى", "الغاشية",
  "الفجر", "البلد", "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة",
  "الزلزلة", "العاديات", "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون",
  "الكوثر", "الكافرون", "النصر", "المسد", "الإخلاص", "الفلق", "الناس",
] as const

const COMMON_ALIASES: Record<number, string[]> = {
  1: ["fatiha", "fatihah", "al fatiha", "opening"],
  2: ["baqara", "baqarah", "bakara", "the cow"],
  3: ["al imran", "aal imran", "imran"],
  4: ["nisa", "nisaa", "women"],
  5: ["maidah", "maida", "table spread"],
  6: ["anam", "anaam"],
  7: ["araf", "araaf"],
  9: ["tawba", "tawbah", "baraah"],
  17: ["isra", "israa", "bani israel"],
  18: ["kahf", "the cave"],
  20: ["ta ha"],
  21: ["anbiya", "anbiyaa"],
  23: ["muminun", "muminoon"],
  24: ["nur", "noor"],
  26: ["shuara", "shuaraa"],
  29: ["ankabut", "ankaboot"],
  32: ["sajda", "sajdah"],
  34: ["saba", "sabaa"],
  35: ["fatir", "faatir"],
  36: ["yasin", "yaseen", "ya sin"],
  40: ["mumin", "ghafir"],
  41: ["ha mim sajdah", "fussilat"],
  42: ["shura", "shoora"],
  44: ["dukhan", "dukhaan"],
  55: ["rahman", "rehman"],
  56: ["waqiah", "waqia", "waqiah"],
  67: ["mulk", "tabarak"],
  76: ["insan", "dahr"],
  78: ["naba", "amma"],
  93: ["duha", "dhuha"],
  94: ["inshirah", "sharh"],
  96: ["alaq", "iqra"],
  99: ["zilzal", "zalzalah"],
  103: ["asr"],
  105: ["fil", "feel"],
  106: ["quraish", "quraysh"],
  107: ["maun", "maoon"],
  108: ["kawthar", "kauthar"],
  109: ["kafirun", "kafiroon"],
  111: ["lahab", "masad"],
  112: ["ikhlas", "ikhlaas"],
  113: ["falaq"],
  114: ["nas", "naas"],
}

export function normalizeEnglishQuranName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:surah|sura|chapter)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function searchableForms(value: string) {
  const normalized = normalizeEnglishQuranName(value)
  const withoutArticle = normalized.replace(/^(?:al|an|ar|as|ash|at|az|ad|adh)\s+/, "")
  return new Set([normalized, normalized.replaceAll(" ", ""), withoutArticle, withoutArticle.replaceAll(" ", "")])
}

const ENGLISH_SEARCH_FORMS = ENGLISH_SURAH_NAMES.map((name, index) => {
  const forms = new Set(searchableForms(name))
  for (const alias of COMMON_ALIASES[index + 1] ?? []) {
    for (const form of searchableForms(alias)) forms.add(form)
  }
  return forms
})

function normalizeArabicName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ـ/g, "")
    .trim()
}

const ARABIC_DIACRITICS_PATTERN = "[\\u064B-\\u065F\\u0670\\u06D6-\\u06ED]*"

function arabicNamePattern(value: string) {
  return [...value].map((character) => {
    if (/\s/.test(character)) return "\\s+"
    const escaped = character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return `${escaped}${ARABIC_DIACRITICS_PATTERN}`
  }).join("")
}

const ARABIC_TO_ENGLISH = new Map(
  ARABIC_SURAH_NAMES.map((name, index) => [normalizeArabicName(name), ENGLISH_SURAH_NAMES[index]]),
)

export function getEnglishSurahName(chapterId: number) {
  return ENGLISH_SURAH_NAMES[chapterId - 1] ?? String(chapterId)
}

export function findEnglishSurahIds(query: string, exact = false) {
  const forms = searchableForms(query)
  const compactQuery = [...forms].find((form) => form.length > 0) ?? ""
  if (!compactQuery) return []
  return ENGLISH_SEARCH_FORMS.flatMap((chapterForms, index) => {
    const matches = exact
      ? [...forms].some((form) => chapterForms.has(form))
      : [...forms].some((form) => [...chapterForms].some((candidate) => candidate.includes(form)))
    return matches ? [index + 1] : []
  })
}

export function replaceArabicSurahNames(value: string) {
  const normalizedValue = normalizeArabicName(value)
  const exactName = normalizedValue.length > 1 ? ARABIC_TO_ENGLISH.get(normalizedValue) : undefined
  if (exactName) return exactName

  let result = value
  ARABIC_SURAH_NAMES.forEach((arabic, index) => {
    const namePattern = arabicNamePattern(arabic)
    result = result.replace(
      new RegExp(`((?:س${ARABIC_DIACRITICS_PATTERN}و${ARABIC_DIACRITICS_PATTERN}ر${ARABIC_DIACRITICS_PATTERN}ة${ARABIC_DIACRITICS_PATTERN})\\s+)${namePattern}`, "g"),
      `$1${ENGLISH_SURAH_NAMES[index]}`,
    )
  })
  return result
}
