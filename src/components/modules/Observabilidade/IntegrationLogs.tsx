'use client'

import { useEffect, useState, useCallback } from 'react'
import { listIntegrationLogs } from '@/lib/api'
import type { IntegrationLog } from '@/types'
import { fmtDateTime } from '@/lib/utils'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

const statusVariant: Record<string, 'success' | 'error' | 'warning'> = {
  success: 'success',
  error:   'error',
  pending: 'warning',
}

const statusLabel: Record<string, string> = {
  success: 'Sucesso',
  error:   'Erro',
  pending: 'Pendente',
}

const directionLabel: Record<string, string> = {
  inbound:  'Entrada',
  outbound: 'Saída',
}

export function IntegrationLogs() {
  const [logs, setLogs] = useState<IntegrationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    integration_name: '',
    status: '',
    date_from: '',
    date_to: '',
  })

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listIntegrationLogs({
      integration_name: filters.integration_name || undefined,
      status: filters.status || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      limit: 100,
    })
      .then(setLogs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load() }, [load])

  const f = (key: keyof typeof filters) =>
    (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      setFilters((prev) => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Select
          options={[
            { value: '', label: 'Todas as integrações' },
            { value: 'z-api',           label: 'Z-API'           },
            { value: 'google_calendar', label: 'Google Calendar' },
            { value: 'elevenlabs',      label: 'ElevenLabs'      },
          ]}
          value={filters.integration_name}
          onChange={f('integration_name')}
        />
        <Select
          options={[
            { value: '', label: 'Todos os status' },
            { value: 'success', label: 'Sucesso'  },
            { value: 'error',   label: 'Erro'     },
            { value: 'pending', label: 'Pendente' },
          ]}
          value={filters.status}
          onChange={f('status')}
        />
        <input
          type="date"
          value={filters.date_from}
          onChange={f('date_from')}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={f('date_to')}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{logs.length} registros</p>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 p-3 bg-red-50 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">Nenhum log encontrado</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {logs.map((log) => {
              const isOpen = openId === log.id
              return (
                <li key={log.id}>
                  <button
                    className="w-full flex items-start gap-3 px-6 py-3.5 hover:bg-gray-50 text-left transition-colors"
                    onClick={() => setOpenId(isOpen ? null : log.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-gray-900">
                          {log.integration_name}
                        </span>
                        <Badge variant={statusVariant[log.status] ?? 'default'}>
                          {statusLabel[log.status] ?? log.status}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {directionLabel[log.direction] ?? log.direction}
                        </span>
                        {log.external_id && (
                          <span className="text-xs text-gray-400 font-mono">
                            #{log.external_id.slice(0, 12)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{fmtDateTime(log.created_at)}</p>
                      {log.error_jsonb && (
                        <p className="text-xs text-red-600 mt-0.5 truncate">
                          {String((log.error_jsonb as Record<string, unknown>).message ?? JSON.stringify(log.error_jsonb))}
                        </p>
                      )}
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {log.payload_jsonb && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-xs font-semibold text-gray-500 mb-2">Payload enviado</p>
                          <pre className="text-xs text-gray-600 font-mono overflow-auto max-h-48 whitespace-pre-wrap">
                            {JSON.stringify(log.payload_jsonb, null, 2)}
                          </pre>
                        </div>
                      )}
                      {(log.response_jsonb || log.error_jsonb) && (
                        <div className={`p-3 rounded-lg ${log.error_jsonb ? 'bg-red-50' : 'bg-green-50'}`}>
                          <p className={`text-xs font-semibold mb-2 ${log.error_jsonb ? 'text-red-600' : 'text-green-600'}`}>
                            {log.error_jsonb ? 'Erro' : 'Resposta recebida'}
                          </p>
                          <pre className="text-xs font-mono overflow-auto max-h-48 whitespace-pre-wrap text-gray-700">
                            {JSON.stringify(log.error_jsonb ?? log.response_jsonb, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
