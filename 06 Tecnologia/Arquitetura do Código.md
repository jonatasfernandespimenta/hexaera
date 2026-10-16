---
tags: [tecnologia]
---
# Arquitetura do Código

## Princípio
**Regras separadas da visualização.** O `GameState` é um objeto puro e serializável; as regras são funções `(estado, ação) → novo estado`. A cena 3D e a UI só **leem** o estado e **despacham ações**. Isso permite testes headless e espelha o [[Adaptação para Tabuleiro|board game]].

```
src/
├── core/                  # TypeScript puro, sem React/Three
│   ├── state.ts           # GameState serializável
│   ├── turn.ts            # fases do turno
│   ├── actions.ts         # explorar, construir, coletar… (validação + efeito)
│   ├── hex.ts             # coordenadas axiais (q, r), vizinhos, distância
│   ├── exploration.ts     # custo e revelação
│   ├── mapgen.ts          # procedural com seed + arquétipos
│   ├── production.ts      # trilhas agregadas, consumo
│   ├── logistics.ts       # conectividade ao Centro (BFS nas bordas)
│   └── events.ts          # baralhos, flags, pools
├── data/                  # conteúdo como JSON/TS
│   ├── terrains.ts
│   ├── buildings.ts
│   └── events/
├── scene/                 # React Three Fiber
│   ├── Table.tsx
│   ├── HexTile.tsx
│   └── voxel/             # miniaturas geradas por código
└── ui/                    # HTML/CSS pixel art
    ├── ResourceBar.tsx
    ├── CardHand.tsx
    └── EventCard.tsx
```

## Decisões
- **Cada construção é definida uma única vez** (custo, requisitos, produção, tempo). A mesma definição gera: miniatura voxel + carta de UI no digital, e miniatura + carta impressa no físico. Idealmente as cartas físicas são **exportadas** dos mesmos dados.
- O modo (Civilização / Tabuleiro) é só **configuração de regras**: limite de estoque e tamanho do mapa.
- Estado serializável (save/load em `localStorage`/arquivo, replays).
- Seed determinística no gerador de mapa (desafios com seed).
- Testes Vitest: custo de exploração, produção, consumo, contratos, movimento de invasores.

Ver [[Stack - Web]].
