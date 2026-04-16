'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Toggle } from '@/components/ui/Toggle'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { listVoiceProfiles, upsertVoiceProfile } from '@/lib/api'
import type { VoiceProfile } from '@/types'
import { toast } from '@/components/ui/Toast'
import { AlertCircle, Plus, Edit3, Mic } from 'lucide-react'

export function Voz() {
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<Partial<VoiceProfile> & { api_key?: string; send_text_with_audio?: boolean }>({
    name: '', provider: 'elevenlabs', voice_external_id: '',
    language_code: 'pt-BR', gender: 'female', is_default: false, api_key: '',
    send_text_with_audio: true,
  })

  const load = () => {
    setLoading(true)
    listVoiceProfiles()
      .then(setProfiles)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const openNew = () => {
    setForm({
      name: '', provider: 'elevenlabs', voice_external_id: '',
      language_code: 'pt-BR', gender: 'female', is_default: false, api_key: '',
      send_text_with_audio: true,
    })
    setModal(true)
  }

  const openEdit = (p: VoiceProfile) => {
    setForm({
      ...p,
      api_key: (p.settings_jsonb?.api_key as string) ?? '',
      send_text_with_audio: (p.settings_jsonb?.send_text_with_audio as boolean) ?? true,
    })
    setModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.voice_external_id) {
      toast('Preencha nome e ID da voz', 'error')
      return
    }
    if (!form.api_key && !form.settings_jsonb?.api_key) {
      toast('Preencha a API Key do ElevenLabs', 'error')
      return
    }
    // Monta settings_jsonb com api_key + defaults do modelo + opção de texto
    const settings_jsonb = {
      ...(form.settings_jsonb ?? {}),
      model_id: 'eleven_multilingual_v2',
      stability: 0.5,
      similarity_boost: 0.75,
      send_text_with_audio: form.send_text_with_audio ?? true,
      ...(form.api_key ? { api_key: form.api_key } : {}),
    }
    setSaving(true)
    try {
      await upsertVoiceProfile({ ...form, settings_jsonb })
      toast('Perfil de voz salvo')
      setModal(false)
      load()
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

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg text-sm text-purple-800">
        Configure as vozes do ElevenLabs usadas pelo agente. Esta seção só tem efeito se
        &ldquo;Responder por áudio&rdquo; estiver habilitado no Perfil do Agente.
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{profiles.length} perfis de voz</p>
        <Button variant="secondary" size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Novo perfil
        </Button>
      </div>

      {profiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400">
          <Mic className="h-8 w-8 mb-2" />
          <p className="text-sm">Nenhum perfil de voz configurado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {profiles.map((p) => (
            <Card key={p.id} className="relative">
              {p.is_default && (
                <span className="absolute top-3 right-3 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                  Padrão
                </span>
              )}
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Mic className="h-4 w-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.provider} · {p.language_code}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Badge variant="purple">{p.gender === 'female' ? 'Feminino' : p.gender === 'male' ? 'Masculino' : 'Neutro'}</Badge>
                <span className="font-mono truncate">{p.voice_external_id}</span>
              </div>
              <div className="flex justify-end mt-3">
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>
                  <Edit3 className="h-3 w-3" /> Editar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Perfil de voz">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Nome"
              value={form.name ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Voz principal"
            />
            <Select
              label="Provedor"
              value={form.provider ?? 'elevenlabs'}
              onChange={(e) => setForm((p) => ({ ...p, provider: e.target.value }))}
              options={[{ value: 'elevenlabs', label: 'ElevenLabs' }]}
            />
          </div>
          <Input
            label="ID externo da voz (ElevenLabs)"
            value={form.voice_external_id ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, voice_external_id: e.target.value }))}
            placeholder="21m00Tcm4TlvDq8ikWAM"
            hint="Encontre o ID no painel do ElevenLabs"
          />
          <Input
            label="API Key ElevenLabs"
            type="password"
            value={form.api_key ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, api_key: e.target.value }))}
            placeholder={form.settings_jsonb?.api_key ? '••••••••• (salva — cole para alterar)' : 'sk_...'}
            hint="Crie em elevenlabs.io → Perfil → API Keys"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Idioma"
              value={form.language_code ?? 'pt-BR'}
              onChange={(e) => setForm((p) => ({ ...p, language_code: e.target.value }))}
              options={[
                { value: 'pt-BR', label: 'Português (Brasil)' },
                { value: 'pt-PT', label: 'Português (Portugal)' },
                { value: 'en-US', label: 'English (US)' },
                { value: 'es-ES', label: 'Español' },
              ]}
            />
            <Select
              label="Gênero"
              value={form.gender ?? 'female'}
              onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value as VoiceProfile['gender'] }))}
              options={[
                { value: 'female',  label: 'Feminino' },
                { value: 'male',    label: 'Masculino' },
                { value: 'neutral', label: 'Neutro'   },
              ]}
            />
          </div>
          <Toggle
            checked={form.send_text_with_audio ?? true}
            onChange={(v) => setForm((p) => ({ ...p, send_text_with_audio: v }))}
            label="Enviar texto junto com o áudio"
            description="Desativado: ao responder por voz, envia apenas o áudio (sem a mensagem de texto)"
          />
          <Toggle
            checked={form.is_default ?? false}
            onChange={(v) => setForm((p) => ({ ...p, is_default: v }))}
            label="Definir como voz padrão"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
