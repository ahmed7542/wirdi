import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"

export const AHMED_DEBAN_RECITER_ID = 2001
export const YASSER_SALAMA_RECITER_ID = 2002
export const HADR_RECITER_IDS = new Set([AHMED_DEBAN_RECITER_ID, YASSER_SALAMA_RECITER_ID])

export type HadrSyncScope = "chapter" | "page"

type HadrCatalogFile = {
  number: number
  name: string
  durationMs: number
  size: number
}

type HadrCatalog = {
  reciterId: number
  name: string
  scope: HadrSyncScope
  identifier: string
  source: string
  files: HadrCatalogFile[]
}

type LoadedHadrCatalog = Omit<HadrCatalog, "files"> & {
  files: Map<number, HadrCatalogFile>
}

const CATALOG_FILES = {
  [AHMED_DEBAN_RECITER_ID]: "ahmed-deban-hadr-catalog.json",
  [YASSER_SALAMA_RECITER_ID]: "yasser-salama-hadr-catalog.json",
} as const

const EXPECTED_FILE_COUNTS = {
  [AHMED_DEBAN_RECITER_ID]: 114,
  [YASSER_SALAMA_RECITER_ID]: 604,
} as const

const catalogPromises = new Map<number, Promise<LoadedHadrCatalog>>()

async function loadCatalog(reciter: number) {
  const filename = CATALOG_FILES[reciter as keyof typeof CATALOG_FILES]
  const expectedCount = EXPECTED_FILE_COUNTS[reciter as keyof typeof EXPECTED_FILE_COUNTS]
  if (!filename || !expectedCount) throw new Error(`No Hadr catalog for reciter ${reciter}`)

  const buffer = await readFile(path.join(process.cwd(), "data", "recitations", filename))
  const catalog = JSON.parse(buffer.toString("utf8")) as HadrCatalog
  if (
    catalog.reciterId !== reciter ||
    catalog.files.length !== expectedCount ||
    catalog.files.some((file, index) =>
      file.number !== index + 1 ||
      !file.name.endsWith(".mp3") ||
      file.durationMs <= 0 ||
      file.size <= 0,
    )
  ) {
    throw new Error(`Invalid Hadr catalog for reciter ${reciter}`)
  }

  return {
    ...catalog,
    files: new Map(catalog.files.map((file) => [file.number, file])),
  }
}

export function getHadrCatalog(reciter: number) {
  let promise = catalogPromises.get(reciter)
  if (!promise) {
    promise = loadCatalog(reciter)
    catalogPromises.set(reciter, promise)
  }
  return promise
}

export async function getHadrAudioFile(reciter: number, number: number) {
  const catalog = await getHadrCatalog(reciter)
  const file = catalog.files.get(number)
  if (!file) throw new Error(`Missing Hadr file ${number} for reciter ${reciter}`)
  return {
    ...file,
    scope: catalog.scope,
    source: catalog.source,
    audioUrl: `https://archive.org/download/${catalog.identifier}/${file.name}?download=1`,
  }
}
