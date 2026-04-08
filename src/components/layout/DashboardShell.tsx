'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { getTenantName } from '@/lib/api'
import { timeAgo } from '@/lib/utils'

interface ShellChildProps {
  refresh: () => void
  refreshKey: number
}

interface DashboardShellProps {
  title: string
  children: (props: ShellChildProps) => React.ReactNode
}

export function DashboardShell({ title, children }: DashboardShellProps) {
  const [tenantName, setTenantName] = useState('Carregando...')
  const [connected,  setConnected]  = useState(false)
  const [lastSync,   setLastSync]   = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    getTenantName()
      .then(n => { setTenantName(n); setConnected(true) })
      .catch(() => setConnected(false))
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    await new Promise(r => setTimeout(r, 300))
    setRefreshKey(k => k + 1)
    setLastSync(timeAgo(new Date().toISOString()))
    setRefreshing(false)
    setConnected(true)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar tenantName={tenantName} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar
          title={title}
          connected={connected}
          lastSync={lastSync}
          onRefresh={refresh}
          refreshing={refreshing}
        />
        <main className="flex-1 overflow-y-auto p-5 animate-in">
          {children({ refresh, refreshKey })}
        </main>
      </div>
    </div>
  )
}
