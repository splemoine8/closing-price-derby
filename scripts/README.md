# Scripts Directory

This directory contains scripts for managing the Closing Price Derby competition.

## Active Scripts

### Core Scripts
- **`run-competition-update.js`** - Main scraper that fetches property data from Redfin API and updates the database
  - Runs on schedule to keep competition data current
  - No date filtering (lets SQL views handle competition period)

- **`city-regions.js`** - Configuration file containing city names and their Redfin region IDs

### Utility Tools (`tools/`)
- **`export-all-sales.js`** - Exports sales data for analysis and verification
- **`verify-highest-sales-fixed.js`** - Verifies the highest sale for each city
- **`clean-sales-data.js`** - Removes duplicate or invalid sales data
- **`backfill-competition-sales-fixed.js`** - Backfills missing sales data

### Supporting Files
- **`utils/canonical-city.js`** - Maps city name variations to canonical names
- **`verification/`** - Scripts for data verification workflows
- **`data/`** - Data files and configuration
- **`exports/`** - Export output directory

## Archived Scripts

The `archive/` directory contains:
- **`deprecated/`** - Old versions of scripts no longer in use
- **`debug/`** - Debug and diagnostic scripts (check-*.js, debug-*.js)
- **`tests/`** - Test scripts (test-*.js)
- **`one-time/`** - Scripts created for specific one-time tasks

## Usage

### Running the main scraper:
```bash
node scripts/run-competition-update.js
```

### Exporting sales data:
```bash
node scripts/tools/export-all-sales.js
```

### Verifying highest sales:
```bash
node scripts/tools/verify-highest-sales-fixed.js
```

## Notes

- Competition dates are now managed in the `competition_config` table in Supabase
- The main scraper fetches all sales; SQL views filter by competition period
- All times are handled in UTC with automatic timezone conversion