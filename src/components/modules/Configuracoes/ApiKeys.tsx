'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { getApiKeys, upsertApiKeys } from '@/lib/api'
import type { ApiKeys } from '@/types'
import { toast } from '@/components/ui/Toast'
import { Eye, EyeOff, ExternalLink, CheckCircle2, XCircle } from 'lucide-react'

// ─── Provider definitions ─────────────────────────────────────────────────────

const PROVIDERS = [
  {
    id:       'anthropic' as keyof ApiKeys,
    name:     'Anthropic',
    product:  'Claude',
    color:    'bg-orange-50 border-orange-200',
    badge:    'bg-orange-100 text-orange-700',
    docsUrl:  'https://console.anthropic.com/settings/keys',
    docsLabel:'console.anthropic.com',
    prefix:   'sk-ant-',
    models:   ['Claude Sonnet 4', 'Claude Opus 4', 'Claude Haiku 4.5'],
    freeNote: null,
  },
  {
    id:       'openai' as keyof ApiKeys,
    name:     'OpenAI',
    product:  'ChatGPT / GPT-4o',
    color:    'bg-green-50 border-green-200',
    badge:    'bg-green-100 text-green-700',
    docsUrl:  'https://platform.openai.com/api-keys',
    docsLabel:'platform.openai.com',
    prefix:   'sk-',
    models:   ['GPT-4o', 'GPT-4o Mini', 'o1 Mini'],
    freeNote: null,
  },
  {
    id:       'google' as keyof ApiKeys,
    name:     'Google',
    product:  'Gemini',
    color:    'bg-blue-50 border-blue-200',
    badge:    'bg-blue-100 text-blue-700',
    docsUrl:  'https://aistudio.google.com/app/apikey',
    docsLabel:'aistudio.google.com',
    prefix:   'AIza',
    models:   ['Gemini 2.0 Flash', 'Gemini 2.5 Pro', 'Gemini 1.5 Flash'],
    freeNote: 'Tier gratuito disponível: até 1.500 requisições/dia com Gemini 1.5 Flash',
  },
]

// ─── Mask helper ─────────────────────────────────────────────────────────────

function maskKey(key: string): string {
  if (key.length <= 12) return '••••••••••••'
  return key.slice(0, 8) + '••••••••' + key.slice(-4)
}

// ─── Provider card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  currentKey,
  onSave,
}: {
  provider: typeof PROVIDERS[0]
  currentKey: string | undefined
  onSave: (key: string) => Promise<void>
}) {
  const [editing, setEditing]   = useState(false)
  const [value, setValue]       = useState('')
  const [visible, setVisible]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const isConfigured = !!(currentKey && currentKey.trim())

  async function save() {
    if (!value.trim()) { toast('Insira a chave antes de salvar', 'error'); return }
    setSaving(true)
    try {
      await onSave(value.trim())
      setEditing(false)
      setValue('')
      toast(`Chave ${provider.name} salva`)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm(`Remover a chave ${provider.name}?`)) return
    setSaving(true)
    try {
      await onSave('')
      toast(`Chave ${provider.name} removida`)
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao remover', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${provider.color}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">{provider.name}</p>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${provider.badge}`}>
                {provider.product}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {provider.models.map((m) => (
                <span key={m} className="text-xs text-gray-500 bg-white/70 border border-gray-200 px-1.5 py-0.5 rounded">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isConfigured ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-gray-300" />
          )}
          <span className={`text-xs font-medium ${isConfigured ? 'text-green-600' : 'text-gray-400'}`}>
            {isConfigured ? 'Configurado' : 'Não configurado'}
          </span>
        </div>
      </div>

      {/* Current key (masked) */}
      {isConfigured && !editing && (
        <div className="flex items-center justify-between gap-3 bg-white/60 rounded-lg px-3 py-2 border border-white/80">
          <code className="text-xs text-gray-600 font-mono tracking-wider">
            {maskKey(currentKey!)}
          </code>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setValue('') }}>
              Alterar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={remove}
              loading={saving}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              Remover
            </Button>
          </div>
        </div>
      )}

      {/* Input field */}
      {(!isConfigured || editing) && (
        <div className="space-y-2">
          <div className="relative">
            <input
              type={visible ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`${provider.prefix}...`}
              className="w-full pr-10 pl-3 py-2 text-sm font-mono bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
              onKeyDown={(e) => e.key === 'Enter' && save()}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Obter chave em {provider.docsLabel}
            </a>
            <div className="flex items-center gap-2">
              {editing && (
                <Button variant="secondary" size="sm" onClick={() => { setEditing(false); setValue('') }}>
                  Cancelar
                </Button>
              )}
              <Button size="sm" onClick={save} loading={saving}>
                Salvar chave
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Free tier note */}
      {provider.freeNote && (
        <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          ✓ {provider.freeNote}
        </p>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ApiKeys() {
  const [keys, setKeys]     = useState<ApiKeys>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getApiKeys()
      .then(setKeys)
      .catch(() => {/* empty keys on error */})
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(provider: keyof ApiKeys, key: string) {
    const updated = { ...keys, [provider]: key || undefined }
    await upsertApiKeys({ [provider]: key })
    setKeys(updated)
  }

  if (loading)
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
      </div>
    )

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <p className="font-medium mb-1">Segurança das chaves</p>
        <p className="text-xs text-amber-700">
          As chaves são armazenadas criptografadas no banco de dados do seu tenant e
          nunca expostas no frontend. Use chaves com escopo mínimo necessário (somente leitura/geração de texto).
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            currentKey={keys[p.id]}
            onSave={(key) => handleSave(p.id, key)}
          />
        ))}
      </div>

      <p className="text-xs text-gray-400">
        O modelo ativo é definido em <strong>Prompt e Modelo → Modelo LLM</strong>.
        A chave correspondente ao provedor selecionado será usada automaticamente pelo agente.
      </p>
    </div>
  )
}
