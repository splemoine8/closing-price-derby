# Leaderboard Display Fix Plan: Highest Sale Mismatch

## Issue Summary

The application displays inconsistent highest sale values:
- **Main leaderboard (ZipCodeCard)**: Shows $4.5M for Phoenix
- **Detail modal (ZipDetailModal)**: Shows correct $5.5M for Phoenix

Both values come from Supabase, but the frontend incorrectly recalculates the highest sale value.

## Root Cause Analysis

### Data Flow
1. **Backend** (`cron-worker/scripts/aggregate-leaderboard.js`):
   - Fetches all sales from Supabase
   - Calculates highest sale per city for competition period
   - Creates two data structures:
     - `leaderboard`: Contains authoritative highest sale data
     - `sales_data`: Contains only top 10 sales per city for modal display

2. **Frontend** (`src/pages/Index.tsx`):
   - Fetches both `leaderboard` and `sales_data` from Supabase
   - Initially displays correct data from `leaderboard`
   - **Problem**: React.useEffect recalculates topPrice from `sales_data`
   - This overwrites the correct backend-calculated values

### Why This Happens
- `sales_data` only contains top 10 sales, which may not include the actual highest sale
- The frontend shouldn't recalculate values that the backend already computed correctly
- Violates the principle of single source of truth

## Recommended Solution

### Principle: Backend as Single Source of Truth
The backend should be the authoritative source for all competition calculations. The frontend should consume, not recalculate, these values.

### Implementation Steps

#### 1. Fix Frontend Data Usage (Primary Fix)

In `src/pages/Index.tsx`, modify the React.useEffect that recalculates prices:

```typescript
// CURRENT (Problematic)
React.useEffect(() => {
  const updatedData = zipData.map((zip) => {
    const { price, delta, highestSaleDate, mostRecentDate } = getHighestSaleData(zip.zipCode, salesData, competitionState);
    
    // This overwrites backend values!
    const actualPrice = price > 0 ? price : zip.topPrice;
    let actualScorePct = zip.scorePct;
    let actualMultiplier = zip.multiplier;
    
    if (price > 0 && zip.baseline && zip.multiplier !== '-') {
      actualScorePct = ((actualPrice - zip.baseline) / zip.baseline) * 100;
      actualMultiplier = `×${(actualScorePct / 100 + 1).toFixed(1)}`;
    }
    
    return { 
      ...zip, 
      topPrice: actualPrice,        // PROBLEM: Overwrites backend value
      scorePct: actualScorePct,     // PROBLEM: Recalculates backend value
      multiplier: actualMultiplier, // PROBLEM: Recalculates backend value
      priceDelta: delta,
      lastSoldDate: mostRecentDate
    };
  });
  // ...
});

// FIXED
React.useEffect(() => {
  const updatedData = zipData.map((zip) => {
    const { delta, mostRecentDate } = getHighestSaleData(zip.zipCode, salesData, competitionState);
    
    return { 
      ...zip, 
      // Keep backend-calculated values unchanged
      topPrice: zip.topPrice,      // Trust backend calculation
      scorePct: zip.scorePct,      // Trust backend calculation
      multiplier: zip.multiplier,  // Trust backend calculation
      // Only update supplementary fields
      priceDelta: delta,           // Delta between top sales (for display only)
      lastSoldDate: mostRecentDate // For activity ticker
    };
  });
  
  // Don't re-sort - maintain backend's authoritative ranking
  setZipDataWithDeltas(updatedData);
});
```

#### 2. Ensure Modal Shows Correct Data

The modal already receives the correct data through props:
- `highestSale` prop comes from `getHighestSaleForModal()`
- `highestSaleMultiplier` prop comes from the backend-calculated value

No changes needed here - the modal correctly displays the backend values.

#### 3. Optional Backend Enhancement

While not required for the fix, consider ensuring the highest sale is always included in `sales_data`:

```javascript
// In aggregate-leaderboard.js
const salesForModal = competitionSales.length > 0 ? 
  competitionSales
    .sort((a, b) => b.sale_price - a.sale_price)
    .slice(0, 10)  // Could ensure highest sale is always included
    .map(transformSaleForFrontend) :
  [];
```

However, this is unnecessary if the frontend properly uses backend values.

## Benefits of This Approach

1. **Single Source of Truth**: Backend remains the authority for all calculations
2. **Consistency**: Main page and modal show identical values
3. **Simplicity**: Frontend logic becomes simpler
4. **Performance**: Eliminates unnecessary client-side calculations
5. **Maintainability**: Calculation logic centralized in backend

## Testing Plan

1. Verify Phoenix shows $5.5M on both main leaderboard and modal
2. Check all cities display consistent values between card and modal
3. Ensure multipliers match between views
4. Confirm rankings remain stable and match backend calculations

## Alternative Approaches (Not Recommended)

### Option 2: Ensure sales_data Contains All Necessary Sales
- **Pros**: Would make frontend calculation correct
- **Cons**: 
  - Increases payload size
  - Duplicates backend logic
  - Still violates single source of truth
  - More complex to implement

### Option 3: Fetch All Sales in Frontend
- **Pros**: Frontend has complete data
- **Cons**:
  - Massive performance impact
  - Duplicates all backend logic
  - Poor architecture pattern

## Conclusion

The recommended fix is straightforward: make the frontend trust and use the backend's authoritative calculations rather than attempting to recalculate them from partial data. This aligns with best practices and solves the immediate issue while improving overall architecture.