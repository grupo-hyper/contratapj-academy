import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import tailwindConfig from '../../tailwind.config.ts'
import { cpjColors } from './tokens'

describe('ContrataPJ theme tokens', () => {
  it('exposes the five brand tokens as the source of truth', () => {
    expect(cpjColors).toEqual({
      bg: '#0a0a0c',
      navy: '#1C265E',
      royal: '#4259DF',
      coral: '#DE5968',
      white: '#f4f6ff',
    })
  })

  it('wires the Tailwind config cpj namespace to the token values (no drift)', () => {
    // Guards the token -> Tailwind linkage: the generated `bg-cpj-*` / `text-cpj-*`
    // utilities emit exactly these hex values.
    const colors = tailwindConfig.theme?.extend?.colors as
      | { cpj?: typeof cpjColors }
      | undefined
    const cpj = colors?.cpj
    expect(cpj).toEqual(cpjColors)
    expect(cpj?.bg).toBe('#0a0a0c')
  })

  it('applies the bg-cpj-bg utility class on a rendered element', () => {
    const { container } = render(<div className="bg-cpj-bg text-cpj-white" />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveClass('bg-cpj-bg')
    expect(el).toHaveClass('text-cpj-white')
  })
})
