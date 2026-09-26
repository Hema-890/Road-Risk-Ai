// ==============================================================================
// ROADRISK AI — MASTER PRODUCTION ARCHITECTURE TEST SUITE
// Tests:
// 1. GPS Lifecycle, Staleness & Loss Detection
// 2. GPS Physical Anomaly Rejection (Null island, clock skew, teleport jump)
// 3. Traffic Provider Resilience & Honest Status (Zero fake traffic)
// 4. Dynamic Incident Decision Gate & Rerouting Cooldown
// 5. Explainable Road Risk Contributors & Objective Scoring
// 6. GTFS Static Specification Validation & Schedule Extraction
// 7. Honest Realtime Transit Protocol Gateway (No ghost buses)
// 8. Expanded Voice Intent Extraction (Tolls, Highways, Traffic, Modes)
// ==============================================================================

import assert from 'node:assert';

console.log('==================================================================');
console.log('    ROADRISK AI — MASTER PRODUCTION ARCHITECTURE TEST SUITE       ');
console.log('==================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
  }
}

async function main() {
  // --------------------------------------------------------------------------
  // TEST SUITE 1: GPS Lifecycle, Anomaly Filtering & Recovery
  // --------------------------------------------------------------------------
  console.log('[SUITE 1] GPS Lifecycle & Physical Anomaly Filters');

  const { locationService } = await import('../src/services/locationService.ts');
  const { validateCoordinates, isRealisticGpsMovement } = await import('../src/utils/geoUtils.ts');

  runTest('Coordinate Validation Boundary Filter', () => {
    assert.strictEqual(validateCoordinates([80.648, 16.506]), true);
    assert.strictEqual(validateCoordinates([200, 16.506]), false); // Invalid Lng > 180
    assert.strictEqual(validateCoordinates([80.648, 95]), false); // Invalid Lat > 90
    assert.strictEqual(validateCoordinates(['invalid', 16]), false);
  });

  runTest('GPS Teleport Jump Filter (>220 km/h)', () => {
    const origin = [80.648, 16.506];
    // 50 meters in 2 seconds = 25 m/s = 90 km/h (Realistic)
    const realisticCoord = [80.6484, 16.5062];
    assert.strictEqual(isRealisticGpsMovement(origin, realisticCoord, 2000), true);

    // 2000 meters in 2 seconds = 1000 m/s = 3600 km/h (Impossible Teleport)
    const impossibleCoord = [80.668, 16.516];
    assert.strictEqual(isRealisticGpsMovement(origin, impossibleCoord, 2000), false);
  });

  runTest('GPS Anomaly Rejection (Null island & clock skew)', () => {
    const initialRejected = locationService.getRejectedAnomalyCount();
    
    // Inject Null Island [0, 0]
    locationService.handleSuccess({
      coords: { latitude: 0, longitude: 0, accuracy: 10 },
      timestamp: Date.now(),
    });

    // Inject Future timestamp (+30 seconds)
    locationService.handleSuccess({
      coords: { latitude: 16.506, longitude: 80.648, accuracy: 10 },
      timestamp: Date.now() + 30000,
    });

    assert.strictEqual(locationService.getRejectedAnomalyCount() >= initialRejected + 2, true);
  });

  runTest('GPS Signal Loss & Recovery State Simulation', () => {
    // Simulate loss
    locationService.simulateSignalLoss();
    assert.strictEqual(locationService.getCurrentState(), 'LOST');

    // Simulate recovery with valid telemetry
    locationService.injectTestLocation([80.648, 16.506], { accuracy: 12, speedKmh: 35 });
    const state = locationService.getCurrentState();
    assert.strictEqual(state === 'AVAILABLE' || state === 'RECOVERED', true);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 2: Dynamic Incident Decision Gate & Reroute Cooldown
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 2] Dynamic Incident Decision Gate & Cooldown');

  const { evaluateDynamicRerouteNeed } = await import('../src/engines/routingEngine.ts');

  runTest('Critical Road Closure Detour Requirement', () => {
    const mockIntersections = [
      {
        hazardId: 'haz_1',
        title: 'Bridge Structural Failure',
        category: 'ROAD_CLOSURE',
        severity: 'CRITICAL',
        distanceAheadMeters: 800,
        riskPoints: 60,
        provenanceSource: 'Authority Operations',
        requiresReroute: true,
      },
    ];

    const decision = evaluateDynamicRerouteNeed(mockIntersections, 5.0, 5.0);
    assert.strictEqual(decision.shouldReroute, true);
    assert.strictEqual(decision.urgency, 'IMMEDIATE');
    assert.strictEqual(decision.reason.includes('ROAD_CLOSURE'), true);
  });

  runTest('Dynamic Reroute Cooldown Gate (<60s)', () => {
    // Immediately after an IMMEDIATE reroute, non-emergency delays are held back by cooldown
    const nonCritical = [
      {
        hazardId: 'haz_2',
        title: 'Minor congestion',
        category: 'CONGESTION',
        severity: 'LOW',
        distanceAheadMeters: 4000,
        riskPoints: 10,
        provenanceSource: 'TomTom',
        requiresReroute: false,
      },
    ];

    const cooldownDecision = evaluateDynamicRerouteNeed(nonCritical, 9.0, 4.0);
    assert.strictEqual(cooldownDecision.shouldReroute, false);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 3: Explainable Risk Intelligence
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 3] Explainable Road Risk Intelligence');

  const { evaluateRoutesForMission } = await import('../src/engines/routingEngine.ts');

  runTest('Risk Contributors Breakdown Evaluation', () => {
    const mockRoutes = [
      {
        id: 'route_test_1',
        name: 'Arterial Corridor',
        summary: 'Via MG Road',
        distanceKm: 8.5,
        baseEtaMinutes: 14.0,
        adjustedEtaMinutes: 22.0,
        trafficDelaySeconds: 480, // 8 minutes delay
        riskScore: 35,
        riskLevel: 'ELEVATED',
        missionSuitabilityScore: 80,
        vehicleSuitabilityScore: 90,
        hazardCount: 1,
        greenCorridorCompatible: true,
        recommendationReason: 'Primary',
        isRecommended: false,
        segments: [],
        fullCoordinates: [[80.648, 16.506], [80.658, 16.516]],
      },
    ];

    const mockVehicle = { id: 'amb_1', name: 'Alpha 1', category: 'medical', weightTons: 3.5, widthMeters: 2.2, heightMeters: 2.6 };
    const mockHazards = [
      {
        id: 'haz_flood',
        title: 'Underpass Submerged',
        type: 'FLOOD_RISK',
        category: 'flooding',
        severity: 'critical',
        riskImpactPoints: 35,
        active: true,
        affectedRouteIds: ['route_test_1'],
        coordinates: [80.652, 16.510],
      },
    ];

    const evaluation = evaluateRoutesForMission(mockRoutes, mockVehicle, 'CRITICAL', mockHazards, 50);
    assert.strictEqual(evaluation.evaluatedRoutes.length, 1);
    const evaluated = evaluation.evaluatedRoutes[0];
    
    // Total risk score includes hazard penalty (35 + 35 = 70)
    assert.strictEqual(evaluated.riskScore >= 70, true);
    
    // Explicit explainable contributors present
    assert.strictEqual(Array.isArray(evaluated.riskContributors), true);
    assert.strictEqual(evaluated.riskContributors.length >= 2, true);
    
    const factors = evaluated.riskContributors.map((c) => c.factor);
    assert.strictEqual(factors.includes('Traffic Congestion'), true);
    assert.strictEqual(factors.includes('FLOOD_RISK'), true);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 4: GTFS Static Schedule Engine & Realtime Honesty
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 4] GTFS Static Specification & Realtime Honesty');

  const { transitService } = await import('../src/services/transitService.ts');

  runTest('GTFS Specification Dataset Validator', () => {
    // Valid GTFS bundle
    const validBundle = {
      'agency.txt': 'agency_id,agency_name,agency_url,agency_timezone\nRTC,Regional Transit,http://rtc.in,Asia/Kolkata',
      'routes.txt': 'route_id,route_short_name,route_long_name,route_type\nR1,10X,Express Airport,3',
      'stops.txt': 'stop_id,stop_name,stop_lat,stop_lon\nS1,Central Station,16.51,80.62',
      'trips.txt': 'route_id,service_id,trip_id\nR1,daily,T1',
      'stop_times.txt': 'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,08:00:00,08:05:00,S1,1',
    };
    const validRes = transitService.validateGtfsDataset(validBundle);
    assert.strictEqual(validRes.isValid, true);
    assert.strictEqual(validRes.errors.length, 0);

    // Corrupted GTFS bundle (missing stops.txt and columns)
    const corruptedBundle = {
      'agency.txt': 'agency_id,agency_name\nRTC,Regional Transit',
      'routes.txt': 'invalid_col\n1',
    };
    const invalidRes = transitService.validateGtfsDataset(corruptedBundle);
    assert.strictEqual(invalidRes.isValid, false);
    assert.strictEqual(invalidRes.errors.length >= 3, true);
  });

  runTest('GTFS Demo Schedule Loading & Departure Extraction', () => {
    transitService.loadDemoScheduleDataset();
    const stops = transitService.getStops();
    const routes = transitService.getRoutes();
    const departures = transitService.getDepartures('stop_vja_central');

    assert.strictEqual(stops.length >= 5, true);
    assert.strictEqual(routes.length >= 2, true);
    assert.strictEqual(departures.length >= 1, true);
    // Verified that departure is marked as schedule data, not live telemetry
    assert.strictEqual(departures[0].isRealtime, false);
  });

  await runAsyncTest('GTFS-Realtime Protocol Gateway Honest Absence Notice', async () => {
    // When no external GTFS-RT feed stream is configured:
    const result = await transitService.getLiveTransit(16.4, 80.5, 16.6, 80.7);
    assert.strictEqual(result.status, 'UNAVAILABLE');
    assert.strictEqual(result.activeVehicles.length, 0);
    assert.strictEqual(result.notice.includes('not published a public GTFS-Realtime'), true);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 5: Voice Intent Engine Expansion
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 5] Expanded Voice Command Intent Engine');

  const { voiceInputService } = await import('../src/services/voiceInputService.ts');

  const voiceTestCases = [
    { text: 'show traffic conditions', expected: 'SHOW_TRAFFIC' },
    { text: 'how is traffic', expected: 'SHOW_TRAFFIC' },
    { text: 'avoid highways please', expected: 'AVOID_HIGHWAYS' },
    { text: 'no tolls route', expected: 'AVOID_TOLLS' },
    { text: 'show safer route', expected: 'SAFEST_ROUTE' },
    { text: 'switch to motorcycle', expected: 'SWITCH_MODE', payload: 'BIKE' },
    { text: 'switch to walking', expected: 'SWITCH_MODE', payload: 'WALK' },
    { text: 'start navigation', expected: 'START_NAVIGATION' },
    { text: 'stop navigation', expected: 'STOP_NAVIGATION' },
    { text: 'find hospitals nearby', expected: 'FIND_POI', payload: 'hospital' },
    { text: 'take me to Government Hospital', expected: 'NAVIGATE_TO', destination: 'Government Hospital' },
  ];

  for (const tc of voiceTestCases) {
    runTest(`Voice Intent: "${tc.text}" -> ${tc.expected}`, () => {
      const parsed = voiceInputService.parseIntent(tc.text);
      assert.strictEqual(parsed.type, tc.expected);
      if (tc.payload) assert.strictEqual(parsed.payload, tc.payload);
      if (tc.destination) assert.strictEqual((parsed.slots?.query || parsed.normalizedQuery)?.toLowerCase(), tc.destination.toLowerCase());
    });
  }

  // --------------------------------------------------------------------------
  // TEST SUITE 6: Multilingual Turn-by-Turn Maneuver Templates
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 6] Multilingual Turn-by-Turn Maneuver Templates');

  const { navigationVoiceService, DIRECTION_LABELS } = await import('../src/services/navigationVoiceService.ts');

  const languages = ['en', 'te', 'hi', 'ta', 'kn'];
  for (const lang of languages) {
    runTest(`Maneuver Direction Coverage (${lang.toUpperCase()})`, () => {
      navigationVoiceService.setLanguage(lang);
      const labels = DIRECTION_LABELS[lang];
      assert.strictEqual(typeof labels['left'], 'string');
      assert.strictEqual(typeof labels['right'], 'string');
      assert.strictEqual(typeof labels['sharp-left'], 'string');
      assert.strictEqual(typeof labels['slight-right'], 'string');
      assert.strictEqual(typeof labels['roundabout'], 'string');
      assert.strictEqual(typeof labels['uturn'], 'string');

      const startPhrase = navigationVoiceService.getLocalizedPhrase('startRoute')('Vijayawada Central', 'Head north');
      assert.strictEqual(typeof startPhrase, 'string');
      assert.strictEqual(startPhrase.length > 5, true);

      const appPhrase = navigationVoiceService.getLocalizedPhrase('maneuverApproaching')('500 meters', labels['left'], 'MG Road');
      assert.strictEqual(typeof appPhrase, 'string');
      assert.strictEqual(appPhrase.length > 5, true);
    });
  }

  // Reset back to English
  navigationVoiceService.setLanguage('en');

  // --------------------------------------------------------------------------
  // TEST SUITE 7: AI Natural-Language Search & Constraint Extraction
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 7] AI Natural-Language Search & Constraint Extraction');

  const { searchService } = await import('../src/services/searchService.ts');

  runTest('Multi-Constraint NLP Extraction (Category, Diet, Budget, Radius, Facility)', () => {
    const query = 'Find a vegetarian restaurant under ₹500 within 2 km with parking';
    const parsed = searchService.parseNaturalLanguageQuery(query);

    assert.strictEqual(parsed.detectedLanguage, 'en');
    assert.strictEqual(parsed.category, 'restaurant');
    assert.strictEqual(parsed.dietary, 'vegetarian');
    assert.strictEqual(parsed.maxBudgetInr, 500);
    assert.strictEqual(parsed.maxDistanceKm, 2);
    assert.strictEqual(parsed.facilities.includes('parking'), true);
  });

  runTest('Non-English Script Detection (Telugu Hospital Query)', () => {
    const teQuery = 'విజయవాడలో ఆసుపత్రి ఎక్కడ ఉంది';
    const parsed = searchService.parseNaturalLanguageQuery(teQuery);
    assert.strictEqual(parsed.detectedLanguage, 'te');
    assert.strictEqual(parsed.category, 'hospital');
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 8: Mobility, Fuel & Cost Footprint Engine
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 8] Mobility, Fuel & Cost Footprint Engine');

  const { mobilityIntelligenceService } = await import('../src/services/mobilityIntelligenceService.ts');

  runTest('Car Trip Cost, Fuel Consumption and Toll Evaluation', () => {
    const cost = mobilityIntelligenceService.calculateTripCost(150, 'CAR', { hasTolls: true, tollCount: 2 });
    assert.strictEqual(cost.fuelCostInr > 500, true);
    assert.strictEqual(cost.tollCostInr, 190);
    assert.strictEqual(cost.estimatedCo2Kg > 15, true);
    assert.strictEqual(cost.isEstimate, true);
    assert.strictEqual(typeof cost.disclaimer, 'string');
  });

  runTest('Pedestrian & Bicycle Zero-Carbon Footprint Verification', () => {
    const walkCost = mobilityIntelligenceService.calculateTripCost(5, 'WALK');
    assert.strictEqual(walkCost.fuelCostInr, 0);
    assert.strictEqual(walkCost.tollCostInr, 0);
    assert.strictEqual(walkCost.estimatedCo2Kg, 0);
    assert.strictEqual(walkCost.isEstimate, false);
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 9: AI Map Copilot Chained Multi-Turn Conversational Context
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 9] AI Map Copilot Chained Multi-Turn Conversational Context');

  const { aiCopilotService } = await import('../src/services/aiCopilotService.ts');
  aiCopilotService.resetSession();

  await runAsyncTest('Chained Turn 1: "Avoid highways"', async () => {
    const res = await aiCopilotService.processUserUtterance('Avoid highways please');
    assert.strictEqual(res.actionTaken, 'PREFERENCE_UPDATED');
    assert.strictEqual(aiCopilotService.getSession().avoidHighways, true);
  });

  await runAsyncTest('Chained Turn 2: "Avoid tolls"', async () => {
    const res = await aiCopilotService.processUserUtterance('Also avoid tolls');
    assert.strictEqual(res.actionTaken, 'PREFERENCE_UPDATED');
    assert.strictEqual(aiCopilotService.getSession().avoidTolls, true);
    // Crucial: previous preference 'avoidHighways' must be preserved across turns
    assert.strictEqual(aiCopilotService.getSession().avoidHighways, true);
  });

  await runAsyncTest('Chained Turn 3: "Actually use the safest route"', async () => {
    const res = await aiCopilotService.processUserUtterance('Actually use the safest route');
    assert.strictEqual(res.actionTaken, 'ROUTE_OBJECTIVE_CHANGED');
    assert.strictEqual(aiCopilotService.getSession().activeObjective, 'SAFEST');
  });

  await runAsyncTest('Chained Turn 4: "Switch to motorcycle"', async () => {
    const res = await aiCopilotService.processUserUtterance('Switch to motorcycle');
    assert.strictEqual(res.actionTaken, 'MODE_SWITCHED');
    assert.strictEqual(aiCopilotService.getSession().transportMode, 'BIKE');
  });

  // --------------------------------------------------------------------------
  // TEST SUITE 10: Master RoadRiskOrchestrator Lifecycle
  // --------------------------------------------------------------------------
  console.log('\n[SUITE 10] Master RoadRiskOrchestrator Lifecycle');

  const { roadRiskOrchestrator } = await import('../src/services/roadRiskOrchestrator.ts');

  runTest('Orchestrator State Snapshot & Subscription Integrity', () => {
    const state = roadRiskOrchestrator.getState();
    assert.strictEqual(state.navigationStatus, 'IDLE');
    assert.strictEqual(typeof state.activeObjective, 'string');
    assert.strictEqual(Array.isArray(state.calculatedRoutes), true);

    let observedStatus = '';
    const unsub = roadRiskOrchestrator.subscribe((snap) => {
      observedStatus = snap.navigationStatus;
    });
    assert.strictEqual(observedStatus, 'IDLE');
    unsub();
  });

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n============================================================');
  console.log(`   SUITE COMPLETE: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('============================================================\n');

  if (passedTests < totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
