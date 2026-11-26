CREATE TABLE IF NOT EXISTS practice_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  lab_key TEXT NOT NULL CHECK (lab_key IN (
    'computer-intermediate','cybersecurity-intermediate','python-intermediate','web-intermediate',
    'computer-advanced','cybersecurity-advanced','python-advanced','web-advanced'
  )),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 160),
  submission_text TEXT NOT NULL DEFAULT '' CHECK (char_length(submission_text) <= 8000),
  project_url TEXT NOT NULL DEFAULT '' CHECK (char_length(project_url) <= 500),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','in_review','approved','needs_changes')),
  reviewer_notes TEXT NOT NULL DEFAULT '' CHECK (char_length(reviewer_notes) <= 3000),
  reviewed_by TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  CHECK (char_length(submission_text) > 0 OR char_length(project_url) > 0)
);
CREATE INDEX IF NOT EXISTS practice_submissions_user_idx ON practice_submissions(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS practice_submissions_status_idx ON practice_submissions(status, submitted_at DESC);