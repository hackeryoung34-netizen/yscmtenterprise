CREATE TABLE IF NOT EXISTS classroom_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  meeting_url text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','completed','cancelled')),
  created_by text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS classroom_sessions_course_start_idx ON classroom_sessions(course_id, starts_at);
CREATE TABLE IF NOT EXISTS classroom_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  published boolean NOT NULL DEFAULT true,
  created_by text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS classroom_announcements_course_date_idx ON classroom_announcements(course_id, created_at DESC);
CREATE TABLE IF NOT EXISTS classroom_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES classroom_sessions(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);
CREATE INDEX IF NOT EXISTS classroom_attendance_session_idx ON classroom_attendance(session_id);
CREATE TABLE IF NOT EXISTS classroom_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  author_role text NOT NULL DEFAULT 'student' CHECK (author_role IN ('student','teacher')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS classroom_messages_course_date_idx ON classroom_messages(course_id, created_at DESC);