'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { getAiAgentProfile, updateAiAgentProfile } from '@/lib/api'
import type { AiAgentProfile } from '@/types'
import { toast } from '@/components/ui/Toast'
import { AlertCircle } from 'lucide-react'

const DEFAULT_PROFILE: AiAgentProfile = {
  id: '',
  tenant_id: '',
  profile_name: 'Agente',
  objective: '',
  tone: 'profissional',
  verbosity: 'moderado',
  escalation_policy: '',
  use_memory: true,
  use_recommendations: true,
  use_scheduling: true,
  allow_voice_response: false,
  restrict_to_configured_services: false,
  updated_at: '',
}

export function PerfilAgente() {
  const [data, setData] = useState<AiAgentProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getAiAgentProfile()
      .then((d) => setData(d ?? DEFAULT_PROFILE))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof AiAgentProfile>(key: K, value: AiAgentProfile[K]) =>
    setData((prev) => prev ? { ...prev, [key]: value } : prev)

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    try {
      await updateAiAgentProfile(data)
      toast('Perfil do agente salvo')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
      </div>
    )

  if (error)
    return (
      <div className="flex items-center gap-2 text-red-600 p-3 bg-red-50 rounded-lg text-sm">
        <AlertCircle className="h-4 w-4" /> {error}
      </div>
    )

  if (!data) return null

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nome do agente"
          value={data.profile_name}
          onChange={(e) => set('profile_name', e.target.value)}
          placeholder="Ex: Sofia"
          hint="Nome pelo qual o agente se identifica nas conversas"
        />
        <Select
          label="Tom de voz"
          value={data.tone}
          onChange={(e) => set('tone', e.target.value as AiAgentProfile['tone'])}
          options={[
            { value: 'empatico',     label: 'Empático'      },
            { value: 'profissional', label: 'Profissional'  },
            { value: 'informal',     label: 'Informal'      },
            { value: 'neutro',       label: 'Neutro'        },
          ]}
        />
      </div>

      <Select
        label="Verbosidade"
        value={data.verbosity}
        onChange={(e) => set('verbosity', e.target.value as AiAgentProfile['verbosity'])}
        options={[
          { value: 'conciso',   label: 'Conciso — respostas curtas e diretas'      },
          { value: 'moderado',  label: 'Moderado — equilibrado'                    },
          { value: 'detalhado', label: 'Detalhado — respostas completas e ricas'   },
        ]}
        hint="Define o nível de detalhe das respostas da IA"
      />

      <Textarea
        label="Objetivo operacional"
        rows={3}
        value={data.objective ?? ''}
        onChange={(e) => set('objective', e.target.value)}
        placeholder="Ex: Atender clientes da clínica, agendar consultas e esclarecer dúvidas sobre os serviços..."
        hint="Descreva em linguagem natural o que o agente deve fazer"
      />

      <Textarea
        label="Política de escalação"
        rows={3}
        value={data.escalation_policy ?? ''}
        onChange={(e) => set('escalation_policy', e.target.value)}
        placeholder="Ex: Acionar humano quando o cliente mencionar reclamação, cancelamento ou urgência médica..."
        hint="Quando e como transferir para atendimento humano"
      />

      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Capacidades do agente</h3>
        <div className="space-y-4">
          <Toggle
            checked={data.use_memory}
            onChange={(v) => set('use_memory', v)}
            label="Usar memória de clientes"
            description="O agente lembra informações de conversas anteriores"
          />
          <Toggle
            checked={data.use_recommendations}
            onChange={(v) => set('use_recommendations', v)}
            label="Fazer recomendações de serviços"
            description="O agente pode sugerir serviços com base no perfil do cliente"
          />
          <Toggle
            checked={data.use_scheduling}
            onChange={(v) => set('use_scheduling', v)}
            label="Realizar agendamentos"
            description="O agente pode criar e gerenciar agendamentos diretamente"
          />
          <Toggle
            checked={data.allow_voice_response}
            onChange={(v) => set('allow_voice_response', v)}
            label="Responder por áudio"
            description="Permite que o agente envie mensagens de voz via ElevenLabs"
          />
          <Toggle
            checked={data.restrict_to_configured_services}
            onChange={(v) => set('restrict_to_configured_services', v)}
            label="Restringir ao catálogo de serviços"
            description="Ativado: a IA fala apenas dos serviços cadastrados (pode reformular, mas não inventa novos). Desativado: a IA pode complementar com conhecimento externo."
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving}>
          Salvar perfil
        </Button>
      </div>
    </div>
  )
}
