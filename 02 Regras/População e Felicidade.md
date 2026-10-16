---
tags: [regras, sociedade]
---
# População e Felicidade

## População (👤)
- **A população vem das casas** (decidido). Quando uma casa fica pronta, seus moradores chegam.
- **Upgrade** da casa aumenta os moradores no mesmo hex 🧪: Cabana 2 → Casa 4 → Sobrado 6 → Prédio 12.
- Cada 👤 come 1 🍖 por turno.
- 👤 é alocado em construções ou fica **ocioso** (gera ✋ — ver [[Capacidade de Trabalho]]).

### Fome
Se faltar comida, **metade de quem ficou sem comer vai embora** (arredonda para cima), o estoque de 🍖 volta a 0 e a cidade fica **−10 😊 por 3 turnos** ✅. Comida **não vira dívida** (os outros recursos podem — ver [[Recursos#Dívida 🧪]]); antes virava, e o playtest mostrou uma espiral sem volta ([[Playtest]]). Quem produz comida recebe 👤 primeiro ✅. **Moradores chegam aos poucos** ✅: casa nova não enche de uma vez; por turno chega 1 👤 a cada 2 🍖 de sobra (mínimo 1 enquanto houver estoque), até lotar as vagas. Assim a população não passa da comida.

## Felicidade (😊) 0–100
Começa em 50. Recalculada todo turno:
```
😊 = 50 + bem-estar + luxo consumido − poluição/2 − superlotação − eventos
```
| Fonte | Efeito 🧪 |
|---|---|
| Decoração (por hex) | +2 |
| Praça / Parque | +5 / +8 |
| Monumento | +10 a +20 |
| Consumir 🍷 ou outro luxo (1/5 👤) | +5 |
| Maravilha natural preservada | +5 |
| Moradia lotada | −5 |
| Desmatar última floresta próxima | −5 |
| Dívida (qualquer recurso) | −2 por unidade |

### Faixas
| 😊 | Efeito |
|---|---|
| 0–14 | **Revolta**: compre evento de crise; produção −50% |
| 15–29 | Produção −25%, vagas vazias não são reocupadas |
| 30–74 | Normal |
| 75–100 | Produção +10%, +1 📚/turno |

## Poluição (☁️) 0–100
- Fábricas, usinas a carvão, minas e ferrovias geram ☁️.
- **Cada floresta e cada parque reduz 1 ☁️ por turno** (decidido). A poluição **não cai sozinha**.
- ☁️ alta desbloqueia eventos de "Industrialização" ([[Eventos#Pools por tag]]): rio contaminado, protestos, doenças.

> **Tensão central**: indústria dá dinheiro, mas gera população triste. Você precisa reinvestir em monumentos, parques e decoração.
