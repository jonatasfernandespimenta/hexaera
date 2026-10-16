import { describe, expect, it } from 'vitest'
import type { Convoy } from './core/convoy'
import { distance, toWorld } from './core/hex'
import { neutral, newMatchGame, RIVAL_DISTANCE } from './core/match'
import { autoOption, carriers, convoyFraction, convoyMarkers, endText, neutralStrip, shouldFire, shouldResolve } from './onlineView'

const cv = (o: Partial<Convoy>): Convoy => ({ id: 'x', kind: 'army', sent: 2, arrive: 6, n: 3, ...o })

describe('convoyFraction', () => {
  it('anda de 0 a 1 entre o envio e a chegada', () => {
    expect(convoyFraction(cv({}), 2)).toBe(0)
    expect(convoyFraction(cv({}), 4)).toBe(0.5)
    expect(convoyFraction(cv({}), 6)).toBe(1)
  })
  it('some depois da chegada', () => expect(convoyFraction(cv({}), 7)).toBeNull())
  it('antes do envio fica na origem', () => expect(convoyFraction(cv({}), 1)).toBe(0))
})

describe('convoyMarkers', () => {
  const rival = { q: RIVAL_DISTANCE, r: 0 }
  const [rx, rz] = toWorld(rival)
  it('as minhas saem do meu Centro; as do rival saem do Centro dele', () => {
    const [mine, theirs] = convoyMarkers(rival, [cv({ id: 'a' })], [cv({ id: 'b', kind: 'aid', n: 2 })], 3)
    expect(mine).toMatchObject({ id: 'a', mine: true, n: 3 })
    expect(mine.x).toBeCloseTo(rx * 0.25)
    expect(mine.z).toBeCloseTo(rz * 0.25)
    expect(theirs).toMatchObject({ id: 'b', mine: false, kind: 'aid', n: 2 })
    expect(theirs.x).toBeCloseTo(rx * 0.75)
  })
  it('esconde as que já chegaram e soma a carga', () => {
    const ms = convoyMarkers(rival, [cv({ arrive: 3 }), cv({ id: 'c', kind: 'cargo', n: undefined, bag: { wood: 5, stone: 4 } })], [], 4)
    expect(ms).toHaveLength(1)
    expect(ms[0]).toMatchObject({ id: 'c', n: 9 })
  })
})

describe('neutralStrip', () => {
  const s = newMatchGame(1, 'versus', 0, false)
  const hs = neutralStrip(s)
  it('só hexes neutros dos dois lados, perto das duas cidades', () => {
    expect(hs.length).toBeGreaterThanOrEqual(30)
    expect(hs.length).toBeLessThanOrEqual(60)
    for (const h of hs) {
      expect(neutral(s, h)).toBe(true)
      expect(distance(h, s.match!.rival)).toBeGreaterThanOrEqual(distance(h) - 2) // neutro para o rival também
      expect(distance(h)).toBeLessThanOrEqual(RIVAL_DISTANCE)
    }
  })
  it('espelhado para o assento 1', () => {
    expect(neutralStrip(newMatchGame(1, 'versus', 1, false))).toHaveLength(hs.length)
  })
  it('vazio fora de partida online', () => {
    const solo = { ...s, match: undefined }
    expect(neutralStrip(solo)).toEqual([])
  })
})

describe('carriers', () => {
  it('arredonda para cima pela capacidade da era', () => {
    const s = newMatchGame(1, 'coop', 0, false)
    expect(carriers(s, {})).toBe(0)
    expect(carriers(s, { wood: 5 })).toBe(1)
    expect(carriers(s, { wood: 5, food: 1 })).toBe(2)
  })
})

describe('endText', () => {
  it('versus e coop', () => {
    expect(endText('versus', 'won', 'Ana')).toBe('Vitória — o Centro de Ana caiu')
    expect(endText('versus', 'lost', 'Ana')).toBe('Derrota — seu Centro caiu')
    expect(endText('coop', 'won', 'Ana')).toBe('Civilização concluída juntos')
    expect(endText('coop', 'lost', 'Ana')).toBe('Um Centro caiu — a dupla perdeu')
  })
})

describe('shouldFire', () => {
  const run = { fired: false, pending: false, retryAt: 0 }
  it('envia ao zerar, uma vez', () => {
    expect(shouldFire(0, run, false, 1000)).toBe(true)
    expect(shouldFire(1, run, false, 1000)).toBe(false)
    expect(shouldFire(0, { ...run, fired: true }, false, 1000)).toBe(false)
    expect(shouldFire(0, { ...run, pending: true }, false, 1000)).toBe(false)
  })
  it('espera o evento ser resolvido e então envia', () => {
    expect(shouldFire(0, run, true, 1000)).toBe(false)
    expect(shouldFire(0, run, false, 1001)).toBe(true)
  })
  it('depois de uma falha só tenta de novo após a pausa', () => {
    expect(shouldFire(0, { ...run, retryAt: 4000 }, false, 3999)).toBe(false)
    expect(shouldFire(0, { ...run, retryAt: 4000 }, false, 4000)).toBe(true)
  })
})

describe('evento aberto com o relógio zerado (AFK)', () => {
  const run = { fired: false, pending: false, retryAt: 0 }
  it('resolve só ao zerar, com evento aberto e sem envio pendente', () => {
    expect(shouldResolve(0, run, true)).toBe(true)
    expect(shouldResolve(1, run, true)).toBe(false)
    expect(shouldResolve(0, run, false)).toBe(false)
    expect(shouldResolve(0, { ...run, pending: true }, true)).toBe(false)
    expect(shouldResolve(0, { ...run, fired: true }, true)).toBe(false)
  })
  it('escolhe a primeira opção disponível', () => {
    const s = { ...newMatchGame(5, 'coop', 0, false), event: 'manada' }
    expect(autoOption(s)).toBe(0)
    expect(autoOption({ ...s, actions: 0 })).toBe(1) // Caçar custa 2 ✋
    expect(autoOption({ ...s, event: null })).toBeNull()
  })
})
