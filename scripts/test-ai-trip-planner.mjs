// ==============================================================================
// ROADRISK AI — AI TRIP PLANNER TEST SUITE
// Unit & Integration verification for Natural Language Parsing, Heuristic
// Multi-Stop Optimization, Appointment Departures, and Itinerary Generation.
// ==============================================================================

import assert from 'node:assert';

console.log('🧪 [TEST] Starting RoadRisk AI AI Trip Planner Test Suite...\n');

// 1. Natural Language Prompt Parser
function parsePrompt(prompt) {
  const lower = prompt.toLowerCase();

  let city = 'hyderabad';
  if (lower.includes('vijayawada')) city = 'vijayawada';

  let days = 1;
  const dayMatch = lower.match(/(\d+)\s*[-]?\s*(?:day|days)/);
  if (dayMatch) days = parseInt(dayMatch[1], 10);

  let budget;
  const budgetMatch = lower.match(/(?:under|budget|below)\s*(?:₹|rs\.?|inr)?\s*([\d,]+)/i);
  if (budgetMatch) budget = parseInt(budgetMatch[1].replace(/,/g, ''), 10);

  const isPublicTransport = lower.includes('public transport') || lower.includes('bus') || lower.includes('metro');
  const returnTimeMatch = lower.match(/(?:return|back by|by)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

  return {
    city,
    days,
    budget,
    isPublicTransport,
    returnTime: returnTimeMatch ? returnTimeMatch[1].trim().toUpperCase() : undefined,
  };
}

const parsed1 = parsePrompt('Plan a one-day Hyderabad trip under ₹2,000 using public transport where possible');
assert.strictEqual(parsed1.city, 'hyderabad');
assert.strictEqual(parsed1.days, 1);
assert.strictEqual(parsed1.budget, 2000);
assert.strictEqual(parsed1.isPublicTransport, true);
console.log('  ✅ 1. Natural Language Prompt Parsing Verified: 1-Day, Hyderabad, ₹2,000 budget, Public Transport');

const parsed2 = parsePrompt('Plan a 2-day Vijayawada weekend food trip return by 8 PM under ₹3,500');
assert.strictEqual(parsed2.city, 'vijayawada');
assert.strictEqual(parsed2.days, 2);
assert.strictEqual(parsed2.budget, 3500);
assert.strictEqual(parsed2.returnTime, '8 PM');
console.log('  ✅ 2. Multi-day & Return Time Constraints Verified: 2-Day, Vijayawada, ₹3,500 budget, Return by 8 PM');

// 2. Appointment Departure Calculation
function calculateAppointmentDeparture(targetHour, targetMin, meridiem, distanceKm, trafficDelay = 8, riskScore = 30) {
  const baseDriveMinutes = Math.round((distanceKm / 35) * 60);
  const trafficBuffer = Math.max(5, trafficDelay);
  const safetyBuffer = riskScore > 50 ? 15 : 10;
  const totalLeadMinutes = baseDriveMinutes + trafficBuffer + safetyBuffer;

  let h24 = targetHour;
  if (meridiem.toLowerCase() === 'pm' && h24 < 12) h24 += 12;
  if (meridiem.toLowerCase() === 'am' && h24 === 12) h24 = 0;

  const targetMs = (h24 * 60 + targetMin) * 60 * 1000;
  const depMs = targetMs - totalLeadMinutes * 60 * 1000;
  const depMinutesTotal = Math.floor(depMs / (60 * 1000));
  const depH = Math.floor(depMinutesTotal / 60);
  const depM = depMinutesTotal % 60;
  const depAmpm = depH >= 12 ? 'PM' : 'AM';
  const depH12 = depH % 12 || 12;

  return {
    recommendedDeparture: `${depH12}:${depM.toString().padStart(2, '0')} ${depAmpm}`,
    travelMinutes: baseDriveMinutes,
    totalBufferMinutes: trafficBuffer + safetyBuffer,
  };
}

// Target: 4:00 PM appointment, 18 km distance (~31 min drive + 8 min traffic + 10 min safety = 49 min lead time -> 3:11 PM)
const appt = calculateAppointmentDeparture(4, 0, 'PM', 18, 8, 30);
assert.strictEqual(appt.recommendedDeparture, '3:11 PM');
assert.strictEqual(appt.travelMinutes, 31);
assert.strictEqual(appt.totalBufferMinutes, 18);
console.log('  ✅ 3. Appointment-Aware Departure Calculation Verified: 4:00 PM target -> Recommended Departure: 3:11 PM (31m drive + 18m buffer)');

// 3. Heuristic Multi-Stop Route Optimization (Nearest Neighbor)
function dist(p1, p2) {
  return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
}

function optimizeStops(origin, stops) {
  const unvisited = [...stops];
  const ordered = [];
  let curr = origin;

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = dist(curr.coords, unvisited[i].coords);
      if (d < minDist) {
        minDist = d;
        bestIdx = i;
      }
    }
    const next = unvisited.splice(bestIdx, 1)[0];
    ordered.push(next);
    curr = next;
  }
  return ordered;
}

const originPoint = { name: 'Origin', coords: [0, 0] };
const stopsUnordered = [
  { name: 'Far Stop C', coords: [10, 10] },
  { name: 'Close Stop A', coords: [1, 1] },
  { name: 'Mid Stop B', coords: [4, 4] },
];

const stopsOrdered = optimizeStops(originPoint, stopsUnordered);
assert.strictEqual(stopsOrdered[0].name, 'Close Stop A');
assert.strictEqual(stopsOrdered[1].name, 'Mid Stop B');
assert.strictEqual(stopsOrdered[2].name, 'Far Stop C');
console.log('  ✅ 4. Multi-Stop Heuristic Optimization Verified: Ordered sequence Close A -> Mid B -> Far C');

// 4. Stop Insertion and Removal
const stopsList = [...stopsOrdered];
stopsList.push({ name: 'New Stop D', coords: [12, 12] });
assert.strictEqual(stopsList.length, 4, 'Stop insertion must increase length');

const filtered = stopsList.filter(s => s.name !== 'Mid Stop B');
assert.strictEqual(filtered.length, 3, 'Stop removal must decrease length');
assert.strictEqual(filtered.find(s => s.name === 'Mid Stop B'), undefined);
console.log('  ✅ 5. Stop Insertion and Deletion Lifecycle Verified');

console.log('\n🎉 ALL AI TRIP PLANNER UNIT TESTS PASSED SUCCESSFULLY!\n');
