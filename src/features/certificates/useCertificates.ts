/**
 * useCertificates — camada de dados da tela "Meus certificados" (Task 4.4).
 *
 * Responsabilidade ÚNICA: buscar (via react-query + Supabase) os certificados do
 * aluno logado e resolver `module_id → titulo` para exibição. Certificados são
 * READ-ONLY no cliente (emissão é server-side por trigger); aqui só LISTAMOS.
 *
 * RLS: `certificates` é owner-read (aluno lê os próprios); `modules` só devolve
 * publicados — um módulo despublicado pode não ter título resolvível, então o
 * mapa cai num rótulo genérico (a página trata a ausência).
 *
 * Degradação: se `certificates`/`modules` ainda não existem no schema remoto
 * (migration não aplicada) o PostgREST devolve PGRST205 — degradamos para lista
 * vazia / mapa vazio (mesmo padrão de useHomeData/useLesson), sem quebrar a tela.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Certificate, Module } from '../../types/content'

async function fetchCertificates(profileId: string): Promise<Certificate[]> {
  const { data, error } = await supabase
    .from('certificates')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: true })
  if (error) {
    // PGRST205 = tabela ausente no schema cache (0005 ainda não aplicada no
    // remoto). Degrada para "sem certificados" em vez de derrubar a tela.
    if (error.code === 'PGRST205') {
      console.error(
        '[certificates] tabela certificates ausente (aplicar supabase/migrations/0005_certificates.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as Certificate[]
}

/** Módulos publicados (id, titulo, ordem) para resolver o título do certificado. */
async function fetchModules(): Promise<Pick<Module, 'id' | 'titulo' | 'ordem'>[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('id,titulo,ordem')
    .order('ordem', { ascending: true })
  if (error) {
    if (error.code === 'PGRST205') {
      console.error(
        '[certificates] tabela modules ausente (aplicar supabase/migrations/0002_content.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as Pick<Module, 'id' | 'titulo' | 'ordem'>[]
}

export interface UseCertificatesResult {
  certificates: Certificate[]
  /** module_id → titulo (só módulos publicados/visíveis; ausente = despublicado). */
  moduleTitleById: Record<string, string>
  /** module_id → ordem (para ordenar os certs de módulo). */
  moduleOrderById: Record<string, number>
  isLoading: boolean
  isError: boolean
  error: unknown
}

/**
 * Hook público consumido pela CertificatesPage. Recebe o `profileId` (== user.id)
 * para escopar os certificados; enquanto ausente as queries ficam desabilitadas.
 */
export function useCertificates(
  profileId: string | undefined,
): UseCertificatesResult {
  const enabled = Boolean(profileId)

  const certificatesQuery = useQuery({
    queryKey: ['certificates', profileId],
    queryFn: () => fetchCertificates(profileId as string),
    enabled,
  })
  const modulesQuery = useQuery({
    queryKey: ['modules_titles'],
    queryFn: fetchModules,
    enabled,
  })

  const modules = modulesQuery.data ?? []
  const moduleTitleById: Record<string, string> = {}
  const moduleOrderById: Record<string, number> = {}
  for (const m of modules) {
    moduleTitleById[m.id] = m.titulo
    moduleOrderById[m.id] = m.ordem
  }

  return {
    certificates: certificatesQuery.data ?? [],
    moduleTitleById,
    moduleOrderById,
    isLoading: !enabled || certificatesQuery.isLoading || modulesQuery.isLoading,
    isError: certificatesQuery.isError || modulesQuery.isError,
    error: certificatesQuery.error ?? modulesQuery.error,
  }
}
