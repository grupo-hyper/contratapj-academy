# Painel do Gestor (Fase 5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o `GestorStub` por um Painel do Gestor real (`/gestor`) com CRUD de turmas/metas, matrícula por e-mail e visão de progresso dos alunos.

**Architecture:** UI React + camada de dados `useGestao` que consome a RLS já existente do `0006` (gestor dono lê/escreve suas turmas; gestor lê todas as `quiz_attempts` e `profiles`). Único artefato de servidor novo: RPC `find_profile_by_email` (SECURITY DEFINER, gestor-only) para resolver e-mail→perfil, já que `profiles` não guarda e-mail. Progresso reaproveita `computeGoalStatus` (lado aluno).

**Tech Stack:** React + Vite + TypeScript + Tailwind, @tanstack/react-query, Supabase JS, Vitest + Testing Library.

**Spec:** `docs/specs/2026-08-26-painel-gestor-fase5-design.md`

**Convenções verificadas no código:**
- Client: `import { supabase } from '../../lib/supabase'` — chainable/thenable (`from().select().eq().order()`), `.insert/.update/.delete/.upsert`, `.rpc(name, args)`.
- Tabelas: `classes(id, nome, gestor_id, created_at)`; `enrollments(id, profile_id, class_id, created_at)` unique `(profile_id, class_id)`; `class_goals(id, class_id UNIQUE, modules_per_week numeric>0, created_at, updated_at)`; `quiz_attempts(id, profile_id, module_id, nota, aprovado, respostas, created_at)`; `profiles(id, nome, role)`; `modules(id, publicado)`.
- `computeGoalStatus({ modulesPerWeek, enrolledAtISO, completedModules, totalModules, now })` → `{ status: 'em_dia'|'atrasado'|'adiantado', expectedModules, completedModules, modulesBehind, weeksElapsed }` (exportado em `src/features/goals/useGoals.ts`).
- "Concluído" = módulos DISTINTOS com `aprovado=true` (regra de `countConcludedModules`).
- Testes mockam `../../lib/supabase` roteando por nome de tabela num "chain thenable".

**Padrão de commit:** cada task termina com commit. Push é **manual do Diego** (agente não pusha). `git commit --amend` é bloqueado (GateGuard) — use commits de follow-up.

---

## File Structure

- **Create** `supabase/migrations/0007_find_profile_by_email.sql` — RPC gestor-only e-mail→perfil.
- **Modify** `src/features/goals/useGoals.ts` — exportar `countConcludedModules` (reuso sem duplicar regra).
- **Create** `src/features/gestao/gestaoData.ts` — funções async de dados (CRUD, RPC, enroll) + tipos.
- **Create** `src/features/gestao/gestaoData.test.tsx` — testes das funções de dados (supabase mockado).
- **Create** `src/features/gestao/classProgress.ts` — função PURA que monta a visão de progresso por turma.
- **Create** `src/features/gestao/classProgress.test.ts` — testes puros (now fixo).
- **Create** `src/features/gestao/useGestao.ts` — hook react-query (read + mutations) usando `gestaoData` + `classProgress`.
- **Create** `src/features/gestao/GestaoPage.tsx` — a tela.
- **Create** `src/features/gestao/GestaoPage.test.tsx` — testes de UI (useGestao mockado).
- **Modify** `src/router.tsx` — trocar `GestorStub` por `GestaoPage` na rota `/gestor`.

---

## Task 1: Migration `0007` — RPC `find_profile_by_email` (gestor-only)

**Files:**
- Create: `supabase/migrations/0007_find_profile_by_email.sql`

- [ ] **Step 1: Escrever a migration**

Conteúdo do arquivo:

```sql
-- =============================================================================
-- 0007_find_profile_by_email.sql
-- ContrataPJ Academy — Fase 5 (Painel do Gestor)
--
-- RPC para o gestor resolver um e-mail em um perfil, para matricular por e-mail.
-- profiles NÃO guarda e-mail (ele vive em auth.users, fora do alcance do
-- cliente). Esta função SECURITY DEFINER faz a ponte, restrita a gestores.
--
-- SEGURANÇA: SECURITY DEFINER ignora RLS; por isso a função SÓ responde quando
-- o chamador é gestor (current_user_role() = 'gestor', de 0001). Sem essa
-- guarda, qualquer autenticado poderia enumerar e-mails→perfis. search_path
-- fixo (defesa em profundidade). Idempotente (create or replace).
--
-- Aplicar manualmente no SQL Editor, DEPOIS de 0006.
-- =============================================================================

create or replace function public.find_profile_by_email(p_email text)
  returns table (id uuid, nome text, role text)
  language plpgsql
  security definer
  stable
  set search_path = public
as $$
begin
  if coalesce(public.current_user_role(), '') <> 'gestor' then
    raise exception 'Apenas gestores podem buscar perfis por e-mail.'
      using errcode = '42501'; -- insufficient_privilege
  end if;

  return query
    select p.id, p.nome, p.role
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = lower(btrim(p_email))
    limit 1;
end;
$$;

comment on function public.find_profile_by_email(text) is
  'Resolve e-mail (auth.users) em perfil (profiles). SECURITY DEFINER, restrita a gestor. Usada na matrícula por e-mail do Painel do Gestor.';

grant execute on function public.find_profile_by_email(text) to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0007_find_profile_by_email.sql
git commit -m "feat(gestao): migration 0007 RPC find_profile_by_email (gestor-only)"
```

- [ ] **Step 3: Entregar o SQL pro Diego aplicar**

Colar o SQL do arquivo no chat e pedir para o Diego aplicar no SQL Editor do Supabase (projeto `xbolgzabgtxzbpskokxj`), **depois** de `0006`. (Deploy não aplica migrations — regra do projeto.)

- [ ] **Step 4: Verificação manual (após aplicar)**

No SQL Editor, validar existência:
```sql
select proname from pg_proc where proname = 'find_profile_by_email';
```
Esperado: 1 linha.

---

## Task 2: Exportar `countConcludedModules` (reuso da regra de "concluído")

**Files:**
- Modify: `src/features/goals/useGoals.ts`

- [ ] **Step 1: Tornar a função exportável**

Em `src/features/goals/useGoals.ts`, a função hoje é privada:
```ts
function countConcludedModules(attempts: QuizAttempt[]): number {
```
Trocar por:
```ts
export function countConcludedModules(attempts: QuizAttempt[]): number {
```
(Nenhuma outra mudança — mesma implementação: conta `module_id` distintos com `aprovado`.)

- [ ] **Step 2: Rodar os testes do módulo goals**

Run: `npx vitest run src/features/goals`
Expected: PASS (sem mudança de comportamento).

- [ ] **Step 3: Commit**

```bash
git add src/features/goals/useGoals.ts
git commit -m "refactor(goals): exporta countConcludedModules p/ reuso no gestor"
```

---

## Task 3: `classProgress` — função pura da visão de progresso

**Files:**
- Create: `src/features/gestao/classProgress.ts`
- Test: `src/features/gestao/classProgress.test.ts`

- [ ] **Step 1: Escrever o teste (falha)**

`src/features/gestao/classProgress.test.ts`:
```ts
import { expect, it } from 'vitest'
import { buildClassProgress } from './classProgress'
import type { QuizAttempt } from '../../types/content'

const NOW = new Date('2026-01-15T00:00:00Z')
// Matrícula 2 semanas antes de NOW.
const enrolledAt = '2026-01-01T00:00:00Z'

function attempt(profileId: string, moduleId: string, aprovado: boolean): QuizAttempt {
  return {
    id: `${profileId}-${moduleId}`,
    profile_id: profileId,
    module_id: moduleId,
    nota: aprovado ? 90 : 10,
    aprovado,
    respostas: {},
    created_at: enrolledAt,
  } as QuizAttempt
}

it('monta linhas por aluno com status de ritmo (meta 1 mod/sem, 2 semanas)', () => {
  const rows = buildClassProgress({
    modulesPerWeek: 1,
    totalModules: 12,
    now: NOW,
    enrollments: [
      { id: 'e1', profile_id: 'p1', class_id: 'c1', created_at: enrolledAt },
      { id: 'e2', profile_id: 'p2', class_id: 'c1', created_at: enrolledAt },
    ],
    profilesById: { p1: 'Ana', p2: 'Bia' },
    attempts: [
      // p1 concluiu 1 módulo (esperado ~2) -> atrasado
      attempt('p1', 'm1', true),
      // p2 concluiu 3 módulos distintos (esperado ~2) -> adiantado
      attempt('p2', 'm1', true),
      attempt('p2', 'm2', true),
      attempt('p2', 'm3', true),
    ],
  })

  expect(rows).toHaveLength(2)
  const p1 = rows.find((r) => r.profileId === 'p1')!
  const p2 = rows.find((r) => r.profileId === 'p2')!
  expect(p1.nome).toBe('Ana')
  expect(p1.completedModules).toBe(1)
  expect(p1.status).toBe('atrasado')
  expect(p2.completedModules).toBe(3)
  expect(p2.status).toBe('adiantado')
})

it('nome cai para "—" quando o perfil não está no mapa', () => {
  const rows = buildClassProgress({
    modulesPerWeek: 1,
    totalModules: 12,
    now: NOW,
    enrollments: [{ id: 'e1', profile_id: 'pX', class_id: 'c1', created_at: enrolledAt }],
    profilesById: {},
    attempts: [],
  })
  expect(rows[0].nome).toBe('—')
  expect(rows[0].completedModules).toBe(0)
})
```

- [ ] **Step 2: Rodar (falha)**

Run: `npx vitest run src/features/gestao/classProgress.test.ts`
Expected: FAIL ("buildClassProgress is not a function" / módulo inexistente).

- [ ] **Step 3: Implementar**

`src/features/gestao/classProgress.ts`:
```ts
import type { QuizAttempt } from '../../types/content'
import {
  computeGoalStatus,
  countConcludedModules,
  type GoalStatus,
} from '../goals/useGoals'

export interface EnrollmentRow {
  id: string
  profile_id: string
  class_id: string
  created_at: string
}

export interface ClassProgressRow {
  enrollmentId: string
  profileId: string
  nome: string
  completedModules: number
  expectedModules: number
  status: GoalStatus
}

/**
 * PURA: dada a meta de ritmo da turma, as matrículas, o mapa de nomes e as
 * tentativas de quiz, monta uma linha de progresso por aluno reaproveitando a
 * mesma regra do lado aluno (computeGoalStatus + countConcludedModules).
 * `now` é injetado para testes determinísticos.
 */
export function buildClassProgress(params: {
  modulesPerWeek: number
  totalModules: number
  now: Date
  enrollments: EnrollmentRow[]
  profilesById: Record<string, string | null>
  attempts: QuizAttempt[]
}): ClassProgressRow[] {
  const { modulesPerWeek, totalModules, now, enrollments, profilesById, attempts } = params

  // Agrupa tentativas por aluno uma vez.
  const attemptsByProfile = new Map<string, QuizAttempt[]>()
  for (const a of attempts) {
    const list = attemptsByProfile.get(a.profile_id) ?? []
    list.push(a)
    attemptsByProfile.set(a.profile_id, list)
  }

  return enrollments.map((e) => {
    const completedModules = countConcludedModules(attemptsByProfile.get(e.profile_id) ?? [])
    const comp = computeGoalStatus({
      modulesPerWeek,
      enrolledAtISO: e.created_at,
      completedModules,
      totalModules,
      now,
    })
    return {
      enrollmentId: e.id,
      profileId: e.profile_id,
      nome: profilesById[e.profile_id] ?? '—',
      completedModules,
      expectedModules: comp.expectedModules,
      status: comp.status,
    }
  })
}
```

- [ ] **Step 4: Rodar (passa)**

Run: `npx vitest run src/features/gestao/classProgress.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestao/classProgress.ts src/features/gestao/classProgress.test.ts
git commit -m "feat(gestao): buildClassProgress puro (reusa computeGoalStatus)"
```

---

## Task 4: `gestaoData` — funções de dados (CRUD + RPC + enroll)

**Files:**
- Create: `src/features/gestao/gestaoData.ts`
- Test: `src/features/gestao/gestaoData.test.tsx`

- [ ] **Step 1: Escrever o teste (falha)**

`src/features/gestao/gestaoData.test.tsx`:
```ts
import { afterEach, expect, it, vi } from 'vitest'

// Estado roteável por tabela/rpc (padrão dos testes de goals).
type Res = { data: unknown; error: unknown; count?: number }
const state: Record<string, Res> = {}
const rpcRes: { value: Res } = { value: { data: [], error: null } }
const calls: { insert?: unknown; update?: unknown; delete?: boolean; upsert?: unknown } = {}

function chain(table: string) {
  const c: Record<string, unknown> = {}
  c.select = vi.fn(() => c)
  c.eq = vi.fn(() => c)
  c.order = vi.fn(() => c)
  c.insert = vi.fn((v: unknown) => {
    calls.insert = v
    return c
  })
  c.update = vi.fn((v: unknown) => {
    calls.update = v
    return c
  })
  c.upsert = vi.fn((v: unknown) => {
    calls.upsert = v
    return c
  })
  c.delete = vi.fn(() => {
    calls.delete = true
    return c
  })
  c.then = (resolve: (v: Res) => unknown) =>
    resolve(state[table] ?? { data: [], error: null })
  return c
}

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => chain(table)),
    rpc: vi.fn((_name: string, _args: unknown) => ({
      then: (resolve: (v: Res) => unknown) => resolve(rpcRes.value),
    })),
  },
}))

import {
  createClass,
  enroll,
  findProfileByEmail,
  upsertGoal,
} from './gestaoData'

afterEach(() => {
  for (const k of Object.keys(state)) delete state[k]
  rpcRes.value = { data: [], error: null }
  calls.insert = calls.update = calls.upsert = undefined
  calls.delete = undefined
  vi.clearAllMocks()
})

it('createClass insere a turma com o nome informado', async () => {
  state.classes = { data: [{ id: 'c1', nome: 'Time SP', gestor_id: 'g1', created_at: 'x' }], error: null }
  const row = await createClass('Time SP')
  expect(calls.insert).toMatchObject({ nome: 'Time SP' })
  expect(row.id).toBe('c1')
})

it('upsertGoal faz upsert por class_id', async () => {
  state.class_goals = { data: [{ id: 'goal1', class_id: 'c1', modules_per_week: 2 }], error: null }
  await upsertGoal('c1', 2)
  expect(calls.upsert).toMatchObject({ class_id: 'c1', modules_per_week: 2 })
})

it('findProfileByEmail devolve o perfil quando o RPC acha', async () => {
  rpcRes.value = { data: [{ id: 'p1', nome: 'Ana', role: 'aluno' }], error: null }
  const p = await findProfileByEmail('ana@x.com')
  expect(p).toEqual({ id: 'p1', nome: 'Ana', role: 'aluno' })
})

it('findProfileByEmail devolve null quando o RPC não acha', async () => {
  rpcRes.value = { data: [], error: null }
  const p = await findProfileByEmail('nao@existe.com')
  expect(p).toBeNull()
})

it('enroll traduz unique_violation (23505) em erro amigável', async () => {
  state.enrollments = { data: null, error: { code: '23505', message: 'dup' } }
  await expect(enroll('c1', 'p1')).rejects.toThrow(/já (está )?matriculad/i)
})
```

- [ ] **Step 2: Rodar (falha)**

Run: `npx vitest run src/features/gestao/gestaoData.test.tsx`
Expected: FAIL (módulo `./gestaoData` inexistente).

- [ ] **Step 3: Implementar**

`src/features/gestao/gestaoData.ts`:
```ts
import { supabase } from '../../lib/supabase'
import type { QuizAttempt } from '../../types/content'
import type { EnrollmentRow } from './classProgress'

export interface ClassRow {
  id: string
  nome: string
  gestor_id: string
  created_at: string
}
export interface ClassGoalRow {
  class_id: string
  modules_per_week: number
}
export interface ProfileLite {
  id: string
  nome: string | null
  role: string
}

function unwrap<T>(res: { data: T | null; error: { message?: string } | null }, ctx: string): T {
  if (res.error) throw new Error(`[gestao] ${ctx}: ${res.error.message ?? 'erro'}`)
  return (res.data ?? []) as unknown as T
}

export async function listClasses(): Promise<ClassRow[]> {
  const res = await supabase.from('classes').select('id,nome,gestor_id,created_at').order('created_at')
  return unwrap<ClassRow[]>(res, 'listClasses')
}

export async function createClass(nome: string): Promise<ClassRow> {
  const res = await supabase.from('classes').insert({ nome: nome.trim() }).select('id,nome,gestor_id,created_at')
  const rows = unwrap<ClassRow[]>(res, 'createClass')
  return rows[0]
}

export async function renameClass(id: string, nome: string): Promise<void> {
  const res = await supabase.from('classes').update({ nome: nome.trim() }).eq('id', id)
  if (res.error) throw new Error(`[gestao] renameClass: ${res.error.message}`)
}

export async function deleteClass(id: string): Promise<void> {
  const res = await supabase.from('classes').delete().eq('id', id)
  if (res.error) throw new Error(`[gestao] deleteClass: ${res.error.message}`)
}

export async function listGoals(): Promise<ClassGoalRow[]> {
  const res = await supabase.from('class_goals').select('class_id,modules_per_week')
  return unwrap<ClassGoalRow[]>(res, 'listGoals')
}

export async function upsertGoal(classId: string, modulesPerWeek: number): Promise<void> {
  const res = await supabase
    .from('class_goals')
    .upsert({ class_id: classId, modules_per_week: modulesPerWeek }, { onConflict: 'class_id' })
  if (res.error) throw new Error(`[gestao] upsertGoal: ${res.error.message}`)
}

export async function listEnrollments(): Promise<EnrollmentRow[]> {
  const res = await supabase.from('enrollments').select('id,profile_id,class_id,created_at')
  return unwrap<EnrollmentRow[]>(res, 'listEnrollments')
}

export async function listAlunoProfiles(): Promise<ProfileLite[]> {
  const res = await supabase.from('profiles').select('id,nome,role')
  return unwrap<ProfileLite[]>(res, 'listAlunoProfiles')
}

export async function listAllQuizAttempts(): Promise<QuizAttempt[]> {
  const res = await supabase.from('quiz_attempts').select('*')
  return unwrap<QuizAttempt[]>(res, 'listAllQuizAttempts')
}

export async function countPublishedModules(): Promise<number> {
  const res = await supabase.from('modules').select('id', { count: 'exact', head: true }).eq('publicado', true)
  if (res.error) throw new Error(`[gestao] countPublishedModules: ${res.error.message}`)
  return res.count ?? 0
}

export async function findProfileByEmail(email: string): Promise<ProfileLite | null> {
  const res = await supabase.rpc('find_profile_by_email', { p_email: email.trim() })
  if (res.error) throw new Error(`[gestao] findProfileByEmail: ${res.error.message}`)
  const rows = (res.data ?? []) as ProfileLite[]
  return rows.length > 0 ? rows[0] : null
}

export async function enroll(classId: string, profileId: string): Promise<void> {
  const res = await supabase.from('enrollments').insert({ class_id: classId, profile_id: profileId })
  if (res.error) {
    if (res.error.code === '23505') throw new Error('Esse aluno já está matriculado nesta turma.')
    throw new Error(`[gestao] enroll: ${res.error.message}`)
  }
}

export async function unenroll(enrollmentId: string): Promise<void> {
  const res = await supabase.from('enrollments').delete().eq('id', enrollmentId)
  if (res.error) throw new Error(`[gestao] unenroll: ${res.error.message}`)
}
```

- [ ] **Step 4: Rodar (passa)**

Run: `npx vitest run src/features/gestao/gestaoData.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestao/gestaoData.ts src/features/gestao/gestaoData.test.tsx
git commit -m "feat(gestao): camada de dados (CRUD turmas/metas, RPC email, enroll)"
```

---

## Task 5: `useGestao` — hook (read agregado + mutations)

**Files:**
- Create: `src/features/gestao/useGestao.ts`

> Este hook orquestra as funções de dados com react-query. É testado indiretamente pela `GestaoPage` (Task 6), que mocka `useGestao`. Sem teste unitário próprio (evita testar react-query em si; o valor está nas funções puras/dados já cobertas).

- [ ] **Step 1: Implementar o hook**

`src/features/gestao/useGestao.ts`:
```ts
import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  countPublishedModules,
  createClass,
  deleteClass,
  enroll,
  findProfileByEmail,
  listAllQuizAttempts,
  listAlunoProfiles,
  listClasses,
  listEnrollments,
  listGoals,
  renameClass,
  unenroll,
  upsertGoal,
  type ClassRow,
} from './gestaoData'
import { buildClassProgress, type ClassProgressRow } from './classProgress'

export interface ClassView {
  id: string
  nome: string
  modulesPerWeek: number | null
  alunos: ClassProgressRow[]
}

const KEY = ['gestao'] as const

async function loadAll(now: Date): Promise<ClassView[]> {
  const [classes, goals, enrollments, profiles, attempts, totalModules] = await Promise.all([
    listClasses(),
    listGoals(),
    listEnrollments(),
    listAlunoProfiles(),
    listAllQuizAttempts(),
    countPublishedModules(),
  ])
  const profilesById: Record<string, string | null> = {}
  for (const p of profiles) profilesById[p.id] = p.nome

  const goalByClass = new Map(goals.map((g) => [g.class_id, g.modules_per_week]))

  return classes.map((c: ClassRow) => {
    const modulesPerWeek = goalByClass.get(c.id) ?? null
    const classEnrollments = enrollments.filter((e) => e.class_id === c.id)
    const alunos: ClassProgressRow[] =
      modulesPerWeek != null
        ? buildClassProgress({
            modulesPerWeek,
            totalModules,
            now,
            enrollments: classEnrollments,
            profilesById,
            attempts,
          })
        : classEnrollments.map((e) => ({
            enrollmentId: e.id,
            profileId: e.profile_id,
            nome: profilesById[e.profile_id] ?? '—',
            completedModules: 0,
            expectedModules: 0,
            status: 'em_dia' as const,
          }))
    return { id: c.id, nome: c.nome, modulesPerWeek, alunos }
  })
}

export function useGestao() {
  const qc = useQueryClient()
  // `now` estável por render do hook (determinístico dentro de uma sessão).
  const now = useMemo(() => new Date(), [])
  const query = useQuery({ queryKey: KEY, queryFn: () => loadAll(now) })
  const invalidate = () => qc.invalidateQueries({ queryKey: KEY })

  const mCreate = useMutation({ mutationFn: (nome: string) => createClass(nome), onSuccess: invalidate })
  const mRename = useMutation({ mutationFn: (v: { id: string; nome: string }) => renameClass(v.id, v.nome), onSuccess: invalidate })
  const mDelete = useMutation({ mutationFn: (id: string) => deleteClass(id), onSuccess: invalidate })
  const mGoal = useMutation({ mutationFn: (v: { classId: string; mpw: number }) => upsertGoal(v.classId, v.mpw), onSuccess: invalidate })
  const mEnroll = useMutation({ mutationFn: (v: { classId: string; profileId: string }) => enroll(v.classId, v.profileId), onSuccess: invalidate })
  const mUnenroll = useMutation({ mutationFn: (id: string) => unenroll(id), onSuccess: invalidate })

  return {
    classes: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    createClass: (nome: string) => mCreate.mutateAsync(nome),
    renameClass: (id: string, nome: string) => mRename.mutateAsync({ id, nome }),
    deleteClass: (id: string) => mDelete.mutateAsync(id),
    setGoal: (classId: string, mpw: number) => mGoal.mutateAsync({ classId, mpw }),
    enroll: (classId: string, profileId: string) => mEnroll.mutateAsync({ classId, profileId }),
    unenroll: (id: string) => mUnenroll.mutateAsync(id),
    findProfileByEmail,
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sem erros nos arquivos de gestao.

- [ ] **Step 3: Commit**

```bash
git add src/features/gestao/useGestao.ts
git commit -m "feat(gestao): hook useGestao (read agregado + mutations)"
```

---

## Task 6: `GestaoPage` — a tela

**Files:**
- Create: `src/features/gestao/GestaoPage.tsx`
- Test: `src/features/gestao/GestaoPage.test.tsx`

- [ ] **Step 1: Escrever o teste (falha)**

`src/features/gestao/GestaoPage.test.tsx`:
```tsx
import { expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const api = {
  classes: [] as unknown[],
  isLoading: false,
  error: null as Error | null,
  createClass: vi.fn(),
  renameClass: vi.fn(),
  deleteClass: vi.fn(),
  setGoal: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  findProfileByEmail: vi.fn(),
}
vi.mock('./useGestao', () => ({ useGestao: () => api }))

import { GestaoPage } from './GestaoPage'

beforeEach(() => {
  api.classes = [
    {
      id: 'c1',
      nome: 'Time SP',
      modulesPerWeek: 2,
      alunos: [
        { enrollmentId: 'e1', profileId: 'p1', nome: 'Ana', completedModules: 1, expectedModules: 2, status: 'atrasado' },
      ],
    },
  ]
  api.error = null
  api.createClass.mockReset()
  api.enroll.mockReset()
  api.findProfileByEmail.mockReset()
})

it('renderiza as turmas e seus alunos com status', () => {
  render(<GestaoPage />)
  expect(screen.getByText('Time SP')).toBeInTheDocument()
  expect(screen.getByText('Ana')).toBeInTheDocument()
  expect(screen.getByText(/atrasado/i)).toBeInTheDocument()
})

it('cria uma turma pelo formulário', async () => {
  api.createClass.mockResolvedValue({ id: 'c2' })
  const user = userEvent.setup()
  render(<GestaoPage />)
  await user.type(screen.getByLabelText(/nome da turma/i), 'Time RJ')
  await user.click(screen.getByRole('button', { name: /criar turma/i }))
  expect(api.createClass).toHaveBeenCalledWith('Time RJ')
})

it('matricular por e-mail: acha e matricula', async () => {
  api.findProfileByEmail.mockResolvedValue({ id: 'p2', nome: 'Bia', role: 'aluno' })
  api.enroll.mockResolvedValue(undefined)
  const user = userEvent.setup()
  render(<GestaoPage />)
  await user.type(screen.getByLabelText(/e-mail do aluno/i), 'bia@x.com')
  await user.click(screen.getByRole('button', { name: /buscar/i }))
  await waitFor(() => expect(screen.getByText(/Bia/)).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: /matricular/i }))
  expect(api.enroll).toHaveBeenCalledWith('c1', 'p2')
})

it('matricular por e-mail: mostra "não encontrado"', async () => {
  api.findProfileByEmail.mockResolvedValue(null)
  const user = userEvent.setup()
  render(<GestaoPage />)
  await user.type(screen.getByLabelText(/e-mail do aluno/i), 'nao@x.com')
  await user.click(screen.getByRole('button', { name: /buscar/i }))
  await waitFor(() => expect(screen.getByText(/não encontrado/i)).toBeInTheDocument())
})
```

- [ ] **Step 2: Rodar (falha)**

Run: `npx vitest run src/features/gestao/GestaoPage.test.tsx`
Expected: FAIL (módulo `./GestaoPage` inexistente).

- [ ] **Step 3: Implementar**

`src/features/gestao/GestaoPage.tsx`:
```tsx
import { useState } from 'react'
import { useGestao, type ClassView } from './useGestao'
import type { ProfileLite } from './gestaoData'

const STATUS_LABEL: Record<string, string> = {
  em_dia: 'em dia',
  atrasado: 'atrasado',
  adiantado: 'adiantado',
}

export function GestaoPage() {
  const g = useGestao()
  const [novoNome, setNovoNome] = useState('')

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 text-cpj-white">
      <h1 className="mb-6 text-2xl font-bold">Gestão de turmas</h1>

      <form
        className="mb-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const nome = novoNome.trim()
          if (!nome) return
          void g.createClass(nome).then(() => setNovoNome(''))
        }}
      >
        <label htmlFor="novo-nome" className="sr-only">Nome da turma</label>
        <input
          id="novo-nome"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Nome da turma"
          className="flex-1 rounded-lg border border-cpj-navy bg-cpj-bg px-3 py-2 outline-none focus:border-cpj-royal"
        />
        <button type="submit" className="rounded-lg bg-cpj-royal px-4 py-2 font-medium">
          Criar turma
        </button>
      </form>

      {g.isLoading && <p role="status">Carregando…</p>}
      {g.error && <p role="alert" className="text-red-400">{g.error.message}</p>}

      <div className="space-y-6">
        {g.classes.map((c) => (
          <ClassCard key={c.id} turma={c} api={g} />
        ))}
      </div>
    </main>
  )
}

function ClassCard({ turma, api }: { turma: ClassView; api: ReturnType<typeof useGestao> }) {
  const [email, setEmail] = useState('')
  const [found, setFound] = useState<ProfileLite | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [meta, setMeta] = useState(String(turma.modulesPerWeek ?? ''))

  async function buscar() {
    setMsg(null)
    setFound(null)
    const alvo = email.trim()
    if (!alvo) return
    try {
      const p = await api.findProfileByEmail(alvo)
      if (!p) setMsg('Usuário não encontrado com esse e-mail.')
      else setFound(p)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao buscar.')
    }
  }

  async function matricular() {
    if (!found) return
    try {
      await api.enroll(turma.id, found.id)
      setFound(null)
      setEmail('')
      setMsg(null)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao matricular.')
    }
  }

  return (
    <section className="rounded-2xl border border-cpj-navy bg-cpj-bg/40 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{turma.nome}</h2>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Apagar a turma "${turma.nome}"? Isso remove matrículas e meta.`)) {
              void api.deleteClass(turma.id)
            }
          }}
          className="text-sm text-red-400 hover:underline"
        >
          Apagar turma
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm">
        <label htmlFor={`meta-${turma.id}`}>Meta (módulos/semana):</label>
        <input
          id={`meta-${turma.id}`}
          type="number"
          min="1"
          step="1"
          value={meta}
          onChange={(e) => setMeta(e.target.value)}
          className="w-20 rounded border border-cpj-navy bg-cpj-bg px-2 py-1"
        />
        <button
          type="button"
          onClick={() => {
            const n = Number(meta)
            if (Number.isFinite(n) && n > 0) void api.setGoal(turma.id, n)
          }}
          className="rounded bg-cpj-navy px-3 py-1"
        >
          Salvar meta
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor={`email-${turma.id}`}>E-mail do aluno:</label>
        <input
          id={`email-${turma.id}`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="aluno@empresa.com"
          className="flex-1 rounded border border-cpj-navy bg-cpj-bg px-2 py-1"
        />
        <button type="button" onClick={() => void buscar()} className="rounded bg-cpj-navy px-3 py-1">
          Buscar
        </button>
        {found && (
          <span className="flex items-center gap-2">
            <span>{found.nome ?? found.id} ({found.role})</span>
            <button type="button" onClick={() => void matricular()} className="rounded bg-cpj-royal px-3 py-1">
              Matricular
            </button>
          </span>
        )}
      </div>
      {msg && <p role="alert" className="mb-3 text-sm text-amber-300">{msg}</p>}

      <ul className="divide-y divide-cpj-navy/50">
        {turma.alunos.map((a) => (
          <li key={a.enrollmentId} className="flex items-center justify-between py-2 text-sm">
            <span>{a.nome}</span>
            <span className="flex items-center gap-3">
              <span className="text-cpj-white/70">
                {a.completedModules}/{Math.round(a.expectedModules)}
              </span>
              <span className="capitalize">{STATUS_LABEL[a.status] ?? a.status}</span>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Remover ${a.nome} da turma?`)) void api.unenroll(a.enrollmentId)
                }}
                className="text-red-400 hover:underline"
              >
                remover
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Rodar (passa)**

Run: `npx vitest run src/features/gestao/GestaoPage.test.tsx`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/features/gestao/GestaoPage.tsx src/features/gestao/GestaoPage.test.tsx
git commit -m "feat(gestao): GestaoPage (CRUD turmas/metas, matrícula por e-mail, progresso)"
```

---

## Task 7: Ligar a rota `/gestor`

**Files:**
- Modify: `src/router.tsx`

- [ ] **Step 1: Trocar o stub pela página**

Em `src/router.tsx`:
1. Adicionar o import:
```ts
import { GestaoPage } from './features/gestao/GestaoPage'
```
2. Na rota `/gestor`, trocar `<GestorStub />` por `<GestaoPage />`:
```tsx
      {
        path: '/gestor',
        element: (
          <RequireRole allow={['gestor']}>
            <GestaoPage />
          </RequireRole>
        ),
      },
```
3. Se `GestorStub` ficar sem uso, remover da lista de imports de `./features/_stubs` (deixar `AutorStub`).

- [ ] **Step 2: Type-check + testes do router**

Run: `npx tsc --noEmit && npx vitest run src/router.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/router.tsx
git commit -m "feat(gestao): rota /gestor renderiza GestaoPage (encerra GestorStub)"
```

---

## Task 8: Verde total + build + lint

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Expected: PASS (todos os testes, incluindo os novos de gestao).

- [ ] **Step 2: Build + lint**

Run: `npm run build && npm run lint`
Expected: build ok, lint limpo.

- [ ] **Step 3: Commit final (se algo mudou no lint)**

```bash
git add -A
git commit -m "chore(gestao): ajustes de lint/build da Fase 5 (painel do gestor)"
```

- [ ] **Step 4: Handoff pro Diego**

- Push da `main` é **manual do Diego** (agente bloqueado).
- Migration `0007`: colar o SQL (Task 1) pro Diego aplicar no SQL Editor.
- Para testar no ar: precisa de um usuário `role='gestor'` no banco (definir via Management API/SQL — ex.: a Camila, se for a gestora de teste).

---

## Self-Review (autor do plano)

- **Cobertura do spec:** migration RPC (T1), reuso de regra (T2), progresso puro (T3), dados/CRUD/enroll (T4), hook (T5), UI (T6), rota (T7), verde/build/deploy handoff (T8). ✔
- **Sem placeholders:** todo passo tem código/comando reais. ✔
- **Consistência de tipos:** `EnrollmentRow`/`ClassProgressRow` em `classProgress.ts`; `ClassRow`/`ClassGoalRow`/`ProfileLite` em `gestaoData.ts`; `ClassView` em `useGestao.ts`; `findProfileByEmail`/`enroll`/`setGoal`/`unenroll` batem entre hook e UI. `computeGoalStatus`/`countConcludedModules` importados de `goals/useGoals`. ✔
- **Nota:** os testes de dados assumem o "chain thenable" já usado nos testes de goals; se algum método (`.insert().select()`) precisar encadear resolução diferente, ajustar o mock localmente — comportamento das funções não muda.
