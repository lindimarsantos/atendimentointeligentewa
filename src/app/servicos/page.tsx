'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { listServices } from '@/lib/api'
import type { Service } from '@/types'
import { Scissors, Clock, AlertCircle } from 'lucide-react'

export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listServices()
      .then(setServices)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const fmt = (n?: number) => (n != null ? `R$ ${n.toFixed(0)}` : null)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Serviços</h1>
        <p className="text-sm text-gray-500 mt-0.5">{services.length} serviços cadastrados</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 p-3 bg-red-50 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-brand-50 rounded-lg">
                  <Scissors className="h-4 w-4 text-brand-600" />
                </div>
                <Badge variant={s.is_active ? 'success' : 'default'}>
                  {s.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{s.name}</h3>
              {s.description && (
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{s.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {s.duration_minutes}min
                </span>
                {(s.price_min || s.price_max) && (
                  <span>
                    {fmt(s.price_min)}
                    {s.price_min && s.price_max ? ' – ' : ''}
                    {fmt(s.price_max)}
                  </span>
                )}
                {s.requires_evaluation && (
                  <Badge variant="warning">Requer avaliação</Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
