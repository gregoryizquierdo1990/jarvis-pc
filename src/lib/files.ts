/**
 * Cliente frontend para búsqueda de archivos en la PC (vía bridge).
 */

const BRIDGE = () => (window as any).__BRIDGE_HTTP__ || 'http://localhost:8787'

export type FileHit = { path: string; name: string; snippet?: string; size?: number; mtime?: number }

export async function search(query: string, root?: string, max = 50): Promise<FileHit[]> {
  const params = new URLSearchParams({ q: query, max: String(max) })
  if (root) params.set('root', root)
  const res = await fetch(BRIDGE() + '/files/search?' + params.toString())
  if (!res.ok) throw new Error('Búsqueda de archivos falló')
  const data = await res.json()
  return data.hits || []
}

export async function readFile(path: string): Promise<string> {
  const res = await fetch(BRIDGE() + '/file?path=' + encodeURIComponent(path))
  if (!res.ok) throw new Error('No se pudo leer el archivo')
  return res.text()
}
