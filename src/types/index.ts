// ─── Enums ───────────────────────────────────────────────────────────────────

export type ConversationStatus =
  | 'open' | 'pending' | 'resolved' | 'bot_active' | 'waiting_human'

export type AppointmentStatus =
  | 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'rescheduled'

export type MessageDirection = 'inbound' | 'outbound' | 'internal'
export type SenderType      = 'customer' | 'bot' | 'agent' | 'system'
export type JobStatus       = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
export type CustomerStatus  = 'lead' | 'prospect' | 'active' | 'inactive'

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface DashboardSummary {
  customers:     { total: number; leads: number; active: number; new_today: number }
  conversations: { total: number; open: number; bot_active: number; waiting_human: number; resolved: number; pending: number }
  messages:      { total: number; today: number; inbound: number; outbound: number }
  appointments:  { total: number; today: number; tomorrow: number; confirmed: number; pending: number; completed: number; cancelled: number; no_show: number }
  jobs:          { total: number; pending: number; completed: number; failed: number }
  reminders:     { rules_active: number; dispatches_sent: number; dispatches_failed: number }
  generated_at:  string
}

export interface Conversation {
  id:                uuid
  status:            ConversationStatus
  priority:          number
  customer_id:       uuid
  customer_name:     string
  customer_phone:    string
  last_message_text: string | null
  last_message_at:   string | null
  msg_count:         number
  assigned_user_id:  uuid | null
  updated_at:        string
  started_at:        string
}

export interface Appointment {
  id:                    uuid
  status:                AppointmentStatus
  scheduled_start_at:    string
  scheduled_end_at:      string
  customer_id:           uuid
  customer_name:         string
  customer_phone:        string
  professional_id:       uuid
  professional_name:     string
  professional_specialty:string
  service_id:            uuid
  service_name:          string
  service_duration:      number
  created_at:            string
}

export interface Message {
  id:              uuid
  direction:       MessageDirection
  sender_type:     SenderType
  content_text:    string | null
  created_at:      string
}

export interface Customer {
  id:                 uuid
  full_name:          string
  phone_e164:         string | null
  email:              string | null
  status:             CustomerStatus
  first_contact_at:   string | null
  last_interaction_at:string | null
}

export interface Professional {
  id:        uuid
  name:      string
  specialty: string | null
  status:    string
}

export interface Service {
  id:               uuid
  name:             string
  duration_minutes: number | null
  price_from:       number | null
  price_to:         number | null
  is_active:        boolean
}

export interface WhatsAppTemplate {
  id:        uuid
  code:      string
  name:      string
  category:  string
  body_text: string | null
  is_active: boolean
}

export interface ReminderRule {
  id:           uuid
  name:         string
  trigger_type: string
  hours_before: number
  is_active:    boolean
}

export interface ReminderDispatch {
  id:             uuid
  status:         string
  dispatched_at:  string | null
  error_message:  string | null
  created_at:     string
}

export interface JobQueueItem {
  id:          uuid
  queue_name:  string
  job_type:    string
  status:      JobStatus
  attempts:    number
  max_attempts:number
  last_error:  string | null
  updated_at:  string
}

// ─── RPC responses ────────────────────────────────────────────────────────────

export interface RpcActionResult {
  ok:    boolean
  error?: string
  [key: string]: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export type uuid = string
