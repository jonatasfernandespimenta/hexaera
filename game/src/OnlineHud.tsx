// Interface da partida online: status do rival, relógio do turno e painel militar (tropas, ataques, ajuda e cargas).
import { useEffect, useRef, useState } from 'react'
import { sendAid, sendArmy, sendCargo, travelTurns, type Convoy } from './core/convoy'
import { TROOP_COST, type Bag, type Res } from './core/data'
import { idle, recruit, type State } from './core/game'
import type { Mode } from './core/match'
import { carriers, shouldFire, shouldResolve, type ClockRun } from './onlineView'
import type { RivalView } from './server/matches'

type Sent = { state: State; convoy: Convoy }
const errOf = (fn: () => unknown) => { try { fn(); return null } catch (e) { return (e as Error).message } }

// Relógio do turno: conta `seconds` a partir de quando o turno fica jogável; ao zerar chama onZero
// até um envio dar certo (no máximo um por turno). Com evento aberto (blocked) chama onBlocked para resolvê-lo
// (jogador ausente não trava a partida) e envia em seguida; após falha, tenta de novo em RETRY_MS.
// Recomeça a cada turno. Sem relógio (0) devolve null.
const RETRY_MS = 3000
export function useTurnClock(seconds: number, active: boolean, turn: number, blocked: boolean, onZero: () => Promise<boolean>, onBlocked: () => void) {
  const [left, setLeft] = useState<{ turn: number; l: number } | null>(null)
  const zero = useRef(onZero)
  zero.current = onZero
  const unblock = useRef(onBlocked)
  unblock.current = onBlocked
  const block = useRef(blocked)
  block.current = blocked
  const run = useRef<ClockRun & { turn: number; start: number } | null>(null)
  useEffect(() => {
    if (!seconds || !active) return
    if (run.current?.turn !== turn) run.current = { turn, start: Date.now(), fired: false, pending: false, retryAt: 0 }
    const r = run.current
    const tick = () => {
      const l = Math.max(0, Math.ceil(seconds - (Date.now() - r.start) / 1000))
      setLeft(p => (p?.turn === turn && p.l === l ? p : { turn, l })) // sem mudança: sem render
      if (shouldResolve(l, r, block.current)) return unblock.current()
      if (!shouldFire(l, r, block.current, Date.now())) return
      r.pending = true
      zero.current().catch(() => false).then(ok => {
        r.pending = false
        if (ok) r.fired = true
        else r.retryAt = Date.now() + RETRY_MS
      })
    }
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [seconds, active, turn])
  // Fora da vez (enviado, esperando o rival) o relógio some; num turno novo começa cheio.
  return seconds && active ? (left?.turn === turn ? left.l : seconds) : null
}

// Linha do rival dentro da caixa do turno: nome, situação e relógio.
export function RivalStatus({ name, mode, rival, turn, clock }: { name: string; mode: Mode; rival: RivalView | null; turn: number; clock: number | null }) {
  const status = !rival ? 'carregando…' : !rival.online ? 'desconectado — partida pausada' : rival.turn >= turn ? 'pronto' : 'jogando'
  return (
    <div className="rival">
      <span className={!rival?.online ? 'neg' : rival.turn >= turn ? 'pos' : ''}>{mode === 'versus' ? '⚔️' : '🤝'} {name} · {status}</span>
      {clock !== null && <span className={`clock ${clock <= 10 ? 'urgent' : ''}`}>⏱ {clock}s</span>}
    </div>
  )
}

const KIND_LABEL: Record<Convoy['kind'], string> = { army: '⚔️ exército', aid: '🛡️ ajuda', cargo: '📦 carga' }
const describe = (c: Convoy) =>
  `${KIND_LABEL[c.kind]} (${c.n ?? Object.values(c.bag ?? {}).reduce((a, v) => a + (v ?? 0), 0)}) chega no turno ${c.arrive + 1}`

type MilitaryProps = {
  state: State
  mode: Mode
  outbox: Convoy[]
  act: (fn: () => State) => void
  send: (fn: () => Sent) => boolean // true = comitiva criada
  icon: (r: Res) => React.ReactNode
}

// Painel militar: aparece com um Campo de guerra pronto ou com tropas em casa.
export function MilitaryCard({ state, mode, outbox, act, send, icon }: MilitaryProps) {
  const [n, setN] = useState(1)
  const [bag, setBag] = useState<Bag>({})
  const camp = Object.values(state.tiles).some(t => t.building?.id === 'warcamp' && t.building.turnsLeft === 0)
  if (!camp && state.troops <= 0) return null
  const qty = Math.max(1, Math.min(n, state.troops))
  const arrive = state.turn + travelTurns(state) + 1 // recebida ao fechar o turno de chegada: aparece no seguinte
  const noRecruit = errOf(() => recruit(state))
  const stock = (Object.keys(state.res) as Res[]).filter(r => state.res[r] > 0)
  const load = Object.fromEntries(Object.entries(bag).filter(([r, v]) => v && stock.includes(r as Res))) as Bag
  const need = carriers(state, load)
  const noCargo = !need ? 'Escolha o que levar.' : errOf(() => sendCargo(state, load))
  const away = state.away.reduce((a, x) => a + x.n, 0)

  return (
    <div className="pcard military">
      <header className="red">{mode === 'versus' ? 'Exército' : 'Tropas e cargas'}</header>
      <p className="troops"><b>Tropas: {state.troops}</b>{away > 0 && <span> · 👤 {away} carregando</span>}</p>
      <button className="opt green" disabled={!!noRecruit} title={noRecruit ?? ''} onClick={() => act(() => recruit(state))}>
        <b>Recrutar</b>
        <span>{noRecruit ?? <>{Object.entries(TROOP_COST).map(([r, v]) => <span key={r} className="chip">{icon(r as Res)}{v}</span>)} 1 ✋ · 1 👤</>}</span>
      </button>
      {state.troops > 0 && (
        <div className="sendrow">
          <input className="field" type="number" min={1} max={state.troops} value={qty} aria-label="Tropas"
            onChange={e => setN(Math.floor(Number(e.target.value)) || 1)} />
          {mode === 'versus'
            ? <button className="opt dark" onClick={() => send(() => sendArmy(state, qty))}><b>Atacar com {qty}</b><span>chega no turno {arrive}</span></button>
            : <button className="opt dark" onClick={() => send(() => sendAid(state, qty))}><b>Enviar ajuda ({qty})</b><span>chega no turno {arrive}</span></button>}
        </div>
      )}
      {mode === 'coop' && stock.length > 0 && (
        <>
          <div className="cargo">
            {stock.map(r => (
              <label key={r} className="chip">{icon(r)}
                <input className="field" type="number" min={0} max={state.res[r]} value={bag[r] ?? 0} aria-label={r}
                  onChange={e => setBag({ ...bag, [r]: Math.max(0, Math.min(state.res[r], Math.floor(Number(e.target.value)) || 0)) })} />
              </label>
            ))}
          </div>
          <button className="opt dark" disabled={!!noCargo} title={noCargo ?? ''}
            onClick={() => { if (send(() => sendCargo(state, load))) setBag({}) }}>
            <b>Enviar carga</b>
            <span>{noCargo ?? `${need} 👤 de ${idle(state)} ociosos · chega no turno ${arrive}`}</span>
          </button>
        </>
      )}
      {outbox.length > 0 && <p className="muted">Saindo neste turno: {outbox.map(describe).join(' · ')}</p>}
    </div>
  )
}
