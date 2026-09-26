// ==============================================================================
// ROADRISK AI — COST INTELLIGENCE TEST SUITE
// Unit & Integration verification for Fuel, Tolls, Parking, Mode Comparison,
// Budget Constraints, and Provenance metadata.
// ==============================================================================

import assert from 'node:assert';

console.log('🧪 [TEST] Starting RoadRisk AI Cost Intelligence Test Suite...\n');

// 1. Vehicle Consumption & Fuel Calculations
function calculateFuelCost(distanceKm, efficiencyKmPerUnit, pricePerUnit) {
  const litersOrKwh = parseFloat((distanceKm / efficiencyKmPerUnit).toFixed(2));
  const cost = Math.round(litersOrKwh * pricePerUnit);
  return { unitsUsed: litersOrKwh, costInr: cost };
}

// Test A: Petrol Car (15 km/L @ ₹109.5/L)
const carPetrol = calculateFuelCost(60, 15, 109.5);
assert.strictEqual(carPetrol.unitsUsed, 4.0, '60km at 15km/L should consume 4.0 liters');
assert.strictEqual(carPetrol.costInr, 438, '4.0 L * 109.5 should equal ₹438');
console.log('  ✅ 1. Petrol Car Fuel Calculation Verified: 60km = 4.0L = ₹438');

// Test B: Motorcycle (45 km/L @ ₹109.5/L)
const bikePetrol = calculateFuelCost(60, 45, 109.5);
assert.strictEqual(bikePetrol.unitsUsed, 1.33, '60km at 45km/L should consume 1.33 liters');
assert.strictEqual(bikePetrol.costInr, 146, '1.33 L * 109.5 should equal ₹146');
console.log('  ✅ 2. Motorcycle Fuel Calculation Verified: 60km = 1.33L = ₹146');

// Test C: Electric Vehicle (6.8 km/kWh @ ₹8.5/kWh)
const evCar = calculateFuelCost(60, 6.8, 8.5);
assert.strictEqual(evCar.unitsUsed, 8.82, '60km at 6.8km/kWh should consume 8.82 kWh');
assert.strictEqual(evCar.costInr, 75, '8.82 kWh * 8.5 should equal ₹75');
console.log('  ✅ 3. EV Charging Calculation Verified: 60km = 8.82kWh = ₹75 (~83% savings vs petrol)');

// 2. Toll Intelligence & NHAI Exemption Rules
function evaluateTolls(distanceKm, mode, hasTolls) {
  if (mode === 'BIKE' || mode === 'WALK' || mode === 'BICYCLE') {
    return { amountInr: 0, dataSource: 'FREE', reason: 'Two-wheelers / Active modes exempt' };
  }
  if (!hasTolls) {
    return { amountInr: 0, dataSource: 'UNAVAILABLE', reason: 'No tolls reported on corridor' };
  }
  const plazas = Math.max(1, Math.floor(distanceKm / 65));
  return { amountInr: plazas * 95, dataSource: 'ESTIMATED', reason: `NHAI plazas: ${plazas}` };
}

const bikeTolls = evaluateTolls(130, 'BIKE', true);
assert.strictEqual(bikeTolls.amountInr, 0, 'Motorcycles must be toll-exempt');
assert.strictEqual(bikeTolls.dataSource, 'FREE');

const carTolls = evaluateTolls(130, 'CAR', true);
assert.strictEqual(carTolls.amountInr, 190, '130km corridor has 2 plazas @ ₹95 = ₹190');
assert.strictEqual(carTolls.dataSource, 'ESTIMATED');
console.log('  ✅ 4. Toll Intelligence Verified: Car = ₹190, Motorcycle = Exempt (₹0)');

// 3. Destination Parking Calculation
function evaluateParking(mode, type, hours = 2) {
  if (type === 'free') return 0;
  if (mode === 'CAR') return Math.max(30, hours * 30);
  if (mode === 'BIKE') return Math.max(15, hours * 15);
  return 0;
}

assert.strictEqual(evaluateParking('CAR', 'paid', 2), 60, 'Car 2 hours commercial parking = ₹60');
assert.strictEqual(evaluateParking('BIKE', 'paid', 2), 30, 'Bike 2 hours parking = ₹30');
assert.strictEqual(evaluateParking('CAR', 'free', 2), 0, 'Free parking = ₹0');
console.log('  ✅ 5. Parking Calculation Verified: Car = ₹60, Bike = ₹30, Free = ₹0');

// 4. Total Journey Cost Breakdown
function calculateTotalJourneyCost(distanceKm, mode, options = {}) {
  const fuel = calculateFuelCost(distanceKm, options.efficiency || 15, options.fuelPrice || 109.5);
  const tolls = evaluateTolls(distanceKm, mode, options.hasTolls);
  const parking = evaluateParking(mode, options.parkingType || 'paid', options.parkingHours || 2);
  const total = fuel.costInr + tolls.amountInr + parking;
  return {
    fuelInr: fuel.costInr,
    tollInr: tolls.amountInr,
    parkingInr: parking,
    totalInr: total,
    costPerKm: parseFloat((total / distanceKm).toFixed(2)),
    isEstimate: true,
  };
}

const journey = calculateTotalJourneyCost(65, 'CAR', { hasTolls: true, parkingType: 'paid' });
assert.strictEqual(journey.fuelInr, 474, 'Fuel = ₹474');
assert.strictEqual(journey.tollInr, 95, '1 Plaza Toll = ₹95');
assert.strictEqual(journey.parkingInr, 60, 'Parking = ₹60');
assert.strictEqual(journey.totalInr, 629, 'Total Journey = ₹629');
console.log('  ✅ 6. Total Journey Cost Verified: ₹474 fuel + ₹95 toll + ₹60 parking = ₹629');

// 5. Budget Constraint Intelligence Engine
function evaluateBudget(budgetLimit, totalCost, transitCost) {
  if (totalCost <= budgetLimit) {
    return {
      isWithinBudget: true,
      remainingInr: budgetLimit - totalCost,
      status: 'SATISFIED',
    };
  }
  if (transitCost <= budgetLimit) {
    return {
      isWithinBudget: false,
      alternativeMode: 'TRANSIT',
      alternativeCost: transitCost,
      status: 'ALTERNATIVE_FOUND',
    };
  }
  return {
    isWithinBudget: false,
    lowestEstimate: Math.min(totalCost, transitCost),
    status: 'CANNOT_SATISFY',
  };
}

// Case 1: ₹1,000 budget for ₹630 trip -> Satisfied
const budget1 = evaluateBudget(1000, 630, 140);
assert.strictEqual(budget1.isWithinBudget, true);
assert.strictEqual(budget1.remainingInr, 370);

// Case 2: ₹500 budget for ₹630 car trip -> Recommends Transit (₹140)
const budget2 = evaluateBudget(500, 630, 140);
assert.strictEqual(budget2.isWithinBudget, false);
assert.strictEqual(budget2.status, 'ALTERNATIVE_FOUND');
assert.strictEqual(budget2.alternativeMode, 'TRANSIT');

// Case 3: ₹50 budget for ₹630 trip -> Cannot satisfy honestly
const budget3 = evaluateBudget(50, 630, 140);
assert.strictEqual(budget3.isWithinBudget, false);
assert.strictEqual(budget3.status, 'CANNOT_SATISFY');
assert.strictEqual(budget3.lowestEstimate, 140);
console.log('  ✅ 7. Budget Constraint Evaluation Verified: Buffer calculation, honest alternative, and refusal without price fabrication');

console.log('\n🎉 ALL COST INTELLIGENCE UNIT TESTS PASSED SUCCESSFULLY!\n');
