'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { getWhatsAppChannel, updateWhatsAppChannel } from '@/lib/api'
import type { WhatsAppChannel } from '@/types'
import { toast } from '@/components/ui/Toast'
import {
  AlertCircle, CheckCircle2, Copy, Eye, EyeOff,
  ExternalLink, Info, Smartphone, Webhook,
} from 'lucide-react'

const SUPABASE_WEBHOOK_URL = 'https://jxqnfzujsgtzzjabvplm.supabase.co/functions/v1/whatsapp-webhook'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="text-gray-400 hover:text-brand-600 transition-colors"
      title="Copiar"
    >
      {copied ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  )
}

export function IntegracaoWhatsApp() {
  const [channel, setChannel] = useState<WhatsAppChannel | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showToken, setShowToken] = useState(false)

  // Form state
  const [instanceId, setInstanceId] = useState('')
  const [token, setToken] = useState('')
  const [phone, setPhone] = useState('')
  const [n8nUrl, setN8nUrl] = useState('')
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    getWhatsAppChannel()
      .then((ch) => {
        setChannel(ch)
        if (ch) {
          setInstanceId(ch.external_account_id ?? '')
          setToken(ch.config_jsonb?.zapi_token ?? '')
          setPhone(ch.config_jsonb?.phone_number ?? '')
          setN8nUrl(ch.webhook_url ?? '')
          setIsActive(ch.is_active)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!instanceId.trim() || !token.trim()) {
      toast('Preencha o Instance ID e o Token', 'error')
      return
    }
    setSaving(true)
    try {
      await updateWhatsAppChannel({
        instance_id:  instanceId.trim(),
        zapi_token:   token.trim(),
        phone_number: phone.trim() || undefined,
        webhook_url:  n8nUrl.trim() || undefined,
        is_active:    isActive,
      })
      toast('Configurações do WhatsApp salvas')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const connected = !!(channel?.external_account_id)

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

  return (
    <div className="max-w-2xl space-y-6">

      {/* Status banner */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {connected ? 'Canal configurado' : 'Canal não configurado'}
              </p>
              <p className="text-xs text-gray-500">
                {connected
                  ? `Instance: ${channel?.external_account_id}`
                  : 'Insira as credenciais Z-API para conectar o WhatsApp'}
              </p>
            </div>
          </div>
          <Toggle
            checked={isActive}
            onChange={setIsActive}
            label="Ativo"
          />
        </div>
      </Card>

      {/* Z-API credentials */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-brand-600" />
          Credenciais Z-API
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Encontre estas informações no{' '}
          <a
            href="https://app.z-api.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline inline-flex items-center gap-0.5"
          >
            painel Z-API <ExternalLink className="h-3 w-3" />
          </a>
          , dentro da sua instância.
        </p>

        <div className="space-y-4">
          <Input
            label="Instance ID"
            value={instanceId}
            onChange={(e) => setInstanceId(e.target.value)}
            placeholder="Ex: 3A123ABC456DEF"
            hint="Identificador único da sua instância Z-API"
          />

          <div className="relative">
            <Input
              label="Client Token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole aqui o token da instância"
              hint="Token de segurança da instância Z-API"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Input
            label="Número do WhatsApp (opcional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+55 11 99999-9999"
            hint="Número vinculado à instância, para referência"
          />
        </div>
      </Card>

      {/* Webhook URLs */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <Webhook className="h-4 w-4 text-brand-600" />
          Configuração de Webhooks Z-API
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Configure dois webhooks distintos no painel Z-API em{' '}
          <span className="font-medium text-gray-700">Configurações → Webhooks</span>.
        </p>

        {/* Ao receber → n8n */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-1">
            Ao receber <span className="font-normal text-gray-500">(mensagens recebidas dos clientes → n8n)</span>
          </p>
          <div className="space-y-2">
            <Input
              value={n8nUrl}
              onChange={(e) => setN8nUrl(e.target.value)}
              placeholder="https://seu-n8n.exemplo.com/webhook/wa-inbound"
              hint="URL do webhook de entrada do n8n. Salve após preencher."
            />
            {n8nUrl && (
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="flex-1 text-xs text-gray-700 break-all font-mono">{n8nUrl}</code>
                <CopyButton value={n8nUrl} />
              </div>
            )}
          </div>
        </div>

        {/* Ao enviar → Supabase */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-700 mb-1">
            Ao enviar <span className="font-normal text-gray-500">(confirmação de envio → sistema)</span>
          </p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <code className="flex-1 text-xs text-gray-700 break-all font-mono">
              {SUPABASE_WEBHOOK_URL}
            </code>
            <CopyButton value={SUPABASE_WEBHOOK_URL} />
          </div>
        </div>

        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-800">
            <strong>Resumo:</strong> &ldquo;Ao receber&rdquo; aponta para o n8n (processa mensagens e aciona a IA).
            &ldquo;Ao enviar&rdquo; aponta para o Supabase (registra status de entrega).
          </p>
        </div>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving}>
          Salvar configurações
        </Button>
      </div>
    </div>
  )
}
