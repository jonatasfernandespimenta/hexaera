import { expect, test } from 'vitest'
import { advanceEra, build, endTurn, explore, hunt, newGame, resolveEvent, terrainAt, trade, type State } from './core/game'
import { neighbors, parse } from './core/hex'
import { STEPS } from './Tutorial'

// Joga o tutorial inteiro com as ações pedidas e confere que cada passo se completa.
test('tutorial: todos os passos são completáveis', () => {
  for (const seed of [1, 7, 42, 1234]) {
    let s: State = newGame(seed)
    const ui = { panel: null as string | null, mode: null as string | null }
    const plains = neighbors({ q: 0, r: 0 }).find(h => terrainAt(s.seed, h) === 'plains')!
    const doIt: Record<string, () => void> = {
      'Explore': () => { s = explore(s, plains) },
      'Sua mão de cartas': () => { ui.mode = 'farm' },
      'Construa': () => { s = build(s, plains, 'farm'); ui.mode = null },
      'Fim do turno': () => { s = endTurn(s) },
      'Eventos': () => { s = resolveEvent(s, 1) },
      'Metas da era': () => { s = advanceEra(s) },
      'O Mercado': () => { ui.panel = 'trade' },
      'Compre ou venda': () => { s = trade(s, 'wood', -1) },
      'Invasores!': () => { while (s.invaders.length) s = hunt(s, parse(s.invaders[0].at)) },
    }
    for (const step of STEPS) {
      s = step.setup?.(s) ?? s
      const start = s
      if (!step.done) continue
      expect(step.done(s, start, ui), step.title).toBe(false)
      doIt[step.title]()
      expect(step.done(s, start, ui), step.title).toBe(true)
    }
  }
})
