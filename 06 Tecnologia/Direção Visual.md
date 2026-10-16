---
tags: [tecnologia, arte]
status: decidido
---
# Direção Visual

> **Um diorama 3D em pixel art/voxel sobre uma mesa de madeira.**
> Os tiles são peças físicas grossas; em cima deles, o terreno e as construções são miniaturas 3D com estética pixel art. A UI é pixel art com molduras de pergaminho e madeira.

## 🎯 Alvo principal — "quero exatamente isso"
![[ref-alvo-principal.jpg]]

Referência secundária (organização da mesa): Agricola no Tabletop Simulator.
![[ref-tabletop-simulator.png]]

---

## Mesa e ambiente
- Mesa de **madeira escura**, iluminação **quente** de lampião/vela (canto superior esquerdo), vinheta escura nas bordas.
- **Props físicos** espalhados: bandeja de madeira com meeples, meeples soltos, moedas/tokens redondos, **dados** com ícones de recurso, saquinho de pano, pilha de cartas virada.
- Props são decorativos mas **coerentes com o jogo** (cores dos meeples = jogadores, ícones dos dados = recursos).

## Tiles hexagonais
- **Peças grossas** com lateral de madeira/terra visível, levemente separadas umas das outras (dá pra ver que são peças).
- **Revelado**: diorama 3D em cima — árvores, montanhas, rios que **continuam de um tile para o outro**, campos, animais, pontes, ferrovia.
- **Oculto**: tile **escuro/carvão** com `?` gravado **ou** a silhueta do bioma (pista: árvore, montanha). → isso é a mecânica de [[Exploração#Pistas]] visualizada.
- **Relevo**: cada terreno tem altura própria (planície baixa, floresta um pouco acima, montanha bem mais alta) + pequena variação por hex, para o tabuleiro não ficar chapado.
- Rios e trilhos atravessam bordas — reforça a regra de infraestrutura nas bordas ([[Produção e Logística]]).

## Miniaturas (resolve a questão em aberto)
- ✅ **Miniaturas 3D detalhadas** em estilo pixel/voxel, **não** tokens planos.
- Árvores, casas, moinho, fogueira acesa, mina com trilho, fábrica com fumaça, barco no rio, vacas.
- **Meeples azuis** sobre os tiles = trabalhadores alocados.
- **Estandarte vermelho** marca o Centro.
- Efeitos pequenos animados: fogo da fogueira, fumaça da chaminé, água do rio.

## Interface (pixel art)
| Posição | Elemento |
|---|---|
| Topo, centro | **Barra de recursos** em madeira escura: ícone + total + ganho por turno (ver ícones abaixo) |
| Topo, direita | Painel **Turno N + Era** (ícone de sol) e botão vermelho grande **End Turn** |
| Esquerda | Carta de **Evento** ativa (com opções clicáveis) e carta de **Contrato** ativa |
| Direita, cima | **Minimapa** em pergaminho, hexes revelados vs. ocultos |
| Direita, meio | Botões redondos: Construir 🔨, População 👥, Registro 📜, Configurações ⚙️ |
| Base | **Mão de cartas** de construção em leque: nome no cabeçalho colorido, arte, efeito, custo em ícones |

### Ícones (decidido)
Regra: **um ícone = um significado**, em todas as telas, cartas e peças físicas.
| Ícone | Significado | Observação |
|---|---|---|
| ✋ | **Ações** (capacidade do turno) | exibido como `3/3`; mão = "o que você consegue fazer" |
| 👤 | População | |
| 🍖 | Comida | |
| 🪵 | Madeira | |
| 🪨 | Pedra | |
| 🧱 | Argila | |
| ⛏ | Ferro (minério) | |
| 🔩 | Aço | |
| 💰 | Dinheiro | aparece só a partir do Bronze |
| 😊 | Felicidade | |
| ☁️ | Poluição | |
| 📚 | Conhecimento | |
| ⚡ | **Energia elétrica** | só a partir da Industrial — nunca usar para ações |
| 🗡 | Armas | |
| 🛡 | Segurança | |
| ⭐ | Reputação | |
| ⏱ | Tempo de obra (turnos) | |
| ⚠️ | Invasão anunciada | marcador no hex |
| 🔨 | Botão Construir | ação de UI, não recurso |

- Molduras de **pergaminho/bege** com borda marrom; cabeçalhos coloridos por categoria (azul unidade, verde produção, marrom moradia, roxo infraestrutura).
- Fonte **pixel** legível, com contorno: **Tiny5** (a Pixelify Sans confundia 5 com S).
- Números de ganho em verde (+5).

## Regras técnicas (Three.js)
- **Texturas pixel art** com `NearestFilter` (mag e min), `generateMipmaps = false`; no CSS da UI, `image-rendering: pixelated`.
- Miniaturas: **voxel** gerado por código (`InstancedMesh`) ou MagicaVoxel → `.glb` com paleta limitada — o "pixel" vem dos voxels e da textura.
- Paleta única para o jogo todo (32–48 cores) 🧪.
- Iluminação: luz direcional quente + sombras suaves; leve *depth of field* nas bordas da mesa.
- UI em escala inteira (2×, 3×) para não deformar pixels.
- Tiles como componentes independentes: base (peça) + diorama (terreno) + slot de construção + slots de meeple.

## Animações
- Tile **virando** ao explorar (lado escuro → diorama).
- Construção "brotando"/sendo colocada com um "toc".
- Carta comprada do baralho e jogada na mesa.
- Meeple pulando para o tile ao ser alocado.

## Mão de cartas
✅ Resolvido: no digital a mão de cartas é **só interface** (todas as construções liberadas ficam disponíveis). No tabuleiro, as cartas são referência de custo/produção e o limite vem do estoque de miniaturas. Ver [[Construções#Disponibilidade (decidido)]].

## Assets em uso (2026-10-16)
- **Modelos 3D:** pack MagicaVoxel `game/public/models/Models.vox` (363 modelos com nome). O manifesto `src/scene/voxManifest.json` (nome → índice, tamanho, posição, rotação) é gerado a partir do arquivo; `<Vox name="…">` em `src/scene/vox.tsx` carrega uma vez e reaproveita as geometrias.
  - Usado para vegetação (árvores *Skinny*, arbustos, grama), trigo, fardo, cerca, galinha, serraria, toras, pedras, minério, vagonete e trilhos, doca, urnas, bigorna, estantes, ídolo (Totem), anel de fogueira etc.
  - Corpos das construções continuam em voxel feito por código, decorados com peças do pack (o pack não tem casas inteiras).
  - Catálogo de desenvolvimento: `http://localhost:5179/?catalog=termo1|termo2` mostra os modelos com o nome.
- **Montanhas:** heightmap de voxels (`InstancedMesh`), rocha cinza-azulada com neve no topo.
- **Rios:** canais que atravessam as bordas e continuam para os hexes ocultos (árvore sem ciclos).
- **Ícones/arte das cartas:** atlas `game/public/ui/atlas.png` (1448×1086) usado como sprite CSS; regiões em `src/Sprite.tsx`. O ⚡ do atlas fica reservado para energia.
- **Mesa:** textura de tábuas gerada em canvas, lampião, meeples, moedas, dados com ícones, baralho e saquinho (`src/scene/Table.tsx`).
- **Interface:** barra de recursos com ganho por turno, painel de turno com ☀️ e vida do Centro, cartas de Evento/Objetivo e Contrato à esquerda, minimapa de pergaminho, botões redondos (🔨 🏪 📜 ⚙️), mão de cartas com abas por era.

## Em aberto
- [ ] Paleta definitiva.
- [x] Miniaturas: voxel por código **e** pack MagicaVoxel (ver Assets em uso).
- [ ] Licença dos assets (pack .vox e atlas) confirmada para uso comercial.

## Som

SFX sintetizados na hora com Web Audio (`game/src/sfx.ts`), estilo chiptune, sem arquivos de áudio. Ações do jogador tocam o som passado ao `act()`; acontecimentos automáticos (ataque, dano no Centro, evento, nova era, vitória/derrota) saem da comparação entre o estado novo e o anterior. Mudo no menu ⚙️, lembrado no navegador.

Cartas: som ao passar o mouse, ao selecionar e ao soltar (clique de novo ou Esc).

Ambiente: folhas ao vento + rio correndo (ruído filtrado em loop) com rajadas, bolhas e passarinho aleatórios; começa no primeiro clique (regra de autoplay do navegador) e entra em fade.

Pendente: ambiente variar com o terreno visível e com a era (cidade industrial ≠ floresta); música por era; trocar síntese por samples se a direção pedir algo mais orgânico.

## Animação do diorama

- **Vento:** grama, trigo, arbustos e árvores usam um material com deslocamento no vertex shader (`windy()` em `scene/vox.tsx`, prop `sway="grass" | "breeze"`). A base fica presa, o topo balança; a fase vem da posição no mundo, então rajadas atravessam o tabuleiro. Custo zero de CPU.
- **Bichos:** `Wander` em `scene/Board.tsx` faz o bicho andar numa elipse dentro do tile, com ritmo irregular (para e anda) e pulinho. Hoje: galinha da Fazenda e cavalo do Estábulo.
- **Eventos:** a carta voa do canto esquerdo para o meio da tela e escurece o fundo até o jogador escolher.

Sprites de interface: `atlas4.png` (construções Bronze→Industrial e recursos) e `atlas5.png` (ações, poluição, reputação, vida, turno, botões, Trilha/Estrada, casas por era, Fazenda/Campo).

## Modelos feitos à mão no padrão do pack
`game/src/scene/voxbox.tsx`. Tudo que não vem do pack MagicaVoxel segue o mesmo visual:
- **Caixas** usam um material com textura de voxel no shader: células de 0,02 com leve variação de tom, aresta do topo mais clara e base mais escura (como o sombreamento dos modelos importados). Zero custo extra de geometria.
- **Formas curvas** (cilindro, cone/pirâmide, cúpula, anel, telhado arredondado) viram **degraus de voxel**, fundidos numa geometria por forma (`<Shape kind=…>`). Nada de cilindro/esfera lisa no tabuleiro.
- Exceções de propósito: peças hexagonais do tabuleiro, moedas e dados da mesa (têm ícone impresso).

## Celular
Layout em `style.css` (`@media (max-width: 820px), (max-height: 520px)`): barra de recursos rolável, Objetivo/Contrato recolhidos (toca no título), botões redondos à direita sem minimapa, painéis viram folha de baixo, câmera recua em retrato. **Mão de cartas vira um monte**; tocar abre todas em grade sobre a tela escurecida e escolher uma fecha de novo.

## Atlas 6–8 (2026-10-16)
- `atlas6.png`: Contemporânea (solar, eólica, nuclear, baterias, data center, fábrica automatizada, centro logístico, parque urbano, torre residencial, fazenda vertical, **Cidade Inteligente**) + recursos 🔌 🚗 🔋 💾 (🛢 usa o ícone do poço).
- `atlas7.png`: Fazenda senhorial, Fazenda mecanizada, Poço de petróleo, Termelétrica, Hidrelétrica, Fábrica de eletrônicos, Montadora, Prédio residencial, Hospital, Estádio, Torreta, Estufa, Rodovia.
- `atlas8.png`: ilustrações de evento (seca, festa, invasão/incêndio, tempestade, poluição/protesto, comércio) e ícones das 7 ameaças (aparecem no aviso de ataque e sobre o invasor).
Com isso **nenhuma carta ou recurso usa emoji**. Emoji ainda aparece só em textos corridos (descrições, registro, rótulos do tabuleiro).
