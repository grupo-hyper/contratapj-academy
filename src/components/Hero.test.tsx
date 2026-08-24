import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Hero } from './Hero'

describe('Hero', () => {
  it('renderiza título e subtítulo', () => {
    render(
      <Hero
        title="Objeções de preço"
        subtitle="Módulo 4 — aula 2"
        actionLabel="Continuar"
        onAction={() => {}}
      />,
    )
    expect(
      screen.getByRole('heading', { name: 'Objeções de preço' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Módulo 4 — aula 2')).toBeInTheDocument()
  })

  it('dispara onAction no clique do CTA', () => {
    const onAction = vi.fn()
    render(
      <Hero title="Fechamento" actionLabel="Continuar" onAction={onAction} />,
    )
    screen.getByRole('button', { name: /continuar/i }).click()
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})
