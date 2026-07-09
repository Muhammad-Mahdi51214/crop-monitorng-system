ALTER TABLE field_analyses ADD COLUMN IF NOT EXISTS satellite_image TEXT;
ALTER TABLE field_analyses ADD COLUMN IF NOT EXISTS ndvi_image TEXT;
ALTER TABLE field_analyses ADD COLUMN IF NOT EXISTS image_bounds JSONB;
