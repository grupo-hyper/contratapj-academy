/**
 * useClassDashboard — camada de dados do Painel do Gestor, bloco G3 (ritmo da turma).
 *
 * Para a turma selecionada, devolve UMA LINHA POR ALUNO matriculado com o que o
 * dashboard de ritmo precisa: nome, marco zero (matrícula) e módulos concluídos
 * (quiz aprovado, distintos) — além do total de módulos publicados. O STATUS
 * (em dia/atrasado/adiantado) é derivado na UI com `computeGoalStatus` (reuso do
 * painel do aluno), pois depende do ritmo-alvo da turma e do relógio.
 *
 * RLS: o gestor lê as matrículas da sua turma (0006), todos os perfis (0001) e
 * todas as tentativas de quiz (0004) — logo consegue montar o ritmo de cada aluno.
 *
 * Degradação: tabelas ausentes → PGRST205 → dados vazios (não quebra a tela).
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

/** Uma linha do dashboard: o essencial por aluno (o status é derivado na UI). */
export interface DashboardRow {
  profileId: string
  nome: string | null
  enrolledAtISO: string
  completedModules: number
}

interface EnrollmentRow {
  profile_id: string
  created_at: string
}

interface ProfileRow {
  id: string
  nome: string | null
}

interface AttemptRow {
  profile_id: string
  module_id: string
  aprovado: boolean
}

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205'
}

async function fetchEnrollments(classId: string): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('profile_id,created_at')
    .eq('class_id', classId)
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error)) return []
    throw error
  }
  return (data ?? []) as EnrollmentRow[]
}

async function fetchAlunoProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,nome')
    .eq('role', 'aluno')
  if (error) {
    if (isMissingTable(error)) return []
    throw error
  }
  return (data ?? []) as ProfileRow[]
}

async function fetchApprovedAttempts(): Promise<AttemptRow[]> {
  // Gestor lê todas as tentativas (RLS 0004); filtramos aprovadas e cruzamos com
  // os alunos da turma no app.
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('profile_id,module_id,aprovado')
  if (error) {
    if (isMissingTable(error)) return []
    throw error
  }
  return (data ?? []) as AttemptRow[]
}

async function fetchPublishedModuleCount(): Promise<number> {
  const { count, error } = await supabase
    .from('modules')
    .select('id', { count: 'exact', head: true })
    .eq('publicado', true)
  if (error) {
    if (isMissingTable(error)) return 0
    throw error
  }
  return count ?? 0
}

export interface UseClassDashboardResult {
  rows: DashboardRow[]
  totalModules: number
  isLoading: boolean
  isError: boolean
  error: unknown
}

/**
 * Hook consumido pelo ClassDashboard. Recebe o `classId`; enquanto ausente as
 * queries ficam desabilitadas.
 */
export function useClassDashboard(
  classId: string | undefined,
): UseClassDashboardResult {
  const enabled = Boolean(classId)

  const enrollmentsQuery = useQuery({
    queryKey: ['class_dashboard_enrollments', classId],
    queryFn: () => fetchEnrollments(classId as string),
    enabled,
  })
  const profilesQuery = useQuery({
    queryKey: ['aluno_profiles'],
    queryFn: fetchAlunoProfiles,
    enabled,
  })
  const attemptsQuery = useQuery({
    queryKey: ['class_dashboard_attempts'],
    queryFn: fetchApprovedAttempts,
    enabled,
  })
  const moduleCountQuery = useQuery({
    queryKey: ['published_module_count'],
    queryFn: fetchPublishedModuleCount,
    enabled,
  })

  const enrollments = enrollmentsQuery.data ?? []
  const profiles = profilesQuery.data ?? []
  const attempts = attemptsQuery.data ?? []
  const nameById = new Map(profiles.map((p) => [p.id, p.nome]))

  // Módulos DISTINTOS aprovados por aluno (mesmo sinal de "concluído" da trilha).
  const completedByProfile = new Map<string, Set<string>>()
  for (const a of attempts) {
    if (!a.aprovado) continue
    const set = completedByProfile.get(a.profile_id) ?? new Set<string>()
    set.add(a.module_id)
    completedByProfile.set(a.profile_id, set)
  }

  const rows: DashboardRow[] = enrollments.map((e) => ({
    profileId: e.profile_id,
    nome: nameById.get(e.profile_id) ?? null,
    enrolledAtISO: e.created_at,
    completedModules: completedByProfile.get(e.profile_id)?.size ?? 0,
  }))

  return {
    rows,
    totalModules: moduleCountQuery.data ?? 0,
    isLoading:
      !enabled ||
      enrollmentsQuery.isLoading ||
      profilesQuery.isLoading ||
      attemptsQuery.isLoading ||
      moduleCountQuery.isLoading,
    isError:
      enrollmentsQuery.isError ||
      profilesQuery.isError ||
      attemptsQuery.isError ||
      moduleCountQuery.isError,
    error:
      enrollmentsQuery.error ??
      profilesQuery.error ??
      attemptsQuery.error ??
      moduleCountQuery.error,
  }
}
