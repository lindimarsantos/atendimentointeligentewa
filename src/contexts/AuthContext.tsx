'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  supabase,
  setTenantId,
  setCurrentAgentId,
  setCurrentAgentName,
} from '@/lib/supabase'
import type { UserTenantMembership } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  tenantId: string | null
  tenantName: string | null
  tenants: UserTenantMembership[]
  role: string | null
  loading: boolean
  switchTenant(id: string): void
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  resetPasswordForEmail(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]               = useState<User | null>(null)
  const [tenantId, setTenantIdState]  = useState<string | null>(null)
  const [tenantName, setTenantName]   = useState<string | null>(null)
  const [tenants, setTenants]         = useState<UserTenantMembership[]>([])
  const [role, setRole]               = useState<string | null>(null)
  const [loading, setLoading]         = useState(true)

  async function loadTenant(u: User) {
    // Fetch all tenant memberships for this user
    const { data, error } = await supabase.rpc('rpc_list_user_tenants', {
      p_user_id: u.id,
    })

    if (!error && Array.isArray(data) && data.length > 0) {
      const rows = data as UserTenantMembership[]
      setTenants(rows)

      // Restore previously selected tenant from localStorage (if still valid)
      const saved = typeof window !== 'undefined'
        ? window.localStorage.getItem('activeTenantId')
        : null
      const active = rows.find((r) => r.tenant_id === saved) ?? rows[0]

      setTenantIdState(active.tenant_id)
      setTenantName(active.display_name)
      setRole(active.role)
      setTenantId(active.tenant_id)       // update module-level var used by api.ts
    } else {
      // Fallback: try the old single-tenant RPC
      const { data: d2 } = await supabase.rpc('rpc_get_user_tenant', { p_user_id: u.id })
      if (Array.isArray(d2) && d2.length > 0) {
        const row = d2[0] as { tenant_id: string; role: string }
        setTenantIdState(row.tenant_id)
        setRole(row.role)
        setTenantId(row.tenant_id)
        setTenants([{
          tenant_id:    row.tenant_id,
          role:         row.role,
          tenant_name:  row.tenant_id,
          display_name: 'Tenant',
        }])
      }
    }

    // Always propagate the auth user identity to api.ts agent helpers
    setCurrentAgentId(u.id)
    setCurrentAgentName(
      (u.user_metadata?.full_name as string | undefined) ?? u.email ?? 'Agente',
    )
  }

  function switchTenant(id: string) {
    const target = tenants.find((t) => t.tenant_id === id)
    if (!target) return
    setTenantIdState(target.tenant_id)
    setTenantName(target.display_name)
    setRole(target.role)
    setTenantId(target.tenant_id)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('activeTenantId', id)
      // Reload to flush all cached data for the new tenant
      window.location.href = '/'
    }
  }

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        loadTenant(u).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Subscribe to auth changes (login / logout / token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        loadTenant(u)
      } else {
        setTenantIdState(null)
        setTenantName(null)
        setTenants([])
        setRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setTenantIdState(null)
    setTenantName(null)
    setTenants([])
    setRole(null)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('activeTenantId')
    }
  }

  async function resetPasswordForEmail(email: string) {
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{
      user, tenantId, tenantName, tenants, role, loading,
      switchTenant, signIn, signOut, resetPasswordForEmail, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
