/**
 * Calendario local del asistente.
 *
 * Eventos persistidos en IndexedDB. El asistente puede crear, listar y
 * cancelar eventos por voz/texto. Soporta recordatorios (avisos por
 * Telegram si está configurado).
 */

import { openDB, type IDBPDatabase } from 'idb'
import * as obsidian from './obsidian'

export type CalEvent = {
  id: string
  title: string
  description?: string
  start: number // epoch ms
  end?: number
  allDay?: boolean
  reminderMinutes?: number
  notified?: boolean
  createdAt: number
}

const DB_NAME = 'jarvis-calendar'
const DB_VERSION = 1
const STORE = 'events'

let dbPromise: Promise<IDBPDatabase> | null = null
function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const s = db.createObjectStore(STORE, { keyPath: 'id' })
          s.createIndex('start', 'start')
        }
      },
    })
  }
  return dbPromise
}

function uid(): string {
  return 'e_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export async function addEvent(input: {
  title: string
  description?: string
  start: number | string
  end?: number | string
  allDay?: boolean
  reminderMinutes?: number
}): Promise<CalEvent> {
  const start = typeof input.start === 'string' ? new Date(input.start).getTime() : input.start
  const end = input.end
    ? typeof input.end === 'string'
      ? new Date(input.end).getTime()
      : input.end
    : undefined
  const ev: CalEvent = {
    id: uid(),
    title: input.title,
    description: input.description,
    start,
    end,
    allDay: input.allDay,
    reminderMinutes: input.reminderMinutes,
    notified: false,
    createdAt: Date.now(),
  }
  const d = await db()
  await d.put(STORE, ev)
  // Espejo del evento en la bóveda de Obsidian
  obsidian.mirrorEvent(ev)
  return ev
}

export async function listEvents(range?: { from?: number; to?: number }): Promise<CalEvent[]> {
  const d = await db()
  const all = (await d.getAll(STORE)) as CalEvent[]
  let out = all
  if (range?.from) out = out.filter((e) => e.start >= range.from!)
  if (range?.to) out = out.filter((e) => e.start <= range.to!)
  return out.sort((a, b) => a.start - b.start)
}

export async function upcoming(days = 7): Promise<CalEvent[]> {
  const now = Date.now()
  const to = now + days * 24 * 60 * 60 * 1000
  return listEvents({ from: now, to })
}

export async function deleteEvent(id: string): Promise<boolean> {
  const d = await db()
  const all = await listEvents()
  const ev = all.find((e) => e.id === id)
  if (!ev) return false
  await d.delete(STORE, id)
  obsidian.unmirrorEvent(ev)
  return true
}

export async function dueReminders(): Promise<CalEvent[]> {
  const now = Date.now()
  const all = await listEvents()
  return all.filter((e) => {
    if (e.notified) return false
    if (e.reminderMinutes == null) return false
    const remindAt = e.start - e.reminderMinutes * 60 * 1000
    return remindAt <= now && now < e.start
  })
}

export async function markNotified(id: string): Promise<void> {
  const d = await db()
  const all = await listEvents()
  const ev = all.find((e) => e.id === id)
  if (!ev) return
  ev.notified = true
  await d.put(STORE, ev)
}

export function formatEvent(e: CalEvent): string {
  const d = new Date(e.start)
  const date = d.toLocaleString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${e.title} — ${date}${e.description ? ' · ' + e.description : ''}`
}
