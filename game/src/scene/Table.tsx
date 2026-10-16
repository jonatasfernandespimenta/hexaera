import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, type PointLight } from 'three'

// Mesa de madeira + props decorativos (ver vault: Direção Visual → Mesa e ambiente).
// ponytail: props em posições fixas; o mapa infinito pode crescer por cima deles — afastar/ocultar quando incomodar.

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new CanvasTexture(c)
  t.magFilter = NearestFilter
  t.minFilter = NearestFilter
  t.generateMipmaps = false
  t.colorSpace = SRGBColorSpace
  return t
}

// Tábuas com veios, em baixa resolução para ler como pixel art.
function woodTexture() {
  const t = canvasTex(128, 128, g => {
    let seed = 7
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const planks = ['#5a3220', '#52301e', '#5e3622', '#56331f']
    for (let i = 0; i < 8; i++) {
      g.fillStyle = planks[i % planks.length]
      g.fillRect(0, i * 16, 128, 16)
      for (let k = 0; k < 22; k++) {
        g.fillStyle = r() > 0.5 ? '#4a2818' : '#663c26'
        g.fillRect(Math.floor(r() * 128), i * 16 + 2 + Math.floor(r() * 12), 6 + Math.floor(r() * 20), 1)
      }
      g.fillStyle = '#2a160c'
      g.fillRect(0, i * 16 + 15, 128, 1)
      g.fillRect(Math.floor(r() * 128), i * 16, 1, 15)
    }
  })
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(14, 14)
  return t
}

const emojiTex = (e: string, bg: string) =>
  canvasTex(64, 64, g => {
    g.fillStyle = bg
    g.fillRect(0, 0, 64, 64)
    g.font = '40px serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(e, 32, 36)
  })

function Die({ p, rot, faces }: { p: [number, number, number]; rot: [number, number, number]; faces: string[] }) {
  const mats = useMemo(() => faces.map(f => emojiTex(f, '#efe4cc')), [faces])
  return (
    <mesh position={p} rotation={rot} castShadow>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      {mats.map((m, i) => <meshStandardMaterial key={i} attach={`material-${i}`} map={m} />)}
    </mesh>
  )
}

function Meeple({ p, c, ry = 0, lying = false }: { p: [number, number, number]; c: string; ry?: number; lying?: boolean }) {
  return (
    <group position={p} rotation={[lying ? Math.PI / 2 : 0, ry, 0]}>
      <mesh position={[0, 0.12, 0]} castShadow><boxGeometry args={[0.22, 0.24, 0.1]} /><meshStandardMaterial color={c} /></mesh>
      <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.12, 0.12, 0.1]} /><meshStandardMaterial color={c} /></mesh>
      <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.36, 0.08, 0.1]} /><meshStandardMaterial color={c} /></mesh>
    </group>
  )
}

function Coin({ p, c, icon }: { p: [number, number, number]; c: string; icon: string }) {
  const top = useMemo(() => emojiTex(icon, c), [icon, c])
  return (
    <mesh position={p} castShadow>
      <cylinderGeometry args={[0.3, 0.3, 0.08, 16]} />
      <meshStandardMaterial attach="material-0" color={c} />
      <meshStandardMaterial attach="material-1" map={top} />
      <meshStandardMaterial attach="material-2" color={c} />
    </mesh>
  )
}

function Lantern() {
  const light = useRef<PointLight>(null)
  useFrame(({ clock }) => {
    if (light.current) light.current.intensity = 18 + Math.sin(clock.elapsedTime * 9) * 1.5
  })
  return (
    <group position={[-11, 0, -7]}>
      <mesh position={[0, 0.1, 0]} castShadow><boxGeometry args={[0.9, 0.2, 0.9]} /><meshStandardMaterial color="#3a2a1a" /></mesh>
      <mesh position={[0, 0.8, 0]}><boxGeometry args={[0.6, 1.1, 0.6]} /><meshStandardMaterial color="#ffcf7a" emissive="#ff9a2a" emissiveIntensity={2} /></mesh>
      <mesh position={[0, 1.45, 0]}><boxGeometry args={[0.9, 0.18, 0.9]} /><meshStandardMaterial color="#3a2a1a" /></mesh>
      <pointLight ref={light} position={[0, 1.2, 0]} color="#ffae5a" distance={22} decay={1.4} />
    </group>
  )
}

export function Table() {
  const wood = useMemo(woodTexture, [])
  const blues = Array.from({ length: 9 }, (_, i) => [-0.45 + (i % 3) * 0.45, 0.15, -0.35 + Math.floor(i / 3) * 0.35] as const)
  return (
    <>
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[80, 1, 80]} />
        <meshStandardMaterial map={wood} roughness={0.85} />
      </mesh>
      <Lantern />

      {/* bandeja com meeples azuis */}
      <group position={[-9.5, 0, 5.5]} rotation={[0, 0.3, 0]}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow><boxGeometry args={[2, 0.2, 1.5]} /><meshStandardMaterial color="#4a2c16" /></mesh>
        {blues.map((p, i) => <Meeple key={i} p={[p[0], 0.2, p[2]]} c="#2a5ad8" ry={i * 0.4} />)}
      </group>
      <Meeple p={[-8.5, 0, 2.5]} c="#c8302a" ry={0.6} />
      <Meeple p={[-7.9, 0, 3.1]} c="#c8302a" ry={-0.4} />
      <Meeple p={[-8.2, 0.05, 3.9]} c="#c8302a" lying />
      <Meeple p={[9.3, 0, 3.4]} c="#c8302a" ry={0.8} />

      {/* moedas */}
      <Coin p={[-7, 0.04, 6.4]} c="#e0b13a" icon="👑" />
      <Coin p={[-6.4, 0.04, 7.1]} c="#e0b13a" icon="🛖" />
      <Coin p={[-7.4, 0.04, 7.6]} c="#9a9aa0" icon="🪨" />

      {/* dados com ícones de recurso */}
      <Die p={[9, 0.25, 6]} rot={[0, 0.5, 0]} faces={['🪵', '🍖', '🪨', '💰', '😊', '📚']} />
      <Die p={[10, 0.25, 5.2]} rot={[0, -0.3, 0]} faces={['💰', '🪨', '🍖', '🪵', '📚', '😊']} />
      <Die p={[9.6, 0.25, 7.1]} rot={[0, 1.1, 0]} faces={['🪨', '😊', '🪵', '🍖', '💰', '📚']} />

      {/* baralho virado */}
      <group position={[-9, 0, 9]} rotation={[0, -0.2, 0]}>
        {[0, 1, 2, 3, 4].map(i => (
          <mesh key={i} position={[0, 0.03 + i * 0.04, 0]} castShadow>
            <boxGeometry args={[1.4, 0.035, 2]} />
            <meshStandardMaterial color={i % 2 ? '#3a2614' : '#4a3018'} />
          </mesh>
        ))}
      </group>

      {/* saquinho de pano */}
      <mesh position={[11, 0.45, 1.5]} castShadow>
        <sphereGeometry args={[0.8, 8, 6]} />
        <meshStandardMaterial color="#a08a62" flatShading />
      </mesh>
    </>
  )
}
