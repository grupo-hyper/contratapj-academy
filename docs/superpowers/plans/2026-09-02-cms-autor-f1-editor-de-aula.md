# CMS do Autor — F1 (Editor de aula) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o `AutorStub` da rota `/autor` por um painel master–detail onde o autor seleciona uma aula na árvore Módulos ▸ Aulas e edita título, YouTube ID, `texto_md` (com preview em slides), publicado/rascunho e salva — sem SQL.

**Architecture:** Nova feature client-side em `src/features/authoring/`, sobre o client Supabase autenticado (a RLS do papel `autor` já dá leitura de rascunhos e escrita em `lessons`; **sem migration**). Um hook de leitura (`useAuthorTree`) + um hook de mutation (`useSaveLesson`), helpers puros de estado do formulário (`lessonDraft.ts`), e três componentes pequenos: `AuthorTree` (esquerda), `LessonEditor` (direita), `AuthorPage` (shell + guarda de "alterações não salvas"). O preview reaproveita `LessonSlides` com o gate de tempo desligado.

**Tech Stack:** React 19, react-router-dom, @tanstack/react-query v5, @supabase/supabase-js, TailwindCSS (tema dark "Blue Ocean"), Vitest + Testing Library (jsdom, globals on).

---

## Contexto herdado (leia antes de começar)

- Spec aprovado: `docs/superpowers/specs/2026-09-02-cms-autor-design.md`.
- **Escopo da F1** (spec §Fases): só o **editor de aula**. NÃO inclui criar/excluir/reordenar módulos ou aulas (F2), nem quiz (F3).
- Padrões do repo a seguir:
  - Camada de dados por hook (`useLesson.ts`, `useHomeData.ts`): funções `fetch*` isoladas, `useQuery`/`useMutation`, invalidação por `queryKey`.
  - Cada unidade tem seu `.test`. Testes de hook usam `QueryClient` real + `vi.mock('../../lib/supabase', ...)` com um encadeável `select().eq()...`. Testes de componente usam Testing Library (`render`/`screen`/`fireEvent`). Ver `useLesson.test.tsx` e `LessonSlides.test.tsx` como moldes.
  - Vitest com `globals: true`, mas os arquivos existentes importam de `vitest` mesmo assim — **siga o padrão local: importe explicitamente**.
  - Tema: classes `cpj-*` (ex.: `text-cpj-white`, `bg-cpj-navy/20`, `border-cpj-white/10`, `bg-cpj-coral`, `ocean-bg`). Página raiz usa `<main className="ocean-bg min-h-screen text-cpj-white">` (ver `GoalsPage.tsx`). O conteúdo já renderiza dentro do `<Outlet>` do `AppLayout` (sidebar + área).
- **Tipos** (`src/types/content.ts`): `Module`, `Lesson`. `lessons` tem `unique(module_id, ordem)`; `youtube_id` e `texto_md` são `string | null`.
- **RLS confirmada** (`supabase/migrations/0002_content.sql`): `current_user_role() = 'autor'` lê módulos/aulas rascunho e escreve (`for all`) em `lessons`. **Nota de guarda:** um admin por allowlist de e-mail que NÃO tenha `role='autor'` no banco passa pelo `RequireRole` mas a RLS devolve só publicados e nega o UPDATE — a UI deve degradar (árvore possivelmente vazia; erro inline no Salvar). Aceitável na F1 (Diego é autor no banco); não trate como bug.

## File Structure (o que cada arquivo faz)

| Arquivo | Responsabilidade |
|---|---|
| `src/features/lesson/LessonSlides.tsx` (**modificar**) | Ganha prop `gated?: boolean` (default `true`). `gated={false}` desliga o bloqueio de tempo do "Próximo" — usado só no preview do autor. |
| `src/features/authoring/lessonDraft.ts` | Helpers **puros**: `toDraft(lesson)`, `isDirty(a,b)`, `draftToUpdate(draft)`. Zero React/Supabase. |
| `src/features/authoring/useAuthorTree.ts` | Lê TODOS os módulos e aulas (inclui rascunhos) e agrupa aulas por módulo. |
| `src/features/authoring/useSaveLesson.ts` | Mutation: `UPDATE lessons SET ... WHERE id`. Invalida a árvore do autor + as queries do aluno (`['lessons']`, `['lesson', id]`). |
| `src/features/authoring/AuthorTree.tsx` | Painel esquerdo: lista Módulos ▸ Aulas, marca rascunhos, destaca o selecionado, dispara `onSelectLesson`. |
| `src/features/authoring/LessonEditor.tsx` | Painel direito: form (título, YouTube ID, textarea `texto_md`, toggle publicado), preview em slides, botão Salvar, erro inline, aviso de não-salvo. Reporta `onDirtyChange`. |
| `src/features/authoring/AuthorPage.tsx` | Shell master–detail; estado de seleção; guarda "alterações não salvas" ao trocar de aula/sair. |
| `src/router.tsx` (**modificar**) | Troca `AutorStub` por `AuthorPage` na rota `/autor`. |
| `src/features/_stubs/index.tsx` (**modificar**) | Remove `AutorStub` (vira código morto). |

Ordem de build: LessonSlides → lessonDraft → useAuthorTree → useSaveLesson → AuthorTree → LessonEditor → AuthorPage → router/stub.

---

### Task 1: Gate opcional no `LessonSlides` (preview navegável)

**Files:**
- Modify: `src/features/lesson/LessonSlides.tsx`
- Test: `src/features/lesson/LessonSlides.test.tsx` (adicionar um caso)

- [ ] **Step 1: Escrever o teste que falha**

Adicione ao final do `describe('LessonSlides', ...)` em `src/features/lesson/LessonSlides.test.tsx`:

```tsx
  it('gated=false libera "Próximo" imediatamente (preview do autor)', () => {
    render(<LessonSlides markdown={MD} gated={false} />)
    // Sem avançar o relógio: o botão já deve estar habilitado e sem contagem.
    const next = screen.getByRole('button', { name: 'Próximo →' })
    expect(next).toBeEnabled()
    fireEvent.click(next)
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    // No slide seguinte continua livre (sem re-armar o gate).
    expect(screen.getByRole('button', { name: 'Próximo →' })).toBeEnabled()
  })
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/lesson/LessonSlides.test.tsx -t "preview do autor"`
Expected: FAIL — hoje o botão nasce como "Próximo em 5s" (disabled); `getByRole('button', { name: 'Próximo →' })` não encontra o elemento.

- [ ] **Step 3: Implementar a prop `gated`**

Em `src/features/lesson/LessonSlides.tsx`, altere a interface e a assinatura, e ajuste o `useEffect` do gate:

```tsx
interface LessonSlidesProps {
  markdown: string | null
  /**
   * Quando false, o "Próximo" nunca é bloqueado por tempo (navegação livre).
   * Usado no PREVIEW do editor do autor. Default true (comportamento do player).
   */
  gated?: boolean
}

export function LessonSlides({ markdown, gated = true }: LessonSlidesProps) {
```

E no efeito que re-arma a contagem, trate `!gated` como "sem gate":

```tsx
  // Re-arma o gate a cada slide. No último slide, ou quando o gate está
  // desligado (preview do autor), não há contagem: libera na hora.
  useEffect(() => {
    if (isLast || !gated) {
      setSecondsLeft(0)
      return
    }
    setSecondsLeft(SLIDE_UNLOCK_SECONDS)
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [index, isLast, gated])
```

Nenhuma outra linha muda (o `canAdvance = secondsLeft === 0` já cobre o caso livre).

- [ ] **Step 4: Rodar os testes do arquivo e ver passar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/lesson/LessonSlides.test.tsx`
Expected: PASS — o novo caso passa e os 6 casos antigos (gate default de 5s) continuam verdes.

- [ ] **Step 5: Commit**

```bash
cd /home/diego/contratapj-academy
git add src/features/lesson/LessonSlides.tsx src/features/lesson/LessonSlides.test.tsx
git commit -m "feat(lesson): LessonSlides aceita gated=false (navegacao livre p/ preview do autor)"
```

---

### Task 2: Helpers puros do formulário (`lessonDraft.ts`)

**Files:**
- Create: `src/features/authoring/lessonDraft.ts`
- Test: `src/features/authoring/lessonDraft.test.ts`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/features/authoring/lessonDraft.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Lesson } from '../../types/content'
import { draftToUpdate, isDirty, toDraft } from './lessonDraft'

const lesson: Lesson = {
  id: 'l1',
  module_id: 'm1',
  ordem: 1,
  titulo: 'Abertura',
  texto_md: '## 1. Oi\ncorpo',
  youtube_id: 'abc123',
  duracao_seg: null,
  publicado: false,
  created_at: '2026-01-01T00:00:00Z',
}

describe('toDraft', () => {
  it('mapeia a Lesson para o draft, convertendo null em string vazia', () => {
    expect(toDraft({ ...lesson, texto_md: null, youtube_id: null })).toEqual({
      titulo: 'Abertura',
      youtube_id: '',
      texto_md: '',
      publicado: false,
    })
  })
})

describe('isDirty', () => {
  it('é false quando os drafts são iguais', () => {
    expect(isDirty(toDraft(lesson), toDraft(lesson))).toBe(false)
  })
  it('é true quando qualquer campo muda', () => {
    const base = toDraft(lesson)
    expect(isDirty(base, { ...base, titulo: 'Outro' })).toBe(true)
    expect(isDirty(base, { ...base, publicado: true })).toBe(true)
    expect(isDirty(base, { ...base, texto_md: 'x' })).toBe(true)
  })
})

describe('draftToUpdate', () => {
  it('trima e converte strings vazias em null (youtube_id/texto_md)', () => {
    const patch = draftToUpdate({
      titulo: '  Título  ',
      youtube_id: '   ',
      texto_md: '',
      publicado: true,
    })
    expect(patch).toEqual({
      titulo: 'Título',
      youtube_id: null,
      texto_md: null,
      publicado: true,
    })
  })
  it('preserva conteúdo não vazio de texto_md sem trimar o miolo', () => {
    const patch = draftToUpdate({
      titulo: 'T',
      youtube_id: 'vid',
      texto_md: '## 1. A\n\n  linha indentada',
      publicado: false,
    })
    expect(patch.texto_md).toBe('## 1. A\n\n  linha indentada')
    expect(patch.youtube_id).toBe('vid')
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/lessonDraft.test.ts`
Expected: FAIL — "Cannot find module './lessonDraft'".

- [ ] **Step 3: Implementar os helpers**

Crie `src/features/authoring/lessonDraft.ts`:

```ts
/**
 * lessonDraft — estado editável de UMA aula no editor do autor, desacoplado da
 * forma persistida (`Lesson`). Puro: sem React, sem Supabase — testável isolado.
 *
 * Regras:
 *  - `null` (banco) <-> `''` (form): campos opcionais (`youtube_id`, `texto_md`)
 *    aparecem como string vazia no textarea/input e voltam a `null` ao salvar.
 *  - `draftToUpdate` trima `titulo`/`youtube_id`; NÃO trima o miolo de `texto_md`
 *    (indentação de listas/código importa), só decide vazio-vira-null pelo trim.
 */
import type { Lesson } from '../../types/content'

/** Campos que a F1 deixa o autor editar. */
export interface LessonDraft {
  titulo: string
  youtube_id: string
  texto_md: string
  publicado: boolean
}

/** Colunas de `lessons` que o UPDATE da F1 grava. */
export interface LessonUpdate {
  titulo: string
  youtube_id: string | null
  texto_md: string | null
  publicado: boolean
}

/** Converte a aula persistida no draft do form (null -> ''). */
export function toDraft(lesson: Lesson): LessonDraft {
  return {
    titulo: lesson.titulo,
    youtube_id: lesson.youtube_id ?? '',
    texto_md: lesson.texto_md ?? '',
    publicado: lesson.publicado,
  }
}

/** true se algum campo do draft difere do original. */
export function isDirty(a: LessonDraft, b: LessonDraft): boolean {
  return (
    a.titulo !== b.titulo ||
    a.youtube_id !== b.youtube_id ||
    a.texto_md !== b.texto_md ||
    a.publicado !== b.publicado
  )
}

/** Normaliza o draft para o patch do UPDATE ('' trimado -> null). */
export function draftToUpdate(draft: LessonDraft): LessonUpdate {
  const youtube = draft.youtube_id.trim()
  const texto = draft.texto_md.trim()
  return {
    titulo: draft.titulo.trim(),
    youtube_id: youtube === '' ? null : youtube,
    texto_md: texto === '' ? null : draft.texto_md,
    publicado: draft.publicado,
  }
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/lessonDraft.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
cd /home/diego/contratapj-academy
git add src/features/authoring/lessonDraft.ts src/features/authoring/lessonDraft.test.ts
git commit -m "feat(authoring): helpers puros de draft da aula (toDraft/isDirty/draftToUpdate)"
```

---

### Task 3: Leitura da árvore do autor (`useAuthorTree.ts`)

**Files:**
- Create: `src/features/authoring/useAuthorTree.ts`
- Test: `src/features/authoring/useAuthorTree.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/features/authoring/useAuthorTree.test.tsx`:

```tsx
/**
 * useAuthorTree: lê TODOS os módulos e aulas (inclusive rascunhos, que a RLS do
 * autor libera) e agrupa aulas por módulo. Mockamos só o supabase; QueryClient real.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const modules = [
  { id: 'm1', ordem: 1, titulo: 'Mod 1', descricao: null, capa_url: null, publicado: true, created_at: 't' },
  { id: 'm2', ordem: 2, titulo: 'Mod 2', descricao: null, capa_url: null, publicado: false, created_at: 't' },
]
const lessons = [
  { id: 'l1', module_id: 'm1', ordem: 1, titulo: 'Aula A', texto_md: null, youtube_id: null, duracao_seg: null, publicado: true, created_at: 't' },
  { id: 'l2', module_id: 'm1', ordem: 2, titulo: 'Aula B', texto_md: null, youtube_id: null, duracao_seg: null, publicado: false, created_at: 't' },
  { id: 'l3', module_id: 'm2', ordem: 1, titulo: 'Aula C', texto_md: null, youtube_id: null, duracao_seg: null, publicado: false, created_at: 't' },
]

// Encadeável que resolve conforme a tabela pedida em `.from(table)`.
function makeChain(table: string) {
  const rows = table === 'modules' ? modules : lessons
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  // A cadeia é "thenável": o await final resolve os dados.
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data: rows, error: null })
  return chain
}
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn((table: string) => makeChain(table)) },
}))

import { useAuthorTree } from './useAuthorTree'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

afterEach(() => vi.clearAllMocks())

describe('useAuthorTree', () => {
  it('devolve módulos ordenados e aulas agrupadas por módulo (com rascunhos)', async () => {
    const { result } = renderHook(() => useAuthorTree(), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(result.current.modules.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(result.current.lessonsByModule['m1'].map((l) => l.id)).toEqual(['l1', 'l2'])
    expect(result.current.lessonsByModule['m2'].map((l) => l.id)).toEqual(['l3'])
    // Rascunho presente (não filtrou por publicado).
    expect(result.current.modules.some((m) => !m.publicado)).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/useAuthorTree.test.tsx`
Expected: FAIL — "Cannot find module './useAuthorTree'".

- [ ] **Step 3: Implementar o hook**

Crie `src/features/authoring/useAuthorTree.ts`:

```ts
/**
 * useAuthorTree — camada de leitura da árvore do CMS do autor.
 *
 * Responsabilidade ÚNICA: buscar TODOS os módulos e TODAS as aulas (SEM filtro
 * `publicado` — a RLS do papel `autor` já libera rascunhos, ver
 * `0002_content.sql`) e agrupar as aulas por `module_id`, prontas para a árvore.
 *
 * Chaves de query (`['author_tree', ...]`) são separadas das do aluno
 * (`['modules']`/`['lessons']`) porque o conjunto é diferente (inclui rascunhos);
 * o `useSaveLesson` invalida ambas para manter aluno e autor coerentes.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { Lesson, Module } from '../../types/content'

async function fetchAllModules(): Promise<Module[]> {
  const { data, error } = await supabase
    .from('modules')
    .select('*')
    .order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []) as Module[]
}

async function fetchAllLessons(): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .order('module_id', { ascending: true })
    .order('ordem', { ascending: true })
  if (error) throw error
  return (data ?? []) as Lesson[]
}

/** Agrupa aulas por módulo preservando a ordem vinda do banco. */
function groupByModule(lessons: Lesson[]): Record<string, Lesson[]> {
  const map: Record<string, Lesson[]> = {}
  for (const lesson of lessons) {
    ;(map[lesson.module_id] ??= []).push(lesson)
  }
  return map
}

export interface UseAuthorTreeResult {
  modules: Module[]
  lessonsByModule: Record<string, Lesson[]>
  isLoading: boolean
  isError: boolean
  error: unknown
}

export function useAuthorTree(): UseAuthorTreeResult {
  const modulesQuery = useQuery({
    queryKey: ['author_tree', 'modules'],
    queryFn: fetchAllModules,
  })
  const lessonsQuery = useQuery({
    queryKey: ['author_tree', 'lessons'],
    queryFn: fetchAllLessons,
  })

  return {
    modules: modulesQuery.data ?? [],
    lessonsByModule: groupByModule(lessonsQuery.data ?? []),
    isLoading: modulesQuery.isLoading || lessonsQuery.isLoading,
    isError: modulesQuery.isError || lessonsQuery.isError,
    error: modulesQuery.error ?? lessonsQuery.error,
  }
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/useAuthorTree.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/diego/contratapj-academy
git add src/features/authoring/useAuthorTree.ts src/features/authoring/useAuthorTree.test.tsx
git commit -m "feat(authoring): useAuthorTree le modulos+aulas (inclui rascunhos) agrupados"
```

---

### Task 4: Mutation de salvar aula (`useSaveLesson.ts`)

**Files:**
- Create: `src/features/authoring/useSaveLesson.ts`
- Test: `src/features/authoring/useSaveLesson.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/features/authoring/useSaveLesson.test.tsx`:

```tsx
/**
 * useSaveLesson: UPDATE em `lessons` pelo id e, no sucesso, invalida a árvore do
 * autor E as queries do aluno (para o player/home refletirem publicação/edição).
 * Mockamos o supabase (update().eq() resolve) e espionamos invalidateQueries.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const eqMock = vi.fn().mockResolvedValue({ error: null })
const updateMock = vi.fn(() => ({ eq: eqMock }))
vi.mock('../../lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ update: updateMock })) },
}))

import { useSaveLesson } from './useSaveLesson'

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

afterEach(() => vi.clearAllMocks())

describe('useSaveLesson', () => {
  it('faz UPDATE pelo id com o patch e invalida árvore + queries do aluno', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useSaveLesson(), {
      wrapper: makeWrapper(qc),
    })

    const patch = { titulo: 'Novo', youtube_id: null, texto_md: 'x', publicado: true }
    result.current.save({ id: 'l1', patch })

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1))
    expect(updateMock).toHaveBeenCalledWith(patch)
    expect(eqMock).toHaveBeenCalledWith('id', 'l1')

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['author_tree', 'lessons'],
      }),
    )
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['lessons'] })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['lesson', 'l1'] })
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/useSaveLesson.test.tsx`
Expected: FAIL — "Cannot find module './useSaveLesson'".

- [ ] **Step 3: Implementar o hook**

Crie `src/features/authoring/useSaveLesson.ts`:

```ts
/**
 * useSaveLesson — mutation que persiste a edição de UMA aula (UPDATE em `lessons`
 * pelo id). Só o autor tem policy de UPDATE (RLS `lessons_write_autor`).
 *
 * Invalidação no sucesso:
 *  - `['author_tree', 'lessons']` → a árvore do CMS reflete título/publicado;
 *  - `['lessons']` e `['lesson', id]` → Home e player do ALUNO refletem a
 *    publicação/edição (mesmas chaves de `useHomeData.ts` e `useLesson.ts`).
 *
 * NÃO faz otimismo nem toca no cache diretamente: invalidar e refazer é simples
 * e suficiente para o volume do CMS.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { LessonUpdate } from './lessonDraft'

export interface SaveLessonVars {
  id: string
  patch: LessonUpdate
}

async function updateLesson({ id, patch }: SaveLessonVars): Promise<void> {
  const { error } = await supabase.from('lessons').update(patch).eq('id', id)
  if (error) throw error
}

export interface UseSaveLessonResult {
  save: (vars: SaveLessonVars) => void
  isSaving: boolean
  isError: boolean
  isSuccess: boolean
  error: unknown
  /** Zera o estado de erro/sucesso (ex.: ao trocar de aula). */
  reset: () => void
}

export function useSaveLesson(): UseSaveLessonResult {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: updateLesson,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['author_tree', 'lessons'] })
      void queryClient.invalidateQueries({ queryKey: ['lessons'] })
      void queryClient.invalidateQueries({ queryKey: ['lesson', vars.id] })
    },
  })

  return {
    save: (vars) => mutation.mutate(vars),
    isSaving: mutation.isPending,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    reset: () => mutation.reset(),
  }
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/useSaveLesson.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/diego/contratapj-academy
git add src/features/authoring/useSaveLesson.ts src/features/authoring/useSaveLesson.test.tsx
git commit -m "feat(authoring): useSaveLesson faz UPDATE da aula e invalida autor+aluno"
```

---

### Task 5: Árvore Módulos ▸ Aulas (`AuthorTree.tsx`)

**Files:**
- Create: `src/features/authoring/AuthorTree.tsx`
- Test: `src/features/authoring/AuthorTree.test.tsx`

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/features/authoring/AuthorTree.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Lesson, Module } from '../../types/content'
import { AuthorTree } from './AuthorTree'

const modules: Module[] = [
  { id: 'm1', ordem: 1, titulo: 'Fundamentos', descricao: null, capa_url: null, publicado: true, created_at: 't' },
  { id: 'm2', ordem: 2, titulo: 'Avançado', descricao: null, capa_url: null, publicado: false, created_at: 't' },
]
const lessonsByModule: Record<string, Lesson[]> = {
  m1: [
    { id: 'l1', module_id: 'm1', ordem: 1, titulo: 'Aula A', texto_md: null, youtube_id: null, duracao_seg: null, publicado: true, created_at: 't' },
    { id: 'l2', module_id: 'm1', ordem: 2, titulo: 'Aula B', texto_md: null, youtube_id: null, duracao_seg: null, publicado: false, created_at: 't' },
  ],
  m2: [],
}

describe('AuthorTree', () => {
  it('lista módulos e aulas e chama onSelectLesson ao clicar numa aula', () => {
    const onSelect = vi.fn()
    render(
      <AuthorTree
        modules={modules}
        lessonsByModule={lessonsByModule}
        selectedLessonId={null}
        onSelectLesson={onSelect}
      />,
    )
    expect(screen.getByText('Fundamentos')).toBeInTheDocument()
    expect(screen.getByText('Avançado')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Aula B/ }))
    expect(onSelect).toHaveBeenCalledWith('l2')
  })

  it('marca a aula selecionada com aria-current', () => {
    render(
      <AuthorTree
        modules={modules}
        lessonsByModule={lessonsByModule}
        selectedLessonId="l1"
        onSelectLesson={vi.fn()}
      />,
    )
    const selected = screen.getByRole('button', { name: /Aula A/ })
    expect(selected).toHaveAttribute('aria-current', 'true')
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/AuthorTree.test.tsx`
Expected: FAIL — "Cannot find module './AuthorTree'".

- [ ] **Step 3: Implementar o componente**

Crie `src/features/authoring/AuthorTree.tsx`:

```tsx
/**
 * AuthorTree — painel ESQUERDO do CMS: a árvore Módulos ▸ Aulas (leitura).
 *
 * Só navegação: cada aula é um botão que dispara `onSelectLesson(id)`. Marca
 * rascunhos com um selo e destaca a aula selecionada (`aria-current`). F1 não
 * cria/reordena — isso chega na F2.
 */
import type { Lesson, Module } from '../../types/content'

interface AuthorTreeProps {
  modules: Module[]
  lessonsByModule: Record<string, Lesson[]>
  selectedLessonId: string | null
  onSelectLesson: (lessonId: string) => void
}

function DraftBadge() {
  return (
    <span className="ml-2 rounded-full bg-cpj-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cpj-white/60">
      rascunho
    </span>
  )
}

export function AuthorTree({
  modules,
  lessonsByModule,
  selectedLessonId,
  onSelectLesson,
}: AuthorTreeProps) {
  return (
    <nav aria-label="Módulos e aulas" className="flex flex-col gap-4">
      {modules.map((module) => {
        const lessons = lessonsByModule[module.id] ?? []
        return (
          <div key={module.id}>
            <div className="flex items-center px-2 text-sm font-semibold text-cpj-white/80">
              <span className="tabular-nums text-cpj-white/40">
                {module.ordem}.
              </span>
              <span className="ml-2">{module.titulo}</span>
              {!module.publicado && <DraftBadge />}
            </div>
            <ul className="mt-1 flex flex-col">
              {lessons.length === 0 && (
                <li className="px-4 py-1 text-xs text-cpj-white/40">
                  (sem aulas)
                </li>
              )}
              {lessons.map((lesson) => {
                const isSelected = lesson.id === selectedLessonId
                return (
                  <li key={lesson.id}>
                    <button
                      type="button"
                      onClick={() => onSelectLesson(lesson.id)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`flex w-full items-center rounded-lg px-4 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal ${
                        isSelected
                          ? 'bg-cpj-royal/25 text-cpj-white'
                          : 'text-cpj-white/70 hover:bg-cpj-white/5'
                      }`}
                    >
                      <span className="tabular-nums text-cpj-white/40">
                        {lesson.ordem}.
                      </span>
                      <span className="ml-2 truncate">{lesson.titulo}</span>
                      {!lesson.publicado && <DraftBadge />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/AuthorTree.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/diego/contratapj-academy
git add src/features/authoring/AuthorTree.tsx src/features/authoring/AuthorTree.test.tsx
git commit -m "feat(authoring): AuthorTree (arvore Modulos>Aulas com selecao e selo de rascunho)"
```

---

### Task 6: Editor de aula (`LessonEditor.tsx`)

**Files:**
- Create: `src/features/authoring/LessonEditor.tsx`
- Test: `src/features/authoring/LessonEditor.test.tsx`

Notas de design:
- O editor detém o `draft` (via `toDraft(lesson)` no mount). O reset ao trocar de aula é feito pelo **pai** com `key={lesson.id}` (remonte) — o editor não precisa de `useEffect` de sincronização com a prop.
- Reporta o estado sujo para o pai via `onDirtyChange(dirty)` num `useEffect`, para o pai avisar antes de trocar de aula.
- Ao salvar com sucesso, "rebaixa" o `baseline` para o draft salvo (o form deixa de estar sujo sem remonte).

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/features/authoring/LessonEditor.test.tsx`:

```tsx
/**
 * LessonEditor: edita título/YouTube/texto/publicado, mostra "alterações não
 * salvas" quando sujo, salva via useSaveLesson e exibe erro inline na falha.
 * Mockamos useSaveLesson (não o supabase) para dirigir sucesso/erro/estado.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Lesson } from '../../types/content'

const saveMock = vi.fn()
let saveState = {
  save: saveMock,
  isSaving: false,
  isError: false,
  isSuccess: false,
  error: null as unknown,
  reset: vi.fn(),
}
vi.mock('./useSaveLesson', () => ({
  useSaveLesson: () => saveState,
}))
// Preview não é o foco aqui; stub simples evita depender do render de markdown.
vi.mock('../lesson/LessonSlides', () => ({
  LessonSlides: ({ markdown }: { markdown: string | null }) => (
    <div data-testid="preview">{markdown}</div>
  ),
}))

import { LessonEditor } from './LessonEditor'

const lesson: Lesson = {
  id: 'l1',
  module_id: 'm1',
  ordem: 1,
  titulo: 'Abertura',
  texto_md: '## 1. Oi\ncorpo',
  youtube_id: 'abc',
  duracao_seg: null,
  publicado: false,
  created_at: 't',
}

afterEach(() => {
  vi.clearAllMocks()
  saveState = { save: saveMock, isSaving: false, isError: false, isSuccess: false, error: null, reset: vi.fn() }
})

describe('LessonEditor', () => {
  it('Salvar começa desabilitado (sem alterações) e habilita ao editar', () => {
    render(<LessonEditor lesson={lesson} onDirtyChange={vi.fn()} />)
    const salvar = screen.getByRole('button', { name: /Salvar/ })
    expect(salvar).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/Título/), {
      target: { value: 'Abertura!' },
    })
    expect(salvar).toBeEnabled()
    expect(screen.getByText(/alterações não salvas/i)).toBeInTheDocument()
  })

  it('ao salvar, chama save com id e patch normalizado', () => {
    render(<LessonEditor lesson={lesson} onDirtyChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/YouTube/), {
      target: { value: '  ' }, // vira null
    })
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }))
    expect(saveMock).toHaveBeenCalledWith({
      id: 'l1',
      patch: { titulo: 'Abertura', youtube_id: null, texto_md: '## 1. Oi\ncorpo', publicado: false },
    })
  })

  it('mostra erro inline quando isError', () => {
    saveState = { ...saveState, isError: true, error: new Error('RLS') }
    render(<LessonEditor lesson={lesson} onDirtyChange={vi.fn()} />)
    expect(screen.getByText(/não foi possível salvar/i)).toBeInTheDocument()
  })

  it('reflete o texto no preview conforme edita o textarea', () => {
    render(<LessonEditor lesson={lesson} onDirtyChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/Conteúdo/), {
      target: { value: '## 1. Novo\nx' },
    })
    expect(screen.getByTestId('preview')).toHaveTextContent('## 1. Novo')
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/LessonEditor.test.tsx`
Expected: FAIL — "Cannot find module './LessonEditor'".

- [ ] **Step 3: Implementar o componente**

Crie `src/features/authoring/LessonEditor.tsx`:

```tsx
/**
 * LessonEditor — painel DIREITO do CMS: edição de UMA aula.
 *
 * Form: título, YouTube ID, textarea de `texto_md`, toggle Publicado/Rascunho.
 * Ao lado, PREVIEW em slides (LessonSlides com `gated={false}` = livre).
 * Botão Salvar (UPDATE via useSaveLesson) só habilita quando há alteração.
 *
 * Estado: o `draft` nasce de `toDraft(lesson)`. O RESET ao trocar de aula é do
 * pai (`key={lesson.id}` remonta este componente). Após salvar com sucesso,
 * rebaixamos o `baseline` para o draft salvo, então "sujo" volta a false sem
 * remonte. Reportamos `onDirtyChange(dirty)` para o pai guardar a troca de item.
 */
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Lesson } from '../../types/content'
import { LessonSlides } from '../lesson/LessonSlides'
import { draftToUpdate, isDirty, toDraft, type LessonDraft } from './lessonDraft'
import { useSaveLesson } from './useSaveLesson'

interface LessonEditorProps {
  lesson: Lesson
  /** Informa ao pai se há alterações não salvas (para guardar a troca de item). */
  onDirtyChange: (dirty: boolean) => void
}

export function LessonEditor({ lesson, onDirtyChange }: LessonEditorProps) {
  const initial = useMemo(() => toDraft(lesson), [lesson])
  // `baseline` = referência de "salvo". Começa igual ao initial; após salvar,
  // vira o draft salvo (para o form deixar de estar sujo sem remonte).
  const [baseline, setBaseline] = useState<LessonDraft>(initial)
  const [draft, setDraft] = useState<LessonDraft>(initial)
  const { save, isSaving, isError, isSuccess, reset } = useSaveLesson()

  const dirty = isDirty(baseline, draft)

  // Avisa o pai sobre o estado sujo (guarda de "trocar de aula com alterações").
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  // Ao concluir o save, o draft atual passa a ser o novo "salvo".
  useEffect(() => {
    if (isSuccess) {
      setBaseline(draft)
      reset()
    }
    // Só reagimos à borda de sucesso; `draft` aqui é o que acabou de ser enviado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess])

  // Aviso do navegador ao FECHAR/atualizar a aba com alterações não salvas.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const set = <K extends keyof LessonDraft>(key: K, value: LessonDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || isSaving) return
    save({ id: lesson.id, patch: draftToUpdate(draft) })
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {/* Cabeçalho: título do editor + estado sujo/salvando. */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-cpj-white">Editar aula</h2>
        {dirty && (
          <span className="text-xs font-semibold text-cpj-coral">
            • alterações não salvas
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coluna do formulário. */}
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-cpj-white/80">Título</span>
            <input
              type="text"
              value={draft.titulo}
              onChange={(e) => set('titulo', e.target.value)}
              className="rounded-xl border border-cpj-white/15 bg-cpj-navy/20 px-3 py-2 text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-cpj-white/80">YouTube ID</span>
            <input
              type="text"
              value={draft.youtube_id}
              onChange={(e) => set('youtube_id', e.target.value)}
              placeholder="ex.: dQw4w9WgXcQ"
              className="rounded-xl border border-cpj-white/15 bg-cpj-navy/20 px-3 py-2 text-cpj-white placeholder:text-cpj-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-cpj-white/80">Conteúdo (Markdown)</span>
            <textarea
              value={draft.texto_md}
              onChange={(e) => set('texto_md', e.target.value)}
              rows={16}
              className="rounded-xl border border-cpj-white/15 bg-cpj-navy/20 px-3 py-2 font-mono text-sm text-cpj-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-royal"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.publicado}
              onChange={(e) => set('publicado', e.target.checked)}
              className="h-4 w-4 accent-cpj-coral"
            />
            <span className="font-semibold text-cpj-white/80">
              Publicado {draft.publicado ? '' : '(rascunho)'}
            </span>
          </label>
        </div>

        {/* Coluna do preview em slides (navegação livre). */}
        <div className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/10 p-4">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-cpj-white/40">
            Pré-visualização
          </div>
          <LessonSlides markdown={draft.texto_md || null} gated={false} />
        </div>
      </div>

      {/* Erro inline: mantém o form editável para retry. */}
      {isError && (
        <p className="text-sm text-cpj-coral">
          Não foi possível salvar. Verifique sua conexão/permissão e tente de novo.
        </p>
      )}

      <div className="flex items-center gap-3 border-t border-cpj-white/10 pt-4">
        <button
          type="submit"
          disabled={!dirty || isSaving}
          className="rounded-xl bg-cpj-coral px-5 py-2.5 text-sm font-semibold text-cpj-white transition hover:bg-cpj-coral/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cpj-coral disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/LessonEditor.test.tsx`
Expected: PASS (4 casos).

- [ ] **Step 5: Commit**

```bash
cd /home/diego/contratapj-academy
git add src/features/authoring/LessonEditor.tsx src/features/authoring/LessonEditor.test.tsx
git commit -m "feat(authoring): LessonEditor (form + preview em slides + salvar/erro/dirty)"
```

---

### Task 7: Shell master–detail (`AuthorPage.tsx`)

**Files:**
- Create: `src/features/authoring/AuthorPage.tsx`
- Test: `src/features/authoring/AuthorPage.test.tsx`

Notas de design:
- `AuthorPage` usa `useAuthorTree`, guarda `selectedLessonId` e resolve a `Lesson` selecionada varrendo `lessonsByModule`.
- Renderiza `<LessonEditor key={selectedLessonId} .../>` — a `key` garante remonte (draft limpo) ao trocar de aula.
- Guarda de "alterações não salvas": um `useRef(false)` é atualizado pelo `onDirtyChange` do editor. Ao clicar noutra aula com o ref `true`, chama `window.confirm(...)`; só troca se confirmar.
- Estados: loading (skeleton), erro, vazio ("selecione uma aula").

- [ ] **Step 1: Escrever o teste que falha**

Crie `src/features/authoring/AuthorPage.test.tsx`:

```tsx
/**
 * AuthorPage: compõe árvore + editor. Testes-chave: seleção abre o editor; e
 * trocar de aula COM alterações pendentes pede confirmação (window.confirm).
 * Mockamos useAuthorTree (dados) e LessonEditor (para dirigir onDirtyChange).
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Lesson, Module } from '../../types/content'

const modules: Module[] = [
  { id: 'm1', ordem: 1, titulo: 'Mod 1', descricao: null, capa_url: null, publicado: true, created_at: 't' },
]
const lessonsByModule: Record<string, Lesson[]> = {
  m1: [
    { id: 'l1', module_id: 'm1', ordem: 1, titulo: 'Aula A', texto_md: null, youtube_id: null, duracao_seg: null, publicado: true, created_at: 't' },
    { id: 'l2', module_id: 'm1', ordem: 2, titulo: 'Aula B', texto_md: null, youtube_id: null, duracao_seg: null, publicado: false, created_at: 't' },
  ],
}
let treeState = { modules, lessonsByModule, isLoading: false, isError: false, error: null as unknown }
vi.mock('./useAuthorTree', () => ({ useAuthorTree: () => treeState }))

// Editor stub: mostra o id da aula e um botão que "suja" o form via onDirtyChange.
vi.mock('./LessonEditor', () => ({
  LessonEditor: ({ lesson, onDirtyChange }: { lesson: Lesson; onDirtyChange: (d: boolean) => void }) => (
    <div>
      <span data-testid="editing">{lesson.id}</span>
      <button type="button" onClick={() => onDirtyChange(true)}>sujar</button>
    </div>
  ),
}))

import { AuthorPage } from './AuthorPage'

afterEach(() => {
  vi.clearAllMocks()
  treeState = { modules, lessonsByModule, isLoading: false, isError: false, error: null }
})

describe('AuthorPage', () => {
  it('sem seleção mostra o placeholder', () => {
    render(<AuthorPage />)
    expect(screen.getByText(/selecione uma aula/i)).toBeInTheDocument()
  })

  it('selecionar uma aula abre o editor dela', () => {
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Aula A/ }))
    expect(screen.getByTestId('editing')).toHaveTextContent('l1')
  })

  it('trocar de aula com alterações pendentes pede confirmação e respeita o "cancelar"', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Aula A/ }))
    // Suja o editor da Aula A.
    fireEvent.click(screen.getByRole('button', { name: 'sujar' }))
    // Tenta ir para a Aula B: confirm retorna false → permanece em l1.
    fireEvent.click(screen.getByRole('button', { name: /Aula B/ }))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('editing')).toHaveTextContent('l1')
  })

  it('troca quando o usuário confirma o descarte', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AuthorPage />)
    fireEvent.click(screen.getByRole('button', { name: /Aula A/ }))
    fireEvent.click(screen.getByRole('button', { name: 'sujar' }))
    fireEvent.click(screen.getByRole('button', { name: /Aula B/ }))
    expect(screen.getByTestId('editing')).toHaveTextContent('l2')
  })
})
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/AuthorPage.test.tsx`
Expected: FAIL — "Cannot find module './AuthorPage'".

- [ ] **Step 3: Implementar o componente**

Crie `src/features/authoring/AuthorPage.tsx`:

```tsx
/**
 * AuthorPage — CMS do autor (rota /autor), F1: EDITOR DE AULA.
 *
 * Master–detail: à esquerda a AuthorTree (Módulos ▸ Aulas), à direita o
 * LessonEditor da aula selecionada. Sem recarregar a página.
 *
 * Guarda de "alterações não salvas": o editor reporta o estado sujo por
 * `onDirtyChange`; guardamos num ref e, ao trocar de aula com o ref true,
 * pedimos confirmação (window.confirm) antes de descartar.
 *
 * F1 não cria/exclui/reordena (isso é F2) nem edita quiz (F3).
 */
import { useCallback, useRef, useState } from 'react'
import { AuthorTree } from './AuthorTree'
import { LessonEditor } from './LessonEditor'
import { useAuthorTree } from './useAuthorTree'

function AuthorSkeleton() {
  return (
    <div className="flex animate-pulse gap-6 p-6">
      <div className="h-96 w-72 rounded-2xl bg-cpj-navy/40" />
      <div className="h-96 flex-1 rounded-2xl bg-cpj-navy/40" />
    </div>
  )
}

export function AuthorPage() {
  const { modules, lessonsByModule, isLoading, isError } = useAuthorTree()
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  // Estado sujo do editor atual, sem re-render do pai a cada tecla.
  const dirtyRef = useRef(false)

  const onDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty
  }, [])

  const selectLesson = (lessonId: string) => {
    if (lessonId === selectedLessonId) return
    if (dirtyRef.current) {
      const ok = window.confirm(
        'Você tem alterações não salvas nesta aula. Descartar e trocar?',
      )
      if (!ok) return
    }
    dirtyRef.current = false
    setSelectedLessonId(lessonId)
  }

  // Resolve a aula selecionada varrendo os grupos (a árvore é pequena).
  const selectedLesson = selectedLessonId
    ? Object.values(lessonsByModule)
        .flat()
        .find((l) => l.id === selectedLessonId) ?? null
    : null

  if (isLoading) {
    return (
      <main className="ocean-bg min-h-screen text-cpj-white">
        <AuthorSkeleton />
      </main>
    )
  }

  return (
    <main className="ocean-bg min-h-screen text-cpj-white">
      <div className="grid gap-6 p-4 md:p-6 lg:grid-cols-[18rem_1fr]">
        {/* Painel esquerdo: árvore. */}
        <aside className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/10 p-3">
          <h1 className="mb-3 px-2 text-sm font-bold uppercase tracking-wide text-cpj-white/50">
            Conteúdo
          </h1>
          {isError ? (
            <p className="px-2 text-sm text-cpj-coral">
              Não foi possível carregar o conteúdo (sem acesso ou falha de rede).
            </p>
          ) : (
            <AuthorTree
              modules={modules}
              lessonsByModule={lessonsByModule}
              selectedLessonId={selectedLessonId}
              onSelectLesson={selectLesson}
            />
          )}
        </aside>

        {/* Painel direito: editor ou placeholder. `key` remonta ao trocar. */}
        <section className="rounded-2xl border border-cpj-white/10 bg-cpj-navy/10 p-4 md:p-6">
          {selectedLesson ? (
            <LessonEditor
              key={selectedLesson.id}
              lesson={selectedLesson}
              onDirtyChange={onDirtyChange}
            />
          ) : (
            <div className="flex h-full min-h-[16rem] items-center justify-center text-center text-cpj-white/50">
              Selecione uma aula na árvore para editar.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default AuthorPage
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd /home/diego/contratapj-academy && npx vitest run src/features/authoring/AuthorPage.test.tsx`
Expected: PASS (4 casos).

- [ ] **Step 5: Commit**

```bash
cd /home/diego/contratapj-academy
git add src/features/authoring/AuthorPage.tsx src/features/authoring/AuthorPage.test.tsx
git commit -m "feat(authoring): AuthorPage master-detail + guarda de alteracoes nao salvas"
```

---

### Task 8: Ligar na rota `/autor` e remover o stub

**Files:**
- Modify: `src/router.tsx:10` (import) e `src/router.tsx:75-83` (elemento da rota)
- Modify: `src/features/_stubs/index.tsx:23-30` (remover `AutorStub`)

- [ ] **Step 1: Trocar o elemento da rota**

Em `src/router.tsx`, ajuste o import (linha 10) para NÃO trazer mais `AutorStub` e adicionar `AuthorPage`:

```tsx
import { GestorStub } from './features/_stubs'
import { AuthorPage } from './features/authoring/AuthorPage'
```

E o bloco da rota `/autor` (mantém a proteção `RequireRole allow={['autor']}`):

```tsx
      {
        // CMS do autor (F1: editor de aula). Dentro do layout, restrito a autor
        // (+ admins via bypass do RequireRole).
        path: '/autor',
        element: (
          <RequireRole allow={['autor']}>
            <AuthorPage />
          </RequireRole>
        ),
      },
```

- [ ] **Step 2: Remover o `AutorStub` (código morto)**

Em `src/features/_stubs/index.tsx`, apague o bloco do `AutorStub` (linhas 23-30, incluindo o comentário `// TODO Fase 5/6: ... CMS real do autor.`). Deixe `HomeStub` e `GestorStub` intactos.

- [ ] **Step 3: Verificar tipos e lint (o import morto quebraria o build)**

Run: `cd /home/diego/contratapj-academy && npx tsc -b --noEmit && npm run lint`
Expected: sem erros. (Se `tsc` reclamar de `AutorStub` inexistente em algum lugar, é referência remanescente — corrija.)

- [ ] **Step 4: Rodar a suíte inteira**

Run: `cd /home/diego/contratapj-academy && npm test`
Expected: PASS — toda a suíte, incluindo os novos arquivos de `authoring/` e o caso novo de `LessonSlides`.

- [ ] **Step 5: Commit**

```bash
cd /home/diego/contratapj-academy
git add src/router.tsx src/features/_stubs/index.tsx
git commit -m "feat(authoring): monta o CMS do autor (F1) na rota /autor e remove o AutorStub"
```

---

### Task 9: Verificação final e build de produção

**Files:** nenhum (checagem).

- [ ] **Step 1: Build de produção (o que o deploy roda)**

Run: `cd /home/diego/contratapj-academy && npm run build`
Expected: `tsc -b && vite build` sem erros; bundle gerado.

- [ ] **Step 2: Smoke manual (opcional, recomendado)**

Run: `cd /home/diego/contratapj-academy && npm run dev` e abrir `/autor` logado como autor.
Verificar: a árvore lista módulos/aulas (com rascunhos); clicar numa aula abre o editor; editar o texto muda o preview em slides (navegação livre, sem contagem); Salvar persiste e some o aviso "alterações não salvas"; alternar Publicado e salvar; tentar trocar de aula com edição pendente pede confirmação.

- [ ] **Step 3: Deploy**

A `main` é bloqueada para o Claude — **Diego** faz o push:

```bash
cd /home/diego/contratapj-academy && git push origin main
```

Isso dispara o GitHub Pages. "Feito" só após o run de deploy concluir e `/autor` funcionar em `academy.contratapj.app.br` (ver §Rollout do spec).

---

## Self-Review (feito na escrita do plano)

**1. Cobertura do spec (F1):**
- Tela `/autor` master-detail, árvore lê módulos+aulas → Tasks 5, 7. ✅
- Selecionar aula abre editor com título, YouTube ID, textarea `texto_md`, preview em slides (LessonSlides navegável), Salvar (UPDATE lessons), toggle Publicado/Rascunho, aviso de não-salvo → Tasks 1, 6. ✅
- Sem criar/excluir/reordenar (fora da F1) → respeitado. ✅
- Substitui `AutorStub` na rota → Task 8. ✅
- Tratamento de erro inline + estado editável para retry → Task 6 (`isError`); árvore com erro/sem-acesso → Task 7. ✅
- Testes: helper puro (`lessonDraft`), árvore seleciona, editor salva/erro, preview renderiza, toggle publicar → Tasks 2,5,6,7. ✅
- Sem migration; deploy por push na main, por fase → Task 9. ✅

**2. Placeholders:** nenhum "TODO/handle edge cases/etc." nos steps — todo passo traz código/comando/expected concretos.

**3. Consistência de tipos:** `LessonDraft`/`LessonUpdate` definidos na Task 2 e usados igual em `useSaveLesson` (Task 4, `SaveLessonVars.patch: LessonUpdate`) e `LessonEditor` (Task 6, `draftToUpdate(draft)`). `useAuthorTree` retorna `{ modules, lessonsByModule, ... }`, consumido com esses nomes em `AuthorPage` (Task 7) e `AuthorTree` (Task 5). `LessonSlides` ganha `gated` (Task 1) e é chamado com `gated={false}` na Task 6. Query keys batem entre `useSaveLesson` (invalida `['author_tree','lessons']`) e `useAuthorTree` (define `['author_tree','lessons']`). ✅
