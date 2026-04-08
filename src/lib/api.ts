import { supabase, TENANT_ID, CHANNEL_ID } from './supabase'
import type {
  DashboardSummary,
  Conversation,
  Message,
  Customer,
  Appointment,
  Service,
  Professional,
  Campaign,
  MessageTemplate,
  ConversationSummary,
  CustomerMemory,
  AiDecision,
  MessageIntent,
  AiAgentProfile,
  AiAgent,
  PromptTemplate,
  BusinessHour,
  ChannelSettings,
  TenantSettings,
  HandoffRule,
  SlaRule,
  FeatureFlag,
  VoiceProfile,
  AuditLog,
  IntegrationLog,
  JobEntry,
} from '@/types'

async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw error
  return data as T
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return rpc('rpc_dashboard_summary', { p_tenant_id: TENANT_ID })
}

// ─── Conversations ───────────────────────────────────────────────────────────

export async function listConversations(status?: string): Promise<Conversation[]> {
  return rpc('rpc_list_conversations', {
    p_tenant_id: TENANT_ID,
    p_status: status ?? null,
  })
}

export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  return rpc('rpc_get_conversation_messages', {
    p_tenant_id: TENANT_ID,
    p_conversation_id: conversationId,
  })
}

export async function assumirConversa(conversationId: string, agentId: string): Promise<void> {
  await rpc('rpc_assumir_conversa', {
    p_tenant_id: TENANT_ID,
    p_conversation_id: conversationId,
    p_agent_id: agentId,
  })
}

export async function registrarNota(conversationId: string, nota: string): Promise<void> {
  await rpc('rpc_registrar_nota', {
    p_tenant_id: TENANT_ID,
    p_conversation_id: conversationId,
    p_nota: nota,
  })
}

export async function encerrarConversa(conversationId: string): Promise<void> {
  await rpc('rpc_encerrar_conversa', {
    p_tenant_id: TENANT_ID,
    p_conversation_id: conversationId,
  })
}

// ─── Customers ───────────────────────────────────────────────────────────────

export async function listCustomers(search?: string): Promise<Customer[]> {
  return rpc('rpc_list_customers', {
    p_tenant_id: TENANT_ID,
    p_search: search ?? null,
  })
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  return rpc('rpc_get_customer', {
    p_tenant_id: TENANT_ID,
    p_customer_id: customerId,
  })
}

// ─── Appointments ────────────────────────────────────────────────────────────

export async function listAppointments(date?: string): Promise<Appointment[]> {
  return rpc('rpc_list_appointments', {
    p_tenant_id: TENANT_ID,
    p_date: date ?? null,
  })
}

export async function criarAgendamento(params: {
  customer_id: string
  professional_id: string
  service_id: string
  scheduled_at: string
  notes?: string
}): Promise<void> {
  await rpc('rpc_criar_agendamento_dashboard', {
    p_tenant_id: TENANT_ID,
    ...params,
  })
}

// ─── Services ────────────────────────────────────────────────────────────────

export async function listServices(): Promise<Service[]> {
  return rpc('rpc_list_services', { p_tenant_id: TENANT_ID })
}

// ─── Professionals ───────────────────────────────────────────────────────────

export async function listProfessionals(): Promise<Professional[]> {
  return rpc('rpc_list_professionals', { p_tenant_id: TENANT_ID })
}

// ─── Campaigns / Templates ───────────────────────────────────────────────────

export async function listCampaigns(): Promise<Campaign[]> {
  return rpc('rpc_list_campaigns', { p_tenant_id: TENANT_ID })
}

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  return rpc('rpc_list_message_templates', { p_tenant_id: TENANT_ID })
}

// ─── AI: Conversation Details (summaries, decisions, memories, intents) ──────

export async function getConversationSummary(
  conversationId: string,
): Promise<ConversationSummary | null> {
  return rpc('rpc_get_conversation_summary', {
    p_tenant_id: TENANT_ID,
    p_conversation_id: conversationId,
  })
}

export async function getAiDecisions(conversationId: string): Promise<AiDecision[]> {
  return rpc('rpc_get_ai_decisions', {
    p_tenant_id: TENANT_ID,
    p_conversation_id: conversationId,
  })
}

export async function getMessageIntents(conversationId: string): Promise<MessageIntent[]> {
  return rpc('rpc_get_message_intents', {
    p_tenant_id: TENANT_ID,
    p_conversation_id: conversationId,
  })
}

export async function getCustomerMemories(customerId: string): Promise<CustomerMemory[]> {
  return rpc('rpc_get_customer_memories', {
    p_tenant_id: TENANT_ID,
    p_customer_id: customerId,
  })
}

// ─── Config: AI Settings (Module 10) ─────────────────────────────────────────

export async function getAiAgentProfile(): Promise<AiAgentProfile | null> {
  return rpc('rpc_get_ai_agent_profile', { p_tenant_id: TENANT_ID })
}

export async function updateAiAgentProfile(
  data: Partial<AiAgentProfile>,
): Promise<void> {
  await rpc('rpc_update_ai_agent_profile', {
    p_tenant_id: TENANT_ID,
    p_profile_name: data.profile_name,
    p_objective: data.objective,
    p_tone: data.tone,
    p_verbosity: data.verbosity,
    p_escalation_policy: data.escalation_policy,
    p_use_memory: data.use_memory,
    p_use_recommendations: data.use_recommendations,
    p_use_scheduling: data.use_scheduling,
    p_allow_voice_response: data.allow_voice_response,
  })
}

export async function getAiAgent(): Promise<AiAgent | null> {
  return rpc('rpc_get_ai_agent', { p_tenant_id: TENANT_ID })
}

export async function updateAiAgent(data: Partial<AiAgent>): Promise<void> {
  await rpc('rpc_update_ai_agent', {
    p_tenant_id: TENANT_ID,
    p_name: data.name,
    p_model_name: data.model_name,
    p_system_prompt: data.system_prompt,
    p_temperature: data.temperature,
    p_max_tokens: data.max_tokens,
    p_tools_jsonb: data.tools_jsonb ?? null,
  })
}

export async function listPromptTemplates(): Promise<PromptTemplate[]> {
  return rpc('rpc_list_prompt_templates', { p_tenant_id: TENANT_ID })
}

export async function upsertPromptTemplate(
  data: Omit<PromptTemplate, 'id' | 'tenant_id' | 'version' | 'updated_at'>,
): Promise<void> {
  await rpc('rpc_upsert_prompt_template', {
    p_tenant_id: TENANT_ID,
    p_code: data.code,
    p_title: data.title,
    p_prompt_text: data.prompt_text,
    p_is_active: data.is_active,
    p_metadata_jsonb: data.metadata_jsonb ?? null,
  })
}

export async function getBusinessHours(): Promise<BusinessHour[]> {
  return rpc('rpc_get_business_hours', { p_tenant_id: TENANT_ID })
}

export async function updateBusinessHours(hours: BusinessHour[]): Promise<void> {
  await rpc('rpc_update_business_hours', {
    p_tenant_id: TENANT_ID,
    p_hours: hours,
  })
}

export async function getChannelSettings(): Promise<ChannelSettings | null> {
  return rpc('rpc_get_channel_settings', {
    p_tenant_id: TENANT_ID,
    p_channel_id: CHANNEL_ID,
  })
}

export async function updateChannelSettings(data: Partial<ChannelSettings>): Promise<void> {
  await rpc('rpc_update_channel_settings', {
    p_tenant_id: TENANT_ID,
    p_channel_id: CHANNEL_ID,
    p_welcome_message: data.welcome_message,
    p_out_of_hours_message: data.out_of_hours_message,
    p_handoff_message: data.handoff_message,
    p_buffer_active: data.buffer_active,
    p_typing_simulation: data.typing_simulation,
  })
}

export async function getTenantSettings(): Promise<TenantSettings | null> {
  return rpc('rpc_get_tenant_settings', { p_tenant_id: TENANT_ID })
}

export async function updateTenantSettings(data: Partial<TenantSettings>): Promise<void> {
  await rpc('rpc_update_tenant_settings', {
    p_tenant_id: TENANT_ID,
    p_business_name: data.business_name,
    p_timezone: data.timezone,
    p_language: data.language,
    p_intake_mode: data.intake_mode,
    p_allow_audio: data.allow_audio,
    p_allow_image: data.allow_image,
    p_allow_voice: data.allow_voice,
    p_human_approval_high_risk: data.human_approval_high_risk,
    p_auto_create_customer: data.auto_create_customer,
  })
}

export async function listHandoffRules(): Promise<HandoffRule[]> {
  return rpc('rpc_list_handoff_rules', { p_tenant_id: TENANT_ID })
}

export async function upsertHandoffRule(data: Partial<HandoffRule>): Promise<void> {
  await rpc('rpc_upsert_handoff_rule', {
    p_tenant_id: TENANT_ID,
    p_id: data.id ?? null,
    p_rule_name: data.rule_name,
    p_trigger_type: data.trigger_type,
    p_trigger_config_jsonb: data.trigger_config_jsonb ?? {},
    p_target_role: data.target_role,
    p_is_active: data.is_active ?? true,
  })
}

export async function listSlaRules(): Promise<SlaRule[]> {
  return rpc('rpc_list_sla_rules', { p_tenant_id: TENANT_ID })
}

export async function upsertSlaRule(data: Partial<SlaRule>): Promise<void> {
  await rpc('rpc_upsert_sla_rule', {
    p_tenant_id: TENANT_ID,
    p_id: data.id ?? null,
    p_priority: data.priority,
    p_first_response_seconds: data.first_response_seconds,
    p_resolution_seconds: data.resolution_seconds,
    p_business_hours_only: data.business_hours_only ?? true,
    p_is_active: data.is_active ?? true,
  })
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  return rpc('rpc_list_feature_flags', { p_tenant_id: TENANT_ID })
}

export async function updateFeatureFlag(code: string, isEnabled: boolean, configJsonb?: Record<string, unknown>): Promise<void> {
  await rpc('rpc_update_feature_flag', {
    p_tenant_id: TENANT_ID,
    p_code: code,
    p_is_enabled: isEnabled,
    p_config_jsonb: configJsonb ?? null,
  })
}

export async function listVoiceProfiles(): Promise<VoiceProfile[]> {
  return rpc('rpc_list_voice_profiles', { p_tenant_id: TENANT_ID })
}

export async function upsertVoiceProfile(data: Partial<VoiceProfile>): Promise<void> {
  await rpc('rpc_upsert_voice_profile', {
    p_tenant_id: TENANT_ID,
    p_id: data.id ?? null,
    p_name: data.name,
    p_provider: data.provider,
    p_voice_external_id: data.voice_external_id,
    p_language_code: data.language_code,
    p_gender: data.gender,
    p_settings_jsonb: data.settings_jsonb ?? null,
    p_is_default: data.is_default ?? false,
  })
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export async function listAuditLogs(params: {
  entity_type?: string
  action?: string
  actor_type?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}): Promise<AuditLog[]> {
  return rpc('rpc_list_audit_logs', {
    p_tenant_id: TENANT_ID,
    p_entity_type: params.entity_type ?? null,
    p_action: params.action ?? null,
    p_actor_type: params.actor_type ?? null,
    p_date_from: params.date_from ?? null,
    p_date_to: params.date_to ?? null,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
  })
}

export async function listIntegrationLogs(params: {
  integration_name?: string
  status?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}): Promise<IntegrationLog[]> {
  return rpc('rpc_list_integration_logs', {
    p_tenant_id: TENANT_ID,
    p_integration_name: params.integration_name ?? null,
    p_status: params.status ?? null,
    p_date_from: params.date_from ?? null,
    p_date_to: params.date_to ?? null,
    p_limit: params.limit ?? 50,
    p_offset: params.offset ?? 0,
  })
}

// ─── Observability ───────────────────────────────────────────────────────────

export async function listJobs(): Promise<JobEntry[]> {
  return rpc('rpc_list_jobs', { p_tenant_id: TENANT_ID })
}
