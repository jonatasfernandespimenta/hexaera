# Multiplayer online: Coop e Versus — design

Data: 2026-10-16 · Status: aguardando aprovação (revisado após builder check)

## Intenção

Jogar Hexaera **com um amigo pela internet**, os dois sentados ao mesmo tempo numa sessão.
- **Versus**: cada um ergue sua cidade e treina um exército para derrubar o Centro do outro (estilo Age of Empires, mas por turnos). Cabe **numa noite**.
- **Coop**: cada um com sua cidade, trocando recursos e ajudando na defesa, como já descrito em `04 Modos de Jogo/Cooperativo.md` — agora online em vez de hot-seat.

Isto **substitui** duas decisões antigas do vault ("coop só local" e "sem multiplayer/versus"); as notas devem ser atualizadas (ver Fase 6).

## Metas

- Partida de **até 2 jogadores**, criada por link/código, sem cadastro (apelido).
- **Turno compartilhado e simultâneo**: os dois jogam o mesmo turno ao mesmo tempo; o turno vira quando ambos apertam "Fim do turno".
- **Mesmo mapa**, uma cidade de cada lado, separadas por uma fronteira neutra.
- Versus: **nova construção que recruta tropas**; tropas enviadas chegam ao outro **exatamente como os invasores de hoje** (aviso ⚠️ um turno antes, entram pela borda, avançam até o Centro). Vence quem **destruir o Centro do outro**.
- Versus termina em **1–2 h** (ritmo rápido).
- Reconectar se cair; retomar a partida em outra noite.

## Não-metas (por agora)

- Mais de 2 jogadores, matchmaking com desconhecidos, ranking.
- Anti-trapaça: cada navegador é dono da própria cidade e o servidor confia nele (aceitável entre amigos — **não** serve para ranking público).
- Turno assíncrono (cada um jogando em horários diferentes).
- Mover tropas hex a hex; combate tático.
- Interceptação de cargas/tropas no caminho, contratos compartilhados e eventos de coop (estão no vault; ficam para depois).

## Anti-metas (seria fracasso mesmo funcionando)

- Um jogador esperando o outro jogar o turno inteiro (por isso turnos simultâneos, não alternados).
- Quem joga mais rápido ficar eras à frente (por isso o relógio é compartilhado).
- Duas versões das regras: online usa **o mesmo `core/`** do solo, só com configuração diferente.

## Decisões do usuário

- Online para coop **e** versus; jogadores conectados ao mesmo tempo.
- Turno compartilhado.
- Versus acaba quando um Centro é destruído.
- Servidor = **app Next.js com API routes no próprio Next**.
- Até 2 jogadores.
- Versus cabe numa noite.
- Ataque = apontar e mandar (recomendação aceita): escolhe tropas, clica "Atacar", a marcha é automática.

## Como funciona (o que está definido)

### Partida e conexão
- Menu inicial ganha **"Jogar online"** → *Criar partida* (escolhe Coop ou Versus, ritmo, relógio) ou *Entrar* (cola o link/código).
- Quem cria recebe um link `…/?match=<id>`; o segundo abre e digita o apelido.
- Cada jogador recebe um **token secreto** guardado no `localStorage` para aquela partida (é o que permite reconectar).

### Turno simultâneo
1. Os dois jogam o turno N localmente (explorar, construir, recrutar, enviar).
2. "Fim do turno" envia ao servidor: o estado da cidade **antes** do `endTurn` e as comitivas que saíram neste turno. O jogador vê "esperando o outro…".
3. Quando os dois enviaram, o servidor fecha o turno N e entrega a cada um as **chegadas** do turno (comitivas que alcançam aquela cidade).
4. Cada cliente aplica as chegadas e roda o `endTurn` da própria cidade; sobe o estado resultante (para reconexão e para o outro ver).
- **Relógio opcional** (ex.: 60 s, definido na criação): ao zerar, o cliente encerra o turno sozinho. Se um jogador está desconectado, a partida **pausa** (o servidor não roda a cidade de ninguém).

### Mapa compartilhado
- Cada cidade continua em **coordenadas locais** (Centro em 0,0), com seed própria derivada da seed da partida — o `core/` atual não muda de forma.
- Na tela, a cidade do outro é desenhada deslocada (Centros a ~10 hex), só leitura, a partir do último estado que ele subiu.
- **Fronteira neutra**: hexes cuja posição no mundo fica perto da linha do meio não podem ser explorados (tiles acinzentados). Exceções do vault (infra de passagem e torres na fronteira) ficam para depois.

### Comitivas (unidade comum para versus e coop)
Tudo que cruza a fronteira é uma comitiva: `{ de, para, tipo: 'exercito' | 'carga' | 'ajuda', tropas?, carga?, sai: turno, chega: turno }`.
- Tempo de viagem = distância entre as cidades ÷ velocidade da era (tabela "Transporte entre cidades" do vault).
- Os dois veem a comitiva andando na faixa neutra.

### Versus
- **Nova construção** que treina tropas (nome provisório "Campo de guerra"; o Quartel atual continua como defesa). Libera **no Bronze** no ritmo rápido.
- **Tropa**: custa recursos e **1 👤**; força pela era, na escala que os invasores já usam (`THREATS`: Saqueadores no Bronze, Bando armado no Ferro, Exército no Medieval…).
- **Atacar**: seleciona tropas → "Atacar" → vira comitiva `exercito`.
- **Chegada**: no jogo do defensor, a comitiva vira **aviso ⚠️** num hex de borda do lado do atacante; no turno seguinte, vira **invasores** normais (o código de `threats()` já faz o resto: torres atiram, invasor ataca construções e o Centro, defensor caça com ✋).
- **Tropas em casa** defendem o Centro.

#### Combate e população *(decisões do Claude, ajustáveis)*
- Um exército de N tropas chega como **N invasores**, com a força da **era do atacante** (quem investiu em era mais alta bate mais forte).
- **Tropas em casa** funcionam como uma torre no Centro: alcance 1, dano = soma do ataque delas. Tropa morre ao levar dano igual à vida (reaproveita os números de `THREATS`).
- Invasor morto dá o saque normal de `THREATS` ao defensor; atacantes **não voltam** para casa.
- Tropas de **ajuda** (coop), ao chegar, viram tropas em casa do **recebedor**.
- **População**: recrutar tira 1 👤 da população de vez; a tropa consome 1 🍖 por turno enquanto viva e não ocupa moradia. Carregador de carga fica num contador de **ausentes** (`away`): come, ocupa moradia, não gera ✋ e volta ao fim da viagem de volta. Pop 0 (sem contar tropas) = derrota.
- **Velocidade**: exércitos andam **2 hex/turno** em qualquer era no ritmo rápido (Centros a ~10 hex → ataque leva ~5 turnos + 1 de aviso). Ritmo normal usa a tabela do vault. Ajuste fino pelo bot.
- **Vitória/derrota**: Centro com ❤️ 0 (ou população 0) perde; o outro vence. Marco Final não encerra o versus.
- **Sem ameaças do solo (decisão do usuário)**: no versus, invasores aleatórios (`warn()`/THREAT_CHANCE) ficam desligados e as cartas de evento com `warn` ou `destroy` saem do baralho. Os demais eventos continuam.

### Coop
- Comitivas `carga` (trabalhadores levando recursos; o trabalhador fica fora da cidade até voltar) e `ajuda` (tropas enviadas para defender o parceiro).
- Se **qualquer** Centro cair, os dois perdem.
- **Vitória (decisão do usuário)**: concluir o **Marco Final**, com a dificuldade **escalada ×2** para a dupla. Interpretação do Claude: metas de era viram **metas compartilhadas** — conhecimento e população **somados** das duas cidades contra o **dobro** da meta solo; a construção-marco basta em qualquer uma das cidades. A dupla avança de era junta (os dois precisam aceitar).
- Coop padrão = campanha normal (longa), salva no servidor para retomar em várias noites; ritmo rápido opcional.

### Ritmo rápido
- Só **números**, não regras novas: produção maior, metas de era menores, obras mais curtas, Campo de guerra mais cedo. Mira: 7 eras em ~60–80 turnos.
- Ajustado com o bot de playtest existente (`core/bot.ts`, `npm run playtest`).

### Servidor e dados
- O jogo (hoje Vite em `game/`) **migra para Next.js** (App Router), com a página do jogo carregada só no cliente (sem SSR por causa do Three.js). O `core/` é importado pelo cliente e pelas API routes.
- Atualizações por **polling** (~1–2 s) enquanto se espera o outro; num jogo por turnos isso basta, e as API routes da Vercel não mantêm WebSocket. Tempo real dedicado pode entrar depois sem mudar o modelo.
- Partida guardada num store externo via Vercel Marketplace.

## Fases de construção

1. **Migrar para Next.js** — o jogo solo roda igual, mesmo deploy (`hexaera.vercel.app`). Testes atuais passando.
2. **Core multiplayer** — seed/offset por jogador, fronteira neutra, comitivas, tropas + Campo de guerra, chegadas → aviso/invasores, condição de vitória do versus, config de ritmo. Testes Vitest headless (duas cidades simuladas sem servidor).
3. **Servidor + lobby** — API de partida, store, polling, "Jogar online" no menu, reconexão, pausa ao desconectar.
4. **Versus jogável** — UI de recrutar/atacar, cidade do outro na tela, comitiva visível, tela de vitória/derrota.
5. **Coop jogável** — envio de carga e ajuda, derrota compartilhada.
6. **Ritmo e vault** — calibrar ritmo rápido com o bot; atualizar `Cooperativo.md`, `Questões em Aberto.md` e criar `04 Modos de Jogo/Versus.md`.

## Riscos

- **Divergência**: cada cliente roda a própria cidade; se as chegadas forem aplicadas em turnos diferentes nos dois lados, o versus fica injusto. Mitigação: chegadas sempre amarradas ao número do turno fechado pelo servidor.
- **Migração Next** mexe em `App.tsx`/build; outra sessão (hexaera-ed) já subiu o layout mobile (commit 7a536ef) e segue no Sandbox — a Fase 1 começa só depois de confirmar com ela que não há edição em andamento nesses arquivos.
- **Tamanho do bundle** (já > 500 kB): carregar o jogo com import dinâmico na página Next.

## Deixado para quem constrói

Formato exato das rotas e do payload, schema do store, layout do lobby, valores numéricos do ritmo e das tropas, nome final da construção.
