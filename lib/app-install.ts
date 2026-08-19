export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export const APP_INSTALL_PROMPT_CHANGE_EVENT = "wird-install-prompt-change"

declare global {
  interface Window {
    __wirdDeferredInstallPrompt?: BeforeInstallPromptEvent
  }
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null

function notifyPromptChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(APP_INSTALL_PROMPT_CHANGE_EVENT))
  }
}

export function getDeferredInstallPrompt() {
  return deferredInstallPrompt ??
    (typeof window !== "undefined" ? window.__wirdDeferredInstallPrompt ?? null : null)
}

export function setDeferredInstallPrompt(prompt: BeforeInstallPromptEvent) {
  deferredInstallPrompt = prompt
  if (typeof window !== "undefined") window.__wirdDeferredInstallPrompt = prompt
  notifyPromptChange()
}

export function clearDeferredInstallPrompt() {
  deferredInstallPrompt = null
  if (typeof window !== "undefined") delete window.__wirdDeferredInstallPrompt
  notifyPromptChange()
}
