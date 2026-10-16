// Efeitos sonoros sintetizados na hora (Web Audio), estilo chiptune. Sem arquivos de áudio.
// ponytail: síntese procedural; trocar por samples (.ogg) se a direção de arte pedir algo mais orgânico.

let ctx: AudioContext | null = null
let muted = (() => { try { return localStorage.getItem('hex.mute') === '1' } catch { return false } })()

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try { localStorage.setItem('hex.mute', m ? '1' : '0') } catch {}
  if (bed && ctx) bed.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.3)
}

type Wave = OscillatorType | 'noise'
// Uma nota: onda, frequência inicial → final (Hz), início e duração (s), volume.
type Note = [Wave, number, number, number, number, number?]

function play(notes: Note[]) {
  if (muted) return
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  const t0 = ctx.currentTime
  for (const [wave, f0, f1, at, dur, vol = 0.15] of notes) {
    const g = ctx.createGain()
    const t = t0 + at
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    g.connect(ctx.destination)
    let src: AudioScheduledSourceNode
    if (wave === 'noise') {
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
      const n = ctx.createBufferSource()
      n.buffer = buf
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.setValueAtTime(f0, t)
      f.frequency.exponentialRampToValueAtTime(f1, t + dur)
      n.connect(f).connect(g)
      src = n
    } else {
      const o = ctx.createOscillator()
      o.type = wave
      o.frequency.setValueAtTime(f0, t)
      o.frequency.exponentialRampToValueAtTime(f1, t + dur)
      o.connect(g)
      src = o
    }
    src.start(t)
    src.stop(t + dur)
  }
}

// Arpejo: notas em sequência com o mesmo timbre.
const arp = (wave: Wave, fs: number[], step: number, dur: number, vol?: number): Note[] =>
  fs.map((f, i) => [wave, f, f, i * step, dur, vol])

const SOUNDS = {
  click: [['square', 900, 700, 0, 0.04, 0.06]],
  hover: [['noise', 7000, 3000, 0, 0.035, 0.04], ['triangle', 1400, 1600, 0, 0.03, 0.025]],
  peek: [['noise', 900, 300, 0, 0.07, 0.1], ['triangle', 220, 330, 0, 0.06, 0.05], ['sine', 1200, 1800, 0.03, 0.08, 0.02]],
  peekOff: [['noise', 600, 200, 0, 0.06, 0.07], ['triangle', 160, 140, 0, 0.06, 0.04]],
  card: [['noise', 6000, 1200, 0, 0.09, 0.12], ['triangle', 520, 1040, 0.02, 0.1, 0.14], ['triangle', 1040, 1040, 0.09, 0.08, 0.06]],
  uncard: [['noise', 5000, 1000, 0, 0.08, 0.08], ['triangle', 900, 450, 0.01, 0.09, 0.1]],
  build: [['noise', 1200, 200, 0, 0.12, 0.3], ['square', 160, 90, 0, 0.1, 0.12], ['noise', 1200, 200, 0.13, 0.12, 0.25], ['square', 180, 100, 0.13, 0.1, 0.1]],
  explore: [['noise', 3000, 600, 0, 0.25, 0.08], ['triangle', 400, 700, 0.05, 0.15, 0.08]],
  link: [['noise', 900, 300, 0, 0.08, 0.2], ['noise', 900, 300, 0.09, 0.08, 0.15], ['noise', 900, 300, 0.18, 0.08, 0.1]],
  hunt: [['noise', 6000, 800, 0, 0.1, 0.25], ['sawtooth', 300, 60, 0.03, 0.15, 0.12]],
  coin: arp('square', [988, 1319], 0.07, 0.12, 0.08),
  turn: [['triangle', 330, 330, 0, 0.12, 0.12], ['triangle', 440, 440, 0.1, 0.18, 0.12]],
  event: [['noise', 5000, 2000, 0, 0.15, 0.06], ...arp('triangle', [523, 659, 784], 0.06, 0.15, 0.1)],
  alarm: [...arp('square', [440, 330, 440, 330], 0.12, 0.1, 0.08)],
  hit: [['noise', 800, 100, 0, 0.3, 0.35], ['sine', 120, 40, 0, 0.3, 0.3]],
  era: arp('square', [523, 659, 784, 1047, 784, 1047], 0.1, 0.22, 0.09),
  error: [['square', 200, 150, 0, 0.08, 0.08], ['square', 150, 110, 0.09, 0.12, 0.08]],
  win: arp('square', [523, 659, 784, 1047, 1319, 1568], 0.12, 0.3, 0.09),
  lose: arp('triangle', [392, 330, 262, 196], 0.22, 0.35, 0.12),
} satisfies Record<string, Note[]>

export type Sfx = keyof typeof SOUNDS
export const sfx = (name: Sfx) => play(SOUNDS[name] as Note[])

// ---------- ambiente: folhas ao vento + rio correndo ----------
// Ruído em loop filtrado, com volume oscilando devagar; por cima, farfalhar e bolhas em horários aleatórios.
// ponytail: ambiente fixo; misturar pelo terreno perto da câmera se um dia o mapa pedir.
let bed: GainNode | null = null

let noiseBuf: AudioBuffer | null = null
function noiseLoop(c: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 4, c.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  const n = c.createBufferSource()
  n.buffer = noiseBuf
  n.loop = true
  n.start(0, Math.random() * 4) // cada camada começa num ponto diferente, sem eco entre elas
  return n
}

function layer(c: AudioContext, type: BiquadFilterType, freq: number, q: number, vol: number, lfoHz: number) {
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  const g = c.createGain()
  g.gain.value = vol
  const lfo = c.createOscillator()
  const depth = c.createGain()
  lfo.frequency.value = lfoHz
  depth.gain.value = vol * 0.6
  lfo.connect(depth).connect(g.gain)
  lfo.start()
  noiseLoop(c).connect(f).connect(g).connect(bed!)
}

function blip(at: number, f0: number, f1: number, dur: number, vol: number, wave: Wave, out: AudioNode = bed!) {
  const c = ctx!
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + dur * 0.3)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  g.connect(out)
  if (wave === 'noise') {
    const n = noiseLoop(c), f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(f0, at)
    f.frequency.linearRampToValueAtTime(f1, at + dur)
    n.connect(f).connect(g)
    n.stop(at + dur)
  } else {
    const o = c.createOscillator()
    o.type = wave
    o.frequency.setValueAtTime(f0, at)
    o.frequency.exponentialRampToValueAtTime(f1, at + dur)
    o.connect(g)
    o.start(at)
    o.stop(at + dur)
  }
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

// Passarinhos: cada canto é uma espécie sorteada, num ponto aleatório do estéreo (parece que estão em árvores diferentes).
// ponytail: 3 cantos sintetizados; trocar por samples de pássaros reais se soar artificial demais.
function bird() {
  const c = ctx!, t = c.currentTime
  const pan = c.createStereoPanner()
  pan.pan.value = rnd(-0.8, 0.8)
  pan.connect(bed!)
  const v = rnd(0.012, 0.025) // perto/longe
  const kind = Math.floor(Math.random() * 3)
  if (kind === 0) { // piu-piu: chilreios curtos descendo
    const f = rnd(3200, 4500), n = 2 + Math.floor(Math.random() * 4)
    for (let i = 0; i < n; i++) blip(t + i * rnd(0.1, 0.16), f * 1.3, f * 0.8, 0.07, v, 'sine', pan)
  } else if (kind === 1) { // trinado rápido
    const f = rnd(4000, 5500), n = 8 + Math.floor(Math.random() * 8)
    for (let i = 0; i < n; i++) blip(t + i * 0.045, f, f * 1.15, 0.035, v * 0.8, 'sine', pan)
  } else { // assobio "fiii-uu" subindo e caindo
    const f = rnd(2200, 3000)
    blip(t, f, f * 1.4, 0.25, v, 'sine', pan)
    blip(t + 0.3, f * 1.3, f * 0.9, 0.3, v, 'sine', pan)
  }
}
function every(min: number, max: number, fn: () => void) {
  const tick = () => { if (!muted && ctx?.state === 'running') fn(); setTimeout(tick, rnd(min, max) * 1000) }
  setTimeout(tick, rnd(min, max) * 1000)
}

// Precisa de um gesto do jogador (política de autoplay do navegador): chamar no primeiro clique.
export function startAmbience() {
  if (bed) return
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  bed = ctx.createGain()
  bed.gain.value = 0
  bed.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 1.5) // entra devagar
  bed.connect(ctx.destination)
  layer(ctx, 'bandpass', 2800, 0.7, 0.018, 0.13) // folhas / vento
  layer(ctx, 'lowpass', 500, 0.5, 0.05, 0.07) // corpo do rio
  layer(ctx, 'bandpass', 1400, 1.2, 0.012, 0.21) // chiado da água
  every(2, 7, () => { const t = ctx!.currentTime; blip(t, rnd(3000, 5000), rnd(1500, 2500), rnd(0.5, 1.2), 0.03, 'noise') }) // rajada nas folhas
  every(0.15, 0.9, () => { const t = ctx!.currentTime, f = rnd(500, 1100); blip(t, f, f * 1.6, rnd(0.04, 0.09), 0.012, 'sine') }) // bolhas
  every(1.5, 5, bird) // passarinhos
  every(4, 10, bird) // um segundo bando, pra às vezes cantarem juntos
}
