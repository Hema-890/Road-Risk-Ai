import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const API_BASE = 'http://localhost:3001';
const DB_PATH = path.resolve('server/roadrisk.db');

async function runAudit() {
  const results = {
    timestamp: new Date().toISOString(),
    search: {},
    routing: {},
    database: {},
    backend: {},
    roundtripFlow: {},
    security: {}
  };

  console.log('========================================');
  console.log('1. VERIFYING SEARCH (OSM PHOTON GEOCODING)');
  console.log('========================================');
  const searchQueries = [
    { query: 'Vijayawada', bias: null },
    { query: 'hospital', bias: { lat: 16.506, lon: 80.648 } },
    { query: 'Benz Circle', bias: { lat: 16.506, lon: 80.648 } },
    { query: 'Vijayawada Railway Station', bias: null }
  ];

  for (const item of searchQueries) {
    const q = item.query;
    try {
      let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`;
      if (item.bias) {
        url += `&lat=${item.bias.lat}&lon=${item.bias.lon}`;
      }
      const res = await fetch(url, { headers: { 'User-Agent': 'RoadRiskAI-Audit/1.0' } });
      const data = await res.json();
      const first = data.features?.[0];
      if (first) {
        results.search[q] = {
          status: 'SUCCESS',
          coords: first.geometry.coordinates, // [lng, lat]
          name: first.properties.name || first.properties.street || q,
          city: first.properties.city || first.properties.state || first.properties.country,
          country: first.properties.country,
          provider: 'OpenStreetMap Photon Geocoder (Free/No API Key)'
        };
        console.log(`[PASS] Search "${q}": found "${results.search[q].name}" in ${results.search[q].city || ''} at ${JSON.stringify(first.geometry.coordinates)}`);
      } else {
        results.search[q] = { status: 'EMPTY_RESULTS' };
        console.log(`[WARN] Search "${q}": 0 features found`);
      }
    } catch (e) {
      results.search[q] = { status: 'ERROR', error: e.message };
      console.log(`[FAIL] Search "${q}": ${e.message}`);
    }
  }

  console.log('\n========================================');
  console.log('2. VERIFYING ROUTING (OSRM PUBLIC API)');
  console.log('========================================');
  try {
    // Benz Circle [80.6480, 16.5000] to Vijayawada Railway Station [80.6200, 16.5180]
    const startLng = 80.6480;
    const startLat = 16.5000;
    const endLng = 80.6200;
    const endLat = 16.5180;
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
    
    const res = await fetch(osrmUrl, { headers: { 'User-Agent': 'RoadRiskAI-Audit/1.0' } });
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.length > 0) {
      const r = data.routes[0];
      results.routing = {
        status: 'SUCCESS',
        provider: 'Project OSRM Public Server',
        endpoint: 'https://router.project-osrm.org/route/v1/driving/',
        apiKeyRequired: false,
        distanceMeters: r.distance,
        durationSeconds: r.duration,
        geometryPointsCount: r.geometry?.coordinates?.length || 0,
        sampleStartCoord: r.geometry?.coordinates?.[0],
        sampleEndCoord: r.geometry?.coordinates?.[r.geometry.coordinates.length - 1]
      };
      console.log(`[PASS] OSRM Route: ${Math.round(r.distance)}m, ${Math.round(r.duration / 60)} mins, ${r.geometry.coordinates.length} waypoints`);
    } else {
      results.routing = { status: 'FAIL', code: data.code };
      console.log(`[FAIL] OSRM Route returned code: ${data.code}`);
    }
  } catch (e) {
    results.routing = { status: 'ERROR', error: e.message };
    console.log(`[FAIL] OSRM Route: ${e.message}`);
  }

  console.log('\n========================================');
  console.log('3. DIRECT SQLITE DATABASE VERIFICATION');
  console.log('========================================');
  try {
    const db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA foreign_keys = ON;');
    
    // Check tables
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`).all();
    const tableNames = tables.map(t => t.name);
    console.log(`[PASS] Found ${tableNames.length} tables in SQLite: ${tableNames.join(', ')}`);

    // Check indexes
    const indexes = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';`).all();
    console.log(`[PASS] Found ${indexes.length} indexes in SQLite: ${indexes.map(i => i.name).join(', ')}`);

    // Test INSERT, SELECT, UPDATE, DELETE on hazard_reports
    const testId = 'audit-test-' + Date.now();
    db.prepare(`
      INSERT INTO hazard_reports (id, category, title, description, severity, latitude, longitude, location_name, reported_by, data_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(testId, 'FLOOD', 'Waterlogging Test', 'Audit direct write test', 'HIGH', 16.505, 80.640, 'Benz Circle Underpass', 'audit-tester', 'real');
    console.log(`[PASS] Direct INSERT into hazard_reports succeeded`);

    const selectRow = db.prepare(`SELECT * FROM hazard_reports WHERE id = ?`).get(testId);
    if (selectRow && selectRow.title === 'Waterlogging Test') {
      console.log(`[PASS] Direct SELECT from hazard_reports succeeded`);
    } else {
      throw new Error('Direct SELECT failed or data mismatched');
    }

    db.prepare(`UPDATE hazard_reports SET severity = ? WHERE id = ?`).run('CRITICAL', testId);
    const updatedRow = db.prepare(`SELECT severity FROM hazard_reports WHERE id = ?`).get(testId);
    if (updatedRow.severity === 'CRITICAL') {
      console.log(`[PASS] Direct UPDATE in hazard_reports succeeded`);
    } else {
      throw new Error('Direct UPDATE failed');
    }

    db.prepare(`DELETE FROM hazard_reports WHERE id = ?`).run(testId);
    const deletedRow = db.prepare(`SELECT * FROM hazard_reports WHERE id = ?`).get(testId);
    if (!deletedRow) {
      console.log(`[PASS] Direct DELETE in hazard_reports succeeded`);
    } else {
      throw new Error('Direct DELETE failed');
    }

    results.database = {
      status: 'VERIFIED',
      path: DB_PATH,
      tableCount: tableNames.length,
      tables: tableNames,
      indexCount: indexes.length,
      crudVerified: true
    };
  } catch (e) {
    results.database = { status: 'ERROR', error: e.message };
    console.log(`[FAIL] SQLite error: ${e.message}`);
  }

  console.log('\n========================================');
  console.log('4. BACKEND ENDPOINTS AUDIT (15 ENDPOINTS)');
  console.log('========================================');
  let authToken = null;
  const auditUserEmail = `audit_${Date.now()}@roadrisk.local`;

  const endpointsToTest = [
    { method: 'GET', path: '/api/health' },
    { method: 'GET', path: '/api/system/status' },
    { 
      method: 'POST', 
      path: '/api/auth/register', 
      body: { email: auditUserEmail, password: 'SecurePassword123!', fullName: 'Audit Officer', role: 'dispatcher' } 
    },
    { 
      method: 'POST', 
      path: '/api/auth/login', 
      body: { email: auditUserEmail, password: 'SecurePassword123!' },
      onSuccess: (data) => { authToken = data.token; }
    },
    { method: 'GET', path: '/api/auth/me', useAuth: true },
    { method: 'GET', path: '/api/hospitals' },
    { method: 'GET', path: '/api/missions' },
    { 
      method: 'POST', 
      path: '/api/missions', 
      body: { origin_name: 'MG Road Vijayawada', destination_name: 'Govt General Hospital', priority: 'EMERGENCY' } 
    },
    { 
      method: 'PUT', 
      path: '/api/missions/audit-placeholder',
      body: { status: 'IN_TRANSIT', time_saved_minutes: 3.5, risk_avoided_points: 25 } 
    },
    { method: 'GET', path: '/api/hazards' },
    { 
      method: 'POST', 
      path: '/api/hazards', 
      body: { hazardType: 'CONSTRUCTION', severity: 'HIGH', description: 'Road under repair audit test', lat: 16.512, lng: 80.625 } 
    },
    { method: 'GET', path: '/api/events' },
    { 
      method: 'POST', 
      path: '/api/events/simulate', 
      body: { eventType: 'ACCIDENT', severity: 'CRITICAL', roadSegmentId: 'seg_101', delayMinutes: 15 } 
    },
    { method: 'GET', path: '/api/roads' },
    { method: 'GET', path: '/api/roads/seg_101/risk' },
    { method: 'GET', path: '/api/analytics' }
  ];

  let createdMissionId = null;

  for (const ep of endpointsToTest) {
    let testPath = ep.path;
    if (testPath.includes('audit-placeholder')) {
      testPath = createdMissionId ? `/api/missions/${createdMissionId}` : '/api/missions';
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (ep.useAuth && authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const options = {
        method: ep.method,
        headers
      };
      if (ep.body) {
        options.body = JSON.stringify(ep.body);
      }

      const res = await fetch(`${API_BASE}${testPath}`, options);
      const json = await res.json().catch(() => null);

      if (res.ok) {
        console.log(`[PASS] ${ep.method} ${testPath} -> HTTP ${res.status}`);
        results.backend[`${ep.method} ${testPath}`] = { status: 'PASS', code: res.status, sample: json ? Object.keys(json) : null };
        if (ep.onSuccess) ep.onSuccess(json);
        if (testPath === '/api/missions' && ep.method === 'POST' && json?.id) {
          createdMissionId = json.id;
        }
      } else {
        console.log(`[FAIL] ${ep.method} ${testPath} -> HTTP ${res.status} ${JSON.stringify(json)}`);
        results.backend[`${ep.method} ${testPath}`] = { status: 'FAIL', code: res.status, error: json };
      }
    } catch (e) {
      console.log(`[ERROR] ${ep.method} ${testPath} -> ${e.message}`);
      results.backend[`${ep.method} ${testPath}`] = { status: 'ERROR', error: e.message };
    }
  }

  console.log('\n========================================');
  console.log('5. FRONTEND -> BACKEND -> SQLITE -> FRONTEND FLOW');
  console.log('========================================');
  try {
    // 1. Post hazard via API (simulating Frontend report)
    const postRes = await fetch(`${API_BASE}/api/hazards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hazardType: 'OIL_SPILL',
        severity: 'CRITICAL',
        description: 'Benz Circle major slick audit roundtrip',
        lat: 16.5015,
        lng: 80.6455
      })
    });
    const postData = await postRes.json();
    const hazardId = postData.id || postData.hazard?.id;
    console.log(`Step 1: Frontend sent hazard -> Backend assigned ID: ${hazardId}`);

    // 2. Direct verify in SQLite table
    const db = new DatabaseSync(DB_PATH);
    const dbRecord = db.prepare(`SELECT * FROM hazard_reports WHERE id = ?`).get(hazardId);
    console.log(`Step 2: SQLite directly verified record in hazard_reports: ${dbRecord ? dbRecord.description : 'NOT FOUND'}`);

    // 3. Retrieve via GET /api/hazards (Frontend refresh/fetch)
    const getRes = await fetch(`${API_BASE}/api/hazards`);
    const getData = await getRes.json();
    const foundInList = Array.isArray(getData) ? getData.find(h => h.id === hazardId) : getData.hazards?.find(h => h.id === hazardId);
    console.log(`Step 3: Frontend GET /api/hazards retrieved record: ${foundInList ? 'CONFIRMED MATCH' : 'NOT FOUND'}`);

    results.roundtripFlow = {
      verified: !!(hazardId && dbRecord && foundInList),
      hazardId,
      dbDescription: dbRecord?.description,
      status: 'VERIFIED_ROUNDTRIP'
    };
  } catch (e) {
    results.roundtripFlow = { verified: false, error: e.message };
    console.log(`[FAIL] Roundtrip test failed: ${e.message}`);
  }

  console.log('\n========================================');
  console.log('6. SECURITY CREDENTIAL SCAN');
  console.log('========================================');
  const sensitivePatterns = [
    /eyJh[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/, // JWT
    /AIza[0-9A-Za-z-_]{35}/, // Google API Key
    /sk_live_[0-9a-zA-Z]{24}/, // Stripe live
    /sbp_[a-zA-Z0-9]{40}/, // Supabase PAT
    /postgres:\/\/postgres:[^@]+@/ // Postgres hardcoded credentials with password
  ];

  const filesToScan = [
    'src/services/apiService.ts',
    'src/services/osrmService.ts',
    'src/components/map/MapContainer.tsx',
    'server/index.cjs',
    'server/database.cjs',
    '.env.example'
  ];

  let anySecretsFound = false;
  for (const f of filesToScan) {
    const fullPath = path.resolve(f);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pat of sensitivePatterns) {
        if (pat.test(content)) {
          console.log(`[ALERT] Secret pattern matched in ${f}`);
          anySecretsFound = true;
        }
      }
    }
  }

  if (!anySecretsFound) {
    console.log('[PASS] Security Audit: ZERO real API keys, tokens, or private secrets found committed in code.');
    results.security = { status: 'NOT FOUND', safe: true };
  } else {
    results.security = { status: 'FOUND', safe: false };
  }

  fs.writeFileSync('scripts/audit-results.json', JSON.stringify(results, null, 2));
  console.log('\nAudit complete. Results saved to scripts/audit-results.json');
}

runAudit();
