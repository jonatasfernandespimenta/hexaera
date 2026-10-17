import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { RES } from './core/data'
import { Icons } from './Sprite'

const html = (text: string) => renderToStaticMarkup(createElement(Icons, { text }))

describe('Icons', () => {
  it('troca emoji conhecidos (com ou sem U+FE0F) por sprite e mantém o resto', () => {
    const out = html('+2 ☁️ e 3 ❤️ · 1 ✋ 🎲')
    expect(out.match(/class="sprite"/g)).toHaveLength(3)
    expect(out).not.toMatch(/[☁❤✋️]/u)
    expect(out).toContain('+2 ')
    expect(out).toContain('🎲') // sem sprite: continua emoji
  })
  it('cobre o ícone de todo recurso', () => {
    for (const r of Object.values(RES)) expect(html(r.icon), r.name).toContain('class="sprite"')
  })
})
