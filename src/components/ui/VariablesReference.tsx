'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

// ─── Variable catalogue ───────────────────────────────────────────────────────

const GROUPS = [
  {
    label: 'Cliente',
    bg: 'bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    vars: [
      { name: 'cliente_nome',     desc: 'Nome completo do cliente' },
      { name: 'cliente_telefone', desc: 'Telefone / WhatsApp' },
      { name: 'cliente_email',    desc: 'E-mail (quando disponível)' },
    ],
  },
  {
    label: 'Agendamento',
    bg: 'bg-purple-50',
    badge: 'bg-purple-100 text-purple-700',
    vars: [
      { name: 'agendamento_data',         desc: 'Data do agendamento (dd/mm/aaaa)' },
      { name: 'agendamento_hora',         desc: 'Hora do agendamento (hh:mm)' },
      { name: 'agendamento_servico',      desc: 'Nome do serviço agendado' },
      { name: 'agendamento_profissional', desc: 'Nome do profissional' },
      { name: 'agendamento_duracao',      desc: 'Duração em minutos' },
    ],
  },
  {
    label: 'Negócio',
    bg: 'bg-green-50',
    badge: 'bg-green-100 text-green-700',
    vars: [
      { name: 'negocio_nome',    desc: 'Nome do negócio / clínica' },
      { name: 'negocio_horario', desc: 'Horário de funcionamento' },
      { name: 'agente_nome',     desc: 'Nome do agente IA (ex: Sofia)' },
    ],
  },
  {
    label: 'Sistema',
    bg: 'bg-orange-50',
    badge: 'bg-orange-100 text-orange-700',
    vars: [
      { name: 'data_hoje',  desc: 'Data atual (dd/mm/aaaa)' },
      { name: 'hora_atual', desc: 'Hora atual (hh:mm)' },
      { name: 'dia_semana', desc: 'Dia da semana por extenso' },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /** Se true, exibe expandido por padrão */
  defaultOpen?: boolean
}

export function VariablesReference({ defaultOpen = false }: Props) {
  const [open, setOpen]       = useState(defaultOpen)
  const [copied, setCopied]   = useState<string | null>(null)

  function copy(name: string) {
    const tag = `{{${name}}}`
    navigator.clipboard.writeText(tag).catch(() => {
      // fallback para ambientes sem clipboard API
      const el = document.createElement('textarea')
      el.value = tag
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    })
    setCopied(name)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden text-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50
                   hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            : <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
          Variáveis disponíveis <code className="bg-gray-200 px-1 rounded font-mono text-gray-500">{`{{variavel}}`}</code>
        </span>
        <span className="text-xs text-gray-400">clique para copiar</span>
      </button>

      {/* Body */}
      {open && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white">
          {GROUPS.map((group) => (
            <div key={group.label} className={`rounded-lg p-3 ${group.bg}`}>
              <p className="text-xs font-semibold text-gray-600 mb-2">{group.label}</p>
              <div className="space-y-1.5">
                {group.vars.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => copy(v.name)}
                    className="w-full flex items-center justify-between gap-2 group
                               hover:opacity-80 transition-opacity text-left"
                  >
                    <div className="min-w-0">
                      <span className={`inline-block font-mono text-xs px-1.5 py-0.5 rounded ${group.badge}`}>
                        {`{{${v.name}}}`}
                      </span>
                      <span className="ml-1.5 text-xs text-gray-500">{v.desc}</span>
                    </div>
                    <span className="shrink-0 text-gray-400">
                      {copied === v.name
                        ? <Check className="h-3.5 w-3.5 text-green-500" />
                        : <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
