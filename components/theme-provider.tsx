"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes"

export type AppPalette = "olive" | "navy-gold" | "turquoise" | "gold" | "blue" | "beige" | "charcoal" | "custom"

export type CustomPalette = {
  primary: string
  accent: string
  background: string
}

export const APP_PALETTES: Array<{
  id: AppPalette
  label: string
  swatches: [string, string, string]
}> = [
  { id: "navy-gold", label: "كحلي ذهبي", swatches: ["bg-[#203f62]", "bg-[#c7a94e]", "bg-[#f5f5f2]"] },
  { id: "olive", label: "زيتوني", swatches: ["bg-[#276653]", "bg-[#b89a4d]", "bg-[#f5f1e7]"] },
  { id: "turquoise", label: "فيروزي", swatches: ["bg-[#087f8c]", "bg-[#58a99e]", "bg-[#f2f8f7]"] },
  { id: "gold", label: "ذهبي معتّق", swatches: ["bg-[#b58a28]", "bg-[#e0c66f]", "bg-[#f5ead2]"] },
  { id: "blue", label: "أزرق", swatches: ["bg-[#3f65ad]", "bg-[#7b88c5]", "bg-[#f4f7fb]"] },
  { id: "beige", label: "بيج هادئ", swatches: ["bg-[#806b58]", "bg-[#b7aa82]", "bg-[#eee4d2]"] },
  { id: "charcoal", label: "فحمي", swatches: ["bg-[#343634]", "bg-[#8d918a]", "bg-[#f4f3ee]"] },
  { id: "custom", label: "مخصص", swatches: ["bg-[#276653]", "bg-[#b89a4d]", "bg-[#f5f1e7]"] },
]

const PALETTE_STORAGE_KEY = "wird-color-palette-v1"
const PALETTE_THEME_COLORS: Record<Exclude<AppPalette, "custom">, { light: string; dark: string }> = {
  olive: { light: "#276653", dark: "#182821" },
  "navy-gold": { light: "#203f62", dark: "#101923" },
  turquoise: { light: "#087f8c", dark: "#16363b" },
  gold: { light: "#b58a28", dark: "#4b3b20" },
  blue: { light: "#3f65ad", dark: "#202a42" },
  beige: { light: "#806b58", dark: "#29251f" },
  charcoal: { light: "#343434", dark: "#252525" },
}
const CUSTOM_PALETTE_STORAGE_KEY = "wird-custom-palette-v1"
const DEFAULT_CUSTOM_PALETTE: CustomPalette = {
  primary: "#276653",
  accent: "#d6b55d",
  background: "#f5f1e7",
}
const paletteIds = new Set<AppPalette>(APP_PALETTES.map((palette) => palette.id))
const customProperties = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--border",
  "--input",
  "--ring",
  "--quran-active",
  "--mushaf-paper",
  "--mushaf-ink",
  "--mushaf-border",
  "--mushaf-meta",
  "--quran-highlight",
  "--destructive",
  "--destructive-foreground",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
]

const PaletteContext = createContext<{
  palette: AppPalette
  customPalette: CustomPalette
  setPalette: (palette: AppPalette) => void
  setCustomPalette: (palette: CustomPalette) => void
}>({
  palette: "olive",
  customPalette: DEFAULT_CUSTOM_PALETTE,
  setPalette: () => undefined,
  setCustomPalette: () => undefined,
})

function isAppPalette(value: string | null): value is AppPalette {
  return Boolean(value && paletteIds.has(value as AppPalette))
}

function migratePalette(value: string | null): AppPalette | null {
  if (value === "ruby") return "gold"
  if (value === "plum") return "charcoal"
  return isAppPalette(value) ? value : null
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
}

function readCustomPalette(): CustomPalette {
  try {
    const saved = JSON.parse(window.localStorage.getItem(CUSTOM_PALETTE_STORAGE_KEY) ?? "null") as Partial<CustomPalette> | null
    return {
      primary: isHexColor(saved?.primary) ? saved.primary : DEFAULT_CUSTOM_PALETTE.primary,
      accent: isHexColor(saved?.accent) ? saved.accent : DEFAULT_CUSTOM_PALETTE.accent,
      background: isHexColor(saved?.background) ? saved.background : DEFAULT_CUSTOM_PALETTE.background,
    }
  } catch {
    return DEFAULT_CUSTOM_PALETTE
  }
}

function contrastColor(hex: string) {
  const values = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const luminance = values.reduce((total, value, index) => {
    const linear = value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    return total + linear * [0.2126, 0.7152, 0.0722][index]
  }, 0)
  return luminance > 0.47 ? "#17201d" : "#ffffff"
}

function applyCustomPalette(colors: CustomPalette) {
  const root = document.documentElement.style
  const foreground = contrastColor(colors.background)
  const primaryForeground = contrastColor(colors.primary)
  const accentForeground = contrastColor(colors.accent)
  const surfaceTarget = foreground === "#ffffff" ? "#ffffff" : "#000000"
  const surfaceRatio = foreground === "#ffffff" ? "8%" : "3%"
  root.setProperty("--background", colors.background)
  root.setProperty("--foreground", foreground)
  root.setProperty("--card", `color-mix(in srgb, ${colors.background}, ${surfaceTarget} ${surfaceRatio})`)
  root.setProperty("--card-foreground", foreground)
  root.setProperty("--popover", `color-mix(in srgb, ${colors.background}, ${surfaceTarget} ${surfaceRatio})`)
  root.setProperty("--popover-foreground", foreground)
  root.setProperty("--primary", colors.primary)
  root.setProperty("--primary-foreground", primaryForeground)
  root.setProperty("--secondary", `color-mix(in srgb, ${colors.accent}, ${colors.background} 72%)`)
  root.setProperty("--secondary-foreground", foreground)
  root.setProperty("--muted", `color-mix(in srgb, ${colors.background}, ${foreground} 7%)`)
  root.setProperty("--muted-foreground", `color-mix(in srgb, ${foreground}, ${colors.background} 38%)`)
  root.setProperty("--accent", colors.accent)
  root.setProperty("--accent-foreground", accentForeground)
  root.setProperty("--border", `color-mix(in srgb, ${foreground}, transparent 78%)`)
  root.setProperty("--input", `color-mix(in srgb, ${foreground}, transparent 78%)`)
  root.setProperty("--ring", colors.primary)
  root.setProperty("--quran-active", colors.primary)
  root.setProperty("--mushaf-paper", `color-mix(in srgb, ${colors.background}, ${surfaceTarget} ${surfaceRatio})`)
  root.setProperty("--mushaf-ink", foreground)
  root.setProperty("--mushaf-border", `color-mix(in srgb, ${colors.primary}, transparent 42%)`)
  root.setProperty("--mushaf-meta", `color-mix(in srgb, ${colors.primary}, ${foreground} 28%)`)
  root.setProperty("--quran-highlight", colors.accent)
  root.setProperty("--destructive", "#b34a3c")
  root.setProperty("--destructive-foreground", "#ffffff")
  root.setProperty("--chart-1", colors.primary)
  root.setProperty("--chart-2", colors.accent)
  root.setProperty("--chart-3", "#b34a3c")
  root.setProperty("--chart-4", "#4d7196")
  root.setProperty("--chart-5", "#8a7a52")
  root.setProperty("--sidebar", `color-mix(in srgb, ${colors.background}, ${surfaceTarget} ${surfaceRatio})`)
  root.setProperty("--sidebar-foreground", foreground)
  root.setProperty("--sidebar-primary", colors.primary)
  root.setProperty("--sidebar-primary-foreground", primaryForeground)
  root.setProperty("--sidebar-accent", `color-mix(in srgb, ${colors.accent}, ${colors.background} 72%)`)
  root.setProperty("--sidebar-accent-foreground", foreground)
  root.setProperty("--sidebar-border", `color-mix(in srgb, ${foreground}, transparent 78%)`)
  root.setProperty("--sidebar-ring", colors.primary)
}

function clearCustomPalette() {
  for (const property of customProperties) document.documentElement.style.removeProperty(property)
}

function syncThemeColor(
  palette: AppPalette,
  customPalette = readCustomPalette(),
  isDark = document.documentElement.classList.contains("dark"),
) {
  const color = palette === "custom"
    ? customPalette.primary
    : PALETTE_THEME_COLORS[palette][isDark ? "dark" : "light"]
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = color
  })
}

export function useAppPalette() {
  return useContext(PaletteContext)
}

function PaletteProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme()
  const [palette, setPaletteState] = useState<AppPalette>("olive")
  const [customPalette, setCustomPaletteState] = useState<CustomPalette>(DEFAULT_CUSTOM_PALETTE)

  useEffect(() => {
    const savedPalette = window.localStorage.getItem(PALETTE_STORAGE_KEY)
    const nextPalette = migratePalette(savedPalette) ?? "olive"
    if (savedPalette !== nextPalette) window.localStorage.setItem(PALETTE_STORAGE_KEY, nextPalette)
    const nextCustomPalette = readCustomPalette()
    setPaletteState(nextPalette)
    setCustomPaletteState(nextCustomPalette)
    document.documentElement.dataset.palette = nextPalette
    if (nextPalette === "custom") applyCustomPalette(nextCustomPalette)
    else clearCustomPalette()
    syncThemeColor(nextPalette, nextCustomPalette)
  }, [])

  const setPalette = useCallback((nextPalette: AppPalette) => {
    setPaletteState(nextPalette)
    document.documentElement.dataset.palette = nextPalette
    window.localStorage.setItem(PALETTE_STORAGE_KEY, nextPalette)
    if (nextPalette === "custom") applyCustomPalette(readCustomPalette())
    else clearCustomPalette()
    syncThemeColor(nextPalette)
  }, [])

  const setCustomPalette = useCallback((nextPalette: CustomPalette) => {
    const safePalette = {
      primary: isHexColor(nextPalette.primary) ? nextPalette.primary : DEFAULT_CUSTOM_PALETTE.primary,
      accent: isHexColor(nextPalette.accent) ? nextPalette.accent : DEFAULT_CUSTOM_PALETTE.accent,
      background: isHexColor(nextPalette.background) ? nextPalette.background : DEFAULT_CUSTOM_PALETTE.background,
    }
    setCustomPaletteState(safePalette)
    setPaletteState("custom")
    document.documentElement.dataset.palette = "custom"
    applyCustomPalette(safePalette)
    window.localStorage.setItem(CUSTOM_PALETTE_STORAGE_KEY, JSON.stringify(safePalette))
    window.localStorage.setItem(PALETTE_STORAGE_KEY, "custom")
    syncThemeColor("custom", safePalette)
  }, [])

  useEffect(() => {
    syncThemeColor(palette, customPalette, resolvedTheme === "dark")
  }, [customPalette, palette, resolvedTheme])

  const value = useMemo(
    () => ({ palette, customPalette, setPalette, setCustomPalette }),
    [customPalette, palette, setCustomPalette, setPalette],
  )

  return (
    <PaletteContext.Provider value={value}>
      {children}
    </PaletteContext.Provider>
  )
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PaletteProvider>{children}</PaletteProvider>
    </NextThemesProvider>
  )
}
