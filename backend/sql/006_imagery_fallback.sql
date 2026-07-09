-- Track when analysis used an older scene instead of the latest capture
ALTER TABLE field_analyses ADD COLUMN IF NOT EXISTS is_latest_scene BOOLEAN DEFAULT TRUE;
ALTER TABLE field_analyses ADD COLUMN IF NOT EXISTS imagery_caution TEXT;
