# Closing Price Derby

A React application for tracking real estate closing prices in a competitive leaderboard format. ZIP codes compete as teams ranked by their highest recent property sales.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to http://localhost:5173

## Development

- Build: `npm run build`
- Preview: `npm run preview`
- Lint: `npm run lint`

## Local Scraping

The application includes a data scraping system that fetches real estate data from Redfin:

### One-time scrape
```bash
npm run scrape
```
This fetches the latest sales data for all ZIP codes and writes results to `/public/leaderboard.json`.

### Continuous scraping
```bash
npm run cron
```
Runs the scraper every 4 hours automatically. Press Ctrl+C to stop.

### Configuration
- ZIP codes are configured in `/scripts/zips.json`
- Scraper respects rate limits (300ms between requests)
- Failed requests result in price = 0 (graceful degradation)

## GitHub Cron Deploy

The repository includes a GitHub Actions workflow (`.github/workflows/scrape.yml`) that:
- Runs every 4 hours automatically
- Scrapes fresh data and commits to `/public/leaderboard.json`
- Triggers redeployment on platforms like Vercel/Netlify

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Shadcn UI
- SWR (data fetching)
- React Router
- Node.js (scraping scripts)
- node-cron (scheduling)