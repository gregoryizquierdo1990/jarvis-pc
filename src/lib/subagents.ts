/**
 * Sistema de Subagentes autónomos generados por Milos.
 *
 * Milos puede engendrar subagentes especializados, asignarles cargo, tarea,
 * prompt, limitaciones y herramientas específicas, ejecutarlos y recibir sus resultados.
 */

import { useStore } from '../store'
import * as api from './geminiApi'
import * as obsidian from './obsidian'

export type SubagentSpec = {
  id: string
  name: string
  role: string
  task: string
  limitations?: string
  systemPrompt?: string
  toolsAllowed?: string[]
  status: 'running' | 'completed' | 'failed'
  result?: string
  createdAt: number
}

const activeSubagents: SubagentSpec[] = []

export function listRecentSubagents(): SubagentSpec[] {
  return [...activeSubagents]
}

/** Ejecuta un subagente de forma aislada y controlada con Gemini */
export async function executeSubagent(
  spec: Omit<SubagentSpec, 'id' | 'status' | 'createdAt'>,
  executeToolFn: (name: string, args: any) => Promise<any>,
  toolDeclarationsMap: Record<string, any>,
): Promise<{ ok: boolean; result: string; subagent: SubagentSpec }> {
  const id = `sub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const subagent: SubagentSpec = {
    ...spec,
    id,
    status: 'running',
    createdAt: Date.now(),
  }
  activeSubagents.unshift(subagent)

  // Pantalla de delegación: refleja en vivo lo que hace este subagente.
  const ui = () => useStore.getState()
  ui().setSubagent({ id, name: spec.name, role: spec.role, task: spec.task, status: 'running', startedAt: subagent.createdAt, calls: [] })
  const closeView = (status: 'completed' | 'failed') => {
    ui().finishSubagent(id, status)
    setTimeout(() => {
      if (ui().subagent?.id === id) ui().setSubagent(null)
    }, status === 'completed' ? 1600 : 2400)
  }

  const fullPrompt = `Eres el subagente "${spec.name}", operando bajo el mando y supervisión directa de Agente Milos.
CARGO: ${spec.role}
MISIÓN PRINCIPAL: ${spec.task}
LIMITACIONES Y RESTRICCIONES: ${spec.limitations || 'Ninguna especificada; actúa con rigor y precisión.'}

INSTRUCCIONES ADICIONALES:
${spec.systemPrompt || 'Completa la misión asignada de forma exhaustiva, estructurada y profesional.'}

Responde en español con el informe final o solución para entregar a tu supervisor Milos.`

  // Filtrar herramientas permitidas
  const allowed = spec.toolsAllowed || []
  const subagentTools = allowed.includes('all')
    ? Object.values(toolDeclarationsMap)
    : Object.entries(toolDeclarationsMap)
        .filter(([k]) => allowed.includes(k))
        .map(([, v]) => v)

  try {
    let loopContents: any[] = [
      { role: 'user', parts: [{ text: `Ejecuta tu misión asignada: ${spec.task}` }] },
    ]

    let finalAnswer = ''

    for (let step = 0; step < 5; step++) {
      const body: any = {
        contents: loopContents,
        systemInstruction: { parts: [{ text: fullPrompt }] },
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
      }

      if (subagentTools.length > 0) {
        body.tools = [{ functionDeclarations: subagentTools }]
      }

      const res = await api.generateContent(body)
      const candidate = res?.candidates?.[0]
      const parts = candidate?.content?.parts || []
      const functionCalls = parts.filter((p: any) => p.functionCall)

      if (functionCalls.length > 0) {
        const functionResponses: any[] = []
        for (const fc of functionCalls) {
          const fnName = fc.functionCall.name
          const fnArgs = fc.functionCall.args || {}
          let result: any
          ui().startSubagentCall(fnName)
          try {
            result = await executeToolFn(fnName, fnArgs)
          } catch (err: any) {
            result = { error: err.message || String(err) }
          }
          ui().endSubagentCall(!(result && typeof result === 'object' && 'error' in result))
          functionResponses.push({
            functionResponse: {
              name: fnName,
              response: { output: result },
            },
          })
        }
        loopContents.push({ role: 'model', parts })
        loopContents.push({ role: 'user', parts: functionResponses })
      } else {
        const textParts = parts.filter((p: any) => p.text).map((p: any) => p.text)
        finalAnswer = textParts.join('\n').trim()
        break
      }
    }

    subagent.status = 'completed'
    subagent.result = finalAnswer || 'Misión completada sin salida de texto.'

    // Espejar registro de subagente en Obsidian
    try {
      const logMd = `# Subagente: ${spec.name} (${spec.role})\n\n**Fecha:** ${new Date().toLocaleString('es-ES')}\n**Tarea:** ${spec.task}\n**Limitaciones:** ${spec.limitations || 'Ninguna'}\n\n## Informe de Resultados\n${subagent.result}\n`
      void obsidian.writeNote(`Milos/Subagentes/${new Date().toISOString().slice(0, 10)}-${spec.name}.md`, logMd)
    } catch {}

    closeView('completed')
    return { ok: true, result: subagent.result, subagent }
  } catch (err: any) {
    subagent.status = 'failed'
    subagent.result = `Error en ejecución del subagente: ${err.message || String(err)}`
    closeView('failed')
    return { ok: false, result: subagent.result, subagent }
  }
}
