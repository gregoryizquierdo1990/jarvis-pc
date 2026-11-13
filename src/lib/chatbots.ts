/**
 * Gestor de Chatbots y Personas configurables por el usuario.
 *
 * Permite definir múltiples asistentes especializados con sus propios prompts,
 * roles y herramientas, conmutables en tiempo real.
 */

import * as obsidian from './obsidian'

export type ChatbotProfile = {
  id: string
  name: string
  role: string
  description: string
  systemPrompt: string
  temperature: number
  allowedTools: string[]
  isDefault?: boolean
}

const STORAGE_KEY = 'milos_custom_chatbots'
const ACTIVE_BOT_KEY = 'milos_active_chatbot_id'

const DEFAULT_PROFILES: ChatbotProfile[] = [
  {
    id: 'milos-core',
    name: 'Milos General',
    role: 'Asistente Personal y Mayordomo Digital',
    description: 'Asistente principal con estilo refinado, conciso y multimodular.',
    systemPrompt: `Eres Agente Milos, el asistente personal de élite del usuario. Respóndele en español con precisión y agudeza. Gestionas su agenda, archivos, memoria en Obsidian y herramientas cotidianas.`,
    temperature: 0.7,
    allowedTools: ['all'],
    isDefault: true,
  },
  {
    id: 'milos-dev',
    name: 'Milos Desarrollador',
    role: 'Ingeniero de Software y Arquitecto de Sistemas',
    description: 'Especialista en código TypeScript, Python, Git, depuración y arquitectura.',
    systemPrompt: `Eres Milos en modo Desarrollador Senior. Piensas paso a paso, buscas causas raíz de errores, analizas diffs de git, recomiendas buenas prácticas y escribes código limpio, modular y seguro.`,
    temperature: 0.2,
    allowedTools: ['repo_status', 'repo_diff', 'repo_log', 'repo_list_files', 'repo_read_file', 'repo_write_file', 'repo_commit', 'search_files', 'read_file'],
  },
  {
    id: 'milos-business',
    name: 'Milos Asesor Financiero',
    role: 'Auditor Financiero y de Operaciones',
    description: 'Especialista en escandallos, margen de contribución, punto de equilibrio y contabilidad.',
    systemPrompt: `Eres Milos en modo Asesor Financiero y de Negocios. Eres riguroso con los números. Calculas costos reales de recetas, mermas, márgenes netos y brutos, y punto de equilibrio. Nunca redondeas sin avisar y siempre propones optimización de costos.`,
    temperature: 0.3,
    allowedTools: ['calculate', 'recipe_cost', 'margin_calc', 'break_even', 'waste_calc', 'scale_recipe', 'convert_units', 'remember_fact', 'recall_facts'],
  },
  {
    id: 'milos-automation',
    name: 'Milos Automatizador',
    role: 'Especialista en n8n y Orquestación',
    description: 'Diseñador de flujos de trabajo automáticos, webhooks e integraciones.',
    systemPrompt: `Eres Milos en modo Automatizador de Procesos. Tu misión es conectar herramientas, automatizar tareas repetitivas mediante n8n, diseñar webhooks y coordinar el intercambio de información entre servicios.`,
    temperature: 0.4,
    allowedTools: ['n8n_trigger_webhook', 'n8n_list_workflows', 'n8n_create_flow', 'send_telegram', 'send_mail', 'list_mail'],
  },
]

export function getChatbotProfiles(): ChatbotProfile[] {
  if (typeof window === 'undefined') return DEFAULT_PROFILES
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PROFILES
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PROFILES
  } catch {
    return DEFAULT_PROFILES
  }
}

export function getActiveChatbot(): ChatbotProfile {
  const profiles = getChatbotProfiles()
  const activeId = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_BOT_KEY) : null
  const found = profiles.find((p) => p.id === activeId)
  return found || profiles[0] || DEFAULT_PROFILES[0]
}

export function setActiveChatbot(id: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(ACTIVE_BOT_KEY, id)
  }
}

export async function saveChatbotProfile(profile: ChatbotProfile): Promise<void> {
  const profiles = getChatbotProfiles()
  const idx = profiles.findIndex((p) => p.id === profile.id)
  if (idx >= 0) {
    profiles[idx] = profile
  } else {
    profiles.push(profile)
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  }
  // Espejar perfil en Obsidian
  try {
    const md = `# Chatbot: ${profile.name}\n\n**Rol:** ${profile.role}\n**Descripción:** ${profile.description}\n**Temperatura:** ${profile.temperature}\n\n## System Prompt\n\`\`\`\n${profile.systemPrompt}\n\`\`\`\n`
    await obsidian.writeNote(`Milos/Chatbots/${profile.id}.md`, md)
  } catch {}
}

export function deleteChatbotProfile(id: string): void {
  let profiles = getChatbotProfiles()
  profiles = profiles.filter((p) => p.id !== id || p.isDefault)
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles))
  }
}
