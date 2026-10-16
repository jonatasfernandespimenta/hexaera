---
tags: [regras, exploracao]
---
# Exploração

> Inspirado em **Townsfolk**: crescer territorialmente tem custo crescente.

## Como explorar
1. Escolha um hex **oculto** adjacente ao seu território.
2. Pague o custo em ✋ [[Capacidade de Trabalho]].
3. Revele o tile: terreno, riqueza e (se a tecnologia permitir) recurso oculto.
4. Alguns tiles disparam efeito imediato (ruínas, tribo, animais selvagens).

## Custo
```
Custo = Base do anel + Terreno − Infraestrutura − Tecnologia   (mínimo 1)
```

### Base por anel 🧪
| Anel | 1 | 2 | 3 | 4 | 5 | 6 | 7+ |
|---|---|---|---|---|---|---|---|
| ✋ | 1 | 2 | 3 | 5 | 8 | 13 | +5 por anel |

### Modificador de terreno (conhecido pela pista)
Planície +0 · Floresta/Rio +1 · Colina/Pântano +2 · Montanha +3

### Infraestrutura
Hex adjacente a Trilha −1 · Estrada −2 · Ferrovia −3 · Rodovia −3

### Tecnologia
Batedores −1 · Cavalaria −1 · Cartografia −1 · Balões −2 · Satélite: exploração custa sempre 1

> [!example] Corredores de expansão
> Um hex no anel 6 custa 13 ✋. Com estrada até ele: 11. Com ferrovia: 10, e o Satélite zera. A cidade cresce **ao longo das estradas**, ganhando formas orgânicas, não um círculo.

## Pistas
Hexes ocultos podem mostrar uma **pista** do bioma (você vê árvores ao longe):
```
? FLORESTA ?
```
A tecnologia melhora as pistas:
| Tecnologia | Revela antes de explorar |
|---|---|
| (nenhuma) | bioma dos hexes do anel 1 apenas |
| Batedor | bioma de todos os ocultos |
| Cartografia | elevação e riqueza |
| Geologia | possíveis minérios |
| Satélite | tudo (fim do fog of war) |

## Tiles especiais 🧪
- **Ruínas** — compre carta de evento "Descoberta" (conhecimento, tesouro ou maldição).
- **Tribo** — negociar (comércio) ou conflito.
- **Covil** — gera invasores periodicamente até ser limpo ([[Defesa e Invasões]]).
- **Maravilha natural** — +felicidade permanente se não for construída por cima.

## Na versão de tabuleiro
Cada tile físico tem o **modificador impresso** no verso (lado oculto mostra o bioma como pista). Ver [[Adaptação para Tabuleiro]].
