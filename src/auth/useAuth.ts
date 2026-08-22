import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './authContext'

/**
 * Access the auth context: user, profile, loading, and sign-in/out actions.
 * Throws if called outside <AuthProvider> so misuse fails loud and early.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useAuth precisa ser usado dentro de <AuthProvider>.')
  }
  return ctx
}
