/**
 * Cliente frontend para el bot de Telegram (avisos).
 * El token y chat_id se configuran en el bridge o en localStorage.
 */

const BRIDGE = () => (window as any).__BRIDGE_HTTP__ || 'http://localhost:8787'

export type TelegramConfig = {
  botToken?: string
  chatId?: string
}

export function getConfig(): TelegramConfig {
  return {
    botToken: localStorage.getItem('jarvis_tg_token') || undefined,
    chatId: localStorage.getItem('jarvis_tg_chat') || undefined,
  }
}

export function setConfig(cfg: TelegramConfig) {
  if (cfg.botToken) localStorage.setItem('jarvis_tg_token', cfg.botToken)
  if (cfg.chatId) localStorage.setItem('jarvis_tg_chat', cfg.chatId)
}

export async function send(text: string, chatId?: string): Promise<{ ok: boolean; error?: string }> {
  const cfg = getConfig()
  const token = cfg.botToken
  const cid = chatId || cfg.chatId
  if (!token || !cid) {
    // intentar vía bridge
    try {
      const res = await fetch(BRIDGE() + '/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, chatId: cid }),
      })
      return await res.json()
    } catch (e: any) {
      return { ok: false, error: e?.message || 'Sin configuración de Telegram' }
    }
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cid, text, parse_mode: 'HTML' }),
    })
    const data = await res.json()
    return { ok: !!data.ok, error: data.description }
  } catch (e: any) {
    return { ok: false, error: e?.message }
  }
}

/** Un mensaje entrante capturado por el bridge desde el bot. */
export type TelegramMessage = {
  update_id: number
  chat_id: number
  chat_first_name: string
  from_username: string
  from_name: string
  text: string
  date: number
}

/**
 * Mensajes entrantes en cola (el bridge hace long-poll de getUpdates).
 * Los recoge el App para responderlos con el cerebro completo del agente.
 */
export async function pending(): Promise<TelegramMessage[]> {
  try {
    const res = await fetch(BRIDGE() + '/telegram/pending')
    const d = await res.json()
    return d?.messages || []
  } catch {
    return []
  }
}
