# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Start development server:** `npm run dev` (runs on http://localhost:5173)
**Build for production:** `npm run build`
**Preview build:** `npm run preview`
**Lint code:** `npm run lint`

## Architecture Overview

This is a **React + TypeScript** application built with **Vite** that displays real estate closing price data as a competitive leaderboard. ZIP codes are ranked by their highest property prices and presented with gamified team names.

### Key Technical Decisions

- **Vite + React SWC** for fast development with hot reload
- **Tailwind CSS + Shadcn/ui** for styling (semantic design tokens via CSS variables)
- **TypeScript with relaxed rules** (`strict: false`, allows unused vars/params)
- **TanStack Query** configured but currently unused (ready for API integration)
- **Mobile-first responsive design** with custom animations

### Component Architecture

**Main Components:**
- `ZipCodeCard`: Interactive leaderboard item with hover/click animations
- `ZipDetailModal`: Bottom sheet modal showing sales data and price charts
- `LeaderboardHeader`: Header with title and branding
- `StatusBanner`: Shows last update time
- `FloatingRefreshButton`: Floating action button for data refresh

**Component Patterns:**
- Functional components with TypeScript interfaces
- Props drilling (no global state management)
- Custom animations: `scale`, `slide-in-right`, `hover` transitions
- ForwardRef pattern used throughout Shadcn/ui components

### Styling System

- **Path alias:** `@/` points to `src/`
- **CSS-in-JS:** Tailwind utility classes with semantic color tokens
- **Custom animations:** Scale effects on click, slide-in transitions
- **Design tokens:** HSL-based colors via CSS custom properties
- **Font:** Inter typeface with system fallbacks

### Data Flow

Currently uses **mock data** in `src/pages/Index.tsx`. Structure ready for API integration:
- `mockZipData`: Array of ZIP code rankings with team names and prices
- `mockSalesData`: Individual property sales by ZIP code
- `mockPriceHistory`: Historical price trends for charts

### Mobile-First Design

- **Touch-friendly:** 44px+ touch targets, hover states adapted for mobile
- **Bottom sheet modals:** Native mobile UX patterns
- **Responsive breakpoints:** Mobile-first with desktop enhancements
- **Custom mobile hook:** `use-mobile.tsx` for responsive behavior

## Code Conventions

- **File naming:** PascalCase for components, kebab-case for configs
- **Import order:** External libraries → Internal modules → Relative imports
- **TypeScript:** Interface definitions co-located with components
- **Animations:** Use existing Tailwind classes (`scale-98`, `animate-scale`)

## Date and Timezone Logic

**Simple rule: A sale counts if its Redfin closing date—shown in Pacific time—falls between 23 Jun and 6 Jul, inclusive.**

**Technical Implementation:**
- Competition filtering uses Pacific date comparison (`2025-06-23` to `2025-07-06`)
- Redfin's `07:00:00Z` / `08:00:00Z` timestamps are standardized placeholders (midnight Pacific)
- Date extraction handles both `lastSoldDate` and `sale_timestamp_utc` fields for backward compatibility
- Timezone conversion uses `date-fns-tz` for robust DST handling
- DST changes automatically handled without code updates

**Key Files:**
- `lib/dateUtils.js` - Centralized date conversion utilities
- `isSaleInPeriod()` function performs simple Pacific date string comparison
- Competition boundaries defined in `pacific_start`/`pacific_end` config fields

## Future API Integration

The app is structured for easy API integration:
- TanStack Query already configured in `App.tsx`
- Mock data structure matches expected API response format
- Loading/error states partially implemented in components
- Refresh functionality ready for real data fetching