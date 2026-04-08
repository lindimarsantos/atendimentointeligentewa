import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Valores padrão do projeto — a chave anon é pública por design (Supabase Row-Level Security protege os dados)
const DEFAULT_URL  = 'https://jxqnfzujsgtzzjabvplm.supabase.co'
const DEFAULT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4cW5menVqc2d0enpqYWJ2cGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDIzNzYsImV4cCI6MjA5MTAxODM3Nn0.LSeDBTdAcPDQmabe50EJtEWdFExUjINL5pc5MbmN4I8'
const DEFAULT_TENANT = '5518085b-42e9-4608-8c56-890cef45ba9b'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? DEFAULT_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? DEFAULT_ANON
    _client = createClient(url, anon)
  }
  return _client
}

// Proxy lazy — o cliente só é criado na primeira chamada real, não na importação do módulo
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, _receiver) {
    const client = getClient()
    const value = (client as never)[prop]
    return typeof value === 'function' ? (value as Function).bind(client) : value
  },
})

export const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? DEFAULT_TENANT
