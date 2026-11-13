/**
 * Cliente de la bóveda de Obsidian de Milos (memoria en Markdown).
 *
 * La bóveda vive en el disco (~/Documentos/Boveda-Milos por defecto) y el
 * bridge expone lectura/escritura/búsqueda. Todo lo que Milos recuerda se
 * espeja aquí, y lo que el usuario escribe en Obsidian lo puede leer Milos.
 */

const BRIDGE = () =>
  (typeof window !== 'undefined' ? (window as any).__BRIDGE_HTTP__ : null) ||
  (typeof process !== 'undefined' ? process.env.JARVIS_BRIDGE_HTTP : null) ||
  'http://localhost:8787'

/** Convierte un título en nombre de archivo seguro. */
export function slug(s: string, maxlen = 60): string {
  const r = String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxlen)
  return r || 'nota'
}

async function j<T = any>(url: string, init?: RequestInit): Promise<T> {
  try {
    const res = await fetch(BRIDGE() + url, init)
    const d = await res.json()
    if (d?.error) throw new Error(d.error)
    return d as T
  } catch (err: any) {
    return { error: err.message || 'Bridge no alcanzable' } as unknown as T
  }
}

export async function root(): Promise<string> {
  const d = await j<{ root: string }>('/obsidian/root')
  return d.root
}

export async function listNotes(sub = ''): Promise<string[]> {
  const d = await j<{ files: string[] }>('/obsidian/list?path=' + encodeURIComponent(sub))
  return d.files || []
}

export async function readNote(path: string): Promise<string> {
  const d = await j<{ content: string }>('/obsidian/read?path=' + encodeURIComponent(path))
  return d.content
}

export async function searchNotes(query: string): Promise<Array<{ path: string; score: number; snippet: string }>> {
  const d = await j<{ results: Array<{ path: string; score: number; snippet: string }> }>(
    '/obsidian/search?q=' + encodeURIComponent(query),
  )
  return d.results || []
}

export async function writeNote(path: string, content: string): Promise<void> {
  await j('/obsidian/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
}

export async function appendNote(path: string, content: string): Promise<void> {
  await j('/obsidian/append', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
}

export async function deleteNote(path: string): Promise<void> {
  await j('/obsidian/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
}

/** Hoy en formato YYYY-MM-DD. */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ---- Espejado híbrido: IndexedDB (rápido, RAG) + Obsidian (legible) ----

/** Guarda un hecho de memoria también como nota Markdown en la bóveda. */
export function mirrorFact(fact: {
  kind: string
  key: string
  value: string
  tags?: string[]
}): void {
  const tags = (fact.tags || []).map((t) => t.replace(/[^\wá-úÁ-ÚñÑ-]/g, '')).filter(Boolean)
  const front = [
    '---',
    `kind: ${fact.kind}`,
    tags.length ? `tags: [${tags.join(', ')}]` : null,
    `updated: ${new Date().toISOString()}`,
    '---',
  ]
    .filter(Boolean)
    .join('\n')
  const body = `${front}\n\n# ${fact.key}\n\n${fact.value}\n`
  writeNote(`Milos/Memoria/${slug(fact.key)}.md`, body).catch(() => {
    /* bóveda no disponible: la memoria IndexedDB sigue intacta */
  })
}

/** Borra la nota espejo de un hecho olvidado. */
export function unmirrorFact(key: string): void {
  deleteNote(`Milos/Memoria/${slug(key)}.md`).catch(() => {})
}

/** Añade una entrada a la bitácora diaria en la bóveda. */
export function mirrorJournal(entry: {
  date: string
  summary: string
  learned?: string[]
  decisions?: string[]
}): void {
  const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  let block = `## ${time}\n\n${entry.summary}\n`
  if (entry.learned?.length) block += `\n**Aprendido:**\n${entry.learned.map((l) => `- ${l}`).join('\n')}\n`
  if (entry.decisions?.length) block += `\n**Decisiones:**\n${entry.decisions.map((d) => `- ${d}`).join('\n')}\n`
  appendNote(`Milos/Bitacora/${entry.date}.md`, block).catch(() => {})
}

/** Espeja un evento de calendario como nota de la bóveda. */
export function mirrorEvent(ev: {
  id: string
  title: string
  description?: string
  start: number
  reminderMinutes?: number
}): void {
  const d = new Date(ev.start)
  const date = d.toISOString().slice(0, 10)
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const front = [
    '---',
    `eventId: ${ev.id}`,
    `date: ${date}`,
    `time: ${time}`,
    ev.reminderMinutes !== undefined ? `reminder: ${ev.reminderMinutes} min antes` : null,
    '---',
  ]
    .filter(Boolean)
    .join('\n')
  const body = `${front}\n\n# ${ev.title}\n\n**Cuándo:** ${date} ${time}\n${ev.description ? `\n${ev.description}\n` : ''}`
  writeNote(`Milos/Calendario/${date} - ${slug(ev.title)}.md`, body).catch(() => {})
}

/** Borra la nota espejo de un evento eliminado. */
export function unmirrorEvent(ev: { id: string; title: string; start: number }): void {
  const date = new Date(ev.start).toISOString().slice(0, 10)
  deleteNote(`Milos/Calendario/${date} - ${slug(ev.title)}.md`).catch(() => {})
}
