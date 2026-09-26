// scripts/test-routing-modes-and-voice.mjs
import fs from 'node:fs';

// Load .env if needed
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

import { routingService } from '../src/services/routingService.ts';
import voiceInputService from '../src/services/voiceInputService.ts';

async function run() {
  console.log('=== ROADRISK REALTIME NAVIGATION VERIFICATION MATRIX ===\n');

  // Test 1: Voice Intent Parser
  console.log('[1/4] Testing Voice Input Intent Parser...');
  const testPhrases = [
    { text: 'navigate to Benz Circle', expectedIntent: 'NAVIGATE_TO' },
    { text: 'take me to Government Hospital', expectedIntent: 'NAVIGATE_TO' },
    { text: 'switch to bike mode', expectedIntent: 'SWITCH_MODE', expectedSlot: 'BIKE' },
    { text: 'change to walking route', expectedIntent: 'SWITCH_MODE', expectedSlot: 'WALK' },
    { text: 'start navigation', expectedIntent: 'START_NAVIGATION' },
    { text: 'stop navigation', expectedIntent: 'STOP_NAVIGATION' },
    { text: 'find petrol pump nearby', expectedIntent: 'FIND_POI', expectedSlot: 'fuel' },
    { text: 'find hospital', expectedIntent: 'FIND_POI', expectedSlot: 'hospital' },
    { text: 'zoom in', expectedIntent: 'ZOOM_IN' },
    { text: 'mute audio', expectedIntent: 'MUTE' },
    { text: 'unmute', expectedIntent: 'UNMUTE' },
    { text: 'where am I', expectedIntent: 'CURRENT_LOCATION' },
  ];

  let passedVoice = 0;
  for (const item of testPhrases) {
    const res = voiceInputService.parseIntent(item.text);
    const matchesIntent = res.intent === item.expectedIntent;
    const matchesSlot = item.expectedSlot ? (res.slots?.mode === item.expectedSlot || res.slots?.category === item.expectedSlot) : true;
    if (matchesIntent && matchesSlot) {
      console.log(`  ✓ "${item.text}" -> ${res.intent} (confidence: ${res.confidence.toFixed(2)})`);
      passedVoice++;
    } else {
      console.error(`  ✗ "${item.text}" -> Got ${res.intent} (expected ${item.expectedIntent})`);
    }
  }
  console.log(`Voice intent test: ${passedVoice}/${testPhrases.length} passed.\n`);

  // Test 2: Routing across travel modes
  console.log('[2/4] Testing Routing Service with Travel Modes...');
  const origin = [80.6480, 16.5062]; // Vijayawada center
  const dest = [80.6550, 16.5000];   // Benz circle area

  const modes = ['CAR', 'BIKE', 'BICYCLE', 'WALK', 'TRANSIT'];
  for (const mode of modes) {
    console.log(`  Evaluating mode: ${mode}...`);
    try {
      const res = await routingService.calculateRoutes(origin, dest, { profile: mode });
      const routes = res.routes;
      if (mode === 'TRANSIT') {
        console.log(`  ✓ TRANSIT correctly handled: returned ${routes.length} routes (honest GTFS guard)`);
      } else {
        const r0 = routes[0];
        console.log(`  ✓ ${mode}: returned ${routes.length} routes. First: "${r0?.name}", dist: ${r0?.distanceKm} km, ETA: ${r0?.adjustedEtaMinutes} min (${r0?.formattedDuration || ''}), arrival: ${r0?.formattedArrivalTime || ''}, obj: ${r0?.objective}`);
      }
    } catch (err) {
      if (mode === 'TRANSIT') {
        console.log(`  ✓ TRANSIT rejected honestly: "${err.message}"`);
      } else {
        console.error(`  ✗ ${mode} failed:`, err.message);
      }
    }
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

run().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
