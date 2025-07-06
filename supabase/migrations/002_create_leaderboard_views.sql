-- Migration: Create leaderboard and sales detail views
-- Phase 2.2 and 2.3 of refactoring plan

-- Drop existing views if they exist
DROP VIEW IF EXISTS leaderboard CASCADE;
DROP VIEW IF EXISTS city_sales_detail CASCADE;

-- Create Leaderboard VIEW
CREATE OR REPLACE VIEW leaderboard AS
WITH current_highest_sales AS (
  SELECT
    s.city_name,
    s.sale_price,
    s.address as top_sale_address,
    s.sale_timestamp_utc as last_sold_date,
    -- Rank by price desc, then date asc for tie-breaking
    ROW_NUMBER() OVER(
      PARTITION BY s.city_name 
      ORDER BY s.sale_price DESC, s.sale_timestamp_utc ASC
    ) as rank
  FROM sales s
  WHERE s.sale_timestamp_utc BETWEEN '2025-06-23T07:00:00Z' AND '2025-07-07T06:59:59Z'
)
SELECT
  c.name as city,
  c.state,
  c.team_name,
  c.baseline_price,
  COALESCE(chs.sale_price, 0) as price,
  -- Calculate score and multiplier in the view
  CASE
    WHEN chs.sale_price > c.baseline_price
    THEN ((chs.sale_price - c.baseline_price) / c.baseline_price) * 100
    ELSE NULL
  END as score_pct,
  CASE
    WHEN chs.sale_price > c.baseline_price AND chs.sale_price <= c.baseline_price * 75
    THEN CONCAT('×', ROUND((chs.sale_price / c.baseline_price)::numeric, 1))
    ELSE '-'
  END as multiplier,
  chs.top_sale_address,
  chs.last_sold_date,
  -- Additional fields for frontend
  CASE 
    WHEN chs.sale_price > 0 THEN chs.sale_price - c.baseline_price
    ELSE 0
  END as price_delta
FROM cities c
LEFT JOIN current_highest_sales chs 
  ON c.name = chs.city_name AND chs.rank = 1
ORDER BY score_pct DESC NULLS LAST;

-- Create Sales Detail VIEW
CREATE OR REPLACE VIEW city_sales_detail AS
SELECT 
  city_name,
  address,
  sale_price as price,
  sale_timestamp_utc::date as date,
  bedrooms as beds,
  bathrooms as baths,
  square_feet as sqft,
  url
FROM sales
WHERE sale_timestamp_utc BETWEEN '2025-06-23T07:00:00Z' AND '2025-07-07T06:59:59Z'
ORDER BY sale_price DESC, sale_timestamp_utc ASC;

-- Grant permissions on views
GRANT SELECT ON leaderboard TO anon, authenticated;
GRANT SELECT ON city_sales_detail TO anon, authenticated;