import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import { humanizeTool } from './ToolConstellation'
import './fx.css'

const RUN = '#b46bff'
const OK = '#2dffa6'
const FAIL = '#f0a93c'
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

/** Pantalla de delegación: aparece cuando Milos lanza un subagente y se retira sola al terminar,
 *  dejando a Milos listo para responder. Todo lo que muestra viene del subagente real. */
export function SubagentView() {
  const sub = useStore((s) => s.subagent)
  const [hidden, setHidden] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!sub || sub.status !== 'running') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [sub])

  const show = !!sub && sub.id !== hidden
  const color = !sub ? RUN : sub.status === 'completed' ? OK : sub.status === 'failed' ? FAIL : RUN
  const secs = sub ? Math.max(0, Math.floor(((sub.endedAt ?? now) - sub.startedAt) / 1000)) : 0
  const kicker = !sub
    ? ''
    : sub.status === 'running'
      ? 'Milos delegó una tarea'
      : sub.status === 'completed'
        ? 'Tarea completada · volviendo con Milos'
        : 'El subagente encontró un problema · volviendo con Milos'

  return (
    <AnimatePresence>
      {show && sub && (
        <motion.div
          key={sub.id}
          className="fx-sub"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="fx-sub-card">
            <div className="fx-sub-ring" style={{ color }}>
              <div className="fx-orbit" style={{ width: 340, height: 340, margin: '-170px 0 0 -170px', transform: 'rotateX(70deg)' }} />
              <svg viewBox="0 0 300 300" aria-hidden="true">
                <circle cx="150" cy="150" r="120" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="8" />
                <circle
                  className={sub.status === 'running' ? 'fx-spin' : undefined}
                  cx="150"
                  cy="150"
                  r="120"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={sub.status === 'running' ? '190 565' : '754 0'}
                  style={{ filter: `drop-shadow(0 0 10px ${color})`, transition: 'stroke-dasharray .6s ease' }}
                />
              </svg>
              <div className="fx-sub-time">
                {mmss(secs)}
                <small>{sub.status === 'running' ? 'trabajando' : sub.status === 'completed' ? 'completado' : 'con errores'}</small>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color }}>{kicker}</div>
              <h2 style={{ textShadow: `0 0 20px ${color}` }}>{sub.name}</h2>
              <div className="role">{sub.role}</div>
              <p className="task">{sub.task}</p>
              <div className="fx-calls">
                {sub.calls.length === 0 && (
                  <div className="fx-call">
                    <i style={{ background: RUN, boxShadow: `0 0 10px ${RUN}` }} />
                    <span>Preparando la misión</span>
                    <em>En curso</em>
                  </div>
                )}
                {sub.calls.slice(-5).map((c, i) => (
                  <div className="fx-call" key={`${i}-${c.name}`}>
                    <i
                      style={
                        c.ok === null
                          ? { background: RUN, boxShadow: `0 0 10px ${RUN}` }
                          : c.ok
                            ? { background: OK }
                            : { background: FAIL }
                      }
                    />
                    <span>{humanizeTool(c.name)}</span>
                    <em>{c.ok === null ? 'En curso' : c.ok ? 'Hecho' : 'Falló'}</em>
                  </div>
                ))}
              </div>
              <div className="fx-sub-foot">
                <span>Milos te responderá cuando el subagente termine.</span>
                <button type="button" onClick={() => setHidden(sub.id)}>
                  Ocultar
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
