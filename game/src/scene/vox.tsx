import { useEffect, useState } from 'react'
import { Matrix4, MeshStandardMaterial, type BufferGeometry } from 'three'
import { buildMesh, VOXLoader } from 'three/examples/jsm/loaders/VOXLoader.js'
import manifest from './voxManifest.json'

// Modelos do pack MagicaVoxel (public/models/Models.vox). Nome → índice/tamanho em voxManifest.json
// (gerado a partir do arquivo; ver vault: Direção Visual).
export type VoxName = keyof typeof manifest
type Entry = { i: number; s: number[]; t: number[]; r?: number }
const M = manifest as Record<string, Entry>

export const VOXEL = 0.018 // tamanho de 1 voxel no mundo

let chunks: any[] | null = null
let loading: Promise<void> | null = null
const geos = new Map<string, BufferGeometry>()
export const voxMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })

// Vento: o vértice desliza em x/z proporcional à altura (a base fica presa no chão).
// A fase vem da posição no mundo, então plantas vizinhas balançam fora de sincronia e rajadas atravessam o tabuleiro.
export const windTime = { value: 0 }
function windy(amp: number) {
  const m = voxMaterial.clone()
  m.onBeforeCompile = sh => {
    sh.uniforms.uWind = windTime
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float gust = 0.6 + 0.4 * sin(uWind * 0.45 + wp.x * 0.35 + wp.z * 0.2);
      float bend = position.y * ${amp.toFixed(3)} * gust;
      transformed.x += sin(uWind * 1.9 + wp.x * 2.1 + wp.z * 1.3) * bend;
      transformed.z += cos(uWind * 1.5 + wp.x * 1.2 + wp.z * 2.4) * bend * 0.6;`)
  }
  m.customProgramCacheKey = () => `wind${amp}`
  return m
}
const MATERIALS = { none: voxMaterial, grass: windy(0.22), breeze: windy(0.045) }
export type Sway = keyof typeof MATERIALS

function load() {
  loading ??= new VOXLoader().loadAsync('/models/Models.vox').then((r: any) => { chunks = r.chunks })
  return loading
}

// Rotação _r do MagicaVoxel: matriz 3×3 de permutação com sinais, codificada num byte.
function rotation(byte: number) {
  const i1 = byte & 3, i2 = (byte >> 2) & 3, i3 = 3 - i1 - i2
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  r[0][i1] = byte & 16 ? -1 : 1
  r[1][i2] = byte & 32 ? -1 : 1
  r[2][i3] = byte & 64 ? -1 : 1
  const [a, b, c] = r
  return new Matrix4().set(a[0], a[1], a[2], 0, b[0], b[1], b[2], 0, c[0], c[1], c[2], 0, 0, 0, 0, 1)
}

// Rotação espelhada (det < 0) inverte a ordem dos vértices: desvira as faces.
function flipFaces(g: BufferGeometry) {
  const idx = g.index!.array as Uint32Array | Uint16Array
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]]
  g.index!.needsUpdate = true
  g.computeVertexNormals()
}

// Geometria centrada em x/z, com a base em y = 0 (vox é z-up; aqui é y-up). Aplica a rotação da cena.
export function voxGeometry(name: VoxName): BufferGeometry | null {
  if (!chunks) return null
  let g = geos.get(name)
  if (!g) {
    const e = M[name]
    g = buildMesh(chunks[e.i]).geometry
    g.rotateX(Math.PI / 2) // buildMesh já entrega centrado e y-up; volta ao espaço do vox (z-up) para aplicar _r
    if (e.r !== undefined) {
      const m = rotation(e.r)
      g.applyMatrix4(m)
      if (m.determinant() < 0) flipFaces(g)
    }
    g.computeBoundingBox()
    g.translate(0, 0, -g.boundingBox!.min.z)
    g.rotateX(-Math.PI / 2)
    g.scale(VOXEL, VOXEL, VOXEL)
    geos.set(name, g)
  }
  return g
}

export function useVox() {
  const [ready, setReady] = useState(!!chunks)
  useEffect(() => { if (!ready) load().then(() => setReady(true)) }, [ready])
  return ready
}


type P = { name: VoxName; p?: [number, number, number]; s?: number; ry?: number; sway?: Sway }
export function Vox({ name, p = [0, 0, 0], s = 1, ry = 0, sway = 'none' }: P) {
  useVox()
  const g = voxGeometry(name)
  if (!g) return null
  return <mesh geometry={g} material={MATERIALS[sway]} position={p} scale={s} rotation={[0, ry, 0]} castShadow receiveShadow />
}

export const VOX_NAMES = Object.keys(M) as VoxName[]
