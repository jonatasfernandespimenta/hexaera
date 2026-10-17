import { BUILDINGS, ERAS } from './core/data'
import { Sprite } from './Sprite'
import { t } from './i18n'

// Celebração da troca de era (solo): o que a era nova destrava.
export function EraUp({ era, turn, onContinue }: { era: number; turn: number; onContinue: () => void }) {
  const news = Object.entries(BUILDINGS).filter(([id, b]) => b.era === era && id !== 'warcamp').map(([, b]) => b.name) // Acampamento de guerra é só online
  return (
    <div className="stage">
      <div className="pcard event">
        <header className="gold">🎉 {t('Era {0}', ERAS[era].name)}</header>
        <div className="art sky"><Sprite name="star" size={90} /></div>
        <h4>{ERAS[era].center}</h4>
        <p className="muted">{t('Turno {0}', turn)}</p>
        {news.length > 0 && <p><b>{t('Novas construções')}:</b> {news.join(', ')}</p>}
        <button className="opt green" onClick={onContinue}><b>{t('Continuar')}</b></button>
      </div>
    </div>
  )
}
