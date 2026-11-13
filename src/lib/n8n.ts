/**
 * Conector de automatizaciones con N8N (n8n-io/n8n).
 *
 * Permite a Milos consultar flujos existentes, disparar webhooks, crear o sugerir
 * flujos de automatización y solicitar credenciales faltantes al usuario.
 */

const N8N_URL_KEY = 'milos_n8n_url'
const N8N_API_KEY = 'milos_n8n_api_key'

export function getN8nConfig() {
  const url =
    (typeof window !== 'undefined' ? localStorage.getItem(N8N_URL_KEY) : null) ||
    (typeof process !== 'undefined' ? process.env.N8N_URL : null) ||
    'http://localhost:5678'
  const apiKey =
    (typeof window !== 'undefined' ? localStorage.getItem(N8N_API_KEY) : null) ||
    (typeof process !== 'undefined' ? process.env.N8N_API_KEY : null) ||
    ''
  return { url: url.replace(/\/+$/, ''), apiKey }
}

export function setN8nConfig(url: string, apiKey: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(N8N_URL_KEY, url)
    localStorage.setItem(N8N_API_KEY, apiKey)
  }
}

/** Comprueba si el servidor n8n está accesible */
export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const { url, apiKey } = getN8nConfig()
  try {
    const res = await fetch(`${url}/api/v1/workflows?limit=1`, {
      headers: apiKey ? { 'X-N8N-API-KEY': apiKey } : {},
      signal: AbortSignal.timeout(4000),
    })
    if (res.ok) {
      return { ok: true, message: `Conectado exitosamente a n8n en ${url}` }
    }
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message: `Se requiere una clave API válida para n8n (X-N8N-API-KEY). Puedes generarla en n8n > Settings > API.`,
      }
    }
    return { ok: false, message: `Respuesta de n8n: HTTP ${res.status}` }
  } catch (err: any) {
    return {
      ok: false,
      message: `No se pudo conectar a n8n en ${url}. Asegúrate de que n8n esté corriendo (ej. con npx n8n o Docker).`,
    }
  }
}

/** Dispara un Webhook de n8n con datos JSON */
export async function triggerWebhook(
  webhookPathOrUrl: string,
  payload: Record<string, any> = {},
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const { url } = getN8nConfig()
  const targetUrl = webhookPathOrUrl.startsWith('http')
    ? webhookPathOrUrl
    : `${url}/webhook/${webhookPathOrUrl.replace(/^\/+/, '')}`

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    })
    const text = await res.text()
    let data: any = text
    try {
      data = JSON.parse(text)
    } catch {}
    return { ok: res.ok, status: res.status, data }
  } catch (err: any) {
    return { ok: false, status: 0, error: err.message || 'Fallo de conexión al webhook' }
  }
}

/** Lista los flujos de trabajo de n8n si la API Key está configurada */
export async function listWorkflows(): Promise<{ ok: boolean; workflows?: any[]; error?: string }> {
  const { url, apiKey } = getN8nConfig()
  if (!apiKey) {
    return {
      ok: false,
      error: 'Se necesita la clave API de n8n para listar flujos. Puedes configurarla indicándomela en el chat.',
    }
  }

  try {
    const res = await fetch(`${url}/api/v1/workflows`, {
      headers: { 'X-N8N-API-KEY': apiKey },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      return { ok: false, error: `Error de n8n: HTTP ${res.status}` }
    }
    const data = await res.json()
    const workflows = (data.data || []).map((w: any) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }))
    return { ok: true, workflows }
  } catch (err: any) {
    return { ok: false, error: err.message || 'No se pudo conectar con la API de n8n' }
  }
}
