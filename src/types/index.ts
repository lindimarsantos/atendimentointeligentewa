// ─── Conversations ──────────────────────────────────────────────────────────

export type ConversationStatus =
  | 'open' | 'pending' | 'resolved' | 'bot_active' | 'waiting_human'

export interface Conversation {
  id: string
  tenant_id: string
  channel_id: string
  customer_id: string
  professional_id?: string
  status: ConversationStatus
  started_at: string
  updated_at: string
  customer_name?: string
  customer_phone?: string
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

export interface Appointment {
  id: string
  tenant_id: string
  customer_id: string
  professional_id: string
  service_id: string
  scheduled_at: string
  duration_minutes: number
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
  notes?: string
  customer_name?: string
  professional_name?: string
  service_name?: string
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
  is_active: boolean
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
  components: unknown[]
  created_at: string
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardSummary {
  total_conversations: number
  open_conversations: number
  pending_conversations: number
  resolved_today: number
  avg_response_seconds: number
  appointments_today: number
  new_customers_week: number
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

// ─── Config: Channel Settings ────────────────────────────────────────────────

export interface ChannelSettings {
  id: string
  tenant_id: string
  channel_id: string
  welcome_message?: string
  out_of_hours_message?: string
  handoff_message?: string
  buffer_active: boolean
  typing_simulation: boolean
  updated_at: string
}

// ─── Config: Tenant Settings ─────────────────────────────────────────────────

export interface TenantSettings {
  id: string
  tenant_id: string
  business_name: string
  timezone: string
  language: string
  intake_mode: 'bot_first' | 'human_first' | 'mixed'
  allow_audio: boolean
  allow_image: boolean
  allow_voice: boolean
  human_approval_high_risk: boolean
  auto_create_customer: boolean
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
