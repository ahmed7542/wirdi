"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { replaceArabicSurahNames } from "@/lib/i18n/quran-names"
import { translateInterfaceText } from "@/lib/i18n/translations"

export type InterfaceLanguage = "ar" | "en"

export const INTERFACE_LANGUAGE_STORAGE_KEY = "wird-interface-language-v1"

const TRANSLATABLE_ATTRIBUTES = ["aria-label", "aria-description", "placeholder", "title", "alt"] as const
const QURAN_TEXT_SELECTOR = "[data-quran-text-page], [data-quran-content], [translate='no'], [data-no-interface-translation]"
const originalText = new WeakMap<Text, string>()
const originalAttributes = new WeakMap<Element, Map<string, string>>()
const originalDirections = new WeakMap<HTMLElement, string>()

const InterfaceLanguageContext = createContext<{
  language: InterfaceLanguage
  direction: "rtl" | "ltr"
  setLanguage: (language: InterfaceLanguage) => void
  t: (value: string) => string
}>({
  language: "ar",
  direction: "rtl",
  setLanguage: () => undefined,
  t: (value) => value,
})

function isInterfaceLanguage(value: string | null): value is InterfaceLanguage {
  return value === "ar" || value === "en"
}

function isQuranTextNode(node: Text) {
  if (node.parentElement?.closest(QURAN_TEXT_SELECTOR)) return true
  if (!node.parentElement?.closest(".font-quran")) return false
  return replaceArabicSurahNames(node.data) === node.data
}

function translateTextNode(node: Text, language: InterfaceLanguage) {
  if (isQuranTextNode(node)) return
  const current = node.data
  const saved = originalText.get(node)
  if (language === "ar") {
    if (saved !== undefined && current !== saved) node.data = saved
    return
  }

  if (saved === undefined && !/[\u0600-\u06FF]/.test(current)) return
  const expectedSavedTranslation = saved === undefined ? undefined : translateInterfaceText(saved)
  if (saved !== undefined && current !== expectedSavedTranslation && !/[\u0600-\u06FF]/.test(current)) {
    originalText.delete(node)
    return
  }
  const source = saved === undefined || current !== expectedSavedTranslation ? current : saved
  const translated = translateInterfaceText(source)
  if (translated === source) return
  if (source !== saved) originalText.set(node, source)
  if (current !== translated) node.data = translated
}

function translateElementAttributes(element: Element, language: InterfaceLanguage) {
  let savedAttributes = originalAttributes.get(element)
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    const current = element.getAttribute(attribute)
    const saved = savedAttributes?.get(attribute)
    if (language === "ar") {
      if (saved !== undefined && current !== saved) element.setAttribute(attribute, saved)
      continue
    }
    if (!current || (saved === undefined && !/[\u0600-\u06FF]/.test(current))) continue
    const expectedSavedTranslation = saved === undefined ? undefined : translateInterfaceText(saved)
    if (saved !== undefined && current !== expectedSavedTranslation && !/[\u0600-\u06FF]/.test(current)) {
      savedAttributes?.delete(attribute)
      continue
    }
    const source = saved === undefined || current !== expectedSavedTranslation ? current : saved
    const translated = translateInterfaceText(source)
    if (translated === source) continue
    if (source !== saved) {
      savedAttributes ??= new Map<string, string>()
      savedAttributes.set(attribute, source)
      originalAttributes.set(element, savedAttributes)
    }
    if (current !== translated) element.setAttribute(attribute, translated)
  }

  if (!(element instanceof HTMLElement) || element.closest(QURAN_TEXT_SELECTOR)) return
  const currentDirection = element.getAttribute("dir")
  const savedDirection = originalDirections.get(element)
  if (language === "ar") {
    if (savedDirection !== undefined && currentDirection !== savedDirection) element.setAttribute("dir", savedDirection)
    return
  }
  if (currentDirection === "rtl") {
    if (savedDirection === undefined) originalDirections.set(element, currentDirection)
    element.setAttribute("dir", "ltr")
  }
}

function translateSubtree(root: Node, language: InterfaceLanguage) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, language)
    return
  }
  if (!(root instanceof Element) && !(root instanceof DocumentFragment) && !(root instanceof Document)) return
  if (root instanceof Element) translateElementAttributes(root, language)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text, language)
    else translateElementAttributes(node as Element, language)
    node = walker.nextNode()
  }
}

function applyDocumentLanguage(language: InterfaceLanguage) {
  const root = document.documentElement
  root.lang = language
  root.dir = language === "en" ? "ltr" : "rtl"
  root.dataset.interfaceLanguage = language
}

export function useInterfaceLanguage() {
  return useContext(InterfaceLanguageContext)
}

export function InterfaceLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<InterfaceLanguage>("ar")
  const languageRef = useRef<InterfaceLanguage>("ar")
  const originalTitleRef = useRef<string | null>(null)

  const setLanguage = useCallback((nextLanguage: InterfaceLanguage) => {
    languageRef.current = nextLanguage
    setLanguageState(nextLanguage)
    window.localStorage.setItem(INTERFACE_LANGUAGE_STORAGE_KEY, nextLanguage)
    applyDocumentLanguage(nextLanguage)
    window.dispatchEvent(new CustomEvent("wird-interface-language-changed", {
      detail: { language: nextLanguage },
    }))
  }, [])

  useEffect(() => {
    originalTitleRef.current ??= document.title
    const savedLanguage = window.localStorage.getItem(INTERFACE_LANGUAGE_STORAGE_KEY)
    const initialLanguage = isInterfaceLanguage(savedLanguage) ? savedLanguage : "ar"
    languageRef.current = initialLanguage
    setLanguageState(initialLanguage)
    applyDocumentLanguage(initialLanguage)
  }, [])

  useEffect(() => {
    applyDocumentLanguage(language)
    if (originalTitleRef.current) {
      document.title = language === "en"
        ? translateInterfaceText(originalTitleRef.current)
        : originalTitleRef.current
    }

    let frame = 0
    const pendingRoots = new Set<Node>()
    const flush = () => {
      frame = 0
      const roots = pendingRoots.size > 0 ? [...pendingRoots] : [document.body]
      pendingRoots.clear()
      for (const root of roots) translateSubtree(root, language)
    }
    const schedule = (root: Node = document.body) => {
      pendingRoots.add(root)
      if (!frame) frame = window.requestAnimationFrame(flush)
    }

    translateSubtree(document.body, language)
    if (language === "ar") return

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") schedule(mutation.target)
        if (mutation.type === "attributes") schedule(mutation.target)
        mutation.addedNodes.forEach((node) => schedule(node))
      }
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES, "dir"],
    })
    return () => {
      observer.disconnect()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [language])

  const value = useMemo(() => ({
    language,
    direction: language === "en" ? "ltr" as const : "rtl" as const,
    setLanguage,
    t: (value: string) => language === "en" ? translateInterfaceText(value) : value,
  }), [language, setLanguage])

  return (
    <InterfaceLanguageContext.Provider value={value}>
      {children}
    </InterfaceLanguageContext.Provider>
  )
}
