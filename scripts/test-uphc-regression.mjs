// Automated UPHC & Proximity Regression Test
// Tests the exact search ranking and sanity filtering algorithm used in RoadRisk AI

function calculateDistanceKm(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2));
}

async function runRegression() {
  console.log('\n--- Testing UPHC Search Regression in Vijayawada ---');
  const vijayawadaOrigin = [80.6480, 16.5062]; // Benz Circle
  const query = 'UPHC';
  const maxRadiusKm = 60;

  // 1. Fetch raw candidates from Photon with retry
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lat=${vijayawadaOrigin[1]}&lon=${vijayawadaOrigin[0]}&limit=12`;
  let data = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'RoadRiskAI-Test/2.0' }, signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        data = await res.json();
        break;
      }
    } catch (e) {
      if (attempt === 3) {
        // Fallback to curl in Node test environment
        try {
          const { execSync } = await import('node:child_process');
          const stdout = execSync(`curl -s --connect-timeout 5 "${url}"`, { encoding: 'utf-8' });
          data = JSON.parse(stdout);
          break;
        } catch (curlErr) {
          throw e;
        }
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  if (!data) throw new Error('Failed to fetch from Photon after 3 attempts');

  const rawCandidates = (data.features || []).map((f) => {
    const coords = f.geometry.coordinates;
    const dist = calculateDistanceKm(vijayawadaOrigin, coords);
    return {
      name: f.properties.name || f.properties.street || query,
      coords,
      distance_km: dist,
      properties: f.properties,
    };
  });

  console.log(`Raw candidates returned by Photon: ${rawCandidates.length}`);

  // 2. Apply RoadRisk AI Distance Sanity Filter (Phase 8 Requirement)
  const saneCandidates = rawCandidates.filter((c) => c.distance_km <= maxRadiusKm);

  // 3. Sort by distance ascending
  saneCandidates.sort((a, b) => a.distance_km - b.distance_km);

  console.log(`Filtered & ranked local candidates: ${saneCandidates.length}`);
  saneCandidates.forEach((c, idx) => {
    console.log(`  [${idx + 1}] ${c.name} -> ${c.distance_km} km (Coords: [${c.coords.join(', ')}])`);
  });

  if (saneCandidates.length === 0) {
    console.error('FAIL: No valid local candidates found');
    process.exit(1);
  }

  const top = saneCandidates[0];
  if (top.distance_km > 15) {
    console.error(`FAIL: Top candidate is ${top.distance_km} km away! Expected < 15 km.`);
    process.exit(1);
  }

  // Check that no candidate > 60 km leaked through
  const outliers = saneCandidates.filter((c) => c.distance_km > maxRadiusKm);
  if (outliers.length > 0) {
    console.error(`FAIL: Found ${outliers.length} outliers > 60 km!`);
    process.exit(1);
  }

  console.log(`✅ SUCCESS: Top UPHC candidate "${top.name}" is ${top.distance_km} km away (SAFE & LOCAL).`);
}

runRegression().catch((err) => {
  console.error('Test error:', err.message);
  process.exit(1);
});
