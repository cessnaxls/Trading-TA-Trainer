# Market Chart Academy

An iPad-first technical-analysis training simulator built for GitHub + Render.

## What it includes
- Candlestick and line-chart training
- Hidden-future prediction exercises
- Probability forecasts instead of binary guessing
- Brier scoring for calibration
- Market regime recognition
- Trend / structure / momentum / volatility analysis
- Support / resistance exercises
- EMA, RSI, MACD, ATR and volume
- Breakout vs failed-breakout scenarios
- Mean-reversion scenarios
- Replay / resolution with explanation
- Lesson library
- Session and lifetime stats
- Local progress saved in the browser
- PWA-friendly iPad layout
- Synthetic data generation; no brokerage or API key required

## Run locally

```bash
npm install
npm run dev
```

## Deploy to Render
1. Put this folder in a GitHub repository.
2. In Render, create a new Blueprint or Static Site from the repo.
3. Render will use `render.yaml`.
4. Build command: `npm install && npm run build`
5. Publish directory: `dist`

## Important
This project is educational. Technical analysis is probabilistic and does not guarantee profitable outcomes.
