# Multiplayer online (Coop e Versus) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dois jogadores, pela internet e ao mesmo tempo, jogam Hexaera em coop ou versus num mapa compartilhado, com turnos simultâneos.

**Architecture:** O jogo migra de Vite para Next.js (App Router) em `game/`. Cada navegador continua rodando as regras puras de `src/core/` para a **própria** cidade. O servidor (route handlers do Next + Upstash Redis) é um armazenamento fino e autenticado: cada jogador grava só o próprio registro (turno enviado, estado, comitivas enviadas). O fechamento do turno é derivado: o turno T fecha quando os dois registros têm `turn >= T`. O cliente descobre isso por polling e aplica as chegadas do rival antes de rodar `endTurn`.

**Tech Stack:** TypeScript, React 19, React Three Fiber, Next.js (App Router), `@upstash/redis`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-multiplayer-design.md`

## Global Constraints

- Até **2 jogadores** por partida; sem cadastro (apelido + token secreto por partida no `localStorage`).
- Turno **compartilhado e simultâneo**; polling a cada **~1,5 s** só enquanto espera o outro.
- Cada cliente é dono da própria cidade; o servidor confia (sem anti-trapaça).
- Centros a **10 hex** de distância (`RIVAL_DISTANCE = 10`); hexes perto da linha do meio são **fronteira neutra** (não exploráveis).
- Tropa: custa **1 👤** de vez, come **1 🍖/turno**, não ocupa moradia. Exército de N tropas chega como **N invasores** com a força `THREATS[era do atacante]`. Atacantes não voltam.
- Exércitos: **2 hex/turno** no ritmo rápido; ritmo normal usa a tabela do vault (`[1, 2, 3, 3, 6, 6, 6]` hex/turno por era).
- Versus: vence quem derrubar o Centro do outro (❤️ 0 ou 👤 0). Marco Final **não** encerra o versus. **Sem** invasões aleatórias e **sem** cartas de evento com `warn` ou `destroy`.
- Coop: se qualquer Centro cair, os dois perdem. Metas de era **compartilhadas**: 📚 e 👤 **somados** das duas cidades contra o **dobro** da meta; construção-marco em qualquer cidade. A dupla avança junta (os dois votam no mesmo turno). Vitória = concluir o Marco Final.
- Ritmo rápido (padrão do versus, opcional no coop): mira **7 eras em ~60–80 turnos**.
- Sem dependências novas além de `next` e `@upstash/redis`. Textos de interface em **português**.
- Partidas expiram do Redis **30 dias** após a última escrita.

## Review Focus

- Jogador fecha a aba **depois** de enviar o turno e **antes** de subir o estado pós-`endTurn` → ao voltar, o jogo termina aquele turno (chegadas aplicadas uma única vez), sem pular nem repetir. Teste em Task 7.
- Os dois apertam "Fim do turno" no mesmo instante → nenhuma submissão se perde. Teste em Task 6.
- Uma terceira pessoa abre o link de uma partida cheia → recebe "Partida cheia" e nenhum assento é sobrescrito. Teste em Task 6.
- Save local antigo (sem os campos novos `troops`, `away`, `raids`) é carregado pelo Continuar → abre normalmente com os campos zerados. Teste em Task 2.
- Exército chega quando o defensor só revelou o Centro → os invasores surgem num hex válido, ao lado do Centro, e o atacam. Teste em Task 4.

---

### Task 0: Coordenar com a outra sessão

**Files:** nenhum.

- [ ] **Step 1:** Rodar `git -C .. status --short`. Se houver mudanças não commitadas em `game/` (hoje: o Sandbox da sessão `hexaera-ed` em `App.tsx`, `core/game.ts`, `core/game.test.ts`, `style.css`), mandar mensagem para a sessão `hexaera-ed` (`ListAgents` → `SendMessage`) perguntando quando o Sandbox será commitado. Não começar a Task 1 com a árvore suja.
- [ ] **Step 2:** Com a árvore limpa, criar a branch: `git checkout -b multiplayer`.

---

### Task 1: Migrar o jogo de Vite para Next.js

**Files:**
- Create: `game/app/layout.tsx`, `game/app/page.tsx`, `game/next.config.ts`, `game/vercel.json`, `game/vitest.config.ts`
- Create: `game/src/Root.tsx` (conteúdo atual de `src/main.tsx`, como componente)
- Delete: `game/index.html`, `game/vite.config.ts`, `game/src/main.tsx`
- Modify: `game/package.json`, `game/tsconfig.json`, `game/src/App.tsx` (`import.meta.env.DEV`)

**Interfaces:**
- Produces: `export function Root(): JSX.Element` em `src/Root.tsx` (escolhe `<Catalog>` em dev com `?catalog`, senão `<App>`); `app/page.tsx` o carrega com `next/dynamic` e `ssr: false`.

- [ ] **Step 1:** `npm i next@latest` e `npm rm vite @vitejs/plugin-react`. Scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start"`; `test` e `playtest` iguais.
- [ ] **Step 2:** `vitest.config.ts` com `defineConfig({ test: { include: ['src/**/*.test.ts'] } })` (de `vitest/config`), para o Vitest não depender do `vite.config.ts` removido.
- [ ] **Step 3:** `app/layout.tsx`: `<html lang="pt-BR">`, `<title>Hexaera</title>`, viewport, e o `<link>` da fonte Tiny5 do Google Fonts (copiar do `index.html` atual); importa `../src/style.css`. Os estilos assumem `#root`: o `<body>` renderiza `<div id="root">{children}</div>`.
- [ ] **Step 4:** `app/page.tsx` com `'use client'` e `const Root = dynamic(() => import('../src/Root').then(m => m.Root), { ssr: false })`.
- [ ] **Step 5:** Trocar `import.meta.env.DEV` por `process.env.NODE_ENV === 'development'` em `App.tsx` e `Root.tsx`. `tsconfig.json`: remover `"types": ["vite/client"]` e deixar o `next build` completar o resto (plugin, `next-env.d.ts`, `include`).
- [ ] **Step 6:** `vercel.json` com `{ "framework": "nextjs" }` (o projeto Vercel está configurado como Vite).
- [ ] **Step 7:** Verificar: `npm test` (todos passam), `npm run build` (sem erro), `npm run dev` e abrir `http://localhost:3000`. Esperado: menu inicial com o tabuleiro 3D ao fundo, tutorial funcionando, `/?catalog` em dev.
- [ ] **Step 8:** Commit `chore: migra o jogo de Vite para Next.js`.

---

### Task 2: Partida no core (contexto, fronteira neutra, ritmo, versus sem ameaças)

**Files:**
- Create: `game/src/core/match.ts`, `game/src/core/match.test.ts`
- Modify: `game/src/core/game.ts` (`State`, `hiddenHexes`, `explore`, `eligible`, `warn`), `game/src/App.tsx` (`loadSave` passa por `normalize`)

**Interfaces:**
- Produces (em `match.ts`):
  - `type Mode = 'coop' | 'versus'`
  - `type MatchInfo = { mode: Mode; seat: 0 | 1; fast: boolean; rival: Hex }`. `rival` = Centro do outro em coordenadas **locais**: `{ q: 10, r: 0 }` para o assento 0 e `{ q: -10, r: 0 }` para o 1.
  - `const RIVAL_DISTANCE = 10`
  - `newMatchGame(seed: number, mode: Mode, seat: 0 | 1, fast: boolean): State`: seed da cidade = `seed + seat`.
  - `neutral(s: State, h: Hex): boolean`: `true` se `s.match` e `distance(h) >= distance(h, s.match.rival) - 2`.
  - `normalize(s: State): State`: preenche campos ausentes de saves antigos (`troops: 0`, `away: []`, `raids: []`).
- Produces (em `State`): `match?: MatchInfo`, `troops: number`, `away: { n: number; back: number }[]`, `raids: { at: string; kind: number; n: number }[]`. Os três últimos são usados nas Tasks 3 e 4; criar já zerados em `newGame`.

- [ ] **Step 1: Testes que falham** (`match.test.ts`):

```ts
test('fronteira neutra: assento 0 não explora rumo ao rival', () => {
  const s = newMatchGame(5, 'versus', 0, true)
  expect(neutral(s, { q: 3, r: 0 })).toBe(false)
  expect(neutral(s, { q: 4, r: 0 })).toBe(true)
  expect(neutral(s, { q: -6, r: 0 })).toBe(false)
  expect(hiddenHexes(s).some(h => neutral(s, h))).toBe(false)
})
test('assentos têm mapas diferentes e rivais espelhados', () => {
  const a = newMatchGame(5, 'coop', 0, false), b = newMatchGame(5, 'coop', 1, false)
  expect(a.seed).not.toBe(b.seed)
  expect(a.match!.rival).toEqual({ q: 10, r: 0 })
  expect(b.match!.rival).toEqual({ q: -10, r: 0 })
})
test('versus: sem invasões aleatórias nem cartas de ataque/destruição', () => {
  let s = newMatchGame(5, 'versus', 0, true)
  const drawn: string[] = []
  for (let i = 0; i < 120; i++) { s = endTurn(s); if (s.event) { drawn.push(s.event); s = resolveEvent(s, 1) } }
  expect(s.warnings).toEqual([])
  expect(drawn.every(id => !EVENT_BY_ID[id].options.some(o => o.effect.warn || o.effect.destroy))).toBe(true)
})
test('ritmo rápido reduz metas; coop normal não', () => {
  expect(eraGoals(newMatchGame(5, 'versus', 0, true))[0].need).toBeLessThan(ERAS[0].goal.knowledge)
  expect(eraGoals(newMatchGame(5, 'coop', 0, false))[0].need).toBe(ERAS[0].goal.knowledge * 2)
})
test('save antigo sem campos novos é normalizado', () => {
  const old: any = newGame(1); delete old.troops; delete old.away; delete old.raids
  const s = normalize(old)
  expect([s.troops, s.away, s.raids]).toEqual([0, [], []])
})
```

O teste do coop (`* 2`) só passa depois da Task 5. Marque-o com `test.todo` aqui e ative-o na Task 5.

- [ ] **Step 2:** `npx vitest run src/core/match.test.ts` → FAIL (módulo inexistente).
- [ ] **Step 3: Implementar.**
  - `newMatchGame` chama `newGame(seed + seat)` **sem** `opts` (que marcaria `sandbox`) e depois atribui `s.match` e `s.opts = { threats: mode === 'versus' ? 0 : 1, abundance: fast ? 2 : 1, pace: fast ? 0.4 : 1, market: 'volatil', era: 0 }`. `abundance` e `pace` são valores iniciais; a Task 11 calibra.
  - Atualizar o comentário de `opts` em `State` ("Sandbox ou partida online").
  - `hiddenHexes` filtra `neutral`; `explore` lança `'Fronteira neutra.'`.
  - `eligible` devolve `false` para cartas com opção `warn`/`destroy` quando `s.match?.mode === 'versus'`. `warn()` já é zerado por `opts.threats = 0`; confirme no teste.
- [ ] **Step 4:** `npx vitest run` → PASS (exceto o `todo`).
- [ ] **Step 5:** Em `App.tsx`, `loadSave` devolve `normalize(...)`. Commit `feat(core): partida online, fronteira neutra e ritmo`.

---

### Task 3: Tropas e Campo de guerra

**Files:**
- Modify: `game/src/core/data.ts` (nova construção `warcamp`, `TROOP_COST`), `game/src/core/game.ts` (`recruit`, consumo, defesa no `threats()`), `game/src/core/match.test.ts`

**Interfaces:**
- Produces: `BuildingId` ganha `'warcamp'`: `{ name: 'Campo de guerra', cat: 'defesa', era: 1, terrains: OPEN, workers: 1, … }` (custo e tempo a critério, na escala do Quartel). `TROOP_COST: Bag = { food: 4, money: 6 }`. `recruit(prev: State): State`: custa `TROOP_COST`, **1 ✋**, 1 👤; exige `s.match` e um `warcamp` pronto e com trabalhador (`staffed`).
- O card do `warcamp` só aparece na mão quando `state.match` existe (filtro em `App.tsx`, `builds`).

- [ ] **Step 1: Testes que falham:**

```ts
test('recrutar: −1 👤, +1 tropa, custa TROOP_COST e 1 ✋', () => { /* monta s com warcamp pronto (helper put de game.test.ts), recursos e ✋ */
  const t = recruit(s)
  expect([t.pop, t.troops, t.actions]).toEqual([s.pop - 1, 1, s.actions - 1])
  expect(t.res.money).toBe(s.res.money - TROOP_COST.money!)
})
test('recrutar exige Campo de guerra e deixa ao menos 1 👤', () => {
  expect(() => recruit(semCampo)).toThrow()
  expect(() => recruit({ ...comCampo, pop: 1 })).toThrow()
})
test('fora de partida online não recruta', () => expect(() => recruit(solo)).toThrow())
test('tropas comem 1 🍖 por turno', () => expect(endTurn(com3Tropas).res.food).toBe(endTurn(sem).res.food - 3))
test('tropa em casa absorve o golpe no Centro e morre', () => {
  // invasor encostado no Centro (distance 1), troops = 2
  const t = endTurn(s)
  expect(t.centerHp).toBe(s.centerHp) // sem dano e sem regen (invasor encostado)
  expect(t.troops).toBe(1)
})
```

- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3: Implementar.**
  - `recruit` segue o padrão de `build`: `guard`, mensagens em português, `structuredClone`.
  - Consumo: somar `s.troops` ao que `eaten()` devolve.
  - Defesa (decisão do plano): no laço de invasores de `threats()`, quando o invasor atacaria o Centro e `s.troops > 0`, faz `s.troops -= 1` e loga `🛡 Uma tropa caiu defendendo o Centro.` no lugar do dano.
- [ ] **Step 4:** Rodar → PASS. Commit `feat(core): tropas e Campo de guerra`.

---

### Task 4: Comitivas (exército, ajuda, carga) e chegadas

**Files:**
- Create: `game/src/core/convoy.ts`, `game/src/core/convoy.test.ts`
- Modify: `game/src/core/game.ts` (`idle` desconta ausentes; `endTurn` converte `raids` em invasores e devolve ausentes)

**Interfaces:**
- Produces (em `convoy.ts`):
  - `type Convoy = { id: string; kind: 'army' | 'aid' | 'cargo'; sent: number; arrive: number; n?: number; power?: number; bag?: Bag }`. `id` = `` `${seat}-${turn}-${i}` ``; `power` = índice em `THREATS` (era do remetente).
  - `travelTurns(s: State): number` = `Math.ceil(RIVAL_DISTANCE / (s.match!.fast ? 2 : SPEED[s.era]))` com `SPEED = [1, 2, 3, 3, 6, 6, 6]`.
  - `CARGO_PER_WORKER = [5, 8, 15, 15, 1e9, 1e9, 1e9]` (tabela do vault; "ilimitada" = 1e9).
  - `sendArmy(s: State, n: number): { state: State; convoy: Convoy }`: só no versus; tira `n` de `troops`.
  - `sendAid(s: State, n: number): { state: State; convoy: Convoy }`: só no coop; tira `n` de `troops`.
  - `sendCargo(s: State, bag: Bag): { state: State; convoy: Convoy }`: só no coop; tira `bag` do estoque. Carregadores = `ceil(total / CARGO_PER_WORKER[era])`, que precisam ser ≤ `idle(s)`. Faz `away.push({ n, back: s.turn + 2 * travelTurns(s) })`.
  - `receive(s: State, arrivals: Convoy[]): State`: `army` → `raids.push({ at, kind: power, n })` + log `⚠️ Exército inimigo chega no próximo turno!`; `aid` → `troops += n`; `cargo` → soma `bag` ao estoque.
  - `raidHex(s: State): string`: o hex revelado (≠ `'0,0'`) mais perto de `s.match.rival`. Se só o Centro está revelado, revela o vizinho do Centro mais perto do rival (`terrainAt`) e o devolve.
- Em `endTurn`, logo depois de converter `warnings` em invasores: cada `raid` vira `n` invasores com `THREATS[kind]` no hex `at`. Depois, `raids = []` e o filtro `away = away.filter(a => a.back > s.turn)`. `idle()` desconta `sum(away.n)`.

- [ ] **Step 1: Testes que falham:**

```ts
test('exército: sai das tropas e chega em 5 turnos no ritmo rápido', () => {
  const { state, convoy } = sendArmy(vs(3 /* tropas */), 2)
  expect(state.troops).toBe(1)
  expect(convoy.arrive - convoy.sent).toBe(5)
})
test('chegada vira aviso e, no turno seguinte, N invasores com a força do atacante', () => {
  const d = receive(defensor, [{ id: '0-3-0', kind: 'army', sent: 3, arrive: 8, n: 3, power: 2 }])
  expect(d.raids).toHaveLength(1)
  const t = endTurn(d)
  expect(t.invaders.filter(i => i.kind === 2)).toHaveLength(3)
  expect(t.raids).toEqual([])
})
test('defensor só com o Centro: invasores surgem ao lado do Centro', () => {
  const d = receive(newMatchGame(9, 'versus', 1, true), [army])
  expect(distance(parse(d.raids[0].at))).toBe(1)
  expect(d.tiles[d.raids[0].at]).toBeDefined()
})
test('carga: carregadores ficam ausentes (sem ✋) e voltam', () => {
  const { state, convoy } = sendCargo(coop, { wood: 10 })
  expect(idle(state)).toBe(idle(coop) - 2) // 10 / 5 na Primitiva
  expect(receive(parceiro, [convoy]).res.wood).toBe(parceiro.res.wood + 10)
  let s = state; while (s.turn < state.away[0].back) s = endTurn(s)
  expect(s.away).toEqual([])
})
test('sendArmy no coop e sendAid no versus lançam erro', () => { /* … */ })
```

- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar. **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat(core): comitivas entre cidades`.

---

### Task 5: Resultado da partida e metas compartilhadas do coop

**Files:**
- Modify: `game/src/core/game.ts` (`eraGoals`, `advanceEra`), `game/src/core/match.ts` (`settle`), `game/src/core/match.test.ts` (ativar o `todo` da Task 2)

**Interfaces:**
- Produces:
  - `eraGoals(s: State, partner?: State | null)`: no coop, `need = round(meta * pace * 2)`; `have` soma 📚/👤 do `partner` (0 se `null`); a construção conta em qualquer uma das cidades. Fora do coop, ignora `partner`.
  - `advanceEra(prev: State, force = false)`: com `force`, pula a checagem de metas (o voto da dupla já validou).
  - `settle(s: State, rival: State | null): State`: versus → se `rival?.over === 'lost'`, `over = 'won'`; se o próprio perdeu, mantém. Coop → se `rival?.over === 'lost'`, `over = 'lost'`; se `rival?.over === 'won'` e `s` está na última era, `over = 'won'`. Marco Final no versus **não** dá `won` (em `advanceEra`, na última era com `s.match?.mode === 'versus'`, lança `'No versus, vence quem derrubar o outro Centro.'`).

- [ ] **Step 1: Testes que falham:** coop soma metas com o parceiro e trata `partner = null`; `force` avança sem metas; versus: rival `lost` → `won`; coop: rival `lost` → `lost`; versus na última era não vence pelo Marco Final.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar. **Step 4:** Rodar → PASS. Commit `feat(core): vitória, derrota e metas compartilhadas`.

---

### Task 6: Servidor: armazenamento e API da partida

**Files:**
- Create: `game/src/server/store.ts`, `game/src/server/matches.ts`, `game/src/server/matches.test.ts`
- Create: `game/app/api/match/route.ts` (POST criar), `game/app/api/match/[id]/route.ts` (GET ver), `game/app/api/match/[id]/join/route.ts` (POST), `game/app/api/match/[id]/turn/route.ts` (POST enviar turno), `game/app/api/match/[id]/state/route.ts` (PUT estado)

**Interfaces:**
- `store.ts`: `type Store = { get<T>(k: string): Promise<T | null>; set(k: string, v: unknown): Promise<void>; setnx(k: string, v: unknown): Promise<boolean> }`. `memoryStore(): Store` (testes) e `redisStore(): Store` (`Redis.fromEnv()` do `@upstash/redis`; `set` com `{ ex: 30 * 86400 }`). A rota usa `redisStore()`.
- `matches.ts` (lógica pura sobre `Store`, testável):
  - `type Meta = { id: string; mode: Mode; fast: boolean; timer: number; seed: number; names: [string, string | null] }`
  - `type SeatRec = { token: string; turn: number /* último turno enviado, 0 = nenhum */; state: State | null; sent: Convoy[]; votes: number[] /* turnos com voto de avançar era */; seen: number /* Date.now() */ }`
  - `createMatch(st, { mode, fast, timer, name }): Promise<{ id: string; seat: 0; token: string }>`: `id` com 6 caracteres `[a-z0-9]`, `token` = `crypto.randomUUID()`.
  - `joinMatch(st, id, name): Promise<{ seat: 1; token: string }>`: usa `setnx` em `m:{id}:s1`. Se já existe, lança `HttpError(409, 'Partida cheia.')`.
  - `viewMatch(st, id, token): Promise<{ meta: Meta; seat: 0 | 1; me: SeatRec; rival: (Omit<SeatRec, 'token'> & { online: boolean }) | null }>`: atualiza `me.seen`; `online` = `seen` nos últimos 10 s.
  - `submitTurn(st, id, token, { turn, sent, vote }): Promise<void>`: exige `turn === me.turn + 1` (senão `HttpError(409)`); grava `turn`, anexa `sent`, registra o voto.
  - `putState(st, id, token, state): Promise<void>`.
  - Chaves: `m:{id}` (Meta), `m:{id}:s0`, `m:{id}:s1`. Cada jogador só escreve a **própria** chave de assento: não há corrida entre os dois.
- As rotas são finas: leem o JSON e chamam `matches.ts`. `HttpError` vira `Response.json({ error }, { status })`. Token inválido → 403.

- [ ] **Step 1: Testes que falham** (`matches.test.ts`, com `memoryStore()`):

```ts
test('criar e entrar dá assentos 0 e 1', …)
test('terceiro jogador recebe 409 e o assento 1 não muda', async () => {
  await expect(joinMatch(st, id, 'Zé')).rejects.toMatchObject({ status: 409 })
  expect((await viewMatch(st, id, t1)).seat).toBe(1)
})
test('envios simultâneos dos dois não se perdem', async () => {
  await Promise.all([submitTurn(st, id, t0, { turn: 1, sent: [a], vote: false }), submitTurn(st, id, t1, { turn: 1, sent: [], vote: false })])
  const v = await viewMatch(st, id, t0)
  expect([v.me.turn, v.rival!.turn, v.me.sent]).toEqual([1, 1, [a]])
})
test('turno fora de ordem e token errado são recusados', …)
test('rival sem token na resposta', async () => expect((await viewMatch(st, id, t0)).rival).not.toHaveProperty('token'))
```

- [ ] **Step 2:** Rodar → FAIL. **Step 3:** `npm i @upstash/redis`; implementar `store.ts`, `matches.ts` e as rotas. **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat(server): API de partidas online`.

---

### Task 7: Cliente: sessão online e fechamento de turno

**Files:**
- Create: `game/src/net.ts`, `game/src/online.ts`, `game/src/online.test.ts`

**Interfaces:**
- `net.ts`: wrappers `fetch` das rotas da Task 6 (`create`, `join`, `view`, `submit`, `putState`); erros viram `Error(mensagem do servidor)`. Credenciais por partida no `localStorage` (`hexaera.match.{id}` = `{ seat, token }`, com try/catch como `store` em `App.tsx`).
- `online.ts` (puro, testável):
  - `arrivalsFor(rivalSent: Convoy[], turn: number): Convoy[]`: comitivas com `arrive === turn`.
  - `closeTurn(s: State, rival: { state: State | null; sent: Convoy[]; votes: number[] }, myVote: boolean): State`: aplica `receive(s, arrivalsFor(rival.sent, s.turn))`; se `myVote` e `rival.votes.includes(s.turn)`, chama `advanceEra(…, true)`; então `endTurn`, e por fim `settle(…, rival.state)`.
  - `phase(me: SeatRec, rival: SeatRec | null, local: State): 'lobby' | 'playing' | 'waiting' | 'close'`: `lobby` sem rival; `waiting` se `me.turn === local.turn` e `rival.turn < local.turn`; `close` se os dois `>= local.turn`; senão `playing`.
- Hook `useOnline(id)` em `online.ts` (ou em `App.tsx`): ao entrar, `view`; com `local = normalize(me.state ?? newMatchGame(...))`. Polling a cada 1500 ms enquanto `phase` for `lobby` ou `waiting`. Ao chegar em `close`: `local = closeTurn(...)`, depois `putState`. "Fim do turno" online = `submit({ turn: local.turn, sent: comitivas deste turno, vote })`, sem rodar `endTurn` localmente.

- [ ] **Step 1: Testes que falham:**

```ts
test('chegadas aplicadas uma única vez no turno certo', …)
test('retomar depois de enviar e antes de subir o estado: fecha o turno ao voltar', () => {
  // me.turn === local.turn (enviado), rival.turn >= local.turn → phase 'close'; closeTurn avança 1 turno
  expect(phase(me, rival, local)).toBe('close')
  expect(closeTurn(local, rival, false).turn).toBe(local.turn + 1)
})
test('voto dos dois no mesmo turno avança a era nos dois lados', …)
test('rival perdeu no versus → venci ao fechar o turno', …)
```

- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar. **Step 4:** Rodar → PASS. Commit `feat: sessão online no cliente`.

---

### Task 8: Lobby: "Jogar online" no menu

**Files:**
- Create: `game/src/Lobby.tsx`
- Modify: `game/src/App.tsx` (estado `screen` ganha `'online'`; com `?match=` na URL abre direto na partida), `game/src/style.css`

**Interfaces:** consome `net.ts` e `useOnline`.

- [ ] **Step 1:** Botão "Jogar online" no menu inicial → `Lobby`:
  - **Criar:** Coop/Versus, "Ritmo rápido" (ligado por padrão no versus), relógio (desligado, 60 s, 90 s) e apelido. Ao criar, mostra o link `…/?match={id}` com botão "Copiar" e o texto "Esperando o segundo jogador…".
  - **Entrar:** abrir um link `?match=` sem credencial pede o apelido e chama `join`. "Partida cheia." aparece como aviso, sem sair do menu.
- [ ] **Step 2:** Partidas online **não** usam o save local (`hexaera.save`) nem o tutorial. O efeito de autosave fica desligado quando `state.match` existe.
- [ ] **Step 3:** Verificação manual com `npm run dev` e duas janelas (uma anônima): criar → copiar link → entrar na outra → as duas saem do lobby para o jogo. Para isso, a rota precisa de Redis: usar `vercel env pull` depois da Task 10 ou um `memoryStore` em dev (`process.env.NODE_ENV === 'development'` sem `UPSTASH_REDIS_REST_URL`).
- [ ] **Step 4:** Commit `feat(ui): lobby online`.

---

### Task 9: Interface da partida online

**Files:**
- Create: `game/src/OnlineHud.tsx`
- Modify: `game/src/scene/Board.tsx` (prop `ghost`), `game/src/App.tsx`, `game/src/style.css`

**Interfaces:**
- `Board` ganha `ghost?: boolean`. Com `ghost`, não renderiza `OrbitControls`, luzes, `Table`, `FitCamera`, hexes ocultos, hover nem clique. O App renderiza `<group position={[x, 0, z]}><Board ghost state={rival.state} … /></group>`, com `[x, z]` vindo de `toWorld(state.match.rival)` (mesma convenção de eixos que o Board já usa para os tiles).
- Hexes `neutral` ao redor dos dois Centros desenhados acinzentados. Basta um anel de tiles cinza na faixa entre as cidades.
- Comitivas em trânsito (`me.sent` e `rival.sent` com `sent <= turn < arrive`) desenhadas como um marcador na reta entre os Centros, na fração `(turn - sent) / (arrive - sent)`.
- Aviso de `raids` igual ao de `warnings` no Board (`warnings.includes(k) || raids.some(r => r.at === k)`).

- [ ] **Step 1: `OnlineHud`:**
  - Nome e status do rival (jogando / pronto / desconectado — "Partida pausada").
  - "Fim do turno" vira "Esperando {nome}…" (desabilitado) na fase `waiting`.
  - Contagem do relógio, quando a partida tem timer: ao zerar, envia o turno sozinho.
- [ ] **Step 2: Painel militar** (com `warcamp` pronto): "Tropas: N", "Recrutar" (mostra o `TROOP_COST`) e, no versus, "Atacar com [n]" (`sendArmy`). No coop: "Enviar ajuda [n]" (`sendAid`) e "Enviar carga" (escolher quantidades → `sendCargo`). As comitivas criadas no turno ficam numa lista local enviada no "Fim do turno". Previsão de chegada: "chega no turno X".
- [ ] **Step 3: Metas e telas finais:**
  - Coop: o card de metas mostra os valores somados (`eraGoals(state, rival.state)`); "Avançar era" vira "Votar para avançar" e mostra o voto do parceiro.
  - Fim de jogo, versus: "Vitória — o Centro de {nome} caiu" ou "Derrota — seu Centro caiu".
  - Fim de jogo, coop: "Civilização concluída juntos" ou "Um Centro caiu — a dupla perdeu".
  - Botão "Menu principal".
- [ ] **Step 4:** Verificação manual em duas janelas (versus rápido): recrutar, atacar, ver a coluna andar, o aviso ⚠️ no defensor, os invasores, a vitória. No coop: enviar carga e ver chegar e os carregadores voltarem. Tirar screenshots.
- [ ] **Step 5:** `npm test` e `npm run build` passando. Commit `feat(ui): partida online (rival, comitivas, painel militar)`.

---

### Task 10: Redis na Vercel e deploy

**Files:** nenhum de código.

- [ ] **Step 1:** Instalar o Upstash Redis no projeto `hexaera` (time `cronock`) pelo Vercel Marketplace. **Pede confirmação do usuário**, porque envolve aceitar termos da integração. Ele pode instalar pelo painel, ou o agente roda `vercel integration add upstash` depois do "sim".
- [ ] **Step 2:** Confirmar `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` em Production e Preview (`vercel env ls`); `vercel env pull .env.local` para o dev.
- [ ] **Step 3:** `vercel deploy --prod --scope cronock`. Fazer o smoke test da Task 9 em `https://hexaera.vercel.app` com duas janelas.
- [ ] **Step 4:** Commit de qualquer ajuste; `git push`.

---

### Task 11: Calibrar o ritmo rápido com o bot

**Files:**
- Modify: `game/src/core/bot.ts` (`playGame(seed, maxTurns, start?: State)`), `game/src/core/bot.playtest.ts` (bloco extra para o ritmo rápido), `game/src/core/match.ts` (valores de `abundance`/`pace`)

- [ ] **Step 1:** `playGame` aceita um estado inicial. O playtest roda também `newMatchGame(seed, 'versus', 0, true)` e imprime a mediana de turnos até cada era. O bot não recruta tropas; ele só mede a economia.
- [ ] **Step 2:** `npm run playtest`. Ajustar `abundance`/`pace` (e, se não bastar, encurtar obras pela metade com `match.fast`) até a mediana da Era Contemporânea ficar entre **60 e 80** turnos. Registrar os números finais no commit.
- [ ] **Step 3:** `npm test` passando. Commit `balance: ritmo rápido do multiplayer`.

---

### Task 12: Atualizar o vault

**Files:**
- Modify: `04 Modos de Jogo/Cooperativo.md` (online, turno simultâneo, metas ×2 somadas, o que ficou para depois), `08 Roadmap/Questões em Aberto.md` (coop online; multiplayer agora inclui versus)
- Create: `04 Modos de Jogo/Versus.md` (regras do spec: Campo de guerra, tropas, ataque, defesa, vitória, sem ameaças do solo, ritmo rápido)

- [ ] **Step 1:** Escrever as notas no estilo do vault (frontmatter `tags`/`status`, links `[[...]]`), refletindo o que foi **construído**, incluindo os valores calibrados na Task 11.
- [ ] **Step 2:** Commit `docs(vault): coop online e versus`; `git push`.
