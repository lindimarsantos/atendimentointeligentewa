'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { Toggle } from '@/components/ui/Toggle'
import { Card } from '@/components/ui/Card'
import { getChannelSettings, updateChannelSettings } from '@/lib/api'
import type { ChannelSettings } from '@/types'
import { toast } from '@/components/ui/Toast'
import { AlertCircle } from 'lucide-react'
import { VariablesReference } from '@/components/ui/VariablesReference'

const DEFAULT_CHANNEL: ChannelSettings = {
  id: '',
  tenant_id: '',
  channel_id: '',
  welcome_message: '',
  out_of_hours_message: '',
  handoff_message: '',
  buffer_active: true,
  typing_simulation: true,
  updated_at: '',
}

export function MensagensCanal() {
  const [data, setData] = useState<ChannelSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getChannelSettings()
      .then((d) => setData(d ?? DEFAULT_CHANNEL))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof ChannelSettings>(key: K, value: ChannelSettings[K]) =>
    setData((prev) => prev ? { ...prev, [key]: value } : prev)

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    try {
      await updateChannelSettings(data)
      toast('Mensagens do canal salvas')
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
      <VariablesReference defaultOpen />
      <Textarea
        label="Mensagem de boas-vindas"
        rows={4}
        value={data.welcome_message ?? ''}
        onChange={(e) => set('welcome_message', e.target.value)}
        placeholder="Olá! Bem-vindo à {{negocio_nome}}. Como posso ajudar você hoje?"
        hint="Enviada quando o cliente inicia uma nova conversa"
      />

      <Textarea
        label="Mensagem fora de horário"
        rows={4}
        value={data.out_of_hours_message ?? ''}
        onChange={(e) => set('out_of_hours_message', e.target.value)}
        placeholder="Olá! Nosso horário de atendimento é de segunda a sexta, das 9h às 18h. Deixe sua mensagem e retornaremos em breve!"
        hint="Enviada quando o cliente entra em contato fora do horário de funcionamento"
      />

      <Textarea
        label="Mensagem de handoff (transferência para humano)"
        rows={4}
        value={data.handoff_message ?? ''}
        onChange={(e) => set('handoff_message', e.target.value)}
        placeholder="Vou te transferir para um de nossos atendentes. Por favor, aguarde um momento..."
        hint="Enviada quando a conversa é transferida para atendimento humano"
      />

      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Comportamento do canal</h3>
        <div className="space-y-4">
          <Toggle
            checked={data.buffer_active}
            onChange={(v) => set('buffer_active', v)}
            label="Buffer de mensagens ativo"
            description="Agrupa mensagens recebidas em sequência antes de processar"
          />
          <Toggle
            checked={data.typing_simulation}
            onChange={(v) => set('typing_simulation', v)}
            label="Simular digitação"
            description='Exibe o indicador "digitando..." antes de enviar respostas'
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving}>
          Salvar mensagens
        </Button>
      </div>
    </div>
  )
}
