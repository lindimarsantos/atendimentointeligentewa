'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
} from 'lucide-react'

const nav = [
  { href: '/',                label: 'Visão Geral',    icon: LayoutDashboard },
  { href: '/atendimento',     label: 'Atendimento',    icon: MessageSquare   },
  { href: '/clientes',        label: 'Clientes',       icon: Users           },
  { href: '/agenda',          label: 'Agenda',         icon: Calendar        },
  { href: '/servicos',        label: 'Serviços',       icon: Scissors        },
  { href: '/campanhas',       label: 'Campanhas',      icon: Megaphone       },
  { href: '/observabilidade', label: 'Observabilidade',icon: Activity        },
  { href: '/analytics',       label: 'Analytics e ROI',icon: BarChart2       },
  { href: '/billing',         label: 'Billing e Uso',  icon: CreditCard      },
  { href: '/administracao',   label: 'Administração',  icon: ShieldCheck     },
  { href: '/configuracoes',   label: 'Configurações',  icon: Settings        },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 flex flex-col z-30">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-100">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-tight">Atendimento</p>
          <p className="text-xs text-gray-500">Inteligente WA</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
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

      <div className="px-5 py-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">v1.0.0 · Homologação</p>
      </div>
    </aside>
  )
}
