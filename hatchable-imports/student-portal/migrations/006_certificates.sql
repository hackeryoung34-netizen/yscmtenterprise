CREATE TABLE IF NOT EXISTS student_certificates (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 certificate_code TEXT NOT NULL UNIQUE,
 user_id TEXT NOT NULL,
 course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
 student_name TEXT NOT NULL,
 course_title TEXT NOT NULL,
 issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(user_id,course_id)
);
CREATE INDEX IF NOT EXISTS student_certificates_user_idx ON student_certificates(user_id,issued_at DESC);
CREATE INDEX IF NOT EXISTS student_certificates_code_idx ON student_certificates(certificate_code);