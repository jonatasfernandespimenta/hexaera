---
tags: [regras, logistica]
---
# Produção e Logística

> Uma camada de **Transport Tycoon** dentro do city builder.

## Estoque global (decidido)
- Todos os recursos ficam num **estoque único** (no Centro). **Sem limite de armazenamento.**
- Só quem **move mercadoria** precisa de conexão com o Centro (adjacente a ele ou ligada por uma cadeia de infraestrutura nas bordas): **produção, indústria e comércio** ✅.
- **Moradia, cultura e defesa** funcionam isoladas — moradores andam até a cidade a pé ✅.
- Produção/indústria/comércio **desconectada rende metade** (arredonda para baixo; usina gera metade da ⚡) — marcador "½" ✅. Conectar é otimização, não pedágio em toda jogada.

## Conexão como requisito, não como fluxo
Não existe cálculo de quantidade por borda. O **tipo** da conexão é que libera a construção 🧪:
| Construção | Conexão mínima até o Centro |
|---|---|
| Produção básica (fazenda, lenhador, pedreira, barreiro…) | Trilha |
| Extração a mais de 3 hex do Centro (mina, pedreira) | Estrada |
| Indústria (siderúrgica, fábrica, refinaria) | Ferrovia |
| Indústria moderna/contemporânea | Ferrovia ou Rodovia |

## A distância é custo de obra
Quanto mais longe, mais bordas de infraestrutura você precisa construir — e paga uma vez só.
| Infra | Era | Custo por borda 🧪 |
|---|---|---|
| Trilha | Primitiva | 1 ✋ |
| Estrada | Ferro | 2 ✋ + 1 🪨 |
| Ferrovia | Industrial | 3 ✋ + 2 🔩 + 20 💰 |
| Rodovia | Moderna | 2 ✋ + 50 💰 |

Atravessar **montanha** dobra o custo da borda. Rio exige **ponte** (+custo). Upgrade (trilha → estrada) paga a diferença.

## Cadeias produtivas (exemplos)
```
Primitiva:  Floresta → Coletor de lenha → 🪵
Bronze:     Argila → Olaria → 🏺 cerâmica
            Planície → Vinícola → 🍷
            Cobre + Estanho → Fundição → 🔶 bronze → Ferreiro → 🗡
Industrial: Mina de ferro ⛏ ─ferrovia─▶ Siderúrgica ◀─ferrovia─ Mina de carvão ⚫
                                  │ 🔩 aço
                                  ▼
                               Fábrica → Mercado/Contratos
```

## Decisão central
> A mina de ferro está a 9 hex, atrás de uma montanha. Para a siderúrgica funcionar, os dois precisam de ferrovia até o Centro. **Construo a siderúrgica ao lado da mina e compartilho a mesma linha, ou perto da cidade e pago uma linha mais longa?** Onde você constrói define quanto trilho precisa.

## Produção agregada
Para não virar contabilidade no físico, a produção é mantida em **trilhas de produção por recurso** (ex.: 🍖 +12/turno), atualizadas só quando uma construção é **colocada, removida, melhorada ou para**. No Amanhecer, aplica-se o total da trilha de uma vez. O digital calcula o mesmo automaticamente e exibe igual (barra de recursos com "+N").

> Limite de design: manter poucos tipos de recurso **ativos por era** (~5–8). Com 15 ao mesmo tempo, o físico vira planilha.

## Ordem de resolução da produção
1. Extração (sem insumos) produz primeiro.
2. Processamento em ordem de tier (I → II → industrial…).
3. Se faltar insumo, a construção **para** neste turno (marcador "parada").

## Interrupções
Infra destruída por invasores ou eventos **desconecta** tudo que dependia dela — a produção cai pela metade até reparar. Isso conecta logística com [[Defesa e Invasões]].
