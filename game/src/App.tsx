import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { BUILDINGS, CONTRACT_EVERY, CONTRACTS, EVENT_EVERY, ERAS, LINKS, NEXT_ERA_NAME, RES, TERRAINS, type BuildingId, type Link, type Res } from './core/data'
import { EVENT_BY_ID } from './core/events'
import {
  abandon, accept, advanceEra, keepPlaying, terrainsOf, decline, DECLINE_COST, affordable, build, buildLink, canChoose, centerMax, contractReward, debt, deliver, endTurn, eraGoals,
  explore, happiness, pollutionDelta, run, terrainAt, housing, hunt, idle, income, maxActions, maxContracts, newGame, resolveEvent, shortfall, type State,
} from './core/game'
import { distance, key, type Hex } from './core/hex'
import { Board } from './scene/Board'
import { Minimap } from './Minimap'
import { Sprite, type SpriteName } from './Sprite'
import { Trade } from './Trade'
import { Coach, STEPS } from './Tutorial'
import { isMuted, setMuted, sfx, startAmbience, type Sfx } from './sfx'

const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`)
// Ícone de recurso: sprite do atlas quando existe, emoji como reserva.
const RES_SPRITE: Partial<Record<Res, SpriteName>> = {
  wood: 'logs', stone: 'stone', food: 'apple', iron: 'ingot', money: 'coin', knowledge: 'books', clay: 'clay', pottery: 'pottery',
  bronze: 'bronze', weapons: 'weapons', tools: 'tools', cloth: 'cloth', coal: 'coal', steel: 'steel', goods: 'goods',
}
const ResIcon = ({ r, size = 16 }: { r: Res; size?: number }) =>
  RES_SPRITE[r] ? <Sprite name={RES_SPRITE[r]} size={size} /> : <span className="emoji" style={{ fontSize: size * 0.8 }}>{RES[r].icon}</span>
const Cost = ({ b }: { b: Partial<Record<Res, number>> }) => (
  <>{Object.entries(b).map(([r, v]) => <span key={r} className="chip"><ResIcon r={r as Res} />{v}</span>)}</>
)

// Arte das cartas (só interface).
const CARD_SPRITE: Partial<Record<BuildingId | Link, SpriteName>> = {
  farm: 'farm', field: 'field', manor: 'farm', lumber: 'forest', hut: 'hut', house: 'cottage', townhouse: 'townhouse', quarry: 'quarry',
  mine: 'mine', fisher: 'boat', mill: 'windmill', stable: 'cow', tower: 'tower', bronzetower: 'bronzetower', stonetower: 'stonetower',
  trail: 'trail', road: 'road', rail: 'rails', claypit: 'claypit', kiln: 'kiln', elder: 'elder', totem: 'totem',
  scribe: 'scribe', foundry: 'foundry', market: 'market', smith: 'smith', temple: 'temple', barracks: 'barracks',
  workshop: 'workshop', weaver: 'weaver', library: 'library', castle: 'castle', cathedral: 'cathedral',
  coalmine: 'coalmine', powerplant: 'powerplant', steelworks: 'steelworks', factory: 'factory', tenement: 'tenement', park: 'park',
}
// Emoji enquanto a arte da Moderna/Contemporânea não chega.
const EMOJI: Partial<Record<BuildingId | Link, string>> = {
  skyscraper: '🏙️', mechfarm: '🚜', greenhouse: '🪴', vertfarm: '🥬', highway: '🛣️', oilwell: '🛢️', thermal: '🏭', hydro: '💧', electronics: '🔌', carplant: '🚗', apartment: '🏢', hospital: '🏥',
  stadium: '🏟️', turret: '🗼', solar: '☀️', wind: '🌬️', nuclear: '☢️', batteries: '🔋', datacenter: '💾', autofactory: '🤖',
  logistics: '📦', urbanpark: '🌳', landmark: '🌆',
}
const Art = ({ id, size = 58 }: { id: BuildingId | Link; size?: number }) =>
  CARD_SPRITE[id] ? <Sprite name={CARD_SPRITE[id]} size={size} /> : <span className="emoji" style={{ fontSize: size * 0.7 }}>{EMOJI[id]}</span>

type Panel = null | 'trade' | 'log' | 'menu'

// Save automático da partida (o tutorial não salva).
const SAVE = 'hexaera.save'
const TUT_DONE = 'hexaera.tutorial'
const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* sem storage: só não salva */ } },
}
const loadSave = (): State | null => { try { return JSON.parse(store.get(SAVE) ?? 'null') } catch { return null } }

export function App() {
  const [state, setState] = useState<State>(() => loadSave() ?? newGame())
  const [mode, setMode] = useState<BuildingId | null>(null)
  const [link, setLink] = useState<Link | null>(null)
  const [tab, setTab] = useState(0) // era exibida na mão de cartas
  const [panel, setPanel] = useState<Panel>(null)
  const [hand, setHand] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [news, setNews] = useState<string | null>(null)
  const [screen, setScreen] = useState<'menu' | 'game'>('menu')
  const [tut, setTut] = useState<number | null>(null) // passo atual do tutorial
  const tutStart = useRef(state) // estado no início do passo, para detectar a ação pedida
  const pickBuilding = (id: BuildingId | null) => { setMode(id); setLink(null) }
  const pickLink = (l: Link | null) => { setLink(l); setMode(null) }
  const toggle = (p: Panel) => setPanel(panel === p ? null : p)
  useEffect(() => setTab(state.era), [state.era])

  // Dev: window.hex.get()/set() para inspecionar e montar situações de teste no console.
  // reveal(n) revela todos os hexes até o anel n (terreno real da seed).
  if (import.meta.env.DEV) (window as any).hex = {
    get: () => state, set: setState,
    reveal: (n: number) => setState(s => {
      const t = { ...s.tiles }
      for (let q = -n; q <= n; q++) for (let r = -n; r <= n; r++)
        if (distance({ q, r }) <= n && !t[key({ q, r })]) t[key({ q, r })] = { terrain: terrainAt(s.seed, { q, r }) }
      return { ...s, tiles: t }
    }),
  }

  const act = (fn: () => State, s: Sfx = 'click') => {
    try { setState(fn()); sfx(s) } catch (e) { setToast((e as Error).message); sfx('error') }
  }

  // Sons do que o jogo faz sozinho: comparam o estado novo com o anterior.
  const prev = useRef(state)
  useEffect(() => {
    const p = prev.current
    prev.current = state
    if (p === state || state.turn < p.turn) return // nova partida
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

  useEffect(() => { if (screen === 'game' && tut === null) store.set(SAVE, JSON.stringify(state)) }, [state, screen, tut])

  const play = (s: State) => { setState(s); setTut(null); setPanel(null); setMode(null); setLink(null); setScreen('game') }
  const goStep = (i: number, s = state) => {
    const n = STEPS[i].setup?.(s) ?? s
    tutStart.current = n
    setState(n); setTut(i); sfx('card')
  }
  const startTutorial = () => { const g = newGame(); play(g); setHand(true); goStep(0, g) }
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
      if (e.key === 'Escape') { if (mode || link) sfx('uncard'); setMode(null); setLink(null); setPanel(null) }
      if (e.key === 'Enter' && screen === 'game' && !state.over && !state.event) act(() => endTurn(state), 'turn')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onHex = (h: Hex) => {
    if (state.over) return
    if (!state.tiles[key(h)]) return act(() => explore(state, h), 'explore')
    if (mode) {
      act(() => build(state, h, mode), 'build')
      setMode(null)
    } else if (state.invaders.some(i => i.at === key(h))) act(() => hunt(state, h), 'hunt')
  }

  const inc = income(state)
  const power = run(state)
  const happy = happiness(state)
  const goals = eraGoals(state)
  const ready = goals.every(g => g.have >= g.need) && !state.flags.includes('sandbox')
  const last = state.era === ERAS.length - 1
  const card = state.event ? EVENT_BY_ID[state.event] : null
  const contract = state.contracts[0] ?? state.offers[0]
  const nextEvent = EVENT_EVERY - (state.turn % EVENT_EVERY)

  // Mão em leque: cada carta gira e desce um pouco conforme a distância do meio.
  const links = (Object.keys(LINKS) as Link[]).filter(l => LINKS[l].era === tab)
  const builds = (Object.keys(BUILDINGS) as BuildingId[]).filter(id => BUILDINGS[id].era === tab)
  const mid = (links.length + builds.length - 1) / 2
  const fan = (i: number) => ({ '--rot': `${(i - mid) * 2.2}deg`, '--drop': `${Math.abs(i - mid) ** 2 * 0.8}px` }) as React.CSSProperties

  const canvas = (
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 10.5, 7.2], fov: 38 }}>
        <color attach="background" args={['#1a0f08']} />
        <fog attach="fog" args={['#1a0f08', 18, 38]} />
        <Board state={state} buildMode={mode} linkMode={link} onHex={onHex}
          onEdge={(a, b) => link && act(() => buildLink(state, a, b, link), 'link')} />
      </Canvas>
  )

  if (screen === 'menu') {
    const save = loadSave()
    const fresh = !store.get(TUT_DONE)
    return (
      <>
        {canvas}
        <div className="vignette" />
        <div className="title">
          <h1>Hexaera</h1>
          <p>Da fogueira à metrópole</p>
          <div className="pcard menu">
            {save && <button className="opt green" onClick={() => play(save)}><b>Continuar</b><span>Era {ERAS[save.era].name} · turno {save.turn}</span></button>}
            <button className={`opt ${save || fresh ? 'dark' : 'green'}`} onClick={() => play(newGame())}><b>Nova civilização</b>{save && <span>substitui o jogo salvo</span>}</button>
            <button className={`opt ${fresh ? 'green' : 'dark'}`} onClick={startTutorial}><b>Tutorial</b><span>{fresh ? 'recomendado · 2 minutos' : 'rever as mecânicas'}</span></button>
            <button className="opt dark" onClick={() => { setMuted(!mute); setMute(!mute); if (mute) sfx('click') }}><b>{mute ? '🔇 Som desligado' : '🔊 Som ligado'}</b></button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {canvas}
      <div className="vignette" />

      {/* ---------- topo: recursos ---------- */}
      <div className="bar frame">
        <Stat icon={<Sprite name="hand" size={28} />} value={`${state.actions}/${maxActions(state)}`} title={`Ações por turno: 3 do Centro + ${idle(state)} 👤 ociosos + estábulos/moinhos. As que sobram passam para o próximo turno (até ${2 * maxActions(state)}), para juntar em obras grandes.`} />
        <Stat icon={<Sprite name="people" size={30} />} value={`${state.pop}/${housing(state)}`} title="População / moradia" />
        <Stat icon={<Sprite name="smile" size={28} />} value={happy} cls={happy < 30 ? 'neg' : happy >= 75 ? 'pos' : ''}
          title={`Felicidade (abaixo de 30 reduz a produção; 75+ dá 📚)${debt(state) ? ` · dívida: −${2 * debt(state)}` : ''}`} />
        {state.era >= 4 && <Stat icon={<Sprite name="bolt" size={26} />} value={`${power.used}/${power.supply}`}
          title="Energia ⚡: usada / gerada neste turno (não acumula). Usinas a carvão geram; Siderúrgica e Fábrica consomem." />}
        {(state.era >= 4 || state.pollution > 0) && <Stat icon={<Sprite name="smog" size={28} />} value={state.pollution} delta={pollutionDelta(state)}
          cls={state.pollution >= 40 ? 'neg' : ''} title={`Poluição ☁️ (0–100): tira ☁️/2 de 😊; acima de 40 traz eventos. Cada floresta e parque limpa.`} />}
        {/* recursos da era atual sempre; os de eras passadas só quando há estoque ou movimento */}
        {(Object.keys(RES) as Res[]).filter(r => RES[r].era === state.era || state.res[r] || inc[r] || ['food', 'money', 'knowledge'].includes(r) && RES[r].era <= state.era).map(r => (
          <Stat key={r} icon={<ResIcon r={r} size={30} />} value={state.res[r]} delta={inc[r]} title={RES[r].name} cls={state.res[r] < 0 ? 'neg' : ''} />
        ))}
        {state.era > 0 && <Stat icon={<Sprite name="star" size={28} />} value={state.rep} title="Reputação: +5% de 💰 em contratos por ⭐" />}
      </div>

      {/* ---------- topo direito: turno ---------- */}
      <div className="turn">
        <div className="frame turnbox">
          <span className="sun"><Sprite name="sun" size={40} /></span>
          <div>
            <b>Turno {state.turn}</b>
            <small>Era {ERAS[state.era].name} · {ERAS[state.era].center}</small>
            <div className="hp" title="Vida do Centro: se chegar a 0, a partida acaba">
              <Sprite name="heart" size={16} /> <i><b style={{ transform: `scaleX(${Math.max(0, state.centerHp) / centerMax(state)})` }} /></i> {state.centerHp}/{centerMax(state)}
            </div>
          </div>
        </div>
        <button className="endturn" onClick={() => act(() => endTurn(state), 'turn')} disabled={!!state.over || !!state.event}>Fim do turno</button>
      </div>

      {/* ---------- esquerda: objetivo / contrato ---------- */}
      <div className="side">
        <div className="pcard">
            <header className="gold">{last ? 'Marco Final' : `Rumo à Era ${NEXT_ERA_NAME[state.era]}`}</header>
            <div className="art sky"><Sprite name="campfire" size={70} /></div>
            {goals.map(g => (
              <div key={g.label} className={`goal ${g.have >= g.need ? 'ok' : ''}`}>
                <span className="check">{g.have >= g.need ? '✔' : '○'}</span>
                {g.kind === 'knowledge' ? <Sprite name="books" size={20} /> : g.kind === 'pop' ? <Sprite name="people" size={20} />
                  : <Art id={g.kind} size={20} />}
                {g.label} <b>{Math.min(g.have, g.need)}/{g.need}</b>
              </div>
            ))}
            <button className="opt green" disabled={!ready} onClick={() => act(() => advanceEra(state))}><b>{last ? 'Concluir civilização' : 'Avançar era'}</b></button>
            <p className="muted">Próximo evento em {nextEvent} turno{nextEvent > 1 ? 's' : ''}</p>
        </div>

        {state.era > 0 && (
          <div className="pcard">
            <header className="blue">Contrato</header>
            {contract ? (() => {
              const active = state.contracts.includes(contract)
              // Aceito: prazo para entregar. Oferta: quando ela some da mesa (a mais antiga roda a cada CONTRACT_EVERY turnos).
              const left = active ? contract.turns : state.offers[0] === contract ? CONTRACT_EVERY - (state.turn % CONTRACT_EVERY) : null
              return (
              <>
                <div className="art sky">
                  <Sprite name="banner" size={70} />
                  {left !== null && <span className={`timer ${active && left <= 2 ? 'urgent' : ''}`} title={active ? 'Turnos para entregar' : 'Turnos até a oferta sumir'}>⏱ {left}</span>}
                </div>
                <h4>{CONTRACTS[contract.def].client}</h4>
                <p className="reward">{active ? 'Falta' : 'Pede'}: <Cost b={contract.left} /></p>
                <p className="reward">Paga: <span className="chip"><ResIcon r="money" />{contractReward(state, contract)}</span> <span className="chip"><Sprite name="star" size={16} />{CONTRACTS[contract.def].rep}</span></p>
                {active ? (
                  <div className="optrow">
                    <button className="opt green" onClick={() => act(() => deliver(state, contract.id), 'coin')}><b>Entregar</b></button>
                    <button className="opt dark" title={`Perde o que já entregou e ${CONTRACTS[contract.def].rep} ⭐ (vencer o prazo custa ${2 * CONTRACTS[contract.def].rep} ⭐)`}
                      onClick={() => act(() => abandon(state, contract.id), 'uncard')}><b>Desistir</b><span>−{CONTRACTS[contract.def].rep} ⭐</span></button>
                  </div>
                ) : (
                  <div className="optrow">
                    <button className="opt green" disabled={state.contracts.length >= maxContracts(state)} onClick={() => act(() => accept(state, contract.id), 'card')}>
                      <b>Aceitar</b>{maxContracts(state) === 0 && <span>precisa de um Mercado</span>}
                    </button>
                    <button className="opt dark" title="Descarta esta oferta e chega outra" onClick={() => act(() => decline(state, contract.id), 'uncard')}>
                      <b>Recusar</b><span>{DECLINE_COST} ✋</span>
                    </button>
                  </div>
                )}
              </>
              )
            })() : <p className="muted">Construa um 🏪 Mercado para receber contratos.</p>}
          </div>
        )}
      </div>

      {/* ---------- evento: a carta vem do baralho para o meio da tela ---------- */}
      {card && (
        <div className="stage" key={state.event}>
          <div className="pcard event">
            <header className="red">Evento</header>
            <div className="art forest"><Sprite name={card.id === 'lobos' ? 'mountain' : 'forest'} size={110} /></div>
            <h4>{card.title}</h4>
            <p>{card.text}</p>
            {card.options.map((o, i) => {
              const err = canChoose(state, o)
              return (
                <button key={i} className={`opt ${i === 0 ? 'green' : 'dark'}`} disabled={!!err} onClick={() => act(() => resolveEvent(state, i))}>
                  <b>{o.requires && (err ? '🔒 ' : '🔓 ')}{o.label}</b>
                  <span>{err ?? o.text}</span>
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
          <button className={`round ${hand ? 'on' : ''}`} title="Construir" onClick={() => setHand(!hand)}><Sprite name="hammer" size={34} /></button>
          {state.era > 0 && <button className={`round market ${panel === 'trade' ? 'on' : ''}`} title="Mercado e contratos" onClick={() => toggle('trade')}><Sprite name="market" size={34} /></button>}
          <button className={`round ${panel === 'log' ? 'on' : ''}`} title="Registro" onClick={() => toggle('log')}><Sprite name="scroll" size={34} /></button>
          <button className={`round ${panel === 'menu' ? 'on' : ''}`} title="Menu" onClick={() => toggle('menu')}><Sprite name="gear" size={34} /></button>
        </div>
      </div>

      {panel === 'trade' && <Trade state={state} act={act} onClose={() => setPanel(null)} />}
      {panel === 'log' && (
        <div className="popover frame">
          <h3>📜 Registro</h3>
          {state.log.map((m, i) => <div key={i} style={{ opacity: 1 - i * 0.12 }}>{m}</div>)}
        </div>
      )}
      {panel === 'menu' && (
        <div className="popover frame">
          <h3>⚙️ Menu</h3>
          <button className="opt dark" onClick={() => { setPanel(null); setTut(null); setScreen('menu') }}><b>Menu principal</b></button>
          <button className="opt dark" onClick={() => play(newGame())}><b>Nova civilização</b></button>
          <button className="opt dark" onClick={() => { setMuted(!mute); setMute(!mute); if (mute) sfx('click') }}><b>{mute ? '🔇 Som desligado' : '🔊 Som ligado'}</b></button>
        </div>
      )}

      {/* ---------- base: mão de cartas ---------- */}
      {hand && (
        <div className="dock">
          <div className="tabs">
            {ERAS.slice(0, state.era + 1).map((e, i) => (
              <button key={i} className={tab === i ? 'sel' : ''} onClick={() => { sfx('click'); setTab(i) }}>{e.name.replace(/^do /, '')}</button>
            ))}
          </div>
          <div className="hand">
            {links.map((l, i) => (
              <button key={l} style={fan(i)} className={`card infra ${link === l ? 'sel' : ''}`} onClick={() => { sfx(link === l ? 'uncard' : 'card'); pickLink(link === l ? null : l) }} onMouseEnter={() => sfx('hover')}
                title="Borda entre hexes · montanha custa o dobro · rio exige ponte (+2 🪵)">
                <header>{LINKS[l].name}</header>
                <div className="art"><Art id={l} /></div>
                <p>{l === 'trail' ? 'Produção ligada ao Centro rende o dobro.' : l === 'road' ? 'Minas rendem o dobro.' : 'Indústria pesada rende o dobro.'}</p>
                <footer><span className="chip"><Sprite name="hand" size={16} />{LINKS[l].actions}</span><Cost b={LINKS[l].cost} /></footer>
              </button>
            ))}
            {builds.map((id, i) => {
              const b = BUILDINGS[id]
              const err = affordable(state, id)
              const owe = shortfall(state, id)
              const where = terrainsOf(id).map(t => TERRAINS[t].name).join(' / ') + (b.from ? ` ou ⬆ ${BUILDINGS[b.from].name}` : '')
              return (
                <button key={id} style={fan(links.length + i)} className={`card ${b.cat} ${mode === id ? 'sel' : ''} ${err ? 'off' : owe ? 'debt' : ''}`}
                  onClick={() => { sfx(mode === id ? 'uncard' : 'card'); pickBuilding(mode === id ? null : id) }} onMouseEnter={() => sfx('hover')}
                  title={[where, id !== 'lumber' && b.terrains.includes('forest') ? 'derruba floresta' : '', err ?? owe ?? ''].filter(Boolean).join(' · ')}>
                  <header>{b.name}</header>
                  <div className="art"><Art id={id} /></div>
                  <p>{b.desc}</p>
                  <p className="req">{where}</p>
                  <footer>
                    <span className="chip"><Sprite name="hand" size={16} />{b.actions}</span><Cost b={b.cost} />
                    {b.workers > 0 && <span className="chip">👤{b.workers}</span>}
                    <span className="chip">⏱{b.turns}</span>
                  </footer>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {mode && <div className="hint frame">Escolha um hex destacado · Esc cancela</div>}
      {link && <div className="hint frame">Clique numa borda entre dois hexes · Esc cancela</div>}
      {toast && <div className="toast frame">{toast}</div>}
      {!toast && news && <div className="news frame">{news}</div>}

      {tut !== null && <Coach idx={tut} onNext={() => goStep(tut + 1)} onSkip={() => { endTutorial(); setScreen('menu') }}
        onFinish={() => { endTutorial(); play(newGame()) }} />}

      {state.over && (
        <div className="over">
          <div className="pcard big">
            <header className={state.over === 'won' ? 'gold' : 'red'}>{state.over === 'won' ? 'Vitória' : 'Derrota'}</header>
            {state.over === 'won' ? (
              <>
                <h2>Civilização concluída!</h2>
                <p>Da fogueira à {ERAS[state.era].center} em {state.turn} turnos, com {state.pop} 👤 e {state.rep} ⭐.</p>
                <button className="opt dark" onClick={() => setState(keepPlaying(state))}><b>Continuar jogando</b><span>sem fim, no mesmo tabuleiro</span></button>
              </>
            ) : (
              <>
                <h2>A fogueira se apagou</h2>
                <p>Sua tribo sobreviveu {state.turn} turnos.</p>
              </>
            )}
            <button className="opt green" onClick={() => play(newGame())}><b>Nova civilização</b></button>
          </div>
        </div>
      )}
    </>
  )
}

function Stat({ icon, value, delta, title, cls = '' }: { icon: React.ReactNode; value: number | string; delta?: number; title: string; cls?: string }) {
  return (
    <span className="stat" title={title}>
      <i>{icon}</i>
      <span>
        <b className={cls}>{value}</b>
        {delta ? <small className={delta < 0 ? 'neg' : 'pos'}>{sign(delta)}</small> : null}
      </span>
    </span>
  )
}
