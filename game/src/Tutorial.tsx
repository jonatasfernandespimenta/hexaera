import { useEffect } from 'react'
import { BUILDINGS, CONTRACTS, THREATS, type BuildingId } from './core/data'
import { terrainAt, type State } from './core/game'
import { key, neighbors } from './core/hex'
import { t } from './i18n'

// Tutorial guiado sobre uma partida de verdade: cada passo pode preparar o estado (setup) e
// avança sozinho quando o jogador faz o que foi pedido (done); sem done, avança com "Próximo".
type Ui = { panel: string | null; mode: string | null }
type Step = {
  title: string
  text: string
  target?: string // seletor CSS destacado na tela
  setup?: (s: State) => State
  done?: (s: State, start: State, ui: Ui) => boolean
}

const builtCount = (s: State) => Object.values(s.tiles).filter(t => t.building).length

// Coloca uma construção pronta num hex livre ao redor do Centro (atalho do tutorial).
function place(s: State, id: BuildingId): State {
  const n = structuredClone(s)
  const k = neighbors({ q: 0, r: 0 }).map(key).find(k => !n.tiles[k]?.building && !n.invaders.some(i => i.at === k))
  if (!k) return n
  const terrain = n.tiles[k]?.terrain ?? terrainAt(n.seed, { q: +k.split(',')[0], r: +k.split(',')[1] })
  n.tiles[k] = { terrain, building: { id, turnsLeft: 0, hp: BUILDINGS[id].hp } }
  return n
}

export const STEPS: Step[] = [
  {
    title: 'Bem-vindo a Hexaera',
    text: 'Guie sua tribo da fogueira até a metrópole, atravessando 7 eras. Este tutorial leva uns 2 minutos — você vai jogar de verdade.',
    setup: s => ({ ...s, actions: 12, res: { ...s.res, wood: 20, stone: 10, food: 20 } }),
  },
  {
    title: 'Seus recursos',
    text: '✋ ações do turno, 👤 população, 😊 felicidade e seus estoques. O número verde é o que entra a cada turno.',
    target: '.bar',
  },
  {
    title: 'Explore',
    text: 'O mapa começa escondido. Clique num hex escuro ao lado da fogueira para revelá-lo. Explorar custa ✋.',
    done: (s, start) => Object.keys(s.tiles).length > Object.keys(start.tiles).length,
  },
  {
    title: 'Sua mão de cartas',
    text: 'Cada carta é uma construção, com custo em ✋ e recursos. Escolha uma — a Fazenda (🍖) é um bom começo.',
    target: '.hand',
    done: (s, start, ui) => !!ui.mode || builtCount(s) > builtCount(start),
  },
  {
    title: 'Construa',
    text: 'Os hexes válidos ficam destacados. Clique num deles para erguer a construção.',
    done: (s, start) => builtCount(s) > builtCount(start),
  },
  {
    title: 'Fim do turno',
    text: 'Obras levam alguns turnos (⏱). Ao terminar o turno, tudo produz, a tribo come e as obras avançam. Atalho: Enter.',
    target: '.endturn',
    done: (s, start) => s.turn > start.turn,
  },
  {
    title: 'Eventos',
    text: 'A cada 5 turnos chega uma carta de evento. Escolha uma opção — as marcadas com 🔒 exigem uma construção.',
    target: '.stage .pcard',
    setup: s => ({ ...s, event: 'manada' }),
    done: s => !s.event,
  },
  {
    title: 'Conexões',
    text: 'Cartas roxas (Trilha, Estrada, Ferrovia) vão nas bordas entre hexes. Produção sem conexão até o Centro rende só metade.',
    target: '.card.infra',
  },
  {
    title: 'Metas da era',
    text: 'Cada era pede conhecimento, população e uma construção-marco. Adiantamos o tempo e as metas estão cumpridas: clique em Avançar era.',
    target: '.side .pcard',
    setup: s => {
      const n = place(s, 'kiln')
      return { ...n, pop: Math.max(n.pop, 10), res: { ...n.res, knowledge: Math.max(n.res.knowledge, 20) } }
    },
    done: (s, start) => s.era > start.era,
  },
  {
    title: 'Novas eras',
    text: 'Primitiva → Bronze → Ferro → Medieval → Industrial → Moderna → Contemporânea. Cada era libera cartas (abas da mão) e fortalece o Centro.',
    target: '.tabs',
  },
  {
    title: 'O Mercado',
    text: 'Erguemos um Mercado para você. Abra o painel de comércio.',
    target: '.round.market',
    setup: s => { const n = place(s, 'market'); return { ...n, res: { ...n.res, money: 60 } } },
    done: (_s, _start, ui) => ui.panel === 'trade',
  },
  {
    title: 'Compre ou venda',
    text: 'Negocie qualquer recurso. Cada unidade move o preço, e os preços oscilam a cada 3 turnos. Shift negocia 5.',
    target: '.trade',
    done: s => s.traded > 0,
  },
  {
    title: 'Contratos',
    text: 'Clientes pedem recursos com prazo. Entregar paga 💰 e ⭐ reputação (mais 💰 nos próximos); falhar custa ⭐. Um contrato ativo por Mercado.',
    target: '.side .pcard:nth-child(2)',
    setup: s => {
      const n = structuredClone(s)
      const def = CONTRACTS.findIndex(c => c.era <= n.era)
      if (def >= 0 && !n.offers.length) n.offers.push({ id: n.nextId++, def, left: { ...CONTRACTS[def].want }, turns: CONTRACTS[def].turns })
      return n
    },
  },
  {
    title: 'Invasores!',
    text: 'Ameaças são anunciadas com ⚠️ um turno antes e atacam o Centro (❤️). Clique no invasor para atacá-lo (2 ✋) — ou construa torres.',
    setup: s => {
      const n = structuredClone(s)
      const at = neighbors({ q: 0, r: 0 }).map(key).find(k => n.tiles[k] && !n.tiles[k].building) ?? Object.keys(n.tiles).find(k => k !== '0,0')!
      n.invaders.push({ id: n.nextId++, at, hp: THREATS[0].hp, atk: THREATS[0].atk, kind: 0 })
      n.actions = Math.max(n.actions, 6)
      return n
    },
    done: s => s.invaders.length === 0,
  },
  {
    title: 'Mais adiante',
    text: 'Na Era Industrial surgem ⚡ energia (não acumula) e ☁️ poluição, que derruba a 😊. Florestas e parques limpam o ar.',
  },
  {
    title: 'Jogar online',
    text: 'No versus, chegue ao Bronze e construa o Campo de guerra. Recrute tropas e clique em Atacar: o exército marcha sozinho e chega ao rival como invasores. Tropas em casa defendem o seu Centro.',
  },
  {
    title: 'Pronto!',
    text: 'Vença concluindo o Marco Final da Era Contemporânea. Se o ❤️ do Centro ou a 👤 população zerar, a partida acaba. Boa sorte!',
  },
]

type Props = { idx: number; onNext: () => void; onSkip: () => void; onFinish: () => void }

export function Coach({ idx, onNext, onSkip, onFinish }: Props) {
  const step = STEPS[idx]
  const last = idx === STEPS.length - 1

  // Destaque: o alvo pode surgir depois (painel, carta de evento), então reaplica periodicamente.
  useEffect(() => {
    if (!step.target) return
    const mark = () => document.querySelector(step.target!)?.classList.add('tut-focus')
    mark()
    const t = setInterval(mark, 300)
    return () => { clearInterval(t); document.querySelectorAll('.tut-focus').forEach(e => e.classList.remove('tut-focus')) }
  }, [idx])

  return (
    <div className="coach pcard" key={idx}>
      <header className="gold">{t(step.title)}<small>{idx + 1}/{STEPS.length}</small></header>
      <p>{t(step.text)}</p>
      {last ? <button className="opt green" onClick={onFinish}><b>{t('Começar partida')}</b></button>
        : !step.done ? <button className="opt green" onClick={onNext}><b>{t('Próximo')}</b></button>
        : <p className="muted">👉 {t('Faça a ação para continuar')}</p>}
      {!last && <button className="skip" onClick={onSkip}>{t('Pular tutorial')}</button>}
    </div>
  )
}
