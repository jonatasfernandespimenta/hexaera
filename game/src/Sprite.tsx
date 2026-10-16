// Ícones e artes das folhas em public/ui. Regiões [x, y, w, h, folha] em pixels da folha (folha 0 se omitida).
const SHEETS = [
  { url: '/ui/atlas.png', w: 1448, h: 1086 },
  { url: '/ui/atlas2.png', w: 1448, h: 1086 }, // barreiro, olaria, ancião, totem
  { url: '/ui/atlas3.png', w: 2000, h: 667 }, // livros, população
  { url: '/ui/atlas4.png', w: 1254, h: 1254 }, // construções Bronze→Industrial, recursos
  { url: '/ui/atlas5.png', w: 1254, h: 1254 }, // interface, conexões, casas, plantações
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
} satisfies Record<string, number[]>

export type SpriteName = keyof typeof SPRITES

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
