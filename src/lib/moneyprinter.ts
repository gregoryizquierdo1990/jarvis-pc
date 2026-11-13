// Integración de MoneyPrinterTurbo para generación automatizada de videos (TikTok, Shorts, Reels)
// Repositorio: https://github.com/harry0703/MoneyPrinterTurbo

export interface MoneyPrinterConfig {
  baseUrl: string
  apiKey?: string
}

const STORAGE_KEY = 'milos_moneyprinter_config'

export function getMoneyPrinterConfig(): MoneyPrinterConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    baseUrl: (import.meta as any).env?.VITE_MONEYPRINTER_URL || 'http://localhost:8080',
    apiKey: (import.meta as any).env?.VITE_MONEYPRINTER_API_KEY || '',
  }
}

export function setMoneyPrinterConfig(baseUrl: string, apiKey?: string): void {
  const cfg: MoneyPrinterConfig = {
    baseUrl: baseUrl.trim().replace(/\/+$/, ''),
    apiKey: apiKey?.trim() || '',
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
}

export interface VideoGenerateParams {
  video_subject: string
  video_script?: string
  video_terms?: string
  video_aspect?: '9:16' | '16:9' | '1:1'
  voice_name?: string
  voice_volume?: number
  voice_rate?: number
  bgm_type?: 'random' | 'custom' | 'none'
  bgm_volume?: number
  subtitle_enabled?: boolean
  font_size?: number
  text_fore_color?: string
  stroke_color?: string
  stroke_width?: number
  video_clip_duration?: number
}

export interface VideoTaskResponse {
  ok: boolean
  taskId?: string
  message?: string
  error?: string
}

export interface VideoTaskStatus {
  ok: boolean
  taskId: string
  state?: number // 0: en cola, 1: procesando, 2: completado, 3: fallido
  stateText?: string
  progress?: number
  videoUrl?: string
  error?: string
}

export async function checkMoneyPrinterHealth(): Promise<{ ok: boolean; url: string; message: string }> {
  const { baseUrl, apiKey } = getMoneyPrinterConfig()
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['x-api-key'] = apiKey

    // Probar primero /api/v1/ping o /
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(`${baseUrl}/api/v1/ping`, {
      method: 'GET',
      headers,
      signal: ctrl.signal,
    }).catch(async () => {
      // Fallback a raíz
      return fetch(`${baseUrl}/`, { method: 'GET', signal: ctrl.signal })
    })
    clearTimeout(timer)

    if (res && res.status < 500) {
      return { ok: true, url: baseUrl, message: 'MoneyPrinterTurbo activo y respondiendo correctamente.' }
    }
    return { ok: false, url: baseUrl, message: `Servidor respondió con código ${res?.status || 'desconocido'}` }
  } catch (err: any) {
    return {
      ok: false,
      url: baseUrl,
      message: `No se pudo conectar a MoneyPrinterTurbo en ${baseUrl}. Asegúrese de que el contenedor o servicio esté iniciado.`,
    }
  }
}

export async function createVideoTask(params: VideoGenerateParams): Promise<VideoTaskResponse> {
  const { baseUrl, apiKey } = getMoneyPrinterConfig()

  const payload = {
    video_subject: params.video_subject,
    video_script: params.video_script || '',
    video_terms: params.video_terms || params.video_subject,
    video_aspect: params.video_aspect || '9:16', // Por defecto 9:16 para Shorts/TikTok/Reels
    video_concat_mode: 'random',
    video_clip_duration: params.video_clip_duration ?? 3,
    video_count: 1,
    voice_name: params.voice_name || 'es-ES-AlvaroNeural', // Voz española neural por defecto
    voice_volume: params.voice_volume ?? 1.0,
    voice_rate: params.voice_rate ?? 1.0,
    bgm_type: params.bgm_type === 'none' ? '' : params.bgm_type || 'random',
    bgm_file: '',
    bgm_volume: params.bgm_volume ?? 0.2,
    subtitle_enabled: params.subtitle_enabled !== false,
    font_name: 'STHeitiMedium.ttc',
    text_fore_color: params.text_fore_color || '#FFFFFF',
    text_background_color: 'transparent',
    font_size: params.font_size ?? 60,
    stroke_color: params.stroke_color || '#000000',
    stroke_width: params.stroke_width ?? 1.5,
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['x-api-key'] = apiKey

    const res = await fetch(`${baseUrl}/api/v1/videos`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      return {
        ok: false,
        error: `Error al crear tarea de video en MoneyPrinterTurbo (${res.status}): ${errText}`,
      }
    }

    const data = await res.json()
    const taskId = data.data?.task_id || data.task_id || data.taskId || data.id

    if (!taskId) {
      return {
        ok: false,
        error: 'El servidor de MoneyPrinterTurbo no devolvió un task_id válido.',
      }
    }

    return {
      ok: true,
      taskId,
      message: `Tarea de generación de video iniciada exitosamente con ID: ${taskId}. Aspecto: ${payload.video_aspect}.`,
    }
  } catch (err: any) {
    return {
      ok: false,
      error: `Fallo de conexión con MoneyPrinterTurbo (${baseUrl}): ${err?.message || err}`,
    }
  }
}

export async function checkTaskStatus(taskId: string): Promise<VideoTaskStatus> {
  const { baseUrl, apiKey } = getMoneyPrinterConfig()

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['x-api-key'] = apiKey

    const res = await fetch(`${baseUrl}/api/v1/tasks/${taskId}`, {
      method: 'GET',
      headers,
    })

    if (!res.ok) {
      return {
        ok: false,
        taskId,
        error: `Error HTTP al consultar tarea ${taskId}: código ${res.status}`,
      }
    }

    const data = await res.json()
    const item = data.data || data

    // Estados típicos de MoneyPrinterTurbo: 0=esperando, 1=procesando, 2=completado, 3=fallido
    let stateText = 'desconocido'
    if (item.state === 0) stateText = 'en cola de espera'
    else if (item.state === 1) stateText = 'procesando y renderizando clips/subtítulos'
    else if (item.state === 2) stateText = 'completado exitosamente'
    else if (item.state === 3) stateText = 'error en generación'

    let videoUrl = item.video_url || item.url || undefined
    if (videoUrl && !videoUrl.startsWith('http')) {
      videoUrl = `${baseUrl}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`
    }

    return {
      ok: true,
      taskId,
      state: item.state,
      stateText,
      progress: item.progress ?? (item.state === 2 ? 100 : item.state === 1 ? 50 : 0),
      videoUrl,
      error: item.error || undefined,
    }
  } catch (err: any) {
    return {
      ok: false,
      taskId,
      error: `Error al conectar con MoneyPrinterTurbo: ${err?.message || err}`,
    }
  }
}
