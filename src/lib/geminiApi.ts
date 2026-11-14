/**
 * Cliente HTTP para la API de Gemini con tolerancia a "alta demanda" (503).
 *
 * El modelo gemini-3.8-flash devuelve a veces:
 *   "this model is currently experiencing high demand..."
 * que es un error 503/UNAVAILABLE **temporal del lado de Google**.
 *
 * Estrategia de resiliencia:
 *   1. Modelo "pegajoso": si un modelo respondió hace poco, se usa primero
 *      (evita repetir toda la cadena en cada paso del bucle de herramientas).
 *   2. Modelo principal (VITE_GEMINI_MODEL) con 2 intentos y esperas cortas
 *      (1.5s), rotando la clave de respaldo si existe.
 *   3. Cadena de modelos equivalentes: flash-latest, 3.6, 3.5, 3.5-lite...
 *   4. Presupuesto total (~20 s) para no dejar al usuario esperando.
 *   5. Al agotar todo, error claro en español (no el texto inglés de Google).
 */

import { env } from '../config'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Modelos de respaldo si el principal está saturado (503 alta demanda). */
const FALLBACK_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-flash-latest',
]

/** Presupuesto total de reintentos por llamada (ms). */
const TOTAL_BUDGET_MS = 20_000
/** Cuánto tiempo se recuerda el último modelo que funcionó (ms). */
const STICKY_TTL_MS = 5 * 60_000

// Último modelo que respondió OK: se usa primero mientras siga fresco.
let stickyModel: string | null = null
let stickyAt = 0

/** Lista de claves candidatas (localStorage, .env principal, .env respaldo), sin duplicados. */
export function geminiKeys(): string[] {
  const local =
    typeof window !== 'undefined' ? localStorage.getItem('jarvis_gemini_key') : null
  const keys = [local || '', env.geminiKey || '', env.geminiKey2 || '']
  return keys.filter((k, i) => k && keys.indexOf(k) === i)
}

/** ¿Es un error transitorio que merece reintento? */
function isRetryable(status: number, message: string): boolean {
  if (status === 503 || status === 429 || status === 500) return true
  const m = message.toLowerCase()
  return (
    m.includes('high demand') ||
    m.includes('overloaded') ||
    m.includes('unavailable') ||
    m.includes('try again') ||
    m.includes('temporarily')
  )
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new Error('cancelado'))
      },
      { once: true },
    )
  })

/**
 * Señal que combina el cancelamiento externo con un límite de tiempo por intento.
 * Un servidor saturado a veces cuelga la conexión: sin este límite, la petición
 * puede quedarse minutos sin responder y parece que el agente se congeló.
 */
function attemptSignal(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(new DOMException('timeout', 'TimeoutError')), timeoutMs)
  const onAbort = () => {
    clearTimeout(t)
    ac.abort(new Error('cancelado'))
  }
  if (external) {
    if (external.aborted) onAbort()
    else external.addEventListener('abort', onAbort, { once: true })
  }
  return ac.signal
}

function modelOrder(): string[] {
  const primary = env.geminiModel || 'gemini-3.8-flash'
  const fallbacks = FALLBACK_MODELS.filter((m) => m !== primary)
  const stickyFresh = stickyModel && Date.now() - stickyAt < STICKY_TTL_MS
  if (stickyFresh && stickyModel !== primary) {
    return [stickyModel as string, primary, ...fallbacks.filter((m) => m !== stickyModel)]
  }
  return [primary, ...fallbacks]
}

/**
 * Llama a generateContent con reintentos y fallback de modelo.
 * Devuelve el JSON de respuesta ya parseado. Lanza error en español si todo falla.
 * @param onRetry se llama antes de cada reintento, para avisar al usuario.
 */
export async function generateContent(
  body: unknown,
  opts: { signal?: AbortSignal; onRetry?: (attempt: number, waitMs: number, model: string) => void } = {},
): Promise<any> {
  const keys = geminiKeys()
  if (keys.length === 0) {
    throw new Error('Señor, no hay clave API de Gemini configurada (VITE_GEMINI_API_KEY).')
  }

  const startedAt = Date.now()
  const models = modelOrder()
  let attempt = 0
  let lastRetryable = false
  let lastMessage = ''

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi]
    const attemptsForModel = mi === 0 ? 2 : 1
    for (let a = 1; a <= attemptsForModel; a++) {
      attempt++
      const apiKey = keys[(attempt - 1) % keys.length]
      const url = `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: attemptSignal(8_000, opts.signal),
        })
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          const rawMessage = errJson?.error?.message || `HTTP ${res.status}`
          const isAuthError =
            res.status === 400 ||
            res.status === 401 ||
            res.status === 403 ||
            /api key not valid/i.test(rawMessage)

          if (isAuthError && typeof window !== 'undefined' && localStorage.getItem('jarvis_gemini_key') === apiKey) {
            localStorage.removeItem('jarvis_gemini_key')
          }

          if (isRetryable(res.status, rawMessage)) {
            lastRetryable = true
            lastMessage = rawMessage
            const moreHere = a < attemptsForModel
            if (moreHere || mi < models.length - 1) {
              // Espera corta y respetando el presupuesto total.
              const elapsed = Date.now() - startedAt
              const want = a * 1500
              const waitMs = Math.min(want, TOTAL_BUDGET_MS - elapsed, 3500)
              if (waitMs > 150) {
                opts.onRetry?.(attempt, waitMs, model)
                await sleep(waitMs, opts.signal)
              }
              if (moreHere) continue
              break // siguiente modelo de la cadena
            }
          }

          if (isAuthError) {
            throw new Error(
              'Señor, la clave API de Gemini no es válida o expiró. Verifique VITE_GEMINI_API_KEY en su archivo .env.local.',
            )
          }
          throw new Error(rawMessage)
        }
        const data = await res.json()
        // Este modelo respondió: recordarlo para las próximas llamadas.
        stickyModel = model
        stickyAt = Date.now()
        return data
      } catch (e: any) {
        const cancelled = opts.signal?.aborted || e?.message === 'cancelado'
        if (cancelled) throw e
        // timeout (servidor colgado) o fallo de red: reintentable
        const isTimeout = e?.name === 'TimeoutError' || e?.message === 'timeout'
        const isNetwork = isTimeout || e instanceof TypeError || /fetch/i.test(String(e?.message))
        if (isNetwork) {
          lastRetryable = true
          lastMessage = isTimeout ? 'sin respuesta del servidor' : 'fallo de red'
          if (a < attemptsForModel || mi < models.length - 1) {
            const waitMs = 800
            opts.onRetry?.(attempt, waitMs, model)
            await sleep(waitMs, opts.signal)
            if (a < attemptsForModel) continue
            break // siguiente modelo
          }
        }
        throw e
      }
    }
  }

  if (lastRetryable) {
    throw new Error(
      'Señor, los servidores de Gemini están saturados en este momento (alta demanda). ' +
        'Es un problema temporal del lado de Google; inténteme de nuevo en unos minutos.',
    )
  }
  throw new Error(lastMessage || 'Error desconocido llamando a Gemini')
}
