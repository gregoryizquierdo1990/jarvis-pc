import * as obsidian from './obsidian'

export interface McpToolDefinition {
  name: string
  description?: string
  inputSchema?: {
    type?: string
    properties?: Record<string, any>
    required?: string[]
  }
}

export interface McpServerConfig {
  id: string
  name: string
  url: string
  description?: string
  bearerToken?: string
  headers?: Record<string, string>
  enabled: boolean
  transport: 'http' | 'sse'
  tools?: McpToolDefinition[]
  status?: 'online' | 'offline' | 'untested'
  lastChecked?: string
}

const STORAGE_KEY = 'milos_mcp_servers'

export const DEFAULT_MCP_SERVERS: McpServerConfig[] = [
  {
    id: 'mcp-local-bridge',
    name: 'Local Bridge (PC & Sistema)',
    url: 'http://localhost:8765/mcp',
    description: 'Conecta con herramientas del sistema operativo, terminal y navegador local.',
    enabled: true,
    transport: 'http',
    status: 'untested',
    tools: [
      {
        name: 'system_execute_shell',
        description: 'Ejecuta comandos de shell en la PC local.',
        inputSchema: {
          type: 'object',
          properties: { command: { type: 'string', description: 'Comando a ejecutar' } },
          required: ['command'],
        },
      },
      {
        name: 'desktop_notification',
        description: 'Muestra una notificación en el escritorio del usuario.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['title', 'message'],
        },
      },
      {
        name: 'open_application',
        description: 'Abre una aplicación de uso diario (navegador, vscode, terminal, calculadora, etc.).',
        inputSchema: {
          type: 'object',
          properties: { appName: { type: 'string', description: 'Nombre del programa' } },
          required: ['appName'],
        },
      },
    ],
  },
  {
    id: 'mcp-notion',
    name: 'Notion MCP',
    url: 'https://mcp.notion.com/mcp',
    description: 'Gestión de páginas, bases de datos y tareas en Notion.',
    enabled: false,
    transport: 'http',
    status: 'untested',
    tools: [
      {
        name: 'notion_search',
        description: 'Busca páginas y bases de datos en Notion.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
      {
        name: 'notion_create_page',
        description: 'Crea una nueva página en Notion.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            parentDatabaseId: { type: 'string' },
          },
          required: ['title'],
        },
      },
    ],
  },
  {
    id: 'mcp-github',
    name: 'GitHub Copilot / Repo MCP',
    url: 'https://api.githubcopilot.com/mcp/',
    description: 'Consulta issues, pull requests, repositorios y ramas en GitHub.',
    enabled: false,
    transport: 'http',
    status: 'untested',
    tools: [
      {
        name: 'github_list_repos',
        description: 'Lista repositorios del usuario u organización.',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'github_create_issue',
        description: 'Crea un issue en un repositorio de GitHub.',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
          },
          required: ['repo', 'title'],
        },
      },
    ],
  },
  {
    id: 'mcp-linear',
    name: 'Linear MCP',
    url: 'https://mcp.linear.app/mcp',
    description: 'Creación y seguimiento de tickets y sprints en Linear.',
    enabled: false,
    transport: 'http',
    status: 'untested',
    tools: [
      {
        name: 'linear_create_issue',
        description: 'Crea una tarea en Linear.',
        inputSchema: {
          type: 'object',
          properties: {
            teamKey: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['title'],
        },
      },
    ],
  },
  {
    id: 'mcp-homeassistant',
    name: 'Home Assistant MCP (Domótica)',
    url: 'http://homeassistant.local:8123/api/mcp',
    description: 'Control de luces, interruptores y sensores del hogar u oficina.',
    enabled: false,
    transport: 'http',
    status: 'untested',
    tools: [
      {
        name: 'ha_call_service',
        description: 'Llama a un servicio en Home Assistant (ej. encender luz, activar escena).',
        inputSchema: {
          type: 'object',
          properties: {
            domain: { type: 'string', description: 'ej. light, switch, climate' },
            service: { type: 'string', description: 'ej. turn_on, turn_off' },
            entityId: { type: 'string' },
          },
          required: ['domain', 'service', 'entityId'],
        },
      },
    ],
  },
  {
    id: 'mcp-zapier',
    name: 'Zapier MCP',
    url: 'https://mcp.zapier.com/mcp',
    description: 'Conecta con más de 6,000 apps y automatizaciones a través de Zapier.',
    enabled: false,
    transport: 'http',
    status: 'untested',
    tools: [
      {
        name: 'zapier_run_action',
        description: 'Ejecuta una acción configurada en Zapier.',
        inputSchema: {
          type: 'object',
          properties: {
            actionName: { type: 'string' },
            params: { type: 'object' },
          },
          required: ['actionName'],
        },
      },
    ],
  },
]

export function getMcpServers(): McpServerConfig[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    }
  } catch {}
  return DEFAULT_MCP_SERVERS
}

export function saveMcpServers(servers: McpServerConfig[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(servers, null, 2))
    }
    // Espejo en Obsidian si está disponible
    obsidian
      .appendNote('Milos/Configuracion/MCP.json', JSON.stringify(servers, null, 2))
      .catch(() => {})
  } catch {}
}

export function addMcpServer(server: Omit<McpServerConfig, 'id'>): McpServerConfig {
  const servers = getMcpServers()
  const newServer: McpServerConfig = {
    ...server,
    id: 'mcp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    status: 'untested',
    tools: server.tools ?? [],
  }
  servers.push(newServer)
  saveMcpServers(servers)
  return newServer
}

export function updateMcpServer(id: string, patch: Partial<McpServerConfig>): McpServerConfig | null {
  const servers = getMcpServers()
  const idx = servers.findIndex((s) => s.id === id)
  if (idx === -1) return null
  servers[idx] = { ...servers[idx], ...patch }
  saveMcpServers(servers)
  return servers[idx]
}

export function deleteMcpServer(id: string): boolean {
  const servers = getMcpServers()
  const filtered = servers.filter((s) => s.id !== id)
  if (filtered.length === servers.length) return false
  saveMcpServers(filtered)
  return true
}

export function toggleMcpServer(id: string): McpServerConfig | null {
  const servers = getMcpServers()
  const s = servers.find((item) => item.id === id)
  if (!s) return null
  s.enabled = !s.enabled
  saveMcpServers(servers)
  return s
}

/**
 * Realiza una llamada JSON-RPC estándar a un servidor MCP.
 */
export async function mcpRpcRequest(
  server: McpServerConfig,
  method: string,
  params: Record<string, any> = {},
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    ...(server.headers || {}),
  }

  if (server.bearerToken) {
    headers['Authorization'] = `Bearer ${server.bearerToken}`
  }

  const payload = {
    jsonrpc: '2.0',
    id: Math.floor(Math.random() * 100000),
    method,
    params,
  }

  const res = await fetch(server.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    throw new Error(`MCP error ${res.status}: ${res.statusText}`)
  }

  const json = await res.json()
  if (json.error) {
    throw new Error(`MCP RPC error: ${json.error.message || JSON.stringify(json.error)}`)
  }

  return json.result
}

/**
 * Prueba la conexión con un servidor MCP y actualiza sus herramientas disponibles.
 */
export async function testMcpServer(id: string): Promise<{ ok: boolean; toolsCount: number; message: string }> {
  const servers = getMcpServers()
  const s = servers.find((item) => item.id === id)
  if (!s) return { ok: false, toolsCount: 0, message: 'Servidor no encontrado' }

  try {
    const result = await mcpRpcRequest(s, 'tools/list', {})
    const tools = Array.isArray(result?.tools) ? result.tools : []
    updateMcpServer(id, {
      status: 'online',
      tools: tools.length > 0 ? tools : s.tools,
      lastChecked: new Date().toISOString(),
    })
    return {
      ok: true,
      toolsCount: tools.length,
      message: `Conectado exitosamente. ${tools.length} herramienta(s) detectada(s).`,
    }
  } catch (err: any) {
    // Si falla HTTP pero tiene herramientas preconfiguradas, lo dejamos en modo stand-by
    updateMcpServer(id, {
      status: 'offline',
      lastChecked: new Date().toISOString(),
    })
    return {
      ok: false,
      toolsCount: s.tools?.length || 0,
      message: `Aviso de conexión: ${err.message}. Guardado con herramientas estáticas.`,
    }
  }
}

/**
 * Obtiene todas las herramientas disponibles de los servidores MCP habilitados.
 */
export function getAllEnabledMcpTools(): Array<{ server: McpServerConfig; tool: McpToolDefinition }> {
  const servers = getMcpServers().filter((s) => s.enabled)
  const list: Array<{ server: McpServerConfig; tool: McpToolDefinition }> = []
  for (const s of servers) {
    if (s.tools && Array.isArray(s.tools)) {
      for (const t of s.tools) {
        list.push({ server: s, tool: t })
      }
    }
  }
  return list
}

/**
 * Ejecuta una herramienta MCP por servidor y nombre.
 */
export async function executeMcpTool(
  serverIdentifier: string,
  toolName: string,
  args: Record<string, any> = {},
): Promise<any> {
  const servers = getMcpServers().filter((s) => s.enabled)
  const target = servers.find(
    (s) =>
      s.id.toLowerCase() === serverIdentifier.toLowerCase() ||
      s.name.toLowerCase().includes(serverIdentifier.toLowerCase()),
  )

  if (!target) {
    // Si no se encuentra el servidor exacto, buscar en cualquier servidor habilitado que tenga esa herramienta
    const fallback = servers.find((s) => s.tools?.some((t) => t.name === toolName))
    if (!fallback) {
      return {
        error: `Servidor o herramienta MCP no encontrada: ${serverIdentifier} / ${toolName}. Servidores activos: ${servers.map((s) => s.name).join(', ')}`,
      }
    }
    return executeMcpToolOnServer(fallback, toolName, args)
  }

  return executeMcpToolOnServer(target, toolName, args)
}

async function executeMcpToolOnServer(server: McpServerConfig, toolName: string, args: Record<string, any>): Promise<any> {
  // Manejo de herramientas locales simuladas/nativas
  if (server.id === 'mcp-local-bridge') {
    if (toolName === 'desktop_notification') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(args.title || 'Milos', { body: args.message || '' })
        } else if (Notification.permission !== 'denied') {
          Notification.requestPermission().then((perm) => {
            if (perm === 'granted') new Notification(args.title || 'Milos', { body: args.message || '' })
          })
        }
      }
      return { ok: true, notice: `Notificación mostrada: ${args.title} - ${args.message}` }
    }
    if (toolName === 'open_application') {
      const app = (args.appName || '').toLowerCase()
      if (typeof window !== 'undefined') {
        if (app.includes('browser') || app.includes('navegador')) window.open('https://google.com', '_blank')
        else if (app.includes('calc')) window.open('https://www.google.com/search?q=calculator', '_blank')
        else if (app.includes('youtube')) window.open('https://youtube.com', '_blank')
      }
      return { ok: true, notice: `Aplicación solicitada: ${args.appName}` }
    }
  }

  try {
    const result = await mcpRpcRequest(server, 'tools/call', {
      name: toolName,
      arguments: args,
    })
    return { ok: true, result }
  } catch (err: any) {
    return {
      ok: false,
      error: `Error al ejecutar ${toolName} en ${server.name}: ${err.message}`,
      fallback: 'Herramienta registrada en configuración MCP.',
    }
  }
}
