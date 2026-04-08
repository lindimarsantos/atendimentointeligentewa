import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const TENANT_ID =
  process.env.NEXT_PUBLIC_TENANT_ID || '5518085b-42e9-4608-8c56-890cef45ba9b'

export const CHANNEL_ID =
  process.env.NEXT_PUBLIC_CHANNEL_ID || '58c4062a-9fe9-4ae2-abff-5a8b5236a79e'
