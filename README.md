# TÆPPIN' — Vipps Hackathon Demo

Real-time territory-control game embedded in the Vipps app. Vanilla JS + Vite. The
map is the **Google Maps JavaScript API**, with a Voronoi turf-control overlay
(`d3-delaunay`) coloured by the faction that owns each store.

## Google Maps API key (required for the map)

The map needs a Google Maps JS API key:

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select a project,
   enable **Maps JavaScript API** + **Directions API** (the walking route in the finale
   uses Directions; without it the route falls back to a straight guide line), and enable billing.
2. Create an API key. Restrict it to **HTTP referrers** for your domains
   (e.g. `http://localhost:5173/*` and your Vercel URL) and to the Maps JavaScript API.
3. Copy `.env.example` to `.env` and set the key:

   ```bash
   cp .env.example .env
   # .env
   VITE_GOOGLE_MAPS_API_KEY=AIza...your-key...
   ```

The key is embedded in the client bundle at build time — this is normal for the Maps JS
API. Lock it down with referrer + API restrictions rather than treating it as a secret.

> Without a key the rest of the demo still runs; the map panel shows a setup notice.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
```

## Production build

```bash
npm run build    # outputs to dist/
npm run preview  # serve the production build locally
```

## Deploy to Vercel

Vercel auto-detects Vite (build `vite build`, output `dist`).

1. Import the repo at [vercel.com/new](https://vercel.com/new).
2. Add an **Environment Variable**: `VITE_GOOGLE_MAPS_API_KEY` = your key
   (Settings → Environment Variables, for Production/Preview).
3. Add your `*.vercel.app` domain to the key's allowed HTTP referrers.

CLI alternative:

```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```

## Presenting on stage (phone mockup)

Open **`/present.html`** instead of the app directly. It renders the app inside a
polished phone frame on a dark stage backdrop, scaled to fill the projector.

- Local: `npm run dev`, then open `http://localhost:5173/present.html`
- Deployed: `https://your-app.vercel.app/present.html`

On stage:
1. Open `present.html` in the browser.
2. Click **⛶ Fullscreen** (or press F11) and project your laptop screen.
3. Drive the pitch by clicking through the phone like a real device.
4. **↻ Restart pitch** reloads the onboarding so you can re-run it between takes.

Tips:
- On the onboarding's location step, choose **Skip — central Oslo** for a predictable
  demo (avoids the live geolocation prompt). The phone iframe is geolocation-enabled if
  you do want a real fix.
- The page must be served over `https://` (or `localhost`) for geolocation + Maps.

Lighter-weight alternatives if you don't want the bundled mockup: Chrome DevTools device
toolbar (`Ctrl+Shift+M`), or device-frame apps like Responsively / Sizzy / Polypane
pointed at your dev URL.

## Structure

- `index.html` — page markup, loads `/src/main.js` as a module
- `present.html` — on-stage phone-mockup presenter view (embeds the app in an iframe)
- `src/main.js` — simulation engine, Google Map + turf overlay, scoreboard, feed, rewards
- `src/style.css` — all styling
- `vite.config.js` — build config (multi-page: `index.html` + `present.html`)
- `.env.example` — template for the Maps API key
