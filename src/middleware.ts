import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DEFAULT_URL  = 'https://jxqnfzujsgtzzjabvplm.supabase.co'
const DEFAULT_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4cW5menVqc2d0enpqYWJ2cGxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDIzNzYsImV4cCI6MjA5MTAxODM3Nn0.LSeDBTdAcPDQmabe50EJtEWdFExUjINL5pc5MbmN4I8'

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Let public auth routes through without any check
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL  ?? DEFAULT_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? DEFAULT_ANON,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  // getSession() reads from cookies — no network call, low latency.
  // The real security layer is Supabase RLS + tenant_id validation in RPCs.
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  // Run on all routes except Next.js internals and static assets
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)'],
}
