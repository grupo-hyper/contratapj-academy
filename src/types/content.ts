/**
 * Tipos compartilhados do conteúdo (ContrataPJ Academy).
 *
 * Espelham o schema da migration `supabase/migrations/0002_content.sql`.
 * Nomes de campos em snake_case porque é o que o PostgREST/Supabase retorna.
 * Manter em sincronia com o SQL: qualquer mudança de coluna reflete aqui.
 */

/** Papéis de conteúdo (reexport conveniente do papel do perfil). */
export type Role = 'aluno' | 'gestor' | 'autor'

/**
 * Área (time/trilha de playbooks). Tabela `areas`
 * (ver `supabase/migrations/0009_areas.sql`).
 * Agrupa módulos por time (ex.: Comercial, CS, Marketing).
 * `visibilidade`: 'publica' (visível a todos os alunos) ou 'restrita'
 * (acesso condicionado — regra definida nas fases seguintes).
 */
export interface Area {
  id: string
  nome: string
  slug: string
  descricao: string | null
  capa_url: string | null
  visibilidade: 'publica' | 'restrita'
  ordem: number
  publicado: boolean
  created_at: string
}

/**
 * Módulo (12 no total, ordem 1..12). Tabela `modules`.
 * `area_id`: FK para `areas` (ver `supabase/migrations/0009_areas.sql`) —
 * todo módulo pertence a uma área.
 */
export interface Module {
  id: string
  area_id: string
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

/**
 * Tentativa de quiz. Tabela `quiz_attempts`
 * (ver `supabase/migrations/0004_quiz.sql`).
 * Criada SOMENTE pela RPC `submit_quiz` (SECURITY DEFINER): o cliente não tem
 * policy de INSERT. Dono lê as suas; gestor/autor leem todas via RLS.
 * `respostas` é o payload enviado (question_id -> option_id) guardado para
 * auditoria — NÃO contém gabarito.
 */
export interface QuizAttempt {
  id: string
  profile_id: string
  module_id: string
  nota: number
  aprovado: boolean
  respostas: Record<string, string>
  created_at: string
}

/**
 * Certificado emitido. Tabela `certificates`
 * (ver `supabase/migrations/0005_certificates.sql`).
 * Emitido SOMENTE pelo trigger `emit_certificates_on_pass` (SECURITY DEFINER)
 * quando o aluno é aprovado no quiz: o cliente não tem policy de INSERT/UPDATE/
 * DELETE (não é possível forjar). Dono lê os seus; gestor/autor leem todos via
 * RLS.
 * - `tipo`: 'modulo' (1 por aluno/módulo, na 1ª aprovação) ou 'final' (1 por
 *   aluno, ao concluir TODOS os módulos publicados).
 * - `module_id`: preenchido para 'modulo'; sempre `null` para 'final'.
 * - `nota`: para 'modulo', a nota da aprovação; para 'final', a média
 *   (arredondada) das notas dos certificados de módulo.
 * - `codigo_verificacao`: código público (32 hex maiúsculos), único e
 *   compartilhável, para verificação do certificado.
 */
export interface Certificate {
  id: string
  profile_id: string
  tipo: 'modulo' | 'final'
  module_id: string | null
  nota: number | null
  codigo_verificacao: string
  created_at: string
}

/**
 * Payload enviado à RPC `submit_quiz`: mapa question_id -> option_id (uuid como
 * texto). Questão ausente é contada como errada no servidor.
 */
export type QuizAnswers = Record<string, string>

/**
 * Resultado da RPC `submit_quiz`. SOMENTE agregados — o gabarito (`correta`) e o
 * acerto por-questão nunca trafegam para o cliente.
 * - `tentativa`: número desta tentativa (1..3).
 * - `tentativas_restantes`: quantas ainda restam após esta.
 * - `proxima_liberacao`: instante (UTC ISO) em que a próxima tentativa é
 *   liberada, ou null se foi aprovado ou não há tentativas restantes.
 */
export interface QuizResult {
  nota: number
  aprovado: boolean
  acertos: number
  total: number
  tentativa: number
  tentativas_restantes: number
  proxima_liberacao: string | null
}
