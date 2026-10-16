// Peças "à mão" no mesmo padrão do pack MagicaVoxel (ver vault: Direção Visual).
// 1) Caixas ganham textura de voxel no shader: cada célula de CELL tem um leve desvio de cor,
//    a borda do topo clareia e a base escurece — como os modelos importados.
// 2) Formas curvas (cilindro, cone, cúpula, anel, telhado arredondado) viram degraus de voxel,
//    fundidos numa geometria só por forma.
import { useMemo } from 'react'
import { BoxGeometry, Float32BufferAttribute, MeshStandardMaterial, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const CELL = 0.02 // tamanho do voxel desenhado (≈ voxel do pack na escala do tabuleiro)
type V3 = [number, number, number]
type Box = [number, number, number, number, number, number] // centro x,y,z · tamanho x,y,z

// Caixa com o centro e a meia-medida gravados por vértice (o shader precisa para achar bordas e células).
function tagged([cx, cy, cz, sx, sy, sz]: Box) {
  const g = new BoxGeometry(sx, sy, sz).translate(cx, cy, cz)
  const n = g.attributes.position.count
  const rep = (v: V3) => new Float32BufferAttribute(Array.from({ length: n }, () => v).flat(), 3)
  g.setAttribute('aCenter', rep([cx, cy, cz]))
  g.setAttribute('aHalf', rep([sx / 2, sy / 2, sz / 2]))
  return g
}

const geos = new Map<string, BufferGeometry>()
const cached = (k: string, make: () => BufferGeometry) => geos.get(k) ?? (geos.set(k, make()), geos.get(k)!)
export const boxGeo = (s: V3) => cached(`b${s}`, () => tagged([0, 0, 0, ...s]))
const shapeGeo = (boxes: Box[]) => cached(`s${boxes.flat().map(v => v.toFixed(3))}`, () => mergeGeometries(boxes.map(tagged)))

const mats = new Map<string, MeshStandardMaterial>()
export function voxMat(c: string, e?: string) {
  const k = `${c}|${e}`
  let m = mats.get(k)
  if (m) return m
  m = new MeshStandardMaterial({ color: c, emissive: e ?? '#000', emissiveIntensity: e ? 1.5 : 0, roughness: 0.9, flatShading: true })
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec3 aCenter;\nattribute vec3 aHalf;\nvarying vec3 vLocal;\nvarying vec3 vHalf;\nvarying vec3 vObjN;\n'
      + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position - aCenter; vHalf = aHalf; vObjN = normal;')
    sh.fragmentShader = 'varying vec3 vLocal;\nvarying vec3 vHalf;\nvarying vec3 vObjN;\n'
      + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float C = ${CELL.toFixed(3)};
        vec3 q = vLocal + vHalf;                       // 0..tamanho, a partir do canto da caixa
        vec3 cell = floor((q - vObjN * 0.001) / C);
        float h = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float k = 0.92 + h * 0.12;                     // cada voxel com seu tom
        vec3 d = vHalf - abs(vLocal);                  // distância até as faces
        if (vObjN.y > 0.5) { if (min(d.x, d.z) < C) k += 0.12; }          // aresta do topo clareia
        else if (vObjN.y < -0.5) k *= 0.75;
        else if (q.y < C) k *= 0.8;                                        // base escurece
        else if (d.y < C) k += 0.07;
        diffuseColor.rgb *= k;
      }`)
  }
  m.customProgramCacheKey = () => 'voxbox'
  mats.set(k, m)
  return m
}

export function Vox({ p, s, c, e }: { p: V3; s: V3; c: string; e?: string }) {
  return <mesh position={p} geometry={boxGeo(s)} material={voxMat(c, e)} castShadow receiveShadow />
}

// ---------- formas em degraus ----------
// Centros de fatias que cobrem [a, b] com passo ≈ st (sempre ao menos uma).
const steps = (a: number, b: number, st: number) => {
  const n = Math.max(1, Math.round((b - a) / st)), d = (b - a) / n
  return Array.from({ length: n }, (_, i) => a + d * (i + 0.5))
}

// Fatia redonda (disco) de raio r na altura y: fileiras ao longo de z.
const disc = (r: number, y: number, h: number, st: number): Box[] =>
  steps(-r, r, st).map(z => [0, y, z, 2 * Math.max(st, Math.round(Math.sqrt(Math.max(0, r * r - z * z)) / st) * st), h, st] as Box)

const shapes = {
  // Cilindro (ou tronco de cone) em pé, raio r0 embaixo → r1 em cima.
  cyl: (r0: number, r1: number, h: number, st: number) =>
    steps(0, h, st * 2).flatMap((y, _, ys) => disc(r0 + (r1 - r0) * (y / h), y - h / 2, h / ys.length, st)),
  // Cone redondo / pirâmide (square) até a ponta.
  cone: (r: number, h: number, st: number, square = false) =>
    steps(0, h, st).flatMap((y, _, ys) => {
      const w = Math.max(st, r * (1 - y / h)), t = h / ys.length
      return square ? [[0, y - h / 2, 0, 2 * w, t, 2 * w] as Box] : disc(w, y - h / 2, t, st)
    }),
  // Meia esfera apoiada no chão.
  dome: (r: number, st: number) => steps(0, r, st).flatMap(y => disc(Math.sqrt(r * r - y * y), y, st, st)),
  // Anel (parede circular) entre ri e ro.
  ring: (ri: number, ro: number, h: number, st: number) =>
    steps(-ro, ro, st).flatMap(z => {
      const wo = Math.round(Math.sqrt(Math.max(0, ro * ro - z * z)) / st) * st
      if (Math.abs(z) >= ri) return [[0, 0, z, 2 * wo, h, st] as Box]
      const wi = Math.round(Math.sqrt(ri * ri - z * z) / st) * st
      return [[-(wo + wi) / 2, 0, z, wo - wi, h, st], [(wo + wi) / 2, 0, z, wo - wi, h, st]] as Box[]
    }).filter(b => b[3] > 0),
  // Telhado arredondado (meio cilindro deitado ao longo de x).
  vault: (r: number, len: number, st: number) =>
    steps(0, r, st).map(y => [0, y, 0, len, st, 2 * Math.max(st, Math.round(Math.sqrt(r * r - y * y) / st) * st)] as Box),
}

type ShapeProps = { p: V3; c: string; e?: string; rot?: V3; st?: number } & (
  | { kind: 'cyl'; r0: number; r1?: number; h: number }
  | { kind: 'cone'; r: number; h: number; square?: boolean }
  | { kind: 'dome'; r: number }
  | { kind: 'ring'; ri: number; ro: number; h: number }
  | { kind: 'vault'; r: number; len: number }
)

export function Shape(props: ShapeProps) {
  const { p, c, e, rot = [0, 0, 0], st = CELL * 1.5 } = props
  const geo = useMemo(() => {
    switch (props.kind) {
      case 'cyl': return shapeGeo(shapes.cyl(props.r0, props.r1 ?? props.r0, props.h, st))
      case 'cone': return shapeGeo(shapes.cone(props.r, props.h, st, props.square))
      case 'dome': return shapeGeo(shapes.dome(props.r, st))
      case 'ring': return shapeGeo(shapes.ring(props.ri, props.ro, props.h, st))
      case 'vault': return shapeGeo(shapes.vault(props.r, props.len, st))
    }
  }, [JSON.stringify(props)])
  return <mesh position={p} rotation={rot} geometry={geo} material={voxMat(c, e)} castShadow receiveShadow />
}
