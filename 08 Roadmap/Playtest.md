---
tags: [roadmap, playtest]
---
# Playtest automático

Robô que joga sozinho usando só as regras do jogo (`game/src/core/bot.ts`). Rodar: `npm run playtest` (padrão 60 partidas; `N=200 npm run playtest` para mais). Fica fora do `npm test`.

O robô é um jogador **razoável, não ótimo**: prioriza comida → mercado → espaço → defesa → energia → meta da era (perseguindo a cadeia de insumos até 3 níveis) → moradia → conhecimento → conexões → felicidade → matéria-prima → explorar. Não entra em dívida de propósito; melhora moradia/defesa no lugar, mas põe produção em hex novo.

## Rodada 1 — 2026-10-16 (100 partidas)

| Era | Chegaram | Entrada (mediana) | Duração | Gargalo principal |
|---|---|---|---|---|
| Primitiva | 100% | 1 | 43 | Olaria / Conhecimento |
| Bronze | 93% | 44 | 11 | Fundição |
| Ferro | 91% | 58 | 8 | Ferreiro |
| Medieval | 65% | 72 | 80 | Catedral / População |
| Industrial | 17% | 190 | — | Fábrica / População |
| Moderna | 0% | — | — | — |

Derrotas: 92% (fome 54, Centro destruído 38), mediana no turno 137. Vitória: 0%.

## Achados
1. **Comida não escala** 🔴 — o melhor produtor é o Campo arado (+5 🍖/hex, Bronze). Cada 👤 come 1, mas as metas de 👤 sobem até 200. Do Medieval em diante a população bate no teto de hexes de comida e morre de fome. Falta comida por era (ex.: Celeiro/Moinho no Medieval, Fazenda mecanizada ⚡ na Industrial, Estufa/Supermercado na Moderna).
2. **Bronze e Ferro duram ~10 turnos** 🟡 — o vault quer 30–50 por era. Metas de 📚 e 👤 dessas eras são baixas para o que o jogador já produz.
3. **Primitiva dura ~43** 🟢 — dentro do alvo.
4. **Medieval → Industrial é um muro** 🔴 — Catedral (20 🪨 + 6 🔧 + 4 🏺) e depois a Fábrica (cadeia carvão + ferro + ⚡ + ferrovia) param a maioria.
5. **Ameaças acumulam** 🟡 — no Ferro chegam 3–4 bandos ao mesmo tempo; torres de 1–2 de dano não dão conta e eles derrubam a produção (o que alimenta a fome).
6. **Melhoria para a produção** 🟡 — melhorar todas as Fazendas de uma vez para Campo arado zera a comida durante a obra. Jogador humano também cai nessa; vale um aviso na interface.
7. Estoque acumula sem uso (centenas de 🪨 e 💰) — o mercado ajuda, mas os preços/limites deixam muito parado.

## Rodada 2 — comida (2026-10-16, 100 partidas)
Mudanças:
- **Comida por era** (melhoria em linha, ou do zero): Fazenda senhorial (Medieval, +8 🍖), Fazenda mecanizada (Industrial, +14, 2 ⚡), Estufa (Moderna, +20, 3 ⚡), Fazenda vertical (Contemporânea, +30, 5 ⚡, sem 👤).
- **Quem faz comida recebe 👤 primeiro** — antes a alocação seguia a ordem do tabuleiro e as fazendas ficavam vazias com a forja cheia.
- **Fome não vira dívida**: metade de quem ficou sem comer parte, 🍖 volta a 0 e a cidade fica −10 😊 por 3 turnos. Antes a dívida de 🍖 crescia até centenas, zerava a 😊 (−2 por unidade) e a produção nunca voltava.
- **Centro recupera 1 ❤️/turno** sem invasor encostado (antes só curava ao trocar de era).

| | Rodada 1 | Rodada 2 |
|---|---|---|
| Derrotas | 92% | **32%** |
| Por fome | 54 | **0** |
| Centro destruído | 38 | 32 |
| Chegam ao Medieval | 65% | **93%** |
| Chegam à Industrial | 17% | **63%** |
| Turnos em dívida | 50 | **1** |

Próximos gargalos: **Fábrica** (Industrial trava — 355 turnos esperando na mediana), **Exército** no Medieval (10 ❤️ / 4 ⚔ contra torres de 1–2 de dano), e Bronze/Ferro ainda curtos (~10 turnos).

## Rodada 3 — Fábrica (2026-10-16, 100 partidas)
**Causa:** ciclo sem saída. A Usina a carvão custava 🔩, mas o 🔩 só sai da Siderúrgica, que precisa da ⚡ da usina. A única saída era comprar aço no Mercado, sem nada no jogo indicando isso.
**Mudança:** Usina a carvão passa a custar 8 🪨 + 2 🔧 + 60 💰 (sem aço). O robô também passou a comprar no Mercado o que falta para a construção-meta quando sobra 💰.

| | Rodada 2 | Rodada 3 |
|---|---|---|
| Vitórias | 0% | **30%** (mediana 363 turnos — alvo do vault: 250–350) |
| Derrotas | 32% | 32% (Centro 25, fome 7) |
| Chegam à Moderna | 0% | **63%** |
| Chegam à Contemporânea | 0% | **49%** |

Gargalos agora: **População** na Moderna (120) e Contemporânea (200) e a Cidade Inteligente; **Exército** no Medieval segue derrubando Centros; Bronze/Ferro ainda ~10 turnos; Medieval ~62.

## Rodada 4 — Exército (2026-10-16, 100 partidas)
Derrotas por Centro destruído: 17 de 25 no Medieval, sempre com 1–3 Exércitos (10 ❤️ / 4 ⚔) contra torres de 2–3 de dano.
- Teste A — robô melhora torres até a melhor da era, perseguindo 🗡/🔧: **piorou** (vitórias 30% → 0%). Os insumos de defesa competem com os da Catedral; Centros caíram igual. Ou seja, não era o robô defendendo mal. Revertido.
- Teste B — **Exército 10 ❤️ / 4 ⚔ → 7 ❤️ / 3 ⚔** ✅ (mantido).

| | Rodada 3 | Rodada 4 |
|---|---|---|
| Vitórias | 30% (363 turnos) | 30% (389 turnos) |
| Centro destruído | 25 | **17** |
| Fome | 7 | 13 |
| Chegam à Industrial | 73% | **83%** |

Achado de design: **defesa e progresso disputam os mesmos recursos** (🪨, 🔧, 🗡). Vale considerar defesa com custo próprio (ex.: 💰) para não travar a meta da era.

## Rodada 5 — ritmo e defesa (2026-10-16, 100 partidas)
Mudanças:
- **Melhorias de torre custam 💰** em vez de 🗡/🔶/🔧: Torre de bronze 2 🪨 + 30 💰, Torre de pedra 3 🪨 + 60 💰, Castelo 4 🪨 + 150 💰, Torreta 2 🔩 + 300 💰. Defesa deixa de disputar insumo com a meta da era.
- **Metas:** Bronze 90 📚 / 24 👤 · Ferro 180 / 34 · Medieval 280 / 45 · Industrial 500 / 70 · Moderna 800 / 110 · Contemporânea 1300 / 160.
- **Catedral** mais barata: 14 🪨 + 4 🔧 + 3 🏺.
- Robô: quando a meta pede mais ✋ do que o turno dá, constrói Estábulo/Moinho.

| | Rodada 4 | Rodada 5 |
|---|---|---|
| Vitórias | 30% (389 t) | **33% (363 t)** |
| Derrotas | 30% | **14%** (Centro 6, fome 8) |
| Bronze / Ferro | 11 / 10 turnos | **19 / 17** |
| Medieval | 71 | 64 |
| Chegam à Industrial | 83% | **90%** |
| Chegam à Contemporânea | 47% | **56%** |

Achado de design 🔴: **construções grandes pedem mais ✋ do que o turno dá.** Com todo 👤 empregado o turno tem 3 ✋; Catedral pede 4, indústria 4–5, Cidade Inteligente 6. Só dá para construir deixando gente ociosa ou com Estábulo/Moinho — e nada na tela explica. O robô tinha todos os recursos da Catedral por 100+ turnos e não conseguia construir.

Tempo esgotado (53%) agora é quase todo na Contemporânea: População (160) e Cidade Inteligente.

## Rodada 6 — ✋ acumulam (2026-10-16, 100 partidas)
Mudanças:
- **✋ que sobram passam para o próximo turno, até o dobro do máximo** ✅ — resolve as obras grandes (Catedral 4 ✋, indústria 4–5, Cidade Inteligente 6) que não cabiam num turno com todo 👤 empregado. No tabuleiro: guardar as fichas de ação.
- **Torre residencial** (Contemporânea, ⬆ Prédio, +30 👤).
- Robô: guarda ✋ quando a meta cabe no bolso mas não no turno; compra no Mercado o que falta para qualquer construção quando sobra 💰.

| | Rodada 5 | Rodada 6 |
|---|---|---|
| Vitórias | 33% (363 t) | **50% (387 t)** |
| Derrotas | 14% | 12% (Centro 5, fome 7) |
| Primitiva | 44 turnos | 37 |
| Chegam à Contemporânea | 56% | **63%** |

Ritmo por era (mediana): Primitiva 37 · Bronze 19 · Ferro 16 · Medieval 52 · Industrial 17 · Moderna 76 · Contemporânea ~150.

O que sobra (38% tempo esgotado, quase tudo na Contemporânea): **mapa cheio** (sem hex plano livre com ~140 hexes revelados) e **ondas de fome** — a população sobe até o teto, a comida não acompanha, metade parte, repete. Industrial ainda curta (17).

## Rodada 7 — crescimento pela comida (2026-10-16, 100 partidas)
Mudança: **moradores chegam aos poucos**, conforme a sobra de comida (1 👤 a cada 2 🍖 de sobra por turno; mínimo 1 enquanto houver estoque), em vez de a casa pronta encher de uma vez.

| | Rodada 6 | Rodada 7 |
|---|---|---|
| Vitórias | 50% (387 t) | **54% (306 t)** — dentro do alvo 250–350 |
| Derrotas | 12% | 16% (Centro 3, fome 13 — tardias, mediana turno 358) |
| Tempo esgotado | 38% | **30%** |

Ritmo por era (mediana): Primitiva 39 · Bronze 21 · Ferro 18 · Medieval 44 · Industrial 23 · Moderna 55 · Contemporânea ~80.

Ainda aberto: fome tardia em partidas longas; Contemporânea presa em 👤 (160) e na Cidade Inteligente; mapa cheio no fim.

Ver [[Vertical Slice]] · [[Roadmap]].
