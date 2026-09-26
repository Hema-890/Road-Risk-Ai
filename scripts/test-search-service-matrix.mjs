import searchService from '../src/services/searchService.ts';

const testQueries = [
  'Vijayawada',
  'Guntur',
  'Hyderabad',
  'Markapur',
  'Benz Circle',
  'Vijayawada Railway Station',
  'Ramesh Hospitals',
  'Indian Oil Petrol Pump',
  '16.5062, 80.6480',
];

async function run() {
  console.log('=== SEARCH SERVICE PROVIDER MATRIX AUDIT ===');
  const origin = [80.6480, 16.5062]; // Vijayawada center

  for (const q of testQueries) {
    try {
      const results = await searchService.search(q, { originCoords: origin, limit: 5 });
      console.log(`\nQuery: "${q}" -> ${results.length} result(s)`);
      if (results.length > 0) {
        const top = results[0];
        console.log(`  Top Result: "${top.name}" (${top.type}, ${top.category}) via ${top.provider}`);
        console.log(`  Coords: [${top.coordinates[0].toFixed(4)}, ${top.coordinates[1].toFixed(4)}] • Display: ${top.displayName}`);
      } else {
        console.log('  [FAIL] No results returned.');
      }
    } catch (err) {
      console.error(`  [ERROR] on "${q}":`, err.message);
    }
  }
}

run();
