// scripts/test-tourist-modes.mjs
import assert from 'node:assert';
import { modeService } from '../src/services/modeService.ts';

console.log('🧪 [TEST] Starting RoadRisk AI Tourist Mode & Traveler Type Verification...\n');

// 1. Initial State & Mode Switching
console.log('  Testing ModeService mode switching...');
assert.strictEqual(modeService.getActiveMode(), 'STANDARD');

modeService.setMode('TOURIST');
assert.strictEqual(modeService.getActiveMode(), 'TOURIST');
assert.strictEqual(modeService.getConfig().mapLayers.showTouristAttractions, true);
assert.strictEqual(modeService.getConfig().routeConstraints.preferScenicTouristCorridors, true);
console.log('  ✅ 1. Tourist Mode activation & map layer toggling verified.');

// 2. Traveler Type: 'heritage' Preference Updating
console.log('  Testing travelerType="heritage" configuration...');
modeService.updateTouristPreferences({
  travelerType: 'heritage',
  budgetInr: 3000,
});

const config = modeService.getConfig();
assert.strictEqual(config.touristPreferences.travelerType, 'heritage');
assert.strictEqual(config.touristPreferences.budgetInr, 3000);
console.log('  ✅ 2. travelerType="heritage" assigned and retrieved cleanly.');

// 3. Tourist Attractions Retrieval & Filtering by Heritage
console.log('  Testing Tourist Attractions & Heritage category retrieval...');
const allAttractions = modeService.getTouristAttractions();
assert.ok(allAttractions.length > 0, 'Attractions list should not be empty');

const heritageAttractions = allAttractions.filter((a) => a.category === 'heritage');
assert.ok(heritageAttractions.length >= 2, 'Should have multiple heritage attractions');
console.log(`  Found ${heritageAttractions.length} heritage attractions: ${heritageAttractions.map(h => h.name).join(', ')}`);

const charminar = heritageAttractions.find((a) => a.id === 'attr_charminar');
assert.ok(charminar, 'Charminar must be present');
assert.strictEqual(charminar.category, 'heritage');
console.log('  ✅ 3. Heritage attractions correctly categorized.');

// 4. Searching for Heritage Sites
console.log('  Testing searchTouristAttractions with query and filters...');
const searchForts = modeService.searchTouristAttractions('fort');
assert.ok(searchForts.length > 0, 'Should find fort attractions');
assert.ok(searchForts.some((a) => a.name.includes('Golconda')), 'Should find Golconda Fort');

const filteredSearch = modeService.searchTouristAttractions('', ['heritage']);
assert.ok(filteredSearch.length >= 2, 'Heritage category filter should return heritage attractions');
assert.ok(filteredSearch.every((a) => a.category === 'heritage'), 'All results must be category heritage');
console.log('  ✅ 4. Heritage search and category filtering verified.');

// 5. Trip Cost Calculation for Heritage Itinerary
console.log('  Testing trip cost calculation for heritage attractions...');
const cost = modeService.calculateTouristTripCost(heritageAttractions.slice(0, 3), 'CAR', 30);
assert.ok(cost.totalEstimatedCostInr > 0, 'Total cost should be greater than 0');
assert.ok(cost.breakdown.entryFeesInr >= 0, 'Entry fees should be computed');
assert.ok(cost.breakdown.fuelOrTransitInr > 0, 'Fuel estimate should be computed');
console.log(`  Trip cost estimate: ₹${cost.totalEstimatedCostInr} (Entry: ₹${cost.breakdown.entryFeesInr}, Fuel: ₹${cost.breakdown.fuelOrTransitInr}, Food: ₹${cost.breakdown.foodEstimateInr})`);
console.log('  ✅ 5. Trip cost calculation for heritage attractions verified.');

// Reset to standard mode
modeService.setMode('STANDARD');
assert.strictEqual(modeService.getActiveMode(), 'STANDARD');

console.log('\n🎉 ALL TOURIST MODE & HERITAGE TRAVELER TYPE TESTS PASSED SUCCESSFULLY!\n');
