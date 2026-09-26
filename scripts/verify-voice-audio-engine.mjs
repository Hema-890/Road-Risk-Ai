// ==============================================================================
// ROADRISK AI — CRITICAL VOICE OUTPUT FAILURE VERIFICATION SUITE
// Tests real SpeechSynthesis browser lifecycle in headed Chrome:
// 1. Runtime Voice Discovery (180 voices, native Indian locales te-IN, hi-IN, ta-IN, kn-IN, en-US)
// 2. Manual Test Voice Button (Audible standalone playback across all 5 languages)
// 3. Directions Button Immediate Speech Activation
// 4. Ten-Times Consecutive Directions / Start Navigation Test (Latency T0, T1, T2)
// 5. Speech Cancellation on Navigation Stop
// ==============================================================================

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_URL = 'http://127.0.0.1:5173';
const EVIDENCE_DIR = path.resolve('docs/evidence');

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runVoiceVerification() {
  console.log('================================================================');
  console.log('   ROADRISK AI — P0 VOICE OUTPUT RECOVERY & VERIFICATION SUITE  ');
  console.log('================================================================\n');

  console.log(`[INIT] Launching Headed Chrome from: ${CHROME_PATH}`);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--autoplay-policy=no-user-gesture-required',
      '--window-size=1440,900',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const voiceEvents = [];
  const voiceErrors = [];

  // Expose binding to capture real browser speech synthesis events
  await page.exposeFunction('__recordSpeechEvent', (evt) => {
    voiceEvents.push(evt);
    if (evt.type === 'onerror') {
      voiceErrors.push(evt);
    }
  });

  // Inject speech instrumentor into page
  await page.evaluateOnNewDocument(() => {
    const origSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    const origCancel = window.speechSynthesis.cancel.bind(window.speechSynthesis);

    window.speechSynthesis.speak = function (utterance) {
      const entry = {
        type: 'speak',
        text: utterance.text,
        lang: utterance.lang,
        voiceName: utterance.voice ? utterance.voice.name : 'default',
        time: Date.now(),
      };
      window.__recordSpeechEvent(entry);

      const oldOnStart = utterance.onstart;
      const oldOnEnd = utterance.onend;
      const oldOnError = utterance.onerror;

      utterance.onstart = function (e) {
        window.__recordSpeechEvent({
          type: 'onstart',
          text: utterance.text,
          lang: utterance.lang,
          time: Date.now(),
        });
        if (oldOnStart) oldOnStart.call(utterance, e);
      };

      utterance.onend = function (e) {
        window.__recordSpeechEvent({
          type: 'onend',
          text: utterance.text,
          lang: utterance.lang,
          time: Date.now(),
        });
        if (oldOnEnd) oldOnEnd.call(utterance, e);
      };

      utterance.onerror = function (e) {
        window.__recordSpeechEvent({
          type: 'onerror',
          text: utterance.text,
          lang: utterance.lang,
          error: e.error || 'speech_error',
          time: Date.now(),
        });
        if (oldOnError) oldOnError.call(utterance, e);
      };

      return origSpeak(utterance);
    };

    window.speechSynthesis.cancel = function () {
      window.__recordSpeechEvent({
        type: 'cancel',
        time: Date.now(),
      });
      return origCancel();
    };
  });

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('[VOICE]')) {
      console.log(`BROWSER ${text}`);
    }
  });

  console.log(`[NAVIGATE] Opening ${APP_URL}...`);
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(2500);

  // -------------------------------------------------------------
  // TEST 1: Inspect Native Browser Voices & Availability
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Browser Speech Synthesis & Native Voice Inspection ---');
  const voiceInfo = await page.evaluate(() => {
    const voices = window.speechSynthesis.getVoices();
    return {
      hasSpeechSynthesis: typeof window.speechSynthesis !== 'undefined',
      voiceCount: voices.length,
      sampleVoices: voices.slice(0, 10).map((v) => ({ name: v.name, lang: v.lang })),
      teVoices: voices.filter((v) => v.lang.toLowerCase().includes('te') || v.name.toLowerCase().includes('geeta')).map((v) => ({ name: v.name, lang: v.lang })),
      hiVoices: voices.filter((v) => v.lang.toLowerCase().includes('hi') || v.name.toLowerCase().includes('lekha')).map((v) => ({ name: v.name, lang: v.lang })),
      taVoices: voices.filter((v) => v.lang.toLowerCase().includes('ta') || v.name.toLowerCase().includes('vani')).map((v) => ({ name: v.name, lang: v.lang })),
      knVoices: voices.filter((v) => v.lang.toLowerCase().includes('kn') || v.name.toLowerCase().includes('soumya')).map((v) => ({ name: v.name, lang: v.lang })),
      enVoices: voices.filter((v) => v.lang.toLowerCase().includes('en-us') || v.lang.toLowerCase().includes('en-in')).map((v) => ({ name: v.name, lang: v.lang })),
    };
  });

  console.log(`[TEST 1] window.speechSynthesis available: ${voiceInfo.hasSpeechSynthesis}`);
  console.log(`[TEST 1] Total browser voices installed: ${voiceInfo.voiceCount}`);
  console.log(`[TEST 1] Telugu (te-IN) voices:`, voiceInfo.teVoices);
  console.log(`[TEST 1] Hindi (hi-IN) voices:`, voiceInfo.hiVoices);
  console.log(`[TEST 1] Tamil (ta-IN) voices:`, voiceInfo.taVoices);
  console.log(`[TEST 1] Kannada (kn-IN) voices:`, voiceInfo.knVoices);
  console.log(`[TEST 1] English sample voices:`, voiceInfo.enVoices.slice(0, 3));

  // -------------------------------------------------------------
  // TEST 2: Voice Diagnostics HUD Visibility & Telemetry
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Voice Diagnostics HUD UI Presence ---');
  const hudVisible = await page.$('#roadrisk-voice-diagnostics-bar');
  console.log(`[TEST 2] Voice Diagnostics Bar rendered: ${hudVisible ? 'PASS' : 'FAIL'}`);

  // -------------------------------------------------------------
  // TEST 3: Standalone Audible Test Button across all 5 Languages
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Standalone Audible Test Across 5 Languages ---');
  const languagesToTest = [
    { code: 'en', btnId: '#voice-lang-btn-en', name: 'English' },
    { code: 'te', btnId: '#voice-lang-btn-te', name: 'Telugu' },
    { code: 'hi', btnId: '#voice-lang-btn-hi', name: 'Hindi' },
    { code: 'ta', btnId: '#voice-lang-btn-ta', name: 'Tamil' },
    { code: 'kn', btnId: '#voice-lang-btn-kn', name: 'Kannada' },
  ];

  const standaloneResults = [];

  for (const lang of languagesToTest) {
    const eventsBefore = voiceEvents.length;
    console.log(`[TEST 3] Testing language: ${lang.name} (${lang.code})...`);
    await page.click(lang.btnId);
    await sleep(2500);

    const relevant = voiceEvents.slice(eventsBefore);
    const hasSpeak = relevant.some((e) => e.type === 'speak');
    const hasOnStart = relevant.some((e) => e.type === 'onstart');
    const hasOnEnd = relevant.some((e) => e.type === 'onend');
    const speakEntry = relevant.find((e) => e.type === 'speak');

    console.log(`[TEST 3] ${lang.name}: speak=${hasSpeak}, onstart=${hasOnStart}, onend=${hasOnEnd}, voice="${speakEntry?.voiceName}"`);
    standaloneResults.push({
      language: lang.name,
      code: lang.code,
      passed: hasSpeak && hasOnStart,
      voiceName: speakEntry?.voiceName,
      text: speakEntry?.text,
    });
  }

  // -------------------------------------------------------------
  // TEST 4: Calculate Route and Test "Directions" & "Start Navigation"
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Destination Search & Route Guidance ---');
  const searchInput = await page.waitForSelector(
    '#roadrisk-destination-input, input.destination-input, input[placeholder*="Where do you want to go"], input[placeholder*="Search"]',
    { timeout: 15000 }
  );

  if (searchInput) {
    await searchInput.click();
    await searchInput.type('Hyderabad', { delay: 50 });
    await sleep(3000);

    const firstResult = await page.waitForSelector('.search-result-item', { timeout: 8000 }).catch(() => null);
    if (firstResult) {
      console.log(`[TEST 4] Selecting first search result...`);
      await firstResult.click();
      await sleep(4500);
    }
  }

  // Check if routes are ready
  const startBtn = await page.waitForSelector('#roadrisk-start-navigation-btn, .start-navigation-btn', { timeout: 8000 }).catch(() => null);
  const directionsBtn = await page.waitForSelector('#roadrisk-directions-btn', { timeout: 8000 }).catch(() => null);
  console.log(`[TEST 4] Start Navigation button ready: ${startBtn ? 'YES' : 'NO'}`);
  console.log(`[TEST 4] Directions button ready: ${directionsBtn ? 'YES' : 'NO'}`);

  // Test "Directions" button immediate maneuver speech
  console.log('\n--- TEST 5: Directions Button Immediate Speech Activation ---');
  if (directionsBtn) {
    const directionsEventsBefore = voiceEvents.length;
    const dirT0 = Date.now();
    await directionsBtn.click();
    await sleep(3000);

    const dirEvents = voiceEvents.slice(directionsEventsBefore);
    const dirSpeak = dirEvents.find((e) => e.type === 'speak');
    const dirStart = dirEvents.find((e) => e.type === 'onstart');

    console.log(`[TEST 5] Directions button clicked.`);
    console.log(`[TEST 5] Speech requested: ${dirSpeak ? 'YES' : 'NO'} ("${dirSpeak?.text}")`);
    console.log(`[TEST 5] Speech onstart fired: ${dirStart ? 'YES' : 'NO'}`);
    if (dirSpeak && dirStart) {
      console.log(`[TEST 5] Directions Latency: T1-T0 = ${dirSpeak.time - dirT0}ms, T2-T0 = ${dirStart.time - dirT0}ms`);
    }
  } else {
    console.warn(`[TEST 5] Directions button not available.`);
  }

  // Close directions drawer if open
  await page.evaluate(() => {
    const closeBtn = document.querySelector('.directions-panel-close-btn');
    if (closeBtn) closeBtn.click();
  });
  await sleep(1000);

  // -------------------------------------------------------------
  // TEST 6: Ten-Times Consecutive Directions / Start Navigation Test (Section 29)
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Ten-Times Directions / Start Navigation Test ---');
  const tenRuns = [];

  for (let i = 1; i <= 10; i++) {
    // Stop navigation if running from previous iteration
    await page.evaluate(() => {
      const endBtn = document.querySelector('#roadrisk-end-navigation-btn, .end-navigation-btn');
      if (endBtn) endBtn.click();
    });
    await sleep(600);

    const runStartEvents = voiceEvents.length;
    const t0 = Date.now();

    // Click Start Navigation (or Directions)
    const navBtn = await page.waitForSelector('#roadrisk-start-navigation-btn, .start-navigation-btn', { timeout: 3000 }).catch(() => null);
    if (navBtn) {
      await navBtn.click();
    } else {
      const dBtn = await page.$('#roadrisk-directions-btn');
      if (dBtn) await dBtn.click();
    }

    // Wait for utterance start
    let started = false;
    let ended = false;
    let t1 = 0;
    let t2 = 0;
    let spokenText = '';

    for (let check = 0; check < 30; check++) {
      await sleep(100);
      const newEvts = voiceEvents.slice(runStartEvents);
      const spk = newEvts.find((e) => e.type === 'speak');
      const st = newEvts.find((e) => e.type === 'onstart');
      const en = newEvts.find((e) => e.type === 'onend');

      if (spk && !t1) {
        t1 = spk.time;
        spokenText = spk.text;
      }
      if (st && !t2) {
        t2 = st.time;
        started = true;
      }
      if (en) {
        ended = true;
        break;
      }
    }

    const runData = {
      run: i,
      speechRequested: Boolean(t1),
      speechStarted: started,
      requestLatencyMs: t1 ? t1 - t0 : null,
      onstartLatencyMs: t2 ? t2 - t0 : null,
      textSample: spokenText.substring(0, 45),
      passed: started,
    };
    tenRuns.push(runData);
    console.log(`[TEST 6] Run #${i}/10: Requested=${runData.speechRequested}, Started=${runData.speechStarted}, Latency T2-T0=${runData.onstartLatencyMs}ms ("${runData.textSample}")`);

    // Let voice speak for a moment before next cycle
    await sleep(1200);
  }

  // -------------------------------------------------------------
  // TEST 7: Speech Cancellation on Navigation Stop
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Speech Cancellation on Navigation Stop ---');
  // Make sure navigation is active and speaking
  await page.evaluate(() => {
    const startBtn = document.querySelector('#roadrisk-start-navigation-btn, .start-navigation-btn');
    if (startBtn) startBtn.click();
  });
  await sleep(400);

  const cancelEventsBefore = voiceEvents.length;
  await page.evaluate(() => {
    const endBtn = document.querySelector('#roadrisk-end-navigation-btn, .end-navigation-btn');
    if (endBtn) endBtn.click();
  });
  await sleep(600);

  const cancelEvts = voiceEvents.slice(cancelEventsBefore);
  const hasCancel = cancelEvts.some((e) => e.type === 'cancel');
  console.log(`[TEST 7] Speech cancellation triggered on Stop Navigation: ${hasCancel ? 'PASS' : 'FAIL'}`);

  // Screenshot capture
  const screenshotPath = path.join(EVIDENCE_DIR, 'roadrisk-voice-diagnostics-verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`[EVIDENCE] Screenshot saved to: ${screenshotPath}`);

  await browser.close();

  // -------------------------------------------------------------
  // RESULTS SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 FINAL VOICE TEST RESULTS MATRIX                ');
  console.log('================================================================');
  console.table(standaloneResults);
  console.table(tenRuns);

  const tenRunsPassed = tenRuns.filter((r) => r.passed).length;
  console.log(`\nTen-Times Consecutive Directions Test: ${tenRunsPassed}/10 Passed.`);

  const summary = {
    timestamp: new Date().toISOString(),
    totalVoices: voiceInfo.voiceCount,
    standaloneResults,
    tenRuns,
    tenRunsPassed,
    hasCancel,
    voiceErrorsCount: voiceErrors.length,
    voiceErrors,
  };

  fs.writeFileSync('docs/evidence/voice-verification-summary.json', JSON.stringify(summary, null, 2));
  console.log('Full summary written to docs/evidence/voice-verification-summary.json');
}

runVoiceVerification().catch((err) => {
  console.error('[FATAL] Voice verification test encountered error:', err);
  process.exit(1);
});
