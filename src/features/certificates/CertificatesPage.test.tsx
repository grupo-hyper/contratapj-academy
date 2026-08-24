/**
 * Teste de aceite da CertificatesPage (Task 4.4): renderiza a lista (final +
 * módulo), o estado vazio, e o download (clicar "Baixar PDF" chama
 * buildCertificatePdf + downloadPdf com o filename esperado).
 *
 * Estratégia: mockamos a CAMADA DE DADOS (`useCertificates`), o `pdf` (build +
 * download) e o `useAuth`, renderizando a COMPOSIÇÃO real. Sem rede/Supabase/PDF
 * real — mesma tática de QuizPage.test.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { Certificate } from '../../types/content'

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'ana@contratapj.com.br' },
    profile: { id: 'user-1', nome: 'Ana', role: 'aluno', avatar_url: null },
    loading: false,
    signOut: vi.fn(),
  }),
}))

const useCertificatesMock = vi.fn()
vi.mock('./useCertificates', () => ({
  useCertificates: (...a: unknown[]) => useCertificatesMock(...a),
}))

const buildCertificatePdfMock = vi.fn()
const downloadPdfMock = vi.fn()
vi.mock('./pdf', async () => {
  const actual = await vi.importActual<typeof import('./pdf')>('./pdf')
  return {
    // formatBRDate real (puro) para a linha exibir a data; build/download mockados.
    formatBRDate: actual.formatBRDate,
    buildCertificatePdf: (...a: unknown[]) => buildCertificatePdfMock(...a),
    downloadPdf: (...a: unknown[]) => downloadPdfMock(...a),
  }
})

import { CertificatesPage } from './CertificatesPage'

const finalCert: Certificate = {
  id: 'cf',
  profile_id: 'user-1',
  tipo: 'final',
  module_id: null,
  nota: 88,
  codigo_verificacao: 'FINALCODE',
  created_at: '2026-08-24T12:00:00Z',
}
const moduleCert: Certificate = {
  id: 'cm',
  profile_id: 'user-1',
  tipo: 'modulo',
  module_id: 'm1',
  nota: 90,
  codigo_verificacao: 'MODCODE',
  created_at: '2026-08-01T12:00:00Z',
}

function setHook(overrides: Record<string, unknown> = {}) {
  useCertificatesMock.mockReturnValue({
    certificates: [],
    moduleTitleById: {},
    moduleOrderById: {},
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/certificados']}>
      <CertificatesPage />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('CertificatesPage', () => {
  it('mostra o estado vazio quando não há certificados', () => {
    setHook({ certificates: [] })
    renderPage()
    expect(
      screen.getByText(/você ainda não tem certificados/i),
    ).toBeInTheDocument()
  })

  it('lista o certificado final e o de módulo (com título resolvido)', () => {
    setHook({
      certificates: [moduleCert, finalCert],
      moduleTitleById: { m1: 'Prospecção Ativa' },
      moduleOrderById: { m1: 1 },
    })
    renderPage()
    expect(screen.getByText('Certificado final')).toBeInTheDocument()
    expect(screen.getByText('Prospecção Ativa')).toBeInTheDocument()
    // Código de verificação renderizado.
    expect(screen.getByText(/FINALCODE/)).toBeInTheDocument()
    expect(screen.getByText(/MODCODE/)).toBeInTheDocument()
  })

  it('clicar "Baixar PDF" chama buildCertificatePdf + downloadPdf com o filename esperado', async () => {
    const fakeBytes = new Uint8Array([1, 2, 3])
    buildCertificatePdfMock.mockResolvedValue(fakeBytes)
    setHook({
      certificates: [finalCert],
      moduleTitleById: {},
      moduleOrderById: {},
    })
    renderPage()

    const btn = screen.getByRole('button', { name: /baixar pdf do certificado final/i })
    fireEvent.click(btn)

    await waitFor(() =>
      expect(buildCertificatePdfMock).toHaveBeenCalledTimes(1),
    )
    // Build recebe os dados do cert final + nome do aluno.
    expect(buildCertificatePdfMock).toHaveBeenCalledWith(
      expect.objectContaining({
        studentName: 'Ana',
        tipo: 'final',
        nota: 88,
        codigoVerificacao: 'FINALCODE',
        issuedAtISO: '2026-08-24T12:00:00Z',
      }),
    )
    await waitFor(() => expect(downloadPdfMock).toHaveBeenCalledTimes(1))
    expect(downloadPdfMock).toHaveBeenCalledWith(
      fakeBytes,
      'certificado-final-FINALCODE.pdf',
    )
  })
})
