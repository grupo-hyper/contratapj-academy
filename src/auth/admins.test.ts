import { describe, expect, it } from 'vitest'
import { isAdminEmail, ADMIN_EMAILS } from './admins'

describe('isAdminEmail', () => {
  it('reconhece um e-mail da allowlist (case-insensitive, com espaços)', () => {
    expect(isAdminEmail(ADMIN_EMAILS[0])).toBe(true)
    expect(isAdminEmail(ADMIN_EMAILS[0].toUpperCase())).toBe(true)
    expect(isAdminEmail(`  ${ADMIN_EMAILS[0]}  `)).toBe(true)
  })

  it('rejeita e-mail fora da allowlist', () => {
    expect(isAdminEmail('aluno.qualquer@contratapj.com.br')).toBe(false)
  })

  it('trata null/undefined/vazio como não-admin', () => {
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })
})
