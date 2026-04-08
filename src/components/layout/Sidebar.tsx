'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard, MessageSquare, Users, Calendar, Star,
  Send, Eye, Settings, Shield, BarChart2, CreditCard,
} from 'lucide-react'

const NAV = [
  {
    label: 'Principal',
    items: [
      { href: '/',            icon: LayoutDashboard, label: 'Visão Geral' },
      { href: '/atendimento', icon: MessageSquare,   label: 'Atendimento' },
      { href: '/clientes',    icon: Users,           label: 'Clientes'    },
      { href: '/agenda',      icon: Calendar,        label: 'Agenda'      },
      { href: '/servicos',    icon: Star,            label: 'Serviços'    },
    ],
  },
  {
    label: 'Operação',
    items: [
      { href: '/campanhas',      icon: Send,     label: 'Campanhas'       },
      { href: '/analytics',      icon: BarChart2, label: 'Analytics e ROI' },
      { href: '/billing',        icon: CreditCard, label: 'Billing e Uso'  },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/configuracoes',  icon: Settings, label: 'Configurações'   },
      { href: '/administracao',  icon: Shield,   label: 'Administração'   },
      { href: '/observabilidade',icon: Eye,      label: 'Observabilidade' },
    ],
  },
]

interface SidebarProps {
  tenantName: string
}

export function Sidebar({ tenantName }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      style={{ width: 'var(--sidebar-width)' }}
      className="flex-shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] flex flex-col h-screen overflow-y-auto"
    >
      {/* Logo */}
      <div className="px-3.5 py-4 border-b border-[var(--color-border)] flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[var(--color-brand)] flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-white">
            <path d="M8 1C4.134 1 1 4.134 1 8s3.134 7 7 7 7-3.134 7-7-3.134-7-7-7zm0 2c.55 0 1.08.08 1.58.22L3.22 9.58A5.01 5.01 0 013 8c0-2.757 2.243-5 5-5zm0 10c-.55 0-1.08-.08-1.58-.22l6.36-6.36c.14.5.22 1.03.22 1.58 0 2.757-2.243 5-5 5z" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-medium leading-tight">AtendimentoIA</p>
          <p className="text-[10px] text-[var(--color-text-2)] leading-tight">Painel Operacional</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {NAV.map(section => (
          <div key={section.label} className="px-2 py-1">
            <p className="text-[10px] font-medium text-[var(--color-text-3)] uppercase tracking-widest px-2 mb-1">
              {section.label}
            </p>
            {section.items.map(item => {
              const active = item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-normal transition-all mb-0.5',
                    active
                      ? 'bg-[var(--color-info-bg)] text-[var(--color-info-fg)] font-medium'
                      : 'text-[var(--color-text-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]',
                  )}
                >
                  <item.icon size={14} className="flex-shrink-0 opacity-80" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-2 py-3 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[var(--color-surface-2)] cursor-pointer">
          <div className="w-7 h-7 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-[10px] font-medium text-white flex-shrink-0">
            OW
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">Owner</p>
            <p className="text-[10px] text-[var(--color-text-2)] truncate">{tenantName}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
