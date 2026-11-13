import { Component, type ReactNode } from 'react'
import { ThinkingOrb } from 'thinking-orbs'
import { useStore, type Phase } from '../store'

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
        className="relative flex items-center justify-center rounded-full cursor-pointer transition-all duration-700 hover:scale-105"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          background: isLive
            ? 'radial-gradient(circle, rgba(0, 240, 255, 0.16) 0%, rgba(138, 43, 226, 0.08) 50%, rgba(0, 0, 0, 0) 75%)'
            : 'radial-gradient(circle, rgba(0, 229, 255, 0.08) 0%, rgba(0, 0, 0, 0) 70%)',
          boxShadow: isLive
            ? '0 0 45px rgba(0, 240, 255, 0.35), inset 0 0 25px rgba(0, 240, 255, 0.15)'
            : '0 0 20px rgba(0, 229, 255, 0.1)',
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
          <ThinkingOrb state={orbState} size={64} theme="dark" speed={1.2} />
        </div>
      </div>
    </OrbErrorBoundary>
  )
}
