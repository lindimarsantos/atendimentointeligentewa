'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { listServices, listProfessionals, getBusinessHours } from '@/lib/api'
import type { Service, Professional, BusinessHour } from '@/types'
import { ExternalLink, Scissors, Users, Clock, AlertCircle } from 'lucide-react'
import Link from 'next/link'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export function DadosNegocio() {
  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listServices(), listProfessionals(), getBusinessHours()])
      .then(([s, p, h]) => { setServices(s); setProfessionals(p); setHours(h) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const sortedHours = [...hours].sort((a, b) => a.day_of_week - b.day_of_week)

  if (loading)
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
      </div>
    )

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        Estes dados são lidos pela IA para contextualizar o atendimento. Edite-os nos módulos
        correspondentes (Serviços, Agenda).
      </p>

      {error && (
        <div className="flex items-center gap-2 text-red-600 p-3 bg-red-50 rounded-lg text-sm">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Services */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-brand-500" />
              Serviços ({services.length})
            </span>
          </CardTitle>
          <Link
            href="/servicos"
            className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
          >
            Gerenciar <ExternalLink className="h-3 w-3" />
          </Link>
        </CardHeader>
        {services.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum serviço cadastrado</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  {s.description && (
                    <p className="text-xs text-gray-500 line-clamp-1">{s.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-500">{s.duration_minutes}min</span>
                  <Badge variant={s.is_active ? 'success' : 'default'}>
                    {s.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Professionals */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Profissionais ({professionals.length})
            </span>
          </CardTitle>
        </CardHeader>
        {professionals.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum profissional cadastrado</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {professionals.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-purple-700">
                    {p.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  {p.specialty && (
                    <p className="text-xs text-gray-500">{p.specialty}</p>
                  )}
                </div>
                <Badge variant={p.is_active ? 'success' : 'default'}>
                  {p.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Business hours */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              Horário de funcionamento
            </span>
          </CardTitle>
        </CardHeader>
        {sortedHours.length === 0 ? (
          <p className="text-sm text-gray-400">Horários não configurados</p>
        ) : (
          <ul className="space-y-1">
            {sortedHours.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-1.5">
                <span className="w-20 text-sm text-gray-600">{DAYS[h.day_of_week]}</span>
                {h.is_open ? (
                  <span className="text-sm text-gray-900">
                    {h.open_time} – {h.close_time}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 italic">Fechado</span>
                )}
                <Badge variant={h.is_open ? 'success' : 'default'}>
                  {h.is_open ? 'Aberto' : 'Fechado'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
