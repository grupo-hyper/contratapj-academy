/**
 * QueryClient singleton do react-query.
 *
 * Isolado num módulo próprio (em vez de criado dentro do componente raiz) por
 * dois motivos: (1) não é recriado a cada render — uma única instância vive
 * pela vida da app, preservando o cache; (2) é importável em testes, que podem
 * montar seu PRÓPRIO client isolado por teste (ver HomePage.test) sem depender
 * deste. Config conservadora: sem refetch on focus e 1 retry só, coerente com
 * dados de conteúdo que mudam pouco.
 */
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
