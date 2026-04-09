'use client'

import { useEffect, useState } from 'react'
import { Tabs } from '@/components/ui/Tabs'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { listJobs } from '@/lib/api'
import type { JobEntry } from '@/types'
import { fmtDateTime } from '@/lib/utils'
import { Auditoria } from '@/components/modules/Observabilidade/Auditoria'
import { IntegrationLogs } from '@/components/modules/Observabilidade/IntegrationLogs'
import { Activity, Shield, Plug } from 'lucide-react'

const jobStatusVariant: Record<string, 'default' | 'info' | 'success' | 'error' | 'warning'> = {
  pending: 'warning',
  running: 'info',
  done:    'success',
  failed:  'error',
}

function JobQueue() {
  const [jobs, setJobs] = useState<JobEntry[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    listJobs()
      .then(setJobs)
      .catch(() => setJobs([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Fila vazia</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {jobs.map((job) => (
              <li key={job.id} className="flex items-center gap-4 px-6 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{job.job_type}</p>
                  {job.error && (
                    <p className="text-xs text-red-600 truncate">{job.error}</p>
                  )}
                  <p className="text-xs text-gray-400">{fmtDateTime(job.created_at)}</p>
                </div>
                <Badge variant={jobStatusVariant[job.status] ?? 'default'}>
                  {job.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

const tabs = [
  { id: 'jobs',         label: 'Job Queue',    icon: Activity },
  { id: 'auditoria',    label: 'Auditoria',    icon: Shield   },
  { id: 'integrations', label: 'Integrações',  icon: Plug     },
]

export default function ObservabilidadePage() {
  const [tab, setTab] = useState('jobs')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Observabilidade</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Monitoramento de jobs, auditoria e integrações
        </p>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mt-2">
        {tab === 'jobs'         && <JobQueue />}
        {tab === 'auditoria'    && <Auditoria />}
        {tab === 'integrations' && <IntegrationLogs />}
      </div>
    </div>
  )
}
