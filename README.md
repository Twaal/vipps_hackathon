# TÆPPIN' — Vipps Hackathon Demo

Real-time territory-control game embedded in the Vipps app. Vanilla JS + Vite. The
map is the **Google Maps JavaScript API**, with a Voronoi turf-control overlay
(`d3-delaunay`) coloured by the faction that owns each store.

## Google Maps API key (required for the map)

The map needs a Google Maps JS API key:

1. In [Google Cloud Console](https://console.cloud.google.com/), create/select a project,
   enable **Maps JavaScript API**, and enable billing.
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
1. Open `present.html` in the browser and press **F11** to go full-screen; project your laptop.
2. Drive the pitch with the **← / →** arrow keys (or click the buttons in the phone).
3. Reload the page to start the pitch over between takes.

Tips:
- On the onboarding's location step, choose **Skip — central Oslo** for a predictable
  demo (avoids the live geolocation prompt). The phone iframe is geolocation-enabled if
  you do want a real fix.
- The page must be served over `https://` (or `localhost`) for geolocation + Maps.

## Export the deck to PDF / images (for submission)

To turn the live pitch into a static deck for Google Drive / Slides:

```bash
npm install            # installs puppeteer
npm run dev            # leave running in one terminal
npm run export         # in another terminal
```

The exporter drives your **locally-installed Google Chrome** (no Chromium download needed).
If you don't have Chrome, grab Puppeteer's bundled browser once with
`npx puppeteer browsers install chrome`, then re-run `npm run export`.

Output lands in `export/`:
- `taeppin-deck.pdf` — one slide per page (16:10). Upload to Drive, or in Google Slides
  use **File → Import slides** / insert the PNGs.
- `slide-01.png …` — one image per slide; drag straight onto Google Slides.

Export the deployed version instead of localhost:

```bash
URL=https://vippshackathon.vercel.app/present npm run export
```

**No-setup alternative:** open `/present`, step through with **→**, and screenshot each
slide (Windows: `Win+Shift+S`), then paste the images into Google Slides.

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
