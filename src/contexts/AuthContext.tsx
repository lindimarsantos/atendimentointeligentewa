'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  supabase,
  setTenantId,
  setCurrentAgentId,
  setCurrentAgentName,
} from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  tenantId: string | null
  role: string | null
  loading: boolean
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  resetPasswordForEmail(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<User | null>(null)
  const [tenantId, setTenantIdState] = useState<string | null>(null)
  const [role, setRole]         = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)

  async function loadTenant(u: User) {
    // Fetch the user's primary tenant from tenant_members
    const { data, error } = await supabase.rpc('rpc_get_user_tenant', {
      p_user_id: u.id,
    })

    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0] as { tenant_id: string; role: string }
      setTenantIdState(row.tenant_id)
      setRole(row.role)
      setTenantId(row.tenant_id)       // update module-level variable used by api.ts
    }
    // Always propagate the auth user identity to api.ts agent helpers
    setCurrentAgentId(u.id)
    setCurrentAgentName(
      (u.user_metadata?.full_name as string | undefined) ?? u.email ?? 'Agente',
    )
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
    setRole(null)
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
    <AuthContext.Provider value={{ user, tenantId, role, loading, signIn, signOut, resetPasswordForEmail, updatePassword }}>
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
