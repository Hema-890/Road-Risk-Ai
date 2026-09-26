import puppeteer from 'puppeteer-core';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = 'http://127.0.0.1:5173';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function debugVoiceTrace() {
  console.log('[DEBUG] Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  const page = await browser.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[VOICE]') || text.includes('[SPEECH]') || text.includes('speak') || text.includes('cancel')) {
      console.log('BROWSER CONSOLE:', text);
    }
  });

  await page.goto(APP_URL);
  await sleep(2000);

  // Hook into window.speechSynthesis before any navigation clicks
  await page.evaluate(() => {
    window.__voiceDebugLog = [];
    const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    const origCancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);

    window.speechSynthesis.speak = function (u) {
      const entry = {
        type: 'speak',
        text: u.text,
        lang: u.lang,
        voiceName: u.voice ? u.voice.name : null,
        speaking: window.speechSynthesis.speaking,
        pending: window.speechSynthesis.pending,
        paused: window.speechSynthesis.paused,
        time: Date.now()
      };
      window.__voiceDebugLog.push(entry);
      console.log('[VOICE DEBUG SPEAK ENTRY]:', JSON.stringify(entry));

      u.onstart = () => {
        const startEntry = { type: 'onstart', text: u.text, time: Date.now() };
        window.__voiceDebugLog.push(startEntry);
        console.log('[VOICE DEBUG ONSTART]:', JSON.stringify(startEntry));
      };

      u.onend = () => {
        const endEntry = { type: 'onend', text: u.text, time: Date.now() };
        window.__voiceDebugLog.push(endEntry);
        console.log('[VOICE DEBUG ONEND]:', JSON.stringify(endEntry));
      };

      u.onerror = (e) => {
        const errEntry = { type: 'onerror', error: e.error, text: u.text, time: Date.now() };
        window.__voiceDebugLog.push(errEntry);
        console.error('[VOICE DEBUG ONERROR]:', JSON.stringify(errEntry));
      };

      return origSpeak(u);
    };

    window.speechSynthesis.cancel = function () {
      const cancelEntry = {
        type: 'cancel',
        speaking: window.speechSynthesis.speaking,
        pending: window.speechSynthesis.pending,
        stack: new Error().stack?.split('\n').slice(1, 4).map(s => s.trim()).join(' -> '),
        time: Date.now()
      };
      window.__voiceDebugLog.push(cancelEntry);
      console.log('[VOICE DEBUG CANCEL ENTRY]:', JSON.stringify(cancelEntry));
      return origCancel();
    };
  });

  console.log('[DEBUG] Searching destination "Hyderabad"...');
  const searchInput = await page.waitForSelector(
    '#roadrisk-destination-input, input.destination-input, input[placeholder*="Where do you want to go"], input[placeholder*="Search"]',
    { timeout: 15000 }
  );
  await searchInput.click();
  await searchInput.type('Hyderabad', { delay: 60 });
  await sleep(3000);

  const firstResult = await page.waitForSelector('.search-result-item', { timeout: 8000 });
  await firstResult.click();
  await sleep(2500);

  console.log('[DEBUG] Clicking "Start Navigation"...');
  const startBtn = await page.waitForSelector('#roadrisk-start-navigation-btn, .start-navigation-btn', { timeout: 8000 });
  await startBtn.click();

  // Wait 4 seconds to observe speech behavior
  await sleep(4000);

  const debugLog = await page.evaluate(() => window.__voiceDebugLog);
  console.log('\n============================================================');
  console.log('   FULL SPEECH SYNTHESIS LIFECYCLE EVENT TRACE:');
  console.log('============================================================');
  console.log(JSON.stringify(debugLog, null, 2));

  await browser.close();
}

debugVoiceTrace().catch((err) => {
  console.error('Fatal debug error:', err);
  process.exit(1);
});
