import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './theme/fonts'
import './index.css'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { queryClient } from './lib/queryClient.ts'
import { router } from './router.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* AuthProvider FORA do router pra que RequireRole tenha useAuth disponível.
        QueryClientProvider envolve o router para a Home (react-query). */}
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>,
)
