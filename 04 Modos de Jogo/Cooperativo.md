---
tags: [modos]
status: decidido
---
# Cooperativo

> **Cada jogador tem sua própria cidade**, e as cidades trocam entre si. Vale para o digital e o físico. No digital, o coop é **online**, para 2 jogadores.

## Decidido
- Cada jogador tem **seu Centro, seu mapa e seu estoque**.
- Os jogadores **trocam recursos** entre as cidades.
- No digital, o coop é **online** (até 2 jogadores, criado por link/código, sem cadastro), em **turno simultâneo**. Substitui a decisão antiga de "só local / hot-seat". Ver [[Versus]] para o modo competitivo, que usa a mesma infraestrutura.
- **Vitória**: concluir o **Marco Final** com as metas **escaladas ×2** para a dupla.
- **Derrota**: se **qualquer** Centro cair (ou a população de uma cidade chegar a 0), os dois perdem.

## Online e turno simultâneo (construído)
- Menu "Jogar online" → *Criar partida* (Coop ou Versus, ritmo, relógio) ou *Entrar* (link `?match=<id>`). Cada jogador recebe um token secreto guardado no navegador, que permite reconectar.
- **Os dois jogam o mesmo turno ao mesmo tempo.** O turno vira quando ambos apertam "Fim do turno" (relógio opcional de 60 ou 90 s: ao zerar, o cliente encerra sozinho).
- Ordem ao fechar o turno: **voto de era** (só no coop) → `endTurn` da própria cidade → **recebe as chegadas** das comitivas do rival → confere o resultado do rival (`settle`).
- Cada cliente roda a **própria cidade**, com o mesmo `core/` do solo; o servidor guarda por assento o estado, as comitivas enviadas e os votos. Atualização por *polling*; se um jogador cai, a partida **pausa** e dá para retomar em outra noite.
- Sem anti-trapaça: o servidor confia no navegador de cada um (serve entre amigos, não para ranking).

## Metas de era somadas (construído)
- No coop as metas de era são **da dupla**: conhecimento e população das **duas cidades somados** contra o **dobro** da meta solo (`need ×2`); a construção-marco da era basta em **qualquer** das cidades.
- A dupla **avança de era junta**: os dois precisam votar para avançar.
- A campanha coop é a normal (longa), salva no servidor para retomar em várias noites; o ritmo rápido é opcional (ver [[Versus#Ritmo rápido]]).
- Ver [[Eras e Progressão]].

## Proposta de regras 🧪
- **Trocas**: em qualquer proporção combinada, mas **exigem transporte** (ver abaixo). Na Era Primitiva, trocar com o parceiro é a principal forma de "comércio" (ainda não existe 💰).
- A partir do Bronze, 💰 também pode ser trocado.
- **Ordem do turno**: no físico, todos fazem a mesma fase juntos; no digital, simultâneo (ver acima).

## Mapa compartilhado (decidido)
- As duas cidades ficam **no mesmo mapa**, com os Centros a **10 hex** de distância (`RIVAL_DISTANCE`). Cada cidade usa coordenadas locais (Centro em 0,0) com seed própria; na tela, a cidade do outro aparece deslocada, só leitura, a partir do último estado que ele subiu.
- Entre elas existe uma **faixa neutra** de **tiles acinzentados**: hexes a até 2 passos de ficarem equidistantes dos dois Centros **não podem ser explorados**.
- Cada território tem **identidade visual**: borda dos tiles e estandarte do Centro na cor do jogador (planejado 🧪).
- Para os outros lados, cada cidade cresce livremente (digital) ou até acabar sua pilha de tiles (físico).

## Transporte entre cidades (construído)
- A troca **exige conexão**: tudo que cruza a faixa neutra é uma **comitiva** (`carga`, `ajuda` ou, no versus, `exército`), com turno de saída e de chegada.
- **Carga**: o jogador escolhe recursos para enviar; o número de trabalhadores 👤 necessários sai da capacidade por trabalhador da era. Eles precisam estar **ociosos**.
- Enquanto viaja, o trabalhador fica no contador de **ausentes**: continua comendo e ocupando moradia, mas **não trabalha nem gera ✋**. Volta ao fim da viagem de volta (ida + volta, mesma velocidade).
- Tempo de viagem = ⌈10 hex ÷ velocidade⌉ turnos.

| Meio | Era | Hex por turno | Carga por trabalhador 🧪 |
|---|---|---|---|
| A pé | Primitiva | 1 | 5 |
| Cavalo | Bronze | 2 | 8 |
| Carroça (estrada) | Ferro/Medieval | 3 | 15 |
| Trem (ferrovia) | Industrial | 6 | ilimitada* |
| Caminhão (rodovia) | Moderna | 6 | ilimitada* |

\* Ilimitada = 1 trabalhador carrega tudo. A troca não é instantânea: leva a viagem normal. No **ritmo rápido** a velocidade é fixa em **2 hex/turno** em qualquer era (5 turnos), mas a carga por trabalhador segue a tabela.

## Ajuda militar (construído)
- O jogador **envia tropas** para o parceiro (comitiva `ajuda`). As tropas saem da cidade de origem e, ao chegar, **viram tropas em casa do recebedor**.
- Mesma viagem das cargas (tabela acima). Ajuda vinda de longe precisa ser **planejada**: soldados posicionados com antecedência. Ver [[Defesa e Invasões]].
- **Tropas** vêm do Campo de guerra (ver [[Versus#Campo de guerra e tropas]]); cada tropa custa 1 👤 e consome 1 🍖 por turno.

## Ainda não implementado
Previstos no design original e **mantidos aqui para uma versão futura**:
- **Interceptação**: invasores roubando carga e matando trabalhadores no caminho; escolta de soldados. Hoje as comitivas chegam sempre.
- **Contratos compartilhados**: mercado de contratos único, com entregas somadas e recompensa dividida. Ver [[Contratos]].
- **Eventos de coop**: cartas que afetam as duas cidades (ex.: "Seca regional"). Hoje cada jogador compra os seus.
- **Infraestrutura na fronteira**: trilha, estrada, ponte, ferrovia, torres e paliçadas dentro da faixa neutra. Hoje ela é intransitável para construção.
- Fronteira **natural** (rio, cordilheira) como alternativa à faixa neutra.
- Invasores surgindo em hexes da fronteira.
- Mais de 2 jogadores, matchmaking e ranking.

## Em aberto
- Calibração do ritmo rápido **com humanos** 🧪 (hoje só com o bot). Ver [[Versus#Ritmo rápido]] e [[Questões em Aberto]].

Ver [[Modo Tabuleiro]] · [[Comércio e Mercado]] · [[Contratos]].
