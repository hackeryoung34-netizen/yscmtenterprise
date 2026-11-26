-- YSCMT Enterprise finance: independent settlement approval metadata.
-- Additive only: preserves existing settlement statuses and financial records.
ALTER TABLE public.enterprise_settlements
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS enterprise_settlements_approval_idx
  ON public.enterprise_settlements (status, approved_at, created_at DESC);
