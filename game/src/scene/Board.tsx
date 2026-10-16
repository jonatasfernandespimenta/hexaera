import { Html, OrbitControls } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Color, Object3D, ShaderMaterial, type Group, type MeshStandardMaterial, type InstancedMesh, type PointLight } from 'three'
import { BUILDINGS, HUNT_COST, LINKS, RES, THREATS, TERRAINS, type BuildingId, type Link, type Res } from '../core/data'
import { sfx } from '../sfx'
import { terrainAt, linked, offGrid, canLink, canPlace, centerMax, edgeKey, exploreCost, hiddenHexes, linkCost, staffed, stopped, type State, type Tile } from '../core/game'
import { distance, key, neighbors, parse, toWorld, type Hex } from '../core/hex'
import { Table } from './Table'
import { Vox as V, windTime } from './vox'
import { boxGeo, Shape, Vox, voxMat } from './voxbox'

const H = 0.4 // espessura da peça
const R = 0.97 // raio (deixa uma fresta fina entre as peças)
const SOIL = 0.07 // camada de terra/grama no topo da peça

// Paleta saturada do diorama (ver vault: Direção Visual).
const TOP: Record<string, string> = {
  plains: '#7cbc3a', forest: '#4f962e', mountain: '#7f9a5a', river: '#d8c48a', center: '#b0915a',
}
const GRASS = ['#5f9f2a', '#8fcf48', '#6aac30']
const PINE = ['#1f5a26', '#2a6e2c', '#357f32']

// Elevação por terreno: o tabuleiro tem relevo (montanhas mais altas, rio mais baixo).
const LIFT: Record<string, number> = { plains: 0, center: 0.04, forest: 0.1, mountain: 0.32, river: -0.1 }

// Gerador determinístico por hex, para a decoração não mudar a cada render.
function rng(k: string) {
  let h = 2166136261
  for (const c of k) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296)
}

const liftOf = (k: string, terrain: string) => LIFT[terrain] + (terrain === 'river' ? 0 : rng(k)() * 0.06)

type V3 = [number, number, number]

// Vegetação do pack (MagicaVoxel). k ∈ [0,1) escolhe variante, escala e giro.
function Tree({ x, z, k }: { x: number; z: number; k: number }) {
  return <V name={k < 0.6 ? 'Vegetation - Tree - Skinny - Green' : 'Vegetation - Tree - Skinny - Light Green'} sway="breeze"
    p={[x, H, z]} s={0.75 + ((k * 7) % 1) * 0.45} ry={Math.floor(k * 4) * (Math.PI / 2)} />
}

const GRASS_VOX = ['Vegetation - Grass - Highlight - Variant1', 'Vegetation - Grass - Highlight - Variant2', 'Vegetation - Grass - Highlight - Variant3'] as const
const Tuft = ({ x, z, k }: { x: number; z: number; k: number }) =>
  <V name={GRASS_VOX[Math.floor(k * 3) % 3]} p={[x, H, z]} s={1.2} ry={k * 6} sway="grass" />

const FLOWERS = ['#ffe04a', '#ffffff', '#ff6a5a', '#c08aff']
const Flower = ({ x, z, k }: { x: number; z: number; k: number }) =>
  <Vox p={[x, H + 0.03, z]} s={[0.035, 0.06, 0.035]} c={FLOWERS[Math.floor(k * 4) % 4]} />

const Bush = ({ x, z, k }: { x: number; z: number; k: number }) =>
  <V name={k < 0.5 ? 'Vegetation - Shrub - Fat - Green' : 'Vegetation - Shrub - Fat - Light Green'} p={[x, H, z]} s={1.3} ry={k * 6} sway="breeze" />

const ROCK = ['#7a7e88', '#969aa4', '#62666f', '#aeb2ba']

// Rochedo em degraus de voxel com neve no topo.
// Montanha em voxels: heightmap de cone com ruído, cor por altura (rocha → neve). InstancedMesh = 1 draw call.
const PEAK_COLORS = ['#5e626c', '#7a7e88', '#969aa4', '#aeb2ba', '#e6edf2', '#ffffff']
function Peak({ x, z, h, k }: { x: number; z: number; h: number; k: number }) {
  const ref = useRef<InstancedMesh>(null)
  const cells = useMemo(() => {
    const r = rng(`peak${k}`)
    const out: { p: V3; hh: number; c: string }[] = []
    const u = 0.075, R0 = 0.42
    for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
      const d = Math.hypot(i * u, j * u)
      if (d > R0) continue
      const hh = Math.max(0.04, h * (1 - d / R0) * (0.75 + r() * 0.5))
      const t = hh / h
      const c = t > 0.78 ? PEAK_COLORS[4 + Math.floor(r() * 2)] : PEAK_COLORS[Math.min(3, Math.floor(t * 4 + r() * 1.2))]
      out.push({ p: [i * u, hh / 2, j * u], hh, c })
    }
    return out
  }, [h, k])
  useLayoutEffect(() => {
    const m = ref.current!
    const o = new Object3D(), col = new Color()
    cells.forEach((c, i) => {
      o.position.set(...c.p)
      o.scale.set(1, c.hh / 0.075, 1)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, col.set(c.c))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [cells])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cells.length]} position={[x, H, z]} castShadow receiveShadow>
      <boxGeometry args={[0.075, 0.075, 0.075]} />
      <meshStandardMaterial flatShading />
    </instancedMesh>
  )
}

// Rio: água cobrindo o hex inteiro, shader animado em faixas (pixel art) com espuma na margem.
// Um único material para todos os tiles de rio; o tempo é atualizado uma vez por frame.
const waterMaterial = new ShaderMaterial({
  uniforms: { t: { value: 0 } },
  vertexShader: `
    uniform float t;
    varying vec2 vP;
    varying vec3 vW;
    void main() {
      vP = position.xy;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vW = w.xyz;
      vec3 p = position;
      p.z += sin(w.x * 6.0 + t * 1.6) * sin(w.z * 5.0 - t * 1.3) * 0.012;
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: `
    uniform float t;
    varying vec2 vP;
    varying vec3 vW;
    float hexd(vec2 p) { p = abs(p); return max(p.x, p.x * 0.5 + p.y * 0.8660254); }
    void main() {
      float d = hexd(vP) / 0.8660254; // 1 = borda do hex (raio ~0.95)
      if (d > 0.93) discard;
      vec2 q = floor(vW.xz * 22.0) / 22.0; // pixelado
      float n = sin(q.x * 7.0 + t * 1.4) * sin(q.y * 6.0 - t * 1.1)
              + 0.6 * sin((q.x + q.y) * 11.0 + t * 2.3)
              + 0.35 * sin(q.x * 23.0 - q.y * 17.0 + t * 3.1);
      vec3 deep = vec3(0.09, 0.36, 0.72), mid = vec3(0.16, 0.52, 0.88), lite = vec3(0.45, 0.76, 1.0);
      vec3 c = n < -0.5 ? deep : n < 0.55 ? mid : lite;
      float spark = step(1.35, n + 0.3 * sin(t * 4.0 + q.x * 40.0));
      c = mix(c, vec3(0.92, 0.98, 1.0), spark);
      float foam = step(0.82 + 0.03 * sin(t * 2.0 + q.x * 30.0 + q.y * 20.0), d);
      c = mix(c, vec3(0.86, 0.95, 1.0), foam * 0.85);
      gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
      #include <colorspace_fragment>
    }`,
})

function WaterClock() {
  useFrame(({ clock }) => { waterMaterial.uniforms.t.value = windTime.value = clock.elapsedTime })
  return null
}

function Water() {
  return (
    <mesh position={[0, H + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={waterMaterial} receiveShadow>
      <planeGeometry args={[2, 2, 24, 24]} />
    </mesh>
  )
}


// Espalha pontos dentro do hex, longe do centro (onde fica a construção).
function scatter(r: () => number, n: number, minR: number) {
  const out: [number, number, number][] = []
  for (let i = 0; i < n * 4 && out.length < n; i++) {
    const a = r() * Math.PI * 2, d = minR + r() * (0.72 - minR)
    out.push([Math.cos(a) * d, Math.sin(a) * d, r()])
  }
  return out
}

// Bicho passeando pelo tile: anda numa elipse com ritmo irregular (acelera, quase para), pulinho a cada passo.
// face corrige para onde o modelo "olha" no próprio arquivo.
function Wander({ at, r, speed, seed, face = 0, children }: { at: [number, number]; r: number; speed: number; seed: number; face?: number; children: React.ReactNode }) {
  const g = useRef<Group>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed + seed
    const a = t + Math.sin(t * 1.7) * 0.8 // passo irregular
    const v = 1 + Math.cos(t * 1.7) * 1.36 // velocidade relativa (≈0 = parado bicando)
    g.current!.position.set(at[0] + Math.cos(a) * r, Math.abs(Math.sin(t * 14)) * 0.012 * Math.max(0, v), at[1] + Math.sin(a) * r * 0.7)
    g.current!.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a) * 0.7) + face
  })
  return <group ref={g}>{children}</group>
}

function Terrain({ tile, k }: { tile: Tile; k: string }) {
  const nodes = useMemo(() => {
    const r = rng(k)
    const busy = !!tile.building
    const deco = (n: number, min: number) => scatter(r, n, min)
    const grass = (n: number) => [
      ...deco(n, 0.2).map(([x, z, s], i) => <Tuft key={`t${i}`} x={x} z={z} k={s} />),
      ...deco(3, 0.3).map(([x, z, s], i) => <Flower key={`f${i}`} x={x} z={z} k={s} />),
    ]
    switch (tile.terrain) {
      case 'forest':
        return [
          ...deco(busy ? 9 : 18, busy ? 0.42 : 0.04).map(([x, z, s], i) => <Tree key={i} x={x} z={z} k={s} />),
          ...deco(3, 0.5).map(([x, z, s], i) => <Bush key={`b${i}`} x={x} z={z} k={s} />),
        ]
      case 'mountain':
        return [
          busy
            ? <Peak key="p" x={-0.38} z={-0.2} h={0.5} k={r()} />
            : <Peak key="p" x={-0.05} z={-0.05} h={0.85} k={r()} />,
          busy ? null : <Peak key="q" x={0.32} z={0.22} h={0.5} k={r()} />,
          ...deco(4, 0.45).map(([x, z, s], i) => <Vox key={`r${i}`} p={[x, H + 0.04, z]} s={[0.12, 0.08, 0.1]} c={ROCK[Math.floor(s * 4)]} />),
          ...deco(4, 0.6).map(([x, z, s], i) => <Tree key={`t${i}`} x={x} z={z} k={s} />),
        ]
      case 'river':
        return [
          <Water key="w" />,
          ...deco(5, 0.78).map(([x, z, s], i) => <Vox key={`r${i}`} p={[x, H + 0.03, z]} s={[0.1, 0.07, 0.09]} c={ROCK[Math.floor(s * 4)]} />),
          ...deco(4, 0.74).map(([x, z], i) => <Vox key={`j${i}`} p={[x, H + 0.08, z]} s={[0.025, 0.16, 0.025]} c="#4f7a2a" />),
        ]
      case 'plains':
        return [
          ...grass(busy ? 8 : 14),
          ...deco(busy ? 1 : 3, 0.45).map(([x, z, s], i) =>
            s > 0.5 ? <Bush key={`b${i}`} x={x} z={z} k={s} /> : <Vox key={`r${i}`} p={[x, H + 0.04, z]} s={[0.1, 0.08, 0.09]} c="#9a9a92" />),
        ]
      default:
        return []
    }
  }, [tile.terrain, tile.building, k])
  return <>{nodes}</>
}


function Campfire({ hp, max }: { hp: number; max: number }) {
  const light = useRef<PointLight>(null)
  useFrame(({ clock }) => {
    if (light.current) light.current.intensity = 1.2 + Math.sin(clock.elapsedTime * 13) * 0.25 + Math.sin(clock.elapsedTime * 7) * 0.2
  })
  return (
    <group position={[0, H, 0]}>
      <V name="Fire Ring" s={0.85} />
      <V name="Fire Log" p={[0.32, 0, 0.3]} s={0.7} ry={0.5} />
      <V name="Fire Log" p={[-0.34, 0, 0.22]} s={0.7} ry={-0.7} />
      <V name="Decoration - Bench" p={[-0.3, 0, -0.38]} s={0.6} ry={0.3} />
      <Vox p={[0, 0.12, 0]} s={[0.16, 0.14, 0.16]} c="#ff8a1c" e="#ff6a00" />
      <Vox p={[0, 0.24, 0]} s={[0.08, 0.1, 0.08]} c="#ffd24a" e="#ffb000" />
      {hp < max && (
        <Html zIndexRange={[50, 0]} center position={[0, 0.9, 0]} className="tip bad">🔥 ❤️{hp}/{max}</Html>
      )}
      <pointLight ref={light} position={[0, 0.5, 0]} color="#ff9a40" distance={4} decay={1.5} />
      {/* estandarte do Centro */}
      <Vox p={[0.45, 0.35, -0.3]} s={[0.04, 0.7, 0.04]} c="#5b3a1e" />
      <Vox p={[0.56, 0.58, -0.3]} s={[0.2, 0.24, 0.02]} c="#b8322a" />
      {scatter(rng('center'), 4, 0.5).map(([x, z], i) => (
        <Vox key={i} p={[x, 0.04, z]} s={[0.1, 0.08, 0.1]} c="#8a8f7a" />
      ))}
    </group>
  )
}

const Log = ({ p, rz = 0, l = 0.26 }: { p: V3; rz?: number; l?: number }) =>
  <Shape kind="cyl" p={p} rot={[0, 0, rz]} r0={0.045} h={l} c="#9a6a3a" st={0.02} />

// ---------- peças animadas da Moderna/Contemporânea ----------
// Cavalo-de-pau do poço de petróleo: balança sem parar.
function Pump() {
  const g = useRef<Group>(null)
  useFrame(({ clock }) => { g.current!.rotation.z = Math.sin(clock.elapsedTime * 2) * 0.35 })
  return (
    <>
      <Vox p={[-0.1, 0.18, 0]} s={[0.06, 0.32, 0.06]} c="#3a3a3e" />
      <group ref={g} position={[-0.1, 0.34, 0]}>
        <Vox p={[0, 0, 0]} s={[0.46, 0.05, 0.06]} c="#c8a23a" />
        <Vox p={[-0.24, -0.04, 0]} s={[0.06, 0.12, 0.08]} c="#2a2a2e" />
      </group>
    </>
  )
}

// Turbina eólica: pás girando, cada uma num ritmo.
function Turbine({ x, z, k }: { x: number; z: number; k: number }) {
  const g = useRef<Group>(null)
  useFrame(({ clock }) => { g.current!.rotation.z = clock.elapsedTime * (1.6 + k * 0.4) })
  return (
    <group position={[x, 0, z]}>
      <Vox p={[0, 0.4, 0]} s={[0.04, 0.8, 0.04]} c="#f0f0ea" />
      <Vox p={[0, 0.8, 0.03]} s={[0.06, 0.06, 0.1]} c="#e0e0d8" />
      <group ref={g} position={[0, 0.8, 0.09]}>
        {[0, 1, 2].map(i => (
          <group key={i} rotation={[0, 0, (i * Math.PI * 2) / 3]}>
            <Vox p={[0, 0.17, 0]} s={[0.04, 0.32, 0.01]} c="#ffffff" />
          </group>
        ))}
      </group>
    </group>
  )
}

// Carrinho de 3 blocos.
const Car = ({ x, z, c }: { x: number; z: number; c: string }) => (
  <>
    <Vox p={[x, 0.04, z]} s={[0.16, 0.05, 0.08]} c={c} />
    <Vox p={[x - 0.01, 0.08, z]} s={[0.08, 0.04, 0.07]} c="#9fd0f0" />
  </>
)

// Braço robótico da fábrica automatizada.
function Arm() {
  const g = useRef<Group>(null)
  useFrame(({ clock }) => { g.current!.rotation.y = Math.sin(clock.elapsedTime * 1.3) * 1.2 })
  return (
    <group position={[0.36, 0, 0.34]}>
      <Vox p={[0, 0.04, 0]} s={[0.1, 0.08, 0.1]} c="#3a3a3e" />
      <group ref={g} position={[0, 0.08, 0]}>
        <Vox p={[0, 0.1, 0]} s={[0.04, 0.2, 0.04]} c="#f0a020" />
        <Vox p={[0.07, 0.2, 0]} s={[0.16, 0.04, 0.04]} c="#f0a020" />
      </group>
    </group>
  )
}

function Model({ id }: { id: BuildingId }) {
  switch (id) {
    case 'hut':
      return (
        <>
          <V name="Resource - Wood - Log" p={[0.32, 0, 0.3]} s={0.7} ry={0.3} />
          <Vox p={[0, 0.13, 0]} s={[0.38, 0.26, 0.3]} c="#e6d3a8" />
          {[-0.18, 0.18].map(x => <Vox key={x} p={[x, 0.13, 0]} s={[0.04, 0.26, 0.32]} c="#7a5030" />)}
          <Vox p={[0, 0.02, 0]} s={[0.42, 0.04, 0.34]} c="#8a8f7a" />
          {[0, 1, 2, 3].map(i => <Vox key={i} p={[0, 0.29 + i * 0.05, 0]} s={[0.46 - i * 0.02, 0.05, 0.38 - i * 0.1]} c={i % 2 ? '#b8402c' : '#c8502e'} />)}
          <Vox p={[0.12, 0.42, -0.06]} s={[0.07, 0.16, 0.07]} c="#8a8a86" />
          <Vox p={[0, 0.09, 0.151]} s={[0.08, 0.16, 0.01]} c="#5a3418" />
          <Vox p={[0.11, 0.16, 0.151]} s={[0.07, 0.07, 0.01]} c="#ffcf6a" e="#ff9a2a" />
        </>
      )
    case 'farm':
      return (
        <>
          <V name="Vegetation - Crop - Bail" p={[0.4, 0, -0.38]} s={0.8} ry={0.4} />
          <Wander at={[-0.4, 0.3]} r={0.1} speed={0.6} seed={1}><V name="NPC - Chicken" s={0.5} /></Wander>
          {[[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].map(([x, z], i) => (
            <V key={i} name={i % 2 ? 'Vegetation - Crop - Wheat - Variant1' : 'Vegetation - Crop - Wheat - Variant2'} p={[x, 0, z]} s={0.95} sway="grass" />
          ))}
          <V name="Decoration - Fence Straight" p={[0, 0, 0.44]} s={0.95} />
          <V name="Decoration - Fence Straight" p={[0, 0, -0.44]} s={0.95} />
        </>
      )
    case 'lumber':
      return (
        <>
          <V name="Resource - Wood - Stump - Variant1" p={[-0.32, 0, 0.25]} s={0.8} />
          <V name="Resource - Wood - Log" p={[-0.3, 0, -0.3]} s={0.9} ry={1.2} />
          <Vox p={[0, 0.1, 0]} s={[0.3, 0.2, 0.24]} c="#7a5530" />
          <Vox p={[0, 0.23, 0]} s={[0.34, 0.06, 0.28]} c="#5b3a1e" />
          <Log p={[0.32, 0.04, -0.08]} rz={Math.PI / 2} />
          <Log p={[0.32, 0.04, 0.01]} rz={Math.PI / 2} />
          <Log p={[0.32, 0.11, -0.035]} rz={Math.PI / 2} />
        </>
      )
    case 'quarry':
      return (
        <>
          <V name="Resource - Stone - Variant4" p={[-0.32, 0, -0.25]} s={1.6} />
          <V name="Decoration - Box - Dirt" p={[0.3, 0, 0.3]} s={0.9} />
          <Vox p={[-0.15, 0.08, 0.1]} s={[0.2, 0.16, 0.2]} c="#b9b9b0" />
          <Vox p={[0.1, 0.06, 0.15]} s={[0.16, 0.12, 0.16]} c="#a3a39a" />
          <Vox p={[-0.02, 0.2, 0.1]} s={[0.14, 0.1, 0.14]} c="#c9c9c0" />
          <Vox p={[0.25, 0.15, -0.05]} s={[0.03, 0.3, 0.03]} c="#6b4a2a" />
          <Vox p={[0.25, 0.3, -0.05]} s={[0.14, 0.04, 0.04]} c="#555" />
        </>
      )
    case 'fisher':
      return (
        <>
          <V name="Decoration - Barrel" p={[-0.3, 0, -0.32]} s={0.8} />
          <Vox p={[0, 0.03, 0.25]} s={[0.18, 0.04, 0.5]} c="#8b6a40" />
          <Vox p={[0.25, 0.04, -0.15]} s={[0.24, 0.08, 0.12]} c="#6b4526" />
          <Vox p={[0.25, 0.16, -0.15]} s={[0.02, 0.18, 0.02]} c="#5b3a1e" />
          <Vox p={[0.29, 0.17, -0.15]} s={[0.06, 0.12, 0.01]} c="#f1ead8" />
        </>
      )
    case 'claypit':
      return (
        <>
          <V name="Decoration - Bucket" p={[-0.3, 0, 0.3]} s={1.2} />
          <Vox p={[-0.15, 0.02, 0]} s={[0.28, 0.04, 0.24]} c="#8a4a2e" />
          <Vox p={[0.18, 0.02, 0.12]} s={[0.2, 0.04, 0.18]} c="#9a5634" />
          <Vox p={[0.2, 0.08, -0.2]} s={[0.14, 0.12, 0.12]} c="#b0643a" />
        </>
      )
    case 'kiln':
      return (
        <>
          <V name="Decoration - Desert - Urn - Variant1" p={[0.32, 0, 0.3]} s={0.55} />
          <V name="Decoration - Desert - Urn - Variant4" p={[-0.35, 0, -0.28]} s={0.5} />
          <Vox p={[0, 0.12, 0]} s={[0.34, 0.24, 0.34]} c="#a0522d" />
          <Vox p={[0, 0.3, 0]} s={[0.22, 0.12, 0.22]} c="#8b4513" />
          <Vox p={[0, 0.08, 0.171]} s={[0.1, 0.1, 0.01]} c="#ff7a1a" e="#ff5a00" />
          <Vox p={[0.05, 0.48, 0]} s={[0.08, 0.08, 0.08]} c="#9a9a9a" />
          <Vox p={[0.1, 0.6, 0.02]} s={[0.06, 0.06, 0.06]} c="#b5b5b5" />
          {[-0.3, -0.22].map(x => <Vox key={x} p={[x, 0.05, 0.25]} s={[0.06, 0.1, 0.06]} c="#c8763e" />)}
        </>
      )
    case 'elder':
      return (
        <>
          <V name="Decoration - Bookshelf - Scroll - Variant1" p={[-0.3, 0, 0.3]} s={1} />
          <Shape kind="cone" p={[0, 0.2, 0]} r={0.3} h={0.4} c="#d8c7a0" />
          <Vox p={[0.32, 0.25, 0]} s={[0.03, 0.5, 0.03]} c="#5b3a1e" />
          <Vox p={[0.39, 0.42, 0]} s={[0.12, 0.14, 0.02]} c="#6a3fa0" />
        </>
      )
    case 'totem':
      return <V name="Goblin Idol" s={0.9} />
    case 'tower':
      return (
        <>
          {[[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].map(([x, z]) => (
            <Vox key={`${x}${z}`} p={[x, 0.25, z]} s={[0.04, 0.5, 0.04]} c="#6b4526" />
          ))}
          <Vox p={[0, 0.5, 0]} s={[0.3, 0.05, 0.3]} c="#8b6a40" />
          <Shape kind="cone" square p={[0, 0.65, 0]} r={0.2} h={0.2} c="#7a3a22" st={0.025} />
        </>
      )
    case 'house':
      return (
        <>
          <V name="Decoration - Barrel" p={[0.36, 0, 0.32]} s={0.6} />
          <V name="Decoration - Box - Variant2" p={[-0.36, 0, 0.3]} s={0.8} />
          <group scale={1.25}>
            <Vox p={[0, 0.13, 0]} s={[0.38, 0.26, 0.3]} c="#e6d3a8" />
            {[-0.18, 0.18].map(x => <Vox key={x} p={[x, 0.13, 0]} s={[0.04, 0.26, 0.32]} c="#7a5030" />)}
            <Vox p={[0, 0.02, 0]} s={[0.42, 0.04, 0.34]} c="#8a8f7a" />
            {[0, 1, 2, 3].map(i => <Vox key={i} p={[0, 0.29 + i * 0.05, 0]} s={[0.46 - i * 0.02, 0.05, 0.38 - i * 0.1]} c={i % 2 ? '#b8402c' : '#c8502e'} />)}
            <Vox p={[0.12, 0.42, -0.06]} s={[0.07, 0.16, 0.07]} c="#8a8a86" />
            <Vox p={[0, 0.09, 0.151]} s={[0.08, 0.16, 0.01]} c="#5a3418" />
            <Vox p={[0.11, 0.16, 0.151]} s={[0.07, 0.07, 0.01]} c="#ffcf6a" e="#ff9a2a" />
          </group>
        </>
      )
    case 'field':
      return (
        <>
          <V name="Vegetation - Crop - Bail" p={[-0.38, 0, -0.36]} s={0.8} />
          <V name="Transport - Waggon" p={[0.42, 0, 0.3]} s={0.55} ry={0.6} />
          {[-0.4, -0.2, 0, 0.2, 0.4].flatMap(z => [-0.3, -0.1, 0.1, 0.3].filter(x => Math.abs(x) < 0.5 - Math.abs(z) / 1.5).map(x =>
            <V key={`${x}${z}`} name={(x + z) * 10 % 2 ? 'Vegetation - Crop - Wheat - Variant3' : 'Vegetation - Crop - Wheat - Variant4'} p={[x, 0, z]} s={0.7} sway="grass" />))}
          {[-0.3, -0.1, 0.1, 0.3].map(z => <Vox key={z} p={[0, 0.02, z]} s={[0.8 - Math.abs(z), 0.04, 0.06]} c="#6a4a2a" />)}
          <Vox p={[0.35, 0.14, -0.35]} s={[0.24, 0.28, 0.2]} c="#c88a5a" />
          <Vox p={[0.35, 0.3, -0.35]} s={[0.28, 0.05, 0.24]} c="#8a4a2a" />
        </>
      )
    case 'manor':
      return (
        <>
          {[-0.4, -0.2, 0, 0.2, 0.4].flatMap(z => [-0.35, -0.15, 0.05].map(x =>
            <V key={`${x}${z}`} name={(x * 10 + z * 10) % 2 ? 'Vegetation - Crop - Wheat - Variant3' : 'Vegetation - Crop - Wheat - Variant1'} p={[x, 0, z * 0.8]} s={0.65} sway="grass" />))}
          <Vox p={[0.32, 0.18, -0.1]} s={[0.3, 0.36, 0.34]} c="#a83a2a" />
          <Vox p={[0.32, 0.4, -0.1]} s={[0.34, 0.08, 0.38]} c="#5a3a22" />
          <Vox p={[0.32, 0.1, 0.071]} s={[0.12, 0.2, 0.01]} c="#3a2412" />
          <V name="Vegetation - Crop - Bail" p={[0.35, 0, 0.32]} s={0.7} />
        </>
      )
    case 'mechfarm':
      return (
        <>
          {[-0.4, -0.2, 0, 0.2, 0.4].flatMap(z => [-0.35, -0.15, 0.05, 0.25].map(x =>
            <V key={`${x}${z}`} name="Vegetation - Crop - Wheat - Variant4" p={[x, 0, z * 0.8]} s={0.6} sway="grass" />))}
          <Shape kind="cyl" p={[0.36, 0.25, -0.28]} r0={0.1} h={0.5} c="#b8b8b0" />
          <Wander at={[0.1, 0.05]} r={0.25} speed={0.25} seed={2} face={Math.PI / 2}>
            <Vox p={[0, 0.06, 0]} s={[0.14, 0.08, 0.09]} c="#d8402c" />
            <Vox p={[-0.03, 0.13, 0]} s={[0.06, 0.06, 0.08]} c="#9fd0f0" />
            {[-0.05, 0.05].map(x => <Vox key={x} p={[x, 0.03, 0]} s={[0.05, 0.06, 0.11]} c="#2a2a2e" />)}
          </Wander>
        </>
      )
    case 'greenhouse':
      return (
        <>
          {[-0.2, 0.2].map(z => (
            <group key={z}>
              <Vox p={[0, 0.12, z]} s={[0.7, 0.24, 0.3]} c="#bfe8f0" />
              {[-0.25, -0.08, 0.08, 0.25].map(x => <V key={x} name="Vegetation - Crop - Lettuce" p={[x, 0.02, z]} s={0.6} />)}
            </group>
          ))}
        </>
      )
    case 'vertfarm':
      return (
        <>
          <Vox p={[0, 0.55, 0]} s={[0.44, 1.1, 0.44]} c="#d8e8ec" />
          {[0.15, 0.37, 0.59, 0.81].map(y => <Vox key={y} p={[0, y, 0.221]} s={[0.38, 0.12, 0.01]} c="#4fae3a" e="#1a5a10" />)}
          <Vox p={[0, 1.12, 0]} s={[0.48, 0.04, 0.48]} c="#5a6a72" />
        </>
      )
    case 'scribe':
      return (
        <>
          <V name="Decoration - Bookshelf - Center" p={[0.36, 0, 0.3]} s={0.7} />
          <Vox p={[0, 0.14, 0]} s={[0.4, 0.28, 0.32]} c="#e0cfa8" />
          <Vox p={[0, 0.31, 0]} s={[0.46, 0.06, 0.38]} c="#6a3fa0" />
          {[-0.14, 0, 0.14].map(x => <Vox key={x} p={[x, 0.14, 0.17]} s={[0.04, 0.28, 0.04]} c="#f4ecd0" />)}
          <Vox p={[0.3, 0.06, 0.2]} s={[0.12, 0.12, 0.08]} c="#c8763e" />
        </>
      )
    case 'bronzetower':
      return (
        <>
          <Vox p={[0, 0.3, 0]} s={[0.28, 0.6, 0.28]} c="#9a9a90" />
          <Vox p={[0, 0.64, 0]} s={[0.36, 0.08, 0.36]} c="#c87a2a" e="#5a2a00" />
          {[[-0.14, -0.14], [0.14, -0.14], [-0.14, 0.14], [0.14, 0.14]].map(([x, z]) => (
            <Vox key={`${x}${z}`} p={[x, 0.73, z]} s={[0.08, 0.1, 0.08]} c="#9a9a90" />
          ))}
          <Vox p={[0, 0.85, 0]} s={[0.02, 0.3, 0.02]} c="#5b3a1e" />
          <Vox p={[0.06, 0.94, 0]} s={[0.1, 0.08, 0.01]} c="#a8432c" />
        </>
      )
    case 'foundry':
      return (
        <>
          <V name="Resource - Ingot" p={[0.35, 0, 0.32]} s={0.8} />
          <V name="Light - Brazier" p={[-0.35, 0, -0.3]} s={1.3} />
          <Vox p={[0, 0.12, 0]} s={[0.4, 0.24, 0.32]} c="#6a6a64" />
          <Vox p={[0.12, 0.38, -0.05]} s={[0.12, 0.3, 0.12]} c="#5a5a54" />
          <Vox p={[0.12, 0.6, -0.05]} s={[0.08, 0.08, 0.08]} c="#9a9a9a" />
          <Vox p={[-0.08, 0.1, 0.161]} s={[0.12, 0.1, 0.01]} c="#ff9a2a" e="#ff6a00" />
          {[-0.3, -0.18].map(x => <Vox key={x} p={[x, 0.04, 0.26]} s={[0.1, 0.06, 0.06]} c="#d08a3a" e="#3a1a00" />)}
        </>
      )
    case 'market':
      return (
        <>
          <V name="Decoration - Barrel" p={[0.38, 0, -0.38]} s={0.7} ry={0.7} />
          <V name="Decoration - Box - Variant1" p={[-0.4, 0, 0.25]} s={0.9} ry={0.3} />
          <V name="Decoration - Flour Bag" p={[0.35, 0, 0.42]} s={0.7} />
          {[[-0.2, -0.1, '#c8432c'], [0.15, 0.15, '#e0b13a'], [0.15, -0.22, '#3a7ab0']].map(([x, z, c]) => (
            <group key={`${x}${z}`} position={[x as number, 0, z as number]}>
              {[[-0.1, -0.08], [0.1, -0.08], [-0.1, 0.08], [0.1, 0.08]].map(([px, pz]) => (
                <Vox key={`${px}${pz}`} p={[px, 0.1, pz]} s={[0.025, 0.2, 0.025]} c="#6b4526" />
              ))}
              <Vox p={[0, 0.21, 0]} s={[0.26, 0.03, 0.2]} c={c as string} />
              <Vox p={[0, 0.06, 0]} s={[0.18, 0.06, 0.12]} c="#c8763e" />
            </group>
          ))}
        </>
      )
    case 'mine':
      return (
        <>
          <V name="Transportation - Train Track Straight" p={[0, 0, 0.42]} s={1.2} />
          <V name="Transportation - Train Cart" p={[0, 0, 0.42]} s={0.6} />
          <V name="Resource - Mine Node - Base" p={[-0.35, 0, 0.2]} s={1.2} />
          <Vox p={[0, 0.1, 0]} s={[0.36, 0.2, 0.2]} c="#5a5a54" />
          <Vox p={[0, 0.08, 0.101]} s={[0.16, 0.16, 0.01]} c="#151515" />
          {[-0.1, 0.1].map(x => <Vox key={x} p={[x, 0.1, 0.11]} s={[0.03, 0.2, 0.03]} c="#6b4526" />)}
          <Vox p={[0, 0.2, 0.11]} s={[0.26, 0.03, 0.03]} c="#6b4526" />
          <Vox p={[0.25, 0.05, 0.3]} s={[0.14, 0.08, 0.1]} c="#5b3a1e" />
          <Vox p={[0.25, 0.11, 0.3]} s={[0.1, 0.04, 0.07]} c="#a0522d" />
        </>
      )
    case 'smith':
      return (
        <>
          <V name="Crafting - Work - Anvil" p={[0.32, 0, 0.32]} s={0.9} ry={0.5} />
          <Vox p={[0, 0.13, 0]} s={[0.4, 0.26, 0.3]} c="#7a6a5a" />
          <Vox p={[0, 0.29, 0]} s={[0.44, 0.06, 0.34]} c="#4a3a2a" />
          <Vox p={[0.13, 0.42, -0.06]} s={[0.08, 0.2, 0.08]} c="#5a5a54" />
          <Vox p={[-0.08, 0.08, 0.151]} s={[0.12, 0.1, 0.01]} c="#ff7a1a" e="#ff5a00" />
          <Vox p={[0.3, 0.07, 0.25]} s={[0.12, 0.06, 0.06]} c="#3a3a3a" />
          <Vox p={[0.3, 0.03, 0.25]} s={[0.05, 0.06, 0.05]} c="#3a3a3a" />
        </>
      )
    case 'townhouse':
      return (
        <>
          <V name="Decoration - Well" p={[0.4, 0, 0.36]} s={0.45} />
          <Vox p={[0, 0.2, 0]} s={[0.44, 0.4, 0.34]} c="#d8c7a0" />
          <Vox p={[0, 0.2, 0]} s={[0.46, 0.04, 0.36]} c="#6b4526" />
          <Vox p={[0, 0.44, 0]} s={[0.5, 0.08, 0.4]} c="#8a3a22" />
          <Vox p={[0, 0.52, 0]} s={[0.34, 0.08, 0.26]} c="#7a3020" />
          <Vox p={[0, 0.09, 0.171]} s={[0.1, 0.18, 0.01]} c="#3a2412" />
          {[-0.13, 0.13].map(x => <Vox key={x} p={[x, 0.3, 0.171]} s={[0.08, 0.08, 0.01]} c="#ffcf6a" e="#ff9a2a" />)}
        </>
      )
    case 'temple':
      return (
        <>
          <V name="Decoration - Desert - Pillar - Base" p={[-0.4, 0, 0.35]} s={1.2} />
          <Vox p={[0, 0.03, 0]} s={[0.52, 0.06, 0.42]} c="#c9c9c0" />
          {[-0.18, -0.06, 0.06, 0.18].map(x => <Vox key={x} p={[x, 0.2, 0.14]} s={[0.05, 0.28, 0.05]} c="#e8e4d8" />)}
          <Vox p={[0, 0.18, -0.04]} s={[0.4, 0.24, 0.22]} c="#d8d4c8" />
          <Vox p={[0, 0.37, 0.02]} s={[0.5, 0.06, 0.36]} c="#b9b9b0" />
          <Vox p={[0, 0.43, 0.02]} s={[0.3, 0.06, 0.3]} c="#e0b13a" />
        </>
      )
    case 'barracks':
      return (
        <>
          <V name="Training - Melee Target Holder" p={[0.35, 0, 0.38]} s={1.4} />
          <V name="Decoration - Armor Stand" p={[-0.38, 0, 0.35]} s={1.4} />
          <Vox p={[0, 0.12, -0.08]} s={[0.46, 0.24, 0.24]} c="#7a5530" />
          <Vox p={[0, 0.27, -0.08]} s={[0.5, 0.06, 0.28]} c="#5a2a1a" />
          {[-0.25, 0.25].map(x => <Vox key={x} p={[x, 0.2, 0.25]} s={[0.03, 0.4, 0.03]} c="#5b3a1e" />)}
          <Vox p={[-0.18, 0.36, 0.25]} s={[0.12, 0.1, 0.01]} c="#a8432c" />
          {[-0.1, 0, 0.1].map(x => <Vox key={x} p={[x, 0.12, 0.2]} s={[0.015, 0.24, 0.015]} c="#c0c0c8" />)}
        </>
      )
    case 'stonetower':
      return (
        <>
          <Vox p={[0, 0.36, 0]} s={[0.32, 0.72, 0.32]} c="#8a8f7a" />
          <Vox p={[0, 0.76, 0]} s={[0.4, 0.08, 0.4]} c="#7a7f6a" />
          {[[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]].map(([x, z]) => (
            <Vox key={`${x}${z}`} p={[x, 0.85, z]} s={[0.1, 0.1, 0.1]} c="#8a8f7a" />
          ))}
          <Vox p={[0, 0.4, 0.161]} s={[0.06, 0.12, 0.01]} c="#1a1a1a" />
        </>
      )
    case 'workshop':
      return (
        <>
          <V name="Crafting - Work - Sharpening Wheel - Frame" p={[-0.32, 0, 0.32]} s={0.6} />
          <Vox p={[0, 0.13, 0]} s={[0.42, 0.26, 0.32]} c="#a0825a" />
          <Vox p={[0, 0.3, 0]} s={[0.46, 0.06, 0.36]} c="#5b3a1e" />
          <Shape kind="cyl" p={[0.28, 0.22, 0.12]} rot={[0, 0, Math.PI / 2]} r0={0.12} h={0.04} c="#6a6a64" st={0.02} />
          <Vox p={[-0.25, 0.04, 0.24]} s={[0.12, 0.06, 0.1]} c="#7a7a80" />
        </>
      )
    case 'weaver':
      return (
        <>
          <V name="Decoration - Flour Bag - Standing Closed" p={[0.35, 0, -0.3]} s={0.6} />
          <Vox p={[0, 0.12, 0]} s={[0.4, 0.24, 0.3]} c="#c8b08a" />
          <Vox p={[0, 0.27, 0]} s={[0.44, 0.06, 0.34]} c="#6a3fa0" />
          {[['#c8432c', -0.2], ['#3a7ab0', 0], ['#e0b13a', 0.2]].map(([c, x]) => (
            <Vox key={c as string} p={[x as number, 0.05, 0.28]} s={[0.12, 0.1, 0.06]} c={c as string} />
          ))}
        </>
      )
    case 'mill':
      return (
        <>
          <Vox p={[0, 0.2, 0]} s={[0.28, 0.4, 0.28]} c="#e0d4b8" />
          <Shape kind="cone" square p={[0, 0.48, 0]} r={0.18} h={0.18} c="#8a3a22" st={0.025} />
          {[0, 1, 2, 3].map(i => (
            <group key={i} position={[0, 0.36, 0.16]} rotation={[0, 0, (i * Math.PI) / 4]}>
              <Vox p={[0, 0, 0]} s={[0.05, 0.56, 0.01]} c="#7a5530" />
            </group>
          ))}
        </>
      )
    case 'library':
      return (
        <>
          <V name="Decoration - Bookshelf - Center" p={[0.36, 0, 0.3]} s={0.8} />
          <Vox p={[0, 0.16, 0]} s={[0.46, 0.32, 0.34]} c="#c9b89a" />
          <Vox p={[0, 0.35, 0]} s={[0.5, 0.06, 0.38]} c="#4a3a6a" />
          <Vox p={[0, 0.44, 0]} s={[0.2, 0.12, 0.2]} c="#6a3fa0" />
          {[-0.15, -0.05, 0.05, 0.15].map(x => <Vox key={x} p={[x, 0.18, 0.171]} s={[0.05, 0.2, 0.01]} c="#ffcf6a" e="#a06a1a" />)}
        </>
      )
    case 'castle':
      return (
        <>
          <Vox p={[0, 0.2, 0]} s={[0.56, 0.4, 0.56]} c="#9a9a90" />
          {[[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]].map(([x, z]) => (
            <Vox key={`${x}${z}`} p={[x, 0.32, z]} s={[0.16, 0.64, 0.16]} c="#8a8a80" />
          ))}
          <Vox p={[0, 0.55, 0]} s={[0.24, 0.3, 0.24]} c="#a4a49a" />
          <Vox p={[0, 0.8, 0]} s={[0.02, 0.2, 0.02]} c="#5b3a1e" />
          <Vox p={[0.06, 0.86, 0]} s={[0.1, 0.07, 0.01]} c="#2a4ab0" />
          <Vox p={[0, 0.1, 0.281]} s={[0.12, 0.2, 0.01]} c="#3a2412" />
        </>
      )
    case 'cathedral':
      return (
        <>
          <Vox p={[0, 0.22, 0.05]} s={[0.3, 0.44, 0.6]} c="#d8d4c8" />
          <Vox p={[0, 0.5, 0.05]} s={[0.22, 0.12, 0.56]} c="#7a3a5a" />
          <Vox p={[0, 0.4, -0.3]} s={[0.22, 0.8, 0.2]} c="#e0dcd0" />
          <Shape kind="cone" square p={[0, 0.92, -0.3]} r={0.12} h={0.3} c="#7a3a5a" st={0.025} />
          <Vox p={[0, 0.5, -0.19]} s={[0.1, 0.1, 0.01]} c="#ffcf6a" e="#ff9a2a" />
          <Vox p={[0, 0.1, 0.351]} s={[0.1, 0.2, 0.01]} c="#3a2412" />
        </>
      )
    case 'coalmine':
      return (
        <>
          <V name="Cave" p={[0, 0, -0.12]} s={0.95} />
          <V name="Transportation - Train Track Straight" p={[0, 0, 0.32]} s={1.1} />
          <V name="Transportation - Train Cart" p={[0, 0, 0.32]} s={0.55} />
          {[[-0.36, 0.25], [-0.42, 0.38], [-0.3, 0.4]].map(([x, z], i) => <Vox key={i} p={[x, 0.04, z]} s={[0.1, 0.08, 0.1]} c="#1e1e22" />)}
        </>
      )
    case 'powerplant':
      return (
        <>
          <Vox p={[-0.08, 0.15, 0.05]} s={[0.5, 0.3, 0.4]} c="#9a4a32" />
          <Vox p={[-0.08, 0.32, 0.05]} s={[0.54, 0.04, 0.44]} c="#4a4a4e" />
          {[-0.18, 0.02].map(x => <Vox key={x} p={[x, 0.16, 0.251]} s={[0.1, 0.12, 0.01]} c="#ffcf6a" e="#ff9a2a" />)}
          {[0.24, 0.36].map(x => <group key={x}><Vox p={[x, 0.42, -0.22]} s={[0.1, 0.84, 0.1]} c="#7a3a2a" /><Vox p={[x, 0.85, -0.22]} s={[0.12, 0.04, 0.12]} c="#3a3a3a" /><Smoke p={[x, 0.9, -0.22]} /></group>)}
          <Vox p={[0.32, 0.05, 0.3]} s={[0.2, 0.1, 0.16]} c="#1e1e22" />
        </>
      )
    case 'steelworks':
      return (
        <>
          <Vox p={[-0.05, 0.18, 0]} s={[0.6, 0.36, 0.42]} c="#6a6e76" />
          {[-0.2, 0, 0.2].map(x => <Vox key={x} p={[x - 0.05, 0.39, 0]} s={[0.18, 0.06, 0.44]} c="#4a4e56" />)}
          <Vox p={[-0.05, 0.12, 0.211]} s={[0.22, 0.14, 0.01]} c="#ff8a1a" e="#ff5a00" />
          <Vox p={[0.32, 0.5, -0.18]} s={[0.12, 1, 0.12]} c="#5a5a5e" />
          <Smoke p={[0.32, 1.02, -0.18]} />
          <V name="Resource - Ingot" p={[0.36, 0, 0.32]} s={0.7} />
        </>
      )
    case 'factory':
      return (
        <>
          <Vox p={[0, 0.14, 0.02]} s={[0.62, 0.28, 0.44]} c="#a8553a" />
          {[-0.22, 0, 0.22].map(x => (
            <Shape key={x} kind="vault" p={[x, 0.28, 0.02]} rot={[0, Math.PI / 2, 0]} r={0.11} len={0.44} c="#5a5a5e" st={0.025} />
          ))}
          {[-0.2, 0, 0.2].map(x => <Vox key={x} p={[x, 0.14, 0.241]} s={[0.1, 0.1, 0.01]} c="#ffd98a" e="#a06a1a" />)}
          <Vox p={[-0.34, 0.45, -0.22]} s={[0.1, 0.9, 0.1]} c="#7a3a2a" />
          <Smoke p={[-0.34, 0.92, -0.22]} />
          <V name="Decoration - Box - Variant1" p={[0.4, 0, 0.36]} s={0.8} />
        </>
      )
    case 'tenement':
      return (
        <>
          <Vox p={[0, 0.34, 0]} s={[0.5, 0.68, 0.4]} c="#9a5a42" />
          {[0.14, 0.32, 0.5].map(y => [-0.15, 0, 0.15].map(x => <Vox key={`${x}${y}`} p={[x, y, 0.201]} s={[0.07, 0.08, 0.01]} c="#ffcf6a" e="#a06a1a" />))}
          <Vox p={[0, 0.7, 0]} s={[0.54, 0.04, 0.44]} c="#4a3a32" />
          <Vox p={[0.16, 0.8, -0.1]} s={[0.07, 0.16, 0.07]} c="#6a6a64" />
          <Smoke p={[0.16, 0.9, -0.1]} />
        </>
      )
    case 'park':
      return (
        <>
          <Vox p={[0, 0.01, 0]} s={[0.12, 0.02, 0.9]} c="#d8c48a" />
          <V name="Vegetation - Tree - Skinny - Light Green" p={[-0.32, 0, -0.2]} s={0.9} sway="breeze" />
          <V name="Vegetation - Tree - Skinny - Green" p={[0.3, 0, 0.25]} s={0.8} sway="breeze" />
          <V name="Decoration - Bench" p={[0.2, 0, -0.18]} s={0.6} ry={Math.PI / 2} />
          <V name="Decoration - Well" p={[-0.25, 0, 0.3]} s={0.35} />
          {[[0.38, -0.38], [-0.12, 0.4], [0.12, -0.4]].map(([x, z], i) => <Vox key={i} p={[x, 0.03, z]} s={[0.04, 0.06, 0.04]} c={['#ffe04a', '#ff6a5a', '#ffffff'][i]} />)}
        </>
      )
    // ---------- Era Moderna ----------
    case 'oilwell':
      return (
        <>
          <Vox p={[0, 0.02, 0]} s={[0.5, 0.04, 0.4]} c="#3a3a3e" />
          <Pump />
          <Vox p={[0.3, 0.12, 0.25]} s={[0.16, 0.24, 0.16]} c="#2a2a2e" />
          <Vox p={[0.3, 0.25, 0.25]} s={[0.18, 0.02, 0.18]} c="#b8402c" />
        </>
      )
    case 'thermal':
      return (
        <>
          <Vox p={[-0.12, 0.16, 0.08]} s={[0.46, 0.32, 0.4]} c="#8a8a90" />
          <Vox p={[-0.12, 0.34, 0.08]} s={[0.5, 0.04, 0.44]} c="#4a4a4e" />
          {[[0.26, -0.2], [0.26, 0.18]].map(([x, z], i) => (
            <group key={i}>
              <Shape kind="cyl" p={[x, 0.3, z]} r0={0.14} r1={0.1} h={0.6} c="#c8c8c0" />
              <Smoke p={[x, 0.64, z]} />
            </group>
          ))}
          <Vox p={[-0.12, 0.16, 0.281]} s={[0.12, 0.1, 0.01]} c="#ffcf6a" e="#ff9a2a" />
        </>
      )
    case 'hydro':
      return (
        <>
          <Vox p={[0, 0.16, 0]} s={[0.8, 0.32, 0.14]} c="#a8a8a0" />
          <Vox p={[0, 0.34, 0]} s={[0.84, 0.04, 0.18]} c="#7a7a72" />
          {[-0.2, 0, 0.2].map(x => <Vox key={x} p={[x, 0.08, 0.08]} s={[0.08, 0.14, 0.02]} c="#9fd0f0" e="#3a8ac0" />)}
          <Vox p={[0.3, 0.42, 0]} s={[0.14, 0.12, 0.14]} c="#d8d8d0" />
        </>
      )
    case 'electronics':
      return (
        <>
          <Vox p={[0, 0.13, 0]} s={[0.62, 0.26, 0.46]} c="#d8d8d8" />
          <Vox p={[0, 0.27, 0]} s={[0.64, 0.02, 0.48]} c="#4a6a9a" />
          {[-0.2, 0, 0.2].map(x => <Vox key={x} p={[x, 0.14, 0.231]} s={[0.12, 0.08, 0.01]} c="#9fe0ff" e="#2a8ac0" />)}
          {[-0.15, 0.05].map(x => <Vox key={x} p={[x, 0.31, -0.05]} s={[0.12, 0.06, 0.12]} c="#8a8a8a" />)}
        </>
      )
    case 'carplant':
      return (
        <>
          <Vox p={[-0.06, 0.15, -0.06]} s={[0.66, 0.3, 0.4]} c="#7a8a9a" />
          <Vox p={[-0.06, 0.31, -0.06]} s={[0.7, 0.03, 0.44]} c="#3a4a5a" />
          <Vox p={[0.28, 0.45, -0.18]} s={[0.1, 0.9, 0.1]} c="#5a5a5e" />
          <Smoke p={[0.28, 0.92, -0.18]} />
          {[[-0.25, 0.32, '#c8402c'], [0, 0.32, '#2a6ac8'], [0.25, 0.32, '#f0c83a']].map(([x, z, c]) => <Car key={x as number} x={x as number} z={z as number} c={c as string} />)}
        </>
      )
    case 'apartment':
      return (
        <>
          <Vox p={[0, 0.5, 0]} s={[0.46, 1, 0.4]} c="#c8b8a0" />
          {[0.15, 0.35, 0.55, 0.75].map(y => [-0.13, 0.03, 0.13].map(x => <Vox key={`${x}${y}`} p={[x, y, 0.201]} s={[0.07, 0.09, 0.01]} c="#ffe08a" e="#a07a2a" />))}
          <Vox p={[0, 1.02, 0]} s={[0.5, 0.04, 0.44]} c="#5a5a5e" />
          <Vox p={[0.12, 1.1, -0.08]} s={[0.12, 0.12, 0.12]} c="#8a8a8a" />
        </>
      )
    case 'skyscraper':
      return (
        <>
          <Vox p={[0, 0.8, 0]} s={[0.4, 1.6, 0.4]} c="#8ab8d8" />
          {Array.from({ length: 10 }, (_, j) => <Vox key={j} p={[0, 0.12 + j * 0.15, 0.201]} s={[0.34, 0.04, 0.01]} c="#fff6d0" e="#ffe08a" />)}
          <Vox p={[0, 1.62, 0]} s={[0.44, 0.04, 0.44]} c="#5a6a72" />
          <Vox p={[0.1, 1.75, 0.1]} s={[0.02, 0.24, 0.02]} c="#d8d8d8" />
        </>
      )
    case 'hospital':
      return (
        <>
          <Vox p={[0, 0.2, 0]} s={[0.56, 0.4, 0.42]} c="#f0f0ea" />
          <Vox p={[0, 0.41, 0]} s={[0.6, 0.03, 0.46]} c="#8a9aa8" />
          <Vox p={[0, 0.3, 0.211]} s={[0.12, 0.04, 0.01]} c="#d8302a" />
          <Vox p={[0, 0.3, 0.211]} s={[0.04, 0.12, 0.01]} c="#d8302a" />
          {[-0.2, 0.2].map(x => <Vox key={x} p={[x, 0.18, 0.211]} s={[0.08, 0.08, 0.01]} c="#9fe0ff" />)}
          <Vox p={[0.35, 0.05, 0.3]} s={[0.18, 0.1, 0.1]} c="#f0f0ea" />
        </>
      )
    case 'stadium':
      return (
        <>
          <Shape kind="ring" p={[0, 0.12, 0]} ri={0.46} ro={0.6} h={0.24} c="#b8b8b0" st={0.04} />
          <Shape kind="cyl" p={[0, 0.02, 0]} r0={0.46} h={0.04} c="#4fae3a" st={0.04} />
          {[0, 1, 2, 3].map(i => <Vox key={i} p={[Math.cos(i * 1.57 + 0.78) * 0.55, 0.32, Math.sin(i * 1.57 + 0.78) * 0.55]} s={[0.04, 0.4, 0.04]} c="#5a5a5e" />)}
          {[0, 1, 2, 3].map(i => <Vox key={`l${i}`} p={[Math.cos(i * 1.57 + 0.78) * 0.55, 0.53, Math.sin(i * 1.57 + 0.78) * 0.55]} s={[0.1, 0.05, 0.1]} c="#fff6d0" e="#ffe08a" />)}
        </>
      )
    case 'turret':
      return (
        <>
          <Vox p={[0, 0.2, 0]} s={[0.36, 0.4, 0.36]} c="#6a6e76" />
          <Vox p={[0, 0.44, 0]} s={[0.26, 0.1, 0.26]} c="#4a4e56" />
          <Vox p={[0.12, 0.46, 0]} s={[0.3, 0.05, 0.05]} c="#2a2a2e" />
          <Vox p={[0, 0.51, 0]} s={[0.06, 0.04, 0.06]} c="#ff3a2a" e="#ff1a00" />
        </>
      )

    // ---------- Era Contemporânea ----------
    case 'solar':
      return (
        <>
          {[-0.3, 0, 0.3].map(x => [-0.2, 0.15].map(z => (
            <group key={`${x}${z}`} position={[x, 0.1, z]} rotation={[-0.5, 0, 0]}>
              <Vox p={[0, 0, 0]} s={[0.24, 0.02, 0.22]} c="#1a2a5a" e="#0a1a40" />
              <Vox p={[0, -0.05, 0]} s={[0.03, 0.1, 0.03]} c="#8a8a8a" />
            </group>
          )))}
        </>
      )
    case 'wind':
      return <>{[[-0.2, -0.1], [0.25, 0.2]].map(([x, z], i) => <Turbine key={i} x={x} z={z} k={i} />)}</>
    case 'nuclear':
      return (
        <>
          {[[-0.2, -0.1], [0.2, -0.15]].map(([x, z], i) => (
            <group key={i}>
              <Shape kind="cyl" p={[x, 0.32, z]} r0={0.19} r1={0.13} h={0.64} c="#e0e0d8" />
              <Smoke p={[x, 0.68, z]} />
            </group>
          ))}
          <Shape kind="dome" p={[0.05, 0.06, 0.26]} r={0.16} c="#c8c8c0" st={0.025} />
          <Vox p={[0.05, 0.03, 0.26]} s={[0.36, 0.06, 0.36]} c="#8a8a90" />
        </>
      )
    case 'batteries':
      return (
        <>
          <Vox p={[0, 0.12, 0]} s={[0.6, 0.24, 0.44]} c="#e8e8e0" />
          <Vox p={[0, 0.25, 0]} s={[0.62, 0.02, 0.46]} c="#3a9a4a" />
          {[-0.2, 0, 0.2].map(x => <group key={x}><Vox p={[x, 0.12, 0.3]} s={[0.1, 0.2, 0.1]} c="#2a2a2e" /><Vox p={[x, 0.2, 0.3]} s={[0.1, 0.04, 0.1]} c="#5aff6a" e="#2ac03a" /></group>)}
        </>
      )
    case 'datacenter':
      return (
        <>
          <Vox p={[0, 0.16, 0]} s={[0.6, 0.32, 0.4]} c="#2a2e36" />
          {[-0.2, -0.07, 0.07, 0.2].map(x => [0.1, 0.2].map(y => <Vox key={`${x}${y}`} p={[x, y, 0.201]} s={[0.08, 0.03, 0.01]} c="#5affd8" e="#1ac0a0" />))}
          {[-0.15, 0.15].map(x => <Vox key={x} p={[x, 0.36, 0]} s={[0.16, 0.08, 0.16]} c="#8a8a90" />)}
        </>
      )
    case 'autofactory':
      return (
        <>
          <Vox p={[0, 0.14, 0.02]} s={[0.62, 0.28, 0.44]} c="#d8dde4" />
          <Vox p={[0, 0.29, 0.02]} s={[0.64, 0.02, 0.46]} c="#2a6ac8" />
          {[-0.2, 0, 0.2].map(x => <Vox key={x} p={[x, 0.14, 0.241]} s={[0.1, 0.1, 0.01]} c="#9fe0ff" e="#2a8ac0" />)}
          <Arm />
        </>
      )
    case 'logistics':
      return (
        <>
          <Vox p={[-0.1, 0.14, -0.08]} s={[0.56, 0.28, 0.4]} c="#c8a86a" />
          <Vox p={[-0.1, 0.29, -0.08]} s={[0.6, 0.02, 0.44]} c="#5a4a3a" />
          {[-0.25, -0.05, 0.15].map(x => <Vox key={x} p={[x, 0.09, 0.121]} s={[0.14, 0.18, 0.01]} c="#4a4a4e" />)}
          <V name="Decoration - Box - Variant1" p={[0.35, 0, 0.3]} s={0.8} />
          <V name="Decoration - Box - Variant2" p={[0.38, 0, 0.1]} s={0.7} />
          <Car x={-0.1} z={0.36} c="#e8e8e0" />
        </>
      )
    case 'urbanpark':
      return (
        <>
          <Vox p={[0, 0.01, 0]} s={[0.9, 0.02, 0.12]} c="#c8c8c0" />
          <Vox p={[0, 0.01, 0]} s={[0.12, 0.02, 0.9]} c="#c8c8c0" />
          {[[-0.3, -0.3], [0.3, -0.28], [-0.28, 0.3], [0.32, 0.3]].map(([x, z], i) =>
            <V key={i} name={i % 2 ? 'Vegetation - Tree - Skinny - Green' : 'Vegetation - Tree - Skinny - Light Green'} p={[x, 0, z]} s={0.8} sway="breeze" />)}
          <Shape kind="cyl" p={[0, 0.06, 0]} r0={0.14} r1={0.12} h={0.1} c="#b8b8b0" st={0.02} />
          <Vox p={[0, 0.12, 0]} s={[0.04, 0.12, 0.04]} c="#9fd0f0" e="#3a8ac0" />
        </>
      )
    case 'landmark':
      return (
        <>
          <Vox p={[0, 0.02, 0]} s={[0.8, 0.04, 0.8]} c="#5a5e66" />
          {[[-0.22, -0.18, 1.3, '#9fc8e8'], [0.18, -0.2, 1.0, '#b8d8f0'], [0.02, 0.2, 1.6, '#7ab0d8'], [-0.3, 0.25, 0.7, '#c8e0f0'], [0.32, 0.22, 0.8, '#a8c8e0']].map(([x, z, h, c], i) => (
            <group key={i}>
              <Vox p={[x as number, (h as number) / 2, z as number]} s={[0.2, h as number, 0.2]} c={c as string} />
              {Array.from({ length: Math.floor((h as number) / 0.15) }, (_, j) => <Vox key={j} p={[x as number, 0.1 + j * 0.15, (z as number) + 0.101]} s={[0.14, 0.03, 0.01]} c="#fff6d0" e="#ffe08a" />)}
            </group>
          ))}
          <Vox p={[0.02, 1.7, 0.2]} s={[0.02, 0.2, 0.02]} c="#d8d8d8" />
          <Vox p={[0.02, 1.81, 0.2]} s={[0.05, 0.05, 0.05]} c="#ff3a2a" e="#ff1a00" />
        </>
      )
    case 'stable':
      return (
        <>
          <V name="Decoration - Water Trough" p={[0.38, 0, -0.32]} s={0.8} ry={1.57} />
          <Vox p={[-0.1, 0.12, 0]} s={[0.4, 0.24, 0.3]} c="#8b5a2b" />
          <Vox p={[-0.1, 0.27, 0]} s={[0.46, 0.06, 0.36]} c="#d8b25a" />
          {[-0.4, 0.4].map(z => <Vox key={z} p={[0.2, 0.06, z * 0.8]} s={[0.5, 0.03, 0.03]} c="#6b4a2a" />)}
          <Wander at={[0.25, 0.1]} r={0.14} speed={0.35} seed={4} face={Math.PI / 2}>
            <Vox p={[0, 0.12, 0]} s={[0.22, 0.1, 0.08]} c="#5a3a22" />
            <Vox p={[0.13, 0.18, 0]} s={[0.08, 0.1, 0.06]} c="#5a3a22" />
            {[-0.08, 0.08].map(x => <Vox key={x} p={[x, 0.04, 0]} s={[0.03, 0.08, 0.06]} c="#3a2412" />)}
          </Wander>
        </>
      )
  }
}

function Building({ id, done }: { id: BuildingId; done: boolean }) {
  return (
    <group position={[0, H, 0]}>
      {done ? <Model id={id} /> : (
        <>
          <Vox p={[0, 0.05, 0]} s={[0.3, 0.1, 0.3]} c="#b08a5a" />
          <Vox p={[-0.15, 0.2, -0.15]} s={[0.03, 0.4, 0.03]} c="#7a5530" />
          <Vox p={[0.15, 0.2, 0.15]} s={[0.03, 0.4, 0.03]} c="#7a5530" />
          <Vox p={[0.15, 0.2, -0.15]} s={[0.03, 0.4, 0.03]} c="#7a5530" />
        </>
      )}
    </group>
  )
}

function Invader({ hp, kind }: { hp: number; kind: number }) {
  const g = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (g.current) g.current.position.y = H + Math.abs(Math.sin(clock.elapsedTime * 6)) * 0.04
  })
  return (
    <group ref={g} position={[-0.35, H, 0.3]}>
      {kind > 0 ? <Raider kind={kind} /> : <>
      <Vox p={[0, 0.12, 0]} s={[0.26, 0.12, 0.12]} c="#6e6e74" />
      <Vox p={[0.16, 0.18, 0]} s={[0.12, 0.11, 0.11]} c="#7c7c82" />
      <Vox p={[0.25, 0.16, 0]} s={[0.06, 0.05, 0.06]} c="#5a5a60" />
      <Vox p={[0.15, 0.26, -0.03]} s={[0.03, 0.05, 0.03]} c="#5a5a60" />
      <Vox p={[0.15, 0.26, 0.03]} s={[0.03, 0.05, 0.03]} c="#5a5a60" />
      <Vox p={[-0.16, 0.16, 0]} s={[0.1, 0.04, 0.04]} c="#5a5a60" />
      {[[-0.09, -0.04], [-0.09, 0.04], [0.09, -0.04], [0.09, 0.04]].map(([x, z]) => (
        <Vox key={`${x}${z}`} p={[x, 0.03, z]} s={[0.04, 0.06, 0.04]} c="#55555a" />
      ))}
      </>}
      <Html zIndexRange={[50, 0]} center position={[0, 0.5, 0]} className="tip bad">{THREATS[kind].icon} ❤️{hp}</Html>
    </group>
  )
}

// Fumaça de chaminé: 3 baforadas que sobem, crescem e somem em ciclo.
function Smoke({ p }: { p: V3 }) {
  const g = useRef<Group>(null)
  useFrame(({ clock }) => {
    g.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.45 + i / 3) % 1
      c.position.set(Math.sin(t * 3 + i) * 0.04, t * 0.5, 0)
      c.scale.setScalar(0.6 + t * 1.2)
      ;((c as any).material as MeshStandardMaterial).opacity = 0.75 * (1 - t)
    })
  })
  return (
    <group ref={g} position={p}>
      {[0, 1, 2].map(i => (
        <mesh key={i}>
          <boxGeometry args={[0.09, 0.09, 0.09]} />
          <meshStandardMaterial color="#bdb8b0" transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// Meeple azul = trabalhador alocado.
const WORKER_SPOTS: [number, number][] = [[0.42, 0.32], [-0.44, 0.3], [0.05, 0.5]]
function Worker({ i }: { i: number }) {
  const [x, z] = WORKER_SPOTS[i % 3]
  return (
    <group position={[x, H, z]} scale={0.8}>
      <Vox p={[0, 0.12, 0]} s={[0.2, 0.24, 0.1]} c="#2a5ad8" />
      <Vox p={[0, 0.3, 0]} s={[0.12, 0.12, 0.1]} c="#2a5ad8" />
      <Vox p={[0, 0.19, 0]} s={[0.34, 0.07, 0.09]} c="#2a5ad8" />
    </group>
  )
}

// Invasores humanos (Bronze em diante): mais armadura a cada era.
const RAIDER_COLORS = ['', '#8a5a2e', '#6a6a70', '#9a2a2a']
function Raider({ kind }: { kind: number }) {
  const c = RAIDER_COLORS[kind] ?? '#9a2a2a'
  return (
    <>
      {[-0.04, 0.04].map(x => <Vox key={x} p={[x, 0.06, 0]} s={[0.05, 0.12, 0.06]} c="#3a2412" />)}
      <Vox p={[0, 0.2, 0]} s={[0.14, 0.16, 0.09]} c={c} />
      <Vox p={[0, 0.33, 0]} s={[0.09, 0.09, 0.09]} c="#e0b08a" />
      {kind >= 2 && <Vox p={[0, 0.38, 0]} s={[0.11, 0.04, 0.11]} c="#9a9a9a" />}
      <Vox p={[0.1, 0.24, 0]} s={[0.02, 0.26, 0.02]} c={kind >= 2 ? '#c0c0c8' : '#7a5530'} />
      {kind >= 3 && <Vox p={[-0.1, 0.2, 0]} s={[0.02, 0.16, 0.12]} c="#c8a23a" />}
    </>
  )
}

// Trilha/estrada: duas metades, cada uma na altura do seu hex (do centro até a borda).
const LINK_LOOK: Record<Link, { w: number; c: string }> = { trail: { w: 0.12, c: '#b08a5a' }, road: { w: 0.2, c: '#9a9a90' }, rail: { w: 0.26, c: '#7a7a72' }, highway: { w: 0.3, c: '#3a3a40' } }
function LinkPiece({ a, b, la, lb, kind }: { a: Hex; b: Hex; la: number; lb: number; kind: Link }) {
  const [ax, az] = toWorld(a), [bx, bz] = toWorld(b)
  const ang = -Math.atan2(bz - az, bx - ax)
  const half = (x: number, z: number, lift: number, dir: number) => (
    <mesh position={[x + Math.cos(-ang) * 0.5 * dir, H + lift + 0.012, z + Math.sin(-ang) * 0.5 * dir]} rotation={[0, ang, 0]} receiveShadow
      geometry={boxGeo([0.62, 0.025, LINK_LOOK[kind].w])} material={voxMat(LINK_LOOK[kind].c)} />
  )
  // Ferrovia: leito de brita + trilhos do pack ao longo da borda.
  const ties = (x: number, z: number, lift: number, dir: number) => [0.3, 0.66].map(d => (
    <V key={`${dir}${d}`} name="Transportation - Train Track Straight" s={0.9}
      p={[x + Math.cos(-ang) * d * dir, H + lift + 0.02, z + Math.sin(-ang) * d * dir]} ry={ang + Math.PI / 2} />
  ))
  // Rodovia: asfalto com faixa amarela tracejada no meio.
  const stripe = (x: number, z: number, lift: number, dir: number) => [0.3, 0.62].map(d => (
    <mesh key={`${dir}${d}`} position={[x + Math.cos(-ang) * d * dir, H + lift + 0.026, z + Math.sin(-ang) * d * dir]} rotation={[0, ang, 0]}
      geometry={boxGeo([0.14, 0.006, 0.025])} material={voxMat('#f0c83a')} />
  ))
  return <>{half(ax, az, la, 1)}{half(bx, bz, lb, -1)}{kind === 'rail' && <>{ties(ax, az, la, 1)}{ties(bx, bz, lb, -1)}</>}
    {kind === 'highway' && <>{stripe(ax, az, la, 1)}{stripe(bx, bz, lb, -1)}</>}</>
}

// Peça hexagonal: lateral de madeira + topo colorido. Gira ao ser revelada.
// `lift` torna a peça mais alta (o conteúdo sobe junto).
function Piece({ top, side, soil = '#5a3c1e', glow, children, flip, lift = 0 }: { top: string; side: string; soil?: string; glow?: string; children?: React.ReactNode; flip?: boolean; lift?: number }) {
  const g = useRef<Group>(null)
  const anim = useRef(flip) // decidido na montagem: re-renders não interrompem a animação
  const born = useRef<number | null>(null)
  useFrame(({ clock }) => {
    if (!anim.current || !g.current) return
    born.current ??= clock.elapsedTime
    const t = Math.min(1, (clock.elapsedTime - born.current) / 0.55)
    const e = 1 - Math.pow(1 - t, 3)
    g.current.rotation.z = Math.PI * (1 - e)
    g.current.position.y = Math.sin(t * Math.PI) * 0.6
    if (t === 1) {
      g.current.rotation.z = 0
      g.current.position.y = 0
      anim.current = false
    }
  })
  return (
    <group ref={g} rotation={[0, 0, flip ? Math.PI : 0]}>
      <mesh position={[0, (H + lift - SOIL) / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R, R * 1.01, H + lift - SOIL, 6]} />
        <meshStandardMaterial attach="material-0" color={side} flatShading />
        <meshStandardMaterial attach="material-1" color={side} />
        <meshStandardMaterial attach="material-2" color="#1d140c" />
      </mesh>
      <mesh position={[0, H + lift - SOIL / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[R, R, SOIL, 6]} />
        <meshStandardMaterial attach="material-0" color={soil} flatShading />
        <meshStandardMaterial attach="material-1" color={top} emissive={glow ?? '#000'} emissiveIntensity={glow ? 0.25 : 0} />
        <meshStandardMaterial attach="material-2" color={soil} />
      </mesh>
      <group position={[0, lift, 0]}>{children}</group>
    </group>
  )
}

// "?" em voxels sobre o hex oculto.
// Gravuras no tile oculto: "?" ou a silhueta do bioma (pista de exploração).
const ENGRAVE: Record<string, string[]> = {
  unknown: ['.##.', '#..#', '...#', '..#.', '....', '..#.'],
  forest: ['..#....#..', '.###..###.', '#####.####', '..#....#..', '.###..###.', '#####.####', '..#....#..'],
  mountain: ['....#.....', '...###....', '..#####.#.', '.#######.#', '##########'],
}
function Engraving({ kind }: { kind: string }) {
  const rows = ENGRAVE[kind]
  const cells: V3[] = []
  const w = rows[0].length, h = rows.length, u = kind === 'unknown' ? 0.09 : 0.07
  rows.forEach((row, z) => [...row].forEach((c, x) => c === '#' && cells.push([(x - (w - 1) / 2) * u, H + 0.008, (z - (h - 1) / 2) * u])))
  return <>{cells.map((p, i) => <Vox key={i} p={p} s={[u * 0.95, 0.016, u * 0.95]} c="#5c5c66" />)}</>
}

type Props = {
  state: State
  buildMode: BuildingId | null
  linkMode: Link | null
  onHex: (h: Hex) => void
  onEdge: (a: Hex, b: Hex) => void
}

// Pista: metade das florestas e montanhas ocultas mostra a silhueta.
function hintOf(seed: number, h: Hex) {
  const t = terrainAt(seed, h)
  return (t === 'forest' || t === 'mountain') && rng(`hint${seed}${key(h)}`)() < 0.5 ? t : 'unknown'
}

const STOP_SHORT: Record<string, string> = {
  'sem trilha até o Centro': '½ sem trilha', 'sem estrada até o Centro': '½ sem estrada', 'sem ferrovia até o Centro': '½ sem ferrovia',
  'sem trabalhadores': '⛔ sem 👤', 'sem energia': '⛔ sem ⚡', 'metade sem energia': '½ sem ⚡',
}

// Em tela retrato (celular em pé) a câmera recua para o tabuleiro caber na largura.
function FitCamera() {
  const { camera, size } = useThree()
  const portrait = size.width < size.height
  useLayoutEffect(() => { camera.position.set(0, portrait ? 18 : 10.5, portrait ? 12.5 : 7.2) }, [portrait, camera])
  return null
}

export function Board({ state, buildMode, linkMode, onHex, onEdge }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const [hoverEdge, setHoverEdge] = useState<string | null>(null)
  const seen = useRef(new Set(Object.keys(state.tiles)))
  const hidden = hiddenHexes(state)
  const stop = stopped(state)
  const working = new Set(staffed(state))
  const links = linked(state)
  const lifts = (k: string) => liftOf(k, state.tiles[k].terrain)

  // Pares de hexes revelados vizinhos (cada borda uma vez).
  const edges: [Hex, Hex][] = []
  for (const k of Object.keys(state.tiles))
    for (const n of neighbors(parse(k)))
      if (state.tiles[key(n)] && key(n) > k) edges.push([parse(k), n])

  const handlers = (h: Hex) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      if (hover !== key(h) && !state.tiles[key(h)]) sfx(exploreCost(state, h) <= state.actions ? 'peek' : 'peekOff')
      setHover(key(h))
    },
    onPointerOut: () => setHover(k => (k === key(h) ? null : k)),
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.delta < 6) onHex(h) },
  })

  return (
    <>
      <FitCamera />
      <OrbitControls target={[0, 0, 0.6]} maxPolarAngle={1.1} minDistance={5} maxDistance={26} enablePan />
      <ambientLight intensity={0.45} color="#ffe2c0" />
      <hemisphereLight args={['#ffe6c0', '#3a2414', 0.7]} />
      <directionalLight
        position={[-7, 13, -4]} intensity={2.6} color="#ffd9a0" castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-16} shadow-camera-right={16}
        shadow-camera-top={16} shadow-camera-bottom={-16} shadow-bias={-0.0004} shadow-normalBias={0.02}
      />
      <Table />
      <WaterClock />

      {Object.entries(state.tiles).map(([k, tile]) => {
        const h = parse(k)
        const [x, z] = toWorld(h)
        const isNew = !seen.current.has(k)
        if (isNew) seen.current.add(k)
        const lift = liftOf(k, tile.terrain)
        const valid = buildMode && !canPlace(state, h, buildMode)
        const glow = valid ? '#7dff6a' : hover === k ? '#ffd890' : undefined
        const b = tile.building
        const wolves = state.invaders.filter(i => i.at === k)
        const why = stop[k]
        const half = b && !why && working.has(k) ? offGrid(state, k, links) : null
        return (
          <group key={k} position={[x, 0, z]} {...handlers(h)}>
            <Piece top={TOP[tile.terrain]} side="#4a2e18" glow={glow} flip={isNew} lift={lift}>
              {tile.terrain === 'center' ? <Campfire hp={state.centerHp} max={centerMax(state)} /> : <Terrain tile={tile} k={k} />}
              {b && <Building id={b.id} done={b.turnsLeft === 0} />}
              {b && working.has(k) && Array.from({ length: BUILDINGS[b.id].workers }, (_, i) => <Worker key={i} i={i} />)}
              {wolves.map(w => <Invader key={w.id} hp={w.hp} kind={w.kind} />)}
            </Piece>
            {state.warnings.includes(k) && (
              <Html zIndexRange={[50, 0]} center position={[0, 1.2 + lift, 0]} className="tip warn">⚠️ ataque no próximo turno</Html>
            )}
            {b && b.hp < BUILDINGS[b.id].hp && (
              <Html zIndexRange={[50, 0]} center position={[0.4, 0.9 + lift, 0]} className="tip bad">❤️{b.hp}</Html>
            )}
            {why && hover !== k && (
              <Html zIndexRange={[50, 0]} center position={[0, 0.85 + lift, 0]} className="tip bad">{STOP_SHORT[why]}</Html>
            )}
            {half && hover !== k && (
              <Html zIndexRange={[50, 0]} center position={[0, 0.85 + lift, 0]} className="tip warn">{STOP_SHORT[half]}</Html>
            )}
            {hover === k && tile.terrain !== 'center' && (
              <Html zIndexRange={[50, 0]} center position={[0, 1.1 + lift, 0]} className="tip">
                {wolves.length > 0 && !buildMode ? `Atacar ${THREATS[wolves[0].kind].name.toLowerCase()} · ${HUNT_COST} ✋ · ` : ''}
                {TERRAINS[tile.terrain].name}
                {b && ` · ${BUILDINGS[b.id].name}${b.turnsLeft ? ` (⏱ ${b.turnsLeft})` : ''}`}
                {why && ` · ⛔ ${why}`}
                {half && ` · rende metade: ${half}`}
              </Html>
            )}
          </group>
        )
      })}

      {edges.map(([a, b]) => {
        const kind = state.links[edgeKey(a, b)]
        return kind && <LinkPiece key={edgeKey(a, b)} a={a} b={b} la={lifts(key(a))} lb={lifts(key(b))} kind={kind} />
      })}

      {linkMode && edges.filter(([a, b]) => !canLink(state, a, b, linkMode)).map(([a, b]) => {
        const ek = edgeKey(a, b)
        const [ax, az] = toWorld(a), [bx, bz] = toWorld(b)
        const y = H + Math.max(lifts(key(a)), lifts(key(b))) + 0.05
        const { actions, cost } = linkCost(state, a, b, linkMode)
        const on = hoverEdge === ek
        return (
          <group key={ek} position={[(ax + bx) / 2, y, (az + bz) / 2]} rotation={[0, -Math.atan2(bz - az, bx - ax), 0]}
            onPointerOver={e => { e.stopPropagation(); setHoverEdge(ek) }}
            onPointerOut={() => setHoverEdge(k => (k === ek ? null : k))}
            onClick={e => { e.stopPropagation(); if (e.delta < 6) onEdge(a, b) }}>
            <mesh>
              <boxGeometry args={[0.7, 0.06, 0.34]} />
              <meshStandardMaterial color={on ? '#ffe08a' : '#7dff6a'} transparent opacity={on ? 0.9 : 0.45} emissive={on ? '#ffb000' : '#2a6a1a'} />
            </mesh>
            {on && (
              <Html zIndexRange={[50, 0]} center position={[0, 0.4, 0]} className="tip">
                {LINKS[linkMode].name} · {actions} ✋{Object.entries(cost).map(([r, v]) => ` ${v} ${RES[r as Res].icon}`).join('')}
              </Html>
            )}
          </group>
        )
      })}

      {hidden.map(h => {
        const k = key(h)
        const [x, z] = toWorld(h)
        const cost = exploreCost(state, h)
        const can = cost <= state.actions
        return (
          <group key={k} position={[x, hover === k ? 0.06 : 0, z]} {...handlers(h)}>
            <Piece top={can ? '#303036' : '#24242a'} side="#1c1c20" soil="#2a2a30" glow={hover === k ? '#8888aa' : undefined}>
              <Engraving kind={hintOf(state.seed, h)} />
            </Piece>
            {hover === k && (
              <Html zIndexRange={[50, 0]} center position={[0, 0.9, 0]} className={`tip ${can ? '' : 'bad'}`}>Explorar · {cost} ✋</Html>
            )}
          </group>
        )
      })}
    </>
  )
}
