# Closing Price Derby

A competitive real estate leaderboard that turns luxury property sales into a sports-style competition. Cities compete as teams, ranked by their highest recent closing prices in a gamified interface.

## 🏆 Live Demo

![Derby Banner](public/derby-banner.webp)

The app displays real estate data as a dynamic leaderboard with:
- **Team-based competition** - Cities represented as sports teams
- **Real-time price tracking** - Live updates every 60 seconds  
- **Price deltas** - Shows gains/losses from previous sales
- **Interactive modals** - Detailed sales data and price history charts
- **Live event ticker** - Breaking news style updates for rank changes

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
npm run build    # Production build
npm run preview  # Preview production build  
npm run lint     # Code linting
npm run scrape   # One-time data scrape
npm run cron     # Continuous scraping (4hr intervals)
```

## 📊 Data Pipeline

### RapidAPI Integration
Real estate data is fetched from Redfin via RapidAPI. Configure your API key:

```bash
# Create .env file
RAPIDAPI_KEY=your_rapidapi_key_here
```

### Scraping System
- **One-time scrape:** `npm run scrape` - Updates data files immediately
- **Scheduled scraping:** `npm run cron` - Runs every 4 hours automatically
- **GitHub Actions:** Automated scraping with deployment triggers

### Data Output
- `/public/leaderboard.json` - Current rankings and top prices
- `/public/sales-data.json` - Detailed property sales by ZIP code

### Configuration
Cities and team assignments are managed in `/scripts/city-regions.js`

## 🛠 Tech Stack

**Frontend:**
- React 18 + TypeScript
- Vite (fast build/dev)
- Tailwind CSS + Shadcn/ui components
- SWR for data fetching
- Recharts for price history

**Backend/Scraping:**
- Node.js scripts
- RapidAPI (Redfin data)
- node-cron for scheduling
- Rate limiting & error handling

**Deployment:**
- Static site compatible (Netlify, Vercel, etc.)
- GitHub Actions for automated data updates

## 🏗 Architecture

```
src/
├── components/          # UI components
│   ├── ZipCodeCard.tsx     # Leaderboard item
│   ├── ZipDetailModal.tsx  # Sales detail modal
│   ├── LiveEventTicker.tsx # Breaking news ticker
│   └── ui/                 # Shadcn/ui components
├── pages/Index.tsx      # Main leaderboard page
├── hooks/use-mobile.tsx # Responsive utilities
└── lib/utils.ts         # Shared utilities

scripts/
├── scrape-rapidapi.js   # Data fetching logic
├── city-regions.js      # City/team configuration
└── cron.js             # Scheduled execution

public/
├── leaderboard.json     # Current rankings (auto-generated)
└── sales-data.json      # Sales details (auto-generated)
```

## 🚀 Quick Deploy with Netlify Drop

1. Build: `npm run build`
2. Visit [netlify.com/drop](https://netlify.com/drop)
3. Drag `dist/` folder to the page
4. Get instant live URL (24hr free hosting)

## 🔄 Automated Updates

The GitHub Actions workflow automatically:
- Scrapes fresh data every 4 hours
- Commits updated JSON files
- Triggers redeployment on hosting platforms

## 📱 Mobile-First Design

- Touch-friendly interactions
- Bottom sheet modals
- Responsive breakpoints
- Optimized animations

## 🎮 Features

- **Live leaderboard** with team-style competition
- **Real-time price deltas** showing market movements  
- **Interactive sales modals** with detailed property data
- **Price history charts** for trend analysis
- **Live event ticker** for rank changes and big sales
- **Auto-refresh** every 60 seconds
- **Mobile-optimized** responsive design