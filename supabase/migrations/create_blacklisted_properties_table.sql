-- Migration: Create blacklisted_properties table
-- This table stores properties that should be ignored by the competition update script

CREATE TABLE IF NOT EXISTS blacklisted_properties (
  id SERIAL PRIMARY KEY,
  city_name VARCHAR(255) NOT NULL,
  address VARCHAR(500) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  blacklisted_at TIMESTAMP DEFAULT NOW(),
  blacklisted_by VARCHAR(100) DEFAULT 'system',
  UNIQUE(city_name, address)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_blacklisted_properties_city_address ON blacklisted_properties(city_name, address);

-- Add comment for documentation
COMMENT ON TABLE blacklisted_properties IS 'Properties that should be excluded from competition data updates';