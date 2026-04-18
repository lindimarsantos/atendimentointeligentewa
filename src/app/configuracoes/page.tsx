'use client'

import { useState } from 'react'
import { Tabs } from '@/components/ui/Tabs'
import { PerfilAgente }       from '@/components/modules/Configuracoes/PerfilAgente'
import { PromptModelo }       from '@/components/modules/Configuracoes/PromptModelo'
import { DadosNegocio }       from '@/components/modules/Configuracoes/DadosNegocio'
import { MensagensCanal }     from '@/components/modules/Configuracoes/MensagensCanal'
import { RegrasComportamento }from '@/components/modules/Configuracoes/RegrasComportamento'
import { Voz }                from '@/components/modules/Configuracoes/Voz'
import { GeralTenant }        from '@/components/modules/Configuracoes/GeralTenant'
import { Lembretes }          from '@/components/modules/Configuracoes/Lembretes'
import { ApiKeys }            from '@/components/modules/Configuracoes/ApiKeys'
import { IntegracaoWhatsApp } from '@/components/modules/Configuracoes/IntegracaoWhatsApp'
import { GoogleCalendar }     from '@/components/modules/Configuracoes/GoogleCalendar'
import {
  User, Code2, Database, MessageSquare,
  ShieldCheck, Mic, Settings, Bell, KeyRound, Smartphone, CalendarDays,
} from 'lucide-react'

const tabs = [
  { id: 'perfil',      label: 'Perfil do Agente',       icon: User          },
  { id: 'prompt',      label: 'Prompt e Modelo',        icon: Code2         },
  { id: 'apikeys',     label: 'Chaves de API',          icon: KeyRound      },
  { id: 'whatsapp',    label: 'Integração WhatsApp',    icon: Smartphone    },
  { id: 'gcalendar',   label: 'Google Calendar',        icon: CalendarDays  },
  { id: 'negocio',     label: 'Dados do Negócio',       icon: Database      },
  { id: 'mensagens',   label: 'Mensagens do Canal',     icon: MessageSquare },
  { id: 'regras',      label: 'Regras de Comportamento',icon: ShieldCheck   },
  { id: 'lembretes',   label: 'Lembretes',              icon: Bell          },
  { id: 'voz',         label: 'Voz (ElevenLabs)',       icon: Mic           },
  { id: 'geral',       label: 'Configurações Gerais',   icon: Settings      },
]

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState('perfil')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Configurações de IA e Atendimento</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Controle completo do comportamento da IA sem alterar código
        </p>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} className="overflow-x-auto" />

      <div className="pt-1">
        {tab === 'perfil'    && <PerfilAgente />}
        {tab === 'prompt'    && <PromptModelo />}
        {tab === 'apikeys'   && <ApiKeys />}
        {tab === 'whatsapp'  && <IntegracaoWhatsApp />}
        {tab === 'gcalendar' && <GoogleCalendar />}
        {tab === 'negocio'   && <DadosNegocio />}
        {tab === 'mensagens' && <MensagensCanal />}
        {tab === 'regras'    && <RegrasComportamento />}
        {tab === 'lembretes' && <Lembretes />}
        {tab === 'voz'       && <Voz />}
        {tab === 'geral'     && <GeralTenant />}
      </div>
    </div>
  )
}
