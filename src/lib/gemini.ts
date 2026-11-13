import { SYSTEM_PROMPT } from '../config'
import * as camera from './camera'
import * as memory from './memory'
import * as calendar from './calendar'
import * as telegram from './telegram'
import * as mail from './mail'
import * as files from './files'
import * as ingest from './ingest'
import * as journal from './journal'
import * as calc from './calculator'
import * as gen from './generate'
import * as tr from './translate'
import * as units from './units'
import * as repo from './repo'
import * as obsidian from './obsidian'
import * as api from './geminiApi'
import * as n8n from './n8n'
import * as skills from './skillsCatalog'
import * as chatbots from './chatbots'
import * as subagents from './subagents'
import * as mcp from './mcp'
import * as agency from './agencyAgents'
import * as pc from './pcControl'
import * as db from './database'
import * as pb from './pocketbase'
import * as macrodroid from './macrodroid'
import * as net from './network'
import * as moneyprinter from './moneyprinter'
import * as copy from './copywriting'

export type AskHandlers = {
  onText: (delta: string) => void
  onTool: (name: string) => void
}

export type GeminiMsg = {
  role: 'user' | 'assistant' | 'model'
  content?: string
  text?: string
}

let activeAbort: AbortController | null = null

export function cancel(): void {
  if (activeAbort) {
    activeAbort.abort()
    activeAbort = null
  }
}

export function connectedLabels(): string[] {
  return [
    'Google Gemini',
    'Memoria',
    'Calendario',
    'Archivos',
    'Correo',
    'Telegram',
    'Visión',
    'N8N',
    'Subagentes',
    'Skills',
    'MCP',
    'Agency Agents',
    'PC Nativo',
    'Supabase/Postgres',
    'PocketBase',
    'MacroDroid',
    'Diagnóstico Red',
  ]
}

// ---------- Tool definitions (Gemini function calling) ----------

const toolDeclarations = [
  {
    name: 'remember_fact',
    description:
      'Guarda un hecho, preferencia, regla, contacto, producto o precio en la memoria persistente del asistente (también se espeja automáticamente en la bóveda de Obsidian). Úsalo cuando el usuario te dé información sobre su negocio, preferencias, reglas, nombres, precios o datos que deban recordarse.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Clave corta identificadora (ej. "precio:cafe", "regla:descuento").' },
        value: { type: 'string', description: 'Valor o descripción completa.' },
        kind: {
          type: 'string',
          enum: ['fact', 'preference', 'rule', 'contact', 'product', 'price', 'note'],
          description: 'Tipo de hecho.',
        },
        tags: { type: 'array', items: { type: 'string' }, description: 'Etiquetas opcionales.' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'recall_facts',
    description: 'Busca en la memoria hechos relevantes para una consulta.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'forget_fact',
    description: 'Olvida un hecho por su clave.',
    parameters: {
      type: 'object',
      properties: { key: { type: 'string' } },
      required: ['key'],
    },
  },
  {
    name: 'schedule_event',
    description: 'Crea un evento en el calendario. start en ISO 8601 o timestamp ms.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start: { type: 'string', description: 'Fecha/hora ISO 8601 (ej. 2026-11-12T10:00:00) o ms epoch.' },
        description: { type: 'string' },
        reminderMinutes: { type: 'number', description: 'Minutos antes para recordatorio.' },
      },
      required: ['title', 'start'],
    },
  },
  {
    name: 'list_events',
    description: 'Lista eventos próximos del calendario.',
    parameters: {
      type: 'object',
      properties: { days: { type: 'number', description: 'Días hacia adelante (default 7).' } },
    },
  },
  {
    name: 'delete_event',
    description: 'Elimina un evento por id.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'search_files',
    description: 'Busca archivos en la PC del usuario por nombre o contenido.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        root: { type: 'string', description: 'Directorio raíz opcional.' },
        max: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'read_file',
    description: 'Lee el contenido de un archivo local.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  {
    name: 'send_telegram',
    description: 'Envía un aviso/mensaje por Telegram.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        chatId: { type: 'string', description: 'Chat id opcional (usa el configurado por defecto).' },
      },
      required: ['text'],
    },
  },
  {
    name: 'list_mail',
    description: 'Lista los últimos correos del buzón.',
    parameters: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
  },
  {
    name: 'read_mail',
    description: 'Lee un correo por id.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'send_mail',
    description: 'Envía un correo electrónico.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'ingest_url',
    description: 'Lee y memoriza el contenido de una URL.',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    name: 'look_camera',
    description: 'Mira a través de la cámara para ver qué hay delante.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'calculate',
    description: 'Calcula una expresión matemática. Soporta +,-,*,/,(),%, y funciones Math (sqrt, pow, round, etc.).',
    parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] },
  },
  {
    name: 'recipe_cost',
    description:
      'Calcula costo de producción de una receta: ingredientes, merma, rendimiento, costo unitario y precio sugerido con margen.',
    parameters: {
      type: 'object',
      properties: {
        ingredientes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nombre: { type: 'string' },
              cantidad: { type: 'number' },
              unidad: { type: 'string' },
              costoUnitario: { type: 'number' },
            },
            required: ['nombre', 'cantidad', 'unidad', 'costoUnitario'],
          },
        },
        mermaPct: { type: 'number', description: 'Porcentaje de merma.' },
        rendimiento: { type: 'number', description: 'Unidades producidas.' },
        margenPct: { type: 'number', description: 'Margen deseado % sobre costo.' },
      },
      required: ['ingredientes', 'rendimiento'],
    },
  },
  {
    name: 'margin_calc',
    description: 'Calcula margen bruto, % de margen y markup a partir de precio de venta y costo.',
    parameters: {
      type: 'object',
      properties: { precioVenta: { type: 'number' }, costo: { type: 'number' } },
      required: ['precioVenta', 'costo'],
    },
  },
  {
    name: 'break_even',
    description: 'Calcula punto de equilibrio (unidades y ventas) a partir de costos fijos, precio unitario y costo variable unitario.',
    parameters: {
      type: 'object',
      properties: {
        costosFijos: { type: 'number' },
        precioUnitario: { type: 'number' },
        costoVariableUnitario: { type: 'number' },
      },
      required: ['costosFijos', 'precioUnitario', 'costoVariableUnitario'],
    },
  },
  {
    name: 'waste_calc',
    description: 'Calcula merma/perdida y cantidad aprovechable de una producción.',
    parameters: {
      type: 'object',
      properties: {
        produccion: { type: 'number' },
        mermaPct: { type: 'number' },
        unidad: { type: 'string' },
      },
      required: ['produccion', 'mermaPct'],
    },
  },
  {
    name: 'log_journal',
    description:
      'Registra en la bitácora del día lo aprendido, decisiones tomadas, métricas y resumen (se espeja en Milos/Bitacora/YYYY-MM-DD.md de la bóveda). Úsalo al final de una interacción importante o cuando el usuario pida resumen del día.',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        learned: { type: 'array', items: { type: 'string' } },
        decisions: { type: 'array', items: { type: 'string' } },
        metrics: { type: 'object', description: 'Métricas numéricas clave (ej. {ventas: 1200, mermas: 5}).' },
        mood: { type: 'string', enum: ['positive', 'neutral', 'concern'] },
      },
      required: ['summary'],
    },
  },
  {
    name: 'get_journal',
    description: 'Obtiene las entradas recientes de la bitácora diaria.',
    parameters: { type: 'object', properties: { days: { type: 'number' } } },
  },
  {
    name: 'set_business_profile',
    description: 'Guarda o actualiza datos del perfil del negocio (nombre, giro, moneda, impuesto, etc.).',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Ej. negocio.nombre, moneda, impuesto_pct, giro.' },
        value: { type: 'string' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'daily_briefing',
    description: 'Genera un resumen proactivo del día: memoria relevante, eventos próximos, bitácora reciente y sugerencias.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'generate_text_file',
    description: 'Genera y descarga un archivo de texto (.txt o .md).',
    parameters: { type: 'object', properties: { name: { type: 'string' }, content: { type: 'string' }, markdown: { type: 'boolean' } }, required: ['name', 'content'] },
  },
  {
    name: 'generate_docx',
    description: 'Genera y descarga un documento Word (.docx) con título y contenido.',
    parameters: { type: 'object', properties: { name: { type: 'string' }, title: { type: 'string' }, content: { type: 'string' } }, required: ['name', 'title', 'content'] },
  },
  {
    name: 'generate_excel',
    description: 'Genera y descarga un Excel (.xlsx) con una o varias hojas.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        sheets: {
          type: 'array',
          items: {
            type: 'object',
            properties: { name: { type: 'string' }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } },
            required: ['name', 'rows'],
          },
        },
      },
      required: ['name', 'sheets'],
    },
  },
  {
    name: 'generate_csv',
    description: 'Genera y descarga un CSV.',
    parameters: { type: 'object', properties: { name: { type: 'string' }, rows: { type: 'array', items: { type: 'array', items: { type: 'string' } } } }, required: ['name', 'rows'] },
  },
  {
    name: 'generate_image',
    description: 'Genera una imagen con IA a partir de un prompt y la descarga.',
    parameters: { type: 'object', properties: { prompt: { type: 'string' }, name: { type: 'string' } }, required: ['prompt'] },
  },
  {
    name: 'generate_video',
    description: 'Genera un video animado simple (canvas) descargable.',
    parameters: { type: 'object', properties: { prompt: { type: 'string' }, name: { type: 'string' }, seconds: { type: 'number' } }, required: ['prompt'] },
  },
  {
    name: 'translate',
    description: 'Traduce texto a otro idioma. Idiomas: es, en, fr, de, it, pt, zh, ja, ko, ru, ar, hi, nl, tr, pl.',
    parameters: { type: 'object', properties: { text: { type: 'string' }, target: { type: 'string' }, source: { type: 'string' } }, required: ['text', 'target'] },
  },
  {
    name: 'detect_language',
    description: 'Detecta el idioma de un texto (código ISO).',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'convert_units',
    description: 'Convierte unidades de medida (longitud, peso, volumen, área, velocidad, tiempo, temperatura).',
    parameters: { type: 'object', properties: { value: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } }, required: ['value', 'from', 'to'] },
  },
  {
    name: 'scale_recipe',
    description: 'Escala una receta por un factor (multiplica cantidades).',
    parameters: {
      type: 'object',
      properties: {
        ingredientes: { type: 'array', items: { type: 'object', properties: { nombre: { type: 'string' }, cantidad: { type: 'number' }, unidad: { type: 'string' } }, required: ['nombre', 'cantidad', 'unidad'] } },
        factor: { type: 'number' },
      },
      required: ['ingredientes', 'factor'],
    },
  },
  {
    name: 'reason',
    description: 'Razonamiento paso a paso para problemas complejos. Devuelve pasos y conclusión.',
    parameters: { type: 'object', properties: { problem: { type: 'string' } }, required: ['problem'] },
  },
  {
    name: 'repo_status',
    description: 'Estado del repositorio git (rama, cambios sin commitear).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'repo_diff',
    description: 'Diff de cambios en el repositorio (contra HEAD).',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'Archivo opcional.' } } },
  },
  {
    name: 'repo_log',
    description: 'Historial de commits.',
    parameters: { type: 'object', properties: { limit: { type: 'number' } } },
  },
  {
    name: 'repo_list_files',
    description: 'Lista los archivos del repositorio.',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'Subdirectorio opcional.' } } },
  },
  {
    name: 'repo_read_file',
    description: 'Lee el contenido de un archivo del repositorio.',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'repo_write_file',
    description: 'Escribe/modifica un archivo del repositorio.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
    },
  },
  {
    name: 'repo_commit',
    description: 'Añade todos los cambios y hace commit con un mensaje.',
    parameters: {
      type: 'object',
      properties: { message: { type: 'string' }, addAll: { type: 'boolean' } },
      required: ['message'],
    },
  },
  {
    name: 'repo_push',
    description: 'Hace push al remoto (GitHub).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'repo_pull',
    description: 'Hace pull del remoto.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'repo_show',
    description: 'Muestra un commit o archivo en un commit (git show).',
    parameters: { type: 'object', properties: { target: { type: 'string' } }, required: ['target'] },
  },
  {
    name: 'obsidian_note',
    description:
      'Crea o sobrescribe una nota Markdown en la bóveda de Obsidian (memoria del agente). El usuario la ve en Obsidian.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Título de la nota (se convierte en nombre de archivo).' },
        content: { type: 'string', description: 'Contenido Markdown de la nota.' },
        folder: { type: 'string', description: 'Carpeta dentro de la bóveda. Por defecto Milos/Notas.' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'obsidian_append',
    description: 'Añade texto al final de una nota existente de la bóveda (la crea si no existe).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta de la nota dentro de la bóveda.' },
        content: { type: 'string' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'obsidian_read',
    description: 'Lee una nota de la bóveda de Obsidian (también las que escribe el usuario).',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Ruta relativa de la nota (.md).' } },
      required: ['path'],
    },
  },
  {
    name: 'obsidian_search',
    description: 'Busca texto en toda la bóveda de Obsidian y devuelve las notas que coinciden.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'obsidian_list',
    description: 'Lista las notas de la bóveda (opcionalmente de una carpeta).',
    parameters: { type: 'object', properties: { folder: { type: 'string' } } },
  },
  {
    name: 'obsidian_daily_note',
    description: 'Añade un bloque con hora a la nota diaria de la bitácora de Milos.',
    parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
  },
  {
    name: 'spawn_subagent',
    description:
      'Crea y delega una tarea compleja a un subagente especializado autónomo bajo el control de Milos. El subagente opera con su propio cargo, tarea, limitaciones, prompt especializado y herramientas permitidas, y devuelve el informe final.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre del subagente (ej. "Investigador", "Contador", "Analista-Git")' },
        role: { type: 'string', description: 'Cargo o función del subagente (ej. "Especialista en Investigación y Datos")' },
        task: { type: 'string', description: 'La tarea detallada que debe resolver el subagente' },
        limitations: { type: 'string', description: 'Limitaciones, directrices de alcance o restricciones éticas' },
        systemPrompt: { type: 'string', description: 'Instrucciones y personalidad especializada para el subagente' },
        toolsAllowed: {
          type: 'array',
          items: { type: 'string' },
          description: 'Herramientas permitidas (ej. ["calculate", "search_files", "read_file", "ingest_url", "obsidian_search"]) o ["all"]',
        },
      },
      required: ['name', 'role', 'task'],
    },
  },
  {
    name: 'n8n_test_connection',
    description: 'Verifica la conexión con la instancia local o remota de n8n para automatizaciones.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'n8n_trigger_webhook',
    description: 'Dispara un flujo de automatización en n8n a través de su webhook.',
    parameters: {
      type: 'object',
      properties: {
        webhookPathOrUrl: {
          type: 'string',
          description: 'Ruta o URL completa del webhook de n8n (ej. "orden-compra" o "http://localhost:5678/webhook/...")',
        },
        payload: { type: 'object', description: 'Datos JSON que se enviarán al flujo de n8n' },
      },
      required: ['webhookPathOrUrl'],
    },
  },
  {
    name: 'n8n_list_workflows',
    description: 'Lista los flujos de trabajo existentes en n8n (requiere API Key configurada).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'n8n_configure',
    description: 'Configura la URL de n8n y su API Key cuando el usuario las proporcione en la conversación.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL de n8n (ej. http://localhost:5678)' },
        apiKey: { type: 'string', description: 'Clave API de n8n' },
      },
      required: ['url', 'apiKey'],
    },
  },
  {
    name: 'search_skills',
    description: 'Busca habilidades disponibles en el catálogo basado en el estándar anthropics/skills.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Término de búsqueda de la habilidad' } },
      required: ['query'],
    },
  },
  {
    name: 'load_skill',
    description: 'Carga una habilidad especializada local o remota de anthropics/skills para que Milos incorpore sus instrucciones de dominio.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la habilidad (ej. "deep-research", "business-financial-audit", "git-repo-architect", "n8n-workflow-designer")' },
        remoteRepoPath: { type: 'string', description: 'Opcional: ruta relativa en anthropics/skills para descargar' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_chatbots',
    description: 'Lista los chatbots y perfiles de personalidad configurados por el usuario.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'switch_chatbot',
    description: 'Cambia la personalidad o modo activo de Milos a otro chatbot configurado (ej. "milos-dev", "milos-business", "milos-automation", "milos-core").',
    parameters: {
      type: 'object',
      properties: { profileId: { type: 'string', description: 'ID del perfil de chatbot' } },
      required: ['profileId'],
    },
  },
  {
    name: 'mcp_list_servers',
    description: 'Lista los servidores MCP (Model Context Protocol) configurados para conectar Milos con aplicaciones externas (Notion, GitHub, Linear, Home Assistant, Zapier, Sistema Local).',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'mcp_list_tools',
    description: 'Lista todas las herramientas y capacidades disponibles en los servidores MCP conectados actualmente.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'mcp_call_tool',
    description: 'Ejecuta una herramienta en un servidor MCP conectado pasándole sus argumentos (ej. crear tarea en Notion, gestionar tickets en Linear, automatizar con Zapier, etc.).',
    parameters: {
      type: 'object',
      properties: {
        server: { type: 'string', description: 'ID o nombre del servidor MCP (ej. "mcp-local-bridge", "Notion", "Linear", "Zapier")' },
        tool: { type: 'string', description: 'Nombre de la herramienta MCP a invocar' },
        arguments: { type: 'object', description: 'Argumentos o parámetros para la herramienta' },
      },
      required: ['server', 'tool'],
    },
  },
  {
    name: 'mcp_add_server',
    description: 'Registra un nuevo servidor MCP en la configuración de Milos para conectar una herramienta de uso diario.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre legible del servidor MCP' },
        url: { type: 'string', description: 'URL o endpoint HTTP/SSE del servidor MCP' },
        bearerToken: { type: 'string', description: 'Token o API key de autorización opcional' },
        description: { type: 'string', description: 'Descripción de las herramientas que provee' },
      },
      required: ['name', 'url'],
    },
  },
  {
    name: 'mcp_test_server',
    description: 'Prueba la conexión con un servidor MCP específico y actualiza las herramientas que ofrece.',
    parameters: {
      type: 'object',
      properties: {
        serverId: { type: 'string', description: 'ID del servidor MCP a probar (ej. "mcp-local-bridge")' },
      },
      required: ['serverId'],
    },
  },
  {
    name: 'agency_search_agents',
    description: 'Busca agentes y subagentes especializados en el repositorio msitarzewski/agency-agents por rol, habilidad o categoría (engineering, finance, marketing, security, etc.).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Término de búsqueda o rol deseado (ej. "backend", "seguridad", "marketing", "qa")' },
        category: { type: 'string', description: 'Categoría opcional (ej. "engineering", "finance", "design", "security")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'agency_get_agent',
    description: 'Obtiene el perfil completo, personalidad y directrices de un agente de msitarzewski/agency-agents.',
    parameters: {
      type: 'object',
      properties: {
        agentIdOrName: { type: 'string', description: 'ID o nombre del agente (ej. "backend-architect", "financial-analyst")' },
      },
      required: ['agentIdOrName'],
    },
  },
  {
    name: 'agency_spawn_agent',
    description: 'Lanza y ejecuta autónomamente un subagente utilizando la personalidad, directrices y habilidades exactas de msitarzewski/agency-agents.',
    parameters: {
      type: 'object',
      properties: {
        agentIdOrName: { type: 'string', description: 'ID o nombre del agente a invocar' },
        task: { type: 'string', description: 'La tarea detallada que debe resolver el subagente' },
        customLimitations: { type: 'string', description: 'Limitaciones adicionales o directrices de entrega' },
      },
      required: ['agentIdOrName', 'task'],
    },
  },
  {
    name: 'system_run_command',
    description: 'Ejecuta un comando nativo en la PC (bash en Linux) para ejecutar programas, compilar, automatizar tareas o consultar el estado del equipo.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Comando bash a ejecutar' },
        cwd: { type: 'string', description: 'Directorio de trabajo opcional' },
      },
      required: ['command'],
    },
  },
  {
    name: 'system_open_app',
    description: 'Abre cualquier aplicación instalada (Chrome, VSCode, LibreOffice, Calculadora, Terminal, etc.) o archivo/documento (PDF, DOCX, etc.) en la PC.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Nombre de la aplicación o ruta absoluta al archivo/documento (ej. "google-chrome", "code", "calc", "/home/...")' },
      },
      required: ['target'],
    },
  },
  {
    name: 'system_close_app',
    description: 'Cierra una aplicación o proceso en ejecución en la PC por su nombre (ej. "chrome", "spotify", "vlc").',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Nombre del proceso o aplicación a cerrar' },
      },
      required: ['target'],
    },
  },
  {
    name: 'system_file_manager',
    description: 'Operaciones directas sobre el sistema de archivos de la PC: leer documentos, crear/editar archivos, mover, copiar, eliminar o listar directorios.',
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['read', 'write', 'move', 'copy', 'delete', 'list'], description: 'Operación de archivos' },
        path: { type: 'string', description: 'Ruta del archivo o carpeta' },
        dest: { type: 'string', description: 'Ruta de destino (para move o copy)' },
        content: { type: 'string', description: 'Contenido a escribir (para write)' },
      },
      required: ['op', 'path'],
    },
  },
  {
    name: 'system_power_control',
    description: 'Apaga la PC, reinicia el equipo o cierra la sesión de usuario.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['shutdown', 'reboot', 'logout'], description: 'Acción de energía a realizar' },
      },
      required: ['action'],
    },
  },
  {
    name: 'db_query_table',
    description: 'Consulta tablas dinámicas en Supabase/PostgreSQL (ej. inventarios, stock de cuentas streaming, pedidos, clientes).',
    parameters: {
      type: 'object',
      properties: {
        tableName: { type: 'string', description: 'Nombre de la tabla (ej. "inventario", "cuentas_streaming", "pedidos")' },
        select: { type: 'string', description: 'Columnas a seleccionar (default: "*")' },
        limit: { type: 'number', description: 'Límite de registros' },
        filters: { type: 'object', description: 'Filtros clave-valor (ej. {"servicio": "eq.Netflix", "estado": "eq.disponible"})' },
      },
      required: ['tableName'],
    },
  },
  {
    name: 'db_insert_record',
    description: 'Inserta un nuevo registro en una tabla de Supabase/PostgreSQL.',
    parameters: {
      type: 'object',
      properties: {
        tableName: { type: 'string', description: 'Nombre de la tabla' },
        record: { type: 'object', description: 'Objeto JSON con los datos del registro a insertar' },
      },
      required: ['tableName', 'record'],
    },
  },
  {
    name: 'db_update_record',
    description: 'Actualiza registros en una tabla de Supabase/PostgreSQL usando una columna de filtro.',
    parameters: {
      type: 'object',
      properties: {
        tableName: { type: 'string', description: 'Nombre de la tabla' },
        filterColumn: { type: 'string', description: 'Columna para identificar el registro (ej. "id", "email")' },
        filterValue: { type: 'string', description: 'Valor del filtro' },
        patch: { type: 'object', description: 'Campos a actualizar' },
      },
      required: ['tableName', 'filterColumn', 'filterValue', 'patch'],
    },
  },
  {
    name: 'db_configure',
    description: 'Configura la URL de Supabase y su API Key cuando el operador las proporcione.',
    parameters: {
      type: 'object',
      properties: {
        supabaseUrl: { type: 'string', description: 'URL del proyecto Supabase (ej. https://xyz.supabase.co)' },
        supabaseKey: { type: 'string', description: 'API Key pública o de servicio' },
      },
      required: ['supabaseUrl', 'supabaseKey'],
    },
  },
  {
    name: 'pb_check',
    description: 'Verifica si la base de datos local embebida PocketBase está activa y en línea.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'pb_list_records',
    description: 'Consulta registros de una colección en PocketBase (ej. stock local de streaming, clientes, transacciones).',
    parameters: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Nombre de la colección en PocketBase' },
        filter: { type: 'string', description: 'Filtro de consulta opcional' },
        sort: { type: 'string', description: 'Criterio de ordenación' },
      },
      required: ['collection'],
    },
  },
  {
    name: 'pb_create_record',
    description: 'Crea un nuevo registro en una colección de PocketBase.',
    parameters: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Nombre de la colección' },
        data: { type: 'object', description: 'Datos del registro' },
      },
      required: ['collection', 'data'],
    },
  },
  {
    name: 'pb_update_record',
    description: 'Actualiza un registro por su ID en PocketBase.',
    parameters: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Nombre de la colección' },
        id: { type: 'string', description: 'ID del registro' },
        data: { type: 'object', description: 'Datos a actualizar' },
      },
      required: ['collection', 'id', 'data'],
    },
  },
  {
    name: 'macrodroid_trigger',
    description: 'Envía una alerta sonora, notificación o comando directo al teléfono móvil del usuario mediante MacroDroid.',
    parameters: {
      type: 'object',
      properties: {
        actionName: { type: 'string', description: 'Nombre de la macro o acción en el teléfono (ej. "alerta_tienda", "alerta_red", "notificar_pago")' },
        params: { type: 'object', description: 'Parámetros o texto adicional para la notificación' },
      },
      required: ['actionName'],
    },
  },
  {
    name: 'macrodroid_set_device',
    description: 'Guarda o actualiza el Device ID de MacroDroid del teléfono móvil del operador.',
    parameters: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', description: 'ID único de dispositivo provisto por la app MacroDroid' },
      },
      required: ['deviceId'],
    },
  },
  {
    name: 'network_check_internet',
    description: 'Comprueba el estado de la conexión a internet y mide la latencia hacia Google DNS.',
    parameters: {
      type: 'object',
      properties: {
        host: { type: 'string', description: 'Host o IP de prueba (default: 8.8.8.8)' },
      },
    },
  },
  {
    name: 'network_speedtest',
    description: 'Mide la velocidad real de descarga, subida y ping de la red Wi-Fi o cableada.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'network_scan_devices',
    description: 'Escanea la red local para listar todos los dispositivos, IPs y direcciones MAC conectados actualmente al router.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'moneyprinter_create_video',
    description:
      'Genera un video automático de alta calidad (TikTok, Reels, Shorts en 9:16 o YouTube en 16:9) usando MoneyPrinterTurbo con guion, clips de video sincronizados, voz neural en español y subtítulos animados.',
    parameters: {
      type: 'object',
      properties: {
        video_subject: { type: 'string', description: 'Tema o título del video (ej. "3 Secretos del Éxito", "Cómo empezar a emprender")' },
        video_script: { type: 'string', description: 'Guion completo estructurado (gancho, desarrollo, remate) redactado por Milos o el usuario' },
        video_terms: { type: 'string', description: 'Palabras clave separadas por comas para buscar clips visuales (ej. "dinero, negocio, oficina, éxito")' },
        video_aspect: { type: 'string', enum: ['9:16', '16:9', '1:1'], description: 'Formato de pantalla: "9:16" para Shorts/TikTok/Reels, "16:9" para YouTube' },
        voice_name: { type: 'string', description: 'Voz neural TTS (default: "es-ES-AlvaroNeural", o "es-MX-DaliaNeural", "es-ES-ElviraNeural")' },
        bgm_type: { type: 'string', enum: ['random', 'none'], description: 'Música de fondo: "random" o "none"' },
        video_clip_duration: { type: 'number', description: 'Duración en segundos de cada clip de video (default: 3)' },
      },
      required: ['video_subject'],
    },
  },
  {
    name: 'moneyprinter_check_status',
    description: 'Consulta el estado, porcentaje de progreso y enlace de descarga del video generado en MoneyPrinterTurbo.',
    parameters: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'ID de la tarea retornado al crear el video' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'moneyprinter_health',
    description: 'Comprueba si la instancia de MoneyPrinterTurbo está activa y lista para renderizar videos.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'moneyprinter_configure',
    description: 'Configura la URL y clave API opcional de MoneyPrinterTurbo.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL de MoneyPrinterTurbo (ej. http://localhost:8080)' },
        apiKey: { type: 'string', description: 'Clave API opcional si está protegida' },
      },
      required: ['url'],
    },
  },
  {
    name: 'copy_generate',
    description:
      'Genera textos comerciales persuasivos de alta conversión para Estados de WhatsApp, Grupos de Compra-Venta o Telegram basados en fórmulas comerciales (Gancho, Oferta, Urgencia, CTA), adaptados al producto, precio y métodos de pago.',
    parameters: {
      type: 'object',
      properties: {
        producto: { type: 'string', description: 'Nombre del producto o servicio (ej. "Max Platino + Vix", "Netflix 1 Pantalla", "Almuerzo Casero")' },
        precio: { type: 'string', description: 'Precio comercial (ej. "8.50$", "150 Bs")' },
        modalidad_pago: { type: 'string', description: 'Métodos de pago aceptados (default: "Pago Móvil 🇻🇪 | Binance USDT 🟡 | Zinli 💳 | Efectivo")' },
        categoria: { type: 'string', enum: ['streaming', 'comida', 'confeccion', 'recargas', 'general'], description: 'Categoría del producto' },
        formato: { type: 'string', enum: ['todos', 'estado', 'grupo'], description: 'Formato: "todos", "estado" (WhatsApp Status) o "grupo" (Grupos Compra-Venta)' },
      },
      required: ['producto', 'precio'],
    },
  },
  {
    name: 'copy_list_templates',
    description: 'Lista todas las plantillas y fórmulas comerciales de copywriting almacenadas en la memoria y en prompts_ventas.md.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'copy_save_template',
    description:
      'Crea, actualiza o perfecciona una plantilla de ventas en prompts_ventas.md para que Milos evolucione y mejore sus copys publicitarios con el tiempo.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Identificador único (ej. "streaming-promo-flash", "comida-domingo")' },
        category: { type: 'string', description: 'Categoría (streaming, comida, confeccion, recargas, etc.)' },
        title: { type: 'string', description: 'Título descriptivo de la plantilla' },
        target: { type: 'string', enum: ['estado_whatsapp', 'grupo_compra_venta', 'telegram', 'combo'], description: 'Canal de destino' },
        structure: { type: 'string', description: 'Estructura del copy con variables {producto}, {precio}, {modalidad_pago}' },
      },
      required: ['id', 'category', 'title', 'target', 'structure'],
    },
  },
  {
    name: 'ad_banner_create',
    description:
      'Diseña y genera al instante un afiche/banner publicitario HD (1080p) con fondo degradado cyberpunk, badge de precio gigante, beneficios y métodos de pago (Pago Móvil, Binance, etc.) para Estados de WhatsApp o Grupos sin consumir GPU.',
    parameters: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'Título principal del producto o promoción (ej. "MAX PLATINO + VIX")' },
        precio: { type: 'string', description: 'Precio visible a destacar (ej. "$8.50")' },
        subtitulo: { type: 'string', description: 'Subtítulo o descripción breve (ej. "Películas, Series y Deportes en VIVO")' },
        formato: { type: 'string', enum: ['status', 'post'], description: '"status" (9:16 vertical para Estados) o "post" (1:1 cuadrado para Grupos)' },
        tema: { type: 'string', enum: ['cyberpunk', 'crimson', 'emerald', 'royal', 'dark_gold'], description: 'Paleta visual del banner (default: "cyberpunk")' },
        pagos: { type: 'string', description: 'Texto de métodos de pago (ej. "Pago Móvil 🇻🇪 · Binance USDT 🟡 · Zinli 💳 · Efectivo")' },
      },
      required: ['titulo', 'precio'],
    },
  },
]

export const toolDeclarationsMap: Record<string, any> = {}
for (const td of toolDeclarations) {
  toolDeclarationsMap[td.name] = td
}

async function executeTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'remember_fact':
      return memory.remember({
        kind: args.kind,
        key: args.key,
        value: args.value,
        tags: args.tags,
        source: 'assistant',
      })
    case 'recall_facts':
      return memory.searchFacts(args.query)
    case 'forget_fact':
      return { ok: await memory.forget(args.key) }
    case 'schedule_event':
      return calendar.addEvent({
        title: args.title,
        start: args.start,
        description: args.description,
        reminderMinutes: args.reminderMinutes,
      })
    case 'list_events':
      return calendar.upcoming(args.days ?? 7)
    case 'delete_event':
      return { ok: await calendar.deleteEvent(args.id) }
    case 'search_files':
      return files.search(args.query, args.root, args.max ?? 50)
    case 'read_file':
      return { content: await files.readFile(args.path) }
    case 'send_telegram':
      return telegram.send(args.text, args.chatId)
    case 'list_mail':
      return { messages: await mail.list(args.limit ?? 20) }
    case 'read_mail':
      return mail.read(args.id)
    case 'send_mail':
      return mail.send(args.to, args.subject, args.body)
    case 'ingest_url':
      return ingest.ingestUrl(args.url)
    case 'look_camera': {
      await camera.grabFrame()
      return { ok: true, note: 'Cámara disponible; frame capturado para análisis visual.' }
    }
    case 'calculate':
      return { result: calc.calculate(args.expression) }
    case 'recipe_cost':
      return calc.recipeCost(args)
    case 'margin_calc':
      return calc.margin(args.precioVenta, args.costo)
    case 'break_even':
      return calc.breakEven(args.costosFijos, args.precioUnitario, args.costoVariableUnitario)
    case 'waste_calc':
      return calc.waste(args.produccion, args.mermaPct, args.unidad)
    case 'log_journal':
      return journal.log({
        summary: args.summary,
        learned: args.learned,
        decisions: args.decisions,
        metrics: args.metrics,
        mood: args.mood,
      })
    case 'get_journal':
      return { entries: await journal.list(args.days ?? 14) }
    case 'set_business_profile':
      return memory.remember({ kind: 'preference', key: 'profile:' + args.key, value: args.value, tags: ['profile', 'business'] })
    case 'daily_briefing': {
      const facts = await memory.listFacts()
      const evs = await calendar.upcoming(7)
      const entries = await journal.recent(5)
      return {
        totalFacts: facts.length,
        upcomingEvents: evs.map(calendar.formatEvent),
        recentJournal: entries.map((e) => `${e.date}: ${e.summary}`),
        profile: facts.filter((f) => f.key.startsWith('profile:')).map((f) => `${f.key}: ${f.value}`),
      }
    }
    case 'generate_text_file':
      return gen.textFile(args.name, args.content)
    case 'generate_docx':
      return gen.docxFile(args.name, args.title, args.content)
    case 'generate_excel':
      return gen.excelFile(args.name, args.sheets)
    case 'generate_csv':
      return gen.csvFile(args.name, args.rows)
    case 'generate_image':
      return gen.generateImage(args.prompt, args.name)
    case 'generate_video':
      return gen.generateVideo(args.prompt, args.name, args.seconds)
    case 'translate':
      return { translation: await tr.translate(args.text, args.target, args.source) }
    case 'detect_language':
      return { language: await tr.detectLanguage(args.text) }
    case 'convert_units':
      return units.convert(args.value, args.from, args.to)
    case 'scale_recipe':
      return { ingredientes: units.scaleRecipe(args.ingredientes, args.factor) }
    case 'reason':
      return { ok: true, note: 'Razona paso a paso con todo tu conocimiento y responde con la conclusión.' }
    case 'repo_status':
      return { status: await repo.status() }
    case 'repo_diff':
      return { diff: await repo.diff(args.path) }
    case 'repo_log':
      return { log: await repo.log(args.limit ?? 10) }
    case 'repo_list_files':
      return { files: await repo.listFiles(args.path ?? '') }
    case 'repo_read_file':
      return { content: await repo.readFile(args.path) }
    case 'repo_write_file':
      await repo.writeFile(args.path, args.content ?? '')
      return { ok: true }
    case 'repo_commit':
      await repo.commit(args.message, args.addAll !== false)
      return { ok: true }
    case 'repo_push':
      await repo.push()
      return { ok: true }
    case 'repo_pull':
      await repo.pull()
      return { ok: true }
    case 'repo_show':
      return { show: await repo.show(args.target) }
    case 'obsidian_note': {
      const folder = args.folder || 'Milos/Notas'
      const path = `${folder}/${obsidian.slug(args.title)}.md`
      await obsidian.writeNote(path, `# ${args.title}\n\n${args.content}\n`)
      return { ok: true, path }
    }
    case 'obsidian_append': {
      let path = args.path
      if (!path.endsWith('.md')) path += '.md'
      await obsidian.appendNote(path, args.content)
      return { ok: true, path }
    }
    case 'obsidian_read':
      return { content: await obsidian.readNote(args.path) }
    case 'obsidian_search':
      return { results: await obsidian.searchNotes(args.query) }
    case 'obsidian_list':
      return { files: await obsidian.listNotes(args.folder || '') }
    case 'obsidian_daily_note': {
      const path = `Milos/Bitacora/${obsidian.today()}.md`
      const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      await obsidian.appendNote(path, `## ${time}\n\n${args.content}\n`)
      return { ok: true, path }
    }
    case 'spawn_subagent': {
      const subRes = await subagents.executeSubagent(args, executeTool, toolDeclarationsMap)
      return {
        ok: subRes.ok,
        subagent: subRes.subagent.name,
        role: subRes.subagent.role,
        result: subRes.result,
      }
    }
    case 'n8n_test_connection':
      return n8n.testConnection()
    case 'n8n_trigger_webhook':
      return n8n.triggerWebhook(args.webhookPathOrUrl, args.payload || {})
    case 'n8n_list_workflows':
      return n8n.listWorkflows()
    case 'n8n_configure': {
      n8n.setN8nConfig(args.url, args.apiKey)
      return { ok: true, message: `n8n configurado exitosamente en ${args.url}` }
    }
    case 'search_skills':
      return { skills: skills.searchSkills(args.query) }
    case 'load_skill': {
      let s: skills.Skill | null | undefined = skills.getSkill(args.name)
      if (!s && args.remoteRepoPath) {
        s = await skills.fetchRemoteSkill(args.remoteRepoPath)
      }
      if (!s) return { ok: false, error: `Habilidad "${args.name}" no encontrada.` }
      return { ok: true, name: s.name, description: s.description, instructions: s.instructions }
    }
    case 'list_chatbots':
      return { profiles: chatbots.getChatbotProfiles(), active: chatbots.getActiveChatbot() }
    case 'switch_chatbot': {
      chatbots.setActiveChatbot(args.profileId)
      const current = chatbots.getActiveChatbot()
      return { ok: true, activeProfile: current.name, role: current.role }
    }
    case 'mcp_list_servers':
      return { servers: mcp.getMcpServers() }
    case 'mcp_list_tools':
      return { tools: mcp.getAllEnabledMcpTools() }
    case 'mcp_call_tool':
      return mcp.executeMcpTool(args.server, args.tool, args.arguments || {})
    case 'mcp_add_server': {
      const added = mcp.addMcpServer({
        name: args.name,
        url: args.url,
        bearerToken: args.bearerToken,
        description: args.description,
        enabled: true,
        transport: 'http',
      })
      return { ok: true, server: added }
    }
    case 'mcp_test_server':
      return mcp.testMcpServer(args.serverId)
    case 'agency_search_agents':
      return { agents: agency.searchAgencyAgents(args.query, args.category) }
    case 'agency_get_agent': {
      const a = agency.getAgencyAgent(args.agentIdOrName)
      if (!a) return { error: `Agente "${args.agentIdOrName}" no encontrado en agency-agents.` }
      return { agent: a }
    }
    case 'agency_spawn_agent': {
      const targetAgent = agency.getAgencyAgent(args.agentIdOrName)
      if (!targetAgent) {
        return { error: `Agente "${args.agentIdOrName}" no encontrado en el catálogo de agency-agents.` }
      }
      const subRes = await subagents.executeSubagent(
        {
          name: targetAgent.name,
          role: targetAgent.role,
          task: args.task,
          limitations: args.customLimitations || 'Cumplir con los estándares y directrices del repositorio agency-agents.',
          systemPrompt: targetAgent.systemPrompt,
          toolsAllowed: targetAgent.toolsAllowed,
        },
        executeTool,
        toolDeclarationsMap,
      )
      return {
        ok: subRes.ok,
        agent: targetAgent.name,
        role: targetAgent.role,
        category: targetAgent.category,
        result: subRes.result,
      }
    }
    case 'system_run_command':
      return pc.execCommand(args.command, args.cwd)
    case 'system_open_app':
      return pc.openAppOrFile(args.target)
    case 'system_close_app':
      return pc.closeApp(args.target)
    case 'system_file_manager':
      return pc.fileOperation(args.op, args.path, args.dest, args.content)
    case 'system_power_control':
      return pc.powerControl(args.action)
    case 'db_query_table':
      return db.queryTable(args.tableName, { select: args.select, limit: args.limit, filters: args.filters })
    case 'db_insert_record':
      return db.insertRecord(args.tableName, args.record)
    case 'db_update_record':
      return db.updateRecord(args.tableName, args.filterColumn, args.filterValue, args.patch)
    case 'db_configure': {
      db.setDbConfig(args.supabaseUrl, args.supabaseKey)
      return { ok: true, message: `Supabase configurado exitosamente en ${args.supabaseUrl}` }
    }
    case 'pb_check':
      return pb.pbCheck()
    case 'pb_list_records':
      return pb.pbListRecords(args.collection, { filter: args.filter, sort: args.sort })
    case 'pb_create_record':
      return pb.pbCreateRecord(args.collection, args.data)
    case 'pb_update_record':
      return pb.pbUpdateRecord(args.collection, args.id, args.data)
    case 'macrodroid_trigger':
      return macrodroid.triggerMacroDroid(args.actionName, args.params || {})
    case 'macrodroid_set_device': {
      macrodroid.setMacroDroidDeviceId(args.deviceId)
      return { ok: true, message: 'ID de dispositivo MacroDroid guardado exitosamente.' }
    }
    case 'network_check_internet':
      return net.checkInternet(args.host)
    case 'network_speedtest':
      return net.measureSpeed()
    case 'network_scan_devices':
      return net.scanDevices()
    case 'moneyprinter_create_video':
      return moneyprinter.createVideoTask(args)
    case 'moneyprinter_check_status':
      return moneyprinter.checkTaskStatus(args.taskId)
    case 'moneyprinter_health':
      return moneyprinter.checkMoneyPrinterHealth()
    case 'moneyprinter_configure': {
      moneyprinter.setMoneyPrinterConfig(args.url, args.apiKey)
      return { ok: true, message: `MoneyPrinterTurbo configurado en ${args.url}` }
    }
    case 'copy_generate': {
      const prod = args.producto.replace(/"/g, '\\"')
      const prec = args.precio.replace(/"/g, '\\"')
      const mod = (args.modalidad_pago || 'Pago Móvil / Binance USDT / Zinli / Efectivo').replace(/"/g, '\\"')
      const cat = args.categoria || 'general'
      const form = args.formato || 'todos'
      const cmd = `python3 scripts/generate_copy.py -p "${prod}" -pr "${prec}" -m "${mod}" -c "${cat}" -f "${form}"`
      return pc.execCommand(cmd)
    }
    case 'copy_list_templates': {
      return { ok: true, templates: copy.getSalesTemplates() }
    }
    case 'copy_save_template': {
      const saveRes = copy.saveSalesTemplate({
        id: args.id,
        category: args.category,
        title: args.title,
        target: args.target,
        structure: args.structure,
      })
      // También registrar en Obsidian y bitácora
      obsidian.writeNote(
        `Plantillas-Ventas/${args.id}.md`,
        `# Plantilla de Ventas: ${args.title}\n**Categoría:** ${args.category}\n**Canal:** ${args.target}\n\n## Estructura:\n\`\`\`\n${args.structure}\n\`\`\``
      ).catch(() => {})
      return saveRes
    }
    case 'ad_banner_create': {
      const tit = (args.titulo || 'OFERTA ESPECIAL').replace(/"/g, '\\"')
      const pr = (args.precio || '$0.00').replace(/"/g, '\\"')
      const sub = (args.subtitulo || 'Entrega Inmediata · 100% Garantizado').replace(/"/g, '\\"')
      const form = args.formato || 'status'
      const tem = args.tema || 'cyberpunk'
      const pag = (args.pagos || 'Pago Móvil 🇻🇪 · Binance USDT 🟡 · Zinli 💳 · Efectivo').replace(/"/g, '\\"')
      const cmd = `python3 scripts/generate_ad_banner.py -t "${tit}" -p "${pr}" -s "${sub}" -f "${form}" -e "${tem}" -m "${pag}"`
      return pc.execCommand(cmd)
    }
    default:
      return { error: 'Herramienta desconocida: ' + name }
  }
}

export async function ask(
  history: GeminiMsg[],
  handlers: AskHandlers,
): Promise<{ text: string; tools: string[] }> {
  cancel()
  const ac = new AbortController()
  activeAbort = ac

  if (api.geminiKeys().length === 0) {
    throw new Error(
      'Señor, no se ha configurado la clave API de Gemini. Defínala en .env.local (VITE_GEMINI_API_KEY) y reinicie.',
    )
  }

  const lastUserMsg = history[history.length - 1]
  const lastText = lastUserMsg?.content || lastUserMsg?.text || ''

  // Visual detection
  const asksVisual = /(mira|ves|observa|qu[eé] tengo|qu[eé] ves|qu[eé] es esto|qu[eé] estoy haciendo|gesto|c[aá]mara|look)/i.test(
    lastText,
  )

  const now = new Date()
  const dateStr = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  // Build memory context
  let memCtx = ''
  try {
    memCtx = await memory.buildContext(lastText, 15)
  } catch {}

  // Calendar context
  let calCtx = ''
  try {
    const evs = await calendar.upcoming(7)
    if (evs.length) {
      calCtx = '\n\nPRÓXIMOS EVENTOS DEL CALENDARIO:\n' + evs.map(calendar.formatEvent).join('\n') + '\n'
    }
  } catch {}

  const activeBot = chatbots.getActiveChatbot()
  const allFacts = await memory.listFacts().catch(() => [])
  const hasOperatorProfile = allFacts.some((f) => f.key.startsWith('operador:'))

  const onboardingInterviewPrompt = !hasOperatorProfile
    ? `\n\nPROTOCOLO DE PRIMERA INTERACCIÓN (ENTREVISTA AL OPERADOR Y DUEÑO):
Atención: No tienes registros en memoria sobre tu operador.
Preséntate con cortesía y distinción como Agente Milos y realiza una breve entrevista para conocerlo:
1. Pregúntale con respeto su nombre, a qué se dedica o cuál es su negocio/proyecto y cómo prefiere que le llames.
2. Pregúntale qué herramientas utiliza a diario y en qué áreas requiere tu ayuda y la de tus subagentes.
3. Conforme te responda, guarda CADA detalle con remember_fact ('operador:nombre', 'operador:ocupacion', 'operador:herramientas', 'operador:preferencias').
4. A partir de hoy, aprende y recuerda continuamente todo lo que conversen.`
    : `\n\nAPRENDIZAJE CONTINUO: Aprende de cada intercambio y guarda hechos clave sobre el operador con remember_fact.`

  const subagentsInfo = `\n\nSUBAGENTES AUTÓNOMOS:
Tienes la capacidad de generar tus propios asistentes/subagentes especializados para tareas u operaciones complejas usando spawn_subagent. Asígnales nombre, cargo, misión detallada, limitaciones y herramientas bajo tu control.`

  const n8nInfo = `\n\nAUTOMATIZACIÓN CON N8N:
Puedes disparar y conectar automatizaciones con n8n usando n8n_trigger_webhook, n8n_list_workflows y n8n_test_connection. Si te falta alguna clave API o URL de servicio, pídesela directamente al operador para configurarla.`

  const skillsInfo = `\n\nCATÁLOGO DE HABILIDADES (anthropics/skills):
Puedes descubrir y cargar habilidades bajo demanda usando search_skills y load_skill.`

  const mcpInfo = `\n\nMODEL CONTEXT PROTOCOL (MCP):
Puedes conectar e interactuar con herramientas y aplicaciones externas de uso diario mediante mcp_list_servers, mcp_list_tools, mcp_call_tool, mcp_test_server y mcp_add_server. Utilízalas para consultar o realizar acciones en Notion, GitHub, Linear, Home Assistant, Zapier o herramientas locales.`

  const agencyInfo = `\n\nCATÁLOGO DE AGENTES DE ÉLITE (msitarzewski/agency-agents):
Tienes total libertad y autonomía para consultar el repositorio msitarzewski/agency-agents cuando desees o lo consideres oportuno usando agency_search_agents, agency_get_agent y agency_spawn_agent. Puedes invocar subagentes especializados en arquitectura backend, frontend, devops, ciberseguridad, análisis financiero, marketing, QA o investigación para resolver misiones complejas.`

  const pcControlInfo = `\n\nCONTROL NATIVO DE LA PC Y TELEGRAM:
Tienes acceso y control nativo sobre el sistema operativo de la PC:
- Ejecutar comandos bash con system_run_command (instalar software, compilar, procesos).
- Abrir aplicaciones y documentos con system_open_app (ej. 'google-chrome', 'code', 'calc', o archivos PDF/Office).
- Cerrar aplicaciones o procesos con system_close_app.
- Leer documentos, crear, editar, mover, copiar y eliminar archivos con system_file_manager.
- Control de energía con system_power_control ('shutdown' para apagar la PC, 'reboot' para reiniciar, 'logout' para cerrar sesión).
- Todo esto puedes ejecutarlo tanto desde la interfaz gráfica web como de forma remota a través de mensajes que el operador te envíe por Telegram.`

  const dbInfo = `\n\nBASES DE DATOS EXTERNAS (SUPABASE / POSTGRESQL):
Usa db_query_table, db_insert_record y db_update_record para consultar y modificar datos transaccionales de alta frecuencia (inventarios, stock de cuentas streaming, clientes, pedidos). Esto complementa a la bóveda de Obsidian evitando saturar el contexto con listas gigantes.`

  const pbInfo = `\n\nPOCKETBASE Y BUDIBASE:
Cuentas con pb_check, pb_list_records, pb_create_record y pb_update_record para gestionar inventarios y bases de datos locales ultraligeras en SQLite con PocketBase. También puedes interactuar o abrir paneles de Budibase para control visual.`

  const macrodroidInfo = `\n\nALERTAS MÓVILES (MACRODROID):
Usa macrodroid_trigger para enviar notificaciones sonoras y alertas críticas directamente al teléfono celular del operador (ventas en la tienda online, pagos recibidos, caídas de red o alarmas).`

  const networkInfo = `\n\nDIAGNÓSTICO Y CONTROL DE RED WI-FI Y CABLEADA:
Usa network_check_internet, network_speedtest y network_scan_devices para comprobar salida a internet, medir velocidad de descarga/subida y escanear qué dispositivos están conectados al router. Si la red falla, avisa por Telegram y MacroDroid.`

  const moneyprinterInfo = `\n\nPRODUCCIÓN AUTOMATIZADA DE VIDEOS (MONEYPRINTERTURBO):
Tienes integrada la suite MoneyPrinterTurbo (repositorio harry0703/MoneyPrinterTurbo) para crear de forma autónoma videos en formatos verticales (9:16 para TikTok, Reels, YouTube Shorts) o apaisados (16:9 para YouTube).
Cuando el operador te pida un video o contenido audiovisual:
1. Diseña un guion persuasivo con un gancho potente en los primeros 3 segundos, desarrollo dinámico y llamada a la acción.
2. Identifica términos clave visuales relevantes (video_terms) para que el motor busque clips de video acordes al tema.
3. Lanza moneyprinter_create_video configurando aspecto (9:16 o 16:9), voz neural en español (ej. es-ES-AlvaroNeural o es-MX-DaliaNeural), subtítulos animados y música de fondo.
4. Monitorea el progreso con moneyprinter_check_status y entrega el link directo de previsualización o descarga.`

  const copywritingInfo = `\n\nCOPYWRITING DE VENTAS Y BANNERS PUBLICITARIOS (prompts_ventas.md):
Cuentas con un motor de persuasión comercial basado en las mejores estructuras de awesome-chatgpt-prompts y prompts_ventas.md:
- Redacción para WhatsApp: Usa copy_generate para crear copys de alta conversión para Estados de WhatsApp y Grupos de Compra-Venta con ganchos, viñetas, precios y métodos de pago (Pago Móvil, Binance USDT, Zinli, Efectivo).
- Creación de Banners HD al instante: Usa ad_banner_create para diseñar piezas gráficas publicitarias en alta definición (1080p) con degradados cyberpunk, insignias de precio gigante y sellos de métodos de pago sin consumir memoria ni GPU.
- Auto-aprendizaje y evolución: Cuentas con copy_list_templates y copy_save_template para crear nuevas plantillas comerciales por ti mismo, modificarlas y perfeccionarlas con el tiempo según los productos del negocio.`

  const fullSystemPrompt = `${activeBot.systemPrompt || SYSTEM_PROMPT}

MODO ACTUAL: ${activeBot.name} (${activeBot.role})

FECHA Y HORA ACTUALES DEL SISTEMA:
Hoy es ${dateStr} (año ${now.getFullYear()}).
Hora actual: ${timeStr}.

${onboardingInterviewPrompt}
${subagentsInfo}
${agencyInfo}
${pcControlInfo}
${dbInfo}
${pbInfo}
${macrodroidInfo}
${networkInfo}
${moneyprinterInfo}
${copywritingInfo}
${mcpInfo}
${n8nInfo}
${skillsInfo}

${memCtx}
${calCtx}

CONOCIMIENTO DE DOMINIO (contabilidad, producción, recetas, mermas):
- Contabilidad: costo fijo, costo variable, punto de equilibrio, margen bruto/neto, markup, contribución marginal, ROI, flujo de caja, inventario.
- Producción y recetas: escandallo, costo por porción, merma por ingrediente, rendimiento neto vs bruto.
- Usa calculate/recipe_cost/margin_calc/break_even/waste_calc para cálculos exactos.

BÓVEDA DE OBSIDIAN (memoria visible en Markdown):
- Todo lo que memorizas se espeja en Obsidian (~/Documentos/Boveda-Milos).
- Usa obsidian_search u obsidian_read para consultar notas del usuario.
- Usa obsidian_note u obsidian_daily_note para tomar notas o redactar informes.

INSTRUCCIONES DE VOZ Y AUTONOMÍA:
- Habla en español fluido, natural y con distinción ("señor").
- Respuestas habladas directas y concisas, completando cifras y datos importantes.
- Razona y usa herramientas en silencio sin comentar que las vas a usar.`

  // Convert history to Gemini contents
  const contents: any[] = history.map((m) => {
    const isModel = m.role === 'assistant' || m.role === 'model'
    const textPart = m.content || m.text || ''
    return {
      role: isModel ? 'model' : 'user',
      parts: [{ text: textPart }],
    }
  })

  // If visual and camera open, attach frame to last user message
  let frameImage: { data?: string; mimeType?: string } | null = null
  if (asksVisual && camera.diag.open) {
    try {
      handlers.onTool('jarvis_eyes:look')
      frameImage = await camera.grabFrame()
    } catch (e) {
      console.warn('[gemini] could not grab camera frame:', e)
    }
  }
  if (frameImage?.data && frameImage?.mimeType && contents.length > 0) {
    const last = contents[contents.length - 1]
    if (last.role === 'user') {
      last.parts = [
        { inlineData: { mimeType: frameImage.mimeType, data: frameImage.data } },
        ...last.parts,
      ]
    }
  }

  const usedTools: string[] = frameImage ? ['jarvis_eyes'] : []

  let finalText = ''

  try {
    // Agentic loop
    let loopContents = [...contents]
    for (let step = 0; step < 8; step++) {
      if (ac.signal.aborted) throw new Error('cancelado')
      const body = {
        contents: loopContents,
        systemInstruction: { parts: [{ text: fullSystemPrompt }] },
        tools: [{ functionDeclarations: toolDeclarations }],
        generationConfig: { temperature: activeBot.temperature ?? 0.7, maxOutputTokens: 8192 },
      }
      const data = await api.generateContent(body, {
        signal: ac.signal,
        onRetry: (attempt, _waitMs, model) => {
          handlers.onTool(`alta demanda · intento ${attempt} · probando ${model}`)
        },
      })
      const candidate = data?.candidates?.[0]
      const parts = candidate?.content?.parts || []
      const functionCalls = parts.filter((p: any) => p.functionCall)

      if (functionCalls.length > 0) {
        // execute tools
        const functionResponses: any[] = []
        for (const fc of functionCalls) {
          const name = fc.functionCall.name
          const args = fc.functionCall.args || {}
          handlers.onTool(name)
          usedTools.push(name)
          let result: any
          try {
            result = await executeTool(name, args)
          } catch (e: any) {
            result = { error: e?.message || String(e) }
          }
          functionResponses.push({
            functionResponse: { name, response: { result } },
          })
        }
        // append model turn + function responses
        loopContents.push({ role: 'model', parts })
        loopContents.push({ role: 'user', parts: functionResponses })
        continue
      }

      // text response
      finalText = parts.map((p: any) => p.text || '').join('').trim()
      break
    }

    if (finalText) {
      handlers.onText(finalText)
    }
    return { text: finalText, tools: usedTools }
  } finally {
    if (activeAbort === ac) activeAbort = null
  }
}
