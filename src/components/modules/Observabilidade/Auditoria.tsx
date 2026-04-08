'use client'

import { useEffect, useState, useCallback } from 'react'
import { listAuditLogs } from '@/lib/api'
import type { AuditLog } from '@/types'
import { fmtDateTime, auditActionVariants } from '@/lib/utils'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

const actorTypeLabel: Record<string, string> = {
  system:      'Sistema',
  ai:          'IA',
  agent:       'Agente',
  customer:    'Cliente',
  integration: 'Integração',
}

const actionLabel: Record<string, string> = {
  insert:   'Inserção',
  update:   'Atualização',
  delete:   'Exclusão',
  sync:     'Sincronização',
  decision: 'Decisão',
  handoff:  'Handoff',
  login:    'Login',
}

function DiffViewer({
  before,
  after,
}: {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}) {
  if (!before && !after) return null

  const keys = Array.from(
    new Set([
      ...Object.keys(before ?? {}),
      ...Object.keys(after ?? {}),
    ]),
  )

  const changed = keys.filter(
    (k) => JSON.stringify((before ?? {})[k]) !== JSON.stringify((after ?? {})[k]),
  )

  if (changed.length === 0) return <p className="text-xs text-gray-400 italic">Sem diferenças</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500">
            <th className="text-left py-1 pr-4 font-medium w-1/4">Campo</th>
            <th className="text-left py-1 pr-4 font-medium w-[37.5%] text-red-600">Antes</th>
            <th className="text-left py-1 font-medium w-[37.5%] text-green-600">Depois</th>
          </tr>
        </thead>
        <tbody>
          {changed.map((k) => (
            <tr key={k} className="border-t border-gray-100">
              <td className="py-1 pr-4 text-gray-600 font-mono">{k}</td>
              <td className="py-1 pr-4 text-red-700 bg-red-50 px-1.5 rounded">
                {JSON.stringify((before ?? {})[k]) ?? '—'}
              </td>
              <td className="py-1 text-green-700 bg-green-50 px-1.5 rounded">
                {JSON.stringify((after ?? {})[k]) ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Auditoria() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  const [filters, setFilters] = useState({
    entity_type: '',
    action: '',
    actor_type: '',
    date_from: '',
    date_to: '',
  })

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listAuditLogs({
      entity_type: filters.entity_type || undefined,
      action: filters.action || undefined,
      actor_type: filters.actor_type || undefined,
      date_from: filters.date_from || undefined,
      date_to: filters.date_to || undefined,
      limit: 100,
    })
      .then(setLogs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => { load() }, [load])

  const f = (key: keyof typeof filters) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
    setFilters((prev) => ({ ...prev, [key]: e.target.value }))

  const criticalActions = ['delete', 'handoff']

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Select
          options={[
            { value: '', label: 'Todos os tipos' },
            { value: 'conversation', label: 'Conversa' },
            { value: 'appointment', label: 'Agendamento' },
            { value: 'customer', label: 'Cliente' },
            { value: 'agent', label: 'Agente' },
            { value: 'config', label: 'Configuração' },
          ]}
          value={filters.entity_type}
          onChange={f('entity_type')}
        />
        <Select
          options={[
            { value: '', label: 'Todas as ações' },
            { value: 'insert',   label: 'Inserção'     },
            { value: 'update',   label: 'Atualização'  },
            { value: 'delete',   label: 'Exclusão'     },
            { value: 'handoff',  label: 'Handoff'      },
            { value: 'decision', label: 'Decisão'      },
            { value: 'login',    label: 'Login'        },
          ]}
          value={filters.action}
          onChange={f('action')}
        />
        <Select
          options={[
            { value: '', label: 'Todos os atores' },
            { value: 'system',      label: 'Sistema'     },
            { value: 'ai',          label: 'IA'          },
            { value: 'agent',       label: 'Agente'      },
            { value: 'customer',    label: 'Cliente'     },
            { value: 'integration', label: 'Integração'  },
          ]}
          value={filters.actor_type}
          onChange={f('actor_type')}
        />
        <input
          type="date"
          value={filters.date_from}
          onChange={f('date_from')}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="De"
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={f('date_to')}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
          placeholder="Até"
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
          <p className="text-sm text-gray-400 text-center py-12">Nenhum registro encontrado</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {logs.map((log) => {
              const isCritical = criticalActions.includes(log.action)
              const isOpen = openId === log.id
              return (
                <li
                  key={log.id}
                  className={`${isCritical ? 'bg-red-50/40' : ''}`}
                >
                  <button
                    className="w-full flex items-start gap-3 px-6 py-3 hover:bg-gray-50 text-left transition-colors"
                    onClick={() => setOpenId(isOpen ? null : log.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${auditActionVariants[log.action] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {actionLabel[log.action] ?? log.action}
                        </span>
                        <span className="text-xs text-gray-600 font-mono">{log.entity_type}</span>
                        <span className="text-xs text-gray-400">·</span>
                        <span className="text-xs text-gray-500">
                          {actorTypeLabel[log.actor_type] ?? log.actor_type}
                          {log.actor_id ? ` (${log.actor_id.slice(0, 8)}…)` : ''}
                        </span>
                        {isCritical && (
                          <span className="text-xs font-semibold text-red-600">⚠ Crítico</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{fmtDateTime(log.created_at)}</p>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400 shrink-0 mt-1" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-4">
                      <div className="p-4 bg-white border border-gray-100 rounded-lg">
                        {log.action === 'update' ? (
                          <DiffViewer before={log.before_jsonb} after={log.after_jsonb} />
                        ) : (
                          <div className="space-y-3">
                            {log.before_jsonb && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1">Antes</p>
                                <pre className="text-xs text-gray-600 font-mono overflow-auto max-h-32 whitespace-pre-wrap">
                                  {JSON.stringify(log.before_jsonb, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.after_jsonb && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1">Depois</p>
                                <pre className="text-xs text-gray-600 font-mono overflow-auto max-h-32 whitespace-pre-wrap">
                                  {JSON.stringify(log.after_jsonb, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.metadata_jsonb && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1">Metadata</p>
                                <pre className="text-xs text-gray-600 font-mono overflow-auto max-h-32 whitespace-pre-wrap">
                                  {JSON.stringify(log.metadata_jsonb, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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
