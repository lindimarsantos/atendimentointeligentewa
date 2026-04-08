'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getCustomer, getCustomerMemories } from '@/lib/api'
import type { Customer, CustomerMemory } from '@/types'
import { fmtDateTime, memoryTypeVariants } from '@/lib/utils'
import { ArrowLeft, User, Phone, Mail, Brain, AlertCircle } from 'lucide-react'

const memoryTypeLabel: Record<string, string> = {
  profile:             'Perfil',
  preference:          'Preferência',
  objection:           'Objeção',
  clinical_interest:   'Interesse clínico',
  schedule_preference: 'Preferência de horário',
  relationship:        'Relacionamento',
}

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [memories, setMemories] = useState<CustomerMemory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getCustomer(id), getCustomerMemories(id)])
      .then(([c, m]) => { setCustomer(c); setMemories(m) })
      .finally(() => setLoading(false))
  }, [id])

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )

  if (!customer)
    return (
      <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 rounded-lg">
        <AlertCircle className="h-5 w-5" />
        Cliente não encontrado
      </div>
    )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clientes" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">{customer.name}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Dados do cliente</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-gray-400" />
              <span className="text-gray-700">{customer.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-gray-400" />
              <span className="text-gray-700">{customer.phone}</span>
            </div>
            {customer.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700">{customer.email}</span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-400">Cliente desde {fmtDateTime(customer.created_at)}</p>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" />
                Memórias da IA
              </span>
            </CardTitle>
            <span className="text-xs text-gray-400">{memories.length} registros</span>
          </CardHeader>

          {memories.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Nenhuma memória registrada para este cliente
            </p>
          ) : (
            <ul className="space-y-3">
              {memories.map((m) => (
                <li key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${memoryTypeVariants[m.memory_type] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {memoryTypeLabel[m.memory_type] ?? m.memory_type}
                      </span>
                      <span className="text-xs text-gray-400">
                        relevância {Math.round(m.importance_score * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{m.content_text}</p>
                    {m.last_used_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        Último uso: {fmtDateTime(m.last_used_at)}
                      </p>
                    )}
                  </div>
                  <div
                    className="w-1.5 h-full min-h-[24px] rounded-full mt-1"
                    style={{
                      background: `hsl(${m.importance_score * 120}, 60%, 55%)`,
                      opacity: 0.7,
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
