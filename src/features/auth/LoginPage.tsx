import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'

type Mode = 'senha' | 'link'

/**
 * Tela de login — identidade ContrataPJ (dark). Componente presentational:
 * chama as ações do useAuth(), sem lógica de rota (Task 1.3).
 */
export function LoginPage() {
  const { user, signInWithPassword, signInWithMagicLink } = useAuth()

  const [mode, setMode] = useState<Mode>('senha')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkEnviado, setLinkEnviado] = useState(false)

  function traduzErro(err: unknown, modo: Mode): string {
    const raw = err instanceof Error ? err.message : ''
    if (modo === 'senha' && /invalid login credentials/i.test(raw)) {
      return 'E-mail ou senha incorretos. Tenta de novo?'
    }
    if (/rate limit|too many/i.test(raw)) {
      return 'Muitas tentativas em pouco tempo. Espera um instante e tenta de novo.'
    }
    if (/email/i.test(raw) && /valid/i.test(raw)) {
      return 'Esse e-mail não parece válido. Confere e tenta de novo.'
    }
    return 'Algo deu errado por aqui. Tenta novamente em instantes.'
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'senha') {
        await signInWithPassword(email, password)
      } else {
        await signInWithMagicLink(email)
        setLinkEnviado(true)
      }
    } catch (err) {
      setError(traduzErro(err, mode))
    } finally {
      setSubmitting(false)
    }
  }

  function trocarModo(next: Mode) {
    setMode(next)
    setError(null)
    setLinkEnviado(false)
  }

  // Já autenticado? Sai da tela de login e vai pra Home.
  if (user) return <Navigate to="/" replace />

  return (
    <main className="flex min-h-screen items-center justify-center bg-cpj-bg px-4 text-cpj-white">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="/favicon.svg"
            alt="ContrataPJ"
            className="mx-auto mb-4 h-12 w-12"
          />
          <h1 className="text-2xl font-bold tracking-tight">
            Bem-vindo à ContrataPJ Academy
          </h1>
          <p className="mt-2 text-sm text-cpj-white/70">
            Seu treino pra vender melhor começa aqui. Entra e bora.
          </p>
        </div>

        {linkEnviado ? (
          <div
            role="status"
            className="rounded-xl border border-cpj-navy bg-cpj-navy/20 p-5 text-center"
          >
            <p className="text-sm">
              Pronto! Enviamos um link de acesso para{' '}
              <span className="font-semibold text-cpj-white">{email}</span>.
              Abra pelo mesmo dispositivo.
            </p>
            <button
              type="button"
              onClick={() => trocarModo('senha')}
              className="mt-4 text-sm font-medium text-cpj-royal hover:underline"
            >
              Voltar para o login com senha
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-cpj-navy bg-cpj-bg px-3 py-2 text-cpj-white outline-none focus:border-cpj-royal"
                placeholder="voce@contratapj.com.br"
              />
            </div>

            {mode === 'senha' && (
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium"
                >
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-cpj-navy bg-cpj-bg px-3 py-2 text-cpj-white outline-none focus:border-cpj-royal"
                  placeholder="••••••••"
                />
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm font-medium text-cpj-coral">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-cpj-royal px-4 py-2.5 font-semibold text-cpj-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === 'senha'
                ? submitting
                  ? 'Entrando…'
                  : 'Entrar'
                : submitting
                  ? 'Enviando…'
                  : 'Receber link de acesso'}
            </button>

            <div className="pt-2 text-center">
              {mode === 'senha' ? (
                <button
                  type="button"
                  onClick={() => trocarModo('link')}
                  className="text-sm text-cpj-royal hover:underline"
                >
                  Prefere entrar por link mágico?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => trocarModo('senha')}
                  className="text-sm text-cpj-royal hover:underline"
                >
                  Entrar com e-mail e senha
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
