// Test all 9 required search queries against Photon Geocoding API
const queries = [
  'Vijayawada',
  'Benz Circle',
  'Vijayawada Railway Station',
  'Vijayawada Railway Station Bus Stop',
  'hospital',
  'UPHC',
  'UPHC Vijayawada',
  'Government Hospital Vijayawada',
  'Hyderabad',
];

// Vijayawada center: [80.6480, 16.5062]
const vjaLat = 16.5062;
const vjaLon = 80.6480;

async function testQuery(q, withBias = true) {
  let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`;
  if (withBias) {
    url += `&lat=${vjaLat}&lon=${vjaLon}`;
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'RoadRiskAI-Test/1.0' } });
  const data = await res.json();
  console.log(`\n======================================================`);
  console.log(`QUERY: "${q}" (bias: ${withBias ? 'Vijayawada' : 'NONE'})`);
  console.log(`======================================================`);
  if (!data.features || data.features.length === 0) {
    console.log('  -> ZERO RESULTS');
    return;
  }
  data.features.forEach((f, i) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    // Calculate distance from Vijayawada center in km
    const dLat = (lat - vjaLat) * 111;
    const dLon = (lon - vjaLon) * 111 * Math.cos(vjaLat * Math.PI / 180);
    const distKm = Math.sqrt(dLat * dLat + dLon * dLon).toFixed(1);

    console.log(`  [${i+1}] ${p.name || p.street || 'unnamed'} | ${p.district || p.city || p.county || ''}, ${p.state || ''}, ${p.country || ''}`);
    console.log(`      Coords: [${lon.toFixed(5)}, ${lat.toFixed(5)}] | Distance: ${distKm} km | Type: ${p.osm_key}=${p.osm_value}`);
  });
}

async function runAll() {
  for (const q of queries) {
    await testQuery(q, true);
  }
}

runAll();
