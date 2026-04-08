'use client'

// Placeholder de auth — em produção substituir por supabase.auth.getUser()
// e carregar o tenant_user correspondente.

export const CURRENT_USER = {
  id:   '00000000-0000-0000-0000-000000000001',
  name: 'Agente Dashboard',
  role: 'owner' as const,
}
