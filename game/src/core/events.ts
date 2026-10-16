// Cartas de evento da Era Primitiva. Dados puros: o mesmo texto vira carta física.
import type { Bag, BuildingId } from './data'

export type Effect = {
  res?: Bag // negativo = custo
  actions?: number // negativo = custo
  pop?: number
  happy?: { amount: number; turns: number }
  foodMult?: { mult: number; turns: number }
  eatMult?: { mult: number; turns: number }
  warn?: boolean // anuncia um ataque
  destroy?: boolean // destrói uma construção aleatória
  flag?: string
  pollution?: number
}

export type EventOption = { label: string; text: string; requires?: BuildingId; effect: Effect }

export type EventCard = {
  id: string
  title: string
  text: string
  needs?: { flag?: string; minFood?: number; minPollution?: number }
  once?: boolean
  options: EventOption[]
}

export const EVENTS: EventCard[] = [
  {
    id: 'manada', title: 'Manada selvagem', text: 'Uma manada de cervos passa perto do acampamento.',
    options: [
      { label: 'Caçar', text: '−2 ✋, +6 🍖', effect: { actions: -2, res: { food: 6 } } },
      { label: 'Observar', text: '+1 📚', effect: { res: { knowledge: 1 } } },
    ],
  },
  {
    id: 'lobos', title: 'Uivos na noite', text: 'Lobos rondam a floresta.',
    options: [
      { label: 'Caçar os lobos', text: '−2 ✋, +2 🍖', effect: { actions: -2, res: { food: 2 } } },
      { label: 'Ignorar', text: 'Um ataque é anunciado', effect: { warn: true } },
    ],
  },
  {
    id: 'seca', title: 'Seca', text: 'Há semanas não chove.',
    options: [
      { label: 'Racionar', text: 'Comida −30% por 4 turnos', effect: { foodMult: { mult: 0.7, turns: 4 } } },
      { label: 'Dança da chuva', text: '😊 +5 por 3 turnos, comida −30% por 2', requires: 'totem', effect: { happy: { amount: 5, turns: 3 }, foodMult: { mult: 0.7, turns: 2 } } },
    ],
  },
  {
    id: 'tempestade', title: 'Tempestade', text: 'Ventos fortes castigam o acampamento.',
    options: [
      { label: 'Reforçar', text: '−3 🪵', effect: { res: { wood: -3 } } },
      { label: 'Esperar passar', text: 'Uma construção é destruída', effect: { destroy: true } },
    ],
  },
  {
    id: 'viajante', title: 'O andarilho', text: 'Um viajante pede abrigo em troca de histórias.',
    options: [
      { label: 'Acolher', text: '−3 🍖, +4 📚', effect: { res: { food: -3, knowledge: 4 } } },
      { label: 'Recusar', text: 'Nada acontece', effect: {} },
      { label: 'Conselho dos anciãos', text: '−2 🍖, +6 📚', requires: 'elder', effect: { res: { food: -2, knowledge: 6 } } },
    ],
  },
  {
    id: 'fartura', title: 'Fartura', text: 'Os estoques nunca estiveram tão cheios.', needs: { minFood: 15 },
    options: [
      { label: 'Festejar', text: '−8 🍖, 😊 +10 por 4 turnos', effect: { res: { food: -8 }, happy: { amount: 10, turns: 4 } } },
      { label: 'Guardar', text: 'Nada acontece', effect: {} },
    ],
  },
  {
    id: 'doenca', title: 'Febre', text: 'Uma doença se espalha pela tribo.',
    options: [
      { label: 'Isolar os doentes', text: '−1 👤', effect: { pop: -1 } },
      { label: 'Cuidar de todos', text: '−2 ✋, 😊 −5 por 3 turnos', effect: { actions: -2, happy: { amount: -5, turns: 3 } } },
      { label: 'Ervas do ancião', text: '−3 🍖', requires: 'elder', effect: { res: { food: -3 } } },
    ],
  },
  {
    id: 'silex', title: 'Veio de sílex', text: 'Pedras afiadas aparecem na margem do rio.',
    options: [
      { label: 'Coletar', text: '−1 ✋, +4 🪨', effect: { actions: -1, res: { stone: 4 } } },
      { label: 'Deixar', text: 'Nada acontece', effect: {} },
    ],
  },
  {
    id: 'incendio', title: 'Fogo na mata', text: 'Uma faísca da fogueira pegou na vegetação.',
    options: [
      { label: 'Combater o fogo', text: '−3 ✋', effect: { actions: -3 } },
      { label: 'Deixar queimar', text: 'Uma construção é destruída', effect: { destroy: true } },
    ],
  },
  {
    id: 'tribo', title: 'Tribo vizinha', text: 'Estranhos aparecem com cestos de argila.',
    options: [
      { label: 'Trocar', text: '−5 🪵, +5 🧱', effect: { res: { wood: -5, clay: 5 } } },
      { label: 'Presentear', text: '−4 🍖, 😊 +3 por 3 turnos. Eles vão lembrar.', effect: { res: { food: -4 }, happy: { amount: 3, turns: 3 }, flag: 'amizade' } },
      { label: 'Ignorar', text: 'Nada acontece', effect: {} },
    ],
  },
  {
    id: 'tribo2', title: 'Os amigos voltam', text: 'A tribo que você presenteou retorna para retribuir.',
    needs: { flag: 'amizade' }, once: true,
    options: [
      { label: 'Aprender com eles', text: '+6 📚', effect: { res: { knowledge: 6 } } },
      { label: 'Pedir ajuda', text: '+6 🍖, +4 🪵', effect: { res: { food: 6, wood: 4 } } },
    ],
  },
  {
    id: 'inverno', title: 'Inverno rigoroso', text: 'O frio chegou cedo.',
    options: [
      { label: 'Queimar madeira', text: '−4 🪵', effect: { res: { wood: -4 } } },
      { label: 'Aguentar', text: 'Consumo de comida +50% e 😊 −5 por 3 turnos', effect: { eatMult: { mult: 1.5, turns: 3 }, happy: { amount: -5, turns: 3 } } },
    ],
  },
  {
    id: 'nascimentos', title: 'Tempo de nascimentos', text: 'Crianças nasceram no acampamento.',
    options: [
      { label: 'Celebrar', text: '+1 👤 (se houver moradia), 😊 +3 por 2 turnos', effect: { pop: 1, happy: { amount: 3, turns: 2 } } },
    ],
  },
  // Industrialização (☁️ alta)
  {
    id: 'rio_sujo', title: 'Rio contaminado', text: 'A água do rio escureceu e os peixes sumiram.', needs: { minPollution: 40 },
    options: [
      { label: 'Limpar o rio', text: '−60 💰, −10 ☁️', effect: { res: { money: -60 }, pollution: -10 } },
      { label: 'Ignorar', text: 'Comida −25% por 4 turnos', effect: { foodMult: { mult: 0.75, turns: 4 } } },
    ],
  },
  {
    id: 'protestos', title: 'Protestos', text: 'Operários marcham contra a fumaça das chaminés.', needs: { minPollution: 50 },
    options: [
      { label: 'Instalar filtros', text: '−80 💰, −8 ☁️', effect: { res: { money: -80 }, pollution: -8 } },
      { label: 'Reprimir', text: '😊 −10 por 5 turnos', effect: { happy: { amount: -10, turns: 5 } } },
    ],
  },
  {
    id: 'tosse', title: 'Doenças respiratórias', text: 'A tosse se espalha pelos cortiços.', needs: { minPollution: 60 },
    options: [
      { label: 'Tratar os doentes', text: '−3 ✋, −50 💰', effect: { actions: -3, res: { money: -50 } } },
      { label: 'Deixar como está', text: '−2 👤', effect: { pop: -2 } },
    ],
  },
]

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map(e => [e.id, e]))
