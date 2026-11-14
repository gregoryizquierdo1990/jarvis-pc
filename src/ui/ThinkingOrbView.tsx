import { Component, type ReactNode } from 'react'
import { ThinkingOrb } from 'thinking-orbs'
import { useStore, accentFor, type Phase } from '../store'

class OrbErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: any) {
    console.warn('[ThinkingOrb] Fallback render due to:', error)
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

function mapPhaseToOrbState(phase: Phase, activeTool: string | null) {
  if (phase === 'offline') return 'shaping'
  if (phase === 'boot') return 'connecting'
  if (phase === 'dormant') return 'breathing'
  if (phase === 'listening') return 'listening'
  if (phase === 'thinking') return 'solving'
  if (phase === 'tooling') {
    if (activeTool && (activeTool.includes('search') || activeTool.includes('recall') || activeTool.includes('obsidian_search'))) {
      return 'searching'
    }
    return 'working'
  }
  if (phase === 'speaking') return 'composing'
  return 'breathing'
}

export function ThinkingOrbView({
  size = 280,
  onClick,
}: {
  size?: number
  onClick?: () => void
}) {
  const phase = useStore((s) => s.phase)
  const activeTool = useStore((s) => s.activeTool)
  const ui = useStore((s) => s.ui)
  // Nivel de voz en pasos de 0.25: el store lo actualiza cada frame y no hace
  // falta re-renderizar el orbe a 60 fps para que reaccione.
  const level = useStore((s) => Math.round(s.level * 4) / 4)
  // El mismo color que usan el reactor 3D y los carriles del HUD, así el orbe
  // cambia con la fase (cian en espera, ámbar pensando, violeta con
  // herramientas, verde hablando) y respeta los temas que Milos aplique.
  const accent = accentFor(phase, ui)
  const glow = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, transparent)`
  const orbState = mapPhaseToOrbState(phase, activeTool)

  const isLive = phase === 'listening' || phase === 'speaking' || phase === 'thinking' || phase === 'tooling'
  // ThinkingOrb solo acepta de forma nativa size 64 | 32 | 20 en sus presets internos.
  // Para escalarlo limpiamente a 280-320px en el centro de la pantalla usamos transform scale.
  const scale = size / 64

  return (
    <OrbErrorBoundary
      fallback={
        <div
          onClick={onClick}
          className="relative flex items-center justify-center rounded-full cursor-pointer"
          style={{
            width: `${size}px`,
            height: `${size}px`,
            background: 'radial-gradient(circle, rgba(0, 240, 255, 0.25) 0%, rgba(0, 0, 0, 0) 70%)',
            border: '2px solid rgba(0, 240, 255, 0.4)',
            boxShadow: '0 0 30px rgba(0, 240, 255, 0.3)',
          }}
        />
      }
    >
      <div
        onClick={onClick}
        title={`Milos: ${phase.toUpperCase()} (${orbState}) — Clic para interactuar`}
        className="relative flex items-center justify-center rounded-full cursor-pointer hover:scale-105"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: isLive
            ? `radial-gradient(circle, ${glow(18 + level * 14)} 0%, ${glow(6)} 55%, rgba(0, 0, 0, 0) 75%)`
            : `radial-gradient(circle, ${glow(9)} 0%, rgba(0, 0, 0, 0) 70%)`,
          boxShadow: isLive
            ? `0 0 ${45 + level * 40}px ${glow(35 + level * 20)}, inset 0 0 25px ${glow(15)}`
            : `0 0 20px ${glow(10)}`,
          transition: 'box-shadow 160ms linear, background 160ms linear',
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ThinkingOrb state={orbState} size={64} theme="dark" color={accent} speed={1.2 + level * 0.8} />
        </div>
      </div>
    </OrbErrorBoundary>
  )
}
