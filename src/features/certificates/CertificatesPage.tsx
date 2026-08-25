/**
 * CertificatesPage — tela "Meus certificados" (Task 4.4), estilo streaming dark.
 *
 * Composição pura: a busca/derivação vive em `useCertificates`; a geração do PDF
 * vive em `pdf.ts`. Aqui montamos a tela (link Voltar, cert final destacado,
 * certs de módulo em ordem) e os estados: carregando, vazio, erro e a lista.
 *
 * Download: cada linha tem um botão "Baixar PDF" que monta o certificado
 * client-side (`buildCertificatePdf`) e dispara o download (`downloadPdf`). O
 * build é assíncrono, então cada linha tem seu próprio estado "gerando" (disable
 * + aria-busy).
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import type { Certificate } from '../../types/content'
import { buildCertificatePdf, downloadPdf, formatBRDate } from './pdf'
import { useCertificates } from './useCertificates'

function CertificatesSkeleton() {
  return (
    <div className="mx-auto flex max-w-3xl animate-pulse flex-col gap-4 px-4 py-6">
      <div className="h-8 w-1/2 rounded bg-cpj-navy/40" />
      <div className="h-24 w-full rounded-2xl bg-cpj-navy/40" />
      <div className="h-20 w-full rounded-2xl bg-cpj-navy/40" />
      <div className="h-20 w-full rounded-2xl bg-cpj-navy/40" />
    </div>
  )
}

/** Uma linha de certificado com o botão de download e seu estado local. */
function CertificateRow({
  cert,
  title,
  studentName,
  highlighted,
}: {
  cert: Certificate
  title: string
  studentName: string
  highlighted?: boolean
}) {
  const [generating, setGenerating] = useState(false)

  async function handleDownload() {
    setGenerating(true)
    try {
      const bytes = await buildCertificatePdf({
        studentName,
        tipo: cert.tipo,
        moduleTitle: cert.tipo === 'modulo' ? title : null,
        nota: cert.nota,
        codigoVerificacao: cert.codigo_verificacao,
        issuedAtISO: cert.created_at,
      })
      const filename = `certificado-${cert.tipo === 'final' ? 'final' : 'modulo'}-${cert.codigo_verificacao}.pdf`
      downloadPdf(bytes, filename)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
        highlighted
          ? 'border-cpj-coral/40 bg-cpj-navy/40'
          : 'border-cpj-white/10 bg-cpj-navy/20'
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-cpj-white">
          {title}
        </p>
        <p className="mt-1 text-sm text-cpj-white/60">
          {cert.nota !== null && (
            <span className="tabular-nums">Nota {cert.nota}% · </span>
          )}
          Emitido em {formatBRDate(cert.created_at)}
        </p>
        <p className="mt-1 text-xs text-cpj-white/40">
          Código de verificação: {cert.codigo_verificacao}
        </p>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={generating}
        aria-busy={generating}
        aria-label={`Baixar PDF do ${title}`}
        className="shrink-0 rounded-xl bg-cpj-coral px-4 py-2.5 text-sm font-semibold text-cpj-white transition hover:bg-cpj-coral/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral disabled:opacity-60"
      >
        {generating ? 'Gerando…' : 'Baixar PDF'}
      </button>
    </div>
  )
}

export function CertificatesPage() {
  const { profile, user, loading } = useAuth()

  const profileId = profile?.id ?? user?.id
  const studentName = profile?.nome ?? user?.email ?? 'Aluno'

  const {
    certificates,
    moduleTitleById,
    moduleOrderById,
    isLoading,
    isError,
  } = useCertificates(profileId)

  const showLoading = loading || isLoading

  // Separa o certificado final (destaque) dos de módulo (ordenados por ordem do
  // módulo, com fallback estável por created_at).
  const { finalCert, moduleCerts } = useMemo(() => {
    const finalCert = certificates.find((c) => c.tipo === 'final') ?? null
    const moduleCerts = certificates
      .filter((c) => c.tipo === 'modulo')
      .sort((a, b) => {
        const oa = a.module_id ? (moduleOrderById[a.module_id] ?? 9999) : 9999
        const ob = b.module_id ? (moduleOrderById[b.module_id] ?? 9999) : 9999
        if (oa !== ob) return oa - ob
        return a.created_at.localeCompare(b.created_at)
      })
    return { finalCert, moduleCerts }
  }, [certificates, moduleOrderById])

  function moduleTitleFor(cert: Certificate): string {
    if (!cert.module_id) return 'Certificado de módulo'
    return moduleTitleById[cert.module_id] ?? 'Módulo concluído'
  }

  function renderBody() {
    if (isError) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-cpj-white/70">
          <p className="text-lg font-semibold text-cpj-white">
            Não foi possível carregar seus certificados.
          </p>
          <p className="mt-2 text-sm">Tente recarregar a página em instantes.</p>
        </div>
      )
    }

    if (certificates.length === 0) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-16 text-center text-cpj-white/70">
          <p className="text-lg font-semibold text-cpj-white">
            Você ainda não tem certificados.
          </p>
          <p className="mt-2 text-sm">
            Conclua os módulos e passe nos testes.
          </p>
          <Link
            to="/"
            className="mt-6 inline-block rounded-lg bg-cpj-royal px-4 py-2 text-sm font-medium text-cpj-white transition hover:bg-cpj-royal/90"
          >
            Voltar para a Home
          </Link>
        </div>
      )
    }

    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-bold text-cpj-white sm:text-3xl">
          Meus certificados
        </h1>

        {finalCert && (
          <CertificateRow
            cert={finalCert}
            title="Certificado final"
            studentName={studentName}
            highlighted
          />
        )}

        {moduleCerts.map((cert) => (
          <CertificateRow
            key={cert.id}
            cert={cert}
            title={moduleTitleFor(cert)}
            studentName={studentName}
          />
        ))}
      </div>
    )
  }

  return (
    <main className="ocean-bg min-h-screen text-cpj-white">
      <div className="mx-auto max-w-3xl px-4 pt-6">
        <Link
          to="/"
          className="text-sm text-cpj-white/70 transition hover:text-cpj-white"
        >
          ← Voltar
        </Link>
      </div>

      {showLoading ? <CertificatesSkeleton /> : renderBody()}
    </main>
  )
}

// Default export para o `React.lazy` no router (code-splitting: tira o pdf-lib
// do bundle inicial). O named export acima é mantido para os testes.
export default CertificatesPage
