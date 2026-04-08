import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) {
      throw new Error(
        'Variáveis de ambiente não configuradas: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY são obrigatórias.'
      )
    }
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

export const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID ?? ''
