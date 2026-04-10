'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  listServices, listProfessionals, getBusinessHours,
  getBusinessContact, updateBusinessContact,
} from '@/lib/api'
import type { Service, Professional, BusinessHour, BusinessContact } from '@/types'
import { toast } from '@/components/ui/Toast'
import {
  ExternalLink, Scissors, Users, Clock, AlertCircle,
  MapPin, Phone, Globe, Mail, Instagram, Facebook, MessageCircle,
} from 'lucide-react'
import Link from 'next/link'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// ─── Contact form ─────────────────────────────────────────────────────────────

function ContactForm({ initial, onSaved }: {
  initial: BusinessContact
  onSaved: (c: BusinessContact) => void
}) {
  const [form, setForm] = useState<BusinessContact>(initial)
  const [saving, setSaving] = useState(false)

  function field(key: keyof BusinessContact) {
    return {
      value: form[key] ?? '',
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((p) => ({ ...p, [key]: e.target.value || undefined })),
    }
  }

  async function save() {
    setSaving(true)
    try {
      // Remove empty strings before saving
      const clean = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v && String(v).trim()),
      ) as BusinessContact
      await updateBusinessContact(clean)
      onSaved(clean)
      toast('Dados de contato salvos')
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : 'Erro ao salvar', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Endereço completo"
          placeholder="Rua, nº, bairro, cidade – UF"
          {...field('address')}
        />
        <Input
          label="Link do Google Maps"
          placeholder="https://maps.google.com/..."
          {...field('google_maps_url')}
        />
        <Input
          label="Telefone / Ligações"
          placeholder="(11) 3333-4444"
          {...field('phone')}
        />
        <Input
          label="WhatsApp"
          placeholder="(11) 99999-8888"
          {...field('whatsapp')}
        />
        <Input
          label="Site"
          placeholder="https://www.clinica.com.br"
          {...field('website')}
        />
        <Input
          label="E-mail"
          placeholder="contato@clinica.com.br"
          {...field('email')}
        />
        <Input
          label="Instagram"
          placeholder="@clinica ou URL completa"
          {...field('instagram')}
        />
        <Input
          label="Facebook"
          placeholder="@clinica ou URL completa"
          {...field('facebook')}
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-500">
          Estes dados ficam disponíveis para a IA via{' '}
          <code className="bg-gray-100 px-1 rounded text-gray-600">{'{{negocio_telefone}}'}</code>{' '}
          e demais variáveis do grupo <strong>Negócio</strong>.
        </p>
        <Button onClick={save} loading={saving} size="sm">
          Salvar
        </Button>
      </div>
    </div>
  )
}

// ─── Contact display (read-only preview) ─────────────────────────────────────

function ContactDisplay({
  contact, onEdit,
}: {
  contact: BusinessContact
  onEdit: () => void
}) {
  const rows: { icon: React.ElementType; label: string; value: string; href?: string }[] = [
    { icon: MapPin,         label: 'Endereço',   value: contact.address ?? '—' },
    { icon: MapPin,         label: 'Google Maps', value: contact.google_maps_url ? 'Ver mapa' : '—', href: contact.google_maps_url },
    { icon: Phone,          label: 'Telefone',   value: contact.phone ?? '—' },
    { icon: MessageCircle,  label: 'WhatsApp',   value: contact.whatsapp ?? '—' },
    { icon: Globe,          label: 'Site',       value: contact.website ? 'Abrir site' : '—', href: contact.website },
    { icon: Mail,           label: 'E-mail',     value: contact.email ?? '—' },
    { icon: Instagram,      label: 'Instagram',  value: contact.instagram ?? '—' },
    { icon: Facebook,       label: 'Facebook',   value: contact.facebook ?? '—' },
  ].filter((r) => r.value !== '—')

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">Nenhum dado de contato cadastrado</p>
        <Button variant="secondary" size="sm" onClick={onEdit}>Preencher</Button>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {rows.map(({ icon: Icon, label, value, href }) => (
        <div key={label} className="flex items-start gap-2.5">
          <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500">{label}</p>
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand-600 hover:underline"
              >
                {value}
              </a>
            ) : (
              <p className="text-sm text-gray-900">{value}</p>
            )}
          </div>
        </div>
      ))}
      <div className="flex justify-end pt-1 border-t border-gray-100">
        <Button variant="secondary" size="sm" onClick={onEdit}>Editar</Button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DadosNegocio() {
  const [services,      setServices]      = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [hours,         setHours]         = useState<BusinessHour[]>([])
  const [contact,       setContact]       = useState<BusinessContact>({})
  const [loading,       setLoading]       = useState(true)
  const [hoursError,    setHoursError]    = useState<string | null>(null)
  const [editingContact, setEditingContact] = useState(false)

  useEffect(() => {
    Promise.allSettled([
      listServices(),
      listProfessionals(),
      getBusinessHours(),
      getBusinessContact(),
    ]).then(([s, p, h, c]) => {
      if (s.status === 'fulfilled') setServices(s.value)
      if (p.status === 'fulfilled') setProfessionals(p.value)
      if (h.status === 'fulfilled') setHours(h.value)
      else setHoursError((h as PromiseRejectedResult).reason?.message ?? 'Erro ao carregar horários')
      if (c.status === 'fulfilled') {
        setContact(c.value)
        // Auto-open form if no contact data yet
        const hasData = Object.values(c.value).some((v) => v && String(v).trim())
        if (!hasData) setEditingContact(true)
      }
    }).finally(() => setLoading(false))
  }, [])

  const sortedHours = [...hours].sort((a, b) => a.day_of_week - b.day_of_week)

  if (loading)
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
      </div>
    )

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        Estes dados são usados pela IA para contextualizar o atendimento. Mantenha-os atualizados.
      </p>

      {/* Contact info */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-500" />
              Contato e Localização
            </span>
          </CardTitle>
          {!editingContact && (
            <button
              onClick={() => setEditingContact(true)}
              className="text-xs text-brand-600 hover:underline"
            >
              Editar
            </button>
          )}
        </CardHeader>
        {editingContact ? (
          <ContactForm
            initial={contact}
            onSaved={(c) => { setContact(c); setEditingContact(false) }}
          />
        ) : (
          <ContactDisplay contact={contact} onEdit={() => setEditingContact(true)} />
        )}
      </Card>

      {/* Services */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-brand-500" />
              Serviços ({services.length})
            </span>
          </CardTitle>
          <Link
            href="/servicos"
            className="flex items-center gap-1 text-xs text-brand-600 hover:underline"
          >
            Gerenciar <ExternalLink className="h-3 w-3" />
          </Link>
        </CardHeader>
        {services.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum serviço cadastrado</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  {s.description && (
                    <p className="text-xs text-gray-500 line-clamp-1">{s.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-500">{s.duration_minutes}min</span>
                  <Badge variant={s.is_active ? 'success' : 'default'}>
                    {s.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Professionals */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Profissionais ({professionals.length})
            </span>
          </CardTitle>
        </CardHeader>
        {professionals.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum profissional cadastrado</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {professionals.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-purple-700">
                    {p.name.charAt(0)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  {p.specialty && (
                    <p className="text-xs text-gray-500">{p.specialty}</p>
                  )}
                </div>
                <Badge variant={p.is_active ? 'success' : 'default'}>
                  {p.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Business hours */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              Horário de funcionamento
            </span>
          </CardTitle>
        </CardHeader>
        {hoursError ? (
          <div className="flex items-center gap-2 text-amber-700 p-3 bg-amber-50 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Horários indisponíveis — configure via módulo Agenda.
          </div>
        ) : sortedHours.length === 0 ? (
          <p className="text-sm text-gray-400">Horários não configurados</p>
        ) : (
          <ul className="space-y-1">
            {sortedHours.map((h) => (
              <li key={h.id} className="flex items-center gap-3 py-1.5">
                <span className="w-20 text-sm text-gray-600">{DAYS[h.day_of_week]}</span>
                {h.is_open ? (
                  <span className="text-sm text-gray-900">
                    {h.open_time} – {h.close_time}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400 italic">Fechado</span>
                )}
                <Badge variant={h.is_open ? 'success' : 'default'}>
                  {h.is_open ? 'Aberto' : 'Fechado'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
