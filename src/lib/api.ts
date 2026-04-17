import {
  supabase,
  getTenantId,
  CHANNEL_ID,
  getCurrentAgentId,
  getCurrentAgentName,
} from './supabase'
import type {
  DashboardSummary,
  DailyMetric,
  DailyAppointmentMetric,
  Conversation,
  Message,
  Customer,
  ManualRecipient,
  Appointment,
  Service,
  Professional,
  ProfessionalAvailability,
  AvailableSlot,
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
  WhatsAppChannel,
  TenantSettings,
  Tenant,
  HandoffEntry,
  ReminderRule,
  HandoffRule,
  SlaRule,
  FeatureFlag,
  VoiceProfile,
  AuditLog,
  IntegrationLog,
  JobEntry,
  PredictionScore,
  RoiSummary,
  BusinessProfile,
  BusinessContact,
  ApiKeys,
  UserTenantMembership,
  OperationalStats,
  RecipientFilter,
} from '@/types'

async function rpc<T>(name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message ?? error.details ?? 'Erro desconhecido')
  return data as T
}

// json_agg() returns NULL for empty tables — always return [] instead of null
async function rpcList<T>(name: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const { data, error } = await supabase.rpc(name, params)
  if (error) throw new Error(error.message ?? error.details ?? 'Erro desconhecido')
  return (data as T[] | null) ?? []
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return rpc('rpc_dashboard_summary', { p_tenant_id: getTenantId() })
}

export async function getOperationalStats(): Promise<OperationalStats> {
  return rpc('rpc_get_operational_stats', { p_tenant_id: getTenantId() })
}

export async function getConversationsTrend(days = 30): Promise<DailyMetric[]> {
  return rpcList('rpc_conversations_trend', { p_tenant_id: getTenantId(), p_days: days })
}

export async function getAppointmentsTrend(days = 30): Promise<DailyAppointmentMetric[]> {
  return rpcList('rpc_appointments_trend', { p_tenant_id: getTenantId(), p_days: days })
}

// ─── Conversations ───────────────────────────────────────────────────────────

export async function listConversations(status?: string, customerId?: string): Promise<Conversation[]> {
  return rpcList('rpc_list_conversations', {
    p_tenant_id:   getTenantId(),
    p_status:      status     ?? null,
    p_customer_id: customerId ?? null,
  })
}

export async function getConversationMessages(conversationId: string): Promise<Message[]> {
  return rpcList('rpc_get_conversation_messages', {
    p_tenant_id: getTenantId(),
    p_conversation_id: conversationId,
  })
}

const PLACEHOLDER_UUID = '00000000-0000-0000-0000-000000000001'

export async function assumirConversa(conversationId: string, agentId?: string): Promise<void> {
  const userId = agentId ?? getCurrentAgentId()
  await rpc('rpc_assumir_conversa', {
    p_tenant_id: getTenantId(),
    p_conversation_id: conversationId,
    p_user_id: userId === PLACEHOLDER_UUID ? null : userId,
    p_user_name: getCurrentAgentName(),
  })
}

export async function registrarNota(conversationId: string, nota: string): Promise<void> {
  await rpc('rpc_registrar_nota', {
    p_tenant_id: getTenantId(),
    p_conversation_id: conversationId,
    p_user_id: getCurrentAgentId(),
    p_user_name: getCurrentAgentName(),
    p_nota_text: nota,
  })
}

export async function encerrarConversa(conversationId: string): Promise<void> {
  await rpc('rpc_encerrar_conversa', {
    p_tenant_id: getTenantId(),
    p_conversation_id: conversationId,
    p_user_id: getCurrentAgentId(),
    p_user_name: getCurrentAgentName(),
  })
}

export async function agentSendMessage(
  conversationId: string,
  messageText: string,
): Promise<{ customer_phone: string; zapi_instance_id: string; zapi_token: string; zapi_client_token: string }> {
  return rpc('rpc_agent_send_message', {
    p_tenant_id: getTenantId(),
    p_conversation_id: conversationId,
    p_message_text: messageText,
  })
}

export async function devolverAoBot(conversationId: string): Promise<void> {
  await rpc('rpc_devolver_ao_bot', {
    p_tenant_id: getTenantId(),
    p_conversation_id: conversationId,
  })
}

export async function reabrirConversa(conversationId: string): Promise<void> {
  await rpc('rpc_reabrir_conversa', {
    p_tenant_id: getTenantId(),
    p_conversation_id: conversationId,
  })
}

// ─── Customers ───────────────────────────────────────────────────────────────

export async function listCustomers(search?: string, tag?: string): Promise<Customer[]> {
  return rpcList('rpc_list_customers', {
    p_tenant_id: getTenantId(),
    p_search: search ?? null,
    p_tag: tag ?? null,
  })
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  return rpc('rpc_get_customer', {
    p_tenant_id: getTenantId(),
    p_customer_id: customerId,
  })
}

export async function updateCustomerTags(customerId: string, tags: string[]): Promise<void> {
  await rpc('rpc_update_customer_tags', {
    p_tenant_id: getTenantId(),
    p_customer_id: customerId,
    p_tags: tags,
  })
}

export async function listCustomerTags(): Promise<string[]> {
  return rpcList('rpc_list_customer_tags', { p_tenant_id: getTenantId() })
}

export async function autoTagCustomers(): Promise<{ updated: number }> {
  return rpc('rpc_auto_tag_customers', { p_tenant_id: getTenantId() })
}

export async function updateCustomer(customerId: string, data: {
  full_name?: string
  phone_e164?: string
  email?: string
  status?: string
  notes?: string
}): Promise<void> {
  await rpc('rpc_update_customer', {
    p_tenant_id:   getTenantId(),
    p_customer_id: customerId,
    p_full_name:   data.full_name   ?? null,
    p_phone_e164:  data.phone_e164  ?? null,
    p_email:       data.email       ?? null,
    p_status:      data.status      ?? null,
    p_notes:       data.notes       ?? null,
  })
}

// ─── Appointments ────────────────────────────────────────────────────────────

export async function listAppointments(dateFrom?: string, dateTo?: string, customerId?: string, professionalId?: string): Promise<Appointment[]> {
  return rpcList('rpc_list_appointments', {
    p_tenant_id:        getTenantId(),
    p_date_from:        dateFrom       ?? null,
    p_date_to:          dateTo         ?? null,
    p_customer_id:      customerId     ?? null,
    p_professional_id:  professionalId ?? null,
  })
}

export async function updateAppointmentStatus(id: string, status: string): Promise<void> {
  await rpc('rpc_update_appointment_status', {
    p_tenant_id: getTenantId(),
    p_id: id,
    p_status: status,
  })
}

export async function criarAgendamento(params: {
  customer_id: string
  professional_id: string
  service_id: string
  start_at: string
  end_at: string
  notes?: string
}): Promise<void> {
  await rpc('rpc_criar_agendamento_dashboard', {
    p_tenant_id: getTenantId(),
    p_customer_id: params.customer_id,
    p_professional_id: params.professional_id,
    p_service_id: params.service_id,
    p_start_at: params.start_at,
    p_end_at: params.end_at,
    p_user_id: getCurrentAgentId(),
    p_user_name: getCurrentAgentName(),
    p_conversation_id: null,
    p_notes: params.notes ?? null,
  })
}

// ─── Services ────────────────────────────────────────────────────────────────

export async function listServices(): Promise<Service[]> {
  return rpcList('rpc_list_services', { p_tenant_id: getTenantId() })
}

export async function upsertService(data: Partial<Service>): Promise<void> {
  await rpc('rpc_upsert_service', {
    p_tenant_id:          getTenantId(),
    p_id:                 data.id ?? null,
    p_name:               data.name,
    p_description:        data.description ?? null,
    p_duration_minutes:   data.duration_minutes,
    p_price_min:          data.price_min ?? null,
    p_price_max:          data.price_max ?? null,
    p_requires_evaluation: data.requires_evaluation ?? false,
    p_is_active:          data.is_active ?? true,
  })
}

export async function deleteService(id: string): Promise<void> {
  await rpc('rpc_delete_service', { p_tenant_id: getTenantId(), p_id: id })
}

// ─── Professionals ───────────────────────────────────────────────────────────

export async function listProfessionals(): Promise<Professional[]> {
  return rpcList('rpc_list_professionals', { p_tenant_id: getTenantId() })
}

export async function upsertProfessional(data: Partial<Professional>): Promise<void> {
  await rpc('rpc_upsert_professional', {
    p_tenant_id: getTenantId(),
    p_id:        data.id ?? null,
    p_name:      data.name,
    p_specialty: data.specialty ?? null,
    p_bio:       data.bio ?? null,
    p_email:     data.email ?? null,
    p_phone:     data.phone ?? null,
    p_color:     data.color ?? null,
    p_is_active: data.is_active ?? true,
  })
}

export async function deleteProfessional(id: string): Promise<void> {
  await rpc('rpc_delete_professional', { p_tenant_id: getTenantId(), p_id: id })
}

export async function getProfessionalAvailability(professionalId: string): Promise<ProfessionalAvailability[]> {
  return rpcList('rpc_get_professional_availability', {
    p_tenant_id:       getTenantId(),
    p_professional_id: professionalId,
  })
}

export async function upsertProfessionalAvailability(
  professionalId: string,
  slots: Pick<ProfessionalAvailability, 'day_of_week' | 'start_time' | 'end_time' | 'is_available'>[],
): Promise<void> {
  await rpc('rpc_upsert_professional_availability', {
    p_tenant_id:       getTenantId(),
    p_professional_id: professionalId,
    p_slots:           slots,
  })
}

export async function getAvailableSlots(
  professionalId: string,
  serviceId: string,
  dateFrom: string,
  dateTo: string,
): Promise<AvailableSlot[]> {
  return rpcList('rpc_get_available_slots', {
    p_tenant_id:       getTenantId(),
    p_professional_id: professionalId,
    p_service_id:      serviceId,
    p_date_from:       dateFrom,
    p_date_to:         dateTo,
  })
}

// ─── Campaigns / Templates ───────────────────────────────────────────────────

export async function listCampaigns(): Promise<Campaign[]> {
  return rpcList('rpc_list_campaigns', { p_tenant_id: getTenantId() })
}

export async function upsertCampaign(data: Partial<Campaign>): Promise<void> {
  await rpc('rpc_upsert_campaign', {
    p_tenant_id:              getTenantId(),
    p_id:                     data.id ?? null,
    p_name:                   data.name,
    p_template_id:            data.template_id ?? null,
    p_target_count:           data.target_count ?? null,
    p_scheduled_at:           data.scheduled_at ?? null,
    p_status:                 data.status ?? 'draft',
    p_recipient_filter:       data.recipient_filter ?? 'all',
    p_manual_recipients_json: data.manual_recipients_json ?? [],
  })
}

export async function updateCampaignStatus(id: string, status: string): Promise<void> {
  await rpc('rpc_update_campaign_status', { p_tenant_id: getTenantId(), p_id: id, p_status: status })
}

// Marks campaign as running via RPC.
// When the "Campaigns - Dispatcher" workflow is added to n8n, wire its
// production webhook URL here to trigger the actual dispatch.
export async function dispatchCampaign(campaignId: string): Promise<void> {
  await rpc('rpc_dispatch_campaign', {
    p_tenant_id:   getTenantId(),
    p_campaign_id: campaignId,
  })
  // TODO: fire n8n webhook when Campaigns - Dispatcher workflow is created
  // const N8N_URL = 'https://n8n.atividadeweb.com.br/webhook/campaigns-dispatcher'
  // await fetch(N8N_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) })
}

export async function deleteCampaign(id: string): Promise<void> {
  await rpc('rpc_delete_campaign', { p_tenant_id: getTenantId(), p_id: id })
}

export async function listMessageTemplates(): Promise<MessageTemplate[]> {
  return rpcList('rpc_list_message_templates', { p_tenant_id: getTenantId() })
}

export async function upsertMessageTemplate(data: Partial<MessageTemplate> & { components: unknown[] }): Promise<void> {
  await rpc('rpc_upsert_message_template', {
    p_tenant_id:     getTenantId(),
    p_id:            data.id ?? null,
    p_name:          data.name,
    p_category:      data.category ?? 'utility',
    p_language:      data.language ?? 'pt_BR',
    p_components:    data.components,
    p_status:        data.status ?? null,
    p_template_type: data.template_type ?? 'official',
  })
}

// ─── AI: Conversation Details (summaries, decisions, memories, intents) ──────

export async function getConversationSummary(
  conversationId: string,
): Promise<ConversationSummary | null> {
  return rpc('rpc_get_conversation_summary', {
    p_tenant_id: getTenantId(),
    p_conversation_id: conversationId,
  })
}

export async function getAiDecisions(conversationId: string): Promise<AiDecision[]> {
  return rpcList('rpc_get_ai_decisions', {
    p_tenant_id: getTenantId(),
    p_conversation_id: conversationId,
  })
}

export async function getMessageIntents(conversationId: string): Promise<MessageIntent[]> {
  return rpcList('rpc_get_message_intents', {
    p_tenant_id: getTenantId(),
    p_conversation_id: conversationId,
  })
}

export async function getCustomerMemories(customerId: string): Promise<CustomerMemory[]> {
  return rpcList('rpc_get_customer_memories', {
    p_tenant_id: getTenantId(),
    p_customer_id: customerId,
  })
}

// ─── Config: AI Settings (Module 10) ─────────────────────────────────────────

export async function getAiAgentProfile(): Promise<AiAgentProfile | null> {
  return rpc('rpc_get_ai_agent_profile', { p_tenant_id: getTenantId() })
}

export async function updateAiAgentProfile(
  data: Partial<AiAgentProfile>,
): Promise<void> {
  await rpc('rpc_update_ai_agent_profile', {
    p_tenant_id: getTenantId(),
    p_profile_name: data.profile_name,
    p_objective: data.objective,
    p_tone: data.tone,
    p_verbosity: data.verbosity,
    p_escalation_policy: data.escalation_policy,
    p_use_memory: data.use_memory,
    p_use_recommendations: data.use_recommendations,
    p_use_scheduling: data.use_scheduling,
    p_allow_voice_response: data.allow_voice_response,
    p_restrict_to_configured_services: data.restrict_to_configured_services,
  })
}

export async function getAiAgent(): Promise<AiAgent | null> {
  return rpc('rpc_get_ai_agent', { p_tenant_id: getTenantId() })
}

export async function updateAiAgent(data: Partial<AiAgent>): Promise<void> {
  await rpc('rpc_update_ai_agent', {
    p_tenant_id: getTenantId(),
    p_name: data.name,
    p_model_name: data.model_name,
    p_system_prompt: data.system_prompt,
    p_temperature: data.temperature,
    p_max_tokens: data.max_tokens,
    p_tools_jsonb: data.tools_jsonb ?? null,
  })
}

export async function listPromptTemplates(): Promise<PromptTemplate[]> {
  return rpcList('rpc_list_prompt_templates', { p_tenant_id: getTenantId() })
}

export async function upsertPromptTemplate(
  data: Omit<PromptTemplate, 'id' | 'tenant_id' | 'version' | 'updated_at'>,
): Promise<void> {
  await rpc('rpc_upsert_prompt_template', {
    p_tenant_id: getTenantId(),
    p_code: data.code,
    p_title: data.title,
    p_prompt_text: data.prompt_text,
    p_is_active: data.is_active,
    p_metadata_jsonb: data.metadata_jsonb ?? null,
  })
}

export async function getBusinessHours(): Promise<BusinessHour[]> {
  return rpcList('rpc_get_business_hours', { p_tenant_id: getTenantId() })
}

export async function updateBusinessHours(hours: BusinessHour[]): Promise<void> {
  await rpc('rpc_update_business_hours', {
    p_tenant_id: getTenantId(),
    p_hours: hours,
  })
}

export async function getWhatsAppChannel(): Promise<WhatsAppChannel | null> {
  return rpc('rpc_get_whatsapp_channel', { p_tenant_id: getTenantId() })
}

export async function updateWhatsAppChannel(data: {
  instance_id: string
  zapi_token: string
  phone_number?: string
  webhook_url?: string
  is_active?: boolean
}): Promise<void> {
  await rpc('rpc_update_whatsapp_channel', {
    p_tenant_id:    getTenantId(),
    p_instance_id:  data.instance_id,
    p_zapi_token:   data.zapi_token,
    p_phone_number: data.phone_number ?? null,
    p_webhook_url:  data.webhook_url ?? null,
    p_is_active:    data.is_active ?? true,
  })
}

export async function getChannelSettings(): Promise<ChannelSettings | null> {
  return rpc('rpc_get_channel_settings', {
    p_tenant_id: getTenantId(),
    p_channel_id: CHANNEL_ID,
  })
}

export async function updateChannelSettings(data: Partial<ChannelSettings>): Promise<void> {
  await rpc('rpc_update_channel_settings', {
    p_tenant_id: getTenantId(),
    p_channel_id: CHANNEL_ID,
    p_welcome_message: data.welcome_message,
    p_out_of_hours_message: data.out_of_hours_message,
    p_handoff_message: data.handoff_message,
    p_buffer_active: data.buffer_active,
    p_typing_simulation: data.typing_simulation,
    p_scheduling_followup_message:   data.scheduling_followup_message,
    p_scheduling_followup_message_2: data.scheduling_followup_message_2,
  })
}

export async function getTenantSettings(): Promise<TenantSettings | null> {
  return rpc('rpc_get_tenant_settings', { p_tenant_id: getTenantId() })
}

export async function updateTenantSettings(data: Partial<TenantSettings>): Promise<void> {
  await rpc('rpc_update_tenant_settings', {
    p_tenant_id:                getTenantId(),
    p_business_name:            data.business_name,
    p_whatsapp_display_name:    data.whatsapp_display_name,
    p_timezone:                 data.timezone,
    p_language:                 data.language,
    p_intake_mode:              data.intake_mode,
    p_allow_audio:              data.allow_audio,
    p_allow_image:              data.allow_image,
    p_allow_video:              data.allow_video,
    p_allow_voice:              data.allow_voice,
    p_human_approval_high_risk: data.human_approval_high_risk,
    p_auto_create_customer:     data.auto_create_customer,
  })
}

export async function deleteHandoffRule(id: string): Promise<void> {
  await rpc('rpc_delete_handoff_rule', { p_tenant_id: getTenantId(), p_id: id })
}

// ─── AI: Handoff Queue ───────────────────────────────────────────────────────

export async function listHandoffQueue(status?: string): Promise<HandoffEntry[]> {
  const { data, error } = await supabase.rpc('rpc_list_handoff_queue', {
    p_tenant_id: getTenantId(),
    p_status:    status ?? null,
  })
  if (error) throw error
  return (data as HandoffEntry[] | null) ?? []
}

export async function updateHandoffStatus(
  handoffId: string,
  status: 'accepted' | 'resolved' | 'rejected',
  resolutionNote?: string,
): Promise<void> {
  await rpc('rpc_update_handoff_status', {
    p_tenant_id:       getTenantId(),
    p_handoff_id:      handoffId,
    p_status:          status,
    p_resolution_note: resolutionNote ?? null,
  })
}

// ─── Ops: Reminder Rules ─────────────────────────────────────────────────────

export async function listReminderRules(): Promise<ReminderRule[]> {
  return rpcList('rpc_list_reminder_rules', { p_tenant_id: getTenantId() })
}

export async function upsertReminderRule(data: {
  id?: string
  name: string
  trigger_type: string
  hours_before: number
  template_id?: string
  is_active: boolean
  prep_notes?: string
  include_recommendations?: boolean
}): Promise<void> {
  await rpc('rpc_upsert_reminder_rule', {
    p_tenant_id:              getTenantId(),
    p_id:                     data.id ?? null,
    p_name:                   data.name,
    p_trigger_type:           data.trigger_type,
    p_hours_before:           data.hours_before,
    p_template_id:            data.template_id ?? null,
    p_is_active:              data.is_active,
    p_prep_notes:             data.prep_notes ?? '',
    p_include_recommendations: data.include_recommendations ?? false,
  })
}

export async function deleteReminderRule(id: string): Promise<void> {
  await rpc('rpc_delete_reminder_rule', { p_tenant_id: getTenantId(), p_id: id })
}

export async function deleteSlaRule(id: string): Promise<void> {
  await rpc('rpc_delete_sla_rule', { p_tenant_id: getTenantId(), p_id: id })
}

export async function deleteFeatureFlag(code: string): Promise<void> {
  await rpc('rpc_delete_feature_flag', { p_tenant_id: getTenantId(), p_code: code })
}

export async function listHandoffRules(): Promise<HandoffRule[]> {
  return rpcList('rpc_list_handoff_rules', { p_tenant_id: getTenantId() })
}

export async function upsertHandoffRule(data: Partial<HandoffRule>): Promise<void> {
  await rpc('rpc_upsert_handoff_rule', {
    p_tenant_id: getTenantId(),
    p_id: data.id ?? null,
    p_rule_name: data.rule_name,
    p_trigger_type: data.trigger_type,
    p_trigger_config_jsonb: data.trigger_config_jsonb ?? {},
    p_target_role: data.target_role,
    p_is_active: data.is_active ?? true,
  })
}

export async function listSlaRules(): Promise<SlaRule[]> {
  return rpcList('rpc_list_sla_rules', { p_tenant_id: getTenantId() })
}

export async function upsertSlaRule(data: Partial<SlaRule>): Promise<void> {
  await rpc('rpc_upsert_sla_rule', {
    p_tenant_id: getTenantId(),
    p_id: data.id ?? null,
    p_priority: data.priority,
    p_first_response_seconds: data.first_response_seconds,
    p_resolution_seconds: data.resolution_seconds,
    p_business_hours_only: data.business_hours_only ?? true,
    p_is_active: data.is_active ?? true,
  })
}

export async function listFeatureFlags(): Promise<FeatureFlag[]> {
  return rpcList('rpc_list_feature_flags', { p_tenant_id: getTenantId() })
}

export async function updateFeatureFlag(code: string, isEnabled: boolean, configJsonb?: Record<string, unknown>): Promise<void> {
  await rpc('rpc_update_feature_flag', {
    p_tenant_id: getTenantId(),
    p_code: code,
    p_is_enabled: isEnabled,
    p_config_jsonb: configJsonb ?? null,
  })
}

export async function listVoiceProfiles(): Promise<VoiceProfile[]> {
  return rpcList('rpc_list_voice_profiles', { p_tenant_id: getTenantId() })
}

export async function upsertVoiceProfile(data: Partial<VoiceProfile>): Promise<void> {
  await rpc('rpc_upsert_voice_profile', {
    p_tenant_id: getTenantId(),
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

// ─── Observability: Prediction Scores ────────────────────────────────────────

export async function listPredictionScores(params: {
  entityType?: string
  scoreType?: string
  limit?: number
} = {}): Promise<PredictionScore[]> {
  const { data, error } = await supabase.rpc('rpc_list_prediction_scores', {
    p_tenant_id:   getTenantId(),
    p_entity_type: params.entityType ?? null,
    p_score_type:  params.scoreType  ?? null,
    p_limit:       params.limit      ?? 100,
  })
  if (error) throw error
  return (data as PredictionScore[] | null) ?? []
}

export async function getRoiSummary(months = 6): Promise<RoiSummary> {
  return rpc('rpc_get_roi_summary', { p_tenant_id: getTenantId(), p_months: months })
}

// ─── Business Profile ────────────────────────────────────────────────────────

export async function getBusinessProfile(): Promise<BusinessProfile> {
  const data = await rpc<BusinessProfile | null>('rpc_get_business_profile', {
    p_tenant_id: getTenantId(),
  })
  return data ?? {}
}

export async function updateBusinessProfile(profile: BusinessProfile): Promise<void> {
  await rpc('rpc_update_business_profile', {
    p_tenant_id: getTenantId(),
    p_profile:   profile,
  })
}

// ─── Business Contact Info ───────────────────────────────────────────────────

export async function getBusinessContact(): Promise<BusinessContact> {
  const data = await rpc<BusinessContact | null>('rpc_get_business_contact', {
    p_tenant_id: getTenantId(),
  })
  return data ?? {}
}

export async function updateBusinessContact(contact: BusinessContact): Promise<void> {
  await rpc('rpc_update_business_contact', {
    p_tenant_id: getTenantId(),
    p_contact:   contact,
  })
}

// ─── API Keys ────────────────────────────────────────────────────────────────

export async function getApiKeys(): Promise<ApiKeys> {
  const data = await rpc<ApiKeys | null>('rpc_get_api_keys', { p_tenant_id: getTenantId() })
  return data ?? {}
}

export async function upsertApiKeys(keys: ApiKeys): Promise<void> {
  await rpc('rpc_upsert_api_keys', {
    p_tenant_id: getTenantId(),
    p_keys:      keys,
  })
}

// ─── Tenant: user memberships (for tenant switcher) ──────────────────────────

export async function listUserTenants(userId: string): Promise<UserTenantMembership[]> {
  const { data, error } = await supabase.rpc('rpc_list_user_tenants', { p_user_id: userId })
  if (error) throw error
  return (data as UserTenantMembership[] | null) ?? []
}

// ─── Super-admin: Tenant management ──────────────────────────────────────────

export async function listAllTenants(): Promise<Tenant[]> {
  const { data, error } = await supabase.rpc('rpc_list_all_tenants')
  if (error) throw error
  return (data as Tenant[] | null) ?? []
}

export async function upsertTenant(data: Partial<Tenant>): Promise<string> {
  const result = await rpc<string>('rpc_upsert_tenant', {
    p_id:       data.id ?? null,
    p_name:     data.name,
    p_slug:     data.slug ?? null,
    p_status:   data.status ?? 'active',
    p_plan:     data.plan ?? null,
    p_timezone: data.timezone ?? 'America/Sao_Paulo',
    p_locale:   data.locale ?? 'pt_BR',
  })
  return result
}

export async function deleteTenant(id: string): Promise<void> {
  await rpc('rpc_delete_tenant', { p_id: id })
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
  return rpcList('rpc_list_audit_logs', {
    p_tenant_id: getTenantId(),
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
  return rpcList('rpc_list_integration_logs', {
    p_tenant_id: getTenantId(),
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
  return rpcList('rpc_list_jobs', { p_tenant_id: getTenantId() })
}
