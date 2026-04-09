'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Tabs } from '@/components/ui/Tabs'
import { listServices, listProfessionals } from '@/lib/api'
import type { Service, Professional } from '@/types'
import { Scissors, Clock, DollarSign, Search, Users, AlertTriangle, CheckCircle2 } from 'lucide-react'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPrice(min?: number, max?: number): string | null {
  if (min == null && max == null) return null
  const fmt = (n: number) => `R$ ${n.toFixed(0)}`
  if (min != null && max != null && min !== max) return `${fmt(min)} – ${fmt(max)}`
  return fmt((min ?? max)!)
}

// ─── Service card ─────────────────────────────────────────────────────────────

function ServiceCard({ s }: { s: Service }) {
  const price = fmtPrice(s.price_min, s.price_max)
  return (
    <Card className={!s.is_active ? 'opacity-60' : ''}>
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${s.is_active ? 'bg-brand-50' : 'bg-gray-100'}`}>
          <Scissors className={`h-4 w-4 ${s.is_active ? 'text-brand-600' : 'text-gray-400'}`} />
        </div>
        <Badge variant={s.is_active ? 'success' : 'default'}>
          {s.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-1">{s.name}</h3>

      {s.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{s.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500 mt-auto pt-2 border-t border-gray-100">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {s.duration_minutes} min
        </span>
        {price && (
          <span className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            {price}
          </span>
        )}
        {s.requires_evaluation && (
          <span className="flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Requer avaliação
          </span>
        )}
      </div>
    </Card>
  )
}

// ─── Professional card ────────────────────────────────────────────────────────

function ProfessionalCard({ p }: { p: Professional }) {
  return (
    <Card className={!p.is_active ? 'opacity-60' : ''}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-purple-700">
            {p.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
          {p.specialty && (
            <p className="text-xs text-gray-500 truncate">{p.specialty}</p>
          )}
        </div>
        <Badge variant={p.is_active ? 'success' : 'default'}>
          {p.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      </div>

      {p.bio && (
        <p className="text-xs text-gray-500 line-clamp-3 pt-2 border-t border-gray-100">
          {p.bio}
        </p>
      )}

      {!p.bio && (
        <div className="flex items-center gap-1.5 text-xs text-gray-400 pt-2 border-t border-gray-100">
          <CheckCircle2 className={`h-3.5 w-3.5 ${p.is_active ? 'text-green-500' : 'text-gray-300'}`} />
          {p.is_active ? 'Disponível para agendamentos' : 'Indisponível'}
        </div>
      )}
    </Card>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <Icon className="h-10 w-10 mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const pageTabs = [
  { id: 'services',      label: 'Serviços',      icon: Scissors },
  { id: 'professionals', label: 'Profissionais', icon: Users    },
]

export default function ServicosPage() {
  const [tab, setTab]                   = useState('services')
  const [services, setServices]         = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => {
    Promise.allSettled([listServices(), listProfessionals()])
      .then(([s, p]) => {
        if (s.status === 'fulfilled') setServices(s.value)
        if (p.status === 'fulfilled') setProfessionals(p.value)
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredServices = useMemo(() => {
    return services
      .filter((s) => filterActive === 'all' || (filterActive === 'active' ? s.is_active : !s.is_active))
      .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase()))
  }, [services, search, filterActive])

  const filteredProfessionals = useMemo(() => {
    return professionals
      .filter((p) => filterActive === 'all' || (filterActive === 'active' ? p.is_active : !p.is_active))
      .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.specialty?.toLowerCase().includes(search.toLowerCase()))
  }, [professionals, search, filterActive])

  const activeServices      = services.filter((s) => s.is_active).length
  const activeProfessionals = professionals.filter((p) => p.is_active).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Serviços</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeServices} serviço{activeServices !== 1 ? 's' : ''} ativo{activeServices !== 1 ? 's' : ''} ·{' '}
            {activeProfessionals} profissional{activeProfessionals !== 1 ? 'is' : ''} ativo{activeProfessionals !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={pageTabs} active={tab} onChange={(t) => { setTab(t); setSearch('') }} />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'services' ? 'Buscar serviço...' : 'Buscar profissional...'}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterActive(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterActive === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
        </div>
      ) : tab === 'services' ? (
        filteredServices.length === 0 ? (
          <EmptyState icon={Scissors} label={search ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredServices.map((s) => <ServiceCard key={s.id} s={s} />)}
          </div>
        )
      ) : (
        filteredProfessionals.length === 0 ? (
          <EmptyState icon={Users} label={search ? 'Nenhum profissional encontrado' : 'Nenhum profissional cadastrado'} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredProfessionals.map((p) => <ProfessionalCard key={p.id} p={p} />)}
          </div>
        )
      )}
    </div>
  )
}
