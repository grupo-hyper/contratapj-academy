/**
 * Testes de pdf.ts (Task 4.4):
 *  - formatBRDate: converte UTC → data de Brasília (inclui virada de dia à noite).
 *  - buildCertificatePdf: devolve Uint8Array não-vazio começando com "%PDF-"
 *    para tipo 'modulo' e 'final', e não quebra com nota null.
 */
import { describe, expect, it } from 'vitest'
import { buildCertificatePdf, formatBRDate } from './pdf'

describe('formatBRDate', () => {
  it('formata um instante de meio-dia UTC como o mesmo dia BR (dd/mm/aaaa)', () => {
    // 2026-08-24T12:00:00Z = 09:00 em Brasília (UTC-3) => mesmo dia 24.
    expect(formatBRDate('2026-08-24T12:00:00Z')).toBe('24/08/2026')
  })

  it('mantém o dia BR quando o UTC é de fim de tarde (ainda mesmo dia)', () => {
    // 2026-08-24T23:00:00Z = 20:00 em Brasília => ainda dia 24.
    expect(formatBRDate('2026-08-24T23:00:00Z')).toBe('24/08/2026')
  })

  it('recua para o dia anterior quando o UTC é logo após a meia-noite', () => {
    // 2026-08-25T01:00:00Z = 22:00 do dia 24 em Brasília => dia 24.
    expect(formatBRDate('2026-08-25T01:00:00Z')).toBe('24/08/2026')
  })
})

describe('buildCertificatePdf', () => {
  const PDF_MAGIC = '%PDF-'

  function startsWithMagic(bytes: Uint8Array): boolean {
    const head = new TextDecoder().decode(bytes.slice(0, 5))
    return head === PDF_MAGIC
  }

  it("gera um PDF válido para tipo 'modulo' com nota", async () => {
    const bytes = await buildCertificatePdf({
      studentName: 'Ana Silva',
      tipo: 'modulo',
      moduleTitle: 'Prospecção Ativa',
      nota: 90,
      codigoVerificacao: 'ABCD1234',
      issuedAtISO: '2026-08-24T12:00:00Z',
    })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
    expect(startsWithMagic(bytes)).toBe(true)
  })

  it("gera um PDF válido para tipo 'final'", async () => {
    const bytes = await buildCertificatePdf({
      studentName: 'Ana Silva',
      tipo: 'final',
      moduleTitle: null,
      nota: 88,
      codigoVerificacao: 'FINALCODE',
      issuedAtISO: '2026-08-24T12:00:00Z',
    })
    expect(startsWithMagic(bytes)).toBe(true)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('não quebra com nota null', async () => {
    const bytes = await buildCertificatePdf({
      studentName: 'Ana Silva',
      tipo: 'final',
      moduleTitle: null,
      nota: null,
      codigoVerificacao: 'NONOTA',
      issuedAtISO: '2026-08-24T12:00:00Z',
    })
    expect(startsWithMagic(bytes)).toBe(true)
  })
})
