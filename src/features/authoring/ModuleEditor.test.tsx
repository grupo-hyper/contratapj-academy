/**
 * ModuleEditor: edita título/descrição/capa/publicado, mostra "alterações não
 * salvas" quando sujo, chama onSave com o patch normalizado e exibe erro inline.
 * onSave/isSaving/isError vêm por prop (o pai fia o useAuthorMutations).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Module } from '../../types/content'
import { ModuleEditor } from './ModuleEditor'

const module: Module = {
  id: 'm1',
  ordem: 1,
  titulo: 'Fundamentos',
  descricao: null,
  capa_url: null,
  publicado: false,
  created_at: 't',
}

afterEach(() => vi.clearAllMocks())

describe('ModuleEditor', () => {
  it('Salvar começa desabilitado e habilita ao editar', () => {
    render(
      <ModuleEditor
        module={module}
        onSave={vi.fn()}
        isSaving={false}
        isError={false}
        onDirtyChange={vi.fn()}
      />,
    )
    const salvar = screen.getByRole('button', { name: /Salvar/ })
    expect(salvar).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: 'Fundamentos!' },
    })
    expect(salvar).toBeEnabled()
    expect(screen.getByText(/alterações não salvas/i)).toBeInTheDocument()
  })

  it('ao salvar, chama onSave com id e patch normalizado (vazio -> null)', () => {
    const onSave = vi.fn()
    render(
      <ModuleEditor
        module={module}
        onSave={onSave}
        isSaving={false}
        isError={false}
        onDirtyChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText(/Publicado/))
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(onSave).toHaveBeenCalledWith('m1', {
      titulo: 'Fundamentos',
      descricao: null,
      capa_url: null,
      publicado: true,
    })
  })

  it('mostra erro inline quando isError', () => {
    render(
      <ModuleEditor
        module={module}
        onSave={vi.fn()}
        isSaving={false}
        isError
        onDirtyChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/não foi possível salvar/i)).toBeInTheDocument()
  })
})
