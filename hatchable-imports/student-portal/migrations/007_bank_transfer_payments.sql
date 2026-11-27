ALTER TABLE courses ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS fee_currency TEXT NOT NULL DEFAULT 'NGN';

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id UUID NOT NULL REFERENCES enrollments(id),
  user_id TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES courses(id),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  transfer_reference TEXT NOT NULL DEFAULT '',
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payment_submissions_enrolment_idx ON payment_submissions(enrolment_id,submitted_at DESC);
CREATE INDEX IF NOT EXISTS payment_submissions_status_idx ON payment_submissions(status,submitted_at DESC);