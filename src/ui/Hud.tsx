import { ToolConstellation, CodeColumns } from './ToolConstellation'
import { UniverseGlobe } from './UniverseGlobe'

// Altura relativa de cada barra de la señal de voz (solo estética; la amplitud real es `level`).
const SIGNAL_K = [0.6, 0.85, 0.5, 1, 0.7, 0.9, 0.55, 0.8, 0.65, 1, 0.5, 0.75, 0.9, 0.6]
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useStore, accentFor, type Phase } from '../store'
import { Suggestions } from './Suggestions'
import { BladeSweep, Blades } from './Blades'
import { Effects } from './Effects'
import { Pointer } from './Pointer'
import { ThinkingOrbView } from './ThinkingOrbView'

const statusText: Record<Phase, string> = {
  offline: 'DESCONECTADO',
  boot: 'INICIALIZANDO',
  dormant: 'EN ESPERA — DI “MILOS” O ESCRIBE ABAJO',
  waking: 'EN LÍNEA',
  listening: 'ESCUCHANDO',
  thinking: 'PROCESANDO',
  tooling: 'ACCEDIENDO A SISTEMAS',
  speaking: 'RESPONDIENDO',
}

function Corner({ at }: { at: 'tl' | 'tr' | 'bl' | 'br' }) {
  return <div className={`corner corner-${at}`} />
}

/* ------------------------------------------------------------------ decode */

/**
 * The glyphs the ghost is drawn from. Uppercase, digits and rules only: the
 * point is that the unresolved text reads as *machine*, so lowercase letters
 * and anything with a descender are left out — they look like badly rendered
 * words rather than an unfinished decode.
 */
const GLYPHS = '/\\|<>[]{}=+*#%&$0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/** Characters of noise shown ahead of the resolved text. */
const GHOST = 22
/** Repaint interval for the scramble. ~24fps is plenty for glyph noise. */
const FRAME_MS = 42
/** Floor on the resolve rate, characters per second. */
const MIN_RATE = 110
/** The frontier is never allowed to trail the streamed text by longer. */
const MAX_LAG_MS = 420

function scramble(s: string, seed: number) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    // Whitespace is left alone so word shapes and line breaks hold still while
    // the glyphs underneath churn.
    if (c === ' ' || c === '\n' || c === '\t') {
      out += c
      continue
    }
    out += GLYPHS[(seed * 7919 + i * 104729 + c.charCodeAt(0)) % GLYPHS.length]
  }
  return out
}

/**
 * JARVIS's lines, arriving the way a computer would produce them.
 *
 * The hard part is not the effect, it is that the text underneath is *live*.
 * The store appends a token at a time, so this component re-renders dozens of
 * times a second with a slightly longer string, and the naive implementation —
 * scramble the whole thing, resolve it over N milliseconds — restarts the
 * animation on every token and never finishes decoding anything.
 *
 * So the frontier is a ref and only ever moves forward. Everything behind it
 * has settled and is plain text that will never animate again; a short window
 * ahead of it is noise; the rest is present in the DOM but invisible, which
 * keeps the line wrapping identical to the finished paragraph and means the
 * accessibility tree always holds the real sentence. The rate scales with how
 * far behind the frontier has fallen, so a single token drips and a 300
 * character burst clears inside MAX_LAG_MS — the decode must never be the
 * reason the transcript trails the voice.
 *
 * The rAF loop repaints on a 42ms gate rather than every frame, and stops dead
 * the moment the frontier catches up.
 */
function DecodeText({ text }: { text: string }) {
  const reduced = useReducedMotion()
  const settled = useRef(0)
  const raf = useRef(0)
  const latest = useRef(text)
  const [tick, bump] = useState(0)

  useEffect(() => {
    // The running loop reads the length through this ref rather than through
    // its own closure, so a token landing mid-sweep simply extends the target
    // instead of leaving the loop chasing a length that is already stale.
    latest.current = text

    if (reduced) {
      settled.current = text.length
      return
    }
    if (raf.current || settled.current >= text.length) return

    let prev = performance.now()
    let painted = 0

    const step = (now: number) => {
      // Clamped so a backgrounded tab does not resolve the whole answer in one
      // enormous frame the moment it comes back.
      const dt = Math.min(now - prev, 120) / 1000
      prev = now

      const target = latest.current.length
      const rate = Math.max(MIN_RATE, (target - settled.current) / (MAX_LAG_MS / 1000))
      settled.current = Math.min(target, settled.current + rate * dt)

      if (now - painted >= FRAME_MS) {
        painted = now
        bump((n) => n + 1)
      }

      if (settled.current < latest.current.length) {
        raf.current = requestAnimationFrame(step)
      } else {
        raf.current = 0
        bump((n) => n + 1)
      }
    }
    raf.current = requestAnimationFrame(step)
  }, [text, reduced])

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      raf.current = 0
    },
    [],
  )

  const n = Math.floor(settled.current)
  if (reduced || n >= text.length) return <>{text}</>

  return (
    <>
      {text.slice(0, n)}
      <span className="decode-ghost">{scramble(text.slice(n, n + GHOST), tick)}</span>
      <span className="decode-veil">{text.slice(n + GHOST)}</span>
    </>
  )
}

/* --------------------------------------------------------------------- hud */

export function Hud() {
  const phase = useStore((s) => s.phase)
  const caption = useStore((s) => s.caption)
  const turns = useStore((s) => s.turns)
  const activeTool = useStore((s) => s.activeTool)
  const connected = useStore((s) => s.connected)
  const error = useStore((s) => s.error)
  const level = useStore((s) => s.level)
  const voice = useStore((s) => s.voice)
  const bootNote = useStore((s) => s.bootNote)
  const gestures = useStore((s) => s.gestures)
  const looking = useStore((s) => s.looking)
  const ui = useStore((s) => s.ui)

  // accentFor folds JARVIS's overrides in over the phase colour, so one
  // variable on the root carries a theme change into every .hud-* rule without
  // a single component knowing a theme exists.
  const colour = accentFor(phase, ui)

  useEffect(() => {
    // The ground has to be set on the document, not painted here: the HUD sits
    // above the 3D scene, so a background drawn inside it would cover the
    // reactor rather than sit behind it. --bg is what html, body, #root and the
    // boot screen all pin themselves to.
    const root = document.documentElement
    if (ui.background) root.style.setProperty('--bg', ui.background)
    else root.style.removeProperty('--bg')
  }, [ui.background])

  return (
    <div className="hud" style={{ ['--accent' as string]: colour }}>
      {/* First in the tree on purpose. Everything after it is positioned with
          `z-index: auto`, so paint order is document order and the sweep stays
          behind the transcript and the panels without a z-index war. */}
      <BladeSweep />

      <Corner at="tl" />
      <Corner at="tr" />
      <Corner at="bl" />
      <Corner at="br" />

      <header className="hud-top">
        {ui.chrome.brand && (
          <div className="brand">
            <span className="brand-mark">M.I.L.O.S.</span>
            <span className="brand-sub">Asistente Personal Autónomo</span>
          </div>
        )}

        <div className="status">
          <span className="dot" />
          <span className="status-text">
            {/* bootNote is the voice-model download readout. */}
            {phase === 'boot' && bootNote ? bootNote : statusText[phase]}
          </span>
        </div>
      </header>

      {/* Constelación de herramientas (solo en fase "tooling") y columnas de datos en los bordes */}
      {phase !== 'offline' && (
        <div className="central-orb-layer" style={{ zIndex: 2, pointerEvents: 'none' }}>
          <UniverseGlobe />
          <ToolConstellation />
        </div>
      )}
      <CodeColumns />

      {/* Orbe de pensamiento interactivo centrado en el reactor principal */}
      {phase !== 'offline' && (
        <div className="central-orb-layer">
          <ThinkingOrbView size={300} onClick={() => window.dispatchEvent(new CustomEvent('jarvis:wake'))} />
        </div>
      )}

      {/* Left rail: which integrations are live */}
      {ui.chrome.systems && (
        <aside className="rail rail-left">
          <div className="rail-title">SYSTEMS</div>
          {connected.length === 0 && <div className="rail-item dim">none linked</div>}
          {connected.map((c) => (
            <div key={c} className="rail-item">
              <span className="tick" />
              {c}
            </div>
          ))}
          <div className="rail-item">
            <span className="tick" />
            Web
          </div>
        </aside>
      )}

      {/* Señal de voz: caja pequeña abajo a la derecha */}
      <aside className="signal-box" aria-label="Señal de voz">
        <div className="signal-title">Señal de voz</div>
        <div className="signal-bars">
          {SIGNAL_K.map((k, i) => (
            <i key={i} style={{ transform: `scaleY(${(0.12 + level * 0.88 * k).toFixed(2)})` }} />
          ))}
        </div>
      </aside>

      <AnimatePresence>
        {activeTool && ui.chrome.toolBadge && (
          <motion.div
            className="tool-badge"
            // Anchored to the TOP of the frame, not the middle. The old home was
            // viewport-centre plus a fixed drop, which on a tall or square
            // window landed the headline straight on top of the bottom
            // transcript — two elements pinned to different edges of the screen
            // were always going to meet somewhere. Up here it sits in its own
            // band with the rest of the status chrome and can never collide with
            // the log. Framer owns `transform` on an animated element, so the
            // centring (x: -50%) lives in these props, not the stylesheet.
            initial={{ opacity: 0, x: '-50%', y: -8, filter: 'blur(6px)' }}
            animate={{ opacity: 1, x: '-50%', y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, x: '-50%', y: -8, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          >
            <span className="tool-kicker">
              <span className="spinner" />
              accessing
            </span>
            <span className="tool-name">{activeTool.replace(/[_-]/g, ' ')}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation log — last few turns, fading upward */}
      {ui.chrome.transcript && (
        <div className="log">
          <AnimatePresence initial={false}>
            {turns.slice(-4).map((t) => (
              <motion.div
                key={t.id}
                className={`log-line log-${t.role}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              >
                <span className="log-who">{t.role === 'user' ? 'YOU' : 'JARVIS'}</span>
                {/* Only his half decodes. What the user said was never
                    transmitted from anywhere — dressing it up as machine
                    output would be a lie about where the words came from. */}
                <span className="log-text">
                  {t.role === 'jarvis' ? <DecodeText text={t.text} /> : t.text}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {caption && (
          <motion.div
            className="caption"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {caption}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The one surface. Panels used to sit alongside this as a second place
          for things to appear, which meant two places to look and a decision
          the model had to make on grounds it could not know. Everything renders
          here now; Panels.tsx is unmounted rather than deleted so the design
          system it documents stays findable. */}
      <Blades />

      {ui.chrome.suggestions && <Suggestions />}

      {error && <div className="error">{error}</div>}

      {/* Barra de control manual y entrada de texto */}
      {phase !== 'offline' && phase !== 'boot' && (
        <div className="manual-control-bar">
          <button
            type="button"
            className="hud-btn-wake"
            onClick={() => window.dispatchEvent(new CustomEvent('jarvis:wake'))}
            title="Activar Jarvis manualmente sin micrófono"
          >
            <span className="wake-pulse-dot" />
            HEY MILOS
          </button>

          <button
            type="button"
            className="hud-btn-wake"
            onClick={() => window.dispatchEvent(new CustomEvent('jarvis:toggle-pa'))}
            title="Abrir panel del asistente personal"
          >
            🧠 ASISTENTE
          </button>

          <button
            type="button"
            className={`hud-btn-wake ${gestures ? 'camera-active' : ''}`}
            onClick={() => window.dispatchEvent(new CustomEvent('jarvis:toggle-camera'))}
            title="Activar o pausar la cámara y el reconocimiento de gestos"
            style={{
              borderColor: gestures ? 'rgba(0, 240, 255, 0.8)' : 'rgba(255, 255, 255, 0.2)',
              color: gestures ? '#00f0ff' : 'rgba(255, 255, 255, 0.6)',
            }}
          >
            📷 {gestures ? 'CÁMARA & GESTOS: ACTIVO' : 'ACTIVAR CÁMARA'}
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.currentTarget
              const input = form.elements.namedItem('command') as HTMLInputElement
              const val = input?.value?.trim()
              if (val) {
                window.dispatchEvent(new CustomEvent('jarvis:send', { detail: val }))
                input.value = ''
              }
            }}
            className="manual-input-form"
          >
            <input
              name="command"
              type="text"
              placeholder="Escribe una orden o pregunta a Milos... (Presiona Enter)"
              className="manual-input-field"
              autoComplete="off"
            />
            <button type="submit" className="hud-btn-send">
              ENVIAR
            </button>
          </form>
        </div>
      )}

      <footer className="hud-bottom">
        <span className="hint">
          di <b>“milos”</b> · <kbd>Espacio</kbd> o escribir arriba · <kbd>G</kbd> cámara & gestos
          {voice && (
            <>
              {' · '}
              <kbd>V</kbd> voz: {voice.replace(/\(.*?\)/g, '').trim()}
            </>
          )}
        </span>
      </footer>

      {/* Last, so a flash or a tear reads as being on the glass rather than
          underneath the chrome. It is pointer-events: none and unmounts the
          instant it finishes. */}
      <Effects />

      {/* Above even the effects: the reticle shows where a press will land, and
          a press that lands under a flourish is a press you cannot aim. */}
      <Pointer />
      {(gestures || looking) && (
        <div className="hands-live">
          {looking ? `ANALIZANDO — ${looking.toUpperCase()}` : 'CÁMARA Y GESTOS ACTIVOS · TECLA G PARA PAUSAR'}
        </div>
      )}
    </div>
  )
}
