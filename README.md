# Type Speed Game (Next.js)

A minimum typing game matching your requested flow:

1. Main menu with only **Game Start**.
2. Fake loading screen.
3. Floating word boxes appear.
4. Box border color changes from white → yellow → red over time.
5. Unfinished box timeout removes 1 resource (3 total).
6. 10 boxes per round, 100 points per box.
7. Clear all boxes to pass, then auto-return to menu.

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Vercel

- Import this repo in Vercel.
- Framework preset: **Next.js**.
- Build command: `next build` (default).
- Output: default.
