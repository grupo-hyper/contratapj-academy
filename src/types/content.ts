/**
 * Tipos compartilhados do conteúdo (ContrataPJ Academy).
 *
 * Espelham o schema da migration `supabase/migrations/0002_content.sql`.
 * Nomes de campos em snake_case porque é o que o PostgREST/Supabase retorna.
 * Manter em sincronia com o SQL: qualquer mudança de coluna reflete aqui.
 */

/** Papéis de conteúdo (reexport conveniente do papel do perfil). */
export type Role = 'aluno' | 'gestor' | 'autor'

/** Módulo (12 no total, ordem 1..12). Tabela `modules`. */
export interface Module {
  id: string
  ordem: number
  titulo: string
  descricao: string | null
  capa_url: string | null
  publicado: boolean
  created_at: string
}

/** Aula/playbook. Tabela `lessons`. unique(module_id, ordem). */
export interface Lesson {
  id: string
  module_id: string
  ordem: number
  titulo: string
  texto_md: string | null
  youtube_id: string | null
  duracao_seg: number | null
  publicado: boolean
  created_at: string
}

/** Pergunta do teste do módulo. Tabela `questions`. */
export interface Question {
  id: string
  module_id: string
  enunciado: string
  created_at: string
}

/**
 * Alternativa (tabela base `question_options`), inclui `correta`.
 * ATENÇÃO: `correta` só é legível pelo autor/serviço — o aluno NUNCA recebe
 * esta forma via PostgREST (a RLS da base bloqueia). Use este tipo apenas em
 * contexto de CMS/autor ou correção server-side (RPC definer na Fase 4).
 */
export interface QuestionOption {
  id: string
  question_id: string
  texto: string
  correta: boolean
  created_at: string
}

/**
 * Alternativa exposta ao aluno via a view `question_options_public`
 * (sem o campo `correta`). É esta a forma usada para montar o quiz.
 */
export interface QuestionOptionPublic {
  id: string
  question_id: string
  texto: string
}

/**
 * Progresso do aluno em uma aula. Tabela `lesson_progress`
 * (ver `supabase/migrations/0003_progress.sql`). unique(profile_id, lesson_id).
 * Owner-only via RLS: cada usuário só lê/escreve as próprias linhas.
 * `pct` é 0..100; `concluida = true` conta a aula como concluída para a trilha.
 */
export interface LessonProgress {
  id: string
  profile_id: string
  lesson_id: string
  pct: number
  concluida: boolean
  updated_at: string
}
