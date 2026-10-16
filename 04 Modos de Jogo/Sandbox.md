---
tags: [modos]
---
# Sandbox / Skirmish

Sem objetivo obrigatório. Configurações:
- Tamanho do mapa
- Abundância de recursos
- Frequência de invasões
- Velocidade tecnológica
- Mercado (volátil / estável / desligado)
- Dificuldade
- Era inicial

Atende quem quer **construir uma cidade durante meses**.

## Implementado ✅ (2026-10-16)
Menu inicial → **Sandbox** abre as opções:
| Opção | Valores | Efeito |
|---|---|---|
| Invasões | Nenhuma · Raras · Normais · Frequentes | × 0 / 0,5 / 1 / 2 na chance de ataque |
| Abundância | Escassa · Normal · Farta | × 0,75 / 1 / 1,5 na produção |
| Ritmo das eras | Rápido · Normal · Lento | × 0,5 / 1 / 1,5 nas metas de 📚 e 👤 |
| Mercado | Volátil · Estável · Desligado | estável = preços não oscilam; desligado = sem compra/venda |
| Era inicial | Primitiva … Contemporânea | começa na era com 30 de cada recurso já disponível, +20 🍖 e +300 💰 por era |

Sem fim: na última era não há "Concluir civilização". Avançar de era continua possível.
Fora por enquanto: tamanho do mapa (o mapa já é infinito), dificuldade (coberta por invasões + abundância).

## Ideias futuras (não decididas)
- Modo online / mundo persistente — ver [[Questões em Aberto]].
- Desafios semanais com seed fixa e ranking.
