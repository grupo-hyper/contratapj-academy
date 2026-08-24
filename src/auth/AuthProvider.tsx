import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import {
  AuthContext,
  type AuthContextValue,
  type Profile,
} from './authContext'

/**
 * Fetches the caller's profile row. Uses maybeSingle() so a missing row (e.g.
 * the signup trigger hasn't landed yet) resolves to null instead of throwing.
 */
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    // Non-fatal: surface for debugging, but don't crash the app on a profile miss.
    console.error('[auth] falha ao carregar perfil:', error.message)
    return null
  }
  return (data as Profile | null) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Guards against setting state after unmount during async resolution.
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true

    // Fonte ÚNICA de verdade da sessão: onAuthStateChange. Ao inscrever, o
    // supabase-js emite SEMPRE um evento inicial (INITIAL_SESSION/SIGNED_IN) com
    // a sessão persistida (ou null) — cobre boot e reload SEM uma chamada
    // separada a getSession().
    //
    // DOIS BUGS que causavam "Carregando…" eterno ao recarregar já logado
    // (evidência: reload não disparava NENHUM request e `loading` nunca virava
    // false), corrigidos aqui:
    //   1. getSession() + onAuthStateChange disputavam o mesmo lock de auth do
    //      supabase-js; sob o double-mount do StrictMode a promise de
    //      getSession() podia nunca resolver → o .finally() nunca rodava.
    //      Fix: um único assinante (onAuthStateChange), sem getSession().
    //   2. O callback do onAuthStateChange roda DENTRO do lock de auth. Dar
    //      `await fetchProfile()` ali dentro reentra no lock (fetchProfile →
    //      _useSession) e trava pra sempre → setLoading(false) nunca rodava.
    //      Fix: liberar a UI (setLoading(false)) ANTES e buscar o perfil FORA
    //      do callback (sem await), deixando o callback retornar e liberar o
    //      lock antes da query do perfil.
    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        const sessionUser = session?.user ?? null
        if (!mounted.current) return
        setUser(sessionUser)
        // Sessão resolvida (com ou sem usuário): libera a UI imediatamente.
        if (mounted.current) setLoading(false)
        if (sessionUser) {
          void fetchProfile(sessionUser.id).then((p) => {
            if (mounted.current) setProfile(p)
          })
        } else {
          setProfile(null)
        }
      },
    )

    return () => {
      mounted.current = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signIn: signInWithPassword,
      signInWithPassword,
      signInWithMagicLink,
      signOut,
    }),
    [user, profile, loading, signInWithPassword, signInWithMagicLink, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
