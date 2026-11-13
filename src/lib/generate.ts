/**
 * Generación de archivos: texto, documentos, Excel, imágenes y video.
 */

import fileSaver from 'file-saver'
const saveAs =
  typeof (fileSaver as any)?.saveAs === 'function'
    ? (fileSaver as any).saveAs
    : typeof fileSaver === 'function'
      ? fileSaver
      : (_blob: any, _name: string) => {}
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
import { env } from '../config'

export async function textFile(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  saveAs(blob, name.endsWith('.txt') ? name : name + '.txt')
  return { ok: true, name }
}

export async function markdownFile(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  saveAs(blob, name.endsWith('.md') ? name : name + '.md')
  return { ok: true, name }
}

export async function docxFile(name: string, title: string, content: string) {
  const paragraphs = content.split(/\n+/).map((line) =>
    new Paragraph({ children: [new TextRun(line)] }),
  )
  const doc = new Document({
    sections: [{ properties: {}, children: [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }), ...paragraphs] }],
  })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, name.endsWith('.docx') ? name : name + '.docx')
  return { ok: true, name }
}

export async function excelFile(name: string, sheets: { name: string; rows: any[][] }[]) {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows)
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, name.endsWith('.xlsx') ? name : name + '.xlsx')
  return { ok: true, name }
}

export async function csvFile(name: string, rows: any[][]) {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(ws)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, name.endsWith('.csv') ? name : name + '.csv')
  return { ok: true, name }
}

export async function generateImage(prompt: string, name = 'imagen.png'): Promise<{ ok: boolean; name?: string; error?: string }> {
  const apiKey = (typeof window !== 'undefined' ? localStorage.getItem('jarvis_gemini_key') : null) || env.geminiKey || ''
  if (!apiKey) return { ok: false, error: 'Sin clave Gemini' }
  try {
    // Imagen 3 via predict endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '1:1' },
      }),
    })
    if (!res.ok) {
      const t = await res.text()
      return { ok: false, error: `Imagen API: ${res.status} ${t.slice(0, 200)}` }
    }
    const data = await res.json()
    const b64 = data?.predictions?.[0]?.bytesBase64Encoded
    if (!b64) return { ok: false, error: 'Sin imagen en respuesta' }
    const byteChars = atob(b64)
    const byteNums = new Array(byteChars.length)
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i)
    const blob = new Blob([new Uint8Array(byteNums)], { type: 'image/png' })
    saveAs(blob, name)
    return { ok: true, name }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}

export async function generateVideo(prompt: string, name = 'video.webm', seconds = 4): Promise<{ ok: boolean; name?: string; error?: string }> {
  // Genera un video simple animado (canvas) descargable. Para video con IA real se requiere backend.
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 360
    const ctx = canvas.getContext('2d')!
    const stream = canvas.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
    })
    recorder.start()
    const start = performance.now()
    const total = seconds * 1000
    await new Promise<void>((resolve) => {
      function frame() {
        const t = performance.now() - start
        if (t >= total) { recorder.stop(); resolve(); return }
        // fondo
        const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
        g.addColorStop(0, `hsl(${(t / 50) % 360}, 60%, 20%)`)
        g.addColorStop(1, `hsl(${(t / 50 + 120) % 360}, 60%, 10%)`)
        ctx.fillStyle = g
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        // texto prompt
        ctx.fillStyle = '#00f0ff'
        ctx.font = 'bold 20px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(prompt.slice(0, 40), canvas.width / 2, canvas.height / 2)
        ctx.font = '12px monospace'
        ctx.fillText(`JARVIS · ${(t / 1000).toFixed(1)}s`, canvas.width / 2, canvas.height / 2 + 30)
        requestAnimationFrame(frame)
      }
      requestAnimationFrame(frame)
    })
    const blob = await done
    saveAs(blob, name)
    return { ok: true, name }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) }
  }
}
