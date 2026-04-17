'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { listCustomers, listCustomerTags, autoTagCustomers } from '@/lib/api'
import type { Customer } from '@/types'
import { fmtDateTime } from '@/lib/utils'
import { Users, Search, ChevronRight, Tag, Sparkles, X } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

const TAG_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700',
  'bg-green-100 text-green-700', 'bg-yellow-100 text-yellow-700',
  'bg-pink-100 text-pink-700', 'bg-orange-100 text-orange-700',
]
function tagColor(tag: string) {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffff
  return TAG_COLORS[h % TAG_COLORS.length]
}

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch]       = useState('')
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [allTags, setAllTags]     = useState<string[]>([])
  const [loading, setLoading]     = useState(true)
  const [autoTagging, setAutoTag] = useState(false)

  const load = useCallback((q?: string, tag?: string) => {
    setLoading(true)
    listCustomers(q, tag)
      .then(setCustomers)
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    listCustomerTags().then(setAllTags).catch(() => {})
  }, [load])

  const handleSearch = (v: string) => {
    setSearch(v)
    const t = setTimeout(() => load(v || undefined, activeTag ?? undefined), 400)
    return () => clearTimeout(t)
  }

  const handleTag = (tag: string | null) => {
    setActiveTag(tag)
    load(search || undefined, tag ?? undefined)
  }

  const handleAutoTag = async () => {
    setAutoTag(true)
    try {
      const result = await autoTagCustomers()
      toast(`Auto-tags aplicadas: ${result.updated} clientes atualizados`)
      load(search || undefined, activeTag ?? undefined)
      listCustomerTags().then(setAllTags).catch(() => {})
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao aplicar auto-tags', 'error')
    } finally {
      setAutoTag(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customers.length} registros</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleAutoTag} loading={autoTagging}>
          <Sparkles className="h-3.5 w-3.5" /> Auto-tag todos
        </Button>
      </div>

      {/* Search + Tag filters */}
      <Card className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            {activeTag && (
              <button
                onClick={() => handleTag(null)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
              >
                <X className="h-2.5 w-2.5" /> Limpar
              </button>
            )}
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTag(activeTag === tag ? null : tag)}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                  activeTag === tag
                    ? tagColor(tag) + ' ring-2 ring-offset-1 ring-current'
                    : tagColor(tag) + ' opacity-60 hover:opacity-100'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Users className="h-8 w-8 mb-2" />
            <p className="text-sm">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {customers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clientes/${c.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-brand-700">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.phone}</p>
                      {c.tags && c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.tags.map((tag) => (
                            <span
                              key={tag}
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${tagColor(tag)}`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs text-gray-400 hidden sm:block">{fmtDateTime(c.created_at)}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
