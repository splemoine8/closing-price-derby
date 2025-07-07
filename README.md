# Closing Price Derby

A competitive real estate leaderboard that gamifies luxury property sales into a sports-style competition. NFL cities compete as teams, ranked by performance multipliers that compare their highest sales against local market baselines. The app features a live event ticker, interactive sales modals with detailed property data, and real-time leaderboard updates powered by Supabase.

## 🏆 How It Works

**Performance-Based Scoring**: Each city's rank is determined by their **highest sale's performance vs. local baseline**:
- **Score = (Highest Sale Price - Market Baseline) ÷ Baseline × 100**
- **Multiplier Display**: `×2.3` means the sale was 2.3× the local median price
- **Fair Competition**: Cities compete against their own market conditions, not raw prices

**Competition States**: The application dynamically adjusts based on configuration in Supabase:
- **Setup**: Before the competition, a countdown timer builds anticipation
- **Live**: During the active competition, the leaderboard shows real-time scores  
- **Complete**: After the competition ends, final results are displayed for posterity

---

## 🚀 Quick Start

1. **Set up environment variables** - Create `.env` file with your credentials:
   ```
   VITE_SUPABASE_URL=YOUR_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
   RAPIDAPI_KEY=YOUR_RAPIDAPI_KEY
   ```

2. **Install dependencies and run the dev server:**
   ```bash
   npm install
   npm run dev
   ```

3. **Open browser** → http://localhost:5173

---

## 🏗 Architecture & Tech Stack

This project uses a modern, database-centric architecture with Supabase as the single source of truth.

### Data Flow
```
Redfin API → [run-competition-update.js] → Supabase Tables → [PostgreSQL VIEW] → Frontend (React)
```

- **Data Scraping**: A scheduled cron job runs the `run-competition-update.js` script
- **Database Storage**: The script upserts new sales data into the Supabase `sales` table  
- **Live Calculation**: A PostgreSQL `leaderboard` VIEW calculates rankings dynamically on the server
- **Frontend Display**: The React app fetches data from the view via SWR, enabling real-time updates

### Database Schema
Four key components in Supabase organize all competition data:
- **`competition_config`**: Single row defining the active competition's dates and status
- **`cities`**: Configuration for each competing city (team names, baseline prices)
- **`sales`**: Granular records of individual property sales
- **`leaderboard` (VIEW)**: A real-time calculated view that joins the tables above to create the final rankings

### Tech Stack
**Frontend**: React 18, TypeScript, Vite, SWR, Tailwind CSS, Shadcn/ui  
**Backend & Database**: Supabase, PostgreSQL with custom views and triggers  
**Data Source**: Redfin property data via RapidAPI  
**Deployment**: Render (Static Site + Cron Job for the data pipeline)

---

## 📦 Scripts & Data Management

**Core Development Commands**:
- `npm run dev` - Start development server
- `npm run build` - Build for production  
- `npm run lint` - Lint and format code
- `npm run preview` - Preview production build

**Data Management**: For all data scraping, backfilling, verification, and other administrative tasks, please refer to the dedicated documentation:

➡️ **[See Scripts Documentation](./scripts/README.md)**

---

## 🚀 Deployment

Deploying the Closing Price Derby involves three main steps: setting up the database, deploying the frontend, and scheduling the data pipeline.

**1. Set Up Supabase:**
- Create your Supabase project
- Run the database migrations located in the `/supabase/migrations` directory to create the required tables and views (one-time setup)

**2. Deploy to Render:**
- **Static Site**: Deploy the frontend as a "Static Site" service on Render (builds from root directory)
- **Cron Job**: Deploy the data pipeline as a "Cron Job" service on Render
  - Set command to: `node scripts/run-competition-update.js`
  - Configure schedule (e.g., every 30 minutes)

**3. Configure Environment Variables:**
In your Render services, configure the same production environment variables from your `.env` file (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `RAPIDAPI_KEY`)