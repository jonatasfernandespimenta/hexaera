import { expect, test } from 'vitest'
import { ERAS, TROOP_COST } from './data'
import { EVENT_BY_ID } from './events'
import { canChoose, eraGoals, endTurn, hiddenHexes, newGame, recruit, resolveEvent } from './game'
import { neutral, newMatchGame, normalize } from './match'

test('fronteira neutra: assento 0 não explora rumo ao rival', () => {
  const s = newMatchGame(5, 'versus', 0, true)
  expect(neutral(s, { q: 3, r: 0 })).toBe(false)
  expect(neutral(s, { q: 4, r: 0 })).toBe(true)
  expect(neutral(s, { q: -6, r: 0 })).toBe(false)
  expect(hiddenHexes(s).some(h => neutral(s, h))).toBe(false)
})
test('assentos têm mapas diferentes e rivais espelhados', () => {
  const a = newMatchGame(5, 'coop', 0, false), b = newMatchGame(5, 'coop', 1, false)
  expect(a.seed).not.toBe(b.seed)
  expect(a.match!.rival).toEqual({ q: 10, r: 0 })
  expect(b.match!.rival).toEqual({ q: -10, r: 0 })
  expect(a.flags).not.toContain('sandbox')
})
test('versus: sem invasões aleatórias nem cartas de ataque/destruição', () => {
  let s = newMatchGame(5, 'versus', 0, true)
  const drawn: string[] = []
  for (let i = 0; i < 120 && !s.over; i++) {
    s = endTurn(s)
    if (s.event) {
      drawn.push(s.event)
      const idx = EVENT_BY_ID[s.event].options.findIndex(o => canChoose(s, o) === null)
      s = resolveEvent(s, idx)
    }
  }
  expect(drawn.length).toBeGreaterThan(0)
  expect(s.warnings).toEqual([])
  expect(drawn.every(id => !EVENT_BY_ID[id].options.some(o => o.effect.warn || o.effect.destroy))).toBe(true)
})
test('ritmo rápido reduz metas', () => {
  expect(eraGoals(newMatchGame(5, 'versus', 0, true))[0].need).toBeLessThan(ERAS[0].goal.knowledge)
})
test.todo('coop normal mantém metas (Task 5: need === goal.knowledge * 2)')
test('save antigo sem campos novos é normalizado', () => {
  const old: any = newGame(1); delete old.troops; delete old.away; delete old.raids
  const s = normalize(old)
  expect([s.troops, s.away, s.raids]).toEqual([0, [], []])
})

// Partida online com Campo de guerra pronto, recursos e ✋ de sobra.
const camp = () => {
  const s = newMatchGame(5, 'coop', 0, false)
  s.tiles['1,0'] = { terrain: 'plains', building: { id: 'warcamp', turnsLeft: 0, hp: 5 } }
  s.pop = 4; s.actions = 6; s.res.food = 50; s.res.money = 50
  return s
}
test('recrutar: −1 👤, +1 tropa, custa TROOP_COST e 1 ✋', () => {
  const s = camp(), t = recruit(s)
  expect([t.pop, t.troops, t.actions]).toEqual([s.pop - 1, 1, s.actions - 1])
  expect(t.res.money).toBe(s.res.money - TROOP_COST.money!)
  expect(t.res.food).toBe(s.res.food - TROOP_COST.food!)
})
test('recrutar exige Campo de guerra e deixa ao menos 1 👤', () => {
  const semCampo = camp(); delete semCampo.tiles['1,0'].building
  expect(() => recruit(semCampo)).toThrow()
  expect(() => recruit({ ...camp(), pop: 1 })).toThrow()
})
test('fora de partida online não recruta', () => {
  const solo: any = camp(); delete solo.match
  expect(() => recruit(solo)).toThrow()
})
test('tropas comem 1 🍖 por turno', () => {
  const sem = camp(), com = camp(); com.troops = 3
  expect(endTurn(com).res.food).toBe(endTurn(sem).res.food - 3)
})
test('tropa em casa absorve o golpe no Centro e morre', () => {
  const s = camp(); s.troops = 2
  s.invaders = [{ id: 1, kind: 1, at: '1,0', hp: 3, atk: 2 }]
  s.tiles['1,0'] = { terrain: 'plains' }
  const t = endTurn(s)
  expect(t.centerHp).toBe(s.centerHp)
  expect(t.troops).toBe(1)
})
