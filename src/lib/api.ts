import { supabase, TENANT_ID } from './supabase'
import type {
  DashboardSummary, Conversation, Appointment, Message,
  Customer, Professional, Service, WhatsAppTemplate,
  ReminderRule, ReminderDispatch, JobQueueItem, RpcActionResult,
} from '@/types'

// ─── Helper ───────────────────────────────────────────────────────────────────

async function rpc<T = unknown>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params)
  if (error) throw new Error(error.message)
  return data as T
}

// ─── Dashboard Summary ────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return rpc<DashboardSummary>('rpc_dashboard_summary', { p_tenant_id: TENANT_ID })
}

// ─── Conversas ────────────────────────────────────────────────────────────────

export async function listConversations(status?: string): Promise<Conversation[]> {
  return rpc<Conversation[]>('rpc_list_conversations', {
    p_tenant_id: TENANT_ID,
    p_status:    status || null,
    p_limit:     100,
    p_offset:    0,
  })
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .schema('messaging' as never)
    .from('messages')
    .select('id, direction, sender_type, content_text, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) throw new Error(error.message)
  return (data ?? []) as Message[]
}

// ─── Ações de atendimento (RPCs) ──────────────────────────────────────────────

export async function assumirConversa(
  conversationId: string,
  userId: string,
  userName: string,
): Promise<RpcActionResult> {
  return rpc<RpcActionResult>('rpc_assumir_conversa', {
    p_tenant_id:       TENANT_ID,
    p_conversation_id: conversationId,
    p_user_id:         userId,
    p_user_name:       userName,
  })
}

export async function registrarNota(
  conversationId: string,
  userId: string,
  userName: string,
  nota: string,
): Promise<RpcActionResult> {
  return rpc<RpcActionResult>('rpc_registrar_nota', {
    p_tenant_id:       TENANT_ID,
    p_conversation_id: conversationId,
    p_user_id:         userId,
    p_user_name:       userName,
    p_nota_text:       nota,
  })
}

export async function encerrarConversa(
  conversationId: string,
  userId: string,
  userName: string,
  motivo?: string,
): Promise<RpcActionResult> {
  return rpc<RpcActionResult>('rpc_encerrar_conversa', {
    p_tenant_id:       TENANT_ID,
    p_conversation_id: conversationId,
    p_user_id:         userId,
    p_user_name:       userName,
    p_motivo:          motivo ?? null,
  })
}

export async function criarAgendamentoDashboard(params: {
  customerId:     string
  professionalId: string
  serviceId:      string
  startAt:        string
  endAt:          string
  userId:         string
  userName:       string
  conversationId?:string
  notes?:         string
}): Promise<RpcActionResult> {
  return rpc<RpcActionResult>('rpc_criar_agendamento_dashboard', {
    p_tenant_id:        TENANT_ID,
    p_customer_id:      params.customerId,
    p_professional_id:  params.professionalId,
    p_service_id:       params.serviceId,
    p_start_at:         params.startAt,
    p_end_at:           params.endAt,
    p_user_id:          params.userId,
    p_user_name:        params.userName,
    p_conversation_id:  params.conversationId ?? null,
    p_notes:            params.notes ?? null,
  })
}

// ─── Agendamentos ─────────────────────────────────────────────────────────────

export async function listAppointments(status?: string): Promise<Appointment[]> {
  return rpc<Appointment[]>('rpc_list_appointments', {
    p_tenant_id: TENANT_ID,
    p_status:    status || null,
    p_limit:     100,
    p_offset:    0,
  })
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .schema('crm' as never)
    .from('customers')
    .select('id, full_name, phone_e164, email, status, first_contact_at, last_interaction_at')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Customer[]
}

// ─── Profissionais ────────────────────────────────────────────────────────────

export async function listProfessionals(): Promise<Professional[]> {
  const { data, error } = await supabase
    .schema('scheduling' as never)
    .from('professionals')
    .select('id, name, specialty, status')
    .eq('tenant_id', TENANT_ID)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Professional[]
}

// ─── Serviços ─────────────────────────────────────────────────────────────────

export async function listServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .schema('scheduling' as never)
    .from('services')
    .select('id, name, duration_minutes, price_from, price_to, is_active')
    .eq('tenant_id', TENANT_ID)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Service[]
}

// ─── Campanhas ────────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<WhatsAppTemplate[]> {
  const { data, error } = await supabase
    .schema('config' as never)
    .from('whatsapp_templates')
    .select('id, code, name, category, body_text, is_active')
    .eq('tenant_id', TENANT_ID)
  if (error) throw new Error(error.message)
  return (data ?? []) as WhatsAppTemplate[]
}

export async function listReminderRules(): Promise<ReminderRule[]> {
  const { data, error } = await supabase
    .schema('ops' as never)
    .from('reminder_rules')
    .select('id, name, trigger_type, hours_before, is_active')
    .eq('tenant_id', TENANT_ID)
  if (error) throw new Error(error.message)
  return (data ?? []) as ReminderRule[]
}

export async function listReminderDispatches(): Promise<ReminderDispatch[]> {
  const { data, error } = await supabase
    .schema('ops' as never)
    .from('reminder_dispatches')
    .select('id, status, dispatched_at, error_message, created_at')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)
  return (data ?? []) as ReminderDispatch[]
}

// ─── Observabilidade ──────────────────────────────────────────────────────────

export async function listJobQueue(): Promise<JobQueueItem[]> {
  const { data, error } = await supabase
    .schema('ops' as never)
    .from('job_queue')
    .select('id, queue_name, job_type, status, attempts, max_attempts, last_error, updated_at')
    .eq('tenant_id', TENANT_ID)
    .order('updated_at', { ascending: false })
    .limit(30)
  if (error) throw new Error(error.message)
  return (data ?? []) as JobQueueItem[]
}

// ─── Tenant ───────────────────────────────────────────────────────────────────

export async function getTenantName(): Promise<string> {
  const { data } = await supabase
    .schema('core' as never)
    .from('tenants')
    .select('name')
    .eq('id', TENANT_ID)
    .single()
  return (data as { name: string } | null)?.name ?? 'Tenant'
}
