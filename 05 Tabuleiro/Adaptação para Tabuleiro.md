---
tags: [tabuleiro]
---
# Adaptação para Tabuleiro

> Regra de design: **tudo que acontece precisa ser representável por estado discreto.** Se der pra prototipar em papel, o core está claro para o digital.

## Setup físico
```
       🂠 🂠
    🂠  🔥  🂠
       🂠 🂠
```
Tiles hexagonais virados para baixo. Explorar = **comprar/revelar um tile** (o verso mostra a pista de bioma e o modificador de exploração).

## Tradução digital → físico
| Digital | Tabuleiro |
|---|---|
| Turno | Rodada |
| Recurso | Cubo / token |
| Construção | Tile pequeno / miniatura |
| Tecnologia | Carta |
| Exploração | Tile oculto |
| Invasor | Meeple |
| Mercado | Trilha de preço + cartas |
| Ferrovia/estrada | Peças de trilho nas bordas |
| Felicidade / Poluição | Marcador em trilha |
| ✋ Ações | Marcadores de ação (discos) |
| Obra em andamento | Dado/marcador de contagem |
| Eventos/Contratos | Baralhos por Era e categoria |
| Flags (Gloomhaven) | Adesivos/livro de campanha |

## Construções no tabuleiro (decidido)
- Cada jogador tem um **estoque limitado de miniaturas/peças** (fazenda, casa, mina, ferrovia…).
- As **cartas de construção são cartas de referência**: dizem o que a peça custa e produz. Ficam abertas na mesa; não são compradas nem descartadas.
- Construir = pagar o custo da carta + pegar uma miniatura do estoque e colocar no hex.
- Demolir/melhorar devolve a miniatura ao estoque.
- O **mapa é limitado** pelos tiles da caixa.
- Melhorias por **marcador de nível** encaixado na miniatura.
- **Ferrovias/estradas são segmentos de conexão** entre hexes (bordas), não construções que ocupam um hex.
- Produção em **trilhas agregadas**, não contada miniatura por miniatura. Ver [[Produção e Logística#Produção agregada]].
- Eventos e Contratos continuam sendo **baralhos de verdade** (compra, descarte, efeitos).
- No digital nada disso limita: mapa infinito e cartas só como interface. Ver [[Construções#Disponibilidade (decidido)]].

## Baralhos por era
Ao entrar na Industrial, abra o pacote da era e misture. Algumas escolhas **adicionam** ou **destroem** cartas — campanha legacy.

## Simplificações necessárias para o físico
- Contas com números pequenos (evitar 3.000 💰 → no físico usar escala /100).
- Logística: só verificar se a construção está **conectada ao Centro** pelo tipo certo de infra.
- Combate determinístico ou com 1d6.
- Mercado com poucas faixas de preço (5–7 posições).

## Modos no físico
- No coop, todos jogam **no mesmo tabuleiro**; cada jogador tem sua pilha de tiles, e uma faixa de **tiles de fronteira** (cinza ou rio) separa as cidades.
- **Solo** e **[[Cooperativo|cooperativo]]** (decidido — iguais aos do digital): cada jogador com seu mapa, trocas entre cidades.
- Competitivo: fora do escopo por enquanto.

Ver [[Componentes Físicos]].
