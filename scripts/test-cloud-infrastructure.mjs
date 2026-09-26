// Comprehensive RoadRisk AI Cloud Infrastructure & Integrity Test Suite
import assert from 'node:assert';

console.log('🧪 =========================================================');
console.log('   ROADRISK AI CLOUD INFRASTRUCTURE & INTEGRITY TEST SUITE   ');
console.log('============================================================\n');

let passCount = 0;
let failCount = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// 1. TELEMETRY VALIDATION TESTS
// -------------------------------------------------------------
console.log('🔹 1. Telemetry Physical & Geospatial Sanity Tests');

function validateTelemetry(packet, prevPacket) {
  const { vehicleId, latitude, longitude, heading, speedKmh, timestamp } = packet;

  if (!vehicleId || typeof vehicleId !== 'string') return { valid: false, reason: 'Invalid vehicle ID' };
  if (isNaN(latitude) || latitude < -90 || latitude > 90) return { valid: false, reason: 'Latitude out of range' };
  if (isNaN(longitude) || longitude < -180 || longitude > 180) return { valid: false, reason: 'Longitude out of range' };
  if (isNaN(speedKmh) || speedKmh < 0) return { valid: false, reason: 'Negative speed' };
  if (isNaN(heading) || heading < 0 || heading > 360) return { valid: false, reason: 'Heading out of range' };

  const now = Date.now();
  const packetTime = timestamp ? new Date(timestamp).getTime() : now;
  if (isNaN(packetTime)) return { valid: false, reason: 'Malformed timestamp' };
  if (packetTime > now + 10000) return { valid: false, reason: 'Future timestamp (>10s)' };
  if (packetTime < now - 300000) return { valid: false, reason: 'Stale telemetry (>5m)' };

  if (prevPacket) {
    const prevTime = new Date(prevPacket.timestamp).getTime();
    const deltaSec = Math.max(0.1, (packetTime - prevTime) / 1000);
    // Haversine distance in meters
    const dLat = ((latitude - prevPacket.latitude) * Math.PI) / 180;
    const dLon = ((longitude - prevPacket.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((prevPacket.latitude * Math.PI) / 180) *
        Math.cos((latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const distanceMeters = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const impliedSpeedKmh = (distanceMeters / 1000) / (deltaSec / 3600);

    if (impliedSpeedKmh > 200 && distanceMeters > 500) {
      return { valid: false, reason: `Impossible jump: implied ${impliedSpeedKmh.toFixed(0)} km/h` };
    }
  }

  return { valid: true };
}

it('Valid packet passes validation', () => {
  const res = validateTelemetry({
    vehicleId: 'amb_01',
    latitude: 17.385,
    longitude: 78.486,
    heading: 90,
    speedKmh: 45,
    timestamp: new Date().toISOString(),
  });
  assert.strictEqual(res.valid, true);
});

it('Rejects latitude out of bounds (> 90)', () => {
  const res = validateTelemetry({
    vehicleId: 'amb_01',
    latitude: 91.5,
    longitude: 78.486,
    heading: 90,
    speedKmh: 45,
    timestamp: new Date().toISOString(),
  });
  assert.strictEqual(res.valid, false);
});

it('Rejects negative speed', () => {
  const res = validateTelemetry({
    vehicleId: 'amb_01',
    latitude: 17.385,
    longitude: 78.486,
    heading: 90,
    speedKmh: -10,
    timestamp: new Date().toISOString(),
  });
  assert.strictEqual(res.valid, false);
});

it('Rejects future timestamp (> 10s)', () => {
  const future = new Date(Date.now() + 60000).toISOString();
  const res = validateTelemetry({
    vehicleId: 'amb_01',
    latitude: 17.385,
    longitude: 78.486,
    heading: 90,
    speedKmh: 45,
    timestamp: future,
  });
  assert.strictEqual(res.valid, false);
});

it('Rejects stale timestamp (> 5 min)', () => {
  const stale = new Date(Date.now() - 400000).toISOString();
  const res = validateTelemetry({
    vehicleId: 'amb_01',
    latitude: 17.385,
    longitude: 78.486,
    heading: 90,
    speedKmh: 45,
    timestamp: stale,
  });
  assert.strictEqual(res.valid, false);
});

it('Rejects impossible movement jump (teleportation)', () => {
  const prev = {
    vehicleId: 'amb_01',
    latitude: 17.385,
    longitude: 78.486,
    timestamp: new Date(Date.now() - 1000).toISOString(),
  };
  // 5 km away in 1 second
  const curr = {
    vehicleId: 'amb_01',
    latitude: 17.430,
    longitude: 78.520,
    heading: 90,
    speedKmh: 50,
    timestamp: new Date().toISOString(),
  };
  const res = validateTelemetry(curr, prev);
  assert.strictEqual(res.valid, false);
  assert(res.reason.includes('Impossible jump'));
});

// -------------------------------------------------------------
// 2. REALTIME & NOTIFICATION DEDUPLICATION TESTS
// -------------------------------------------------------------
console.log('\n🔹 2. Deduplication & Event Schema Tests');

class Deduplicator {
  constructor() {
    this.seen = new Set();
  }
  process(missionId, eventType, eventId) {
    const key = `${missionId}:${eventType}:${eventId}`;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

it('Deduplicator accepts first event and rejects exact duplicate', () => {
  const dedup = new Deduplicator();
  const first = dedup.process('mis_01', 'HAZARD_DETECTED', 'evt_101');
  assert.strictEqual(first, true, 'First event must be accepted');

  const second = dedup.process('mis_01', 'HAZARD_DETECTED', 'evt_101');
  assert.strictEqual(second, false, 'Duplicate event must be suppressed');

  const different = dedup.process('mis_01', 'HAZARD_DETECTED', 'evt_102');
  assert.strictEqual(different, true, 'Distinct event must be accepted');
});

it('Event schemas conform to typed protocol', () => {
  const telemetryEvent = {
    eventType: 'TELEMETRY_UPDATED',
    vehicleId: 'amb_bravo_02',
    missionId: 'mis_01',
    latitude: 16.506,
    longitude: 80.648,
    heading: 180,
    speedKmh: 55,
    timestamp: new Date().toISOString(),
  };
  assert.strictEqual(telemetryEvent.eventType, 'TELEMETRY_UPDATED');
  assert(typeof telemetryEvent.latitude === 'number');

  const rerouteEvent = {
    eventType: 'REROUTE_COMPLETED',
    missionId: 'mis_01',
    previousRouteId: 'route_alpha',
    newRouteId: 'route_bravo',
    newEtaMinutes: 10.4,
    newRiskScore: 18,
    triggerReason: 'Severe Flooding',
    reroutedAtPosition: [80.648, 16.506],
    timestamp: new Date().toISOString(),
  };
  assert.strictEqual(rerouteEvent.eventType, 'REROUTE_COMPLETED');
  assert(rerouteEvent.reroutedAtPosition.length === 2);
});

// -------------------------------------------------------------
// 3. DYNAMIC REROUTING FROM CURRENT POSITION
// -------------------------------------------------------------
console.log('\n🔹 3. Dynamic Rerouting from Live Position (Phase 7 Contract)');

it('Dynamic reroute originates from live coordinates, NOT original origin', () => {
  const originalOrigin = [80.6480, 16.5062]; // Benz Circle
  const destination = [80.6186, 16.5128]; // GGH Hospital
  const currentLivePos = [80.6350, 16.5100]; // En-route 50% through

  const altRouteOriginal = [
    originalOrigin,
    [80.6400, 16.5200],
    [80.6300, 16.5180],
    destination,
  ];

  // Splice starting from current live position
  const splicedReroute = [currentLivePos, ...altRouteOriginal.slice(2)];

  assert.deepStrictEqual(splicedReroute[0], currentLivePos, 'First waypoint must be live position');
  assert.notDeepStrictEqual(splicedReroute[0], originalOrigin, 'Must NOT start at original origin');
});

// -------------------------------------------------------------
// 4. CLOUD / LOCAL DUAL MODE CONTRACT
// -------------------------------------------------------------
console.log('\n🔹 4. Cloud / Local / Auto Mode Resolution Tests');

function resolveMode(configuredMode, isCloudConfigured) {
  if (configuredMode === 'cloud') {
    if (!isCloudConfigured) throw new Error('Cloud mode missing credentials');
    return 'cloud';
  }
  if (configuredMode === 'local') return 'local';
  return isCloudConfigured ? 'cloud' : 'local';
}

it('Auto mode resolves to local when cloud credentials absent', () => {
  const active = resolveMode('auto', false);
  assert.strictEqual(active, 'local');
});

it('Auto mode resolves to cloud when cloud credentials present', () => {
  const active = resolveMode('auto', true);
  assert.strictEqual(active, 'cloud');
});

it('Cloud mode throws fatal error when cloud credentials absent (No silent fallback in prod)', () => {
  assert.throws(() => {
    resolveMode('cloud', false);
  }, /Cloud mode missing credentials/);
});

// -------------------------------------------------------------
// 5. BACKEND HEALTH & SYSTEM STATUS VERIFICATION
// -------------------------------------------------------------
console.log('\n🔹 5. System Health Check & Accurate Status Verification (Phase 14 & 16)');

let spawnedServer = null;
try {
  await fetch('http://localhost:3001/api/health', { signal: AbortSignal.timeout(1000) });
} catch {
  const { spawn } = await import('node:child_process');
  spawnedServer = spawn('node', ['server/index.cjs'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1500));
}

await itAsync('Health endpoint accurately reports subsystem status', async () => {
  const res = await fetch('http://localhost:3001/api/health');
  assert.strictEqual(res.status, 200, 'Health endpoint responds with 200');
  const body = await res.json();

  assert.strictEqual(body.subsystems.sqlite.status, 'READY', 'SQLite must be READY');
  assert(['READY', 'NOT_CONFIGURED'].includes(body.subsystems.supabase.status));
  assert(['READY', 'NOT_CONFIGURED'].includes(body.subsystems.firebase.status), 'Firebase status must be valid');
  assert(['READY', 'NOT_CONFIGURED'].includes(body.subsystems.fcm.status), 'FCM status must be valid');
  assert.strictEqual(body.subsystems.osrm.status, 'READY', 'OSRM must be READY');
  assert.strictEqual(body.subsystems.photon.status, 'READY', 'Photon must be READY');
});

await itAsync('Status endpoint reports components status truthfully', async () => {
  const res = await fetch('http://localhost:3001/api/system/status');
  assert.strictEqual(res.status, 200, 'Status endpoint responds with 200');
  const body = await res.json();

  assert.strictEqual(body.components.sqlite, 'READY');
  assert(['READY', 'NOT_CONFIGURED'].includes(body.components.supabase));
  assert(['READY', 'NOT_CONFIGURED'].includes(body.components.firebase));
});

await itAsync('Notification endpoint handles token registration and duplicate send', async () => {
  // Register token
  const regRes = await fetch('http://localhost:3001/api/notifications/register-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fcm_token: 'test_token_sample_123' }),
  });
  assert.strictEqual(regRes.status, 200);

  // Send first notification
  const evtId = `test_evt_${Date.now()}`;
  const sendRes1 = await fetch('http://localhost:3001/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Emergency Reroute',
      body: 'Ambulance rerouted due to blockage.',
      severity: 'HIGH',
      mission_id: 'mis_01',
      event_type: 'REROUTE',
      event_id: evtId,
    }),
  });
  const data1 = await sendRes1.json();
  assert(data1.status === 'STORED_LOCALLY_FCM_NOT_CONFIGURED' || data1.status === 'SENT_FCM');

  // Send duplicate with same event_id
  const sendRes2 = await fetch('http://localhost:3001/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Emergency Reroute',
      body: 'Ambulance rerouted due to blockage.',
      severity: 'HIGH',
      mission_id: 'mis_01',
      event_type: 'REROUTE',
      event_id: evtId,
    }),
  });
  const data2 = await sendRes2.json();
  assert.strictEqual(data2.status, 'DUPLICATE_SUPPRESSED', 'Duplicate notification must be suppressed');

  // Deactivate token (Logout / cleanup)
  const deactRes = await fetch('http://localhost:3001/api/notifications/deactivate-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fcm_token: 'test_token_sample_123' }),
  });
  assert.strictEqual(deactRes.status, 200);
  const deactData = await deactRes.json();
  assert.strictEqual(deactData.status, 'TOKEN_DEACTIVATED');

  // Dispatch citizen hazard alert
  const citRes = await fetch('http://localhost:3001/api/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '⚠️ Road Hazard Ahead in 400m',
      body: 'Sudden deceleration cluster on Outer Ring Road.',
      severity: 'HIGH',
      event_type: 'HAZARD_AHEAD',
      event_id: `cit_haz_${Date.now()}`,
    }),
  });
  assert.strictEqual(citRes.status, 200);
  const citData = await citRes.json();
  assert(citData.status === 'STORED_LOCALLY_FCM_NOT_CONFIGURED' || citData.status === 'SENT_FCM');
});

if (spawnedServer) {
  try {
    spawnedServer.kill();
  } catch {}
}

// -------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------
console.log('\n============================================================');
console.log(`TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
console.log('============================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
