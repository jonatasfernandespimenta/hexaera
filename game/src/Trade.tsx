import { CONTRACTS, RES, type Res } from './core/data'
import {
  abandon, accept, buyPrice, decline, DECLINE_COST, contractReward, deliver, maxContracts, sellPrice, trade, tradeLimit, type Contract, type State,
} from './core/game'
import type { Sfx } from './sfx'
import { t } from './i18n'
import { Icons, Sprite } from './Sprite'

type Props = { state: State; act: (fn: () => State, s?: Sfx, ev?: [string, Record<string, unknown>?]) => void; onClose: () => void }

const bag = (b: Partial<Record<Res, number>>) =>
  Object.entries(b).filter(([, v]) => v).map(([r, v]) => `${v} ${RES[r as Res].icon}`).join(' + ')

// Painel do Mercado (compra/venda) e dos Contratos. Shift-clique negocia 5 unidades.
export function Trade({ state, act, onClose }: Props) {
  const limit = tradeLimit(state)
  const goods = (Object.keys(RES) as Res[]).filter(r => RES[r].price && RES[r].era <= state.era)
  const qty = (e: React.MouseEvent) => (e.shiftKey ? 5 : 1)

  const card = (c: Contract, active: boolean) => {
    const d = CONTRACTS[c.def]
    return (
      <div key={c.id} className="contract">
        <b>{d.client}</b>
        <span>{bag(c.left)}</span>
        <small><Icons text={t('⏱ {0} turnos · {1} 💰 · +{2} ⭐ (falha −{3})', c.turns, contractReward(state, c), d.rep, 2 * d.rep)} /></small>
        {active ? <>
          <button onClick={() => act(() => deliver(state, c.id), 'coin', ['contract', { action: 'deliver' }])}>{t('Entregar')}</button>
          <button onClick={() => act(() => abandon(state, c.id), 'uncard', ['contract', { action: 'abandon' }])}><Icons text={t('Desistir (−{0} ⭐)', d.rep)} /></button>
        </> : <>
          <button onClick={() => act(() => accept(state, c.id), 'card', ['contract', { action: 'accept' }])}>{t('Aceitar')}</button>
          <button onClick={() => act(() => decline(state, c.id), 'uncard', ['contract', { action: 'decline' }])}><Icons text={t('Recusar ({0} ✋)', DECLINE_COST)} /></button>
        </>}
      </div>
    )
  }

  return (
    <div className="trade frame">
      <header>
        <h3><Icons text={'🏪 ' + t('Mercado')} /></h3>
        <button className="x" onClick={onClose}><Sprite name="cross" size={14} /></button>
      </header>
      {limit === 0 ? (
        <p className="muted">{t('Construa um Mercado conectado ao Centro para negociar e aceitar contratos.')}</p>
      ) : (
        <>
          <p className="muted">{t('Negociado neste turno: {0}/{1} · Shift = 5 unidades', state.traded, limit)}</p>
          <table>
            <tbody>
              {goods.map(r => (
                <tr key={r}>
                  <td>{RES[r].icon} {RES[r].name}</td>
                  <td>{state.res[r]}</td>
                  <td><button onClick={e => act(() => trade(state, r, -qty(e)), 'coin', ['trade', { res: r, qty: -qty(e) }])}><Icons text={t('Vender {0}💰', sellPrice(state, r))} /></button></td>
                  <td><button onClick={e => act(() => trade(state, r, qty(e)), 'coin', ['trade', { res: r, qty: qty(e) }])}><Icons text={t('Comprar {0}💰', buyPrice(state, r))} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h3>📜 {t('Contratos')} <small>{t('ativos {0}/{1}', state.contracts.length, maxContracts(state))}</small></h3>
      {state.contracts.map(c => card(c, true))}
      {state.offers.map(c => card(c, false))}
      {!state.offers.length && !state.contracts.length && <p className="muted">{t('Nenhuma oferta ainda (chegam com o Mercado).')}</p>}
    </div>
  )
}
