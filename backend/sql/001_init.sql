CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  crop_type TEXT NOT NULL CHECK (crop_type IN ('wheat', 'rice', 'cotton', 'maize', 'other')),
  boundary GEOMETRY(Polygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fields_boundary_gix ON fields USING GIST (boundary);

CREATE TABLE IF NOT EXISTS field_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  ndvi_mean DOUBLE PRECISION,
  anomaly_zscore DOUBLE PRECISION,
  status_color TEXT NOT NULL CHECK (status_color IN ('green', 'yellow', 'red')),
  status_label TEXT NOT NULL,
  status_message TEXT NOT NULL,
  scene_id TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS field_analyses_field_id_idx ON field_analyses(field_id);
CREATE INDEX IF NOT EXISTS field_analyses_analyzed_at_idx ON field_analyses(analyzed_at DESC);
