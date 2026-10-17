# Anúncios no CrazyGames — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o Hexaera no CrazyGames (build estático) com anúncios do SDK v3 em momentos que não atrapalham, mais duas novidades que valem em todo lugar: a tela de troca de era e as ajudas de crise pagas com 💰.

**Architecture:** As regras da ajuda de crise ficam em `src/core/aid.ts` (puro, testado, usado também pelo bot). A integração com o SDK fica em `src/ads.ts`: no-op fora do build do CrazyGames, e o App só chama funções como `midgame()`, `rewarded()`, `banner(id)`. O build do CrazyGames é o mesmo app Next com `output: 'export'`, ligado por `NEXT_PUBLIC_CRAZY=1`. As rotas de API ficam de fora porque o build só aceita páginas `.tsx`. As chamadas vão para a API da Vercel por `NEXT_PUBLIC_API_BASE`.

**Tech Stack:** Next 16 (app router, `ssr:false`), React 19, TypeScript, vitest, CrazyGames HTML5 SDK v3 (`https://sdk.crazygames.com/crazygames-sdk-v3.js`).

**Spec:** `docs/superpowers/specs/2026-10-17-ads-crazygames-design.md`

Todos os comandos rodam em `game/`.

## Global Constraints

- Deploy da Vercel: **sem anúncios e sem SDK**. Ganha só a tela de era (solo) e as ofertas de crise com 💰.
- Variáveis de build: `NEXT_PUBLIC_CRAZY=1` (build do CrazyGames), `NEXT_PUBLIC_CRAZY_ADS=1` (ligar anúncios só depois que o CrazyGames liberar o Full Launch), `NEXT_PUBLIC_API_BASE=https://<domínio da Vercel>`. Sem essas variáveis, tudo se comporta como hoje.
- Só anúncios vindos do SDK do CrazyGames. Midgame **nunca** em botão de navegação ("Menu principal", "Nova civilização" do menu da engrenagem).
- Pausar o jogo e o som só em `adStarted` e retomar em `adFinished` ou `adError`.
- Rewarded paga **só** em `adFinished`. Em `adError`, mostra o toast `t('Vídeo indisponível.')` e não paga nada.
- Botão 📺 só aparece com `adsOn()` verdadeiro. Nunca um botão de vídeo que não faz nada.
- Banners: no máximo 2 por tela, nunca durante a partida, nunca cobrindo a interface. Recarregar só ao montar a tela, o que já fica bem acima do mínimo de 30 s.
- Ajuda de crise: só no solo (`!s.match`), nunca no tutorial, só a partir do Bronze (`s.era >= 1`), nunca com `s.opts?.market === 'off'`, no máximo **uma por era** (💰 e 📺 contam juntos).
- Preço em 💰 = `Math.ceil(valor de mercado × 1.25)`.
- Todo texto novo passa por `t()` e ganha a versão em inglês em `src/en.ts`.
- Seguir o estilo existente: comentários curtos em português, componentes `.pcard`/`.stage`/`.opt`.

## Review Focus

1. **Save antigo sem `aidEra`**: carregar um save de antes da mudança não quebra e libera a ajuda na era atual. Teste na Task 1.
2. **Adblock ou SDK que não carrega** (script bloqueado, `environment === 'disabled'`): o jogo abre e roda normal, sem 📺 e sem travar em "Continuar". Teste na Task 4 (`initAds` com script que falha).
3. **Recarregar a página com uma oferta aberta**: a oferta volta (é derivada do `State`), mas a ajuda nunca é cobrada duas vezes. Teste na Task 1 (`takeAid` com `aidEra === era` lança erro).
4. **Duas crises ao mesmo tempo** (fome + Centro em perigo no mesmo turno): aparece uma só oferta, a de maior prioridade (Centro > fome > evento). Teste na Task 1.
5. **"Continuar" da era com anúncio em cooldown ou erro**: o jogo segue na hora, sem esperar um callback que nunca chega. Teste na Task 4 (`midgame` resolve em `adError`).

---

### Task 1: Regras da ajuda de crise (core)

**Files:**
- Create: `src/core/aid.ts`
- Create: `src/core/aid.test.ts`
- Modify: `src/core/game.ts:17-50` (campo novo no `State`)

**Interfaces:**
- Produces:
  - `State.aidEra?: number`: era em que a ajuda já foi usada. Opcional, porque saves antigos não têm.
  - `type AidKind = 'center' | 'food' | 'event'`
  - `type Aid = { kind: AidKind; price: number; food?: number; hp?: number; actions?: number; option?: number }`. `option` é o índice da opção do evento pela metade.
  - `aidOffer(s: State): Aid | null`
  - `takeAid(prev: State, aid: Aid, pay: 'money' | 'ad'): State`. Com `'money'`, desconta `price` de 💰. Com `'ad'`, não desconta nada.
  - `export const AID_MARKUP = 1.25`

**Regras do `aidOffer`** (nesta ordem; a primeira que bater vence):
- Retorna `null` se `s.match`, `s.over`, `s.era < 1`, `s.opts?.market === 'off'` ou `s.aidEra === s.era`.
- **center:** `s.centerHp <= 0.3 * centerMax(s)` e algum invasor com `distance(parse(i.at)) <= 1`. `hp = Math.ceil(centerMax(s) / 2)` (sem passar do máximo), `actions = 2`, `price = 60 * s.era` (calibrar no playtest da Task 2).
- **food:** `s.res.food + income(s).food < 0`. `food = -(s.res.food + income(s).food)`, `price = Math.ceil(food * buyPrice(s, 'food') * AID_MARKUP)`.
- **event:** `s.event` aberto e **toda** opção tem algum recurso negativo (`effect.res`). `option` = a opção cujo custo escalado (×`EVENT_SCALE[s.era]`, igual ao `eventRes`) vale menos em 💰 por `buyPrice`. `price = Math.ceil(metade do valor dessa opção × AID_MARKUP)`. Se algum recurso do custo não tem `RES[r].price`, sem oferta.

**`takeAid`:** lança `Error(tr('Ajuda já usada nesta era.'))` se `aidEra === era`, e `Error(tr('Falta 💰.'))` se `pay === 'money'` e `res.money < price`. Aplica a ajuda e marca `aidEra = era`. Para `event`, resolve a carta (`s.event = null`, log e `done:` igual a `resolveEvent`) aplicando a opção com custos de recurso pela metade (`Math.ceil`). Os outros efeitos da opção ficam iguais. Exporte de `game.ts` o que faltar (`EVENT_SCALE`, `applyEffect`) em vez de duplicar.

- [ ] **Step 1: Write the failing tests** em `src/core/aid.test.ts`, montando estados a partir de `newGame(1)` com `era = 1`:
  - `sem oferta na Primitiva`: `era = 0` com fome projetada → `aidOffer` é `null`.
  - `sem oferta online, com mercado desligado ou já usada`: `match` definido / `opts.market = 'off'` / `aidEra = 1` → `null`.
  - `save antigo sem aidEra`: `delete s.aidEra` com fome → oferta `kind: 'food'`.
  - `fome`: `res.food = 0`, pop alto → `kind 'food'`, `food === -(0 + income(s).food)`, `price === Math.ceil(food * buyPrice(s,'food') * 1.25)`.
  - `centro tem prioridade sobre fome`: as duas crises → `kind 'center'`.
  - `evento só quando toda opção custa`: carta `manada` (tem opção sem custo) → `null`; uma carta em que todas as opções custam recurso → `kind 'event'` com o `option` mais barato.
  - `takeAid paga e marca a era`: `'money'` desconta `price`, `aidEra === era`. `'ad'` não desconta.
  - `takeAid não cobra duas vezes`: segundo `takeAid` na mesma era lança erro.
  - `takeAid sem 💰`: `res.money = 0` com `'money'` lança erro.
- [ ] **Step 2: Run** `npx vitest run src/core/aid.test.ts`. Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implement** `aid.ts` e o campo no `State` conforme as regras acima.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS (todos os testes, inclusive os antigos).
- [ ] **Step 5: Commit** `git add src/core && git commit -m "Ajuda de crise: regras no core (fome, Centro, evento), uma por era"`

### Task 2: Bot usa a ajuda + playtest

**Files:**
- Modify: `src/core/bot.ts:104` (`step`)
- Modify: `../08 Roadmap/Playtest.md` (nova rodada)

**Interfaces:**
- Consumes: `aidOffer`, `takeAid` (Task 1).

- [ ] **Step 1: Rodar o playtest antes** com `N=100 npm run playtest` e guardar a saída.
- [ ] **Step 2: Implement** no começo de `step`: se `aidOffer(s)` existe e `s.res.money >= price`, retorna `takeAid(s, aid, 'money')`. Vem antes do bloco `if (s.event)`, para a ajuda de evento ter chance.
- [ ] **Step 3: Rodar o playtest depois** com `N=100 npm run playtest`. Se a vitória passar de ~75% ou a mediana cair abaixo de 250 turnos, subir o preço do Centro (`60 * era`) ou o `AID_MARKUP` e rodar de novo.
- [ ] **Step 4: Registrar** "Rodada 9 — ajuda de crise" em `Playtest.md`, no formato das rodadas anteriores: mudança, tabela antes/depois, quantas ajudas por partida.
- [ ] **Step 5: Commit** `git commit -am "Bot compra a ajuda de crise; playtest rodada 9"`

### Task 3: Interface — ofertas de crise e tela de troca de era

**Files:**
- Create: `src/Aid.tsx` (cartão da oferta)
- Create: `src/EraUp.tsx` (cartão da celebração)
- Modify: `src/App.tsx` (efeito de comparação com o estado anterior em ~196-211, carta de evento em ~495, render)
- Modify: `src/en.ts`

**Interfaces:**
- Consumes: `aidOffer`, `takeAid`, `type Aid` (Task 1).
- Produces:
  - `<AidCard aid={Aid} state={State} onBuy={() => void} onWatch={(() => void) | null} onSkip={() => void} />`. Com `onWatch === null`, o botão 📺 não aparece.
  - `<EraUp era={number} turn={number} onContinue={() => void} />`
  - No `App`: `const [eraUp, setEraUp] = useState<number | null>(null)`, `const [skipAid, setSkipAid] = useState<number | null>(null)` (turno em que o jogador recusou) e `const aidShown: Aid | null` (a oferta center/food visível agora, pelas condições abaixo).

Comportamento:
- **Oferta center/food:** aparece como `.stage` quando `aidOffer(state)` existe, `kind !== 'event'`, `tut === null`, `!state.event`, `eraUp === null` e `skipAid !== state.turn`. "Recusar" grava `skipAid = state.turn`. Comprar chama `act(() => takeAid(state, aid, 'money'), 'card', ['aid_taken', { kind, pay: 'money' }])`. Nesta task `onWatch` é sempre `null` (a Task 5 liga).
- **Oferta event:** um botão a mais no fim da carta de evento: `t('Pagar metade: {0}', label)`, com o preço em 💰. O 📺 também entra na Task 5.
- **Tela de era (solo):** no efeito que compara com o estado anterior, `if (state.era > p.era && !match && tut === null) setEraUp(state.era)`. O cartão mostra `t('Era {0}', ERAS[era].name)`, o turno e os nomes de `BUILDINGS` com `era === era`. "Continuar" fecha.
- **Online:** `setNews(t('🎉 Era {0}!', ERAS[state.era].name))` em vez do cartão. Não bloqueia nada.
- Textos novos em `en.ts`: 'Sua gente vai passar fome', 'O Centro está caindo', 'Comprar por {0} 💰', '📺 Assistir', 'Recusar', 'Pagar metade: {0}', 'Era {0}', '🎉 Era {0}!', 'Novas construções', 'Continuar', 'Vídeo indisponível.', 'Ajuda já usada nesta era.'.

- [ ] **Step 1: Implement** os componentes e a ligação no `App`.
- [ ] **Step 2: Verify** com `npm run build`. Expected: compila sem erro de tipo.
- [ ] **Step 3: Verify no navegador** (`npm run dev`), usando `window.hex.set` no console:
  - era 1 com `res.food = 0` e pop alto → aparece a oferta de fome. Comprar desconta 💰. A oferta não volta na mesma era. Recarregar a página não reabre a oferta.
  - avançar de era no solo → aparece o cartão de celebração.
  - celular (DevTools a 390×844): os cartões cabem sem rolagem horizontal.
- [ ] **Step 4: Commit** `git commit -am "Tela de troca de era e ofertas de ajuda de crise"`

### Task 4: Módulo do SDK (`src/ads.ts`) e som pausável

**Files:**
- Create: `src/ads.ts`
- Create: `src/ads.test.ts`
- Modify: `src/sfx.ts` (nova `pauseAudio`)
- Modify: `src/Root.tsx` (esperar `initAds()` antes de renderizar o `App`)

**Interfaces:**
- Produces (todas no-op e seguras fora do CrazyGames):
  - `export const CRAZY: boolean` (`process.env.NEXT_PUBLIC_CRAZY === '1'`)
  - `initAds(): Promise<void>`: se `CRAZY`, injeta o `<script>` do SDK e faz `await SDK.init()`. Nunca rejeita, porque erro de script ou init deixa tudo desligado. Depois registra `addSettingsChangeListener` para `settings.muteAudio` → `pauseAudio`.
  - `adsOn(): boolean`: `CRAZY && NEXT_PUBLIC_CRAZY_ADS === '1' && environment !== 'disabled' && !blocked`. `blocked` vira `true` depois de um `adError` com código `adblock` ou `adsDisabledBasicLaunch`.
  - `gameplay(on: boolean): void`: chama `gameplayStart`/`gameplayStop` só quando o valor muda.
  - `midgame(): Promise<void>`: resolve em `adFinished`/`adError`, ou na hora se `!adsOn()`.
  - `rewarded(): Promise<boolean>`: `true` só em `adFinished`.
  - `banner(id: string): () => void`: chama `requestResponsiveBanner(id)` e devolve a limpeza (`clearBanner(id)`).
  - `inviteUrl(id: string): Promise<string>`: com `CRAZY`, `SDK.game.inviteLink({ match: id })`. Sem, `${location.origin}/?match=${id}`.
  - `inviteParam(): string | null`: com `CRAZY`, `SDK.game.getInviteParam('match')`. Sem, `new URLSearchParams(location.search).get('match')`.
- `sfx.ts`: `export function pauseAudio(p: boolean)` suspende/retoma o `AudioContext` sem mexer na preferência salva (`hex.mute`).
- Durante o anúncio: `adStarted` → `pauseAudio(true)` + `gameplay(false)`. No fim: `pauseAudio(false)`. O App religa o `gameplay`.

- [ ] **Step 1: Write the failing tests** em `src/ads.test.ts`, com um `window.CrazyGames.SDK` falso em `globalThis` e `vi.stubEnv`/`vi.resetModules` para ligar `CRAZY`/`ADS`:
  - `fora do CrazyGames tudo é no-op`: sem `CRAZY`, `adsOn()` é `false`, `midgame()` resolve, `rewarded()` resolve `false` e o falso nunca é chamado.
  - `rewarded paga só no adFinished`: o falso chama `adFinished` → `true`. Chama `adError({code:'unfilled'})` → `false`.
  - `midgame não trava em erro`: o falso chama só `adError({code:'adCooldown'})` → a promessa resolve.
  - `adblock desliga o 📺`: depois de `adError({code:'adblock'})`, `adsOn()` é `false`.
  - `init que falha não quebra`: `SDK.init` rejeita → `initAds()` resolve e `adsOn()` é `false`.
- [ ] **Step 2: Run** `npx vitest run src/ads.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `ads.ts`, `pauseAudio` e `Root.tsx`. O `Root` mostra `null` até o `initAds()` resolver. Na Vercel resolve na hora.
- [ ] **Step 4: Run** `npx vitest run`. Expected: PASS.
- [ ] **Step 5: Commit** `git commit -am "Módulo do SDK do CrazyGames (no-op fora dele) e pausa de áudio"`

### Task 5: Ligar os anúncios na interface

**Files:**
- Modify: `src/App.tsx`, `src/Aid.tsx`, `src/EraUp.tsx`, `src/style.css`, `src/en.ts`

**Interfaces:**
- Consumes: `adsOn`, `gameplay`, `midgame`, `rewarded`, `banner`, `CRAZY` (Task 4). `AidCard.onWatch` e `EraUp.onContinue` (Task 3).

Comportamento:
- **gameplay:** um efeito no `App`: `gameplay(screen === 'game' && !state.over && eraUp === null && !card && !aidShown)`.
- **Era (solo):** `onContinue = () => midgame().then(() => setEraUp(null))`.
- **Fim de partida (solo e online):** um efeito chama `midgame()` uma vez quando `state.over` passa de `null` para valor. Dentro do `.over`, abaixo do cartão, um `<div id="ad-over" className="adslot">` com `banner('ad-over')` ao montar.
- **Rewarded:** `onWatch = adsOn() ? () => rewarded().then(ok => ok ? act(() => takeAid(state, aid, 'ad'), 'card', ['aid_taken', { kind, pay: 'ad' }]) : setToast(t('Vídeo indisponível.'))) : null`. Mesmo esquema no botão de evento.
- **Menu inicial (só com `adsOn()`):** `#ad-menu-bottom` fixo no rodapé (desktop 728×90, celular 320×50). `#ad-menu-side` à esquerda, só com `matchMedia('(min-width: 1100px)')`. Os slots só existem no DOM quando visíveis, porque o SDK falha com `notVisible`. Limpar ao sair do menu.
- **Aviso de privacidade (só `CRAZY`):** uma linha `.muted` no menu: `t('Usamos métricas anônimas para melhorar o jogo.')`.
- CSS `.adslot`: centralizado, `max-width: 100%`, altura reservada (90 px desktop / 50 px celular). O `.title` do menu ganha `padding-bottom` igual, para os botões nunca ficarem embaixo do banner.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify local com o SDK em modo `local`:** `NEXT_PUBLIC_CRAZY=1 NEXT_PUBLIC_CRAZY_ADS=1 npm run dev` e abrir `http://localhost:3000/?useLocalSdk=true`. Expected: o SDK mostra o texto de anúncio falso. Conferir:
  - "Continuar" da era → midgame falso e depois o jogo.
  - Oferta → 📺 → a recompensa entra.
  - Fim de partida → midgame + banner.
  - Menu → banners (lateral só em ≥ 1100 px).
  - A 390×844 nenhum banner cobre botão.
- [ ] **Step 3: Verify sem variáveis:** `npm run dev` puro. Nenhum slot, nenhum script do SDK na aba Network, nenhum 📺.
- [ ] **Step 4: Commit** `git commit -am "Anúncios do CrazyGames: midgame na era e no fim, rewarded nas ajudas, banners no menu e no fim"`

### Task 6: API por URL absoluta, CORS e convite pelo SDK

**Files:**
- Modify: `src/net.ts:24-34`, `src/usePresence.ts:19`
- Modify: `src/Lobby.tsx:11,41`, `src/App.tsx:126-128` (`URL_MATCH`, `clearUrl`)
- Modify: `next.config.ts`

**Interfaces:**
- Consumes: `inviteUrl`, `inviteParam`, `CRAZY` (Task 4).
- Produces: `export const API = process.env.NEXT_PUBLIC_API_BASE ?? ''` em `net.ts`. Toda chamada `fetch` usa `${API}/api/...`.

Comportamento:
- `Lobby`: o link mostrado e copiado vem de `inviteUrl(id)` (guardado em estado, porque pode ser assíncrono). Com `CRAZY`, não usar `history.replaceState`.
- `App`: `URL_MATCH = () => inviteParam()`. Com `CRAZY`, `clearUrl` é no-op.
- `next.config.ts` (só fora do build do CrazyGames): `headers()` para `/api/:path*` com `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET,POST,OPTIONS`, `Access-Control-Allow-Headers: content-type, x-token`. Origem `*` serve porque a API autentica por `x-token`, não por cookie. O preflight `OPTIONS` o Next responde sozinho nas rotas do app router. Conferir no Step 2.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify CORS:** com `npm run dev`, rodar `curl -si -X OPTIONS localhost:3000/api/match -H 'Origin: https://www.crazygames.com' -H 'Access-Control-Request-Method: POST' -H 'Access-Control-Request-Headers: content-type'`. Expected: status 2xx e `access-control-allow-origin: *`. Se o `OPTIONS` não vier 2xx, exportar `OPTIONS` em cada `route.ts` pelo `http.ts`.
- [ ] **Step 3: Verify:** `npx vitest run` passa. Na Vercel (`npm run dev` sem variáveis), criar e entrar numa partida online continua igual, com o link `?match=`.
- [ ] **Step 4: Commit** `git commit -am "API com base configurável, CORS e convite pelo SDK no CrazyGames"`

### Task 7: Build estático do CrazyGames

**Files:**
- Modify: `next.config.ts`
- Modify: `package.json` (script `build:crazy`)
- Modify: `src/Sprite.tsx:5-14`, `src/scene/vox.tsx:40` (caminhos relativos)
- Modify: `.gitignore` (`out/`, `hexaera-crazygames.zip`, e `.superpowers/` na raiz do repo)

**Interfaces:**
- Produces: `npm run build:crazy` → `out/` + `hexaera-crazygames.zip`.

Comportamento:
- `next.config.ts`: com `NEXT_PUBLIC_CRAZY === '1'`, usar `output: 'export'`, `assetPrefix: './'`, `pageExtensions: ['tsx']` (os `route.ts` da API ficam de fora; `page.tsx`/`layout.tsx` entram) e sem `headers()`.
- Assets: `'/ui/atlas*.png'` → `'ui/atlas*.png'`, `'/models/Models.vox'` → `'models/Models.vox'`. A Vercel serve a página na raiz, então os relativos funcionam lá também.
- Script: `"build:crazy": "NEXT_PUBLIC_CRAZY=1 next build && cd out && zip -qr ../hexaera-crazygames.zip ."`. `NEXT_PUBLIC_API_BASE` e `NEXT_PUBLIC_CRAZY_ADS` são passados por quem roda o build.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run** `NEXT_PUBLIC_API_BASE=https://<domínio> npm run build:crazy`. Expected:
  - termina sem erro;
  - `out/index.html` existe;
  - `grep -c '"/_next' out/index.html` dá 0;
  - `ls out/api` não existe;
  - `find out -type f | wc -l` < 1500;
  - `du -sh out` < 50 MB (anotar se passa de 20 MB).
- [ ] **Step 3: Verify servindo de uma subpasta**, como o CrazyGames faz: `mkdir -p /tmp/cg/jogo && cp -r out/* /tmp/cg/jogo/ && npx serve /tmp/cg`. Abrir `http://localhost:3000/jogo/`. Expected: carrega tudo (sprites, modelos 3D, fontes), dá para jogar solo, e o menu mostra o contador "jogando agora" (API da Vercel via CORS).
- [ ] **Step 4: Verify** que `npm run build` normal continua gerando as rotas de API.
- [ ] **Step 5: Commit** `git commit -am "Build estático do CrazyGames (npm run build:crazy)"`

### Task 8: Envio

- [ ] **Step 1:** Fazer o deploy na Vercel (CORS + tela de era + ajudas) **antes** de enviar o zip, porque o build do CrazyGames depende dessa API.
- [ ] **Step 2:** Enviar `hexaera-crazygames.zip` (sem `NEXT_PUBLIC_CRAZY_ADS`) no portal de desenvolvedor do CrazyGames, marcando desktop + celular e retrato + paisagem. Isso é o dono quem faz, com a conta dele.
- [ ] **Step 3:** Quando o CrazyGames liberar o Full Launch: `NEXT_PUBLIC_CRAZY_ADS=1 NEXT_PUBLIC_API_BASE=... npm run build:crazy` e reenviar.
