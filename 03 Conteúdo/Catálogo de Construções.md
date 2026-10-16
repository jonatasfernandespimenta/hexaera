---
tags: [conteudo, construcoes]
---
# Catálogo de Construções

> Valores 🧪. Formato do custo: ✋ / recursos / 💰 · ⏱ turnos · 👤 trabalhadores.

## Era Primitiva (vertical slice)
| Construção | Terreno | Custo | ⏱ | 👤 | Efeito |
|---|---|---|---|---|---|
| 🔥 Fogueira (Centro) | — | — | — | — | +3 ✋, estoque global, ponto de conexão |
| 🛖 Cabana | Planície/Floresta (derruba) | 2 ✋, 3 🪵 | 1 | — | +2 👤 (moradores chegam ao concluir) |
| 🫐 Coletor | Planície/Floresta (derruba) | 1 ✋ | 1 | 1 | +2 🍖 |
| 🦌 Cabana de caça | Floresta | 2 ✋, 2 🪵 | 2 | 1 | +3 🍖 (esgota caça em 20 turnos) |
| 🪓 Lenhador | Floresta | 2 ✋ | 1 | 1 | +2 🪵 |
| 🪨 Coletor de pedras | Colina/Montanha | 2 ✋, 2 🪵 | 2 | 1 | +1 🪨 |
| 🎣 Pescador | Rio/Costa | 2 ✋, 2 🪵 | 2 | 1 | +2 🍖 |
| 👴 Ancião | Planície | 3 ✋, 4 🪵 | 3 | 1 | +1 📚 |
| 🪵 Paliçada | borda | 1 ✋, 2 🪵 | 1 | — | bloqueia borda |
| 🗿 Totem | qualquer | 2 ✋, 2 🪨 | 2 | — | +3 😊 |
| 〰 Trilha | borda | 1 ✋ | 0 | — | conexão básica |

> **Implementado no vertical slice** (valores atuais em `game/src/core/data.ts`): Cabana, Fazenda, Lenhador, Pedreira (Montanha, +2 🪨), Pescador (Rio), **Barreiro** (Rio, +2 🧱), **Olaria** (2 🧱 → 1 🏺 — antecipada da Era do Bronze, é o marco para avançar), Ancião, Totem (+5 😊), Torre de vigia (sem 🗡 por enquanto).

## Era do Bronze

> **Implementado:** Casa (⬆ Cabana, +4 👤), Campo arado (⬆ Fazenda, +5 🍖), Escriba (⬆ Ancião, +2 📚), Torre de bronze (⬆ Torre, 2 dano, alcance 2), Fundição (Montanha, +1 🔶, sem cobre/estanho por enquanto), Estábulo (+2 ✋).

| Construção | Terreno | Efeito |
|---|---|---|
| 🌾 Fazenda | Planície/Floresta (derruba) | +4 🍖 |
| 🏺 Olaria | Rio/Argila | 2 🧱 → 1 🏺 |
| 🍇 Vinícola | Planície | 2 🍖 → 1 🍷 |
| 🔶 Fundição | Montanha/Caverna | cobre + estanho → 🔶 |
| 🛠 Ferreiro | qualquer | 1 🔶 (ou ⛏) + 1 🪵 → 1 🗡 |
| 🐂 Estábulo | Planície | +2 ✋ |
| 🏪 Mercado | Planície | libera [[Comércio e Mercado]] e [[Contratos]] |
| 🗼 Torre de vigia | Colina/Planície | defesa alcance 1 |
| 🏠 Casa | Planície | +4 moradia (upgrade de Cabana) |

## Era do Ferro
Mina de ferro · Estrada · Ferreiro II · Celeiro (armazém) · Templo (+😊, +📚) · Quartel.

## Era Medieval
Moinho d'água/vento (+✋) · Tecelagem (🧵) · Oficina (🔧) · Muralha · Castelo · Biblioteca · Catedral (monumento) · Porto.

## Era Industrial
Mina de carvão · Usina a carvão (⚡) · Siderúrgica (🔩) · Fábrica · Ferrovia · Estação · Cortiço (moradia densa, −😊) · Parque público.

## Era Moderna
Poço de petróleo · Refinaria · Termelétrica · Hidrelétrica · Montadora (🚗) · Rodovia · Prédio residencial · Hospital · Estádio (monumento).

## Era Contemporânea
Solar · Eólica · Nuclear · Data center (💾) · Fábrica automatizada (sem 👤) · Centro logístico · Parque urbano · **Marco Final**.

Ver regras em [[Construções]].
