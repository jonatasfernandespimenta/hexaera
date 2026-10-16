import { hiddenHexes, type State } from './core/game'
import { parse, toWorld, type Hex } from './core/hex'

const FILL: Record<string, string> = {
  plains: '#7cbc3a', forest: '#3f8a2a', mountain: '#9a9a90', river: '#2f80d6', center: '#c8432c',
}

// Minimapa em pergaminho: revelados coloridos, ocultos em carvão.
export function Minimap({ state }: { state: State }) {
  const hexes: [Hex, string][] = [
    ...Object.entries(state.tiles).map(([k, t]) => [parse(k), FILL[t.terrain]] as [Hex, string]),
    ...hiddenHexes(state).map(h => [h, '#2c2c30'] as [Hex, string]),
  ]
  const pts = hexes.map(([h]) => toWorld(h))
  const ext = Math.max(3, ...pts.map(([x, z]) => Math.max(Math.abs(x), Math.abs(z)))) + 1.2
  const corner = (i: number) => {
    const a = (Math.PI / 3) * i + Math.PI / 6
    return `${Math.cos(a) * 0.95},${Math.sin(a) * 0.95}`
  }
  const shape = [0, 1, 2, 3, 4, 5].map(corner).join(' ')
  return (
    <div className="minimap">
      <svg viewBox={`${-ext} ${-ext} ${ext * 2} ${ext * 2}`}>
        {hexes.map(([h, c], i) => {
          const [x, z] = toWorld(h)
          return <polygon key={i} points={shape} transform={`translate(${x} ${z})`} fill={c} stroke="#3a2412" strokeWidth={0.08} />
        })}
        {state.invaders.map(inv => {
          const [x, z] = toWorld(parse(inv.at))
          return <circle key={inv.id} cx={x} cy={z} r={0.35} fill="#ff3a2a" stroke="#fff" strokeWidth={0.08} />
        })}
      </svg>
    </div>
  )
}
