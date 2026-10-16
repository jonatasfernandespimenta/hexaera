import { expect, test } from 'vitest'
import {
  abandon, accept, advanceEra, build, decline, eraGoals, housing, idle, keepPlaying, maxActions, buildLink, deliver, endTurn, hunt, offGrid, staffed, stopped, trade, linkCost, run, pollutionDelta, explore, exploreCost, happiness, hiddenHexes, newGame, production, resolveEvent, terrainAt,
  type State,
} from './game'
import { neighbors } from './hex'

const ring1 = neighbors({ q: 0, r: 0 })
const find = (s: State, t: string) => ring1.find(h => terrainAt(s.seed, h) === t)!
const k = (h: { q: number; r: number }) => `${h.q},${h.r}`
const put = (s: State, at: string, terrain: any, id?: any) => {
  s.tiles[at] = { terrain, building: id ? { id, turnsLeft: 0, hp: 3 } : undefined }
}

test('início: 6 ocultos, 6 ações (3 + 3 ociosos), anel 1 tem rio', () => {
  const s = newGame(1)
  expect(hiddenHexes(s)).toHaveLength(6)
  expect(s.actions).toBe(6)
  expect(find(s, 'river')).toBeDefined()
})

test('custo de exploração = anel + terreno', () => {
  const s = newGame(1)
  expect(exploreCost(s, find(s, 'plains'))).toBe(1)
  expect(exploreCost(s, find(s, 'forest'))).toBe(2)
  expect(exploreCost(s, find(s, 'mountain'))).toBe(4)
})

test('explorar desconta ações e revela; não-vizinho falha', () => {
  let s = newGame(1)
  s = explore(s, find(s, 'plains'))
  expect(s.actions).toBe(5)
  expect(() => explore(s, { q: 5, r: 0 })).toThrow()
})

test('derrubar floresta dá madeira; cabana traz moradores', () => {
  let s = newGame(1)
  const w = find(s, 'forest')
  s = build(explore(s, w), w, 'hut')
  expect(s.tiles[k(w)].terrain).toBe('plains')
  expect(s.res.wood).toBe(3) // 3 - 3 da cabana + 3 da floresta
  s.res.food = 20
  s = endTurn(s)
  expect(s.pop).toBe(4) // moradores chegam aos poucos (sem sobra de 🍖: 1 por turno)
  s = endTurn(s)
  expect(s.pop).toBe(5)
  const m = find(s, 'mountain')
  expect(() => build(explore(newGame(1), m), m, 'farm')).toThrow('exige')
})

test('cadeia: barreiro → olaria → cerâmica', () => {
  const s = newGame(1)
  put(s, '1,0', 'river', 'claypit')
  put(s, '0,1', 'plains', 'kiln')
  const p = production(s)
  expect(p.clay).toBe(0) // 2 produzidas, 2 consumidas
  expect(p.pottery).toBe(1)
})

test('felicidade: totem soma, fome reduz e derruba a produção', () => {
  const s = newGame(1)
  put(s, '1,0', 'plains', 'totem')
  expect(happiness(s)).toBe(55)
  put(s, '0,1', 'plains', 'farm')
  s.mods.push({ label: 'x', turns: 2, happy: -45 })
  expect(happiness(s)).toBe(10)
  expect(production(s).food).toBe(1) // 3 × 50%
})

test('lobo avança, ataca a fogueira; torre abate', () => {
  let s = newGame(1)
  put(s, '1,0', 'plains'); put(s, '2,0', 'plains')
  s.invaders.push({ id: 1, at: '2,0', hp: 2, atk: 1, kind: 0 })
  s = endTurn(s)
  expect(s.invaders[0].at).toBe('1,0')
  s = endTurn(s)
  expect(s.centerHp).toBe(9)
  put(s, '1,-1', 'plains', 'tower')
  s = endTurn(endTurn(s))
  expect(s.invaders).toHaveLength(0)
})

test('evento: bloqueia ações; escolha aplica efeito e flag', () => {
  let s = newGame(1)
  s.event = 'tribo'
  s.res.food = 10
  expect(() => endTurn(s)).toThrow('evento')
  s = resolveEvent(s, 1)
  expect(s.res.food).toBe(6)
  expect(s.flags).toContain('amizade')
  expect(s.event).toBeNull()
  s.event = 'viajante'
  expect(() => resolveEvent(s, 2)).toThrow('Ancião')
})

test('avançar de era exige conhecimento, população e olaria', () => {
  const s = newGame(1)
  expect(() => advanceEra(s)).toThrow()
  s.res.knowledge = 20; s.pop = 10
  put(s, '1,0', 'plains', 'kiln')
  put(s, '0,1', 'plains', 'hut')
  const b = advanceEra(s)
  expect(b.over).toBeNull()
  expect(b.era).toBe(1)
  expect(b.tiles).toEqual(s.tiles) // o tabuleiro permanece
})

test('melhoria no mesmo hex ou do zero; construções antigas continuam disponíveis', () => {
  let s = newGame(1)
  put(s, '0,1', 'plains', 'hut')
  put(s, '1,-1', 'plains')
  s.res.clay = 9; s.res.wood = 9; s.actions = 9
  expect(() => build(s, { q: 0, r: 1 }, 'house')).toThrow('Bronze') // era errada
  s.era = 1
  s.pop = 5
  s = build(s, { q: 0, r: 1 }, 'house') // melhoria: +2 👤 (4 − 2 da cabana)
  s = build(s, { q: 1, r: -1 }, 'house') // do zero, sem cabana: +4 👤
  expect(s.tiles['0,1'].building!.up).toBe(true)
  expect(s.tiles['1,-1'].building!.up).toBeUndefined()
  s.res.food = 50
  s = endTurn(s)
  expect(s.tiles['0,1'].building!.turnsLeft).toBe(0)
  expect(s.tiles['1,-1'].building!.turnsLeft).toBe(0)
  expect(housing(s)).toBe(3 + 4 + 4) // melhoria troca a cabana; a do zero soma
})

test('fome reduz população; zero = fim de jogo', () => {
  let s = newGame(1)
  for (let i = 0; i < 10 && !s.over; i++) {
    if (s.event) s = resolveEvent(s, s.event === 'nascimentos' ? 0 : 1)
    else s = endTurn(s)
  }
  expect(s.over).toBe('lost')
})

test('dívida: constrói sem recursos, saldo negativo persiste e custa 😊', () => {
  let s = newGame(1)
  const m = find(s, 'mountain')
  s.actions = 99
  s = build(explore(s, m), m, 'quarry') // custa 2 🪵, tem 3
  s.res.wood = 0
  const p = find(s, 'plains')
  s = build(explore(s, p), p, 'hut') // fica devendo 3 🪵
  expect(s.res.wood).toBe(-3)
  expect(happiness(s)).toBe(44) // 50 − 2 × 3
  s.res.food = 99
  s = endTurn(s)
  expect(s.res.wood).toBe(-3) // nada produziu madeira: a dívida continua
})

test('a tribo ataca um lobo gastando ✋', () => {
  let s = newGame(1)
  s.invaders = [{ id: 1, at: '1,0', hp: 2, atk: 1, kind: 0 }]
  s = hunt(s, { q: 1, r: 0 })
  expect(s.actions).toBe(4)
  expect(s.invaders[0].hp).toBe(1)
  s = hunt(s, { q: 1, r: 0 })
  expect(s.invaders).toHaveLength(0)
  expect(s.res.food).toBe(7)
  expect(() => hunt(s, { q: 1, r: 0 })).toThrow()
})

test('logística: produção longe do Centro rende metade sem trilha; mina pede estrada; moradia não precisa', () => {
  let s = newGame(1)
  put(s, '1,0', 'plains')
  put(s, '2,0', 'plains', 'farm')
  expect(offGrid(s, '2,0')).toBe('sem trilha até o Centro')
  expect(staffed(s)).toContain('2,0')
  expect(production(s).food).toBe(1) // ⌊3 × ½⌋
  put(s, '0,2', 'plains', 'hut')
  expect(offGrid(s, '0,2')).toBeNull()
  s.actions = 9
  s = buildLink(s, { q: 1, r: 0 }, { q: 2, r: 0 }, 'trail')
  expect(staffed(s)).toContain('2,0')
  expect(production(s).food).toBe(3)

  put(s, '3,0', 'mountain', 'mine')
  s.era = 2; s.pop = 10; s.actions = 20
  s = buildLink(s, { q: 2, r: 0 }, { q: 3, r: 0 }, 'trail')
  expect(offGrid(s, '3,0')).toBe('sem estrada até o Centro')
  expect(linkCost(s, { q: 2, r: 0 }, { q: 3, r: 0 }, 'road')).toEqual({ actions: 2, cost: { stone: 2 } }) // montanha dobra; melhoria paga a diferença
  s = buildLink(s, { q: 2, r: 0 }, { q: 3, r: 0 }, 'road')
  expect(offGrid(s, '3,0')).toBe('sem estrada até o Centro') // falta 1,0 → 2,0
  s = buildLink(s, { q: 1, r: 0 }, { q: 2, r: 0 }, 'road')
  expect(offGrid(s, '3,0')).toBeNull()
})

test('mercado: compra/venda move o preço; contrato paga 💰 e ⭐', () => {
  let s = newGame(1)
  put(s, '1,0', 'plains', 'market')
  s.era = 1; s.res.wood = 30; s.res.money = 0
  s = trade(s, 'wood', -5)
  expect(s.res.wood).toBe(25)
  expect(s.res.money).toBeGreaterThan(10)
  expect(s.prices.wood!).toBeLessThan(4)
  s = endTurn({ ...s, res: { ...s.res, food: 50 } })
  if (s.event) s.event = null
  expect(s.offers).toHaveLength(3)
  s.offers[0] = { id: 999, def: 0, left: { wood: 20 }, turns: 5 } // Caravana: 20 🪵
  s = accept(s, 999)
  const money = s.res.money
  s = deliver(s, 999)
  expect(s.contracts).toHaveLength(0)
  expect(s.res.money).toBe(money + 120)
  expect(s.rep).toBe(1)

  // Recusar troca a oferta por outra (1 ✋); desistir custa ⭐ (metade de deixar vencer).
  s.actions = 2
  const old = s.offers[1].id, n = s.offers.length
  s = decline(s, old)
  expect(s.offers.map(c => c.id)).not.toContain(old)
  expect(s.offers).toHaveLength(n)
  expect(s.actions).toBe(1)
  s.rep = 5
  s.offers[0] = { id: 998, def: 0, left: { wood: 20 }, turns: 5 }
  s = abandon(accept(s, 998), 998)
  expect(s.contracts).toHaveLength(0)
  expect(s.rep).toBe(4)
})

test('energia: usina queima carvão e alimenta a siderúrgica; sem usina, para', () => {
  const s = newGame(1)
  s.era = 4; s.pop = 20
  put(s, '1,0', 'plains', 'steelworks')
  s.links['0,0|1,0'] = 'rail' // anel 1 já é ligado, a ferrovia é só para deixar explícito
  Object.assign(s.res, { coal: 10, iron: 10 })
  expect(stopped(s)['1,0']).toBe('sem energia')
  expect(run(s).out.steel).toBe(0)
  put(s, '0,1', 'plains', 'powerplant')
  const r = run(s)
  expect(r.supply).toBe(8)
  expect(r.used).toBe(4)
  expect(r.out.steel).toBe(2)
  expect(r.out.coal).toBe(-4) // 2 da usina + 2 da siderúrgica
})

test('poluição: indústria suja, floresta limpa, 😊 cai ☁️/2', () => {
  let s = newGame(1)
  s.era = 4; s.pop = 20; s.res.coal = 50; s.res.food = 99
  put(s, '0,1', 'plains', 'powerplant')
  const forests = Object.values(s.tiles).filter(t => t.terrain === 'forest').length
  expect(pollutionDelta(s)).toBe(4 - forests)
  const h = happiness(s)
  s.pollution = 40
  expect(happiness(s)).toBe(h - 20)
})

test('sabotadores destroem a ferrovia do hex onde estão', () => {
  let s = newGame(1)
  s.res.food = 99
  put(s, '1,0', 'plains'); put(s, '2,0', 'plains')
  s.links['1,0|2,0'] = 'rail'
  s.invaders = [{ id: 1, at: '2,0', hp: 6, atk: 3, kind: 4 }]
  s = endTurn(s)
  expect(s.links['1,0|2,0']).toBeUndefined()
})

test('moderna/contemporânea: hidrelétrica sem insumo, 👤 ocioso vale 2 ✋, Marco Final conclui e dá para continuar', () => {
  let s = newGame(1)
  s.era = 5; s.pop = 20
  put(s, '1,0', 'river', 'hydro')
  put(s, '0,1', 'plains', 'electronics')
  Object.assign(s.res, { goods: 5, oil: 5 })
  const r = run(s)
  expect(r.supply).toBe(12)
  expect(r.out.electronics).toBe(2)
  expect(maxActions(s)).toBe(3 + Math.floor(idle(s) * 2))

  s.era = 6
  Object.assign(s.res, { knowledge: 1300 }); s.pop = 160
  expect(() => advanceEra(s)).toThrow('incompletos')
  put(s, '-1,0', 'plains', 'landmark')
  s = advanceEra(s)
  expect(s.over).toBe('won')
  s = keepPlaying(s)
  expect(s.over).toBeNull()
  expect(() => advanceEra(s)).toThrow('concluída')
})

test('✋ que sobram passam para o próximo turno, até o dobro do máximo', () => {
  let s = newGame(1)
  s.res.food = 50
  const max = maxActions(s)
  s.actions = 2
  s = endTurn(s)
  if (s.event) s.event = null
  expect(s.actions).toBe(Math.min(2 * maxActions(s), 2 + maxActions(s)))
  s.actions = 99
  s = endTurn(s)
  expect(s.actions).toBe(2 * maxActions(s))
  expect(max).toBeGreaterThan(0)
})

test('sandbox: era inicial com estoque, sem invasões, produção e metas ajustáveis, sem mercado', () => {
  let s = newGame(7, { threats: 0, abundance: 1.5, pace: 0.5, market: 'off', era: 4 })
  expect(s.era).toBe(4)
  expect(s.res.steel).toBe(30)
  expect(s.flags).toContain('sandbox')
  expect(eraGoals(s)[0].need).toBe(250) // 500 × 0,5
  put(s, '1,0', 'plains', 'farm')
  expect(production(s).food).toBe(4) // ⌊3 × 1,5⌋
  put(s, '0,1', 'plains', 'market')
  expect(() => trade(s, 'wood', -1)).toThrow('Mercado')
  for (let i = 0; i < 40; i++) { s = endTurn({ ...s, res: { ...s.res, food: 99 } }); if (s.event) s.event = null }
  expect(s.invaders.length + s.warnings.length).toBe(0)
})
