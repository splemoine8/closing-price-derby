-- Update the sales index to cover the extended competition period
-- This improves query performance for the views

-- Drop old index if it exists
DROP INDEX IF EXISTS idx_sales_competition_period;

-- Create new index with extended date range (June 23 - July 13, 2025)
-- Adding a buffer day on each side for timezone edge cases
CREATE INDEX idx_sales_competition_period ON sales(sale_timestamp_utc) 
WHERE sale_timestamp_utc BETWEEN '2025-06-22T00:00:00Z' AND '2025-07-15T00:00:00Z';

-- Also create an index on city_name for better join performance
CREATE INDEX IF NOT EXISTS idx_sales_city_name ON sales(city_name);

-- Create composite index for the common query pattern used in views
CREATE INDEX IF NOT EXISTS idx_sales_competition_lookup ON sales(city_name, sale_timestamp_utc, sale_price DESC)
WHERE sale_timestamp_utc BETWEEN '2025-06-22T00:00:00Z' AND '2025-07-15T00:00:00Z';