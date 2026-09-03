/**
 * useClassRoster — camada de dados do Painel do Gestor, bloco G2 (matrículas).
 *
 * Para a turma selecionada, resolve DUAS listas e as mutations de matrícula:
 *   - `enrolled`: alunos já matriculados (enrollments ⋈ profiles.nome), com o id
 *     da matrícula (para desmatricular) e o marco zero do ritmo (created_at);
 *   - `available`: alunos (profiles role=aluno) que AINDA NÃO estão na turma —
 *     candidatos para matricular, filtrados no app.
 *
 * Mutations:
 *   - `enroll(profileId)`  → insert em enrollments {class_id, profile_id};
 *   - `unenroll(enrollmentId)` → delete em enrollments pelo id.
 *
 * RLS (0006): só o gestor DONO da turma escreve matrículas nela; o gestor lê todos
 * os perfis (0001) para poder escolher quem matricular.
 *
 * Invalidação: além do próprio roster, invalidamos `enrollments` (chave-prefixo do
 * painel do ALUNO em `useGoals`) para o ritmo do aluno refletir a (des)matrícula.
 *
 * Degradação: tabelas ausentes (migration 0006) → PGRST205 → listas vazias.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

/** Aluno matriculado na turma (enrollment + nome do perfil). */
export interface EnrolledStudent {
  enrollmentId: string
  profileId: string
  nome: string | null
  enrolledAtISO: string
}

/** Aluno candidato a matrícula (ainda fora da turma). */
export interface AvailableStudent {
  id: string
  nome: string | null
}

interface EnrollmentRow {
  id: string
  profile_id: string
  created_at: string
}

interface ProfileRow {
  id: string
  nome: string | null
}

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205'
}

async function fetchEnrollments(classId: string): Promise<EnrollmentRow[]> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id,profile_id,created_at')
    .eq('class_id', classId)
    .order('created_at', { ascending: true })
  if (error) {
    if (isMissingTable(error)) {
      console.error(
        '[manager] tabela enrollments ausente (aplicar supabase/migrations/0006_goals.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as EnrollmentRow[]
}

async function fetchAlunoProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,nome')
    .eq('role', 'aluno')
    .order('nome', { ascending: true })
  if (error) {
    if (isMissingTable(error)) {
      console.error(
        '[manager] tabela profiles ausente (aplicar supabase/migrations/0001_profiles.sql):',
        error.message,
      )
      return []
    }
    throw error
  }
  return (data ?? []) as ProfileRow[]
}

async function enroll(classId: string, profileId: string): Promise<void> {
  const { error } = await supabase
    .from('enrollments')
    .insert({ class_id: classId, profile_id: profileId })
  if (error) throw error
}

async function unenroll(enrollmentId: string): Promise<void> {
  const { error } = await supabase
    .from('enrollments')
    .delete()
    .eq('id', enrollmentId)
  if (error) throw error
}

export interface UseClassRosterResult {
  enrolled: EnrolledStudent[]
  available: AvailableStudent[]
  isLoading: boolean
  isError: boolean
  error: unknown
  enroll: (profileId: string) => void
  unenroll: (enrollmentId: string) => void
  isMutating: boolean
  isMutationError: boolean
}

/**
 * Hook público consumido pela ManagerPage quando há turma selecionada. Recebe o
 * `classId`; enquanto ausente (nenhuma turma selecionada) as queries ficam off.
 */
export function useClassRoster(
  classId: string | undefined,
): UseClassRosterResult {
  const queryClient = useQueryClient()
  const enabled = Boolean(classId)

  const enrollmentsQuery = useQuery({
    queryKey: ['class_roster', classId],
    queryFn: () => fetchEnrollments(classId as string),
    enabled,
  })
  const profilesQuery = useQuery({
    queryKey: ['aluno_profiles'],
    queryFn: fetchAlunoProfiles,
    enabled,
  })

  function invalidateAll() {
    void queryClient.invalidateQueries({ queryKey: ['class_roster', classId] })
    // Prefixo: casa ['enrollments', <qualquer profileId>] no painel do aluno.
    void queryClient.invalidateQueries({ queryKey: ['enrollments'] })
  }

  const enrollMutation = useMutation({
    mutationFn: (profileId: string) => enroll(classId as string, profileId),
    onSuccess: invalidateAll,
  })
  const unenrollMutation = useMutation({
    mutationFn: (enrollmentId: string) => unenroll(enrollmentId),
    onSuccess: invalidateAll,
  })

  const enrollments = enrollmentsQuery.data ?? []
  const profiles = profilesQuery.data ?? []
  const nameById = new Map(profiles.map((p) => [p.id, p.nome]))

  const enrolled: EnrolledStudent[] = enrollments.map((e) => ({
    enrollmentId: e.id,
    profileId: e.profile_id,
    nome: nameById.get(e.profile_id) ?? null,
    enrolledAtISO: e.created_at,
  }))

  const enrolledIds = new Set(enrollments.map((e) => e.profile_id))
  const available: AvailableStudent[] = profiles
    .filter((p) => !enrolledIds.has(p.id))
    .map((p) => ({ id: p.id, nome: p.nome }))

  return {
    enrolled,
    available,
    isLoading: !enabled || enrollmentsQuery.isLoading || profilesQuery.isLoading,
    isError: enrollmentsQuery.isError || profilesQuery.isError,
    error: enrollmentsQuery.error ?? profilesQuery.error,
    enroll: (profileId) => enrollMutation.mutate(profileId),
    unenroll: (enrollmentId) => unenrollMutation.mutate(enrollmentId),
    isMutating: enrollMutation.isPending || unenrollMutation.isPending,
    isMutationError: enrollMutation.isError || unenrollMutation.isError,
  }
}
