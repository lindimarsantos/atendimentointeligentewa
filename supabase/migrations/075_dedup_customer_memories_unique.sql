-- ============================================================
-- Migration 075: Dedup ai.customer_memories + add UNIQUE constraint
--
-- Root cause: ON CONFLICT DO NOTHING in rpc_n8n_post_interaction
-- had no effect because there was no UNIQUE constraint on
-- (tenant_id, customer_id, memory_type, content_text).
-- Every workflow execution inserted a new duplicate row.
--
-- Fix:
--   1. Remove duplicates, keeping only the most recent row per group.
--   2. Add UNIQUE constraint so future ON CONFLICT DO NOTHING works.
-- ============================================================

-- Step 1: Remove duplicates — keep the most recent row per group
DELETE FROM ai.customer_memories
WHERE id NOT IN (
  SELECT DISTINCT ON (tenant_id, customer_id, memory_type, content_text) id
  FROM ai.customer_memories
  ORDER BY tenant_id, customer_id, memory_type, content_text, created_at DESC
);

-- Step 2: Add UNIQUE constraint
ALTER TABLE ai.customer_memories
  ADD CONSTRAINT customer_memories_unique_per_type
  UNIQUE (tenant_id, customer_id, memory_type, content_text);
