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

    // 1. Resolve the initial session, then hydrate the profile.
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const sessionUser = data.session?.user ?? null
        if (!mounted.current) return
        setUser(sessionUser)
        if (sessionUser) {
          const p = await fetchProfile(sessionUser.id)
          if (mounted.current) setProfile(p)
        }
      })
      .finally(() => {
        if (mounted.current) setLoading(false)
      })

    // 2. Keep user/profile in sync with auth state changes.
    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        const sessionUser = session?.user ?? null
        if (!mounted.current) return
        setUser(sessionUser)
        if (sessionUser) {
          const p = await fetchProfile(sessionUser.id)
          if (mounted.current) setProfile(p)
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
