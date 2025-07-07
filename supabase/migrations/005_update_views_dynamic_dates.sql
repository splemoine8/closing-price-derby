-- Drop existing views
DROP VIEW IF EXISTS leaderboard CASCADE;
DROP VIEW IF EXISTS city_sales_detail CASCADE;

-- Recreate leaderboard view with dynamic dates
CREATE OR REPLACE VIEW leaderboard AS
WITH active_competition AS (
  SELECT * FROM competition_config WHERE is_active = true LIMIT 1
),
current_highest_sales AS (
  SELECT
    s.city_name,
    s.sale_price,
    s.address as top_sale_address,
    s.sale_timestamp_utc as last_sold_date,
    ROW_NUMBER() OVER(
      PARTITION BY s.city_name 
      ORDER BY s.sale_price DESC, s.sale_timestamp_utc ASC
    ) as rank
  FROM sales s, active_competition ac
  WHERE s.sale_timestamp_utc BETWEEN ac.utc_start AND ac.utc_end
)
SELECT
  c.name as city,
  c.state,
  c.team_name,
  c.baseline_price,
  COALESCE(chs.sale_price, 0) as price,
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
  CASE 
    WHEN chs.sale_price > 0 THEN chs.sale_price - c.baseline_price
    ELSE 0
  END as price_delta
FROM cities c
LEFT JOIN current_highest_sales chs 
  ON c.name = chs.city_name AND chs.rank = 1
ORDER BY score_pct DESC NULLS LAST;

-- Recreate city sales detail view with dynamic dates
CREATE OR REPLACE VIEW city_sales_detail AS
SELECT 
  s.city_name,
  s.address,
  s.sale_price as price,
  s.sale_timestamp_utc::date as date,
  s.bedrooms as beds,
  s.bathrooms as baths,
  s.square_feet as sqft,
  s.url
FROM sales s, (SELECT * FROM competition_config WHERE is_active = true LIMIT 1) ac
WHERE s.sale_timestamp_utc BETWEEN ac.utc_start AND ac.utc_end
ORDER BY s.sale_price DESC, s.sale_timestamp_utc ASC;

-- Grant permissions
GRANT SELECT ON leaderboard TO anon, authenticated;
GRANT SELECT ON city_sales_detail TO anon, authenticated;