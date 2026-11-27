CREATE TABLE IF NOT EXISTS classroom_teacher_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_by text NOT NULL DEFAULT 'admin',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS classroom_teacher_replies_course_date_idx ON classroom_teacher_replies(course_id, created_at DESC);