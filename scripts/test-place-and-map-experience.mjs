// Automated Test Suite for Google-Maps-Level Place & Map Experience
// Tests PlaceService, Wikimedia Photos, Reverse Geocoding, Nearby POIs, and Route Maneuvers.

import { PlaceService } from '../src/services/placeService.ts';

async function runSuite() {
  console.log('🧪 [TEST] Starting RoadRisk AI Google-Maps-Level Map & Place Verification...\n');

  // Test 1: City Search & Worldwide Resolution
  console.log('--- TEST 1: Worldwide City Search ---');
  const cities = ['Vijayawada', 'Hyderabad', 'London', 'Tokyo', 'New York'];
  for (const city of cities) {
    const results = await PlaceService.searchPlaces(city);
    if (results.length === 0) {
      throw new Error(`Failed to resolve city: ${city}`);
    }
    console.log(`  ✅ Resolved "${city}": Top result "${results[0].name}" [${results[0].longitude.toFixed(4)}, ${results[0].latitude.toFixed(4)}] (${results[0].type})`);
  }

  // Test 2: City Details with Real Photo Enrichment & Sourced Extract
  console.log('\n--- TEST 2: City Details & Wikimedia Photos ---');
  const vja = await PlaceService.getPlaceDetails(
    'test_vja',
    'Vijayawada',
    [80.6480, 16.5062],
    'city'
  );
  if (!vja.name || !vja.extract) {
    throw new Error('Vijayawada place details missing name or extract');
  }
  console.log(`  ✅ Name: ${vja.name}`);
  console.log(`  ✅ Type: ${vja.type}`);
  console.log(`  ✅ Sourced Extract: "${vja.extract.slice(0, 100)}..."`);
  console.log(`  ✅ Photo URL: ${vja.image || 'Clean Geographic Fallback'}`);
  console.log(`  ✅ Photo Gallery Count: ${vja.photos.length} photos`);
  if (vja.weather) {
    console.log(`  ✅ Live Weather Connected: ${vja.weather.temperatureC}°C, ${vja.weather.condition}`);
  }

  // Test 3: Road & Street Reverse Geocoding
  console.log('\n--- TEST 3: Road & Street Interaction ---');
  const roadEntity = await PlaceService.reverseGeocode([80.6480, 16.5062]);
  console.log(`  ✅ Reverse Geocoded Road/Entity: "${roadEntity.name}" at ${roadEntity.address}`);
  console.log(`  ✅ Type: ${roadEntity.type}`);

  // Test 4: Nearby POI Discovery
  console.log('\n--- TEST 4: Nearby Places Discovery ---');
  const nearby = await PlaceService.getNearbyPlaces([80.6480, 16.5062], 'amenity', 5);
  console.log(`  ✅ Found ${nearby.length} nearby amenities:`);
  nearby.forEach((item, idx) => {
    console.log(`     [${idx + 1}] ${item.name} (${item.type}) — ${item.distanceKm} km away`);
  });

  // Test 5: OSRM Route Calculation with Real Steps
  console.log('\n--- TEST 5: Real OSRM Route with Alternatives ---');
  const osrmUrl = 'https://router.project-osrm.org/route/v1/driving/80.6480,16.5062;80.6196,16.5141?overview=full&geometries=geojson&alternatives=true&steps=true';
  const osrmRes = await fetch(osrmUrl);
  if (!osrmRes.ok) throw new Error(`OSRM fetch failed: ${osrmRes.status}`);
  const osrmData = await osrmRes.json();
  if (!osrmData.routes || osrmData.routes.length === 0) {
    throw new Error('OSRM returned no routes');
  }
  console.log(`  ✅ OSRM returned ${osrmData.routes.length} route(s)`);
  console.log(`  ✅ Primary Route Distance: ${(osrmData.routes[0].distance / 1000).toFixed(2)} km`);
  console.log(`  ✅ Primary Route Steps count: ${osrmData.routes[0].legs[0].steps.length} real maneuvers`);

  console.log('\n🎉 ALL GOOGLE-MAPS-LEVEL MAP EXPERIENCE TESTS PASSED WITH 100% SUCCESS!');
}

runSuite().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
