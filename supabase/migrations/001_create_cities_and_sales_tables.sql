-- Migration: Create cities and sales tables for competition data
-- Phase 2.1 of refactoring plan

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS cities CASCADE;

-- Cities configuration table
CREATE TABLE cities (
  name TEXT PRIMARY KEY,
  team_name TEXT NOT NULL,
  baseline_price NUMERIC NOT NULL,
  region_id TEXT NOT NULL,
  state TEXT
);

-- Insert city data with baselines and region IDs from baselines.json
INSERT INTO cities (name, team_name, baseline_price, region_id, state) VALUES
  ('New York', 'Amir', 985000, '6_30749', 'NY'),
  ('Nashville', 'Julian', 527913, '6_13415', 'TN'),
  ('New Orleans', 'Travis', 289000, '6_14233', 'LA'),
  ('Los Angeles', 'Kevin', 1150000, '6_11203', 'CA'),
  ('Las Vegas', 'Danny', 436000, '6_10201', 'NV'),
  ('Dallas', 'Bryce', 472000, '6_30794', 'TX'),
  ('Miami', 'Chris', 580000, '6_11458', 'FL'),
  ('Phoenix', 'Scott', 452340, '6_14240', 'AZ'),
  ('San Francisco', 'Dan G', 1680000, '6_17151', 'CA'),
  ('Houston', 'Ryan', 376475, '6_8903', 'TX'),
  ('Tampa', 'AJ', 397500, '6_18142', 'FL'),
  ('Denver', 'Rex', 635000, '6_5155', 'CO');

-- Granular sales data table
CREATE TABLE sales (
  sale_id TEXT PRIMARY KEY, -- SHA256 hash of address|city|price|timestamp
  city_name TEXT REFERENCES cities(name),
  address TEXT NOT NULL,
  sale_price NUMERIC NOT NULL,
  sale_timestamp_utc TIMESTAMPTZ NOT NULL,
  bedrooms INTEGER,
  bathrooms NUMERIC,
  square_feet INTEGER,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sales_city_timestamp ON sales(city_name, sale_timestamp_utc DESC);
CREATE INDEX idx_sales_competition_period ON sales(sale_timestamp_utc) 
  WHERE sale_timestamp_utc BETWEEN '2025-06-23T07:00:00Z' AND '2025-07-07T06:59:59Z';

-- Grant permissions (adjust based on your Supabase auth setup)
GRANT SELECT ON cities TO anon, authenticated;
GRANT SELECT, INSERT ON sales TO anon, authenticated;