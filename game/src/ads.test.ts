import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Cbs = { adStarted?: () => void; adFinished?: () => void; adError?: (e: { code: string }) => void }
const sdk = {
  environment: 'crazygames',
  init: vi.fn(async () => {}),
  ad: { requestAd: vi.fn((_t: string, _c: Cbs) => {}) },
  banner: { requestResponsiveBanner: vi.fn(), clearBanner: vi.fn() },
  game: { gameplayStart: vi.fn(), gameplayStop: vi.fn(), inviteLink: vi.fn(), getInviteParam: vi.fn(), settings: { muteAudio: false }, addSettingsChangeListener: vi.fn() },
}

async function load(env: Record<string, string>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v)
  return import('./ads')
}
const ON = { NEXT_PUBLIC_CRAZY: '1', NEXT_PUBLIC_CRAZY_ADS: '1' }

beforeEach(() => {
  vi.clearAllMocks()
  sdk.init.mockImplementation(async () => {})
  Object.assign(globalThis, { window: { CrazyGames: { SDK: sdk } } })
})
afterEach(() => { vi.unstubAllEnvs(); delete (globalThis as { window?: unknown }).window })

describe('ads', () => {
  it('fora do CrazyGames tudo é no-op', async () => {
    const a = await load({ NEXT_PUBLIC_CRAZY: '0' })
    await a.initAds()
    expect(a.adsOn()).toBe(false)
    await a.midgame()
    expect(await a.rewarded()).toBe(false)
    expect(sdk.init).not.toHaveBeenCalled()
    expect(sdk.ad.requestAd).not.toHaveBeenCalled()
  })
  it('rewarded paga só no adFinished', async () => {
    const a = await load(ON)
    await a.initAds()
    sdk.ad.requestAd.mockImplementationOnce((_t, c) => c.adFinished?.())
    expect(await a.rewarded()).toBe(true)
    sdk.ad.requestAd.mockImplementationOnce((_t, c) => c.adError?.({ code: 'unfilled' }))
    expect(await a.rewarded()).toBe(false)
  })
  it('midgame não trava em erro', async () => {
    const a = await load(ON)
    await a.initAds()
    sdk.ad.requestAd.mockImplementationOnce((_t, c) => c.adError?.({ code: 'adCooldown' }))
    await a.midgame()
    expect(a.adsOn()).toBe(true)
  })
  it('adblock desliga o 📺', async () => {
    const a = await load(ON)
    await a.initAds()
    expect(a.adsOn()).toBe(true)
    sdk.ad.requestAd.mockImplementationOnce((_t, c) => c.adError?.({ code: 'adblock' }))
    await a.rewarded()
    expect(a.adsOn()).toBe(false)
  })
  it('init que falha não quebra', async () => {
    const a = await load(ON)
    sdk.init.mockRejectedValueOnce(new Error('x'))
    await a.initAds()
    expect(a.adsOn()).toBe(false)
  })
})
