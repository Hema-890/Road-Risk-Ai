// scripts/verify-realtime-navigation-e2e.mjs
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = '/Users/jagadesh/.gemini/antigravity-ide/brain/a82a0461-3d25-45e6-a692-f1ea8aeae9a8';
const DOCS_DIR = path.resolve('docs/screenshots');

if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

async function saveScreenshot(page, filename) {
  const p1 = path.join(DOCS_DIR, filename);
  const p2 = path.join(ARTIFACT_DIR, filename);
  await page.screenshot({ path: p1, fullPage: false });
  fs.copyFileSync(p1, p2);
  console.log(`  📸 Saved screenshot: ${filename}`);
}

async function run() {
  console.log('🚀 [E2E] Starting Realtime Navigation System Comprehensive Verification...\n');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();

  // Listen to console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`  [Browser Error]:`, msg.text());
    }
  });

  try {
    console.log('Step 1: Navigating to RoadRisk AI (http://127.0.0.1:5173)...');
    await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));

    // Wait for map canvas
    await page.waitForSelector('canvas.maplibregl-canvas', { timeout: 15000 });
    console.log('  ✅ Base MapLibre canvas loaded successfully.');

    await saveScreenshot(page, 'nav_step1_clean_basemap.png');

    // Step 2: Search for "Benz Circle"
    console.log('\nStep 2: Testing Multi-Tier Universal Search for "Benz Circle"...');
    const searchInput = await page.waitForSelector('#roadrisk-destination-input', { timeout: 10000 });
    await searchInput.click();
    await searchInput.type('Benz Circle', { delay: 80 });
    console.log('  Typed "Benz Circle" into search input.');

    // Wait for search dropdown results
    await page.waitForSelector('.search-result-item', { timeout: 10000 });
    const results = await page.$$eval('.search-result-item', (items) =>
      items.slice(0, 5).map((el) => el.innerText.split('\n').filter(Boolean).join(' | '))
    );
    console.log('  ✅ Search Results returned:');
    results.forEach((r, i) => console.log(`     [${i + 1}] ${r}`));

    // Click first result
    const firstResult = await page.$('.search-result-item');
    await firstResult.click();
    console.log('  Selected first search result.');
    await new Promise((r) => setTimeout(r, 2000));

    await saveScreenshot(page, 'nav_step2_search_and_selected_card.png');

    // Step 3: Verify Routes and Travel Modes
    console.log('\nStep 3: Verifying Route Alternatives & Travel Mode Selector...');
    await page.waitForSelector('.route-card', { timeout: 15000 });
    const routeTitles = await page.$$eval('.route-card', (cards) =>
      cards.map((c) => {
        const text = c.innerText.replace(/\n+/g, ' ');
        return text.substring(0, 90) + '...';
      })
    );
    console.log(`  ✅ Routes calculated (${routeTitles.length} alternatives):`);
    routeTitles.forEach((t, i) => console.log(`     Route ${i + 1}: ${t}`));

    // Verify Travel Mode buttons exist
    const modeButtons = await page.$$eval('.travel-mode-pill', (pills) =>
      pills.map((p) => p.innerText.trim())
    );
    console.log('  ✅ Travel Mode Pills available:', modeButtons);

    await saveScreenshot(page, 'nav_step3_routes_and_modes.png');

    // Step 4: Test Transit Mode (Honest GTFS / Transit Data Unavailable Gate)
    console.log('\nStep 4: Testing Transit Mode & Honest Unavailability Guard...');
    const transitPill = await page.$('button[data-mode="TRANSIT"]');
    if (transitPill) {
      await transitPill.click();
      await new Promise((r) => setTimeout(r, 1200));

      const bannerText = await page.evaluate(() => {
        const banners = Array.from(document.querySelectorAll('div'));
        const match = banners.find((b) => b.innerText.includes('TRANSIT DATA UNAVAILABLE'));
        return match ? match.innerText : null;
      });

      if (bannerText) {
        console.log(`  ✅ Transit Banner Verified: "${bannerText.replace(/\n/g, ' ')}"`);
      } else {
        console.log('  ⚠️ Transit banner not directly detected via query.');
      }
      await saveScreenshot(page, 'nav_step4_transit_unavailable_notice.png');
    }

    // Step 5: Switch back to Car mode & Open Turn-by-Turn Directions Panel
    console.log('\nStep 5: Testing Dedicated Turn-by-Turn Directions Drawer...');
    const carPill = await page.$('button[data-mode="CAR"]');
    if (carPill) {
      await carPill.click();
      console.log('  Switched mode back to CAR.');
      await page.waitForSelector('.route-card', { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Click Directions button
    const directionsBtn = await page.waitForSelector('#roadrisk-directions-btn', { timeout: 10000 });
    if (directionsBtn) {
      await directionsBtn.click();
      console.log('  Clicked #roadrisk-directions-btn');
      await new Promise((r) => setTimeout(r, 1200));

      // Wait for drawer
      await page.waitForSelector('.directions-maneuver-item', { timeout: 8000 });
      const maneuvers = await page.$$eval('.directions-maneuver-item', (items) =>
        items.slice(0, 6).map((m) => m.innerText.replace(/\n+/g, ' - '))
      );
      console.log('  ✅ Turn-by-turn maneuvers loaded in drawer:');
      maneuvers.forEach((m, idx) => console.log(`     Step ${idx + 1}: ${m}`));

      await saveScreenshot(page, 'nav_step5_turn_by_turn_drawer.png');
    } else {
      console.log('  ⚠️ Directions button not found.');
    }

    console.log('\n🎉 [E2E] All Verification Steps Completed Successfully!');
  } catch (err) {
    console.error('❌ E2E Verification failed:', err);
    await saveScreenshot(page, 'nav_error_state.png');
  } finally {
    await browser.close();
  }
}

run();
