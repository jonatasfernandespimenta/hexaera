import { test } from 'vitest'
import { ERAS } from './data'
import { playGame, type Report } from './bot'

const N = Number((globalThis as any).process?.env.N ?? 60)
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN)
const pct = (n: number) => `${Math.round((100 * n) / N)}%`

test(`playtest: ${N} partidas`, () => {
  const t0 = Date.now()
  const games: Report[] = Array.from({ length: N }, (_, i) => playGame(1000 + i))
  const out: string[] = []
  const won = games.filter(g => g.outcome === 'won'), lost = games.filter(g => g.outcome === 'lost')
  out.push(`Partidas: ${N} · vitória ${pct(won.length)} · derrota ${pct(lost.length)} · tempo esgotado ${pct(N - won.length - lost.length)} · ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  if (won.length) out.push(`Turnos até vencer (mediana): ${median(won.map(g => g.turns))}`)
  const causes: Record<string, number> = {}
  for (const g of lost) causes[g.cause!] = (causes[g.cause!] ?? 0) + 1
  if (lost.length) out.push(`Derrotas: ${Object.entries(causes).map(([c, n]) => `${c} ${n}`).join(' · ')} · turno mediano ${median(lost.map(g => g.turns))}`)
  out.push(`Turnos em dívida (mediana por partida): ${median(games.map(g => g.debtTurns))}`)
  out.push('')
  out.push('Era            chegaram  turno de entrada (mediana)  duração (mediana)  gargalo (turnos esperando, mediana)')
  ERAS.forEach((e, i) => {
    const got = games.filter(g => g.eraTurn[i] !== undefined)
    const dur = got.filter(g => g.eraTurn[i + 1] !== undefined).map(g => g.eraTurn[i + 1] - g.eraTurn[i])
    const labels = [...new Set(got.flatMap(g => Object.keys(g.waiting[i])))]
    const wait = labels.map(l => [l, median(got.map(g => g.waiting[i][l] ?? 0))] as const).sort((a, b) => b[1] - a[1])
    out.push(`${e.name.padEnd(15)}${pct(got.length).padStart(8)}  ${String(median(got.map(g => g.eraTurn[i]))).padStart(26)}  ${String(median(dur)).padStart(17)}  ${wait.map(([l, n]) => `${l} ${n}`).join(' · ')}`)
  })
  console.log('\n' + out.join('\n') + '\n')
})
