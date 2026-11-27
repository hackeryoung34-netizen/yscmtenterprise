CREATE TABLE creations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  platform TEXT NOT NULL,
  objective TEXT NOT NULL,
  audience TEXT NOT NULL,
  tone TEXT NOT NULL,
  offer TEXT,
  key_message TEXT,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)