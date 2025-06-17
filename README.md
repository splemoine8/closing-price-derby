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

## Data Scraping

The application includes a data scraping system that fetches real estate data from Redfin via RapidAPI:

### Prerequisites
You need a RapidAPI key for the Redfin API. Add it to your `.env` file:
```
RAPIDAPI_KEY=your_api_key_here
```

### One-time scrape
```bash
npm run scrape
```
This fetches the latest sales data for all cities and updates:
- `/public/leaderboard.json` (current top prices)
- `/public/sales-data.json` (detailed sales data)

### Continuous scraping
```bash
npm run cron
```
Runs the scraper every 4 hours automatically. Press Ctrl+C to stop.

### Configuration
- Cities and team assignments are configured in `/scripts/city-regions.js`
- Scraper includes rate limiting and error handling
- Failed requests are logged but don't crash the process

### Manual Refresh
After running the scraper, refresh your browser or click the floating refresh button in the app to see updated data.

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