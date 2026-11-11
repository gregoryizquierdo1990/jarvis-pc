/**
 * Bitácora diaria del asistente.
 *
 * Cada día se registra un resumen: qué se aprendió, decisiones, estado del
 * negocio, sugerencias dadas. Esto da "conciencia" temporal: el asistente
 * puede referirse a días anteriores y detectar tendencias.
 */

import { openDB, type IDBPDatabase } from 'idb'
import * as obsidian from './obsidian'

export type JournalEntry = {
  id: string
  date: string // YYYY-MM-DD
  summary: string
  learned: string[]
  decisions: string[]
  metrics?: Record<string, number>
  mood?: 'positive' | 'neutral' | 'concern'
  createdAt: number
}

const DB_NAME = 'jarvis-journal'
const DB_VERSION = 1
const STORE = 'entries'

let dbPromise: Promise<IDBPDatabase> | null = null
function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: 'id' })
          s.createIndex('date', 'date')
        }
      },
    })
  }
  return dbPromise
}

function uid() {
  return 'j_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export async function log(input: {
  summary: string
  learned?: string[]
  decisions?: string[]
  metrics?: Record<string, number>
  mood?: JournalEntry['mood']
  date?: string
}): Promise<JournalEntry> {
  const entry: JournalEntry = {
    id: uid(),
    date: input.date || today(),
    summary: input.summary,
    learned: input.learned || [],
    decisions: input.decisions || [],
    metrics: input.metrics,
    mood: input.mood,
    createdAt: Date.now(),
  }
  const d = await db()
  await d.put(STORE, entry)
  // Espejo a la bitácora diaria de la bóveda de Obsidian
  obsidian.mirrorJournal(entry)
  return entry
}

export async function list(days = 30): Promise<JournalEntry[]> {
  const d = await db()
  const all = (await d.getAll(STORE)) as JournalEntry[]
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  return all.filter((e) => e.createdAt >= cutoff).sort((a, b) => b.createdAt - a.createdAt)
}

export async function recent(n = 7): Promise<JournalEntry[]> {
  const all = await list(90)
  return all.slice(0, n)
}

export async function byDate(date: string): Promise<JournalEntry[]> {
  const d = await db()
  const all = (await d.getAllFromIndex(STORE, 'date', date)) as JournalEntry[]
  return all
}

export async function buildContext(): Promise<string> {
  const entries = await recent(5)
  if (entries.length === 0) return ''
  const lines = entries.map(
    (e) =>
      `- ${e.date}: ${e.summary}${e.learned.length ? ' | Aprendido: ' + e.learned.join('; ') : ''}${e.decisions.length ? ' | Decisiones: ' + e.decisions.join('; ') : ''}`,
  )
  return `\n\nBITÁCORA RECIENTE (lo que ha pasado y aprendido en días anteriores):\n${lines.join('\n')}\n`
}

export async function stats() {
  const all = await list(365)
  const days = new Set(all.map((e) => e.date)).size
  return { totalEntries: all.length, daysCovered: days }
}
