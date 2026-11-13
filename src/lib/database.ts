/**
 * Conector de Bases de Datos Externas (Supabase / PostgreSQL) para Agente Milos.
 * Permite consultas dinámicas y transacciones de alta velocidad para inventarios,
 * stock de streaming, clientes y pedidos sin saturar el contexto de la IA.
 */

export interface DbConfig {
  supabaseUrl: string
  supabaseKey: string
  configured: boolean
}

const STORAGE_KEY = 'milos_db_config'

export function getDbConfig(): DbConfig {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    }
  } catch {}
  return {
    supabaseUrl: (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || '',
    supabaseKey: (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_KEY) || '',
    configured: Boolean(typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL),
  }
}

export function setDbConfig(url: string, key: string): void {
  const cfg: DbConfig = { supabaseUrl: url.trim(), supabaseKey: key.trim(), configured: Boolean(url && key) }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
    }
  } catch {}
}

/**
 * Consulta registros de una tabla en Supabase mediante su API REST.
 */
export async function queryTable(
  tableName: string,
  params: { select?: string; limit?: number; filters?: Record<string, string> } = {},
): Promise<{ ok: boolean; data?: any[]; error?: string }> {
  const cfg = getDbConfig()
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    return {
      ok: false,
      error: 'Supabase no está configurado. Ingrese la URL y API Key en configuración o proporcióñeselas a Milos.',
    }
  }

  try {
    const url = new URL(`${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`)
    url.searchParams.set('select', params.select || '*')
    if (params.limit) url.searchParams.set('limit', String(params.limit))
    if (params.filters) {
      for (const [k, v] of Object.entries(params.filters)) {
        url.searchParams.set(k, v)
      }
    }

    const res = await fetch(url.toString(), {
      headers: {
        apikey: cfg.supabaseKey,
        Authorization: `Bearer ${cfg.supabaseKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      const err = await res.text()
      return { ok: false, error: `Error ${res.status}: ${err}` }
    }

    const data = await res.json()
    return { ok: true, data }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

/**
 * Inserta un registro en una tabla de Supabase.
 */
export async function insertRecord(tableName: string, record: Record<string, any>): Promise<{ ok: boolean; data?: any; error?: string }> {
  const cfg = getDbConfig()
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    return { ok: false, error: 'Supabase no configurado.' }
  }

  try {
    const url = `${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: cfg.supabaseKey,
        Authorization: `Bearer ${cfg.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return { ok: false, error: await res.text() }
    const data = await res.json()
    return { ok: true, data }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}

/**
 * Actualiza registros en Supabase con filtro.
 */
export async function updateRecord(
  tableName: string,
  filterColumn: string,
  filterValue: string,
  patch: Record<string, any>,
): Promise<{ ok: boolean; data?: any; error?: string }> {
  const cfg = getDbConfig()
  if (!cfg.supabaseUrl || !cfg.supabaseKey) {
    return { ok: false, error: 'Supabase no configurado.' }
  }

  try {
    const url = `${cfg.supabaseUrl.replace(/\/$/, '')}/rest/v1/${tableName}?${filterColumn}=eq.${encodeURIComponent(filterValue)}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: cfg.supabaseKey,
        Authorization: `Bearer ${cfg.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return { ok: false, error: await res.text() }
    const data = await res.json()
    return { ok: true, data }
  } catch (err: any) {
    return { ok: false, error: err.message }
  }
}
