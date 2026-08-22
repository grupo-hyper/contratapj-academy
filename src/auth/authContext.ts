import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

/**
 * Auth-local profile shape. Mirrors the `profiles` table (migration 0001).
 * The full shared content types are intentionally NOT defined here (Task 2.2);
 * this is the minimal profile the auth layer needs.
 */
export type Role = 'aluno' | 'gestor' | 'autor'

export type Profile = {
  id: string
  nome: string | null
  role: Role
  avatar_url: string | null
}

export type AuthContextValue = {
  user: User | null
  profile: Profile | null
  loading: boolean
  /** Password sign-in. Alias for `signInWithPassword`, to satisfy the plan's literal `signIn`. */
  signIn: (email: string, password: string) => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
