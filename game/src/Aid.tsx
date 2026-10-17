import type { Aid } from './core/aid'
import { RES } from './core/data'
import type { State } from './core/game'
import { RES_SPRITE, Icons, Sprite } from './Sprite'
import { t } from './i18n'

// Oferta de ajuda de crise (fome ou Centro caindo). onWatch null = sem 📺.
export function AidCard({ aid, state, onBuy, onWatch, onSkip }: { aid: Aid; state: State; onBuy: () => void; onWatch: (() => void) | null; onSkip: () => void }) {
  const center = aid.kind === 'center'
  return (
    <div className="stage">
      <div className="pcard event">
        <header className="red">{t('Ajuda de crise')}</header>
        <div className="art forest"><Sprite name={center ? 'heart' : RES_SPRITE.food} size={90} /></div>
        <h4>{t(center ? 'O Centro está caindo' : 'Sua gente vai passar fome')}</h4>
        <p><Icons text={center ? `+${aid.hp} ❤️ · +${aid.actions} ✋` : `+${aid.food} ${RES.food.icon}`} /></p>
        <button className="opt green" disabled={state.res.money < aid.price} onClick={onBuy}><b><Icons text={t('Comprar por {0} 💰', aid.price)} /></b></button>
        {onWatch && <button className="opt green" onClick={onWatch}><b><Icons text={t('📺 Assistir')} /></b></button>}
        <button className="opt dark" onClick={onSkip}><b>{t('Recusar')}</b></button>
      </div>
    </div>
  )
}
