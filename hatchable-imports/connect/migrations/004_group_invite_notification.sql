-- Extend persisted notification types for private group invitations.
ALTER TABLE community_notifications
  DROP CONSTRAINT IF EXISTS community_notifications_notification_type_check;
ALTER TABLE community_notifications
  ADD CONSTRAINT community_notifications_notification_type_check
  CHECK (notification_type IN ('like','comment','follow','message','group','group_invite','live'));