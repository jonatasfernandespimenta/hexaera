import { CONTRACTS, RES, type Res } from './core/data'
import {
  abandon, accept, buyPrice, decline, DECLINE_COST, contractReward, deliver, maxContracts, sellPrice, trade, tradeLimit, type Contract, type State,
} from './core/game'
import type { Sfx } from './sfx'

type Props = { state: State; act: (fn: () => State, s?: Sfx) => void; onClose: () => void }

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
        <small>⏱ {c.turns} turnos · {contractReward(state, c)} 💰 · +{d.rep} ⭐ (falha −{2 * d.rep})</small>
        {active ? <>
          <button onClick={() => act(() => deliver(state, c.id), 'coin')}>Entregar</button>
          <button onClick={() => act(() => abandon(state, c.id), 'uncard')}>Desistir (−{d.rep} ⭐)</button>
        </> : <>
          <button onClick={() => act(() => accept(state, c.id), 'card')}>Aceitar</button>
          <button onClick={() => act(() => decline(state, c.id), 'uncard')}>Recusar ({DECLINE_COST} ✋)</button>
        </>}
      </div>
    )
  }

  return (
    <div className="trade frame">
      <header>
        <h3>🏪 Mercado</h3>
        <button className="x" onClick={onClose}>✕</button>
      </header>
      {limit === 0 ? (
        <p className="muted">Construa um Mercado conectado ao Centro para negociar e aceitar contratos.</p>
      ) : (
        <>
          <p className="muted">Negociado neste turno: {state.traded}/{limit} · Shift = 5 unidades</p>
          <table>
            <tbody>
              {goods.map(r => (
                <tr key={r}>
                  <td>{RES[r].icon} {RES[r].name}</td>
                  <td>{state.res[r]}</td>
                  <td><button onClick={e => act(() => trade(state, r, -qty(e)), 'coin')}>Vender {sellPrice(state, r)}💰</button></td>
                  <td><button onClick={e => act(() => trade(state, r, qty(e)), 'coin')}>Comprar {buyPrice(state, r)}💰</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h3>📜 Contratos <small>ativos {state.contracts.length}/{maxContracts(state)}</small></h3>
      {state.contracts.map(c => card(c, true))}
      {state.offers.map(c => card(c, false))}
      {!state.offers.length && !state.contracts.length && <p className="muted">Nenhuma oferta ainda (chegam com o Mercado).</p>}
    </div>
  )
}
