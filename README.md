# Ticker-tracker-travel

TravelTicker is a phone-ready travel deal board that tracks cruises, flights, vacation packages, all-inclusive resorts, and hotels like a stock ticker.

## What it does

- Shows travel fares in a scrolling ticker board.
- Labels fare sources as live or simulated.
- Displays recent price movement and 48-hour history charts.
- Lets a visitor save fares to a local watchlist.
- Lets a visitor create price alerts tied to their browser session.

## Phone version

This branch adds the mobile/PWA layer so the Vercel deployment can be opened and saved to a phone home screen.

### iPhone install steps

1. Open the deployed TravelTicker site in Safari.
2. Tap the Share button.
3. Tap **Add to Home Screen**.
4. Name it **TravelTicker**.
5. Open it from the new home-screen icon.

### Android install steps

1. Open the deployed TravelTicker site in Chrome.
2. Tap the three-dot menu.
3. Tap **Install app** or **Add to Home screen**.
4. Open it from the new app icon.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run preview
```

## Deploy to Vercel

Use the repository root as the Vercel project root.

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

## Next production cleanup

- Move Supabase constants into Vite environment variables.
- Add PNG app icons for fuller iOS home-screen compatibility.
- Add a real notification layer for triggered alerts.
- Add provider-specific scraper/API jobs for actual deal feeds.
