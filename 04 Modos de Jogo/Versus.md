---
tags: [modos]
status: decidido
---
# Versus

> **Cada jogador ergue sua cidade e treina um exército para derrubar o Centro do outro.** Estilo *Age of Empires*, mas por turnos, online, para 2 jogadores. Cabe **numa noite** (1–2 h no ritmo rápido).

Usa a mesma infraestrutura do [[Cooperativo]]: partida por link, turno simultâneo, cada cliente roda a própria cidade, mesmo `core/` do solo. Cada jogador tem seu mapa com seed própria; os Centros ficam a **10 hex** um do outro, separados por uma faixa neutra onde ninguém explora.

## Campo de guerra e tropas
- **Campo de guerra** 🏕: construção de defesa, **liberada no Bronze**, que recruta tropas. Custo 5 🪵 + 3 🪨, 2 turnos de obra, 1 trabalhador. Só funciona pronto e com trabalhador. O Quartel segue como defesa de cidade.
- **Recrutar** uma tropa: custa **4 🍖 + 6 💰**, **1 ✋** e **1 👤** (a população cai de vez; sempre sobra pelo menos 1 👤).
- A tropa **não ocupa moradia**, mas **consome 1 🍖 por turno** enquanto viver.
- Só existe em partida online (no solo não há tropas).

## Ataque
- O jogador escolhe quantas tropas enviar e clica **Atacar**: a marcha é automática (comitiva `exército`). Sem mover hex a hex.
- A viagem leva ⌈10 ÷ velocidade⌉ turnos. No ritmo rápido o exército anda **2 hex/turno** em qualquer era: **5 turnos** de marcha, mais 1 de aviso.
- O exército de N tropas chega como **N invasores**, com a **força da era do atacante** (quem investiu em era mais alta bate mais forte). Escala dos invasores de [[Ameaças por Era]].
- Os atacantes **não voltam** para casa.

## Defesa
- A chegada vira **aviso ⚠️** num hex de borda (o revelado mais perto do rival) e, no turno seguinte, vira **invasores** normais: o mesmo fluxo de [[Defesa e Invasões]]. Torres atiram, invasores atacam construções e o Centro, o defensor pode caçar com ✋.
- **Tropas em casa** defendem o Centro: cada invasor que chega ao lado do Centro mata **1 tropa** antes de ferir o Centro.
- Invasor morto dá o saque normal ao defensor.

## Vitória e derrota
- Quem tiver o **Centro com ❤️ 0** (ou população 0) **perde**; o outro vence.
- O Marco Final da última era **não encerra** o versus: "vence quem derrubar o outro Centro". Ver [[Vitória e Derrota]].
- O resultado do rival é conferido ao fechar cada turno.

## Sem ameaças do solo
- No versus, os **invasores aleatórios ficam desligados** (frequência de ameaças = 0) e as cartas de evento com aviso de invasão ou destruição **saem do baralho**. Os demais eventos continuam.
- O único perigo é o outro jogador.

## Ritmo rápido
- Só **números**, sem regras novas: produção ×5 (`abundance`), metas de era ×0,4 (`pace`), **obras com metade dos turnos**, e exércitos a 2 hex/turno.
- Calibrado com o bot de playtest (60 partidas, mediana). Mira: 7 eras em ~60–80 turnos 🧪.

| Era | Chegaram | Turno de entrada |
|---|---|---|
| Primitiva | 100% | 1 |
| Bronze | 100% | 18 |
| Ferro | 100% | 22 |
| Medieval | 100% | 24 |
| Industrial | 67% | 57 |
| Moderna | 65% | 61 |
| Contemporânea | 65% | 71 |

- 🧪 **Provisório**: calibrado só com o bot; falta **playtest com humanos**. Ver [[Playtest]] e [[Questões em Aberto]].

## Ainda não implementado
- Interceptação de tropas em marcha, combate tático e mover tropas hex a hex.
- Mais de 2 jogadores, matchmaking, ranking e anti-trapaça (o servidor confia no navegador de cada um).

Ver também [[Cooperativo]] · [[Eras e Progressão]].
