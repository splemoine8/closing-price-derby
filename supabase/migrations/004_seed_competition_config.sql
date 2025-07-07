-- Insert current competition with EXTENDED end date
INSERT INTO competition_config (
  id,
  name,
  pacific_start,
  pacific_end,
  draft_night,
  baseline_snapshot_date,
  start_from_zero,
  status,
  is_active
) VALUES (
  '2025-summer-derby',
  'Summer 2025 Closing Price Derby',
  '2025-06-23 00:00:00',  -- Midnight Pacific (start of June 23)
  '2025-07-13 23:59:59',  -- Extended to July 13, 11:59:59 PM Pacific
  '2025-06-22',
  '2025-06-23',
  true,
  'live',
  true
);