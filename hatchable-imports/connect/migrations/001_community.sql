CREATE TABLE community_profiles (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','teacher','mentor')),
  country TEXT NOT NULL,
  field TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES community_profiles(user_id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX community_profiles_created_idx ON community_profiles(created_at DESC);
CREATE INDEX community_posts_created_idx ON community_posts(created_at DESC);