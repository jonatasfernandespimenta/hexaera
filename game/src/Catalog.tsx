import { Html, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Vox, VOX_NAMES } from './scene/vox'

// Dev: /?catalog=filtro mostra os modelos do pack em grade, com o nome.
export function Catalog({ filter }: { filter: string }) {
  const terms = filter.toLowerCase().split('|')
  const names = VOX_NAMES.filter(n => terms.some(t => n.toLowerCase().includes(t))).slice(0, 24)
  const cols = 6
  return (
    <Canvas camera={{ position: [0, 5, 9], fov: 50 }}>
      <color attach="background" args={['#3a2a1a']} />
      <ambientLight intensity={1} />
      <directionalLight position={[5, 10, 5]} intensity={2} />
      <OrbitControls />
      {names.map((n, i) => {
        const x = (i % cols - cols / 2 + 0.5) * 2.6, z = (Math.floor(i / cols) - 1.5) * 2.6
        return (
          <group key={n} position={[x, 0, z]}>
            <Vox name={n} s={1.6} />
            <Html center position={[0, -0.15, 1.1]} style={{ font: '10px monospace', color: '#fff', whiteSpace: 'nowrap', background: '#0008', padding: 1 }}>{n.replace(/^(Decoration|Vegetation) - /, '')}</Html>
          </group>
        )
      })}
    </Canvas>
  )
}
