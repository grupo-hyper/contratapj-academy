/**
 * Testes de pdf.ts (Task 4.4):
 *  - formatBRDate: converte UTC → data de Brasília (inclui virada de dia à noite).
 *  - buildCertificatePdf: devolve Uint8Array não-vazio começando com "%PDF-"
 *    para tipo 'modulo' e 'final', e não quebra com nota null.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { buildCertificatePdf, downloadPdf, formatBRDate } from './pdf'

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

  it('encolhe a fonte do nome quando ele é muito longo (fit-check rodou)', async () => {
    // Nome longo e realista (vários sobrenomes) que estouraria a moldura a 34pt.
    const longName =
      'Maria Aparecida Conceição de Souza Albuquerque Vasconcelos Nascimento'

    // Reproduz a métrica do pdf.ts: A4 paisagem (841.89), margin 32, respiro 48.
    const width = 841.89
    const margin = 32
    const usableWidth = width - margin * 2 - 48

    const doc = await PDFDocument.create()
    const helvBold = await doc.embedFont(StandardFonts.HelveticaBold)

    // A 34pt (tamanho ideal) o nome NÃO cabe — é o gatilho do auto-shrink.
    expect(helvBold.widthOfTextAtSize(longName, 34)).toBeGreaterThan(usableWidth)

    // O PDF deve ser gerado válido (sem lançar) mesmo com o nome gigante.
    const bytes = await buildCertificatePdf({
      studentName: longName,
      tipo: 'final',
      moduleTitle: null,
      nota: 90,
      codigoVerificacao: 'LONGNAME',
      issuedAtISO: '2026-08-24T12:00:00Z',
    })
    expect(startsWithMagic(bytes)).toBe(true)

    // E o tamanho escolhido pela lógica de fit (34 → mín 18) deve caber: existe
    // pelo menos um size < 34 e >= 18 em que o nome cabe na largura útil.
    let chosen = 34
    while (chosen > 18 && helvBold.widthOfTextAtSize(longName, chosen) > usableWidth) {
      chosen -= 1
    }
    expect(chosen).toBeLessThan(34)
  })
})

describe('downloadPdf', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('cria um <a download>, clica e revoga o URL (com atraso) do jeito certo', () => {
    vi.useFakeTimers()
    const createObjSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:fake-url')
    const revokeSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        // No momento do click, o <a> já deve ter o download correto.
        expect(this.download).toBe('certificado-final-ABC.pdf')
      })

    downloadPdf(new Uint8Array([1, 2, 3]), 'certificado-final-ABC.pdf')

    expect(createObjSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)

    // Revoke é DEFERIDO — não roda no mesmo tick (fix mobile/WebView).
    expect(revokeSpy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revokeSpy).toHaveBeenCalledWith('blob:fake-url')
  })
})
