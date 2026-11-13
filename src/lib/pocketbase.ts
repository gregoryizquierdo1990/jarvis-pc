/**
 * Conector de PocketBase (backend SQLite embebido) y Budibase para Agente Milos.
 * Permite gestionar inventarios locales ultrarrápidos, stock de streaming,
 * pedidos y paneles sin consumo excesivo de memoria en Zorin OS.
 */

const STORAGE_KEY = 'milos_pb_config'

export interface PbConfig {
  url: string
  adminEmail?: string
  adminPassword?: string
}

export function getPbConfig(): PbConfig {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    }
  } catch {}
  return { url: 'http://127.0.0.1:8090' }
}

export function setPbConfig(url: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: url.trim().replace(/\/$/, '') }))
    }
  } catch {}
}

/**
 * Comprueba si la instancia de PocketBase está en línea.
 */
export async function pbCheck(): Promise<{ ok: boolean; status: string; url: string }> {
  const cfg = getPbConfig()
  try {
    const res = await fetch(`${cfg.url}/api/health`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      return { ok: true, status: 'PocketBase en línea y operativo.', url: cfg.url }
    }
    return { ok: false, status: `PocketBase respondió con estado ${res.status}`, url: cfg.url }
  } catch {
    return {
      ok: false,
      status: `PocketBase no detectado en ${cfg.url}. Puede iniciarlo descargando el binario oficial de pocketbase.io.`,
      url: cfg.url,
    }
  }
}

/**
 * Consulta registros de una colección de PocketBase (ej. 'streaming_accounts', 'pedidos', 'clientes').
 */
export async function pbListRecords(
  collection: string,
  params: { filter?: string; sort?: string; page?: number; perPage?: number } = {},
): Promise<{ ok: boolean; items?: any[]; totalItems?: number; error?: string }> {
  const cfg = getPbConfig()
  try {
    const url = new URL(`${cfg.url}/api/collections/${collection}/records`)
    if (params.filter) url.searchParams.set('filter', params.filter)
    if (params.sort) url.searchParams.set('sort', params.sort)
    if (params.page) url.searchParams.set('page', String(params.page))
    url.searchParams.set('perPage', String(params.perPage || 50))

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      return { ok: false, error: `PocketBase HTTP ${res.status}: ${await res.text()}` }
    }
    const data = await res.json()
    return { ok: true, items: data.items, totalItems: data.totalItems }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

/**
 * Crea un registro en una colección de PocketBase.
 */
export async function pbCreateRecord(collection: string, data: Record<string, any>): Promise<{ ok: boolean; record?: any; error?: string }> {
  const cfg = getPbConfig()
  try {
    const res = await fetch(`${cfg.url}/api/collections/${collection}/records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { ok: false, error: await res.text() }
    const record = await res.json()
    return { ok: true, record }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

/**
 * Actualiza un registro por ID en PocketBase.
 */
export async function pbUpdateRecord(
  collection: string,
  id: string,
  data: Record<string, any>,
): Promise<{ ok: boolean; record?: any; error?: string }> {
  const cfg = getPbConfig()
  try {
    const res = await fetch(`${cfg.url}/api/collections/${collection}/records/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return { ok: false, error: await res.text() }
    const record = await res.json()
    return { ok: true, record }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}
