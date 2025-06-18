# Closing Price Derby

A competitive real estate leaderboard that gamifies luxury property sales into a sports-style competition. NFL cities compete as teams, ranked by performance multipliers that compare their highest sales against local market baselines.

## 🏆 Competition Overview

![Derby Banner](public/derby-banner.webp)

### How It Works
**Performance-Based Scoring**: Each city's rank is determined by their **highest sale's performance vs. local baseline**:
- **Score = (Highest Sale Price - Market Baseline) ÷ Baseline × 100**
- **Multiplier Display**: `×2.3` means the sale was 2.3× the local median price
- **Fair Competition**: Cities compete against their own market conditions, not raw prices

### Features
- **12 NFL Cities** represented as teams with player assignments
- **Real-time leaderboard** with performance multipliers and rankings
- **Interactive sales modals** with detailed property data and price trends
- **Live event ticker** showing competition updates and rank changes
- **Market baseline calculation** using 30-day median prices with outlier filtering

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Open browser** → http://localhost:5173

### Available Commands
```bash
npm run build              # Production build
npm run preview            # Preview production build  
npm run lint               # Code linting
npm run calculate-baselines # Calculate real market baselines (one-time setup)
npm run scrape             # Scrape latest sales data
npm run update-regions     # Update Redfin region IDs
npm run cron               # Continuous scraping (4hr intervals)
```

## 📊 Data Pipeline

### Competition Setup (One-Time)

1. **Configure API Access:**
   ```bash
   # Create .env file
   RAPIDAPI_KEY=your_rapidapi_key_here
   ```

2. **Calculate Market Baselines:**
   ```bash
   npm run calculate-baselines
   ```
   - Analyzes 30 days of sales data per city
   - Calculates median prices with 1st/99th percentile outlier removal
   - Generates `/public/baselines.json` and quality report
   - **Run once before competition starts** - baselines stay fixed for fair scoring

### Live Competition Data

**Daily Sales Scraping:**
```bash
npm run scrape              # Manual update
npm run cron                # Automated 4-hour updates
```

**Data Output:**
- `/public/leaderboard.json` - Competition rankings with multipliers
- `/public/sales-data.json` - Detailed property sales by city
- `/public/baselines.json` - Fixed market baselines for scoring

### Baseline Methodology
- **Data Source**: 30-day Redfin sales data via RapidAPI
- **Outlier Removal**: 1st/99th percentile trimming (removes ~2% extreme values)
- **Calculation**: True median of filtered dataset
- **Quality Assurance**: Minimum 5 sales required, data confidence metrics included
- **Competition Fairness**: Preserves legitimate luxury sales while filtering data errors

## 🛠 Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (fast build/dev)
- Tailwind CSS + Shadcn/ui components
- SWR for data fetching with auto-refresh
- Custom SVG charts for price trends
- Mobile-first responsive design

**Data & Scraping:**
- Node.js scripts with RapidAPI integration
- Real-time Redfin property data
- Automated baseline calculation with outlier filtering
- node-cron for scheduled updates
- Rate limiting & comprehensive error handling

**Deployment:**
- Static site compatible (Netlify, Vercel, GitHub Pages)
- GitHub Actions for automated data pipeline
- Environment-based configuration

## 🏗 Architecture

```
src/
├── components/              # UI components
│   ├── ZipCodeCard.tsx         # Leaderboard item with multipliers
│   ├── ZipDetailModal.tsx      # Sales detail modal with price charts
│   ├── LiveEventTicker.tsx     # Breaking news ticker
│   ├── PriceDisplay.tsx        # Multiplier display with tooltips
│   ├── WeatherWidget.tsx       # City weather integration
│   └── ui/                     # Shadcn/ui component library
├── pages/Index.tsx          # Main leaderboard with competition logic
├── hooks/use-mobile.tsx     # Responsive utilities
└── lib/utils.ts             # Shared utilities

scripts/
├── calculate-baselines.js   # Market baseline calculation (30-day median)
├── scrape-rapidapi.js       # Live sales data fetching
├── update-region-ids.js     # Redfin region ID management  
├── city-regions.js          # NFL city/team configuration
└── cron.js                  # Scheduled execution

public/
├── baselines.json           # Fixed market baselines (competition setup)
├── leaderboard.json         # Current rankings with multipliers
├── sales-data.json          # Detailed property sales by city
└── baseline-quality-report.json # Data confidence metrics
```

## 🚀 Deployment

### Quick Deploy with Netlify Drop
1. Build: `npm run build`
2. Visit [netlify.com/drop](https://netlify.com/drop)
3. Drag `dist/` folder to the page
4. Get instant live URL (24hr free hosting)

### Production Setup
For full competition setup with live data:
1. **Calculate baselines** (one-time): `npm run calculate-baselines`
2. **Set up automated scraping** with GitHub Actions or cron jobs
3. **Deploy** to static hosting (Netlify, Vercel, GitHub Pages)

## 🎮 Competition Features

### Scoring System
- **Performance multipliers** instead of raw prices for fair competition
- **Highest sale tracking** - each city's rank based on their best performance
- **Fixed baselines** throughout competition period for consistent scoring
- **Real-time updates** with live sales data integration

### User Experience  
- **Live leaderboard** with NFL team branding and player assignments
- **Interactive sales modals** with detailed property data and price trends
- **Breaking news ticker** for rank changes and significant sales
- **Mobile-optimized** responsive design with touch-friendly interactions
- **Auto-refresh** every 60 seconds with seamless data updates

### Data Quality
- **Outlier-filtered baselines** using 1st/99th percentile trimming
- **Quality assurance metrics** with confidence reporting
- **Rate-limited API calls** with comprehensive error handling
- **Real-time Redfin integration** via RapidAPI