// Conteúdo do jogo. Valores 🧪 (ver vault: Catálogo de Construções / Exploração).
export type Terrain = 'plains' | 'forest' | 'mountain' | 'river'

export const TERRAINS: Record<Terrain, { name: string; exploreMod: number }> = {
  plains: { name: 'Planície', exploreMod: 0 },
  forest: { name: 'Floresta', exploreMod: 1 },
  mountain: { name: 'Montanha', exploreMod: 3 },
  river: { name: 'Rio', exploreMod: 1 },
}

export type Res =
  | 'food' | 'wood' | 'stone' | 'clay' | 'pottery' | 'bronze' | 'iron' | 'weapons' | 'tools' | 'cloth'
  | 'coal' | 'steel' | 'goods' | 'oil' | 'electronics' | 'cars' | 'batteries' | 'tech' | 'money' | 'knowledge'
export type Bag = Partial<Record<Res, number>>

// era: a partir de quando o recurso aparece na barra. price: preço base no Mercado (sem price = não negociável).
export const RES: Record<Res, { icon: string; name: string; era: number; price?: number }> = {
  food: { icon: '🍖', name: 'Comida', era: 0, price: 3 },
  wood: { icon: '🪵', name: 'Madeira', era: 0, price: 4 },
  stone: { icon: '🪨', name: 'Pedra', era: 0, price: 6 },
  clay: { icon: '🧱', name: 'Argila', era: 0, price: 4 },
  pottery: { icon: '🏺', name: 'Cerâmica', era: 0, price: 12 },
  bronze: { icon: '🔶', name: 'Bronze', era: 1, price: 20 },
  iron: { icon: '⛏', name: 'Ferro', era: 2, price: 15 },
  weapons: { icon: '🗡', name: 'Armas', era: 2, price: 30 },
  tools: { icon: '🔧', name: 'Ferramentas', era: 3, price: 30 },
  cloth: { icon: '🧵', name: 'Tecido', era: 3, price: 25 },
  coal: { icon: '⚫', name: 'Carvão', era: 4, price: 10 },
  steel: { icon: '🔩', name: 'Aço', era: 4, price: 45 },
  goods: { icon: '📦', name: 'Manufaturados', era: 4, price: 70 },
  oil: { icon: '🛢', name: 'Petróleo', era: 5, price: 20 },
  electronics: { icon: '🔌', name: 'Eletrônicos', era: 5, price: 90 },
  cars: { icon: '🚗', name: 'Automóveis', era: 5, price: 200 },
  batteries: { icon: '🔋', name: 'Baterias', era: 6, price: 120 },
  tech: { icon: '💾', name: 'Tecnologia', era: 6, price: 250 },
  money: { icon: '💰', name: 'Dinheiro', era: 1 },
  knowledge: { icon: '📚', name: 'Conhecimento', era: 0 },
}

export type BuildingId =
  | 'hut' | 'farm' | 'lumber' | 'quarry' | 'fisher' | 'claypit' | 'kiln' | 'elder' | 'totem' | 'tower'
  | 'house' | 'field' | 'foundry' | 'stable' | 'scribe' | 'bronzetower' | 'market'
  | 'mine' | 'smith' | 'temple' | 'barracks' | 'townhouse' | 'stonetower'
  | 'workshop' | 'weaver' | 'mill' | 'library' | 'castle' | 'cathedral'
  | 'coalmine' | 'powerplant' | 'steelworks' | 'factory' | 'tenement' | 'park'
  | 'oilwell' | 'thermal' | 'hydro' | 'electronics' | 'carplant' | 'apartment' | 'hospital' | 'stadium' | 'turret'
  | 'manor' | 'mechfarm' | 'greenhouse' | 'vertfarm' | 'skyscraper'
  | 'solar' | 'wind' | 'nuclear' | 'batteries' | 'datacenter' | 'autofactory' | 'logistics' | 'urbanpark' | 'landmark'

export type Category = 'moradia' | 'producao' | 'industria' | 'cultura' | 'defesa' | 'comercio'

export type Link = 'trail' | 'road' | 'rail' | 'highway'
export const LINKS: Record<Link, { name: string; era: number; level: number; actions: number; cost: Bag }> = {
  trail: { name: 'Trilha', era: 0, level: 1, actions: 1, cost: {} },
  road: { name: 'Estrada', era: 2, level: 2, actions: 2, cost: { stone: 1 } },
  rail: { name: 'Ferrovia', era: 4, level: 3, actions: 3, cost: { steel: 2, money: 20 } },
  highway: { name: 'Rodovia', era: 5, level: 4, actions: 2, cost: { money: 50 } }, // vale como ferrovia, mais barata em ✋
}
export const BRIDGE_COST: Bag = { wood: 2 } // borda que toca um Rio
// Borda que toca uma Montanha custa o dobro (✋ e recursos).

export type BuildingDef = {
  name: string
  cat: Category
  desc: string
  era: number // índice em ERAS a partir do qual fica disponível (e continua disponível depois)
  from?: BuildingId // melhoria: substitui essa construção no mesmo hex
  terrains: Terrain[]
  actions: number
  cost: Bag
  turns: number
  workers: number
  hp: number
  link?: Link // conexão mínima até o Centro para render 100% (padrão: trilha; sem ela, metade)
  produces?: Bag
  consumes?: Bag // processamento: só produz se houver insumo
  housing?: number
  tax?: number // 💰 por turno (a partir do Bronze)
  happy?: number
  actionsBonus?: number
  huntBonus?: number // dano extra quando a tribo ataca um invasor
  tradeVolume?: number // unidades por turno no Mercado
  power?: number // ⚡ gerada por turno (usinas; só se o insumo for consumido)
  needsPower?: number // ⚡ exigida para funcionar no turno
  pollution?: number // ☁️ por turno enquanto funciona (negativo = limpa)
  tower?: { damage: number; range: number }
}

const OPEN: Terrain[] = ['plains', 'forest']
const SOLID: Terrain[] = ['plains', 'forest', 'mountain']

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  // Era Primitiva
  hut: { name: 'Cabana', cat: 'moradia', era: 0, desc: '+2 👤 moradores', terrains: OPEN, actions: 2, cost: { wood: 3 }, turns: 1, workers: 0, hp: 2, housing: 2, tax: 1 },
  farm: { name: 'Fazenda', cat: 'producao', era: 0, desc: '+3 🍖', terrains: OPEN, actions: 1, cost: {}, turns: 1, workers: 1, hp: 2, produces: { food: 3 } },
  lumber: { name: 'Lenhador', cat: 'producao', era: 0, desc: '+2 🪵', terrains: ['forest'], actions: 2, cost: {}, turns: 1, workers: 1, hp: 2, produces: { wood: 2 } },
  quarry: { name: 'Pedreira', cat: 'producao', era: 0, desc: '+2 🪨', terrains: ['mountain'], actions: 2, cost: { wood: 2 }, turns: 2, workers: 1, hp: 3, produces: { stone: 2 } },
  fisher: { name: 'Pescador', cat: 'producao', era: 0, desc: '+2 🍖', terrains: ['river'], actions: 2, cost: { wood: 2 }, turns: 1, workers: 1, hp: 2, produces: { food: 2 } },
  claypit: { name: 'Barreiro', cat: 'producao', era: 0, desc: '+2 🧱', terrains: ['river'], actions: 2, cost: { wood: 1 }, turns: 1, workers: 1, hp: 2, produces: { clay: 2 } },
  kiln: { name: 'Olaria', cat: 'industria', era: 0, desc: '2 🧱 → 1 🏺', terrains: ['plains'], actions: 3, cost: { wood: 3, stone: 2 }, turns: 2, workers: 1, hp: 3, consumes: { clay: 2 }, produces: { pottery: 1 } },
  elder: { name: 'Ancião', cat: 'cultura', era: 0, desc: '+1 📚', terrains: ['plains'], actions: 3, cost: { wood: 4 }, turns: 3, workers: 1, hp: 2, produces: { knowledge: 1 } },
  totem: { name: 'Totem', cat: 'cultura', era: 0, desc: '+5 😊', terrains: SOLID, actions: 2, cost: { stone: 2 }, turns: 2, workers: 0, hp: 3, happy: 5 },
  tower: { name: 'Torre de vigia', cat: 'defesa', era: 0, desc: '1 dano, alcance 1', terrains: SOLID, actions: 3, cost: { wood: 3, stone: 2 }, turns: 2, workers: 0, hp: 4, tower: { damage: 1, range: 1 } },

  // Era do Bronze. Melhorias (from) não olham terreno: herdam o hex da construção antiga.
  house: { name: 'Casa', cat: 'moradia', era: 1, from: 'hut', desc: '+4 👤, 2 💰', terrains: [], actions: 2, cost: { clay: 3, wood: 2 }, turns: 1, workers: 0, hp: 4, housing: 4, tax: 2 },
  field: { name: 'Campo arado', cat: 'producao', era: 1, from: 'farm', desc: '+5 🍖', terrains: [], actions: 1, cost: { wood: 2, stone: 1 }, turns: 1, workers: 1, hp: 3, produces: { food: 5 } },
  scribe: { name: 'Escriba', cat: 'cultura', era: 1, from: 'elder', desc: '+2 📚', terrains: [], actions: 2, cost: { clay: 2, pottery: 2 }, turns: 2, workers: 1, hp: 3, produces: { knowledge: 2 } },
  bronzetower: { name: 'Torre de bronze', cat: 'defesa', era: 1, from: 'tower', desc: '2 dano, alcance 2', terrains: [], actions: 2, cost: { stone: 2, money: 30 }, turns: 2, workers: 0, hp: 6, tower: { damage: 2, range: 2 } },
  foundry: { name: 'Fundição', cat: 'industria', era: 1, desc: '+1 🔶', terrains: ['mountain'], actions: 3, cost: { wood: 4, stone: 3 }, turns: 2, workers: 2, hp: 4, produces: { bronze: 1 } },
  stable: { name: 'Estábulo', cat: 'producao', era: 1, desc: '+2 ✋', terrains: ['plains'], actions: 3, cost: { wood: 4, bronze: 1 }, turns: 2, workers: 1, hp: 3, actionsBonus: 2 },
  market: { name: 'Mercado', cat: 'comercio', era: 1, desc: 'comércio + contratos', terrains: ['plains'], actions: 3, cost: { wood: 5, pottery: 2 }, turns: 2, workers: 1, hp: 3, tradeVolume: 10 },

  // Era do Ferro
  mine: { name: 'Mina de ferro', cat: 'producao', era: 2, desc: '+2 ⛏ · estrada', terrains: ['mountain'], actions: 3, cost: { wood: 4, stone: 2 }, turns: 2, workers: 2, hp: 4, link: 'road', produces: { iron: 2 } },
  smith: { name: 'Ferreiro', cat: 'industria', era: 2, desc: '1 ⛏ + 1 🪵 → 1 🗡', terrains: ['plains'], actions: 3, cost: { stone: 3, bronze: 1 }, turns: 2, workers: 1, hp: 4, consumes: { iron: 1, wood: 1 }, produces: { weapons: 1 } },
  townhouse: { name: 'Sobrado', cat: 'moradia', era: 2, from: 'house', desc: '+6 👤, 4 💰', terrains: [], actions: 2, cost: { stone: 4, clay: 3 }, turns: 2, workers: 0, hp: 6, housing: 6, tax: 4 },
  temple: { name: 'Templo', cat: 'cultura', era: 2, from: 'totem', desc: '+8 😊, +1 📚', terrains: [], actions: 3, cost: { stone: 5, pottery: 2 }, turns: 3, workers: 1, hp: 5, happy: 8, produces: { knowledge: 1 } },
  barracks: { name: 'Quartel', cat: 'defesa', era: 2, desc: '+1 dano nos ataques da tribo', terrains: ['plains'], actions: 3, cost: { wood: 4, stone: 3, weapons: 2 }, turns: 2, workers: 1, hp: 5, huntBonus: 1 },
  stonetower: { name: 'Torre de pedra', cat: 'defesa', era: 2, from: 'bronzetower', desc: '3 dano, alcance 2', terrains: [], actions: 2, cost: { stone: 3, money: 60 }, turns: 2, workers: 0, hp: 8, tower: { damage: 3, range: 2 } },

  // Era Medieval
  workshop: { name: 'Oficina', cat: 'industria', era: 3, desc: '1 ⛏ + 1 🪵 → 1 🔧', terrains: ['plains'], actions: 3, cost: { wood: 3, stone: 3 }, turns: 2, workers: 1, hp: 4, consumes: { iron: 1, wood: 1 }, produces: { tools: 1 } },
  weaver: { name: 'Tecelagem', cat: 'industria', era: 3, desc: '2 🍖 → 1 🧵', terrains: ['plains'], actions: 3, cost: { wood: 4, tools: 1 }, turns: 2, workers: 1, hp: 3, consumes: { food: 2 }, produces: { cloth: 1 } },
  mill: { name: 'Moinho', cat: 'producao', era: 3, desc: '+2 ✋', terrains: ['plains', 'river'], actions: 3, cost: { wood: 4, tools: 2 }, turns: 2, workers: 1, hp: 4, actionsBonus: 2 },
  library: { name: 'Biblioteca', cat: 'cultura', era: 3, from: 'scribe', desc: '+4 📚', terrains: [], actions: 3, cost: { stone: 4, tools: 2 }, turns: 3, workers: 1, hp: 5, produces: { knowledge: 4 } },
  castle: { name: 'Castelo', cat: 'defesa', era: 3, from: 'stonetower', desc: '4 dano, alcance 3', terrains: [], actions: 3, cost: { stone: 4, money: 150 }, turns: 3, workers: 0, hp: 12, tower: { damage: 4, range: 3 } },
  cathedral: { name: 'Catedral', cat: 'cultura', era: 3, desc: 'Monumento: +15 😊, +2 📚', terrains: ['plains'], actions: 4, cost: { stone: 14, tools: 4, pottery: 3 }, turns: 5, workers: 2, hp: 10, happy: 15, produces: { knowledge: 2 } },

  // Comida por era: cada uma melhora a anterior (ou é construída do zero), para a 🍖 acompanhar as metas de 👤 (ver vault: Playtest).
  manor: { name: 'Fazenda senhorial', cat: 'producao', era: 3, from: 'field', desc: '+8 🍖', terrains: [], actions: 2, cost: { wood: 3, tools: 1 }, turns: 2, workers: 1, hp: 4, produces: { food: 8 } },
  mechfarm: { name: 'Fazenda mecanizada', cat: 'producao', era: 4, from: 'manor', desc: '+14 🍖 · 2 ⚡ · ☁️1', terrains: [], actions: 3, cost: { steel: 1, tools: 2, money: 40 }, turns: 2, workers: 1, hp: 5, produces: { food: 14 }, needsPower: 2, pollution: 1 },
  greenhouse: { name: 'Estufa', cat: 'producao', era: 5, from: 'mechfarm', desc: '+20 🍖 · 3 ⚡', terrains: [], actions: 3, cost: { steel: 2, goods: 1, money: 80 }, turns: 2, workers: 1, hp: 5, produces: { food: 20 }, needsPower: 3 },
  vertfarm: { name: 'Fazenda vertical', cat: 'producao', era: 6, from: 'greenhouse', desc: '+30 🍖 · 5 ⚡ · sem 👤', terrains: [], actions: 3, cost: { steel: 3, electronics: 2, money: 150 }, turns: 3, workers: 0, hp: 6, produces: { food: 30 }, needsPower: 5 },

  // Era Industrial (ver vault: Energia, Produção e Logística)
  coalmine: { name: 'Mina de carvão', cat: 'producao', era: 4, desc: '+3 ⚫ · estrada · ☁️1', terrains: ['mountain', 'forest'], actions: 3, cost: { wood: 4, tools: 2 }, turns: 2, workers: 2, hp: 5, link: 'road', produces: { coal: 3 }, pollution: 1 },
  powerplant: { name: 'Usina a carvão', cat: 'industria', era: 4, desc: '2 ⚫ → 8 ⚡ · ☁️4', terrains: ['plains'], actions: 4, cost: { stone: 8, tools: 2, money: 60 }, turns: 3, workers: 2, hp: 6, consumes: { coal: 2 }, power: 8, pollution: 4 },
  steelworks: { name: 'Siderúrgica', cat: 'industria', era: 4, desc: '2 ⚫ + 3 ⛏ + 4 ⚡ → 2 🔩 · ferrovia', terrains: ['plains'], actions: 4, cost: { stone: 6, tools: 3, money: 80 }, turns: 3, workers: 3, hp: 6, link: 'rail', consumes: { coal: 2, iron: 3 }, produces: { steel: 2 }, needsPower: 4, pollution: 3 },
  factory: { name: 'Fábrica', cat: 'industria', era: 4, desc: '1 🔩 + 1 🧵 + 4 ⚡ → 2 📦 · ferrovia', terrains: ['plains'], actions: 4, cost: { stone: 4, steel: 3, money: 100 }, turns: 3, workers: 3, hp: 6, link: 'rail', consumes: { steel: 1, cloth: 1 }, produces: { goods: 2 }, needsPower: 4, pollution: 2 },
  tenement: { name: 'Cortiço', cat: 'moradia', era: 4, from: 'townhouse', desc: '+10 👤, 6 💰, −2 😊', terrains: [], actions: 2, cost: { stone: 4, steel: 1 }, turns: 2, workers: 0, hp: 6, housing: 10, tax: 6, happy: -2 },
  park: { name: 'Parque público', cat: 'cultura', era: 4, desc: '+5 😊, −2 ☁️', terrains: ['plains', 'forest'], actions: 2, cost: { wood: 4, money: 30 }, turns: 2, workers: 0, hp: 3, happy: 5, pollution: -2 },

  // Era Moderna: petróleo, eletricidade em massa, automóveis
  oilwell: { name: 'Poço de petróleo', cat: 'producao', era: 5, desc: '+2 🛢 · estrada · ☁️2', terrains: ['plains', 'mountain'], actions: 3, cost: { steel: 2, money: 80 }, turns: 2, workers: 2, hp: 5, link: 'road', produces: { oil: 2 }, pollution: 2 },
  thermal: { name: 'Termelétrica', cat: 'industria', era: 5, desc: '2 🛢 → 15 ⚡ · ☁️5', terrains: ['plains'], actions: 4, cost: { steel: 4, money: 150 }, turns: 3, workers: 2, hp: 6, consumes: { oil: 2 }, power: 15, pollution: 5 },
  hydro: { name: 'Hidrelétrica', cat: 'industria', era: 5, desc: '12 ⚡ limpa · −2 😊 (alaga)', terrains: ['river'], actions: 4, cost: { stone: 10, steel: 4, money: 200 }, turns: 4, workers: 1, hp: 8, power: 12, happy: -2 },
  electronics: { name: 'Fábrica de eletrônicos', cat: 'industria', era: 5, desc: '1 📦 + 1 🛢 + 5 ⚡ → 2 🔌 · ferrovia', terrains: ['plains'], actions: 4, cost: { steel: 4, money: 200 }, turns: 3, workers: 3, hp: 6, link: 'rail', consumes: { goods: 1, oil: 1 }, produces: { electronics: 2 }, needsPower: 5, pollution: 2 },
  carplant: { name: 'Montadora', cat: 'industria', era: 5, desc: '2 🔩 + 1 🔌 + 1 🛢 + 8 ⚡ → 1 🚗 · ferrovia', terrains: ['plains'], actions: 5, cost: { steel: 6, money: 300 }, turns: 4, workers: 4, hp: 8, link: 'rail', consumes: { steel: 2, electronics: 1, oil: 1 }, produces: { cars: 1 }, needsPower: 8, pollution: 3 },
  apartment: { name: 'Prédio residencial', cat: 'moradia', era: 5, from: 'tenement', desc: '+16 👤, 10 💰', terrains: [], actions: 3, cost: { steel: 4, money: 100 }, turns: 3, workers: 0, hp: 8, housing: 16, tax: 10 },
  hospital: { name: 'Hospital', cat: 'cultura', era: 5, desc: '+6 😊, +2 📚', terrains: ['plains'], actions: 3, cost: { steel: 3, goods: 2, money: 150 }, turns: 3, workers: 2, hp: 6, happy: 6, produces: { knowledge: 2 } },
  stadium: { name: 'Estádio', cat: 'cultura', era: 5, desc: 'Monumento: +20 😊', terrains: ['plains'], actions: 5, cost: { steel: 10, goods: 6, money: 500 }, turns: 5, workers: 3, hp: 12, happy: 20 },
  turret: { name: 'Torreta', cat: 'defesa', era: 5, from: 'castle', desc: '6 dano, alcance 3', terrains: [], actions: 3, cost: { steel: 2, money: 300 }, turns: 2, workers: 0, hp: 14, tower: { damage: 6, range: 3 } },

  // Era Contemporânea: energia limpa, automação, logística (ver vault: Capacidade de Trabalho)
  skyscraper: { name: 'Torre residencial', cat: 'moradia', era: 6, from: 'apartment', desc: '+30 👤, 18 💰', terrains: [], actions: 4, cost: { steel: 8, electronics: 2, money: 300 }, turns: 4, workers: 0, hp: 10, housing: 30, tax: 18 },
  solar: { name: 'Usina solar', cat: 'industria', era: 6, desc: '5 ⚡ limpa · sem 👤', terrains: ['plains'], actions: 2, cost: { steel: 2, electronics: 2, money: 100 }, turns: 2, workers: 0, hp: 4, power: 5 },
  wind: { name: 'Parque eólico', cat: 'industria', era: 6, desc: '6 ⚡ limpa · sem 👤', terrains: ['plains', 'mountain'], actions: 2, cost: { steel: 3, electronics: 1, money: 120 }, turns: 2, workers: 0, hp: 4, power: 6 },
  nuclear: { name: 'Usina nuclear', cat: 'industria', era: 6, desc: '40 ⚡ limpa · −3 😊 (medo)', terrains: ['plains'], actions: 5, cost: { steel: 15, electronics: 6, money: 1000 }, turns: 5, workers: 4, hp: 10, power: 40, happy: -3 },
  batteries: { name: 'Fábrica de baterias', cat: 'industria', era: 6, desc: '1 🔌 + 1 ⚫ + 4 ⚡ → 2 🔋 · ferrovia', terrains: ['plains'], actions: 4, cost: { steel: 4, electronics: 2, money: 300 }, turns: 3, workers: 2, hp: 6, link: 'rail', consumes: { electronics: 1, coal: 1 }, produces: { batteries: 2 }, needsPower: 4, pollution: 1 },
  datacenter: { name: 'Data center', cat: 'industria', era: 6, desc: '2 🔌 + 8 ⚡ → 2 💾 + 4 📚 · ferrovia', terrains: ['plains', 'mountain'], actions: 4, cost: { steel: 4, electronics: 4, money: 400 }, turns: 3, workers: 2, hp: 6, link: 'rail', consumes: { electronics: 2 }, produces: { tech: 2, knowledge: 4 }, needsPower: 8 },
  autofactory: { name: 'Fábrica automatizada', cat: 'industria', era: 6, from: 'factory', desc: '1 🔩 + 1 🧵 + 6 ⚡ → 4 📦 · sem 👤', terrains: [], actions: 3, cost: { steel: 4, electronics: 3, money: 300 }, turns: 3, workers: 0, hp: 8, link: 'rail', consumes: { steel: 1, cloth: 1 }, produces: { goods: 4 }, needsPower: 6, pollution: 1 },
  logistics: { name: 'Centro logístico', cat: 'comercio', era: 6, desc: '+1 contrato, comércio 20/turno', terrains: ['plains'], actions: 4, cost: { steel: 6, electronics: 2, money: 400 }, turns: 3, workers: 2, hp: 6, link: 'rail', tradeVolume: 20 },
  urbanpark: { name: 'Parque urbano', cat: 'cultura', era: 6, from: 'park', desc: '+8 😊, −4 ☁️', terrains: [], actions: 2, cost: { steel: 2, money: 150 }, turns: 2, workers: 0, hp: 4, happy: 8, pollution: -4 },
  landmark: { name: 'Cidade Inteligente', cat: 'cultura', era: 6, desc: 'Marco Final: conclui a civilização', terrains: ['plains'], actions: 6, cost: { tech: 20, batteries: 20, cars: 10, money: 3000 }, turns: 6, workers: 0, hp: 20, happy: 20 },
}

// Madeira ganha na hora ao derrubar uma floresta.
export const CLEAR_FOREST_WOOD = 3

// Custo base de exploração por anel.
export const RING_COST = [0, 1, 2, 3, 5, 8, 13]

export const CENTER_HP = 10 // + CENTER_HP_PER_ERA a cada era (o Centro evolui junto)
export const CENTER_HP_PER_ERA = 5
export const HUNT_COST = 2 // ✋ para a tribo atacar um invasor
export const EVENT_EVERY = 5 // turnos
export const THREAT_FROM_TURN = 5
export const THREAT_CHANCE = 1 / 7

// Ameaças por era (ver vault: Ameaças por Era). ponytail: sem os especiais (roubo, grupos, aviso de 2 turnos).
export type Threat = { name: string; icon: string; hp: number; atk: number; loot: Bag; sabotage?: boolean } // sabotage: destrói conexões
export const THREATS: Threat[] = [
  { name: 'Lobos', icon: '🐺', hp: 2, atk: 1, loot: { food: 2 } },
  { name: 'Saqueadores', icon: '🪓', hp: 3, atk: 2, loot: { money: 5 } },
  { name: 'Bando armado', icon: '⚔️', hp: 5, atk: 3, loot: { money: 8 } },
  { name: 'Exército', icon: '🛡', hp: 7, atk: 3, loot: { money: 15 } }, // playtest: 10 ❤️/4 ⚔ derrubava 1 em 4 Centros no Medieval
  { name: 'Sabotadores', icon: '🧨', hp: 6, atk: 3, loot: { money: 20 }, sabotage: true },
  { name: 'Sabotagem industrial', icon: '🕵', hp: 6, atk: 5, loot: { money: 40 }, sabotage: true },
  { name: 'Ciberataque', icon: '💻', hp: 8, atk: 6, loot: { money: 80 }, sabotage: true },
]

// Eras e o que é preciso para sair de cada uma. O jogador decide quando avançar; o tabuleiro permanece.
// Cumprir a meta da última era (Marco Final) conclui a civilização. center: nome do Centro na era.
// idle: ✋ por 👤 ocioso (ver vault: Capacidade de Trabalho).
export const ERAS: { name: string; center: string; idle: number; goal: { knowledge: number; pop: number; building: BuildingId } }[] = [
  { name: 'Primitiva', center: 'Fogueira', idle: 1, goal: { knowledge: 20, pop: 10, building: 'kiln' } },
  { name: 'do Bronze', center: 'Acampamento', idle: 1, goal: { knowledge: 90, pop: 24, building: 'foundry' } },
  { name: 'do Ferro', center: 'Aldeia', idle: 1.5, goal: { knowledge: 180, pop: 34, building: 'smith' } },
  { name: 'Medieval', center: 'Praça da Vila', idle: 1.5, goal: { knowledge: 280, pop: 45, building: 'cathedral' } },
  { name: 'Industrial', center: 'Prefeitura', idle: 1.5, goal: { knowledge: 500, pop: 70, building: 'factory' } },
  { name: 'Moderna', center: 'Centro Urbano', idle: 2, goal: { knowledge: 800, pop: 110, building: 'carplant' } },
  { name: 'Contemporânea', center: 'Metrópole', idle: 2, goal: { knowledge: 1300, pop: 160, building: 'landmark' } },
]
export const NEXT_ERA_NAME = ERAS.slice(1).map(e => e.name)

// ☁️ poluição: 0–100; cada floresta limpa 1 por turno; felicidade perde ☁️/2.
export const FOREST_CLEAN = 1

// ---------- comércio ----------
export const PRICE_EVERY = 3 // turnos entre oscilações de preço
export const SELL_SPREAD = 0.8 // venda paga 80% do preço
export const PRICE_STEP = 0.05 // cada unidade negociada move o preço 5%

// ---------- contratos (ver vault: Exemplos de Contratos) ----------
export type ContractDef = { client: string; era: number; want: Bag; turns: number; money: number; rep: number }
export const CONTRACTS: ContractDef[] = [
  { client: 'Caravana', era: 1, want: { wood: 20 }, turns: 5, money: 120, rep: 1 },
  { client: 'Tribo do rio', era: 1, want: { pottery: 6, food: 15 }, turns: 8, money: 200, rep: 1 },
  { client: 'Mercador de metais', era: 1, want: { bronze: 5 }, turns: 7, money: 180, rep: 1 },
  { client: 'Construtores', era: 1, want: { stone: 15, clay: 10 }, turns: 6, money: 150, rep: 1 },
  { client: 'Reino vizinho', era: 2, want: { iron: 20 }, turns: 10, money: 400, rep: 2 },
  { client: 'Guarda real', era: 2, want: { weapons: 8 }, turns: 6, money: 350, rep: 2 },
  { client: 'Cidade costeira', era: 2, want: { food: 40, wood: 20 }, turns: 8, money: 300, rep: 1 },
  { client: 'Guilda', era: 3, want: { cloth: 15, tools: 8 }, turns: 12, money: 900, rep: 3 },
  { client: 'Catedral distante', era: 3, want: { stone: 40 }, turns: 12, money: 500, rep: 2 },
  { client: 'Exército do rei', era: 3, want: { weapons: 15, food: 30 }, turns: 10, money: 800, rep: 3 },
  { client: 'Companhia ferroviária', era: 4, want: { steel: 25 }, turns: 15, money: 2000, rep: 4 },
  { client: 'Império colonial', era: 4, want: { goods: 15 }, turns: 15, money: 2400, rep: 4 },
  { client: 'Cidade vizinha', era: 4, want: { coal: 40 }, turns: 8, money: 700, rep: 2 },
  { client: 'Governo', era: 5, want: { cars: 10 }, turns: 20, money: 6000, rep: 5 },
  { client: 'Rede de lojas', era: 5, want: { electronics: 15 }, turns: 12, money: 3000, rep: 4 },
  { client: 'Refinaria vizinha', era: 5, want: { oil: 30 }, turns: 10, money: 1500, rep: 3 },
  { client: 'Startup', era: 6, want: { tech: 10 }, turns: 12, money: 5000, rep: 5 },
  { client: 'Montadora elétrica', era: 6, want: { batteries: 15, cars: 5 }, turns: 18, money: 8000, rep: 6 },
]
export const CONTRACT_OFFERS = 3
export const CONTRACT_EVERY = 4 // turnos: o mais antigo sai e entra um novo
export const REP_BONUS = 0.05 // +5% de 💰 em contratos por ⭐
