-- YSCMT Connect: additive social-network foundation.
ALTER TABLE community_profiles ADD COLUMN IF NOT EXISTS username TEXT;
UPDATE community_profiles
SET username = 'member-' || substr(md5(user_id), 1, 10)
WHERE username IS NULL OR username = '';
ALTER TABLE community_profiles ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS community_profiles_username_lower_idx
  ON community_profiles (lower(username));
ALTER TABLE community_profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (profile_visibility IN ('public','private'));

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public','followers')),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published','hidden','removed')),
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS community_post_likes (
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS community_post_likes_user_idx
  ON community_post_likes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_post_comments (
  id BIGSERIAL PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1200),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published','hidden','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS community_post_comments_post_idx
  ON community_post_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS community_post_comments_user_idx
  ON community_post_comments(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_follows (
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS community_follows_following_idx
  ON community_follows(following_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  notification_type TEXT NOT NULL
    CHECK (notification_type IN ('like','comment','follow')),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id BIGINT REFERENCES community_post_comments(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_notifications_user_idx
  ON community_notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS community_reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('post','comment','profile')),
  target_post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  target_comment_id BIGINT REFERENCES community_post_comments(id) ON DELETE CASCADE,
  target_user_id TEXT,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (target_type='post' AND target_post_id IS NOT NULL AND target_comment_id IS NULL AND target_user_id IS NULL)
    OR (target_type='comment' AND target_comment_id IS NOT NULL AND target_post_id IS NULL AND target_user_id IS NULL)
    OR (target_type='profile' AND target_user_id IS NOT NULL AND target_post_id IS NULL AND target_comment_id IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS community_reports_status_idx
  ON community_reports(status, created_at DESC);