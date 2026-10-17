import { RES, type Res } from './core/data'

// Ícones e artes das folhas em public/ui. Regiões [x, y, w, h, folha] em pixels da folha (folha 0 se omitida).
const SHEETS = [
  { url: '/ui/atlas.png', w: 1448, h: 1086 },
  { url: '/ui/atlas2.png', w: 1448, h: 1086 }, // barreiro, olaria, ancião, totem
  { url: '/ui/atlas3.png', w: 2000, h: 667 }, // livros, população
  { url: '/ui/atlas4.png', w: 1254, h: 1254 }, // construções Bronze→Industrial, recursos
  { url: '/ui/atlas5.png', w: 1254, h: 1254 }, // interface, conexões, casas, plantações
  { url: '/ui/atlas6.png', w: 1254, h: 1254 }, // Contemporânea + recursos modernos
  { url: '/ui/atlas7.png', w: 1254, h: 1254 }, // comida por era, Moderna, Rodovia
  { url: '/ui/atlas8.png', w: 1254, h: 1254 }, // ilustrações de eventos, ícones de ameaças
  { url: '/ui/atlas9.png', w: 1536, h: 1024 }, // relógio, proibido, fogo, cadeado, escudo
  { url: '/ui/atlas10.png', w: 1254, h: 1254 }, // setas, ok/x, som, idioma
  { url: '/ui/atlas11.png', w: 2000, h: 667 }, // dedo, alerta, aperto de mão, bandeira branca
]

export const SPRITES = {
  wheat: [15, 30, 315, 280], forest: [320, 30, 280, 280], house: [600, 25, 275, 285], worker: [900, 85, 205, 195],
  quarry: [1118, 65, 315, 245],
  rails: [15, 350, 295, 200], mine: [298, 318, 305, 275], campfire: [608, 355, 245, 220], river: [848, 298, 275, 297],
  mountain: [1118, 312, 325, 290],
  windmill: [12, 548, 320, 290], boat: [338, 598, 315, 245], cow: [655, 640, 220, 190], logs: [882, 625, 265, 200],
  stone: [1165, 628, 260, 195],
  ingot: [25, 885, 190, 170], coin: [240, 880, 160, 175], smile: [440, 880, 150, 175], bolt: [645, 880, 130, 155],
  apple: [810, 880, 160, 155], banner: [1000, 815, 240, 240], tower: [1238, 810, 205, 255],
  claypit: [3, 452, 402, 348, 1], kiln: [410, 283, 441, 514, 1], elder: [851, 403, 296, 393, 1], totem: [1159, 339, 280, 468, 1],
  books: [405, 100, 503, 527, 2], people: [1003, 142, 611, 455, 2],
  scribe: [9, 265, 165, 186, 3], bronzetower: [179, 233, 133, 216, 3], foundry: [320, 237, 150, 212, 3], market: [476, 264, 149, 199, 3],
  smith: [632, 233, 150, 218, 3], temple: [787, 267, 158, 191, 3], barracks: [952, 259, 157, 185, 3], stonetower: [1115, 229, 131, 230, 3],
  workshop: [1, 467, 161, 251, 3], weaver: [166, 494, 143, 195, 3], library: [313, 479, 153, 213, 3], castle: [470, 457, 177, 249, 3],
  cathedral: [647, 466, 147, 251, 3], coalmine: [797, 526, 160, 186, 3], powerplant: [960, 469, 140, 248, 3], steelworks: [1105, 475, 147, 235, 3],
  factory: [7, 712, 163, 226, 3], tenement: [173, 729, 146, 209, 3], park: [324, 746, 166, 195, 3], clay: [493, 790, 152, 154, 3],
  pottery: [651, 754, 133, 191, 3], bronze: [795, 799, 161, 153, 3], weapons: [963, 765, 140, 187, 3], tools: [1108, 785, 138, 166, 3],
  cloth: [9, 996, 176, 168, 3], coal: [193, 1012, 161, 152, 3], steel: [361, 1004, 166, 158, 3], goods: [532, 1007, 175, 162, 3],
  hand: [20, 219, 180, 281, 4], smog: [221, 197, 204, 303, 4], star: [425, 276, 197, 223, 4], heart: [644, 290, 187, 211, 4],
  sun: [849, 235, 193, 265, 4], hammer: [1055, 254, 191, 251, 4], scroll: [237, 569, 195, 239, 4], gear: [438, 582, 176, 224, 4],
  trail: [626, 619, 194, 184, 4], road: [829, 614, 206, 198, 4], hut: [1044, 567, 205, 245, 4], cottage: [32, 888, 276, 262, 4],
  townhouse: [320, 837, 279, 315, 4], farm: [606, 844, 349, 314, 4], field: [963, 939, 269, 211, 4],
  solar: [7, 79, 320, 245, 5], wind: [343, 26, 267, 310, 5], nuclear: [633, 28, 297, 316, 5], batteryplant: [945, 95, 301, 237, 5],
  datacenter: [8, 345, 310, 280, 5], autofactory: [324, 355, 287, 270, 5], logistics: [619, 373, 320, 252, 5], urbanpark: [944, 349, 301, 265, 5],
  skyscraper: [19, 625, 266, 345, 5], vertfarm: [315, 625, 282, 336, 5], landmark: [610, 625, 330, 348, 5], oilwell: [956, 688, 287, 274, 5],
  electronics: [15, 995, 285, 226, 5], cars: [321, 987, 292, 234, 5], batteries: [636, 983, 294, 239, 5], tech: [957, 982, 281, 238, 5],
  manor: [40, 32, 392, 295, 6], mechfarm: [455, 26, 394, 304, 6], pumpjack: [876, 15, 339, 330, 6], thermal: [10, 335, 312, 323, 6],
  hydro: [321, 343, 306, 310, 6], electronicsplant: [632, 363, 306, 294, 6], carplant: [948, 371, 298, 282, 6], apartment: [10, 665, 297, 290, 6],
  hospital: [317, 665, 310, 297, 6], stadium: [633, 706, 339, 264, 6], turret: [982, 684, 263, 273, 6], greenhouse: [270, 980, 357, 246, 6],
  highway: [655, 955, 376, 268, 6],
  ev_drought: [22, 27, 288, 325, 7], ev_festival: [322, 30, 298, 322, 7], ev_invasion: [629, 20, 305, 334, 7], ev_storm: [946, 20, 289, 335, 7],
  ev_pollution: [103, 335, 481, 383, 7], ev_trade: [651, 379, 503, 336, 7],
  th_wolf: [30, 712, 272, 262, 7], th_bandit: [336, 712, 276, 262, 7], th_swords: [640, 712, 275, 262, 7], th_army: [948, 712, 278, 262, 7],
  th_dynamite: [186, 958, 266, 262, 7], th_spy: [494, 958, 272, 264, 7], th_cyber: [811, 958, 279, 265, 7],
  timer: [828, 578, 83, 96, 8], noentry: [971, 584, 88, 90, 8], fire: [1119, 579, 80, 94, 8], lock: [1265, 583, 78, 94, 8],
  shield: [1190, 892, 94, 102, 8],
  unlock: [96, 73, 281, 376, 9], up: [479, 123, 294, 324, 9], arrow: [866, 161, 322, 285, 9], check: [78, 531, 328, 262, 9],
  cross: [479, 512, 295, 296, 9], mute: [873, 511, 276, 308, 9], sound: [63, 875, 359, 305, 9], globe: [467, 854, 328, 330, 9],
  cog: [871, 862, 321, 321, 9],
  point: [841, 103, 263, 179, 10], warn: [1124, 374, 232, 216, 10], deal: [1393, 395, 306, 195, 10], flag: [1740, 351, 227, 246, 10],
} satisfies Record<string, number[]>

export type SpriteName = keyof typeof SPRITES

// Folha e recorte de um sprite (para desenhar em canvas, ex.: texturas 3D).
export function spriteRect(name: SpriteName) {
  const [x, y, w, h, sheet = 0] = SPRITES[name] as number[]
  return { url: SHEETS[sheet].url, x, y, w, h }
}

// Mostra a região do atlas encaixada (sem distorcer) numa caixa size×size.
export function Sprite({ name, size }: { name: SpriteName; size: number }) {
  const [x, y, w, h, sheet = 0] = SPRITES[name] as number[]
  const { url, w: W, h: H } = SHEETS[sheet]
  const k = size / Math.max(w, h)
  return (
    <span className="sprite" style={{ width: size, height: size }}>
      <span style={{
        width: w * k, height: h * k,
        backgroundImage: `url(${url})`,
        backgroundSize: `${W * k}px ${H * k}px`,
        backgroundPosition: `${-x * k}px ${-y * k}px`,
      }} />
    </span>
  )
}

export const RES_SPRITE: Record<Res, SpriteName> = {
  wood: 'logs', stone: 'stone', food: 'apple', iron: 'ingot', money: 'coin', knowledge: 'books', clay: 'clay', pottery: 'pottery',
  bronze: 'bronze', weapons: 'weapons', tools: 'tools', cloth: 'cloth', coal: 'coal', steel: 'steel', goods: 'goods',
  oil: 'oilwell', electronics: 'electronics', cars: 'cars', batteries: 'batteries', tech: 'tech',
}

// Emoji dos textos → ícone do atlas. Chaves sem o seletor de variação (U+FE0F); o regex o engole.
const EMOJI: Record<string, SpriteName> = {
  ...Object.fromEntries((Object.keys(RES) as Res[]).map(r => [RES[r].icon.replace('\uFE0F', ''), RES_SPRITE[r]])),
  '✋': 'hand', '👤': 'worker', '😊': 'smile', '⚡': 'bolt', '☁': 'smog', '⭐': 'star', '❤': 'heart', '⏱': 'timer',
  '⛔': 'noentry', '🔥': 'fire', '🔒': 'lock', '⚔': 'th_swords', '🛡': 'shield', '📜': 'scroll', '🏪': 'market',
  '🔓': 'unlock', '⬆': 'up', '→': 'arrow', '👉': 'point', '⚠': 'warn', '🤝': 'deal', '🏳': 'flag', '✔': 'check', '✅': 'check', '✕': 'cross', '❌': 'cross',
  '🔇': 'mute', '🔊': 'sound', '🌐': 'globe', '⚙': 'cog', '🛖': 'hut',
  '🐺': 'th_wolf', '🪓': 'th_bandit', '🧨': 'th_dynamite', '🕵': 'th_spy', '💻': 'th_cyber',
}
const EMOJI_RE = new RegExp(`(${Object.keys(EMOJI).join('|')})\uFE0F?`, 'u')

// Texto com os emoji conhecidos trocados por <Sprite>; o resto continua texto.
export function Icons({ text, size = 16 }: { text: string; size?: number }) {
  return <>{text.split(EMOJI_RE).map((p, i) => (i % 2 ? <Sprite key={i} name={EMOJI[p]} size={size} /> : p))}</>
}
