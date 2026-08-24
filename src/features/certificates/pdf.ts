/**
 * pdf.ts — geração CLIENT-SIDE do certificado (Task 4.4).
 *
 * Por que no cliente: mantém a feature testável (jsdom), offline-capable (PWA) e
 * sem exigir deploy de Edge Function. Usa `pdf-lib` (embed de fonte padrão
 * Helvetica; NÃO embutimos o logo SVG — pdf-lib só aceita PNG/JPG e não há PNG,
 * então a marca é tipográfica).
 *
 * Exporta:
 *  - `formatBRDate(iso)`  → data-only dd/mm/aaaa em America/Sao_Paulo (BRT). Puro,
 *                           unit-testável de forma independente.
 *  - `buildCertificatePdf(input)` → bytes (Uint8Array) do PDF on-brand.
 *  - `downloadPdf(bytes, filename)` → dispara o download no navegador. Todo o
 *                           toque no DOM fica isolado aqui.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

/**
 * Formata um instante ISO (UTC) como data (dd/mm/aaaa) no fuso de Brasília.
 * Date-only de propósito: certificado mostra o DIA da emissão, não a hora.
 * Puro (sem DOM) para ser testado isoladamente.
 */
export function formatBRDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

// Paleta da marca (mesmos valores de src/theme/tokens.ts / Tailwind `cpj`),
// convertidos para o espaço 0..1 que o pdf-lib espera.
const CPJ_BG = rgb(0x0a / 255, 0x0a / 255, 0x0c / 255) // cpj-bg   #0a0a0c
const CPJ_NAVY = rgb(0x1c / 255, 0x26 / 255, 0x5e / 255) // cpj-navy  #1C265E
const CPJ_ROYAL = rgb(0x42 / 255, 0x59 / 255, 0xdf / 255) // cpj-royal #4259DF
const CPJ_CORAL = rgb(0xde / 255, 0x59 / 255, 0x68 / 255) // cpj-coral #DE5968
const CPJ_WHITE = rgb(0xf4 / 255, 0xf6 / 255, 0xff / 255) // cpj-white #f4f6ff

export interface CertificatePdfInput {
  studentName: string
  tipo: 'modulo' | 'final'
  moduleTitle?: string | null
  nota: number | null
  codigoVerificacao: string
  issuedAtISO: string
}

/**
 * Monta o PDF do certificado (A4 paisagem, fundo dark da marca, branding
 * tipográfico). Retorna os bytes. Não toca o DOM — só produz o documento.
 */
export async function buildCertificatePdf(
  input: CertificatePdfInput,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  // A4 paisagem em pontos (842 x 595).
  const page = pdfDoc.addPage([841.89, 595.28])
  const { width, height } = page.getSize()

  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Fundo dark da marca cobrindo a página inteira.
  page.drawRectangle({ x: 0, y: 0, width, height, color: CPJ_BG })

  // Moldura interna (royal), com um respiro nas bordas.
  const margin = 32
  page.drawRectangle({
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2,
    borderColor: CPJ_ROYAL,
    borderWidth: 2,
  })
  // Barra de acento (navy) no topo, dentro da moldura.
  page.drawRectangle({
    x: margin,
    y: height - margin - 8,
    width: width - margin * 2,
    height: 8,
    color: CPJ_NAVY,
  })

  // Largura útil dentro da moldura (com um respiro extra além da margem).
  const usableWidth = width - margin * 2 - 48

  // Escolhe o maior `size` (<= idealSize, >= minSize) em que o texto cabe na
  // largura útil. Evita que nomes/títulos longos (campos editáveis pelo aluno)
  // vazem silenciosamente para fora da moldura/página.
  const fitFontSize = (
    text: string,
    font: typeof helv,
    idealSize: number,
    minSize: number,
  ): number => {
    let size = idealSize
    while (size > minSize && font.widthOfTextAtSize(text, size) > usableWidth) {
      size -= 1
    }
    return size
  }

  // Helper: texto centrado horizontalmente.
  const drawCentered = (
    text: string,
    y: number,
    size: number,
    font = helv,
    color = CPJ_WHITE,
  ) => {
    const textWidth = font.widthOfTextAtSize(text, size)
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y,
      size,
      font,
      color,
    })
  }

  // Wordmark da marca (ContrataPJ em coral + Academy em branco).
  const wordmarkSize = 20
  const brandA = 'ContrataPJ '
  const brandB = 'Academy'
  const brandAW = helvBold.widthOfTextAtSize(brandA, wordmarkSize)
  const brandBW = helvBold.widthOfTextAtSize(brandB, wordmarkSize)
  const brandStartX = (width - (brandAW + brandBW)) / 2
  const brandY = height - margin - 60
  page.drawText(brandA, {
    x: brandStartX,
    y: brandY,
    size: wordmarkSize,
    font: helvBold,
    color: CPJ_CORAL,
  })
  page.drawText(brandB, {
    x: brandStartX + brandAW,
    y: brandY,
    size: wordmarkSize,
    font: helvBold,
    color: CPJ_WHITE,
  })

  // Título do certificado.
  const title =
    input.tipo === 'final'
      ? 'Certificado de Conclusao'
      : 'Certificado de Modulo'
  drawCentered(title, height / 2 + 110, 30, helvBold, CPJ_WHITE)

  // "Certificamos que"
  drawCentered('Certificamos que', height / 2 + 70, 14, helv, CPJ_WHITE)

  // Nome do aluno em destaque. `profile.nome` é editável pelo aluno e pode ser
  // longo (vários sobrenomes) — auto-encolhe (34 → mín 18) para caber na moldura.
  const nameSize = fitFontSize(input.studentName, helvBold, 34, 18)
  drawCentered(input.studentName, height / 2 + 30, nameSize, helvBold, CPJ_CORAL)

  // Descrição (módulo ou curso completo). O título do módulo também pode ser
  // longo — mesma proteção de fit (15 → mín 10).
  const desc =
    input.tipo === 'final'
      ? 'concluiu o Curso completo — 12 modulos'
      : `concluiu o modulo: ${input.moduleTitle ?? 'Modulo'}`
  const descSize = fitFontSize(desc, helv, 15, 10)
  drawCentered(desc, height / 2 - 8, descSize, helv, CPJ_WHITE)

  // Nota (se houver).
  if (input.nota !== null) {
    drawCentered(
      `Nota: ${input.nota}%`,
      height / 2 - 40,
      14,
      helvBold,
      CPJ_WHITE,
    )
  }

  // Data de emissão (BRT).
  drawCentered(
    `Emitido em ${formatBRDate(input.issuedAtISO)}`,
    height / 2 - 72,
    12,
    helv,
    CPJ_WHITE,
  )

  // Rodapé: código de verificação.
  drawCentered(
    `Codigo de verificacao: ${input.codigoVerificacao}`,
    margin + 24,
    11,
    helv,
    CPJ_ROYAL,
  )

  const bytes = await pdfDoc.save()
  return bytes
}

/**
 * Dispara o download do PDF no navegador (Blob + object URL + <a download> +
 * click + revoke). Todo o toque no DOM concentrado aqui, mantendo a página limpa.
 */
export function downloadPdf(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoga com atraso: em WebViews mobile/in-app (PWA-alvo) o salvamento é
  // enfileirado async e um revoke no mesmo tick corre e cancela o download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
