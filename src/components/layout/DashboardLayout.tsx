'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Bot } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { HandoffBanner } from './HandoffBanner'
import { ToastContainer } from '@/components/ui/Toast'
import { useAuth } from '@/contexts/AuthContext'

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router   = useRouter()
  const pathname = usePathname()

  // Redirect unauthenticated users to /login (except when already there)
  useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.replace('/login')
    }
    // Redirect logged-in users away from /login
    if (!loading && user && pathname === '/login') {
      router.replace('/')
    }
  }, [user, loading, pathname, router])

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Bot className="h-7 w-7 text-white" />
          </div>
          <p className="text-sm text-gray-500">Carregando…</p>
        </div>
      </div>
    )
  }

  // ── Login page (no sidebar) ───────────────────────────────────────────────
  if (!user) {
    return <>{children}</>
  }

  // ── Authenticated dashboard ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <HandoffBanner />
      <main className="pl-60 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
      </main>
      <ToastContainer />
    </div>
  )
}
