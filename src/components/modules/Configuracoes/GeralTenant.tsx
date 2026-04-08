'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { Card } from '@/components/ui/Card'
import { getTenantSettings, updateTenantSettings } from '@/lib/api'
import type { TenantSettings } from '@/types'
import { toast } from '@/components/ui/Toast'
import { AlertCircle } from 'lucide-react'

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Recife',
  'America/Fortaleza',
  'America/Noronha',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Boa_Vista',
  'America/Rio_Branco',
].map((tz) => ({ value: tz, label: tz.replace('America/', '').replace('_', ' ') }))

export function GeralTenant() {
  const [data, setData] = useState<TenantSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTenantSettings()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) =>
    setData((prev) => prev ? { ...prev, [key]: value } : prev)

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    try {
      await updateTenantSettings(data)
      toast('Configurações gerais salvas')
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

  if (!data)
    return <p className="text-sm text-gray-400 text-center py-8">Configurações não encontradas</p>

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Identity */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Identidade</h3>
        <Input
          label="Nome do negócio"
          value={data.business_name}
          onChange={(e) => set('business_name', e.target.value)}
          placeholder="Clínica Exemplo Ltda"
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Fuso horário"
            value={data.timezone}
            onChange={(e) => set('timezone', e.target.value)}
            options={TIMEZONES}
          />
          <Select
            label="Idioma"
            value={data.language}
            onChange={(e) => set('language', e.target.value)}
            options={[
              { value: 'pt-BR', label: 'Português (Brasil)' },
              { value: 'en-US', label: 'English (US)'       },
              { value: 'es-ES', label: 'Español'            },
            ]}
          />
        </div>
      </section>

      {/* Intake */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Modo de atendimento</h3>
        <Select
          label="Modo de intake"
          value={data.intake_mode}
          onChange={(e) => set('intake_mode', e.target.value as TenantSettings['intake_mode'])}
          options={[
            { value: 'bot_first',   label: 'Bot primeiro — IA atende, humano intervém se necessário' },
            { value: 'human_first', label: 'Humano primeiro — agente atende, IA apoia'               },
            { value: 'mixed',       label: 'Misto — depende da fila e horário'                       },
          ]}
          hint="Define como as conversas são roteadas quando chegam"
        />
      </section>

      {/* Media permissions */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Permissões de mídia</h3>
        <div className="space-y-4">
          <Toggle
            checked={data.allow_audio}
            onChange={(v) => set('allow_audio', v)}
            label="Aceitar mensagens de áudio"
            description="Clientes podem enviar áudios no WhatsApp"
          />
          <Toggle
            checked={data.allow_image}
            onChange={(v) => set('allow_image', v)}
            label="Aceitar imagens"
            description="Clientes podem enviar imagens e documentos"
          />
          <Toggle
            checked={data.allow_voice}
            onChange={(v) => set('allow_voice', v)}
            label="Enviar respostas por voz"
            description="Permite que o sistema envie áudios gerados pela IA"
          />
        </div>
      </Card>

      {/* Automation */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Automação e segurança</h3>
        <div className="space-y-4">
          <Toggle
            checked={data.human_approval_high_risk}
            onChange={(v) => set('human_approval_high_risk', v)}
            label="Aprovação humana para ações de alto risco"
            description="Requer confirmação de agente para ações como cancelamentos e reembolsos"
          />
          <Toggle
            checked={data.auto_create_customer}
            onChange={(v) => set('auto_create_customer', v)}
            label="Criar cliente automaticamente"
            description="Quando um número desconhecido entra em contato, cria o cadastro automaticamente"
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving}>
          Salvar configurações
        </Button>
      </div>
    </div>
  )
}
