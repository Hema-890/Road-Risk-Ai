import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const context = browser.defaultBrowserContext();
  await context.overridePermissions('http://127.0.0.1:5173', ['geolocation']);
  await page.setGeolocation({ latitude: 16.5062, longitude: 80.6480, accuracy: 12 });
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2', timeout: 20000 });
  await new Promise(r => setTimeout(r, 2000));
  
  const searchInput = await page.$('#roadrisk-destination-input');
  if (searchInput) {
    await searchInput.type('Government Hospital');
    await new Promise(r => setTimeout(r, 1500));
    const first = await page.$('.search-result-item');
    if (first) {
      await first.click();
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // Find and click the Directions button using standard Puppeteer click
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Directions')) {
      console.log('Clicking Directions button...');
      await btn.click();
      break;
    }
  }

  // Wait for OSRM route calculation to resolve and render on map
  await new Promise(r => setTimeout(r, 4500));
  await page.screenshot({ path: 'docs/screenshots/r2_full_route_active.png' });
  await browser.close();
  console.log('Directions test completed, screenshot captured.');
}

main().catch(console.error);
