-- YSCMT Enterprise Central Admin RBAC
-- Apply only after confirming the initial Super Admin account.
-- Roles are keyed to Supabase Auth user UUIDs; no user can self-assign a role.
CREATE TABLE IF NOT EXISTS public.central_admin_roles (
  user_id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('super_admin','finance','content_manager','support_staff')),
  is_active boolean NOT NULL DEFAULT true,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(permissions) = 'object'),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS central_admin_roles_active_role_idx
  ON public.central_admin_roles (role) WHERE is_active = true;
CREATE TABLE IF NOT EXISTS public.central_admin_audit_logs (
  id bigserial PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  target_user_id uuid,
  action text NOT NULL CHECK (action IN ('role_created','role_updated','role_disabled','role_enabled','permission_updated')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS central_admin_audit_logs_created_at_idx
  ON public.central_admin_audit_logs (created_at DESC);
ALTER TABLE public.central_admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.central_admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.central_admin_roles FROM PUBLIC;
REVOKE ALL ON TABLE public.central_admin_audit_logs FROM PUBLIC;
