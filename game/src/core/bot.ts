// Robô de playtest: joga usando só a API pública do jogo, com regras simples de prioridade.
// Não é para ser ótimo — é um jogador "razoável" que revela onde o ritmo trava (ver vault: Playtest).
import { BUILDINGS, ERAS, HUNT_COST, LINKS, RES, type BuildingId, type Link, type Res } from './data'
import { EVENT_BY_ID } from './events'
import {
  accept, advanceEra, buildLink, build, canChoose, canLink, canPlace, count, deliver, endTurn, eraGoals, explore, exploreCost,
  happiness, hiddenHexes, housing, hunt, maxActions, trade, tradeLimit, buyPrice, huntDamage, income, linkCost, linked, maxContracts, newGame, offGrid, resolveEvent, run, type State,
} from './game'
import { distance, key, neighbors, parse, type Hex } from './hex'

const ids = Object.keys(BUILDINGS) as BuildingId[]
const avail = (s: State) => ids.filter(id => BUILDINGS[id].era <= s.era)
const newest = (a: BuildingId, b: BuildingId) => BUILDINGS[b].era - BUILDINGS[a].era
const underway = (s: State, id: BuildingId) => Object.values(s.tiles).some(t => t.building?.id === id && t.building.turnsLeft > 0)
const has = (s: State, id: BuildingId) => count(s, id) > 0 || underway(s, id)
const fits = (s: State, cost: Partial<Record<Res, number>>) => (Object.entries(cost) as [Res, number][]).every(([r, v]) => s.res[r] >= v)

// Melhor construção da lista que caiba no bolso (sem dívida) e tenha onde ficar, perto do Centro.
// Melhoria economiza hex; produção só melhora uma por vez, porque a obra para a antiga.
function tryBuild(s: State, list: BuildingId[]): State | null {
  for (const id of list) {
    const d = BUILDINGS[id]
    if (d.era > s.era || d.actions > s.actions) continue
    if (!fits(s, d.cost)) {
      // Sobra 💰: compra no Mercado o que falta (um lote por decisão).
      const miss = (Object.entries(d.cost) as [Res, number][]).find(([r, v]) => r !== 'money' && s.res[r] < v && RES[r].price && RES[r].era <= s.era)
      if (miss && tradeLimit(s) > s.traded && s.res.money > buyPrice(s, miss[0]) * (miss[1] - s.res[miss[0]]) * 2 + (d.cost.money ?? 0) + 200)
        try { return trade(s, miss[0], miss[1] - s.res[miss[0]]) } catch { /* sem como comprar */ }
      continue
    }
    // Produção só melhora uma de cada vez (a obra para a antiga).
    const upgrade = d.cat === 'moradia' || d.cat === 'defesa' || !Object.values(s.tiles).some(t => t.building?.up && t.building.turnsLeft > 0)
    const spots = Object.keys(s.tiles).map(parse).filter(h => !canPlace(s, h, id) && (upgrade || !s.tiles[key(h)].building))
      .sort((a, b) => (Number(!!s.tiles[key(b)].building) - Number(!!s.tiles[key(a)].building)) * (upgrade ? 1 : -1) || distance(a) - distance(b))
    if (spots.length) return build(s, spots[0], id)
  }
  return null
}

const producers = (s: State, r: Res) =>
  avail(s).filter(id => (BUILDINGS[id].produces?.[r] ?? 0) > 0).sort(newest)

// Persegue a cadeia: quer `res` → tenta um produtor; se ele não cabe no bolso, persegue o que falta para ele (até 3 níveis).
function chase(s: State, res: Res, depth = 0): State | null {
  if (depth > 3) return null
  for (const id of producers(s, res)) {
    const t = tryBuild(s, [id])
    if (t) return t
    const d = BUILDINGS[id]
    for (const [r, v] of Object.entries({ ...d.cost, ...d.consumes }) as [Res, number][])
      if (s.res[r] < v && r !== res) {
        const u = chase(s, r, depth + 1)
        if (u) return u
      }
  }
  return null
}

// Liga uma construção desconectada: caminho mais curto por hexes revelados até o anel 1, uma borda por vez.
function connect(s: State): State | null {
  const links = linked(s)
  for (const k of Object.keys(s.tiles)) {
    const b = s.tiles[k].building
    if (!b || b.turnsLeft > 0 || !offGrid(s, k, links)) continue
    const need: Link = BUILDINGS[b.id].link ?? 'trail'
    if (LINKS[need].era > s.era) continue
    const prev = new Map<string, string>([[k, k]])
    const queue = [k]
    let end: string | null = null
    while (queue.length && !end) {
      const u = queue.shift()!
      for (const v of neighbors(parse(u)).map(key)) {
        if (prev.has(v) || !s.tiles[v] || v === '0,0') continue
        prev.set(v, u)
        if (distance(parse(v)) === 1) { end = v; break }
        queue.push(v)
      }
    }
    for (let v = end; v && v !== k; v = prev.get(v)!) {
      const a = parse(v), c = parse(prev.get(v)!)
      if (canLink(s, a, c, need)) continue // já tem conexão boa nessa borda
      const { actions, cost } = linkCost(s, a, c, need)
      if (actions > s.actions || !fits(s, cost)) return null
      return buildLink(s, a, c, need)
    }
  }
  return null
}

const STOP = {} as State // sinal: encerrar o turno guardando ✋

// Uma decisão por chamada; null = nada útil a fazer neste turno.
export function step(s: State): State | null {
  if (s.event) {
    const opts = EVENT_BY_ID[s.event].options
    const i = opts.findIndex(o => !canChoose(s, o))
    return resolveEvent(s, Math.max(0, i))
  }
  const goals = eraGoals(s)
  if (goals.every(g => g.have >= g.need)) return advanceEra(s)

  // Defesa: ataca invasor que dá para matar logo.
  const inv = s.invaders.find(i => i.hp <= huntDamage(s) * 2 || distance(parse(i.at)) <= 1)
  if (inv && s.actions >= HUNT_COST) return hunt(s, parse(inv.at))

  // Contratos: entrega quando dá para fechar; aceita o que já tem metade no estoque.
  for (const c of s.contracts)
    if (fits(s, c.left)) return deliver(s, c.id)
  if (s.contracts.length < maxContracts(s)) {
    const o = s.offers.find(o => (Object.entries(o.left) as [Res, number][]).every(([r, v]) => s.res[r] * 2 >= v))
    if (o) return accept(s, o.id)
  }

  const inc = income(s)
  const r = run(s)
  // Espaço: sem hex livre (plano), explorar vira prioridade.
  const free = Object.keys(s.tiles).filter(k => !s.tiles[k].building && s.tiles[k].terrain === 'plains').length
  const scout = () => {
    const h = hiddenHexes(s).sort((a, b) => exploreCost(s, a) - exploreCost(s, b))[0]
    return h && exploreCost(s, h) <= s.actions ? explore(s, h) : null
  }
  const goal = ERAS[s.era].goal
  // Mercado: compra comida na fome e o que falta para a meta; vende excesso (>60) de matéria-prima.
  const market = () => {
    if (!tradeLimit(s) || s.traded >= tradeLimit(s)) return null
    if (s.res.food < 10 && s.res.money >= buyPrice(s, 'food') * 5) return trade(s, 'food', 5)
    // Compra o que falta para a construção-meta, se sobra 💰.
    if (!has(s, goal.building))
      for (const [r, v] of Object.entries(BUILDINGS[goal.building].cost) as [Res, number][])
        if (r !== 'money' && s.res[r] < v && s.res.money >= buyPrice(s, r) * 3 + 100) return trade(s, r, v - s.res[r])
    const extra = (['stone', 'wood', 'clay', 'bronze', 'coal', 'pottery'] as Res[]).find(r => s.res[r] > 60)
    return extra ? trade(s, extra, -5) : null
  }
  const need = (res: Res, want: number) => s.res[res] < want && inc[res] < 2 + s.era
  const supply = (res: Res) => tryBuild(s, producers(s, res))
  const tries: (() => State | null)[] = [
    () => (inc.food < 1 && s.res.food < 30 ? supply('food') : null),
    () => market(),
    () => (free < 2 ? scout() : null),
    () => (s.era >= 1 && !has(s, 'market') ? tryBuild(s, ['market']) : null),
    // Defesa: uma torre (a melhor da era) a cada 2 eras, e mais uma se há ataque anunciado.
    () => {
      const towers = Object.values(s.tiles).filter(t => t.building && BUILDINGS[t.building.id].tower).length
      if (towers >= 1 + s.era + (s.warnings.length ? 1 : 0)) return null
      return tryBuild(s, avail(s).filter(id => BUILDINGS[id].tower).sort(newest))
    },
    () => (r.unpowered.length ? tryBuild(s, avail(s).filter(id => BUILDINGS[id].power).sort(newest)) : null),
    // Meta pede mais ✋ do que o turno dá: constrói quem gera ✋ (Estábulo, Moinho).
    () => (!has(s, goal.building) && BUILDINGS[goal.building].actions > maxActions(s)
      ? tryBuild(s, avail(s).filter(id => BUILDINGS[id].actionsBonus).sort(newest)) : null),
    () => (has(s, goal.building) ? null : tryBuild(s, [goal.building])),
    // Meta cabe no bolso mas não nas ✋ deste turno: para de gastar e guarda para o próximo.
    () => (!has(s, goal.building) && fits(s, BUILDINGS[goal.building].cost) && s.actions < BUILDINGS[goal.building].actions
      && BUILDINGS[goal.building].actions <= 2 * maxActions(s) ? STOP : null),
    // Insumos da construção-meta: o custo dela e o que ela consome.
    () => {
      if (has(s, goal.building)) return null
      const d = BUILDINGS[goal.building]
      const want = { ...d.cost, ...d.consumes }
      for (const res of Object.keys(want) as Res[]) {
        const t = need(res, want[res]! * 2) ? chase(s, res) : null
        if (t) return t
      }
      return null
    },
    // Moradia só até a meta de 👤 da era (com folga); senão a madeira some em cabanas.
    () => (s.pop < goal.pop + 5 && (inc.food > 0 || s.res.food > 25) && housing(s) - s.pop <= 1 ? tryBuild(s, avail(s).filter(id => BUILDINGS[id].housing).sort(newest)) : null),
    () => (inc.knowledge * 25 < goal.knowledge - s.res.knowledge ? supply('knowledge') : null),
    () => connect(s),
    () => (happiness(s) < 45 ? tryBuild(s, avail(s).filter(id => (BUILDINGS[id].happy ?? 0) > 0).sort(newest)) : null),
    // Matéria-prima básica para continuar construindo.
    () => {
      for (const res of ['wood', 'stone', 'clay', 'iron', 'tools', 'coal', 'oil', 'steel', 'electronics'] as Res[])
        if (producers(s, res).length && need(res, 15)) {
          const t = supply(res)
          if (t) return t
        }
      return null
    },
    () => scout(), // sobrou ação: explora o hex mais barato
  ]
  for (const t of tries) {
    try {
      const n = t()
      if (n === STOP) return null
      if (n) return n
    } catch { /* ação inválida: tenta a próxima */ }
  }
  return null
}

export type Report = {
  seed: number
  outcome: 'won' | 'lost' | 'timeout'
  turns: number
  eraTurn: number[] // turno em que entrou em cada era
  waiting: Record<string, number>[] // por era: turnos esperando cada meta (o gargalo)
  cause?: string
  pop: number
  debtTurns: number
}

export function playGame(seed: number, maxTurns = 500): Report {
  let s = newGame(seed)
  const eraTurn = [1]
  const waiting: Record<string, number>[] = ERAS.map(() => ({}))
  let debtTurns = 0
  while (!s.over && s.turn <= maxTurns) {
    for (let n = 0; n < 40; n++) {
      const next = step(s)
      if (!next) break
      if (next.era > s.era) eraTurn[next.era] = s.turn
      s = next
      if (s.over) break
    }
    if (s.over) break
    for (const g of eraGoals(s)) if (g.have < g.need) waiting[s.era][g.label] = (waiting[s.era][g.label] ?? 0) + 1
    if (Object.values(s.res).some(v => v < 0)) debtTurns++
    s = endTurn(s)
  }
  return {
    seed, outcome: s.over ?? 'timeout', turns: s.turn, eraTurn, waiting, pop: s.pop, debtTurns,
    cause: s.over === 'lost' ? (s.centerHp <= 0 ? 'Centro destruído' : 'população zerou') : undefined,
  }
}
