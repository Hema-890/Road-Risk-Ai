// Comprehensive TomTom Services Live Probe
// Strictly protects the API key and masks any secrets in errors/logs.

import fs from 'node:fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const keyMatch = envContent.match(/VITE_TRAFFIC_API_KEY=([^\r\n#]+)/);
const key = keyMatch ? keyMatch[1].trim() : '';

if (!key) {
  console.error('VITE_TRAFFIC_API_KEY not found in .env');
  process.exit(1);
}

const sanitize = (val) => {
  if (!val) return '';
  return String(val).split(key).join('[REDACTED_KEY]');
};

async function probe() {
  console.log('Beginning Live Verification of TomTom API services...\n');
  const results = {};

  // 1. TomTom Authentication & Traffic Flow
  console.log('1. Probing Traffic Flow (Flow Segment Data)...');
  try {
    const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative/10/json?point=16.5062,80.6480&unit=KMPH&key=${key}`;
    const res = await fetch(url);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    results.auth = {
      status: res.status,
      statusText: res.statusText,
      success: res.status === 200
    };
    results.flow = {
      status: res.status,
      success: res.status === 200 && Boolean(data?.flowSegmentData),
      currentSpeed: data?.flowSegmentData?.currentSpeed,
      freeFlowSpeed: data?.flowSegmentData?.freeFlowSpeed,
      confidence: data?.flowSegmentData?.confidence,
      coordinates: data?.flowSegmentData?.coordinates ? 'Valid coordinate array present' : 'N/A'
    };
  } catch (err) {
    results.auth = { status: 'ERROR', error: sanitize(err.message) };
    results.flow = { status: 'ERROR', error: sanitize(err.message) };
  }

  // 2. Traffic Incidents
  console.log('2. Probing Traffic Incidents...');
  try {
    const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?bbox=80.6,16.4,80.7,16.6&key=${key}`;
    const res = await fetch(url);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    results.incidents = {
      status: res.status,
      success: res.status === 200,
      incidentCount: data?.incidents ? data.incidents.length : 0,
      hasValidSchema: Array.isArray(data?.incidents)
    };
  } catch (err) {
    results.incidents = { status: 'ERROR', error: sanitize(err.message) };
  }

  // 3. Traffic-Aware Routing
  console.log('3. Probing Traffic-Aware Routing...');
  try {
    const url = `https://api.tomtom.com/routing/1/calculateRoute/16.5062,80.6480:16.5141,80.6196/json?key=${key}&traffic=true&departAt=now`;
    const res = await fetch(url);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    const summary = data?.routes?.[0]?.summary;
    results.routing = {
      status: res.status,
      success: res.status === 200 && Boolean(summary),
      travelTimeInSeconds: summary?.travelTimeInSeconds,
      trafficDelayInSeconds: summary?.trafficDelayInSeconds,
      lengthInMeters: summary?.lengthInMeters,
      departureTime: summary?.departureTime,
      arrivalTime: summary?.arrivalTime
    };
  } catch (err) {
    results.routing = { status: 'ERROR', error: sanitize(err.message) };
  }

  // 4. Traffic Map Tile
  console.log('4. Probing Traffic Map Tile...');
  try {
    const url = `https://api.tomtom.com/traffic/map/4/tile/flow/relative/10/798/486.png?key=${key}&thickness=10`;
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get('content-type');
    results.tile = {
      status: res.status,
      success: res.status === 200 && contentType?.includes('image/png') && buf.byteLength > 0,
      contentType,
      bytes: buf.byteLength
    };
  } catch (err) {
    results.tile = { status: 'ERROR', error: sanitize(err.message) };
  }

  // 5. Search API
  console.log('5. Probing Search API...');
  try {
    const url = `https://api.tomtom.com/search/2/geocode/Vijayawada.json?key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    results.search = {
      status: res.status,
      success: res.status === 200 && Array.isArray(data?.results) && data.results.length > 0,
      numResults: data?.results?.length,
      topResult: data?.results?.[0]?.address?.freeformAddress
    };
  } catch (err) {
    results.search = { status: 'ERROR', error: sanitize(err.message) };
  }

  // 6. Snap to Roads
  console.log('6. Probing Snap to Roads...');
  try {
    const url = `https://api.tomtom.com/snapToRoads/1?key=${key}&points=16.5062,80.6480;16.5070,80.6490`;
    const res = await fetch(url);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    results.snapToRoads = {
      status: res.status,
      success: res.status === 200,
      responseSummary: sanitize(typeof data === 'string' ? data.substring(0, 120) : JSON.stringify(data).substring(0, 120))
    };
  } catch (err) {
    results.snapToRoads = { status: 'ERROR', error: sanitize(err.message) };
  }

  // 7. Matrix Routing
  console.log('7. Probing Matrix Routing...');
  try {
    const url = `https://api.tomtom.com/routing/matrix/2?key=${key}`;
    const body = {
      origins: [{ point: { latitude: 16.5062, longitude: 80.6480 } }],
      destinations: [{ point: { latitude: 16.5141, longitude: 80.6196 } }]
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    results.matrix = {
      status: res.status,
      success: res.status === 200,
      responseSummary: sanitize(typeof data === 'string' ? data.substring(0, 120) : JSON.stringify(data).substring(0, 120))
    };
  } catch (err) {
    results.matrix = { status: 'ERROR', error: sanitize(err.message) };
  }

  // 8. Reachable Range
  console.log('8. Probing Reachable Range...');
  try {
    const url = `https://api.tomtom.com/routing/1/calculateReachableRange/16.5062,80.6480/json?key=${key}&timeBudgetInSec=900`;
    const res = await fetch(url);
    const data = await res.json();
    results.reachableRange = {
      status: res.status,
      success: res.status === 200 && Boolean(data?.reachableRange?.boundary),
      boundaryPoints: data?.reachableRange?.boundary?.length
    };
  } catch (err) {
    results.reachableRange = { status: 'ERROR', error: sanitize(err.message) };
  }

  console.log('\n--- VERIFICATION PROBE RESULTS ---');
  console.log(JSON.stringify(results, null, 2));
}

probe();
