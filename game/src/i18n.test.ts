import { expect, test } from 'vitest'
import { BUILDINGS, CONTRACTS, ERAS, LINKS, RES, TERRAINS, THREATS } from './core/data'
import { EVENTS } from './core/events'
import { EN } from './en'
import { STEPS } from './Tutorial'

// Todo texto com letras precisa de tradução (os só com números/ícones passam direto).
const words = (s: string) => /[a-zà-ú]{2,}/i.test(s) && !/^[a-z]+$/.test(s) // ids ('trail', 'won') ficam de fora

test('i18n: todo texto tem tradução em inglês', () => {
  const keys = [
    ...Object.values(BUILDINGS).flatMap(b => [b.name, b.desc]),
    ...[...Object.values(RES), ...Object.values(TERRAINS), ...Object.values(LINKS), ...THREATS].map(o => o.name),
    ...ERAS.flatMap(e => [e.name, e.center]), ...CONTRACTS.map(c => c.client),
    ...EVENTS.flatMap(e => [e.title, e.text, ...e.options.flatMap(o => [o.label, o.text])]),
    ...STEPS.flatMap(s => [s.title, s.text]),
  ]
  // Literais dentro de t(…)/tr(…) no código, inclusive os de ternários.
  const files = import.meta.glob<string>(['./App.tsx', './Trade.tsx', './Tutorial.tsx', './scene/Board.tsx', './core/game.ts',
    './Lobby.tsx', './OnlineHud.tsx', './onlineView.ts', './useOnline.ts', './net.ts', './core/convoy.ts'], { query: '?raw', import: 'default', eager: true })
  for (const src of Object.values(files)) {
    for (const [, call] of src.matchAll(/\btr?\(((?:[^()']|'[^']*')*)\)/g))
      for (const [, s] of call.matchAll(/'([^']*)'/g)) keys.push(s)
  }
  // Erros da API: o servidor responde em português e o cliente traduz (net.ts).
  const server = import.meta.glob<string>(['./server/*.ts', '!./server/*.test.ts'], { query: '?raw', import: 'default', eager: true })
  for (const src of Object.values(server))
    for (const [, a, b] of src.matchAll(/HttpError\(\d+, '([^']*)'\)|error: '([^']*)'/g)) keys.push(a ?? b)
  // Rótulos das comitivas (OnlineHud: KIND_LABEL, traduzido na hora).
  const hud = Object.values(files).find(src => src.includes('KIND_LABEL'))!
  for (const [, s] of hud.match(/KIND_LABEL[^{]*\{([^}]*)\}/)![1].matchAll(/'([^']*)'/g)) keys.push(s)
  expect(keys.filter(k => words(k) && !(k in EN))).toEqual([])
})
