import { createClient, SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_URL   = 'https://jxqnfzujsgtzzjabvplm.supabase.co'
const DEFAULT_ANON  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4cW5menVqc2d0enpqYWJ2cGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDIzNzYsImV4cCI6MjA5MTAxODM3Nn0.LSeDBTdAcPDQmabe50EJtEWdFExUjINL5pc5MbmN4I8'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? DEFAULT_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? DEFAULT_ANON
    _client = createClient(url, anon)
  }
  return _client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// ─── Tenant identity (updated by AuthContext after login) ─────────────────────

let _tenantId: string =
  process.env.NEXT_PUBLIC_TENANT_ID || '5518085b-42e9-4608-8c56-890cef45ba9b'

export function getTenantId(): string  { return _tenantId }
export function setTenantId(id: string): void { _tenantId = id }

export const CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHANNEL_ID || '58c4062a-9fe9-4ae2-abff-5a8b5236a79e'

// ─── Agent identity (updated by AuthContext after login) ──────────────────────

let _agentId   = '00000000-0000-0000-0000-000000000001'
let _agentName = 'Agente Dashboard'

export function getCurrentAgentId(): string  { return _agentId }
export function setCurrentAgentId(id: string): void { _agentId = id }

export function getCurrentAgentName(): string  { return _agentName }
export function setCurrentAgentName(name: string): void { _agentName = name }
