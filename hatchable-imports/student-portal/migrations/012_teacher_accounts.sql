CREATE TABLE IF NOT EXISTS teacher_roles (
  user_id text PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS teacher_course_assignments (
  teacher_id text NOT NULL REFERENCES teacher_roles(user_id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, course_id)
);
CREATE INDEX IF NOT EXISTS teacher_course_assignments_course_idx ON teacher_course_assignments(course_id);