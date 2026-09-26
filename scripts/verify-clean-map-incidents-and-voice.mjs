import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = 'http://127.0.0.1:5173';
const ARTIFACT_DIR = '/Users/jagadesh/.gemini/antigravity-ide/brain/a82a0461-3d25-45e6-a692-f1ea8aeae9a8';

async function main() {
  console.log('--- STARTING CLEAN MAP, INCIDENTS & VOICE VERIFICATION ---');

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--window-size=1440,900',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  // Grant Geolocation
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(APP_URL, ['geolocation']);
  await page.setGeolocation({ latitude: 16.5062, longitude: 80.6480, accuracy: 15 });

  console.log('Navigating to', APP_URL);
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait 4 seconds for MapLibre tiles, TomTom traffic and UI to settle
  await new Promise(r => setTimeout(r, 4000));

  // Check map canvas
  const canvasExists = await page.evaluate(() => {
    const c = document.querySelector('canvas.maplibregl-canvas');
    return !!c && c.width > 0 && c.height > 0;
  });
  console.log('MapLibre Canvas Present & Sized:', canvasExists);

  // Check that giant debug ROAD CLOSURE markers do NOT dominate the screen
  const domIncidentLabels = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    return elements
      .filter(el => (el.textContent || '').trim() === 'ROAD CLOSURE')
      .map(el => el.className);
  });
  console.log('Generic DOM "ROAD CLOSURE" text nodes found:', domIncidentLabels.length);

  // Check Traffic indicator text
  const trafficStatus = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="traffic-status"]') ||
               Array.from(document.querySelectorAll('*')).find(e => (e.textContent || '').includes('TRAFFIC:'));
    return el ? el.textContent.trim() : 'NOT_FOUND';
  });
  console.log('Traffic status text in UI:', trafficStatus);

  // Take screenshot 1: Clean Opening Map
  const cleanScreenshotPath = path.join(ARTIFACT_DIR, 'clean_opening_map.png');
  await page.screenshot({ path: cleanScreenshotPath });
  console.log('Captured clean opening map screenshot to:', cleanScreenshotPath);

  // Check Voice Settings Popover
  console.log('Checking voice settings button...');
  const voiceBtn = await page.$('button[aria-label="Voice Navigation Settings"]');
  if (voiceBtn) {
    await voiceBtn.click();
    await new Promise(r => setTimeout(r, 1000));
    const popoverPath = path.join(ARTIFACT_DIR, 'voice_navigation_popover.png');
    await page.screenshot({ path: popoverPath });
    console.log('Captured voice navigation popover screenshot to:', popoverPath);

    const voiceSettingsText = await page.evaluate(() => {
      const panel = document.querySelector('.bg-slate-900');
      return panel ? panel.textContent : 'POPOVER_NOT_FOUND';
    });
    console.log('Voice settings popover content found:', voiceSettingsText.includes('Voice Guidance'));
  } else {
    console.log('Voice navigation button not found by selector');
  }

  await browser.close();
  console.log('--- VERIFICATION COMPLETE ---');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
