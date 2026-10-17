import { RES, type Res } from './data'
import { EVENT_BY_ID, type Effect } from './events'
import { applyEffect, buyPrice, canChoose, centerMax, eventRes, income, log, type State } from './game'
import { distance, parse } from './hex'
import { t as tr } from '../i18n'

// Ajuda de crise: uma por era, paga com 💰 (com ágio) ou com um anúncio.
export type AidKind = 'center' | 'food' | 'event'
// adOnly: a metade economiza só 💰 (pagar com 💰 seria prejuízo); só por anúncio.
export type Aid = { kind: AidKind; price: number; food?: number; hp?: number; actions?: number; option?: number; adOnly?: boolean }

export const AID_MARKUP = 1.25

// Valor em 💰 de uma unidade; sem preço (e não sendo 💰) = não negociável.
const unit = (s: State, r: Res) => (r === 'money' ? 1 : RES[r].price ? buyPrice(s, r) : null)

const harmful = (e: Effect) =>
  Object.values(e.res ?? {}).some(v => v! < 0) || !!e.destroy || (e.pop ?? 0) < 0 || !!e.warn ||
  (e.happy?.amount ?? 0) < 0 || (e.foodMult?.mult ?? 1) < 1 || (e.eatMult?.mult ?? 1) > 1 || (e.actions ?? 0) < 0

// Custos (valores negativos) escalados da opção, em módulo.
const costs = (s: State, e: Effect) =>
  (Object.entries(eventRes(s, e)) as [Res, number][]).filter(([, v]) => v < 0).map(([r, v]) => [r, -v] as const)

// Valor em 💰 do que a metade economiza; null se algum recurso não tem preço.
function saved(s: State, e: Effect) {
  let sum = 0
  for (const [r, c] of costs(s, e)) {
    const u = unit(s, r)
    if (u === null) return null
    sum += (c - Math.ceil(c / 2)) * u
  }
  return sum
}

export function aidOffer(s: State): Aid | null {
  if (s.match || s.over || s.era < 1 || s.opts?.market === 'off' || s.aidEra === s.era) return null
  const max = centerMax(s)
  if (s.centerHp <= 0.3 * max && s.invaders.some(i => distance(parse(i.at)) <= 1))
    return { kind: 'center', hp: Math.ceil(max / 2), actions: 2, price: 60 * s.era }
  const food = -(s.res.food + income(s).food)
  if (food > 0) return { kind: 'food', food, price: Math.ceil(food * buyPrice(s, 'food') * AID_MARKUP) }
  const card = s.event ? EVENT_BY_ID[s.event] : null
  if (!card || !card.options.every(o => harmful(o.effect))) return null
  let best: { i: number; cost: number; save: number } | null = null
  card.options.forEach((o, i) => {
    if (canChoose(s, o) || !costs(s, o.effect).length) return
    const save = saved(s, o.effect)
    if (save === null) return
    const cost = costs(s, o.effect).reduce((a, [r, c]) => a + c * unit(s, r)!, 0)
    if (!best || cost < best.cost) best = { i, cost, save }
  })
  const b = best as { i: number; save: number } | null
  if (!b) return null
  const aid: Aid = { kind: 'event', option: b.i, price: Math.ceil(b.save * AID_MARKUP) }
  if (costs(s, card.options[b.i].effect).every(([r]) => r === 'money')) aid.adOnly = true
  return aid
}

export function takeAid(prev: State, aid: Aid, pay: 'money' | 'ad'): State {
  if (prev.aidEra === prev.era) throw new Error(tr('Ajuda já usada nesta era.'))
  if (pay === 'money' && aid.adOnly) throw new Error(tr('Esta ajuda é só por anúncio.'))
  if (pay === 'money' && prev.res.money < aid.price) throw new Error(tr('Falta 💰.'))
  const s = structuredClone(prev)
  if (pay === 'money') s.res.money -= aid.price
  if (aid.kind === 'center') {
    s.centerHp = Math.min(centerMax(s), s.centerHp + aid.hp!)
    s.actions += aid.actions!
    log(s, tr('🆘 Ajuda de crise: o Centro foi reforçado.'))
  } else if (aid.kind === 'food') {
    s.res.food += aid.food!
    log(s, tr('🆘 Ajuda de crise: comida chegou.'))
  } else {
    const card = EVENT_BY_ID[s.event!]
    const o = card.options[aid.option!]
    const res = Object.fromEntries(Object.entries(eventRes(s, o.effect)).map(([r, v]) => [r, v < 0 ? -Math.ceil(-v / 2) : v]))
    applyEffect(s, { ...o.effect, res }, card.title)
    if (card.once) s.flags.push(`done:${card.id}`)
    s.event = null
    log(s, `${card.title}: ${o.label} (${tr('ajuda de crise')}).`)
    if (s.pop === 0) s.over = 'lost'
  }
  s.aidEra = s.era
  return s
}
