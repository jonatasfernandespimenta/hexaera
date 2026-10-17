# Anúncios no CrazyGames — design

Data: 2026-10-17 · Status: aguardando aprovação

## Intenção

Monetizar o Hexaera com anúncios **sem atrapalhar o jogo**, começando pelo **CrazyGames**. A plataforma hospeda o build, cuida de consentimento (LGPD/GDPR), rede de anúncios e pagamento, e manda tráfego de graça. O jogo só decide **em que momentos** um anúncio pode aparecer, chamando o SDK v3 do CrazyGames.

O jogador do Hexaera não pode sentir o anúncio como spam. O pior cenário, citado pelo dono do jogo, é "um anúncio a cada turno".

## Metas

1. Publicar o Hexaera no CrazyGames como **build estático** (zip) que usa a API de partidas/presença que já está na Vercel.
2. Integrar o SDK: `gameplayStart`/`gameplayStop`, intersticial ("midgame"), vídeo com recompensa ("rewarded") e banners.
3. Criar a **tela de troca de era**: uma celebração que ainda não existe, útil mesmo sem anúncio.
4. Criar **ofertas de crise** no solo: uma **regra nova do jogo**, válida em todo lugar, em que o jogador paga a ajuda com 💰. No CrazyGames, também dá pra pagar com 📺 vídeo.
5. O deploy atual na Vercel **não tem anúncios**. Ganha a tela de era e as ofertas de crise só com a opção 💰.
6. **Online no CrazyGames**, com convite pelo link do SDK.

## Não-metas (por agora)

- Anúncios no domínio próprio (AdSense H5 Games Ads), Poki, banner de consentimento próprio. Ficam para depois.
- Banner durante a espera do rival no online. As regras do CrazyGames proíbem banner durante a gameplay. Volta a ser considerado quando houver anúncio no domínio próprio.
- Recursos de multiplayer do SDK (sala, chat, "instant multiplayer"). São opcionais.
- Contas de usuário e o módulo Data do SDK (salvar na nuvem). O save continua no `localStorage`.

## Anti-metas (seria fracasso mesmo funcionando)

- Anúncio no meio de uma jogada: durante o turno, numa carta de evento sem pedido do jogador, no tutorial.
- Banner cobrindo qualquer parte da interface, principalmente no celular (barra de recursos, metas, botões, cartas).
- A dificuldade passar a depender do vídeo. A ajuda com 💰 é regra do jogo e entra no bot e no playtest (`src/core/bot.ts`, `08 Roadmap/Playtest.md`). O 📺 é só um jeito alternativo de pagar e não muda o balanceamento.
- Botão de vídeo que não faz nada. Na fase "Basic Launch" os anúncios ficam desligados, e todo botão 📺 precisa sumir quando não há anúncio.
- Pagar recompensa quando o vídeo dá erro.
- Qualquer coisa que mude o jogo no deploy da Vercel.

## Regras do CrazyGames que restringem o design

Fonte: <https://docs.crazygames.com/requirements/ads/>, `/requirements/technical`, `/sdk/video-ads/`, `/sdk/banners/`.

- **Basic Launch: anúncios desligados e sem receita.** Só o Full Launch, liberado pelo CrazyGames depois de avaliar as métricas, tem anúncios. O jogo precisa rodar normal com os anúncios desligados (erros `adsDisabledBasicLaunch` / `bannersDisabledBasicLaunch`).
- Só anúncios vindos do SDK do CrazyGames.
- **Midgame:** entre fases ou etapas. Nunca durante o jogo nem em botões de navegação (menu principal, configurações, loja). O SDK aplica sozinho o intervalo mínimo (~3 min, erro `adCooldown`). O jogo não precisa contar tempo.
- Pausar o jogo e o som **só quando o anúncio começar** (`adStarted`) e retomar em `adFinished` ou `adError`.
- **Rewarded:** é opcional. Precisa de ícone de vídeo, de uma alternativa sem anúncio (ex.: moeda do jogo), não pode aparecer durante a gameplay ativa, não pode ser oferecido com frequência demais, não pode encadear vídeos. Sem recompensa em `adError`. Entre duas fases, é midgame **ou** rewarded, nunca os dois.
- **Banners:** só em telas úteis que ficam abertas 5 s ou mais em média. Nunca durante a gameplay. Não podem cobrir a interface em nenhum tamanho de tela. No máximo 2 por tela. Recarregar o mesmo contêiner no mínimo a cada 30 s. Tamanhos: 728×90, 300×250, 320×50, 468×60, 320×100 (ou responsivo).
- Nunca bloquear nem penalizar quem usa adblock, e não mostrar pop-up sobre isso.
- Build: caminhos relativos, download inicial de até 50 MB (até 20 MB para aparecer na home mobile), até 1.500 arquivos, CSS `user-select: none` no body, funcionar em fullscreen no app com safe areas.
- Se o jogo coleta dados além dos eventos do SDK (o PostHog conta), mostrar um **aviso simples** de privacidade, não um pop-up que bloqueia.

## Onde aparecem os anúncios (decidido)

| Lugar | Anúncio |
|---|---|
| Menu inicial | Banners. Desktop: rodapé (728×90) + 1 lateral (160×600 responsivo, só em tela ≥ 1100 px). Celular: rodapé (320×50). Máximo de 2. |
| Troca de era (tela nova) | Midgame ao fechar a celebração. Sem banner (a tela fica aberta menos de 5 s). |
| Crise no solo | Oferta "Comprar com 💰" ou "📺 Assistir" (rewarded). |
| Fim de partida (solo e online) | Midgame + banner na tela de Vitória/Derrota. |
| Durante a partida, espera do online, tutorial, cartas de evento comuns | Nada. |
| Botão "Menu principal" / "Nova civilização" do menu da engrenagem | Nada (botão de navegação). |

### Tela de troca de era
- Aparece quando `state.era` sobe (hoje só toca `sfx('era')`, em `App.tsx`).
- Cartão no estilo `.pcard`/`.stage` existente: "🎉 Era do Bronze", turno, o que destravou (construções/cartas novas da era). Botão "Continuar".
- Ao tocar "Continuar": `requestAd('midgame')`. O jogo segue em `adFinished`/`adError`. Sem anúncio (Basic Launch, cooldown, erro), segue na hora.
- **Solo:** cartão que bloqueia a tela, com midgame no "Continuar".
- **Online:** só a celebração, sem midgame e sem bloquear (algo como um toast/cartão que fecha sozinho). Motivo: a era sobe no `endTurn`, e o relógio da vez (`useTurnClock`, `src/OnlineHud.tsx`) já está contando o turno novo e envia o turno sozinho quando zera. Um vídeo de 15–30 s comeria esse tempo.
- Existe também no deploy da Vercel, sem o anúncio.

### Ofertas de crise (só solo: campanha e sandbox, nunca tutorial nem online)
Aparecem **no começo do turno** (depois do fim do turno anterior) ou **na carta de evento**, que já é uma pausa. Nunca no meio do turno.

| Crise | Gatilho | Ajuda |
|---|---|---|
| Fome | A comida projetada para o fim deste turno fica negativa (`res.food` + produção − `eaten`) | 🍖 suficiente para não faltar neste turno |
| Centro em perigo | ❤️ do Centro ≤ 30% de `centerMax` com invasor encostado | Recupera parte da ❤️ do Centro e dá +2 ✋ neste turno para reagir |
| Evento ruim | Carta de evento cujas opções tiram recursos | Opção extra na carta: perde só metade |

- **É regra do jogo** (vive em `src/core/`, com o contador no `State`), igual na Vercel e no CrazyGames.
- Cada oferta mostra **"Comprar por N 💰"** e, só no CrazyGames com anúncios ativos (fora do Basic Launch), **"📺 Assistir"** ao lado. Recusar é sempre possível e sem custo.
- **Sem 💰 possível, sem oferta:** se o mercado do sandbox estiver desligado (`market: 'off'`) ou não houver preço para o recurso, a oferta não aparece. Não precisa de Mercado construído: é uma ajuda à parte, com preço tirado de `prices`.
- **Evento ruim** = carta em que **todas** as opções custam recursos (se existe uma opção sem custo, não tem oferta). A ajuda é uma opção extra: **a opção mais barata da carta pela metade do custo**, contando só recursos (✋, ❤️, 👤 e destruição ficam como estão).
- O bot do playtest passa a usar a ajuda com 💰 quando ela aparece e o 💰 dá. Rodar o playtest antes/depois e registrar a rodada em `08 Roadmap/Playtest.md`.
- Rewarded: recompensa só em `adFinished`. Em `adError`, não paga nada e mostra um toast curto ("vídeo indisponível").

## Restrições técnicas

- **Build do CrazyGames é separado:** um export estático do Next (`output: 'export'`) gerado por um script próprio, sem afetar `next build`/Vercel. As rotas `app/api/*` não entram no export. O build do CrazyGames chama a API da Vercel por URL absoluta.
- **Chamadas de API** estão concentradas em `src/net.ts` (função `call`, `at`) e `src/usePresence.ts`. Elas ganham um prefixo configurável na hora do build (vazio na Vercel).
- **CORS** nas rotas `/api/*` liberando as origens do CrazyGames (vários subdomínios de `crazygames.com` e as origens dos apps iOS/Android). Hoje a API não tem CORS.
- **Caminhos relativos** no export (assets do `public/`, atlas de sprites, fontes, chunks `_next`).
- O SDK é carregado só no build do CrazyGames. No deploy da Vercel nada muda. Fora do CrazyGames (`SDK.environment` diferente de `crazygames`), toda chamada de anúncio vira no-op sem anúncio.
- `gameplayStart` quando o tabuleiro fica jogável (entrar numa partida), `gameplayStop` no menu, na tela de fim, na celebração de era e durante qualquer anúncio.
- Pausar o som (`sfx.ts` já tem mute) entre `adStarted` e `adFinished`/`adError`, sem mudar a preferência salva do jogador.
- **Convites do online:** hoje o link é `?match=id` na URL da página, o que não funciona dentro do iframe do CrazyGames. No build do CrazyGames, o link de convite vem de `SDK.game.inviteLink({ match: id })` e a entrada lê `SDK.game.getInviteParam('match')` no lugar de `location.search`. Na Vercel continua como está.

## Calls que eu fiz (o dono pode corrigir)

- **Limite de uma ajuda de crise por era**, contando 💰 e 📺 juntos. Ficam umas 6–7 por campanha. O contador fica no `State` e sobrevive ao recarregar.
- **Online: a celebração de era não tem anúncio** (por causa do relógio da vez). O midgame do online fica só no fim de partida.
- Regras de "evento ruim", "sem 💰 sem oferta" e "metade da opção mais barata" (seção das ofertas de crise).
- **Sem ofertas de crise na era Primitiva:** o Mercado (💰) só abre a partir do Bronze, e a regra exige alternativa sem anúncio.
- Valores das ajudas (quanto 🍖, quanta ❤️, preço em 💰): começar pelo mínimo que tira o jogador da crise e calibrar pelo preço de mercado atual (`buyPrice`). O preço em 💰 fica um pouco acima do Mercado, para que o vídeo valha a pena sem que o 💰 fique ruim.
- O aviso de privacidade (PostHog) é uma linha discreta no menu inicial do build do CrazyGames, com link para a política. O PostHog continua só em produção.

## O que fica com o builder

- Como gerar o export sem as rotas de API (script, pasta temporária, `pageExtensions`, o que for mais simples).
- A estrutura do código da integração com o SDK (um módulo pequeno, tipo `src/ads.ts`, com no-op fora do CrazyGames).
- O visual exato da tela de era e das ofertas, seguindo o estilo existente (`.pcard`, `.stage`, `.opt`).
- O texto das ofertas, nos dois idiomas (`i18n.ts`/`en.ts`).
- Um teste pequeno para as regras de gatilho das crises (função pura sobre `State`, ao lado de `game.test.ts`).

