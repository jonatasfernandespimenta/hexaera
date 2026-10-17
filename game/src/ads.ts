// Fachada do SDK v3 do CrazyGames. Fora do build CrazyGames tudo é no-op; falha do SDK nunca quebra o jogo.
import { pauseAudio } from './sfx'

export const CRAZY = process.env.NEXT_PUBLIC_CRAZY === '1'
const ADS = process.env.NEXT_PUBLIC_CRAZY_ADS === '1'
const INIT_MS = 5000
const START_MS = 5000 // anúncio que nem começa
const CAP_MS = 90000 // teto de um anúncio em andamento
const SRC = 'https://sdk.crazygames.com/crazygames-sdk-v3.js'

type AdCbs = { adStarted?: () => void; adFinished?: () => void; adError?: (e: { code?: string }) => void }
type Sdk = {
  environment: string
  init(): Promise<void>
  ad: { requestAd(type: 'midgame' | 'rewarded', cbs: AdCbs): void }
  banner: { requestResponsiveBanner(id: string): unknown; clearBanner(id: string): void }
  game: {
    gameplayStart(): void
    gameplayStop(): void
    inviteLink(p: { match: string }): string | Promise<string>
    getInviteParam(k: string): string | null
    settings: { muteAudio: boolean }
    addSettingsChangeListener(fn: (s: { muteAudio: boolean }) => void): void
  }
}

let sdk: Sdk | null = null
let blocked = false
let adPlaying = false
let busy = false
let sdkMuted = false
let playing: boolean | null = null

const syncAudio = () => pauseAudio(adPlaying || sdkMuted)
const safe = (fn: () => void) => { try { fn() } catch {} }

let initP: Promise<void> | null = null
export const initAds = (): Promise<void> => (initP ??= CRAZY ? init() : Promise.resolve())

async function init() {
  let late = false // timeout estourou: ignora o que chegar depois
  const run = async () => {
    const w = window as unknown as { CrazyGames?: { SDK: Sdk } }
    if (!w.CrazyGames) {
      await new Promise<void>((ok, no) => {
        const s = document.createElement('script')
        s.src = SRC
        s.onload = () => ok()
        s.onerror = () => no(new Error('sdk'))
        document.head.appendChild(s)
      })
    }
    const s = w.CrazyGames!.SDK
    await s.init()
    if (late) return
    sdk = s
    safe(() => { sdkMuted = s.game.settings.muteAudio; syncAudio() })
    safe(() => s.game.addSettingsChangeListener(v => { sdkMuted = !!v.muteAudio; syncAudio() }))
  }
  let t: ReturnType<typeof setTimeout>
  try {
    await Promise.race([run(), new Promise<void>((_, no) => { t = setTimeout(() => no(new Error('timeout')), INIT_MS) })])
  } catch {
    late = true
    sdk = null
  }
  clearTimeout(t!)
}

export const adsOn = () => CRAZY && ADS && !!sdk && sdk.environment !== 'disabled' && !blocked

export function gameplay(on: boolean) {
  if (!sdk || playing === on || (on && busy)) return
  playing = on
  safe(() => (on ? sdk!.game.gameplayStart() : sdk!.game.gameplayStop()))
}

// Pede um anúncio; resolve true só em adFinished.
function ad(type: 'midgame' | 'rewarded'): Promise<boolean> {
  if (!adsOn() || busy) return Promise.resolve(false)
  busy = true
  return new Promise(done => {
    let over = false
    let t = setTimeout(() => end(false), START_MS)
    const end = (ok: boolean) => {
      if (over) return
      over = true
      clearTimeout(t)
      busy = adPlaying = false
      syncAudio()
      done(ok)
    }
    try {
      sdk!.ad.requestAd(type, {
        adStarted: () => {
          if (over) return
          clearTimeout(t)
          t = setTimeout(() => end(false), CAP_MS)
          adPlaying = true
          syncAudio()
          gameplay(false)
        },
        adFinished: () => end(true),
        adError: e => {
          if (e?.code === 'adblock' || e?.code === 'adsDisabledBasicLaunch') blocked = true
          end(false)
        },
      })
    } catch { end(false) }
  })
}

export const midgame = (): Promise<void> => ad('midgame').then(() => {})
export const rewarded = (): Promise<boolean> => ad('rewarded')

export function banner(id: string): () => void {
  if (!sdk) return () => {}
  const s = sdk
  try { Promise.resolve(s.banner.requestResponsiveBanner(id)).catch(() => {}) } catch {}
  return () => safe(() => s.banner.clearBanner(id))
}

export async function inviteUrl(id: string): Promise<string> {
  if (sdk) { try { return await sdk.game.inviteLink({ match: id }) } catch {} }
  return `${location.origin}/?match=${id}`
}

export function inviteParam(): string | null {
  if (sdk) { try { return sdk.game.getInviteParam('match') } catch {} }
  return new URLSearchParams(location.search).get('match')
}
