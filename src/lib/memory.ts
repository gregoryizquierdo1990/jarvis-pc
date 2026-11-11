/**
 * Memoria persistente del asistente.
 *
 * Guarda "hechos" (facts), preferencias, reglas de negocio, contactos,
 * productos/precios y cualquier cosa que el usuario quiera que recuerde.
 * Persiste en IndexedDB para sobrevivir recargas y sesiones.
 *
 * El asistente es autodidacta: cada interacción puede añadir hechos, y
 * antes de responder se inyecta el contexto relevante (RAG simple por
 * palabras clave) en el prompt del modelo.
 */

import { openDB, type IDBPDatabase } from 'idb'
import * as obsidian from './obsidian'

export type Fact = {
  id: string
  kind: 'fact' | 'preference' | 'rule' | 'contact' | 'product' | 'price' | 'note'
  key: string
  value: string
  tags: string[]
  createdAt: number
  updatedAt: number
  source?: string
}

export type MemoryEntry = Fact

const DB_NAME = 'jarvis-memory'
const DB_VERSION = 1
const STORE = 'facts'

let dbPromise: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' })
          store.createIndex('kind', 'kind')
          store.createIndex('key', 'key')
          store.createIndex('updatedAt', 'updatedAt')
        }
      },
    })
  }
  return dbPromise
}

function uid(): string {
  return 'f_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function remember(input: {
  kind?: Fact['kind']
  key: string
  value: string
  tags?: string[]
  source?: string
}): Promise<Fact> {
  const now = Date.now()
  // upsert por key
  const all = await listFacts()
  const existing = all.find((f) => f.key.toLowerCase() === input.key.toLowerCase())
  const fact: Fact = {
    id: existing?.id ?? uid(),
    kind: input.kind ?? existing?.kind ?? 'fact',
    key: input.key,
    value: input.value,
    tags: input.tags ?? existing?.tags ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    source: input.source ?? existing?.source,
  }
  const d = await db()
  await d.put(STORE, fact)
  // Espejo a la bóveda de Obsidian (best-effort; si el bridge no está, no rompe nada)
  obsidian.mirrorFact(fact)
  return fact
}

export async function forget(idOrKey: string): Promise<boolean> {
  const d = await db()
  const all = await listFacts()
  const target = all.find(
    (f) => f.id === idOrKey || f.key.toLowerCase() === idOrKey.toLowerCase(),
  )
  if (!target) return false
  await d.delete(STORE, target.id)
  obsidian.unmirrorFact(target.key)
  return true
}

export async function listFacts(): Promise<Fact[]> {
  const d = await db()
  const all = (await d.getAll(STORE)) as Fact[]
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getFact(key: string): Promise<Fact | undefined> {
  const all = await listFacts()
  return all.find((f) => f.key.toLowerCase() === key.toLowerCase())
}

export async function searchFacts(query: string, limit = 20): Promise<Fact[]> {
  const all = await listFacts()
  const q = query.toLowerCase().trim()
  if (!q) return all.slice(0, limit)
  const terms = q.split(/\s+/).filter(Boolean)
  const scored = all.map((f) => {
    const hay = (f.key + ' ' + f.value + ' ' + f.tags.join(' ') + ' ' + f.kind).toLowerCase()
    let score = 0
    for (const t of terms) {
      if (hay.includes(t)) score += 1
      if (f.key.toLowerCase().includes(t)) score += 2
    }
    return { f, score }
  })
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f)
}

/** Contexto a inyectar en el prompt del modelo según la consulta del usuario. */
export async function buildContext(query: string, maxFacts = 12): Promise<string> {
  const relevant = await searchFacts(query, maxFacts)
  const all = await listFacts()
  const recent = all.slice(0, 6)
  const set = new Set(relevant.map((f) => f.id))
  const merged = [...relevant, ...recent.filter((f) => !set.has(f.id))].slice(0, maxFacts)
  if (merged.length === 0) return ''
  const lines = merged.map((f) => `- [${f.kind}] ${f.key}: ${f.value}`)
  return `\n\nMEMORIA DEL ASISTENTE (hechos que el usuario te ha dado o que has aprendido; úsalos para personalizar y ser preciso):\n${lines.join('\n')}\n`
}

export async function exportMemory(): Promise<string> {
  const all = await listFacts()
  return JSON.stringify(all, null, 2)
}

export async function importMemory(json: string): Promise<number> {
  const arr = JSON.parse(json) as Fact[]
  let n = 0
  for (const f of arr) {
    await remember({ kind: f.kind, key: f.key, value: f.value, tags: f.tags, source: f.source })
    n++
  }
  return n
}

export async function clearMemory(): Promise<void> {
  const d = await db()
  await d.clear(STORE)
}
