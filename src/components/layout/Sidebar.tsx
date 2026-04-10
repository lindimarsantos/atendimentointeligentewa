'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Calendar,
  Scissors,
  Megaphone,
  Activity,
  Settings,
  Bot,
  BarChart2,
  CreditCard,
  ShieldCheck,
  LogOut,
  ChevronsUpDown,
  Check,
  Building2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const nav = [
  { href: '/',                label: 'Visão Geral',     icon: LayoutDashboard },
  { href: '/atendimento',     label: 'Atendimento',     icon: MessageSquare   },
  { href: '/agentes',         label: 'Agentes de IA',   icon: Bot             },
  { href: '/clientes',        label: 'Clientes',        icon: Users           },
  { href: '/agenda',          label: 'Agenda',          icon: Calendar        },
  { href: '/servicos',        label: 'Serviços',        icon: Scissors        },
  { href: '/campanhas',       label: 'Campanhas',       icon: Megaphone       },
  { href: '/observabilidade', label: 'Observabilidade', icon: Activity        },
  { href: '/analytics',       label: 'Analytics e ROI', icon: BarChart2       },
  { href: '/billing',         label: 'Billing e Uso',   icon: CreditCard      },
  { href: '/administracao',   label: 'Administração',   icon: ShieldCheck     },
  { href: '/configuracoes',   label: 'Configurações',   icon: Settings        },
]

export function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const { user, role, signOut, tenantId, tenantName, tenants, switchTenant } = useAuth()
  const [signingOut, setSigningOut]         = useState(false)
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    router.replace('/login')
  }

  // Initials from email
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? '?'

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 flex flex-col z-30">

      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-gray-100 shrink-0">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shrink-0">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">Atendimento</p>
          <p className="text-xs text-gray-500">Inteligente WA</p>
        </div>
      </div>

      {/* Active tenant indicator */}
      <div className="px-3 py-2 border-b border-gray-100 shrink-0 relative">
        <button
          onClick={() => tenants.length > 1 && setTenantMenuOpen((o) => !o)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors',
            tenants.length > 1
              ? 'hover:bg-gray-50 cursor-pointer'
              : 'cursor-default',
          )}
        >
          <div className="w-7 h-7 rounded-md bg-brand-50 flex items-center justify-center shrink-0">
            <Building2 className="h-3.5 w-3.5 text-brand-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-800 truncate leading-tight">
              {tenantName ?? 'Carregando…'}
            </p>
            <p className="text-xs text-gray-400 leading-tight">tenant ativo</p>
          </div>
          {tenants.length > 1 && (
            <ChevronsUpDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          )}
        </button>

        {/* Tenant dropdown */}
        {tenantMenuOpen && tenants.length > 1 && (
          <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
            <p className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
              Trocar tenant
            </p>
            {tenants.map((t) => (
              <button
                key={t.tenant_id}
                onClick={() => {
                  setTenantMenuOpen(false)
                  switchTenant(t.tenant_id)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="w-6 h-6 rounded-md bg-brand-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-brand-700">
                    {t.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{t.display_name}</p>
                  <p className="text-xs text-gray-400 capitalize">{t.role}</p>
                </div>
                {t.tenant_id === tenantId && (
                  <Check className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setTenantMenuOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-brand-600' : 'text-gray-400')} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer: user info + logout */}
      <div className="px-3 py-3 border-t border-gray-100 space-y-2 shrink-0">

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-xs font-semibold text-brand-700">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 truncate">{user.email}</p>
              <p className="text-xs text-gray-400 capitalize">{role ?? 'agent'}</p>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500
                     hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          {signingOut ? 'Saindo…' : 'Sair'}
        </button>

        <p className="px-2 text-xs text-gray-400">v1.0.0 · Homologação</p>
      </div>
    </aside>
  )
}
