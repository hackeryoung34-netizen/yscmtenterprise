CREATE TABLE IF NOT EXISTS paystack_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrolment_id UUID NOT NULL REFERENCES enrollments(id),
  user_id TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES courses(id),
  reference TEXT NOT NULL UNIQUE,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  currency TEXT NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed')),
  authorization_url TEXT NOT NULL DEFAULT '',
  gateway_response JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS paystack_payments_user_idx ON paystack_payments(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS paystack_payments_enrolment_idx ON paystack_payments(enrolment_id,created_at DESC);
CREATE INDEX IF NOT EXISTS paystack_payments_status_idx ON paystack_payments(status,created_at DESC);