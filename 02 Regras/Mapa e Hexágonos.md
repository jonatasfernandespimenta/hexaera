---
tags: [regras, mapa]
---
# Mapa e Hexágonos

## Layout inicial
```
          [?] [?]
       [?]  🔥  [?]
          [?] [?]
```
Centro + anel 1 (6 hexágonos ocultos). Só hexágonos **adjacentes a um hex revelado** podem ser explorados.

## Tamanho do mapa (decidido)
- **Digital**: mapa **infinito**. O custo crescente de [[Exploração]] é o que segura a expansão.
- **Tabuleiro** ([[Modo Tabuleiro]]): mapa **limitado** à quantidade de tiles da caixa. 61 hexes 🧪 = Centro + anéis 1 a 4. Acabou a pilha, acabou a exploração.
- Tecnicamente o digital pode gerar sem limite e carregar só a parte próxima do mapa.

## Coop: território e fronteira
No [[Cooperativo]], as cidades dividem o mapa. Uma **fronteira** (rio largo, cordilheira ou faixa de tiles cinza neutros) separa os territórios: ninguém explora nem constrói nela, exceto infraestrutura de passagem e defesas.

## Anéis
A distância de um hex ao Centro é seu **anel** (anel 1 = 6 hex, anel 2 = 12, anel 3 = 18, anel *n* = 6n). O anel define o custo base de [[Exploração]].

## Estados de um hexágono
1. **Desconhecido** — não aparece.
2. **Oculto** — visível como `?`, adjacente ao território. Pode ter **pista** (ver [[Exploração#Pistas]]).
3. **Revelado** — terreno conhecido, pode construir.
4. **Ocupado** — tem construção.
5. **Esgotado** — recurso finito acabou (minas). Vira terreno vazio do tipo base.

## Atributos de um hexágono
| Atributo | Exemplo |
|---|---|
| Terreno | Floresta, Planície, Montanha… ([[Catálogo de Terrenos]]) |
| Riqueza | ★ a ★★★★ (multiplica produção) |
| Recurso oculto | carvão sob a floresta, ouro no rio |
| Modificador de exploração | +0 a +3 |
| Elevação | plano / colina / montanha (afeta ferrovia) |
| Conexão | trilha/estrada/ferrovia nas bordas |

## Regras de construção no mapa
- **1 construção principal por hexágono** (decidido). O diorama mostra **detalhes decorativos** (cercas, casinhas, animais) conforme o **nível** dela — sem efeito nas regras. Infraestrutura fica nas bordas.
- Infraestrutura de transporte ocupa **bordas** entre hexágonos, não o hex inteiro.
- Algumas construções exigem terreno específico ([[Catálogo de Construções]]).
- Construções podem dar bônus de **adjacência** (ex.: Moinho ao lado de Fazenda +1 🍖).

## Coordenadas (digital)
Coordenadas axiais `(q, r)`. Centro = `(0,0)`. Distância = `(|dq| + |dr| + |dq+dr|) / 2`. Ver [[Arquitetura do Código]].
