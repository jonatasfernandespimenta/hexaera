import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BUILDINGS, CONTRACT_EVERY, CONTRACTS, EVENT_EVERY, ERAS, LINKS, RES, TERRAINS, type BuildingId, type Link, type Res } from './core/data'
import { EVENT_BY_ID } from './core/events'
import {
  abandon, accept, advanceEra, buildRail, buildTurns, canPlace, railPath, demolish, DEMOLISH_COST, SANDBOX_DEFAULT, type Sandbox, keepPlaying, terrainsOf, decline, DECLINE_COST, affordable, build, buildLink, canChoose, centerMax, eventText, contractReward, debt, deliver, endTurn, eraGoals,
  explore, happiness, pollutionDelta, run, terrainAt, housing, hunt, idle, income, maxActions, maxContracts, newGame, resolveEvent, shortfall, type State,
} from './core/game'
import { normalize } from './core/match'
import { distance, key, toWorld, type Hex } from './core/hex'
import { Board, ConvoyMarker, NeutralStrip } from './scene/Board'
import { MilitaryCard, RivalStatus, useTurnClock } from './OnlineHud'
import { autoOption, convoyMarkers, endText, neutralStrip } from './onlineView'
import type { Convoy } from './core/convoy'
import { Minimap } from './Minimap'
import { Icons, RES_SPRITE, Sprite, type SpriteName } from './Sprite'
import { Trade } from './Trade'
import { Coach, STEPS } from './Tutorial'
import { isMuted, setMuted, sfx, startAmbience, type Sfx } from './sfx'
import { lang, setLang, t } from './i18n'
import { Lobby } from './Lobby'
import { getCreds } from './net'
import { useOnline } from './useOnline'
import { usePresence } from './usePresence'
import { context, track } from './track'

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)
// Ícone de cada recurso (atlas em public/ui).
// Altura da barra de recursos → --bar-h (no celular ela quebra em linhas e o HUD abaixo acompanha).
const trackBarHeight = (el: HTMLDivElement | null) => {
  if (!el) return
  const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', `${el.offsetHeight}px`))
  ro.observe(el)
  return () => ro.disconnect()
}
const ResIcon = ({ r, size = 16 }: { r: Res; size?: number }) => <Sprite name={RES_SPRITE[r]} size={size} />
const Cost = ({ b }: { b: Partial<Record<Res, number>> }) => (
  <>{Object.entries(b).map(([r, v]) => <span key={r} className="chip"><ResIcon r={r as Res} />{v}</span>)}</>
)

// Ilustração da carta de evento por tipo.
const EVENT_ART: Record<string, SpriteName> = {
  seca: 'ev_drought', inverno: 'ev_drought', doenca: 'ev_drought', fartura: 'ev_festival', nascimentos: 'ev_festival', viajante: 'ev_festival',
  incendio: 'ev_invasion', lobos: 'th_wolf', manada: 'cow', tempestade: 'ev_storm', rio_sujo: 'ev_pollution', protestos: 'ev_pollution',
  tosse: 'ev_pollution', tribo: 'ev_trade', tribo2: 'ev_trade', silex: 'quarry',
}

// Arte das cartas (só interface).
const CARD_SPRITE: Record<BuildingId | Link, SpriteName> = {
  hut: 'hut', house: 'cottage', townhouse: 'townhouse', tenement: 'tenement', apartment: 'apartment', skyscraper: 'skyscraper',
  farm: 'farm', field: 'field', manor: 'manor', mechfarm: 'mechfarm', greenhouse: 'greenhouse', vertfarm: 'vertfarm',
  lumber: 'forest', quarry: 'quarry', fisher: 'boat', claypit: 'claypit', kiln: 'kiln', elder: 'elder', totem: 'totem',
  tower: 'tower', bronzetower: 'bronzetower', stonetower: 'stonetower', castle: 'castle', turret: 'turret', barracks: 'barracks',
  scribe: 'scribe', library: 'library', foundry: 'foundry', market: 'market', stable: 'cow', mill: 'windmill', warcamp: 'barracks',
  mine: 'mine', smith: 'smith', temple: 'temple', workshop: 'workshop', weaver: 'weaver', cathedral: 'cathedral',
  coalmine: 'coalmine', powerplant: 'powerplant', steelworks: 'steelworks', factory: 'factory', park: 'park',
  oilwell: 'pumpjack', thermal: 'thermal', hydro: 'hydro', electronics: 'electronicsplant', carplant: 'carplant', hospital: 'hospital', stadium: 'stadium',
  solar: 'solar', wind: 'wind', nuclear: 'nuclear', batteries: 'batteryplant', datacenter: 'datacenter', autofactory: 'autofactory',
  logistics: 'logistics', urbanpark: 'urbanpark', landmark: 'landmark',
  trail: 'trail', road: 'road', rail: 'rails', highway: 'highway', railway: 'rails',
}
const Art = ({ id, size = 58 }: { id: BuildingId | Link; size?: number }) => <Sprite name={CARD_SPRITE[id]} size={size} />

type Panel = null | 'trade' | 'log' | 'menu'

// Mesmo corte do layout de celular em style.css.
const MOBILE = () => matchMedia('(max-width: 820px), (max-height: 520px)').matches

// Save automático da partida (o tutorial não salva).
const SAVE = 'hexaera.save'
const TUT_DONE = 'hexaera.tutorial'
const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem storage: só não salva */ } },
}
// Modo da partida para as métricas.
const modeOf = (s: State) => s.match?.mode ?? (s.flags.includes('sandbox') ? 'sandbox' : 'solo')
const built = (s: State) => Object.values(s.tiles).filter(t => t.building).length

const loadSave = (): State | null => { try { const s = JSON.parse(store.get(SAVE) ?? 'null'); return s && normalize(s) } catch { return null } }

// Opções do Sandbox: cada linha é um seletor de botões.
const SANDBOX_ROWS: { key: keyof Sandbox; label: string; opts: [Sandbox[keyof Sandbox], string][] }[] = [
  { key: 'threats', label: t('Invasões'), opts: [[0, t('Nenhuma')], [0.5, t('Raras')], [1, t('Normais')], [2, t('Frequentes')]] },
  { key: 'abundance', label: t('Abundância'), opts: [[0.75, t('Escassa')], [1, t('Normal')], [1.5, t('Farta')]] },
  { key: 'pace', label: t('Ritmo das eras'), opts: [[0.5, t('Rápido')], [1, t('Normal')], [1.5, t('Lento')]] },
  { key: 'market', label: t('Mercado'), opts: [['volatil', t('Volátil')], ['estavel', t('Estável')], ['off', t('Desligado')]] },
  { key: 'era', label: t('Era inicial'), opts: ERAS.map((e, i) => [i, e.name.replace(/^do /, '')] as [number, string]) },
]
function SandboxSetup({ value, onChange, onBack, onStart }: { value: Sandbox; onChange: (v: Sandbox) => void; onBack: () => void; onStart: () => void }) {
  return (
    <div className="pcard menu setup">
      <header className="gold">Sandbox</header>
      {SANDBOX_ROWS.map(row => (
        <div key={row.key} className="setrow">
          <small>{row.label}</small>
          <div>
            {row.opts.map(([v, l]) => (
              <button key={String(v)} className={value[row.key] === v ? 'sel' : ''}
                onClick={() => { sfx('click'); onChange({ ...value, [row.key]: v }) }}>{l}</button>
            ))}
          </div>
        </div>
      ))}
      <button className="opt green" onClick={onStart}><b>{t('Começar')}</b><span>{t('substitui o jogo salvo')}</span></button>
      <button className="opt dark" onClick={onBack}><b>{t('Voltar')}</b></button>
    </div>
  )
}

// Dev: /?teste abre um jogo pronto para testar transporte — Moderna (Rodovia + Ferrovia),
// 999 de cada recurso, 99 ✋, mapa revelado até o anel 3, sem invasões. Não salva por cima do jogo normal.
const TEST = process.env.NODE_ENV === 'development' && new URLSearchParams(location.search).has('teste')
function testGame(): State {
  const s = newGame(42, { threats: 0, abundance: 1, pace: 1, market: 'volatil', era: 5 })
  for (const r of Object.keys(s.res) as Res[]) s.res[r] = 999
  for (let q = -3; q <= 3; q++) for (let r = -3; r <= 3; r++)
    if (distance({ q, r }) <= 3 && !s.tiles[key({ q, r })]) s.tiles[key({ q, r })] = { terrain: terrainAt(s.seed, { q, r }) }
  return { ...s, pop: 60, actions: 99, event: null }
}

// Partida online pela URL (?match=id): com credencial entra direto; sem, a sala pede o apelido.
const URL_MATCH = () => new URLSearchParams(location.search).get('match')
const clearUrl = () => history.replaceState(null, '', location.pathname)

export function App() {
  const [solo, setSolo] = useState<State>(() => TEST ? testGame() : loadSave() ?? newGame())
  const [matchId, setMatchId] = useState<string | null>(() => { const id = URL_MATCH(); return id && getCreds(id) ? id : null })
  const [joinId, setJoinId] = useState<string | null>(() => { const id = URL_MATCH(); return id && !getCreds(id) ? id : null })
  const online = useOnline(matchId)
  const playing = usePresence() // abas abertas do jogo (solo + online)
  // Online: o jogo lê e escreve o estado da sessão; senão, o jogo local de sempre.
  const state = matchId && online.state ? online.state : solo
  const rivalName = online.seat === null ? t('rival') : online.meta?.names[1 - online.seat] ?? t('rival')
  // Online só se mexe na própria vez: o turno enviado não muda mais (e nada cai na sessão antes de carregar).
  const lock = !matchId ? null : online.sending ? t('Enviando o turno…') : online.phase !== 'playing' || !online.state ? t('Esperando {0}…', rivalName) : null
  const setState = (v: State | ((s: State) => State)) => {
    if (!matchId) return setSolo(v)
    if (!lock) online.setState(typeof v === 'function' ? v(state) : v)
  }
  const [mode, setMode] = useState<BuildingId | null>(null)
  const [link, setLink] = useState<Link | null>(null)
  const [tab, setTab] = useState(0) // era exibida na mão de cartas
  const [panel, setPanel] = useState<Panel>(null)
  const [hand, setHand] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [news, setNews] = useState<string | null>(null)
  const [screen, setScreen] = useState<'menu' | 'online' | 'game'>(() => (TEST ? 'game' : URL_MATCH() ? 'online' : 'menu'))
  const [sideOpen, setSideOpen] = useState(false)
  const [setup, setSetup] = useState<Sandbox | null>(null) // tela de opções do Sandbox
  const [tut, setTut] = useState<number | null>(null) // passo atual do tutorial
  const tutStart = useRef(state) // estado no início do passo, para detectar a ação pedida
  const [deck, setDeck] = useState(false) // celular: mão aberta
  const [fp, setFp] = useState(false) // primeira pessoa
  const [wreck, setWreck] = useState(false) // modo demolir
  const [railFrom, setRailFrom] = useState<Hex | null>(null) // origem da rota de ferrovia
  const [railTo, setRailTo] = useState<Hex | null>(null) // celular: destino escolhido, aguardando confirmação
  const [look, setLook] = useState(false) // online: câmera na cidade do rival
  const pickBuilding = (id: BuildingId | null) => { setMode(id); setLink(null); setDeck(false); setWreck(false); setRailFrom(null); setRailTo(null) }
  const pickLink = (l: Link | null) => { setLink(l); setMode(null); setDeck(false); setWreck(false) }
  const toggle = (p: Panel) => setPanel(panel === p ? null : p)
  useEffect(() => setTab(state.era), [state.era])

  // Dev: window.hex.get()/set() para inspecionar e montar situações de teste no console.
  // reveal(n) revela todos os hexes até o anel n (terreno real da seed).
  if (process.env.NODE_ENV === 'development') (window as any).hex = {
    get: () => state, set: setState,
    reveal: (n: number) => setState(s => {
      const t = { ...s.tiles }
      for (let q = -n; q <= n; q++) for (let r = -n; r <= n; r++)
        if (distance({ q, r }) <= n && !t[key({ q, r })]) t[key({ q, r })] = { terrain: terrainAt(s.seed, { q, r }) }
      return { ...s, tiles: t }
    }),
  }

  // ev: evento de métrica, enviado só se a ação deu certo.
  const act = (fn: () => State, s: Sfx = 'click', ev?: [string, Record<string, unknown>?]) => {
    if (lock) { setToast(lock); sfx('error'); return }
    try { setState(fn()); sfx(s); if (ev) track(...ev) } catch (e) { setToast((e as Error).message); sfx('error') }
  }
  // Comitiva: o estado (tropas/recursos saem) e a lista do turno mudam juntos; ambos passam pela trava.
  const send = (fn: () => { state: State; convoy: Convoy }) => {
    if (lock) { setToast(lock); sfx('error'); return false }
    try {
      const r = fn()
      setState(r.state); online.addConvoy(r.convoy); track('convoy_sent')
      setToast(t('Comitiva a caminho: chega no turno {0}', r.convoy.arrive + 1)); sfx('card')
      return true
    } catch (e) { setToast((e as Error).message); sfx('error'); return false }
  }

  // Sons do que o jogo faz sozinho: comparam o estado novo com o anterior.
  const prev = useRef(state)
  useEffect(() => {
    const p = prev.current
    prev.current = state
    if (p === state || state.turn < p.turn) return // nova partida
    if (p.seed === state.seed && !TEST) { // mesma partida (continuar um save troca a seed)
      if (state.turn > p.turn) {
        context({ turn: state.turn, era: state.era })
        track('turn_ended', { turn: p.turn, era: p.era, pop: p.pop, buildings: built(p), tiles: Object.keys(p.tiles).length, actions_left: p.actions, happiness: happiness(p) })
      }
      if (state.era > p.era) track('era_reached', { era: state.era, turn: state.turn })
      if (state.over && !p.over) track('game_over', { result: state.over, turn: state.turn, era: state.era })
    }
    if (state.over && !p.over) return sfx(state.over === 'won' ? 'win' : 'lose')
    if (state.era > p.era) return sfx('era')
    if (state.centerHp < p.centerHp) sfx('hit')
    else if (state.invaders.length > p.invaders.length || state.warnings.length > p.warnings.length) sfx('alarm')
    if (state.event && !p.event) setTimeout(() => sfx('event'), 250)
  }, [state])
  const [mute, setMute] = useState(isMuted)
  useEffect(() => {
    const go = () => startAmbience()
    window.addEventListener('pointerdown', go, { once: true })
    return () => window.removeEventListener('pointerdown', go)
  }, [])

  useEffect(() => { if (screen === 'game' && tut === null && !matchId && !TEST) store.set(SAVE, JSON.stringify(state)) }, [state, screen, tut, matchId])

  // Sai da partida online (as credenciais ficam: o link retoma depois).
  const leave = () => { setMatchId(null); setJoinId(null); setLook(false); clearUrl() }
  // how: de onde a partida veio (new, continue, sandbox, tutorial, restart, replay, after_tutorial).
  const play = (s: State, how: string) => {
    context({ mode: how === 'tutorial' ? 'tutorial' : modeOf(s), turn: s.turn, era: s.era }); track('game_started', { how })
    if (matchId) leave(); setSolo(s); setTut(null); setPanel(null); setMode(null); setLink(null); setScreen('game') }
  // Sala online: quando o segundo jogador chega (ou a partida já corria), vai para o jogo.
  useEffect(() => {
    if (screen !== 'online' || !matchId || !['playing', 'waiting', 'close'].includes(online.phase)) return
    context({ mode: online.state?.match?.mode ?? 'online', turn: online.state?.turn, era: online.state?.era }); track('game_started', { how: 'online' })
    setTut(null); setPanel(null); setMode(null); setLink(null); setScreen('game')
  }, [screen, matchId, online.phase])
  // Fim do turno: online envia ao servidor (travado enquanto envia ou espera o rival).
  const canEnd = !lock
  // Online resolve true se o turno foi enviado.
  const finishTurn = (): Promise<boolean> => {
    if (!matchId) { act(() => endTurn(state), 'turn'); return Promise.resolve(true) }
    if (!canEnd) return Promise.resolve(false)
    return online.endTurn().then(ok => { sfx(ok ? 'turn' : 'error'); return ok })
  }
  // Relógio da partida: ao zerar, envia o turno como o botão; evento aberto é resolvido antes com a primeira opção possível.
  const autoResolve = () => { const i = autoOption(state); if (i !== null) act(() => resolveEvent(state, i), 'click', ['event_choice', { event: state.event, option: i, auto: true }]) }
  const clock = useTurnClock(matchId ? online.meta?.timer ?? 0 : 0, !!matchId && online.phase === 'playing' && !state.over, state.turn,
    !!state.event, finishTurn, autoResolve)
  // Erros da sessão online aparecem no aviso de sempre.
  useEffect(() => { if (online.error && screen === 'game') setToast(online.error) }, [online.error, screen])
  const goStep = (i: number, s = state) => {
    const n = STEPS[i].setup?.(s) ?? s
    tutStart.current = n
    setState(n); setTut(i); sfx('card')
    track('tutorial_step', { step: i + 1, title: STEPS[i].title })
  }
  const startTutorial = () => { const g = newGame(); play(g, 'tutorial'); setHand(true); goStep(0, g) }
  const endTutorial = () => { store.set(TUT_DONE, '1'); setTut(null) }
  // Avança o passo quando o jogador faz o que foi pedido.
  useEffect(() => {
    if (tut === null) return
    const done = STEPS[tut].done
    if (done?.(state, tutStart.current, { panel, mode })) goStep(tut + 1)
  }, [state, panel, mode, tut])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(t)
  }, [toast])

  // Última linha do registro aparece em destaque por alguns segundos.
  useEffect(() => {
    setNews(state.log[0])
    const t = setTimeout(() => setNews(null), 3500)
    return () => clearTimeout(t)
  }, [state.log[0]])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (mode || link || wreck) sfx('uncard'); setMode(null); setLink(null); setWreck(false); setRailFrom(null); setRailTo(null); setPanel(null) }
      if (e.key === 'Enter' && screen === 'game' && !fp && !state.over && !state.event) finishTurn()
      if (e.code === 'KeyP' && screen === 'game' && !MOBILE()) { setFp(v => !v); setMode(null); setLink(null); setPanel(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onHex = (h: Hex) => {
    if (state.over || fp) return
    if (!state.tiles[key(h)]) return act(() => explore(state, h), 'explore')
    if (wreck) {
      if (state.tiles[key(h)].building) act(() => demolish(state, h), 'hit', ['building_demolished', { building: state.tiles[key(h)].building!.id }])
    } else if (mode === 'railway') {
      // Ferrovia: 1º toque = origem, 2º = destino (constrói a rota inteira).
      if (!railFrom) {
        const k = key(h)
        if (k === '0,0' || state.tiles[k].building?.id === 'railway' || !canPlace(state, h, 'railway')) { sfx('card'); setRailFrom(h) }
        else setToast(t('Origem: o Centro, um trilho ou um hex livre.'))
      } else {
        const path = railPath(state, railFrom, h)
        if (!path) return setToast(t('Sem caminho livre até aí.'))
        // Celular não tem hover: 1º toque no destino mostra rota e custo, 2º no mesmo hex constrói.
        if (MOBILE() && key(h) !== (railTo && key(railTo))) { sfx('hover'); return setRailTo(h) }
        act(() => buildRail(state, path), 'link', ['building_placed', { building: 'railway', era: state.era }])
        setRailFrom(null); setRailTo(null); setMode(null)
      }
    } else if (mode) {
      act(() => build(state, h, mode), 'build', ['building_placed', { building: mode, era: state.era }])
      setMode(null)
    } else if (state.invaders.some(i => i.at === key(h))) act(() => hunt(state, h), 'hunt', ['invader_attacked'])
  }

  const inc = income(state)
  const power = run(state)
  const happy = happiness(state)
  // Online: match = contexto da partida; no coop as metas somam as duas cidades.
  const match = matchId ? state.match : undefined
  const coop = match?.mode === 'coop'
  const goals = eraGoals(state, coop ? online.rival?.state : null)
  const last = state.era === ERAS.length - 1
  const partnerVoted = !!online.rival?.votes.includes(state.turn)
  // Recursos da era atual sempre; os de eras passadas só quando há estoque ou movimento.
  const shown = (Object.keys(RES) as Res[]).filter(r => RES[r].era === state.era || state.res[r] || inc[r] || ['food', 'money', 'knowledge'].includes(r) && RES[r].era <= state.era)
  // Sandbox (e partida continuada após vencer) não tem fim: na última era não há o que concluir.
  const ready = goals.every(g => g.have >= g.need) && !(last && state.flags.includes('sandbox'))
  const card = state.event ? EVENT_BY_ID[state.event] : null
  const contract = state.contracts[0] ?? state.offers[0]
  const nextEvent = EVENT_EVERY - (state.turn % EVENT_EVERY)

  // Mão em leque: cada carta gira e desce um pouco conforme a distância do meio.
  const links = (Object.keys(LINKS) as Link[]).filter(l => LINKS[l].era === tab && !LINKS[l].tile) // Ferrovia vira carta de construção
  const builds = (Object.keys(BUILDINGS) as BuildingId[]).filter(id => BUILDINGS[id].era === tab && (id !== 'warcamp' || !!state.match))
  const mid = (links.length + builds.length - 1) / 2
  const fan = (i: number) => ({ '--rot': `${(i - mid) * 2.2}deg`, '--drop': `${Math.abs(i - mid) ** 2 * 0.8}px` }) as React.CSSProperties

  // Online: cidade do rival (fantasma) na posição do Centro dele, faixa neutra e comitivas na estrada.
  const strip = useMemo(() => (match ? neutralStrip(state) : []), [match?.rival.q, match?.rival.r])
  const rivalAt = match && toWorld(match.rival)
  const focus: [number, number] = look && rivalAt ? rivalAt : [0, 0] // fora da partida a câmera volta ao próprio Centro
  const markers = match ? convoyMarkers(match.rival, online.mySent, online.rival?.sent ?? [], state.turn) : []
  const canvas = (
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 10.5, 7.2], fov: 38 }}>
        <color attach="background" args={['#1a0f08']} />
        <fog attach="fog" args={['#1a0f08', 18, 38]} />
        <Board state={state} buildMode={mode} linkMode={link} demolishMode={wreck} railFrom={railFrom} railTo={railTo} onHex={onHex} fp={fp} onExitFp={() => setFp(false)} focus={focus}
          onEdge={(a, b) => link && act(() => buildLink(state, a, b, link), 'link', ['link_built', { link, era: state.era }])} />
        {match && <NeutralStrip hexes={strip} />}
        {rivalAt && online.rival?.state && <group position={[rivalAt[0], 0, rivalAt[1]]}><Board ghost state={online.rival.state} /></group>}
        {markers.map(m => <ConvoyMarker key={m.id} {...m} />)}
      </Canvas>
  )

  // Primeira pessoa (P, só no computador): só o tabuleiro e a dica de controles.
  if (fp) return (
    <>
      {canvas}
      <div className="fphint frame">{t('WASD andar · Shift correr · mouse olhar · Esc ou P sair')}</div>
      <div className="crosshair" />
    </>
  )

  if (screen !== 'game') {
    const save = loadSave()
    const fresh = !store.get(TUT_DONE)
    return (
      <>
        {canvas}
        <div className="vignette" />
        <div className="title">
          <h1>Hexaera</h1>
          <p>{t('Da fogueira à metrópole')}</p>
          {playing !== null && <p className="nowplaying">● {t('{0} jogando agora', playing)}</p>}
          {screen === 'online' ? <Lobby matchId={matchId} joinId={joinId} phase={online.phase} error={online.error}
            onEnter={id => { setJoinId(null); setMatchId(id) }} onBack={() => { leave(); setScreen('menu') }} />
          : setup ? <SandboxSetup value={setup} onChange={setSetup} onBack={() => setSetup(null)}
            onStart={() => { play(newGame(undefined, setup), 'sandbox'); setSetup(null) }} /> : <div className="pcard menu">
            {save && <button className="opt green" onClick={() => play(save, 'continue')}><b>{t('Continuar')}</b><span>{t('Era {0} · turno {1}', ERAS[save.era].name, save.turn)}</span></button>}
            <button className={`opt ${save || fresh ? 'dark' : 'green'}`} onClick={fresh ? startTutorial : () => play(newGame(), 'new')}><b>{t('Nova civilização')}</b>{save && <span>{t('substitui o jogo salvo')}</span>}</button>
            <button className={`opt ${fresh ? 'green' : 'dark'}`} onClick={startTutorial}><b>{t('Tutorial')}</b><span>{t(fresh ? 'recomendado · 2 minutos' : 'rever as mecânicas')}</span></button>
            <button className="opt dark" onClick={() => { sfx('card'); setScreen('online') }}><b>{t('Jogar online')}</b><span>{t('coop ou versus com um amigo')}</span></button>
            <button className="opt dark" onClick={() => { sfx('card'); setSetup(SANDBOX_DEFAULT) }}><b>Sandbox</b><span>{t('sem objetivo · você ajusta o mundo')}</span></button>
            <button className="opt dark" onClick={() => { setMuted(!mute); setMute(!mute); if (mute) sfx('click') }}><b><Icons text={t(mute ? '🔇 Som desligado' : '🔊 Som ligado')} /></b></button>
            <LangToggle />
          </div>}
        </div>
      </>
    )
  }

  return (
    <>
      {canvas}
      <div className="vignette" />

      {/* ---------- topo: recursos ---------- */}
      <div ref={trackBarHeight} className={`bar frame ${shown.length > 12 ? 'dense' : ''}`}>
        <Stat icon={<Sprite name="hand" size={28} />} value={`${state.actions}/${maxActions(state)}`} title={t('Ações por turno: 3 do Centro + {0} 👤 ociosos + estábulos/moinhos. As que sobram passam para o próximo turno (até {1}), para juntar em obras grandes.', idle(state), 2 * maxActions(state))} />
        <Stat icon={<Sprite name="people" size={30} />} value={`${state.pop}/${housing(state)}`} title={t('População / moradia')} />
        <Stat icon={<Sprite name="smile" size={28} />} value={happy} cls={state.unrest ? 'neg alarm' : happy < 30 ? 'neg' : happy >= 75 ? 'pos' : ''}
          title={t('Felicidade (abaixo de 30 reduz a produção; 75+ dá 📚)') + (debt(state) ? t(' · dívida: −{0}', 2 * debt(state)) : '')} />
        {state.era >= 4 && <Stat icon={<Sprite name="bolt" size={26} />} value={`${power.used}/${power.supply}`}
          title={t('Energia ⚡: usada / gerada neste turno (não acumula). Usinas a carvão geram; Siderúrgica e Fábrica consomem.')} />}
        {(state.era >= 4 || state.pollution > 0) && <Stat icon={<Sprite name="smog" size={28} />} value={state.pollution} delta={pollutionDelta(state)}
          cls={state.pollution >= 40 ? 'neg' : ''} title={t('Poluição ☁️ (0–100): tira ☁️/2 de 😊; acima de 40 traz eventos. Cada floresta e parque limpa.')} />}
        {shown.map(r => (
          <Stat key={r} icon={<ResIcon r={r} size={30} />} value={state.res[r]} delta={inc[r]} title={RES[r].name} cls={state.res[r] < 0 ? 'neg' : ''} />
        ))}
        {state.era > 0 && <Stat icon={<Sprite name="star" size={28} />} value={state.rep} title={t('Reputação: +5% de 💰 em contratos por ⭐')} />}
      </div>

      {/* ---------- topo direito: turno ---------- */}
      <div className="turn">
        <div className="frame turnbox">
          <span className="sun"><Sprite name="sun" size={40} /></span>
          <div>
            <b>{t('Turno {0}', state.turn)}</b>
            <small>{t('Era {0} · {1}', ERAS[state.era].name, ERAS[state.era].center)}</small>
            <div className="hp" title={t('Vida do Centro: se chegar a 0, a partida acaba')}>
              <Sprite name="heart" size={16} /> <i><b style={{ transform: `scaleX(${Math.max(0, state.centerHp) / centerMax(state)})` }} /></i> {state.centerHp}/{centerMax(state)}
            </div>
            {match && <RivalStatus name={rivalName} mode={match.mode} rival={online.rival} turn={state.turn} clock={clock} />}
          </div>
        </div>
        <button className="endturn" onClick={() => finishTurn()} disabled={!!state.over || !!state.event || !canEnd}>
          {matchId && online.phase === 'waiting' ? t('Esperando {0}…', rivalName) : t('Fim do turno')}
        </button>
      </div>

      {/* ---------- esquerda: objetivo / contrato ---------- */}
      {/* No celular os cartões ficam recolhidos (só o título); tocar no título abre/fecha. */}
      <div className={`side ${sideOpen ? 'open' : ''}`} onClick={e => (e.target as HTMLElement).closest('header') && setSideOpen(!sideOpen)}>
        <div className="pcard">
            <header className="gold">{last ? t('Marco Final') : t('Rumo à Era {0}', ERAS[state.era + 1].name)}</header>
            <div className="art sky"><Sprite name="campfire" size={70} /></div>
            {goals.map(g => (
              <div key={g.label} className={`goal ${g.have >= g.need ? 'ok' : ''}`}>
                <span className="check">{g.have >= g.need ? <Sprite name="check" size={14} /> : '○'}</span>
                {g.kind === 'knowledge' ? <Sprite name="books" size={20} /> : g.kind === 'pop' ? <Sprite name="people" size={20} />
                  : <Art id={g.kind} size={20} />}
                {t(g.label)} <b>{Math.min(g.have, g.need)}/{g.need}</b>
              </div>
            ))}
            {coop ? (
              // Coop: a era avança quando os dois votam no mesmo turno (aplicado ao fechar o turno).
              <button className="opt green" disabled={!ready || online.vote || !!lock} onClick={() => { online.setVote(true); sfx('card') }}>
                <b><Icons text={t(online.vote ? 'Voto registrado ✔' : 'Votar para avançar')} /></b>
                <span>{t(partnerVoted ? '{0} votou' : '{0} ainda não votou', rivalName)}</span>
              </button>
            ) : !(last && match) && ( // versus: na última era vence quem derrubar o outro Centro
              <button className="opt green" disabled={!ready} onClick={() => act(() => advanceEra(state))}><b>{t(last ? 'Concluir civilização' : 'Avançar era')}</b></button>
            )}
            <p className="muted">{t(nextEvent > 1 ? 'Próximo evento em {0} turnos' : 'Próximo evento em 1 turno', nextEvent)}</p>
        </div>

        {match && <MilitaryCard state={state} mode={match.mode} outbox={online.outbox} act={fn => act(fn, 'build')} send={send} icon={r => <ResIcon r={r} />} />}

        {state.era > 0 && (
          <div className="pcard">
            <header className="blue">{t('Contrato')}</header>
            {contract ? (() => {
              const active = state.contracts.includes(contract)
              // Aceito: prazo para entregar. Oferta: quando ela some da mesa (a mais antiga roda a cada CONTRACT_EVERY turnos).
              const left = active ? contract.turns : state.offers[0] === contract ? CONTRACT_EVERY - (state.turn % CONTRACT_EVERY) : null
              return (
              <>
                <div className="art sky">
                  <Sprite name="banner" size={70} />
                  {left !== null && <span className={`timer ${active && left <= 2 ? 'urgent' : ''}`} title={t(active ? 'Turnos para entregar' : 'Turnos até a oferta sumir')}>⏱ {left}</span>}
                </div>
                <h4>{CONTRACTS[contract.def].client}</h4>
                <p className="reward">{t(active ? 'Falta' : 'Pede')}: <Cost b={contract.left} /></p>
                <p className="reward">{t('Paga')}: <span className="chip"><ResIcon r="money" />{contractReward(state, contract)}</span> <span className="chip"><Sprite name="star" size={16} />{CONTRACTS[contract.def].rep}</span></p>
                {active ? (
                  <div className="optrow">
                    <button className="opt green" onClick={() => act(() => deliver(state, contract.id), 'coin', ['contract', { action: 'deliver' }])}><b>{t('Entregar')}</b></button>
                    <button className="opt dark" title={t('Perde o que já entregou e {0} ⭐ (vencer o prazo custa {1} ⭐)', CONTRACTS[contract.def].rep, 2 * CONTRACTS[contract.def].rep)}
                      onClick={() => act(() => abandon(state, contract.id), 'uncard', ['contract', { action: 'abandon' }])}><b>{t('Desistir')}</b><span>−{CONTRACTS[contract.def].rep}<Sprite name="star" size={14} /></span></button>
                  </div>
                ) : (
                  <div className="optrow">
                    <button className="opt green" disabled={state.contracts.length >= maxContracts(state)} onClick={() => act(() => accept(state, contract.id), 'card', ['contract', { action: 'accept' }])}>
                      <b>{t('Aceitar')}</b>{maxContracts(state) === 0 && <span>{t('precisa de um Mercado')}</span>}
                    </button>
                    <button className="opt dark" title={t('Descarta esta oferta e chega outra')} onClick={() => act(() => decline(state, contract.id), 'uncard', ['contract', { action: 'decline' }])}>
                      <b>{t('Recusar')}</b><span>{DECLINE_COST}<Sprite name="hand" size={14} /></span>
                    </button>
                  </div>
                )}
              </>
              )
            })() : <p className="muted"><Icons text={t('Construa um 🏪 Mercado para receber contratos.')} /></p>}
          </div>
        )}
      </div>

      {/* ---------- evento: a carta vem do baralho para o meio da tela ---------- */}
      {card && (
        <div className="stage" key={state.event}>
          <div className="pcard event">
            <header className="red">{t('Evento')}</header>
            <div className="art forest"><Sprite name={EVENT_ART[card.id] ?? 'forest'} size={110} /></div>
            <h4>{card.title}</h4>
            <p><Icons text={card.text} /></p>
            {card.options.map((o, i) => {
              const err = canChoose(state, o)
              return (
                <button key={i} className={`opt ${i === 0 ? 'green' : 'dark'}`} disabled={!!err} onClick={() => act(() => resolveEvent(state, i), 'click', ['event_choice', { event: state.event, option: i, auto: false }])}>
                  <b><Icons text={(o.requires ? (err ? '🔒 ' : '🔓 ') : '') + o.label} /></b>
                  <span><Icons text={err ?? eventText(state, o.text)} /></span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ---------- direita: minimapa e botões ---------- */}
      <div className="right">
        <Minimap state={state} />
        <div className="roundbtns">
          <button className={`round ${hand ? 'on' : ''}`} title={t('Construir')} onClick={() => setHand(!hand)}><Sprite name="hammer" size={34} /></button>
          <button className={`round ${wreck ? 'on' : ''}`} title={t('Demolir: volta metade do material')} onClick={() => { sfx(wreck ? 'uncard' : 'card'); setWreck(!wreck); setMode(null); setLink(null) }}><Sprite name="tools" size={34} /></button>
          {state.era > 0 && <button className={`round market ${panel === 'trade' ? 'on' : ''}`} title={t('Mercado e contratos')} onClick={() => toggle('trade')}><Sprite name="market" size={34} /></button>}
          {match && <button className={`round ${look ? 'on' : ''}`} title={t(look ? 'Minha cidade' : 'Ver rival')} aria-label={t(look ? 'Minha cidade' : 'Ver rival')}
            onClick={() => { sfx('card'); setLook(!look) }}><Sprite name={look ? 'campfire' : 'banner'} size={34} /></button>}
          <button className={`round ${panel === 'log' ? 'on' : ''}`} title={t('Registro')} onClick={() => toggle('log')}><Sprite name="scroll" size={34} /></button>
          <button className={`round ${panel === 'menu' ? 'on' : ''}`} title="Menu" onClick={() => toggle('menu')}><Sprite name="gear" size={34} /></button>
        </div>
      </div>

      {panel === 'trade' && <Trade state={state} act={act} onClose={() => setPanel(null)} />}
      {panel === 'log' && (
        <div className="popover frame">
          <h3><Icons text={'📜 ' + t('Registro')} /></h3>
          {state.log.map((m, i) => <div key={i} style={{ opacity: 1 - i * 0.12 }}><Icons text={m} /></div>)}
        </div>
      )}
      {panel === 'menu' && (
        <div className="popover frame">
          <h3><Icons text="⚙️ Menu" /></h3>
          <button className="opt dark" onClick={() => { if (!state.over) track('game_left', { turn: state.turn }); setPanel(null); setTut(null); if (matchId) leave(); setScreen('menu') }}><b>{t('Menu principal')}</b></button>
          <button className="opt dark" onClick={() => { if (!state.over) track('game_left', { turn: state.turn }); play(newGame(), 'restart') }}><b>{t('Nova civilização')}</b></button>
          <button className="opt dark" onClick={() => { setMuted(!mute); setMute(!mute); if (mute) sfx('click') }}><b><Icons text={t(mute ? '🔇 Som desligado' : '🔊 Som ligado')} /></b></button>
          <LangToggle />
        </div>
      )}

      {/* ---------- base: mão de cartas ---------- */}
      {hand && (
        <div className={`dock ${deck ? 'open' : ''}`} onClick={e => e.target === e.currentTarget && setDeck(false)}>
          <div className="tabs">
            {ERAS.slice(0, state.era + 1).map((e, i) => (
              <button key={i} className={tab === i ? 'sel' : ''} onClick={() => { sfx('click'); setTab(i) }}>{e.name.replace(/^do /, '')}</button>
            ))}
          </div>
          {/* No celular a mão é um monte: o primeiro toque abre o leque inteiro; escolher uma carta fecha de novo. */}
          <div className="hand" onClickCapture={e => { if (MOBILE() && !deck) { e.stopPropagation(); sfx('card'); setDeck(true) } }}>
            {links.map((l, i) => (
              <button key={l} style={fan(i)} className={`card infra ${link === l ? 'sel' : ''}`} onClick={() => { sfx(link === l ? 'uncard' : 'card'); pickLink(link === l ? null : l) }} onMouseEnter={() => sfx('hover')}
                title={t('Borda entre hexes · montanha custa o dobro · rio exige ponte (+2 🪵)')}>
                <header>{LINKS[l].name}</header>
                <div className="art"><Art id={l} /></div>
                <p>{t(l === 'trail' ? 'Produção ligada ao Centro rende o dobro.' : l === 'road' ? 'Minas rendem o dobro.' : 'Indústria pesada rende o dobro.')}</p>
                <footer><span className="chip"><Sprite name="hand" size={16} />{LINKS[l].actions}</span><Cost b={LINKS[l].cost} /></footer>
              </button>
            ))}
            {builds.map((id, i) => {
              const b = BUILDINGS[id]
              const err = affordable(state, id)
              const owe = shortfall(state, id)
              const where = terrainsOf(id).map(t => TERRAINS[t].name).join(' / ') + (b.from ? t(' ou ⬆ {0}', BUILDINGS[b.from].name) : '')
              return (
                <button key={id} style={fan(links.length + i)} className={`card ${b.cat} ${mode === id ? 'sel' : ''} ${err ? 'off' : owe ? 'debt' : ''}`}
                  onClick={() => { sfx(mode === id ? 'uncard' : 'card'); pickBuilding(mode === id ? null : id) }} onMouseEnter={() => sfx('hover')}
                  title={[where, id !== 'lumber' && b.terrains.includes('forest') ? t('derruba floresta') : '', err ?? owe ?? ''].filter(Boolean).join(' · ')}>
                  <header>{b.name}</header>
                  <div className="art"><Art id={id} /></div>
                  <p><Icons text={b.desc} /></p>
                  <p className="req"><Icons text={where} /></p>
                  <footer>
                    <span className="chip"><Sprite name="hand" size={16} />{b.actions}</span><Cost b={b.cost} />
                    {b.workers > 0 && <span className="chip"><Sprite name="worker" size={16} />{b.workers}</span>}
                    <span className="chip"><Sprite name="timer" size={16} />{buildTurns(state, id)}</span>
                  </footer>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {wreck && <div className="hint frame"><Icons text={t('Demolir ({0} ✋): toque numa construção · volta metade do material', DEMOLISH_COST)} /> <button className="x" onClick={() => { sfx('uncard'); setWreck(false) }}><Sprite name="cross" size={14} /></button></div>}
      {mode && <div className="hint frame">{mode === 'railway' ? t(railFrom ? (railTo ? 'Ferrovia: toque de novo no destino para construir' : 'Ferrovia: toque no destino (a rota acende com o custo)') : 'Ferrovia: toque na origem — Centro, trilho ou hex livre') : t('{0}: escolha um hex destacado', BUILDINGS[mode].name)} <button className="x" onClick={() => { sfx('uncard'); pickBuilding(null) }}><Sprite name="cross" size={14} /></button></div>}
      {link && <div className="hint frame">{t('{0}: toque numa borda entre dois hexes', LINKS[link].name)} <button className="x" onClick={() => { sfx('uncard'); pickLink(null) }}><Sprite name="cross" size={14} /></button></div>}
      {toast && <div className="toast frame"><Icons text={toast} /></div>}
      {!toast && news && <div className="news frame"><Icons text={news} /></div>}

      {tut !== null && <Coach idx={tut} onNext={() => goStep(tut + 1)} onSkip={() => { track('tutorial_skipped', { step: tut + 1 }); endTutorial(); setScreen('menu') }}
        onFinish={() => { track('tutorial_completed'); endTutorial(); play(newGame(), 'after_tutorial') }} />}

      {state.over && match && (
        <div className="over">
          <div className="pcard big">
            <header className={state.over === 'won' ? 'gold' : 'red'}>{t(state.over === 'won' ? 'Vitória' : 'Derrota')}</header>
            <h2>{endText(match.mode, state.over, rivalName)}</h2>
            <p>{t('Partida online · {0} turnos · Era {1}.', state.turn, ERAS[state.era].name)}</p>
            <button className="opt green" onClick={() => { setPanel(null); leave(); setScreen('menu') }}><b>{t('Menu principal')}</b></button>
          </div>
        </div>
      )}
      {state.over && !match && (
        <div className="over">
          <div className="pcard big">
            <header className={state.over === 'won' ? 'gold' : 'red'}>{t(state.over === 'won' ? 'Vitória' : 'Derrota')}</header>
            {state.over === 'won' ? (
              <>
                <h2>{t('Civilização concluída!')}</h2>
                <p><Icons text={t('Da fogueira à {0} em {1} turnos, com {2} 👤 e {3} ⭐.', ERAS[state.era].center, state.turn, state.pop, state.rep)} /></p>
                <button className="opt dark" onClick={() => setState(keepPlaying(state))}><b>{t('Continuar jogando')}</b><span>{t('sem fim, no mesmo tabuleiro')}</span></button>
              </>
            ) : (
              <>
                <h2>{t('A fogueira se apagou')}</h2>
                <p>{t('Sua tribo sobreviveu {0} turnos.', state.turn)}</p>
                {state.log[0] && <p className="muted"><Icons text={state.log[0]} /></p>}
              </>
            )}
            <button className="opt green" onClick={() => play(newGame(), 'replay')}><b>{t('Nova civilização')}</b></button>
          </div>
        </div>
      )}
    </>
  )
}

// Alterna pt ⇄ en (recarrega; a partida já está salva).
const LangToggle = () => (
  <button className="opt dark" onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}><b><Sprite name="globe" size={16} /> {lang === 'pt' ? 'Português' : 'English'}</b></button>
)

function Stat({ icon, value, delta, title, cls = '' }: { icon: React.ReactNode; value: number | string; delta?: number; title: string; cls?: string }) {
  return (
    <span className="stat" data-tip={title}>
      <i>{icon}</i>
      <span>
        <b className={cls}>{value}</b>
        {delta ? <small className={delta < 0 ? 'neg' : 'pos'}>{sign(delta)}</small> : null}
      </span>
    </span>
  )
}
