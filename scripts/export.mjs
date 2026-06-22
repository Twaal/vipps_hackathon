/**
 * Screenshots every slide of the presenter page and assembles a PDF + PNGs.
 *
 *   1. start the app:   npm run dev      (leave it running)
 *   2. in another shell: npm run export
 *
 * Output: export/taeppin-deck.pdf  and  export/slide-01.png …
 * Upload the PDF to Google Drive, or drag the PNGs onto Google Slides.
 *
 * Override the target with:  URL=https://vippshackathon.vercel.app/present npm run export
 */
import puppeteer from 'puppeteer';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.env.URL || 'http://localhost:5173/present';
const OUT = 'export';
const W = 1600, H = 1000;

mkdirSync(OUT, { recursive: true });

// Prefer the locally-installed Google Chrome (no Chromium download needed);
// fall back to Puppeteer's bundled browser if it was downloaded.
async function launchBrowser() {
  const base = { headless: true, args: ['--no-sandbox'] };
  try {
    return await puppeteer.launch({ ...base, channel: 'chrome' });
  } catch {
    return await puppeteer.launch(base);
  }
}

const browser = await launchBrowser();
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });

console.log(`Opening ${URL} …`);
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });

// wait until the app (inside the iframe) exposes its slide controls
await page.waitForFunction(() => {
  const f = document.getElementById('app');
  return f && f.contentWindow && typeof f.contentWindow.__onbGoto === 'function';
}, { timeout: 30000 });

const total = await page.evaluate(
  () => document.getElementById('app').contentWindow.document.querySelectorAll('.onb-slide').length
);
console.log(`Found ${total} slides.`);

const shots = [];
for (let i = 0; i < total; i++) {
  await page.evaluate((idx) => document.getElementById('app').contentWindow.__onbGoto(idx), i);
  await new Promise(r => setTimeout(r, 900)); // let transitions + graphics settle
  const b64 = await page.screenshot({ encoding: 'base64' });
  shots.push(b64);
  const file = `${OUT}/slide-${String(i + 1).padStart(2, '0')}.png`;
  writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(`  ✓ ${file}`);
}

// assemble one PDF, one slide per page
const pdfPage = await browser.newPage();
const imgs = shots.map(b64 => `<img src="data:image/png;base64,${b64}">`).join('');
await pdfPage.setContent(
  `<!doctype html><html><head><style>
     @page { size: ${W}px ${H}px; margin: 0; }
     html, body { margin: 0; padding: 0; }
     img { display: block; width: ${W}px; height: ${H}px; object-fit: cover; page-break-after: always; }
   </style></head><body>${imgs}</body></html>`,
  { waitUntil: 'load' }
);
await pdfPage.pdf({ path: `${OUT}/taeppin-deck.pdf`, width: `${W}px`, height: `${H}px`, printBackground: true });
console.log(`\nDone → ${OUT}/taeppin-deck.pdf (+ ${total} PNGs)`);

await browser.close();
