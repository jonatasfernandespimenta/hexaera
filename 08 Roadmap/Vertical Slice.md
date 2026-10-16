---
tags: [roadmap]
status: proximo
---
# Vertical Slice

> Validar se **descobrir terrenos e posicionar peças sobre o tabuleiro** é visualmente agradável e divertido. Se esse jogo pequeno for divertido, o resto é expansão do mesmo sistema.

## Protótipo 0 (técnico)
- [x] Fogueira central + 6 hexágonos ocultos
- [x] Câmera 3D com zoom e rotação
- [x] Clicar para explorar, descontando ✋
- [x] 3 terrenos: Floresta, Planície, Montanha (solo fértil removido)
- [x] 3 construções: Cabana, Fazenda, Lenhador (Cabana/Fazenda derrubam floresta)
- [x] Botão "Fim do turno": produção e consumo

Sem comércio, combate ou eras.

> ✅ Feito em 2026-10-16 — código em `game/` (`npm run dev`, `npm test`). Simplificações: sem conexão ao Centro (tudo conectado), terreno sem clusters, sem pedra, cores lisas (sem textura pixel).

## Vertical Slice (Primitiva → Bronze)
- [x] Exploração com custo por anel ([[Exploração]])
- [x] 🍖 🪵 🪨 + 👤
- [x] 8–12 construções ([[Catálogo de Construções#Era Primitiva (vertical slice)]])
- [x] Felicidade
- [x] 1 cadeia produtiva (Argila → Olaria → Cerâmica)
- [x] Invasores simples + Paliçada/Torre
- [x] 10–15 cartas de evento
- [x] Avanço para o Bronze

> ✅ Feito em 2026-10-16. O que entrou:
> - Terreno **Rio**; recursos 🪨 🧱 🏺 📚; felicidade 😊 com faixas de produção.
> - 10 construções: Cabana, Fazenda, Lenhador, Pedreira, Pescador, Barreiro, Olaria, Ancião, Totem, Torre de vigia.
> - Cadeia Barreiro → 🧱 → Olaria → 🏺; consumir 1 🏺/turno = +5 😊.
> - Lobos anunciados 1 turno antes (⚠️), avançam 1 hex/turno, destroem construções e atacam a fogueira (🔥 10 de vida). Torre: 1 dano, alcance 1.
> - 13 cartas de evento a cada 5 turnos, com opções 🔒 (requer Totem/Ancião) e a flag `amizade` que libera "Os amigos voltam".
> - Objetivo: 20 📚 + 10 👤 + Olaria → botão **Avançar era** → **Era do Bronze**, com o mesmo tabuleiro.
> - Bronze: recurso 🔶; Fundição (Montanha, +1 🔶), Estábulo (+2 ✋); melhorias Casa, Campo arado, Escriba, Torre de bronze. Lobos com +2 ❤️/+1 ataque por era.
> - Sair do Bronze (40 📚 + 20 👤 + Fundição) encerra a partida até a Era do Ferro existir.
>
> Simplificações (ainda fora): Paliçada nas bordas, conexão ao Centro/trilhas, armas (🗡) para torres, derrota por 😊 0 por 3 turnos, ações de coletar.

## Fase 2 (Ferro + Medieval, logística, comércio)
> ✅ Primeira versão em 2026-10-16:
> - **Logística:** Trilha (Primitiva, 1 ✋) e Estrada (Ferro, 2 ✋ + 1 🪨) nas bordas; montanha ×2, rio + ponte (2 🪵). Construção fora do anel 1 só funciona ligada ao Centro; Mina de ferro exige estrada. Paradas mostram ⛔ e o motivo. Defesa não precisa de conexão.
> - **💰** a partir do Bronze: imposto por moradia (Cabana 1, Casa 2, Sobrado 4), modulado por 😊.
> - **Mercado** (Bronze): compra/venda, 10 unidades/turno por Mercado, preço move 5% por unidade e oscila a cada 3 turnos. Comércio não gera dívida.
> - **Contratos:** 3 ofertas (uma troca a cada 4 turnos), 1 ativo por Mercado, entrega parcial, recompensa 💰 (+5%/⭐) e ⭐; falha −2× ⭐.
> - **Ferro:** ⛏ 🗡; Mina de ferro, Ferreiro, Sobrado (⬆ Casa), Templo (⬆ Totem), Quartel (+1 dano da tribo), Torre de pedra (⬆ Torre de bronze).
> - **Medieval:** 🔧 🧵; Oficina, Tecelagem, Moinho (+2 ✋), Biblioteca (⬆ Escriba), Castelo (⬆ Torre de pedra), Catedral (marco).
> - Ameaças por era (Lobos → Saqueadores → Bando armado → Exército); Centro +5 ❤️ por era. Cartas por era em abas.
>
> Fora por enquanto: invasores atacando infraestrutura, especiais das ameaças, eventos por era, Porto/Muralha, recursos finitos.

## Fase 3 (Industrial: ferrovia, energia, poluição)
> ✅ Primeira versão em 2026-10-16:
> - **Ferrovia** (3 ✋ + 2 🔩 + 20 💰 por borda): exigida por Siderúrgica e Fábrica.
> - **⚡ Energia:** Usina a carvão queima 2 ⚫ e gera 8 ⚡ no turno (não acumula). Siderúrgica e Fábrica precisam de 4 ⚡ cada; sem energia sobrando, param (⛔ sem ⚡). Barra mostra usada/gerada.
> - **☁️ Poluição** 0–100: usina +4, siderúrgica +3, fábrica +2, mina de carvão +1; cada floresta −1, Parque −2. 😊 perde ☁️/2. Eventos de Industrialização a partir de ☁️ 40/50/60 (rio contaminado, protestos, doenças).
> - **Construções:** Mina de carvão (estrada), Usina a carvão, Siderúrgica (2 ⚫ + 3 ⛏ → 2 🔩), Fábrica (1 🔩 + 1 🧵 → 2 📦), Cortiço (⬆ Sobrado, +10 👤, −2 😊), Parque público.
> - **Sabotadores** (ameaça da Industrial) destroem a conexão mais valiosa do hex onde estão — corta produção até reconstruir.
> - Contratos industriais (🔩, 📦, ⚫). Objetivo da Industrial: 300 📚 + 70 👤 + Fábrica → fim do conteúdo atual (Moderna).
>
> Fora por enquanto: Estação, Prefeitura (Centro industrial), cartas de tecnologia.

## Fase 4 (Moderna + Contemporânea, Campanha completa)
> ✅ Primeira versão em 2026-10-16:
> - **Moderna:** 🛢 petróleo, 🔌 eletrônicos, 🚗 automóveis. Poço de petróleo (estrada), Termelétrica (2 🛢 → 15 ⚡), Hidrelétrica (rio, 12 ⚡ limpa, −2 😊), Fábrica de eletrônicos, Montadora, Prédio residencial (⬆ Cortiço), Hospital, Estádio (monumento), Torreta (⬆ Castelo). **Rodovia** (2 ✋ + 50 💰) vale como ferrovia. 👤 ocioso vale 2 ✋ (Ferro→Industrial: 1,5).
> - **Contemporânea:** 🔋 baterias, 💾 tecnologia. Solar, Eólica (sem 👤), Nuclear (40 ⚡, −3 😊), Fábrica de baterias, Data center (💾 + 📚), Fábrica automatizada (⬆ Fábrica, sem 👤), Centro logístico (+1 contrato), Parque urbano (⬆ Parque).
> - **Marco Final: Cidade Inteligente** (20 💾 + 20 🔋 + 10 🚗 + 3000 💰). Meta da Contemporânea: 1200 📚 + 200 👤 + Marco → **Civilização concluída**, com opção de **Continuar jogando** (sandbox no mesmo tabuleiro).
> - Centro muda de nome por era (Fogueira → Acampamento → Aldeia → Praça da Vila → Prefeitura → Centro Urbano → Metrópole).
> - Ameaças: Sabotagem industrial, Ciberataque (ambas destroem conexões). Contratos novos (Governo, Startup…).
> - Modelos 3D animados: cavalo-de-pau do poço, pás da eólica, braço robótico, fumaça das usinas.
>
> Fora por enquanto: Refinaria, urânio e evento nuclear, baterias guardando ⚡, Polícia/invisibilidade, arquétipos de mapa, legado entre partidas. Arte 2D das cartas/recursos dessas eras ainda é emoji.

## Em paralelo
- [ ] Protótipo em papel ([[Componentes Físicos#Primeiro protótipo em papel]])
