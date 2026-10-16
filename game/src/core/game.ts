import {
  BRIDGE_COST, BUILDINGS, CENTER_HP, CENTER_HP_PER_ERA, CLEAR_FOREST_WOOD, CONTRACT_EVERY, CONTRACT_OFFERS, CONTRACTS, ERAS,
  EVENT_EVERY, FOREST_CLEAN, HUNT_COST, LINKS, PRICE_EVERY, PRICE_STEP, REP_BONUS, RES, RING_COST, SELL_SPREAD, TERRAINS, THREAT_CHANCE,
  THREAT_FROM_TURN, THREATS, type Bag, type BuildingId, type Category, type Link, type Res, type Terrain,
} from './data'
import { EVENT_BY_ID, EVENTS, type Effect, type EventOption } from './events'
import { distance, key, neighbors, parse, type Hex } from './hex'

export type Building = { id: BuildingId; turnsLeft: number; hp: number; up?: boolean } // up: melhoria sobre a construção anterior
export type Tile = { terrain: Terrain | 'center'; building?: Building }
export type Invader = { id: number; at: string; hp: number; atk: number; kind: number } // kind: índice em THREATS
export type Contract = { id: number; def: number; left: Bag; turns: number } // def: índice em CONTRACTS
export type Mod = { label: string; turns: number; happy?: number; foodMult?: number; eatMult?: number }

export type State = {
  seed: number
  rng: number
  turn: number
  era: number // índice em ERAS
  tiles: Record<string, Tile> // só hexágonos revelados
  pop: number
  res: Record<Res, number>
  actions: number
  centerHp: number
  invaders: Invader[]
  warnings: string[] // hexes onde um ataque foi anunciado
  mods: Mod[] // efeitos temporários (eventos, fome)
  luxury: boolean // consumiu 🏺 no último turno
  flags: string[]
  deck: string[]
  event: string | null // carta aguardando escolha
  log: string[]
  nextId: number
  over: null | 'lost' | 'won'
  links: Record<string, Link> // infraestrutura nas bordas, chave = edgeKey
  prices: Partial<Record<Res, number>> // preço atual no Mercado (float)
  traded: number // unidades negociadas neste turno
  offers: Contract[] // contratos à vista
  contracts: Contract[] // contratos aceitos
  rep: number // ⭐ reputação
  pollution: number // ☁️ 0–100
  opts?: Sandbox // só no modo Sandbox
}

// Sandbox (ver vault: Sandbox): sem objetivo obrigatório; o jogador ajusta o mundo.
export type Sandbox = {
  threats: number // × chance de invasão (0 = desligadas)
  abundance: number // × produção
  pace: number // × metas das eras (📚 e 👤)
  market: 'volatil' | 'estavel' | 'off'
  era: number // era inicial
}
export const SANDBOX_DEFAULT: Sandbox = { threats: 1, abundance: 1, pace: 1, market: 'volatil', era: 0 }

// ---------- aleatoriedade determinística (seed) ----------

// Hash: o terreno de cada hex é fixo para a seed.
function hash(seed: number, q: number, r: number) {
  let h = seed ^ Math.imul(q, 374761393) ^ Math.imul(r, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// Sorteios durante o jogo (mulberry32 sobre s.rng).
function roll(s: State) {
  s.rng = (s.rng + 0x6d2b79f5) | 0
  let t = s.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function shuffle<T>(s: State, xs: T[]) {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(roll(s) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const pick = <T>(s: State, xs: T[]) => xs[Math.floor(roll(s) * xs.length)]

function log(s: State, msg: string) {
  s.log = [msg, ...s.log].slice(0, 6)
}

// ---------- mapa ----------

// Anel 1 sempre tem planície, floresta e rio (a cadeia da olaria é alcançável).
const RING1: Terrain[] = ['plains', 'forest', 'river', 'forest', 'plains', 'mountain']

// ponytail: ruído por hex sem clusters de bioma; trocar por noise quando os arquétipos de mapa entrarem.
export function terrainAt(seed: number, h: Hex): Terrain {
  if (distance(h) === 1) {
    const i = neighbors({ q: 0, r: 0 }).findIndex(n => n.q === h.q && n.r === h.r)
    return RING1[(i + seed) % 6]
  }
  const x = hash(seed, h.q, h.r)
  return x < 0.4 ? 'plains' : x < 0.72 ? 'forest' : x < 0.85 ? 'river' : 'mountain'
}

export function exploreCost(s: State, h: Hex) {
  const ring = distance(h)
  const base = ring < RING_COST.length ? RING_COST[ring] : 13 + 5 * (ring - 6)
  return Math.max(1, base + TERRAINS[terrainAt(s.seed, h)].exploreMod)
}

export function hiddenHexes(s: State): Hex[] {
  const out = new Map<string, Hex>()
  for (const k of Object.keys(s.tiles))
    for (const n of neighbors(parse(k)))
      if (!s.tiles[key(n)]) out.set(key(n), n)
  return [...out.values()]
}

// ---------- logística ----------

export const edgeKey = (a: Hex, b: Hex) => [key(a), key(b)].sort().join('|')

// Hexes ligados ao Centro por cada nível de conexão. Vizinhos do Centro contam como ligados em qualquer nível.
export function linked(s: State): Record<Link, Set<string>> {
  const bfs = (level: number) => {
    const seen = new Set(['0,0'])
    const queue = [{ q: 0, r: 0 }]
    while (queue.length) {
      const u = queue.shift()!
      for (const v of neighbors(u)) {
        const kv = key(v)
        if (seen.has(kv) || !s.tiles[kv]) continue
        const l = s.links[edgeKey(u, v)]
        if (key(u) !== '0,0' && (!l || LINKS[l].level < level)) continue
        seen.add(kv)
        queue.push(v)
      }
    }
    return seen
  }
  // Rede de trilhos (hexes de Ferrovia prontos) que encosta no Centro: ela e seus vizinhos ficam ligados por ferrovia.
  const rails = Object.keys(s.tiles).filter(k => done(s.tiles[k]) && s.tiles[k].building!.id === 'railway')
  const net = new Set(rails.filter(k => distance(parse(k)) === 1))
  for (const queue = [...net]; queue.length;)
    for (const n of neighbors(parse(queue.shift()!)).map(key))
      if (rails.includes(n) && !net.has(n)) { net.add(n); queue.push(n) }
  const byRail = new Set([...net].flatMap(k => [k, ...neighbors(parse(k)).map(key)]))
  const plus = (a: Set<string>) => new Set([...a, ...byRail])
  return { trail: plus(bfs(1)), road: plus(bfs(2)), rail: plus(bfs(3)), highway: bfs(4) }
}

// Custo de construir/melhorar a conexão de uma borda. Montanha dobra; Rio exige ponte (só na primeira vez).
export function linkCost(s: State, a: Hex, b: Hex, kind: Link): { actions: number; cost: Bag } {
  const prev = s.links[edgeKey(a, b)]
  const terr = [s.tiles[key(a)]?.terrain, s.tiles[key(b)]?.terrain]
  const mult = terr.includes('mountain') ? 2 : 1
  const cost: Bag = {}
  for (const [r, v] of Object.entries(LINKS[kind].cost) as [Res, number][])
    cost[r] = (v - (prev ? LINKS[prev].cost[r] ?? 0 : 0)) * mult
  if (!prev && terr.includes('river'))
    for (const [r, v] of Object.entries(BRIDGE_COST) as [Res, number][]) cost[r] = (cost[r] ?? 0) + v
  return { actions: (LINKS[kind].actions - (prev ? LINKS[prev].actions : 0)) * mult, cost }
}

export function canLink(s: State, a: Hex, b: Hex, kind: Link): string | null {
  if (LINKS[kind].tile) return `${LINKS[kind].name} ocupa um hex inteiro: use a carta de construção.`
  if (LINKS[kind].era > s.era) return `${LINKS[kind].name} é da Era ${ERAS[LINKS[kind].era].name}.`
  if (!s.tiles[key(a)] || !s.tiles[key(b)]) return 'Os dois hexes precisam estar revelados.'
  if (distance(a, b) !== 1) return 'Só entre hexes vizinhos.'
  const prev = s.links[edgeKey(a, b)]
  if (prev && LINKS[prev].level >= LINKS[kind].level) return 'Já existe.'
  return null
}

export function buildLink(prev: State, a: Hex, b: Hex, kind: Link): State {
  guard(prev)
  const err = canLink(prev, a, b, kind)
  if (err) throw new Error(err)
  const { actions, cost } = linkCost(prev, a, b, kind)
  if (actions > prev.actions) throw new Error(`Faltam ações: custa ${actions} ✋.`)
  const s = structuredClone(prev)
  s.actions -= actions
  for (const [r, v] of Object.entries(cost) as [Res, number][]) s.res[r] -= v
  s.links[edgeKey(a, b)] = kind
  return s
}

// ---------- cidade ----------

const done = (t: Tile) => !!t.building && t.building.turnsLeft === 0

export const count = (s: State, id: BuildingId) =>
  Object.values(s.tiles).filter(t => done(t) && t.building!.id === id).length

// Só quem move mercadoria precisa de conexão; moradia, cultura e defesa funcionam isoladas.
const SHIPS: Category[] = ['producao', 'industria', 'comercio']
export const OFF_GRID_MULT = 0.5

// Construção que precisa de conexão e não tem: funciona, mas rende OFF_GRID_MULT. Devolve o que falta.
export function offGrid(s: State, k: string, links = linked(s)): string | null {
  const def = BUILDINGS[s.tiles[k].building!.id]
  if (!SHIPS.includes(def.cat) || links[def.link ?? 'trail'].has(k)) return null
  return `sem ${LINKS[def.link ?? 'trail'].name.toLowerCase()} até o Centro`
}

// Por que uma construção pronta não está funcionando (null = funcionando).
export function stopReason(s: State, k: string, free = { n: s.pop }): string | null {
  const t = s.tiles[k]
  if (!t || !done(t)) return 'em obra'
  const def = BUILDINGS[t.building!.id]
  if (def.workers > free.n) return 'sem trabalhadores'
  free.n -= def.workers
  return null
}

// Construções funcionando: prontas, conectadas e com trabalhadores (alocação automática, em ordem).
// Ordem de alocação: quem produz comida recebe 👤 primeiro (ninguém trabalha na forja com fome).
const byFood = (s: State) => Object.keys(s.tiles).filter(k => s.tiles[k].building)
  .sort((a, b) => Number(!!BUILDINGS[s.tiles[b].building!.id].produces?.food) - Number(!!BUILDINGS[s.tiles[a].building!.id].produces?.food))

export function staffed(s: State): string[] {
  const free = { n: s.pop }
  return byFood(s).filter(k => !stopReason(s, k, free))
}

// Construções prontas que estão paradas, com o motivo (para a interface).
export function stopped(s: State): Record<string, string> {
  const free = { n: s.pop }
  const out: Record<string, string> = {}
  for (const k of byFood(s)) {
    if (!done(s.tiles[k])) continue
    const why = stopReason(s, k, free)
    if (why) out[k] = why
  }
  for (const k of run(s).unpowered) out[k] = BUILDINGS[s.tiles[k].building!.id].consumes ? 'sem energia' : 'metade sem energia'
  return out
}

const sumOf = (s: State, f: (d: (typeof BUILDINGS)[BuildingId]) => number | undefined) =>
  staffed(s).reduce((n, k) => n + (f(BUILDINGS[s.tiles[k].building!.id]) ?? 0), 0)

export function idle(s: State) {
  return s.pop - sumOf(s, d => d.workers)
}

// ✋ base + 👤 ociosos (valem mais com a era: ferramentas, eletricidade) + bônus de construções.
export const maxActions = (s: State) => 3 + Math.floor(idle(s) * ERAS[s.era].idle) + sumOf(s, d => d.actionsBonus)

export const housing = (s: State) => 3 + sumOf(s, d => d.housing) // a Fogueira abriga a tribo inicial

export const centerMax = (s: State) => CENTER_HP + CENTER_HP_PER_ERA * s.era

export const huntDamage = (s: State) => 1 + sumOf(s, d => d.huntBonus)

export const tradeLimit = (s: State) => (s.opts?.market === 'off' ? 0 : sumOf(s, d => d.tradeVolume))

const modProduct = (s: State, f: 'foodMult' | 'eatMult') => s.mods.reduce((m, x) => m * (x[f] ?? 1), 1)

export function happiness(s: State) {
  let h = 50 + (s.luxury ? 5 : 0) + sumOf(s, d => d.happy)
  for (const m of s.mods) h += m.happy ?? 0
  h -= DEBT_HAPPY * debt(s)
  h -= Math.floor(s.pollution / 2)
  return Math.max(0, Math.min(100, h))
}

// Estoque pode ficar negativo (dívida). Cada unidade devida custa felicidade até ser paga.
// ponytail: sem teto de dívida; a queda de 😊 → produção é o freio. Adicionar limite se virar exploit.
const DEBT_HAPPY = 2
export const debt = (s: State) => Object.values(s.res).reduce((n, v) => n + Math.max(0, -v), 0)

// Faixas de felicidade (ver vault: População e Felicidade).
export function prodMult(s: State) {
  const h = happiness(s)
  return (h < 15 ? 0.5 : h < 30 ? 0.75 : 1) * (s.opts?.abundance ?? 1)
}

// Imposto por moradia ocupada, a partir do Bronze, modulado pela felicidade (ver vault: Recursos).
export function tax(s: State) {
  if (s.era < 1) return 0
  const h = happiness(s)
  return Math.floor(sumOf(s, d => d.tax) * (h < 30 ? 0.5 : h >= 75 ? 1.25 : 1))
}

const zero = () => Object.fromEntries(Object.keys(RES).map(r => [r, 0])) as Record<Res, number>

// Produção de um turno (sem o consumo de comida): extração → usinas (geram ⚡) → processamento (pode exigir ⚡).
// ⚡ não acumula: o que sobra no turno se perde (ver vault: Energia).
export function run(s: State) {
  const out = zero()
  const m = prodMult(s)
  const fm = modProduct(s, 'foodMult')
  const procs: string[] = []
  const links = linked(s)
  const half = (k: string) => (offGrid(s, k, links) ? OFF_GRID_MULT : 1)
  for (const k of staffed(s)) {
    const def = BUILDINGS[s.tiles[k].building!.id]
    if (def.consumes || def.power || def.needsPower) { procs.push(k); continue } // usinas sem insumo e quem pede ⚡ também entram
    for (const [r, v] of Object.entries(def.produces ?? {}) as [Res, number][])
      out[r] += Math.floor(v * m * (r === 'food' ? fm : 1) * half(k))
  }
  const consume = (inp: Bag) => {
    const ok = (Object.entries(inp) as [Res, number][]).every(([r, v]) => s.res[r] + out[r] >= v)
    if (ok) for (const [r, v] of Object.entries(inp) as [Res, number][]) out[r] -= v
    return ok
  }
  let supply = 0, used = 0
  const unpowered: string[] = []
  const plants = procs.filter(k => BUILDINGS[s.tiles[k].building!.id].power)
  for (const k of plants) {
    const def = BUILDINGS[s.tiles[k].building!.id]
    if (consume(def.consumes ?? {})) supply += Math.floor(def.power! * half(k))
  }
  for (const k of procs.filter(k => !plants.includes(k))) {
    const def = BUILDINGS[s.tiles[k].building!.id]
    const need = def.needsPower ?? 0
    if (need > supply - used) {
      unpowered.push(k)
      // Produtor puro (fazenda mecanizada, estufa…) sem ⚡ ainda rende metade; processador para.
      if (!def.consumes) for (const [r, v] of Object.entries(def.produces ?? {}) as [Res, number][])
        out[r] += Math.floor(v * 0.5 * half(k) * m * (r === 'food' ? fm : 1))
      continue
    }
    if (!consume(def.consumes ?? {})) continue
    used += need
    for (const [r, v] of Object.entries(def.produces ?? {}) as [Res, number][])
      out[r] += Math.floor(v * half(k) * (def.consumes ? 1 : m * (r === 'food' ? fm : 1))) // produtor puro segue felicidade/fome
  }
  if (happiness(s) >= 75) out.knowledge += 1
  out.money += tax(s)
  return { out, supply, used, unpowered }
}

export const production = (s: State) => run(s).out

// ☁️ do turno: construções funcionando poluem (ou limpam); cada floresta limpa FOREST_CLEAN.
export function pollutionDelta(s: State) {
  const forests = Object.values(s.tiles).filter(t => t.terrain === 'forest').length
  return sumOf(s, d => d.pollution) - forests * FOREST_CLEAN
}

export const eaten = (s: State) => Math.ceil(s.pop * modProduct(s, 'eatMult'))

// Saldo previsto por turno (para a interface).
export function income(s: State) {
  const p = production(s)
  p.food -= eaten(s)
  if (s.res.pottery + p.pottery >= 1) p.pottery -= 1 // luxo
  return p
}

// ---------- jogo ----------

export function newGame(seed = Math.floor(Math.random() * 1e6), opts?: Sandbox): State {
  const s: State = {
    seed, rng: seed, turn: 1, era: 0, tiles: { '0,0': { terrain: 'center' } },
    pop: 3, res: { ...zero(), food: 5, wood: 3 }, actions: 0, centerHp: CENTER_HP,
    invaders: [], warnings: [], mods: [], luxury: false, flags: [], deck: [], event: null,
    log: ['A tribo acendeu a primeira fogueira.'], nextId: 1, over: null,
    links: {}, prices: {}, traded: 0, offers: [], contracts: [], rep: 0, pollution: 0,
  }
  for (const [r, d] of Object.entries(RES)) if (d.price) s.prices[r as Res] = d.price
  s.deck = shuffle(s, EVENTS.map(e => e.id))
  if (opts) {
    // Começar numa era avançada: estoque generoso dos recursos já disponíveis, Centro à altura da era.
    s.opts = opts
    s.flags.push('sandbox')
    s.era = opts.era
    for (const [r, d] of Object.entries(RES) as [Res, (typeof RES)[Res]][]) if (d.era <= opts.era) s.res[r] += opts.era ? 30 : 0
    s.res.food += opts.era * 20
    s.res.money += opts.era * 300
    s.centerHp = centerMax(s)
  }
  s.actions = maxActions(s)
  return s
}

function guard(s: State) {
  if (s.over) throw new Error('A partida acabou.')
  if (s.event) throw new Error('Resolva o evento primeiro.')
}

export function explore(prev: State, h: Hex): State {
  guard(prev)
  if (prev.tiles[key(h)]) throw new Error('Já revelado.')
  if (!neighbors(h).some(n => prev.tiles[key(n)])) throw new Error('Precisa ser vizinho do seu território.')
  const cost = exploreCost(prev, h)
  if (cost > prev.actions) throw new Error(`Faltam ações: custa ${cost} ✋.`)
  const s = structuredClone(prev)
  s.actions -= cost
  s.tiles[key(h)] = { terrain: terrainAt(s.seed, h) }
  return s
}

// Terreno e ocupação (sem olhar recursos) — usado para destacar hexes válidos.
// Terrenos de uma construção; melhorias herdam da primeira da linhagem (Sobrado ← Casa ← Cabana).
export const terrainsOf = (id: BuildingId): Terrain[] =>
  BUILDINGS[id].terrains.length || !BUILDINGS[id].from ? BUILDINGS[id].terrains : terrainsOf(BUILDINGS[id].from!)

// Melhoria = construir por cima da versão anterior pronta. Também dá para construir do zero num hex livre.
const isUpgrade = (t: Tile, id: BuildingId) => !!BUILDINGS[id].from && t.building?.id === BUILDINGS[id].from && t.building.turnsLeft === 0

export function canPlace(s: State, h: Hex, id: BuildingId): string | null {
  const t = s.tiles[key(h)]
  const def = BUILDINGS[id]
  if (!t) return 'Hexágono não revelado.'
  if (def.era > s.era) return `${def.name} é da Era ${ERAS[def.era].name}.`
  if (isUpgrade(t, id)) return null
  if (t.building || t.terrain === 'center') return 'Já ocupado.'
  const ok = terrainsOf(id)
  if (!ok.includes(t.terrain)) return `${def.name} exige ${ok.map(x => TERRAINS[x].name).join(' ou ')}.`
  return null
}

export function affordable(s: State, id: BuildingId): string | null {
  const def = BUILDINGS[id]
  if (def.actions > s.actions) return `Faltam ações: custa ${def.actions} ✋.`
  return null
}

// Recursos que ficariam negativos ao construir (aviso, não bloqueio).
export function shortfall(s: State, id: BuildingId): string | null {
  const miss = (Object.entries(BUILDINGS[id].cost) as [Res, number][])
    .filter(([r, v]) => s.res[r] < v).map(([r, v]) => `${v - s.res[r]} ${RES[r].icon}`)
  return miss.length ? `Você ficará devendo ${miss.join(', ')}.` : null
}

export function build(prev: State, h: Hex, id: BuildingId): State {
  guard(prev)
  const err = canPlace(prev, h, id) ?? affordable(prev, id)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  const def = BUILDINGS[id]
  s.actions -= def.actions
  for (const [r, v] of Object.entries(def.cost) as [Res, number][]) s.res[r] -= v
  const t = s.tiles[key(h)]
  const up = isUpgrade(t, id)
  // Só o Lenhador preserva a floresta; qualquer outra construção nova a derruba.
  if (t.terrain === 'forest' && id !== 'lumber' && !up) {
    t.terrain = 'plains'
    s.res.wood += CLEAR_FOREST_WOOD
  }
  t.building = { id, turnsLeft: def.turns, hp: def.hp, ...(up && { up }) }
  return s
}

// Demolir: o hex fica livre e volta metade do custo (arredonda para baixo). Moradores sem casa vão embora.
export const DEMOLISH_COST = 1
export function demolish(prev: State, h: Hex): State {
  guard(prev)
  const t = prev.tiles[key(h)]
  if (!t?.building) throw new Error('Não há construção aqui.')
  if (prev.actions < DEMOLISH_COST) throw new Error(`Faltam ações: demolir custa ${DEMOLISH_COST} ✋.`)
  const s = structuredClone(prev)
  const def = BUILDINGS[t.building.id]
  s.actions -= DEMOLISH_COST
  for (const [r, v] of Object.entries(def.cost) as [Res, number][]) s.res[r] += Math.floor(v / 2)
  delete s.tiles[key(h)].building
  const gone = s.pop - Math.min(s.pop, housing(s))
  s.pop -= gone
  log(s, `${def.name} demolida.${gone ? ` ${gone} 👤 partiram sem casa.` : ''}`)
  return s
}

// ---------- eventos ----------

function eligible(s: State, id: string) {
  const c = EVENT_BY_ID[id]
  if (c.once && s.flags.includes(`done:${id}`)) return false
  if (c.needs?.flag && !s.flags.includes(c.needs.flag)) return false
  if (c.needs?.minFood && s.res.food < c.needs.minFood) return false
  if (c.needs?.minPollution && s.pollution < c.needs.minPollution) return false
  return true
}

function draw(s: State): string | null {
  for (let pass = 0; pass < 2; pass++) {
    const i = s.deck.findIndex(id => eligible(s, id))
    if (i >= 0) return s.deck.splice(i, 1)[0]
    s.deck = shuffle(s, EVENTS.map(e => e.id))
  }
  return null
}

export function canChoose(s: State, o: EventOption): string | null {
  if (o.requires && count(s, o.requires) === 0) return `Requer ${BUILDINGS[o.requires].name}`
  const e = o.effect
  if (e.actions && s.actions + e.actions < 0) return 'Faltam ações'
  return null
}

function addMod(s: State, label: string, m: Omit<Mod, 'label' | 'turns'>, turns: number) {
  s.mods.push({ label, turns, ...m })
}

function warn(s: State) {
  const border = Object.keys(s.tiles).filter(k =>
    k !== '0,0' && !s.warnings.includes(k) && neighbors(parse(k)).some(n => !s.tiles[key(n)]))
  if (!border.length) return
  s.warnings.push(pick(s, border))
  log(s, `⚠️ ${THREATS[s.era].name} à vista… ataque no próximo turno!`)
}

function destroyRandom(s: State) {
  const ks = Object.keys(s.tiles).filter(k => s.tiles[k].building)
  if (!ks.length) return
  const k = pick(s, ks)
  log(s, `${BUILDINGS[s.tiles[k].building!.id].name} foi destruída.`)
  delete s.tiles[k].building
}

function applyEffect(s: State, e: Effect, label: string) {
  for (const [r, v] of Object.entries(e.res ?? {}) as [Res, number][]) s.res[r] += v
  if (e.actions) s.actions += e.actions
  if (e.pop) s.pop = Math.max(0, Math.min(housing(s), s.pop + e.pop))
  if (e.happy) addMod(s, label, { happy: e.happy.amount }, e.happy.turns)
  if (e.foodMult) addMod(s, label, { foodMult: e.foodMult.mult }, e.foodMult.turns)
  if (e.eatMult) addMod(s, label, { eatMult: e.eatMult.mult }, e.eatMult.turns)
  if (e.warn) warn(s)
  if (e.destroy) destroyRandom(s)
  if (e.flag) s.flags.push(e.flag)
  if (e.pollution) s.pollution = Math.max(0, Math.min(100, s.pollution + e.pollution))
}

export function resolveEvent(prev: State, i: number): State {
  if (!prev.event) throw new Error('Nenhum evento.')
  const card = EVENT_BY_ID[prev.event]
  const o = card.options[i]
  const err = canChoose(prev, o)
  if (err) throw new Error(err)
  const s = structuredClone(prev)
  applyEffect(s, o.effect, card.title)
  if (card.once) s.flags.push(`done:${card.id}`)
  s.event = null
  log(s, `${card.title}: ${o.label}.`)
  if (s.pop === 0) s.over = 'lost'
  return s
}

// ---------- ameaças ----------

const addBag = (s: State, b: Bag, k = 1) => {
  for (const [r, v] of Object.entries(b) as [Res, number][]) s.res[r] += v * k
}
const bagText = (b: Bag) => Object.entries(b).map(([r, v]) => `${v} ${RES[r as Res].icon}`).join(' + ')

function kill(s: State, inv: Invader, by: string) {
  const t = THREATS[inv.kind]
  addBag(s, t.loot)
  s.invaders = s.invaders.filter(i => i !== inv)
  log(s, `${by} derrotou ${t.icon} ${t.name} (+${bagText(t.loot)}).`)
}

// A tribo enfrenta um invasor no território: gasta ✋, causa dano (Quartéis aumentam).
export function hunt(prev: State, h: Hex): State {
  guard(prev)
  if (HUNT_COST > prev.actions) throw new Error(`Faltam ações: atacar custa ${HUNT_COST} ✋.`)
  const s = structuredClone(prev)
  const inv = s.invaders.filter(i => i.at === key(h)).sort((a, b) => a.hp - b.hp)[0]
  if (!inv) throw new Error('Nenhum invasor aqui.')
  s.actions -= HUNT_COST
  inv.hp -= huntDamage(s)
  if (inv.hp <= 0) kill(s, inv, 'A tribo')
  return s
}

// Sabotadores destroem a conexão mais valiosa que toca o hex onde estão (ferrovia > estrada > trilha).
function sabotage(s: State, inv: Invader) {
  const here = parse(inv.at)
  const edge = neighbors(here).map(n => edgeKey(here, n)).filter(e => s.links[e])
    .sort((a, b) => LINKS[s.links[b]].level - LINKS[s.links[a]].level)[0]
  if (!edge) return
  log(s, `🧨 Sabotadores destruíram uma ${LINKS[s.links[edge]].name.toLowerCase()}!`)
  delete s.links[edge]
}

function threats(s: State) {
  // Torres atiram primeiro.
  for (const [k, t] of Object.entries(s.tiles)) {
    const tw = done(t) ? BUILDINGS[t.building!.id].tower : undefined
    if (!tw) continue
    const target = s.invaders
      .filter(i => i.hp > 0 && distance(parse(i.at), parse(k)) <= tw.range)
      .sort((a, b) => a.hp - b.hp)[0]
    if (!target) continue
    target.hp -= tw.damage
    if (target.hp <= 0) kill(s, target, 'A torre')
  }

  // Invasores: atacam a construção onde estão, o Centro se estiverem ao lado, ou avançam 1 hex.
  // ponytail: não atacam a infraestrutura das bordas ainda; quando atacarem, ela desconecta o que depende dela.
  for (const inv of s.invaders) {
    const name = THREATS[inv.kind].name
    if (THREATS[inv.kind].sabotage) sabotage(s, inv)
    const here = parse(inv.at)
    const t = s.tiles[inv.at]
    if (t?.building) {
      t.building.hp -= inv.atk
      if (t.building.hp <= 0) {
        log(s, `${name}: destruíram ${BUILDINGS[t.building.id].name}.`)
        delete t.building
      }
      continue
    }
    if (distance(here) === 1) {
      s.centerHp -= inv.atk
      log(s, `🔥 ${name} atacam o Centro!`)
      continue
    }
    const next = neighbors(here).filter(n => s.tiles[key(n)]).sort((a, b) => distance(a) - distance(b))[0]
    if (next && distance(next) < distance(here)) inv.at = key(next)
  }
}

// ---------- mercado ----------

export const buyPrice = (s: State, r: Res) => Math.max(1, Math.round(s.prices[r]!))
export const sellPrice = (s: State, r: Res) => Math.max(1, Math.floor(s.prices[r]! * SELL_SPREAD))

// qty > 0 compra, qty < 0 vende. Comércio não gera dívida: só com 💰 e estoque disponíveis.
export function trade(prev: State, r: Res, qty: number): State {
  guard(prev)
  if (!RES[r].price) throw new Error('Não negociável.')
  if (RES[r].era > prev.era) throw new Error(`${RES[r].name} ainda não circula.`)
  const room = tradeLimit(prev) - prev.traded
  if (room <= 0) throw new Error(tradeLimit(prev) ? 'Limite de comércio do turno atingido.' : 'Precisa de um Mercado conectado.')
  const s = structuredClone(prev)
  const n = Math.min(Math.abs(qty), room)
  for (let i = 0; i < n; i++) {
    if (qty > 0) {
      const p = buyPrice(s, r)
      if (s.res.money < p) break
      s.res.money -= p
      s.res[r] += 1
      s.prices[r]! *= 1 + PRICE_STEP
    } else {
      if (s.res[r] < 1) break
      s.res.money += sellPrice(s, r)
      s.res[r] -= 1
      s.prices[r]! *= 1 - PRICE_STEP
    }
    s.traded += 1
  }
  if (s.traded === prev.traded) throw new Error(qty > 0 ? 'Falta 💰.' : `Sem ${RES[r].name.toLowerCase()} no estoque.`)
  return s
}

// A cada PRICE_EVERY turnos o preço volta metade do caminho até a base e oscila ±15%.
function drift(s: State) {
  for (const [r, d] of Object.entries(RES) as [Res, (typeof RES)[Res]][]) {
    if (!d.price) continue
    const p = s.prices[r]!
    s.prices[r] = Math.max(1, (p + (d.price - p) / 2) * (0.85 + roll(s) * 0.3))
  }
}

// ---------- contratos ----------

export const maxContracts = (s: State) => staffed(s).filter(k => BUILDINGS[s.tiles[k].building!.id].cat === 'comercio').length

function offer(s: State) {
  const pool = CONTRACTS.map((c, i) => [c, i] as const).filter(([c]) => c.era <= s.era)
  if (!pool.length) return
  const [c, i] = pick(s, pool)
  s.offers.push({ id: s.nextId++, def: i, left: { ...c.want }, turns: c.turns })
}

export function contractReward(s: State, c: Contract) {
  return Math.round(CONTRACTS[c.def].money * (1 + REP_BONUS * s.rep))
}

export function accept(prev: State, id: number): State {
  guard(prev)
  if (prev.contracts.length >= maxContracts(prev))
    throw new Error(maxContracts(prev) ? 'Limite de contratos ativos (1 por Mercado).' : 'Precisa de um Mercado conectado.')
  const s = structuredClone(prev)
  const i = s.offers.findIndex(c => c.id === id)
  if (i < 0) throw new Error('Contrato indisponível.')
  s.contracts.push(...s.offers.splice(i, 1))
  return s
}

// Recusar uma oferta: some e chega outra no lugar. Custa 1 ✋ para não virar roleta de contrato.
export const DECLINE_COST = 1
export function decline(prev: State, id: number): State {
  guard(prev)
  if (prev.actions < DECLINE_COST) throw new Error(`Faltam ações: recusar custa ${DECLINE_COST} ✋.`)
  const s = structuredClone(prev)
  const i = s.offers.findIndex(c => c.id === id)
  if (i < 0) throw new Error('Contrato indisponível.')
  s.actions -= DECLINE_COST
  s.offers.splice(i, 1)
  offer(s)
  return s
}

// Desistir de um contrato aceito: perde o que já entregou e metade da punição de deixar vencer (−⭐ em vez de −2×⭐).
export function abandon(prev: State, id: number): State {
  guard(prev)
  const s = structuredClone(prev)
  const c = s.contracts.find(x => x.id === id)
  if (!c) throw new Error('Contrato não encontrado.')
  const def = CONTRACTS[c.def]
  s.rep = Math.max(0, s.rep - def.rep)
  s.contracts = s.contracts.filter(x => x !== c)
  log(s, `🏳 Desistiu do contrato ${def.client}: −${def.rep} ⭐.`)
  return s
}

// Entrega o que houver no estoque (parcial permitido). Completo → 💰 + ⭐.
export function deliver(prev: State, id: number): State {
  guard(prev)
  const s = structuredClone(prev)
  const c = s.contracts.find(x => x.id === id)
  if (!c) throw new Error('Contrato não encontrado.')
  let moved = 0
  for (const [r, v] of Object.entries(c.left) as [Res, number][]) {
    const give = Math.min(Math.max(0, s.res[r]), v)
    s.res[r] -= give
    c.left[r] = v - give
    moved += give
  }
  if (Object.values(c.left).every(v => !v)) {
    const def = CONTRACTS[c.def]
    s.res.money += contractReward(s, c)
    s.rep += def.rep
    s.contracts = s.contracts.filter(x => x !== c)
    log(s, `✅ Contrato ${def.client} cumprido: +${contractReward(prev, c)} 💰, +${def.rep} ⭐.`)
  } else if (!moved) throw new Error('Nada para entregar no estoque.')
  return s
}

function contractsTick(s: State) {
  for (const c of s.contracts) c.turns -= 1
  for (const c of s.contracts.filter(x => x.turns <= 0)) {
    const def = CONTRACTS[c.def]
    s.rep = Math.max(0, s.rep - 2 * def.rep)
    log(s, `❌ Contrato ${def.client} falhou: −${2 * def.rep} ⭐.`)
  }
  s.contracts = s.contracts.filter(c => c.turns > 0)
  if (s.era < 1 || !count(s, 'market')) return
  if (s.turn % CONTRACT_EVERY === 0) s.offers.shift()
  while (s.offers.length < CONTRACT_OFFERS) offer(s)
}

// ---------- turno ----------

// Produção → Consumo → Sociedade → Ameaças → Anoitecer → Amanhecer (ver vault: Estrutura do Turno).
export function endTurn(prev: State): State {
  guard(prev)
  const s = structuredClone(prev)

  // Produção (inclui o imposto 💰)
  const p = production(prev)
  for (const r of Object.keys(p) as Res[]) s.res[r] += p[r]
  s.luxury = s.res.pottery >= 1
  if (s.luxury) s.res.pottery -= 1

  // Consumo
  s.res.food -= eaten(prev)
  if (s.res.food < 0) {
    // Fome não vira dívida: metade de quem ficou sem comer vai embora, e a cidade fica abalada por 3 turnos.
    // (Dívida de 🍖 acumulava, zerava a 😊 e derrubava a produção sem volta — ver vault: Playtest.)
    const gone = Math.min(s.pop, Math.ceil(-s.res.food / 2))
    s.pop -= gone
    log(s, `Fome! ${gone} 👤 partiram.`)
    s.res.food = 0
    s.mods = s.mods.filter(m => m.label !== 'Fome').concat({ label: 'Fome', turns: 3, happy: -10 })
  }
  const surplus = p.food - eaten(prev)

  s.pollution = Math.max(0, Math.min(100, prev.pollution + pollutionDelta(prev)))

  threats(s)

  // Anoitecer: obras avançam, efeitos temporários expiram.
  for (const t of Object.values(s.tiles)) {
    if (!t.building || t.building.turnsLeft === 0) continue
    t.building.turnsLeft -= 1
    if (t.building.turnsLeft === 0) {
      log(s, `${BUILDINGS[t.building.id].name} concluída.`)
    }
  }

  // Moradores chegam aos poucos às vagas, conforme a sobra de comida: 1 👤 a cada 2 🍖 de sobra (mín. 1 com estoque).
  // Antes a casa pronta enchia de uma vez e a comida não acompanhava (ondas de fome — ver vault: Playtest).
  const gap = housing(s) - s.pop
  if (gap > 0 && s.res.food > 0) s.pop += Math.min(gap, Math.max(1, Math.floor(surplus / 2)))
  s.mods = s.mods.map(m => ({ ...m, turns: m.turns - 1 })).filter(m => m.turns > 0)

  // Amanhecer: o Centro se recupera 1 ❤️ se não há invasor encostado.
  if (!s.invaders.some(i => distance(parse(i.at)) <= 1)) s.centerHp = Math.min(centerMax(s), s.centerHp + 1)
  s.turn += 1
  s.traded = 0
  const th = THREATS[s.era] // força cresce com a era, não com o turno
  for (const at of s.warnings) {
    s.invaders.push({ id: s.nextId++, at, hp: th.hp, atk: th.atk, kind: s.era })
    log(s, `${th.icon} ${th.name} chegaram!`)
  }
  s.warnings = []
  if (s.turn >= THREAT_FROM_TURN && roll(s) < THREAT_CHANCE * (s.opts?.threats ?? 1)) warn(s)
  if (s.turn % PRICE_EVERY === 0 && s.opts?.market !== 'estavel') drift(s)
  contractsTick(s)
  if (s.turn % EVENT_EVERY === 0) s.event = draw(s)

  // ✋ que sobram passam para o próximo turno, até o dobro do máximo (junta ações para obras grandes).
  s.actions = Math.min(2 * maxActions(s), prev.actions + maxActions(s))
  if (s.pop <= 0 || s.centerHp <= 0) s.over = 'lost'
  return s
}

// ---------- era ----------

export function eraGoals(s: State) {
  const g = ERAS[s.era].goal
  const pace = s.opts?.pace ?? 1
  return [
    { kind: 'knowledge' as const, label: 'Conhecimento', have: s.res.knowledge, need: Math.round(g.knowledge * pace) },
    { kind: 'pop' as const, label: 'População', have: s.pop, need: Math.round(g.pop * pace) },
    { kind: g.building, label: BUILDINGS[g.building].name, have: count(s, g.building), need: 1 },
  ]
}

// Decisão do jogador: o mapa e as construções ficam; novas construções e melhorias são liberadas.
// O Centro evolui junto (mais vida, restaurada).
// Depois da vitória: a partida segue sem fim (sandbox) no mesmo tabuleiro.
export function keepPlaying(prev: State): State {
  return { ...prev, over: null, flags: [...prev.flags, 'sandbox'] }
}

export function advanceEra(prev: State): State {
  guard(prev)
  if (!eraGoals(prev).every(g => g.have >= g.need)) throw new Error('Requisitos da era incompletos.')
  const s = structuredClone(prev)
  if (s.era === ERAS.length - 1) {
    if (s.flags.includes('sandbox')) throw new Error('Civilização já concluída.')
    return { ...s, over: 'won' }
  }
  s.era += 1
  s.centerHp = centerMax(s)
  log(s, `A tribo entra na Era ${ERAS[s.era].name}!`)
  return s
}
