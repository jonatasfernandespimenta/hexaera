// Hook da partida online: carrega, consulta o servidor e fecha turnos. Uma requisição por vez por cliente:
// escritas entram na fila `run`; a consulta periódica pula a vez se há algo pendente.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Convoy } from './core/convoy'
import { guard, type State } from './core/game'
import { newMatchGame, normalize, settle } from './core/match'
import { getCreds, putState, submit, view, type Creds, type View } from './net'
import { closeTurn, phase as phaseOf, type Phase } from './online'
import type { Meta, RivalView } from './server/matches'

export type OnlinePhase = 'loading' | Phase | 'error'

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Erro de conexão.')

export function useOnline(id: string) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [seat, setSeat] = useState<0 | 1 | null>(null)
  const [phase, setPhase] = useState<OnlinePhase>('loading')
  const [state, setLocal] = useState<State | null>(null)
  const [rival, setRival] = useState<RivalView | null>(null)
  const [outbox, setOutbox] = useState<Convoy[]>([])
  const [vote, setVote] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sendingNow, setSending] = useState(false) // "Fim do turno" em andamento: UI trava os controles

  // Espelho para as funções assíncronas (evita closures velhas).
  const cur = useRef({ creds: null as Creds | null, coop: false, local: null as State | null, outbox: [] as Convoy[], vote: false })
  const chain = useRef<Promise<void>>(Promise.resolve())
  const busy = useRef(0)
  const phaseRef = useRef<OnlinePhase>('loading')
  phaseRef.current = phase
  const sending = useRef(false) // trava entradas e clique duplo enquanto o turno é enviado

  const put = useCallback((s: State) => { cur.current.local = s; setLocal(s) }, [])
  const setState = useCallback((s: State) => { if (!sending.current) put(s) }, [put])
  const resetTurn = () => { cur.current.outbox = []; cur.current.vote = false; setOutbox([]); setVote(false) }

  // Enfileira uma tarefa: nunca duas requisições ao mesmo tempo.
  const run = useCallback((fn: () => Promise<void>) => {
    busy.current++
    const p = chain.current.then(fn).finally(() => { busy.current-- })
    chain.current = p.catch(() => {})
    return p
  }, [])

  // Aplica uma leitura do servidor ao estado local; fecha o turno se os dois já enviaram.
  const apply = useCallback(async (v: View, creds: Creds) => {
    setMeta(v.meta); setSeat(v.seat); setRival(v.rival)
    cur.current.coop = v.meta.mode === 'coop'
    let local = cur.current.local!
    const settled = settle(local, v.rival?.state ?? null)
    let save = settled.over !== local.over
    local = settled
    let p = phaseOf(v.me, v.rival, local)
    if (p === 'close' && v.rival && !local.over) {
      local = closeTurn(local, v.rival, v.me.votes.includes(local.turn))
      save = true
      p = phaseOf(v.me, v.rival, local)
    }
    put(local)
    setPhase(p)
    if (save) await putState(id, creds.token, local)
  }, [id, put])

  const refresh = useCallback(async () => {
    const creds = cur.current.creds
    if (!creds) return
    await apply(await view(id, creds.token), creds)
    setError(null)
  }, [id, apply])

  // Entrada: credenciais, primeira leitura e estado salvo (ou partida nova).
  useEffect(() => {
    let alive = true
    const creds = getCreds(id)
    cur.current = { creds, coop: false, local: null, outbox: [], vote: false }
    setPhase('loading'); setError(null); setOutbox([]); setVote(false)
    if (!creds) { setPhase('error'); setError('Você não está nesta partida.'); return }
    run(async () => {
      const v = await view(id, creds.token)
      if (!alive) return
      cur.current.local = normalize(v.me.state ?? newMatchGame(v.meta.seed, v.meta.mode, v.seat, v.meta.fast))
      await apply(v, creds)
    }).catch(e => { if (alive) { setPhase('error'); setError(msg(e)) } })
    return () => { alive = false }
  }, [id, run, apply])

  // Consulta periódica: rápida na sala e esperando; lenta jogando (status do rival).
  useEffect(() => {
    const ms = phase === 'lobby' || phase === 'waiting' ? 1500 : phase === 'playing' ? 5000 : 0
    if (!ms) return
    const t = setInterval(() => {
      if (busy.current) return // escrita (ou consulta) em andamento: pula a vez
      run(refresh).catch(e => setError(msg(e)))
    }, ms)
    return () => clearInterval(t)
  }, [phase, run, refresh])

  const addConvoy = useCallback((c: Convoy) => {
    if (sending.current) return
    cur.current.outbox = [...cur.current.outbox, c]
    setOutbox(cur.current.outbox)
  }, [])
  const setVoteCb = useCallback((v: boolean) => {
    if (sending.current || !cur.current.coop) return // voto de era só existe no coop
    cur.current.vote = v; setVote(v)
  }, [])

  // "Fim do turno": salva o estado antes do endTurn, envia o turno e relê (o fechamento vem no apply).
  const endTurn = useCallback(async () => {
    const { creds, local } = cur.current
    if (!creds || !local || phaseRef.current !== 'playing' || sending.current) return
    try { guard(local) } catch (e) { setError(msg(e)); return }
    sending.current = true
    setSending(true)
    await run(async () => {
      const s = cur.current.local! // relido na vez: uma consulta anterior pode tê-lo mudado
      const T = s.turn
      try {
        guard(s)
        await putState(id, creds.token, s)
        await submit(id, creds.token, { turn: T, sent: cur.current.outbox, vote: cur.current.vote })
        resetTurn()
        await refresh()
      } catch (e) {
        setError(msg(e))
        // A resposta pode ter se perdido com o envio aceito: o servidor diz se o turno já foi.
        const v = await view(id, creds.token).catch(() => null)
        if (!v) return
        if (v.me.turn >= T) resetTurn()
        await apply(v, creds).catch(() => {})
      }
    }).finally(() => { sending.current = false; setSending(false) })
  }, [id, run, refresh, apply])

  return { meta, seat, phase, state, setState, rival, outbox, addConvoy, vote, setVote: setVoteCb, endTurn, sending: sendingNow, error }
}
