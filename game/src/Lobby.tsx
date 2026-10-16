// Sala online: criar partida (link para o amigo), entrar por um link ?match= e esperar o segundo jogador.
import { useRef, useState } from 'react'
import type { Mode } from './core/match'
import { create, join, setCreds } from './net'
import { sfx } from './sfx'
import type { OnlinePhase } from './useOnline'

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Erro de conexão.')
const matchUrl = (id: string) => `${location.origin}/?match=${id}`

type Props = {
  matchId: string | null // partida com credencial: esperando o rival ou carregando
  joinId: string | null // link ?match= sem credencial: pede o apelido
  phase: OnlinePhase
  error: string | null
  onEnter: (id: string) => void
  onBack: () => void
}

export function Lobby({ matchId, joinId, phase, error, onEnter, onBack }: Props) {
  const [mode, setMode] = useState<Mode>('coop')
  const [fast, setFast] = useState(false)
  const [timer, setTimer] = useState(0)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const linkRef = useRef<HTMLInputElement>(null)

  const go = async (fn: () => Promise<string>) => {
    if (busy || !name.trim()) return
    setBusy(true); setErr(null); sfx('click')
    try { onEnter(await fn()) } catch (e) { setErr(msg(e)); sfx('error') } finally { setBusy(false) }
  }
  const doCreate = () => go(async () => {
    const r = await create({ mode, fast, timer, name: name.trim() })
    setCreds(r.id, { seat: r.seat, token: r.token })
    history.replaceState(null, '', `?match=${r.id}`)
    return r.id
  })
  const doJoin = (id: string) => go(async () => {
    setCreds(id, await join(id, name.trim()))
    return id
  })
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); setCopied(true); sfx('click') } catch { linkRef.current?.select() } // sem clipboard: deixa o texto selecionado
  }

  const back = <button className="opt dark" onClick={() => { sfx('uncard'); onBack() }}><b>Voltar</b></button>
  const nameRow = (
    <div className="setrow">
      <small>Apelido</small>
      <input className="field" value={name} maxLength={20} placeholder="seu nome" onChange={e => setName(e.target.value)} />
    </div>
  )
  const alert = (err || error) && <p className="lobbyerr">{err ?? error}</p>

  // Partida já nossa: carregando, esperando o segundo jogador ou com erro.
  if (matchId) return (
    <div className="pcard menu setup">
      <header className="gold">Jogar online</header>
      {phase === 'lobby' ? <>
        <div className="setrow">
          <small>Mande este link para o outro jogador</small>
          <div>
            <input ref={linkRef} className="field" readOnly value={matchUrl(matchId)} onFocus={e => e.target.select()} />
            <button onClick={() => copy(matchUrl(matchId))}>{copied ? 'Copiado!' : 'Copiar'}</button>
          </div>
        </div>
        <p className="lobbywait">Esperando o segundo jogador…</p>
      </> : phase !== 'error' && <p className="lobbywait">Conectando…</p>}
      {alert}
      {back}
    </div>
  )

  if (joinId) return (
    <div className="pcard menu setup">
      <header className="gold">Entrar na partida</header>
      {nameRow}
      {alert}
      <button className="opt green" disabled={busy || !name.trim()} onClick={() => doJoin(joinId)}><b>{busy ? 'Entrando…' : 'Entrar'}</b></button>
      {back}
    </div>
  )

  const pick = <T,>(cur: T, v: T, set: (v: T) => void, label: string) => (
    <button key={label} className={cur === v ? 'sel' : ''} onClick={() => { sfx('click'); set(v) }}>{label}</button>
  )
  return (
    <div className="pcard menu setup">
      <header className="gold">Jogar online</header>
      <div className="setrow">
        <small>Modo</small>
        <div>
          {pick<Mode>(mode, 'coop', m => { setMode(m); setFast(false) }, 'Coop')}
          {pick<Mode>(mode, 'versus', m => { setMode(m); setFast(true) }, 'Versus')}
        </div>
      </div>
      <div className="setrow">
        <small>Ritmo rápido</small>
        <div>{pick(fast, true, setFast, 'Ligado')}{pick(fast, false, setFast, 'Desligado')}</div>
      </div>
      <div className="setrow">
        <small>Relógio por turno</small>
        <div>{pick(timer, 0, setTimer, 'Desligado')}{pick(timer, 60, setTimer, '60 s')}{pick(timer, 90, setTimer, '90 s')}</div>
      </div>
      {nameRow}
      {alert}
      <button className="opt green" disabled={busy || !name.trim()} onClick={doCreate}><b>{busy ? 'Criando…' : 'Criar partida'}</b><span>gera um link para o amigo</span></button>
      {back}
    </div>
  )
}
