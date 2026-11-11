/**
 * Ingesta de información en múltiples formatos.
 *
 * Acepta: texto, PDF, imágenes, URL, ZIP, RAR, y datos estructurados
 * (números, nombres, precios, reglas). Extrae texto y lo guarda en memoria.
 */

import * as memory from './memory'
import JSZip from 'jszip'
import * as pdfjsLib from 'pdfjs-dist'

// Configure pdfjs worker
try {
  // @ts-ignore
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString()
} catch {
  // fallback: no worker (main thread)
}

export type IngestResult = {
  kind: string
  title: string
  text: string
  chunks: number
  storedFacts: number
}

async function storeTextAsFacts(title: string, text: string, kind: string): Promise<number> {
  const trimmed = text.trim()
  if (!trimmed) return 0
  // Guardar como nota + trozos si es largo
  await memory.remember({
    kind: 'note',
    key: title,
    value: trimmed.slice(0, 4000),
    tags: [kind, 'ingested'],
    source: kind,
  })
  // Extraer líneas tipo "clave: valor" o "precio X"
  let n = 1
  const lines = trimmed.split(/\n+/)
  for (const line of lines) {
    const m = line.match(/^([^:-]{2,40})\s*[:-]\s*(.+)$/)
    if (m && m[2].trim().length > 0 && m[2].trim().length < 500) {
      await memory.remember({
        kind: 'fact',
        key: m[1].trim(),
        value: m[2].trim(),
        tags: [kind],
        source: title,
      })
      n++
    }
  }
  return n
}

export async function ingestText(text: string, title = 'Texto'): Promise<IngestResult> {
  const stored = await storeTextAsFacts(title, text, 'text')
  return { kind: 'text', title, text, chunks: 1, storedFacts: stored }
}

export async function ingestUrl(url: string): Promise<IngestResult> {
  // Usar proxy del bridge si está disponible para evitar CORS
  let html = ''
  try {
    const res = await fetch(url)
    html = await res.text()
  } catch {
    // intentar vía bridge /fetch
    try {
      const r = await fetch('/fetch?url=' + encodeURIComponent(url))
      html = await r.text()
    } catch {
      throw new Error('No se pudo obtener la URL (CORS). Configura el bridge.')
    }
  }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20000)
  const title = doc.querySelector('title')?.textContent?.trim() || url
  const stored = await storeTextAsFacts(title, text, 'url')
  return { kind: 'url', title, text, chunks: 1, storedFacts: stored }
}

export async function ingestPdf(file: File): Promise<IngestResult> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  let text = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((it: any) => it.str).join(' ')
    text += `\n--- Página ${i} ---\n${pageText}`
  }
  const stored = await storeTextAsFacts(file.name, text, 'pdf')
  return { kind: 'pdf', title: file.name, text: text.slice(0, 20000), chunks: pdf.numPages, storedFacts: stored }
}

export async function ingestImage(file: File): Promise<IngestResult> {
  // La imagen se guarda como referencia; el análisis visual lo hace Gemini
  const dataUrl = await fileToDataUrl(file)
  await memory.remember({
    kind: 'note',
    key: `imagen:${file.name}`,
    value: dataUrl.slice(0, 200) + '...[imagen]',
    tags: ['image', 'ingested'],
    source: file.name,
  })
  return { kind: 'image', title: file.name, text: `[Imagen ${file.name} guardada como referencia]`, chunks: 1, storedFacts: 1 }
}

export async function ingestZip(file: File): Promise<IngestResult> {
  const zip = await JSZip.loadAsync(file)
  let combined = ''
  let count = 0
  for (const name of Object.keys(zip.files)) {
    const entry = zip.files[name]
    if (entry.dir) continue
    try {
      const content = await entry.async('string')
      combined += `\n===== ${name} =====\n${content.slice(0, 5000)}`
      count++
    } catch {
      // binario
    }
  }
  const stored = await storeTextAsFacts(file.name, combined, 'zip')
  return { kind: 'zip', title: file.name, text: combined.slice(0, 20000), chunks: count, storedFacts: stored }
}

export async function ingestRar(file: File): Promise<IngestResult> {
  // RAR en navegador es limitado. Enviamos al bridge /extract si está disponible.
  const fd = new FormData()
  fd.append('file', file)
  try {
    const res = await fetch((window as any).__BRIDGE_HTTP__ || 'http://localhost:8787' + '/extract', {
      method: 'POST',
      body: fd,
    })
    const data = await res.json()
    const text = data.text || ''
    const stored = await storeTextAsFacts(file.name, text, 'rar')
    return { kind: 'rar', title: file.name, text: text.slice(0, 20000), chunks: data.files || 0, storedFacts: stored }
  } catch {
    await memory.remember({
      kind: 'note',
      key: `rar:${file.name}`,
      value: 'Archivo RAR recibido (no se pudo extraer en navegador; use el bridge).',
      tags: ['rar', 'ingested'],
      source: file.name,
    })
    return { kind: 'rar', title: file.name, text: 'RAR recibido (extracción no disponible sin bridge).', chunks: 0, storedFacts: 1 }
  }
}

export async function ingestFile(file: File): Promise<IngestResult> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return ingestPdf(file)
  if (name.endsWith('.zip')) return ingestZip(file)
  if (name.endsWith('.rar')) return ingestRar(file)
  if (name.match(/\.(png|jpg|jpeg|gif|webp|bmp)$/)) return ingestImage(file)
  // texto por defecto
  const text = await file.text()
  return ingestText(text, file.name)
}

export async function ingestStructured(data: {
  numbers?: number[]
  names?: string[]
  prices?: { item: string; price: number; currency?: string }[]
  rules?: string[]
}): Promise<number> {
  let n = 0
  if (data.numbers) for (const x of data.numbers) {
    await memory.remember({ kind: 'fact', key: `numero:${x}`, value: String(x), tags: ['number'] })
    n++
  }
  if (data.names) for (const x of data.names) {
    await memory.remember({ kind: 'contact', key: x, value: x, tags: ['name'] })
    n++
  }
  if (data.prices) for (const p of data.prices) {
    await memory.remember({
      kind: 'price',
      key: p.item,
      value: `${p.price} ${p.currency || ''}`.trim(),
      tags: ['price'],
    })
    n++
  }
  if (data.rules) for (const r of data.rules) {
    await memory.remember({ kind: 'rule', key: `regla:${r.slice(0, 40)}`, value: r, tags: ['rule'] })
    n++
  }
  return n
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}
