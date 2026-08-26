/**
 * Allowlist de administradores (preview de cliente).
 *
 * Contas aqui listadas enxergam e navegam por TODAS as visões do app
 * (Aluno / Gestão / Conteúdo), independentemente do papel real no banco
 * (`profiles.role`). É apenas UI: os dados reais seguem protegidos por RLS no
 * Supabase — dar acesso à tela não dá acesso a dado.
 *
 * Motivação: o Head de Comercial precisa inspecionar as três visões a partir do
 * próprio login sem virar `gestor`/`autor` no banco (o que mudaria a experiência
 * dele como aluno). Para promover alguém a admin, some o e-mail à lista.
 */
export const ADMIN_EMAILS: readonly string[] = [
  'diegodomingos@hypergroup.com.br',
  'camilasouza@hypergroup.com.br',
]

/** true quando o e-mail (case-insensitive) está na allowlist de admins. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
