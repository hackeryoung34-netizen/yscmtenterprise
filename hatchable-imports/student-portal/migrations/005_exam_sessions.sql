CREATE TABLE IF NOT EXISTS exam_sessions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 exam_id UUID NOT NULL REFERENCES course_exams(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL,
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 submitted_at TIMESTAMPTZ,
 UNIQUE(id,user_id)
);
CREATE INDEX IF NOT EXISTS exam_sessions_user_exam_idx ON exam_sessions(user_id,exam_id,started_at DESC);