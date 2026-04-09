'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { listCampaigns, listMessageTemplates } from '@/lib/api'
import type { Campaign, MessageTemplate } from '@/types'
import { fmtDateTime } from '@/lib/utils'
import { Megaphone, FileText } from 'lucide-react'
import { Tabs } from '@/components/ui/Tabs'

const campaignStatusMap: Record<string, { label: string; variant: 'default' | 'info' | 'success' | 'warning' | 'error' | 'purple' }> = {
  draft:     { label: 'Rascunho',  variant: 'default' },
  scheduled: { label: 'Agendada', variant: 'info'    },
  running:   { label: 'Em andamento', variant: 'warning' },
  completed: { label: 'Concluída', variant: 'success' },
  paused:    { label: 'Pausada',   variant: 'default' },
}

const templateStatusMap: Record<string, { label: string; variant: 'default' | 'success' | 'error' | 'warning' }> = {
  approved: { label: 'Aprovado', variant: 'success' },
  pending:  { label: 'Pendente', variant: 'warning' },
  rejected: { label: 'Rejeitado', variant: 'error'  },
}

export default function CampanhasPage() {
  const [tab, setTab] = useState('campaigns')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([listCampaigns(), listMessageTemplates()])
      .then(([c, t]) => {
        if (c.status === 'fulfilled') setCampaigns(c.value)
        if (t.status === 'fulfilled') setTemplates(t.value)
      })
      .finally(() => setLoading(false))
  }, [])

  const tabs = [
    { id: 'campaigns', label: 'Campanhas', icon: Megaphone },
    { id: 'templates', label: 'Templates', icon: FileText },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Campanhas e Templates</h1>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : tab === 'campaigns' ? (
        <Card padding={false}>
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Megaphone className="h-8 w-8 mb-2" />
              <p className="text-sm">Nenhuma campanha</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {campaigns.map((c) => {
                const s = campaignStatusMap[c.status] ?? { label: c.status, variant: 'default' as const }
                return (
                  <li key={c.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">
                        {c.sent_count ?? 0} / {c.target_count ?? 0} enviados
                        {c.scheduled_at ? ` · ${fmtDateTime(c.scheduled_at)}` : ''}
                      </p>
                    </div>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      ) : (
        <Card padding={false}>
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <FileText className="h-8 w-8 mb-2" />
              <p className="text-sm">Nenhum template</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {templates.map((t) => {
                const s = templateStatusMap[t.status] ?? { label: t.status, variant: 'default' as const }
                return (
                  <li key={t.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.category} · {t.language}</p>
                    </div>
                    <Badge variant={s.variant}>{s.label}</Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
