-- YSCMT Connect professional features: media, messaging, groups, stories and live sessions.
-- Additive only: preserve all existing members, profiles, posts, likes and comments.

ALTER TABLE community_notifications
  ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE community_notifications
  DROP CONSTRAINT IF EXISTS community_notifications_notification_type_check;
ALTER TABLE community_notifications
  ADD CONSTRAINT community_notifications_notification_type_check
  CHECK (notification_type IN ('like','comment','follow','message','group','group_invite','live'));

CREATE TABLE IF NOT EXISTS community_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  content_type TEXT NOT NULL,
  bytes BIGINT NOT NULL CHECK (bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_media_user_idx ON community_media(user_id, created_at DESC);

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS media_id UUID REFERENCES community_media(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS community_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS community_conversation_members (
  conversation_id UUID NOT NULL REFERENCES community_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY(conversation_id,user_id)
);
CREATE INDEX IF NOT EXISTS community_conversation_members_user_idx
  ON community_conversation_members(user_id, joined_at DESC);
CREATE TABLE IF NOT EXISTS community_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES community_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 4000),
  media_id UUID REFERENCES community_media(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  CHECK (char_length(body) > 0 OR media_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS community_messages_conversation_idx
  ON community_messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 3 AND 80),
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  category TEXT NOT NULL DEFAULT 'General',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_groups_created_idx ON community_groups(created_at DESC);
CREATE TABLE IF NOT EXISTS community_group_members (
  group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','moderator','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(group_id,user_id)
);
CREATE INDEX IF NOT EXISTS community_group_members_user_idx
  ON community_group_members(user_id, joined_at DESC);
CREATE TABLE IF NOT EXISTS community_group_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  media_id UUID REFERENCES community_media(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS community_group_posts_feed_idx
  ON community_group_posts(group_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  media_id UUID NOT NULL REFERENCES community_media(id) ON DELETE CASCADE,
  caption TEXT NOT NULL DEFAULT '' CHECK (char_length(caption) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);
CREATE INDEX IF NOT EXISTS community_stories_active_idx
  ON community_stories(expires_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS community_blocks (
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(blocker_id,blocked_id),
  CHECK (blocker_id<>blocked_id)
);
CREATE INDEX IF NOT EXISTS community_blocks_blocked_idx ON community_blocks(blocked_id,blocker_id);

CREATE TABLE IF NOT EXISTS community_live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),
  meeting_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  starts_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_live_sessions_upcoming_idx
  ON community_live_sessions(status, starts_at ASC);