// ─── Conversations ──────────────────────────────────────────────────────────

export type ConversationStatus =
  | 'open' | 'pending' | 'resolved' | 'bot_active' | 'waiting_human'

export interface Conversation {
  id: string
  tenant_id?: string
  channel_id?: string
  customer_id: string
  professional_id?: string
  status: ConversationStatus
  priority?: number
  started_at: string
  updated_at: string
  customer_name?: string
  customer_phone?: string
  // original RPC fields
  last_message_text?: string | null
  last_message_at?: string | null
  msg_count?: number
  assigned_user_id?: string | null
  // compat alias
  last_message?: string
  message_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  content_type: 'text' | 'audio' | 'image' | 'document'
  content_text?: string
  media_url?: string
  sender_type: 'customer' | 'agent' | 'bot'
  sent_at: string
  intent?: MessageIntent
}

// ─── Customers ───────────────────────────────────────────────────────────────

export interface Customer {
  id: string
  tenant_id: string
  name: string
  phone: string
  email?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

// ─── Appointments ────────────────────────────────────────────────────────────

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'pending'

export interface Appointment {
  id: string
  tenant_id?: string
  customer_id: string
  professional_id: string
  service_id: string
  // original RPC fields
  scheduled_start_at?: string
  scheduled_end_at?: string
  // compat alias
  scheduled_at?: string
  duration_minutes?: number
  service_duration?: number
  status: AppointmentStatus
  notes?: string
  customer_name?: string
  customer_phone?: string
  professional_name?: string
  professional_specialty?: string
  service_name?: string
  created_at?: string
}

// ─── Services ────────────────────────────────────────────────────────────────

export interface Service {
  id: string
  tenant_id: string
  name: string
  description?: string
  duration_minutes: number
  price_min?: number
  price_max?: number
  requires_evaluation: boolean
  is_active: boolean
}

// ─── Professionals ───────────────────────────────────────────────────────────

export interface Professional {
  id: string
  tenant_id: string
  name: string
  specialty?: string
  bio?: string
  email?: string
  phone?: string
  color?: string
  is_active: boolean
  updated_at?: string
}

// ─── Campaigns / Templates ───────────────────────────────────────────────────

export interface Campaign {
  id: string
  tenant_id: string
  name: string
  status: 'draft' | 'scheduled' | 'running' | 'completed' | 'paused'
  template_id?: string
  target_count?: number
  sent_count?: number
  scheduled_at?: string
  created_at: string
}

export interface MessageTemplate {
  id: string
  tenant_id: string
  name: string
  category: string
  language: string
  status: 'approved' | 'pending' | 'rejected'
  template_type: 'official' | 'zapi'
  components: unknown[]
  created_at: string
  updated_at?: string
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardSummary {
  customers:     { total: number; leads: number; active: number; new_today: number; new_week: number }
  conversations: { total: number; open: number; bot_active: number; waiting_human: number; resolved: number; resolved_today: number; pending: number }
  messages:      { total: number; today: number; inbound: number; outbound: number }
  appointments:  { total: number; today: number; tomorrow: number; confirmed: number; pending: number; completed: number; cancelled: number; no_show: number }
  jobs:          { total: number; pending: number; completed: number; failed: number }
  reminders:     { rules_active: number; dispatches_sent: number; dispatches_failed: number }
  performance:   { avg_first_response_seconds: number; avg_resolution_seconds: number; bot_resolution_rate: number; handoff_rate: number }
  generated_at:  string
}

export interface OperationalStats {
  messages_today:      number
  new_customers_today: number
  followups_sent:      number
  reminder_rules:      number
  open_conversations:  number
  jobs_completed:      number
}

export interface DailyMetric {
  date: string           // YYYY-MM-DD
  conversations: number
  resolved: number
  handoffs: number
  bot_resolved: number
  new_customers: number
}

export interface DailyAppointmentMetric {
  date: string
  total: number
  confirmed: number
  completed: number
  cancelled: number
}

// ─── AI: Conversation Summaries ──────────────────────────────────────────────

export interface ConversationSummary {
  id: string
  conversation_id: string
  summary_type: 'running' | 'closure' | 'handoff'
  summary_text: string
  facts_jsonb?: Record<string, unknown>
  open_items_jsonb?: unknown[]
  created_at: string
}

// ─── AI: Customer Memories ───────────────────────────────────────────────────

export type MemoryType =
  | 'profile' | 'preference' | 'objection'
  | 'clinical_interest' | 'schedule_preference' | 'relationship'

export interface CustomerMemory {
  id: string
  customer_id: string
  memory_type: MemoryType
  content_text: string
  importance_score: number
  is_active: boolean
  last_used_at?: string
  created_at: string
}

// ─── AI: Decisions ───────────────────────────────────────────────────────────

export type DecisionType =
  | 'reply' | 'handoff' | 'schedule' | 'recommend_service'
  | 'request_more_data' | 'block'

export interface AiDecision {
  id: string
  conversation_id: string
  ai_session_id?: string
  decision_type: DecisionType
  decision_reason?: string
  confidence_score: number
  input_context_jsonb?: Record<string, unknown>
  output_payload_jsonb?: Record<string, unknown>
  approved_by_rule?: string
  created_at: string
}

// ─── Observability: Prediction Scores ───────────────────────────────────────

export interface PredictionScore {
  id: string
  tenant_id: string
  entity_type: string
  entity_id: string
  entity_name?: string
  score_type: string
  score_value: number
  model_name?: string
  explanation_jsonb?: Record<string, unknown>
  created_at: string
}

// ─── Analytics: ROI ──────────────────────────────────────────────────────────

export interface RoiSnapshot {
  period_start: string
  period_end: string
  leads_count: number
  appointments_count: number
  show_rate: number
  conversion_rate: number
  revenue_total: number
  media_spend: number
  roi_value: number
}

export interface RoiSummary {
  total_revenue: number
  total_media_spend: number
  total_leads: number
  total_appointments: number
  roi_ratio: number
  avg_show_rate: number
  avg_conversion_rate: number
  snapshots: RoiSnapshot[] | null
}

// ─── AI: Message Intents ─────────────────────────────────────────────────────

export interface MessageIntent {
  id: string
  message_id: string
  intent_code: string
  confidence_score: number
  entities_jsonb?: Record<string, unknown>
}

// ─── Config: AI Agent Profile ────────────────────────────────────────────────

export type AgentTone = 'empatico' | 'profissional' | 'informal' | 'neutro'
export type AgentVerbosity = 'conciso' | 'moderado' | 'detalhado'

export interface AiAgentProfile {
  id: string
  tenant_id: string
  profile_name: string
  objective?: string
  tone: AgentTone
  verbosity: AgentVerbosity
  escalation_policy?: string
  use_memory: boolean
  use_recommendations: boolean
  use_scheduling: boolean
  allow_voice_response: boolean
  restrict_to_configured_services: boolean
  config_jsonb?: Record<string, unknown>
  updated_at: string
}

// ─── AI: Agent (technical) ───────────────────────────────────────────────────

export interface AiAgent {
  id: string
  tenant_id: string
  name: string
  status: 'active' | 'inactive'
  model_name: string
  system_prompt: string
  temperature: number
  max_tokens: number
  policy_jsonb?: Record<string, unknown>
  tools_jsonb?: Record<string, unknown>
  updated_at: string
}

// ─── Config: Prompt Templates ────────────────────────────────────────────────

export interface PromptTemplate {
  id: string
  tenant_id: string
  code: string
  title: string
  prompt_text: string
  version: number
  is_active: boolean
  metadata_jsonb?: Record<string, unknown>
  updated_at: string
}

// ─── Config: Business Hours ──────────────────────────────────────────────────

export interface BusinessHour {
  id: string
  tenant_id: string
  day_of_week: number   // 0=Sun, 6=Sat
  open_time: string     // HH:mm
  close_time: string    // HH:mm
  is_open: boolean
}

// ─── Scheduling: Professional Availability ───────────────────────────────────

export interface ProfessionalAvailability {
  id?: string
  tenant_id?: string
  professional_id: string
  day_of_week: number    // 0=Dom, 6=Sáb
  start_time: string     // HH:mm
  end_time: string       // HH:mm
  is_available: boolean
  break_start?: string   // HH:mm — início da pausa (almoço/descanso)
  break_end?: string     // HH:mm — fim da pausa
}

export interface AvailableSlot {
  start: string          // ISO timestamp
  end: string            // ISO timestamp
  professional_id: string
  service_id: string
}

// ─── Config: Channel Settings ────────────────────────────────────────────────

export interface ChannelSettings {
  id: string
  tenant_id: string
  channel_id: string
  welcome_message?: string
  out_of_hours_message?: string
  handoff_message?: string
  scheduling_followup_message?: string
  scheduling_followup_message_2?: string
  buffer_active: boolean
  typing_simulation: boolean
  updated_at: string
}

// ─── WhatsApp Channel (Z-API) ─────────────────────────────────────────────────

export interface WhatsAppChannel {
  id: string
  tenant_id: string
  type: string
  name: string
  is_active: boolean
  external_account_id: string | null
  webhook_url: string | null
  config_jsonb: {
    zapi_token?: string
    phone_number?: string
    [key: string]: unknown
  }
}

// ─── Business Profile (AI context) ───────────────────────────────────────────

export interface BusinessProfile {
  sobre?:          string   // História, missão, valores
  posicionamento?: string   // Posicionamento e diferenciais
  publico_alvo?:   string   // Público-alvo
  info_ia?:        string   // Informações adicionais para a IA
}

// ─── Business Contact Info ────────────────────────────────────────────────────

export interface BusinessContact {
  address?:          string
  google_maps_url?:  string
  phone?:            string
  whatsapp?:         string
  website?:          string
  email?:            string
  instagram?:        string
  facebook?:         string
  tiktok?:           string
  linkedin?:         string
  google_review_url?: string
  business_hours?:   string
}

// ─── LLM API Keys ─────────────────────────────────────────────────────────────

export interface ApiKeys {
  anthropic?: string   // Anthropic — Claude
  openai?:    string   // OpenAI — ChatGPT
  google?:    string   // Google — Gemini
}

// ─── Tenant membership (for switcher) ────────────────────────────────────────

export interface UserTenantMembership {
  tenant_id:    string
  role:         string
  tenant_name:  string
  display_name: string
}

// ─── Tenant (super-admin) ─────────────────────────────────────────────────────

export interface Tenant {
  id: string
  name: string
  slug: string
  status: 'active' | 'trial' | 'suspended' | 'cancelled'
  plan?: string
  timezone: string
  locale: string
  member_count?: number
  created_at: string
  updated_at?: string
}

// ─── Config: Tenant Settings ─────────────────────────────────────────────────

export interface TenantSettings {
  id: string
  tenant_id: string
  business_name: string
  whatsapp_display_name?: string
  timezone: string
  language: string
  intake_mode: 'bot_first' | 'human_first' | 'mixed'
  allow_audio: boolean
  allow_image: boolean
  allow_video: boolean
  allow_voice: boolean
  human_approval_high_risk: boolean
  auto_create_customer: boolean
  updated_at: string
}

// ─── AI: Handoff Queue ───────────────────────────────────────────────────────

export interface HandoffEntry {
  id: string
  tenant_id: string
  conversation_id: string
  reason_text?: string
  target_role?: string
  status: 'pending' | 'accepted' | 'resolved' | 'rejected'
  accepted_at?: string
  resolved_at?: string
  created_at: string
  conversation_status?: string
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  last_message?: string
  conversation_updated_at?: string
}

// ─── Ops: Reminder Rules ─────────────────────────────────────────────────────

export interface ReminderRule {
  id: string
  tenant_id: string
  name: string
  trigger_type: string
  hours_before?: number
  template_id?: string
  is_active: boolean
  config_jsonb: {
    prep_notes?: string
    include_recommendations?: boolean
    [key: string]: unknown
  }
  created_at: string
  updated_at: string
}

// ─── Config: Handoff Rules ───────────────────────────────────────────────────

export type HandoffTriggerType = 'keyword' | 'sentiment' | 'schedule' | 'attempts'

export interface HandoffRule {
  id: string
  tenant_id: string
  rule_name: string
  trigger_type: HandoffTriggerType
  trigger_config_jsonb: Record<string, unknown>
  target_role: string
  is_active: boolean
  updated_at: string
}

// ─── Config: SLA Rules ───────────────────────────────────────────────────────

export interface SlaRule {
  id: string
  tenant_id: string
  priority: string
  first_response_seconds: number
  resolution_seconds: number
  business_hours_only: boolean
  is_active: boolean
}

// ─── Config: Feature Flags ───────────────────────────────────────────────────

export interface FeatureFlag {
  id: string
  tenant_id: string
  code: string
  is_enabled: boolean
  config_jsonb?: Record<string, unknown>
  updated_at: string
}

// ─── AI: Voice Profiles ──────────────────────────────────────────────────────

export interface VoiceProfile {
  id: string
  tenant_id: string
  name: string
  provider: string
  voice_external_id: string
  language_code: string
  gender: 'male' | 'female' | 'neutral'
  settings_jsonb?: Record<string, unknown>
  is_default: boolean
  updated_at: string
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'insert' | 'update' | 'delete' | 'sync' | 'decision' | 'handoff' | 'login'

export type AuditActorType = 'system' | 'ai' | 'agent' | 'customer' | 'integration'

export interface AuditLog {
  id: string
  entity_type: string
  entity_id: string
  action: AuditAction
  actor_type: AuditActorType
  actor_id?: string
  before_jsonb?: Record<string, unknown>
  after_jsonb?: Record<string, unknown>
  metadata_jsonb?: Record<string, unknown>
  created_at: string
}

export interface IntegrationLog {
  id: string
  tenant_id: string
  integration_name: string
  direction: 'inbound' | 'outbound'
  external_id?: string
  status: 'success' | 'error' | 'pending'
  payload_jsonb?: Record<string, unknown>
  response_jsonb?: Record<string, unknown>
  error_jsonb?: Record<string, unknown>
  created_at: string
}

// ─── Observability ───────────────────────────────────────────────────────────

export interface JobEntry {
  id: string
  job_type: string
  status: 'pending' | 'running' | 'done' | 'failed'
  payload?: Record<string, unknown>
  error?: string
  created_at: string
  updated_at: string
}
