---
tags: [negocio]
---
# Lançamento Web e Métricas

> [!info] Decisão
> O jogo fica **só no navegador** e é **gratuito**. A receita vem de anúncios (de preferência via portais) e de doações opcionais. Não vamos vender o jogo.

## 1 · Métricas com PostHog
Até 1M de eventos por mês é grátis. Bastam uns 8 eventos:

| Evento | Propriedades | Pra quê |
|---|---|---|
| `game_started` | `mode: solo \| online` | qual modo jogam mais |
| `tutorial_step` | `step` | onde o tutorial perde gente |
| `turn_reached` | `n` (a cada X turnos) | até onde jogam / onde desistem |
| `game_ended` | `mode, result, duration, turns` | duração e resultado das partidas |
| `match_found` | — | funil do online |
| `match_abandoned` | — | quem sai no meio da partida online |
| `language_changed` | `from, to` | quais idiomas importam |

- **DAU, WAU e retenção D1/D7** o PostHog calcula sozinho a partir dos pageviews mais um id persistente. Não precisa de evento para isso.
- **LGPD:** configurar sem cookie (`persistence: 'memory'` ou `'localStorage'`) ou mostrar aviso de consentimento.

## 2 · Primeiros jogadores (de graça)
- Meta: **100–300 jogadores** antes de gastar qualquer dinheiro.
- Canais: clipes de gameplay no TikTok e no Shorts, r/WebGames, itch.io.
- Depois olhar a retenção. Para jogo web, **D1 > 30%** e **D7 > 10%** é bom sinal.

## 3 · Monetização via portais
- Publicar no **CrazyGames** (aceita envio aberto) e no **Poki** (mais seletivo, mas com mais alcance).
- Eles trazem o tráfego, os anúncios vêm pelo SDK deles e a receita é dividida. Isso resolve o problema de conseguir jogadores, que é o que pesa de verdade.
- Ads por conta própria rendem pouco (US$ 0,5–3 a cada mil impressões, menos no tráfego BR). Se for fazer mesmo assim:
  - ✅ intersticial **entre** partidas
  - ✅ vídeo **opcional** com recompensa (sem vantagem que quebre a escassez, ver [[Plataformas e Monetização]])
  - ❌ nunca no meio da partida

## 4 · Anúncio pago (só depois)
- Teste pequeno: **R$ 200–500**.
- Objetivo: medir **quanto custa cada jogador** e **quanto tempo ele fica**. A ideia é aprender, não lucrar.
- Anúncio pago pagando por si só com ads dentro do jogo quase nunca fecha para jogo indie.

## 5 · Doações (Ko-fi)
Opção para quem quiser apoiar, sem vender nada.

- **Onde mostrar:** um botão discreto ("☕ Apoie o jogo") no menu principal e na tela de fim de partida. Nunca como popup ou no meio do jogo.
- **Taxas:** o Ko-fi não cobra comissão sobre doações no plano grátis, só a taxa do PayPal ou do Stripe.
- **Só Ko-fi, sem Apoia.se:** o jogo tem vários idiomas e o tráfego dos portais é majoritariamente de fora. O Ko-fi funciona no mundo todo e é feito para doação avulsa; o Apoia.se é focado no Brasil e em apoio mensal recorrente.
- **Pix:** o Ko-fi não aceita, mas o brasileiro consegue doar com cartão. Reavaliar se o PostHog mostrar que a maioria dos jogadores é do Brasil.
- **Recompensas:** só agradecimento, como o nome nos créditos ou um badge "apoiador". Nada que dê vantagem no jogo.
- ⚠️ **Portais:** CrazyGames e Poki costumam proibir links externos dentro do jogo. Mostrar o botão de doação **só na versão do seu domínio**, atrás de uma flag de build. Confirmar nas regras de cada portal antes de enviar.
- Expectativa: doação costuma vir de uma fração bem pequena dos jogadores. É um complemento, não a fonte principal.

## Ordem
1. PostHog no ar
2. 100–300 jogadores orgânicos e leitura da retenção
3. Ajustar o jogo onde as pessoas desistem
4. Enviar para os portais, com Ko-fi só no site próprio
5. Teste pequeno de anúncio pago
