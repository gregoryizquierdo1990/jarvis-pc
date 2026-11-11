import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useStore } from '../store'

const IMAGES = ['/robot%201.jpeg', '/robot2.jpeg', '/robot3.jpeg', '/robot%204.jpeg']

// Mapeo de expresión por fase (ajusta los índices a tus imágenes si lo deseas)
const EXPR: Record<string, number> = {
  offline: 0,
  boot: 0,
  dormant: 0,
  waking: 1,
  listening: 1,
  thinking: 2,
  tooling: 2,
  speaking: 3,
}

/**
 * Avatar holográfico del robot: cambia de expresión según la fase,
 * con flotación, pulso de brillo y efecto holográfico.
 */
export function RobotAvatar() {
  const phase = useStore((s) => s.phase)
  const level = useStore((s) => s.level)
  const [manual, setManual] = useState<number | null>(null)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    setManual(null)
  }, [phase])

  const idx = manual ?? (EXPR[phase] ?? 0)

  const speaking = phase === 'speaking'
  const listening = phase === 'listening'
  const thinking = phase === 'thinking' || phase === 'tooling'

  return (
    <motion.div
      className="robot-avatar"
      style={{
        position: 'fixed',
        right: 24,
        bottom: 120,
        zIndex: 60,
        width: 260,
        height: 260,
        pointerEvents: 'auto',
        cursor: 'pointer',
      }}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      onClick={() => setManual((m) => (m === null ? (EXPR[phase] ?? 0) + 1 : (m + 1) % IMAGES.length) % IMAGES.length)}
      animate={{
        y: [0, -14, 0],
        rotate: hover ? [0, 6, -6, 0] : [0, 1.5, -1.5, 0],
        scale: speaking ? 1 + level * 0.08 : thinking ? 1.04 : 1,
      }}
      transition={{
        y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
        rotate: { duration: hover ? 0.6 : 4.5, repeat: Infinity, ease: 'easeInOut' },
        scale: { duration: 0.25 },
      }}
    >
      {/* halo */}
      <motion.div
        style={{
          position: 'absolute',
          inset: -24,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(0,240,255,0.35) 0%, rgba(120,80,255,0.18) 40%, transparent 70%)',
          filter: 'blur(18px)',
          zIndex: -1,
        }}
        animate={{ opacity: speaking ? 0.9 : listening ? 0.75 : 0.5, scale: speaking ? 1.15 : 1 }}
        transition={{ duration: 0.4 }}
      />
      {/* imagen */}
      <motion.img
        src={IMAGES[idx]}
        alt="Robot"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 18px rgba(0,240,255,0.55)) drop-shadow(0 0 36px rgba(120,80,255,0.35))',
          borderRadius: 12,
        }}
        animate={{
          filter: speaking
            ? 'drop-shadow(0 0 28px rgba(0,240,255,0.9)) drop-shadow(0 0 50px rgba(120,80,255,0.6))'
            : 'drop-shadow(0 0 18px rgba(0,240,255,0.55)) drop-shadow(0 0 36px rgba(120,80,255,0.35))',
        }}
        transition={{ duration: 0.3 }}
      />
      {/* scanlines holográficas */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'repeating-linear-gradient(0deg, rgba(0,240,255,0.12) 0px, rgba(0,240,255,0.12) 1px, transparent 1px, transparent 3px)',
          mixBlendMode: 'overlay',
          borderRadius: 12,
        }}
      />
      {/* etiqueta */}
      <div
        style={{
          position: 'absolute',
          bottom: -18,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 10,
          letterSpacing: '0.15em',
          color: '#00f0ff',
          textShadow: '0 0 8px #00f0ff',
          fontFamily: 'JetBrains Mono, monospace',
          whiteSpace: 'nowrap',
        }}
      >
        MILOS · {phase.toUpperCase()}
      </div>
    </motion.div>
  )
}
