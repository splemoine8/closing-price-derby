-- Create table with automatic UTC conversion
CREATE TABLE competition_config (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pacific_start TIMESTAMP NOT NULL,
  pacific_end TIMESTAMP NOT NULL,
  utc_start TIMESTAMPTZ GENERATED ALWAYS AS (pacific_start AT TIME ZONE 'America/Los_Angeles') STORED,
  utc_end TIMESTAMPTZ GENERATED ALWAYS AS (pacific_end AT TIME ZONE 'America/Los_Angeles') STORED,
  draft_night DATE,
  baseline_snapshot_date DATE,
  start_from_zero BOOLEAN DEFAULT true,
  status TEXT CHECK (status IN ('setup', 'live', 'complete')),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create partial unique index to ensure only one active competition
CREATE UNIQUE INDEX only_one_active_competition ON competition_config (is_active) 
WHERE is_active = true;

-- Grant permissions
GRANT SELECT ON competition_config TO anon, authenticated;

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_competition_config_updated_at
  BEFORE UPDATE ON competition_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();