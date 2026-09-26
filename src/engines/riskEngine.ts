import type { RiskFactor, RiskLevel, RiskSegment, VehicleProfile } from '../types/index.ts';
import { mlPipeline } from '../ml/mlPipeline.ts';
import type { SegmentRawFeatures } from '../ml/mlPipeline.ts';

export interface SegmentTelemetryInput {
  hardBrakingCount: number;
  suddenSlowdownsCount: number;
  trafficDensity: 'sparse' | 'moderate' | 'heavy' | 'jammed';
  floodDepthCm: number;
  roadWidthMeters: number;
  surfaceCondition: 'dry' | 'wet' | 'flooded' | 'damaged' | 'debris';
  vehicle: VehicleProfile;
  isNight?: boolean;
  incidentCount?: number;
  currentSpeedKmh?: number;
  freeFlowSpeedKmh?: number;
  precipitationMm?: number;
}

export interface RiskCalculationResult {
  score: number; // 0 - 100
  level: RiskLevel;
  factors: RiskFactor[];
  summaryExplanation: string;
  isPassableForVehicle: boolean;
  vehicleRestrictionReason?: string;
  mlProbability?: number;
  confidence?: number;
  algorithm?: string;
}

export function calculateSegmentRisk(input: SegmentTelemetryInput): RiskCalculationResult {
  const { hardBrakingCount, suddenSlowdownsCount, trafficDensity, floodDepthCm, roadWidthMeters, surfaceCondition, vehicle } = input;

  let baseScore = 10;
  const factors: RiskFactor[] = [];
  let isPassable = true;
  let restrictionReason: string | undefined;

  // 1. Vehicle Clearance / Road Width Evaluation
  const widthClearance = roadWidthMeters - vehicle.widthMeters;
  if (widthClearance < 0.6) {
    baseScore += 35;
    factors.push({
      name: 'Narrow Road Constraint',
      contribution: +35,
      description: `Road width (${roadWidthMeters}m) provides critically tight clearance for vehicle width (${vehicle.widthMeters}m).`,
      severity: 'critical',
    });
    if (vehicle.weightTons > 10) {
      isPassable = false;
      restrictionReason = `Street width (${roadWidthMeters}m) impassable for heavy vehicle (${vehicle.name}).`;
    }
  } else if (widthClearance < 1.2) {
    baseScore += 18;
    factors.push({
      name: 'Tight Corridor Margin',
      contribution: +18,
      description: `Lateral clearance is tight (${widthClearance.toFixed(1)}m buffer). High risk of obstruction delays.`,
      severity: 'moderate',
    });
  } else {
    factors.push({
      name: 'Wide Arterial Profile',
      contribution: -8,
      description: `Ample lateral clearance (${roadWidthMeters}m multi-lane).`,
      severity: 'low',
    });
    baseScore = Math.max(0, baseScore - 8);
  }

  // 2. Hard Braking Clusters (Abrupt deceleration > 0.45g)
  if (hardBrakingCount >= 25) {
    baseScore += 34;
    factors.push({
      name: 'Severe Braking Anomaly',
      contribution: +34,
      description: `${hardBrakingCount} severe braking events detected in recent window. Active multi-vehicle collision hazard.`,
      severity: 'critical',
    });
  } else if (hardBrakingCount >= 10) {
    baseScore += 20;
    factors.push({
      name: 'Elevated Braking Activity',
      contribution: +20,
      description: `${hardBrakingCount} sudden decelerations indicate recurring merge conflicts.`,
      severity: 'high',
    });
  } else if (hardBrakingCount >= 3) {
    baseScore += 8;
    factors.push({
      name: 'Moderate Decelerations',
      contribution: +8,
      description: `${hardBrakingCount} minor braking clusters detected.`,
      severity: 'moderate',
    });
  }

  // 3. Sudden Slowdowns & Flow Velocity Shockwaves
  if (suddenSlowdownsCount >= 15) {
    baseScore += 16;
    factors.push({
      name: 'Traffic Shockwave',
      contribution: +16,
      description: `${suddenSlowdownsCount} rapid velocity drops. Stop-and-go accordions in progress.`,
      severity: 'high',
    });
  } else if (suddenSlowdownsCount >= 5) {
    baseScore += 8;
    factors.push({
      name: 'Flow Fluctuation',
      contribution: +8,
      description: `${suddenSlowdownsCount} localized slowdown cycles.`,
      severity: 'moderate',
    });
  }

  // 4. Traffic Density
  if (trafficDensity === 'jammed') {
    baseScore += 22;
    factors.push({
      name: 'Gridlock / Jammed Density',
      contribution: +22,
      description: 'Severe vehicular congestion. Response sirens have limited clearing speed.',
      severity: 'high',
    });
  } else if (trafficDensity === 'heavy') {
    baseScore += 12;
    factors.push({
      name: 'Heavy Density',
      contribution: +12,
      description: 'High volume traffic requiring active siren clearing maneuvers.',
      severity: 'moderate',
    });
  } else if (trafficDensity === 'sparse') {
    factors.push({
      name: 'Free-Flowing Corridor',
      contribution: -6,
      description: 'Sparse traffic allowing uninhibited emergency response velocity.',
      severity: 'low',
    });
    baseScore = Math.max(0, baseScore - 6);
  }

  // 5. Flood / Waterlogging Conditions
  if (floodDepthCm >= 40) {
    baseScore += 45;
    factors.push({
      name: 'Severe Waterlogging (>40cm)',
      contribution: +45,
      description: `Flooding depth (${floodDepthCm}cm) exceeds safe fording limits for standard ambulances.`,
      severity: 'critical',
    });
    if (vehicle.category !== 'disaster') {
      isPassable = false;
      restrictionReason = `Water depth (${floodDepthCm}cm) exceeds chassis safety threshold. Hydrostatic stall risk.`;
    }
  } else if (floodDepthCm >= 15) {
    baseScore += 24;
    factors.push({
      name: 'Standing Water (15-39cm)',
      contribution: +24,
      description: 'Localized pooling reduces tire traction and emergency braking capability.',
      severity: 'high',
    });
  }

  // 6. Surface Condition
  if (surfaceCondition === 'debris' || surfaceCondition === 'damaged') {
    baseScore += 18;
    factors.push({
      name: 'Compromised Road Surface',
      contribution: +18,
      description: 'Physical debris or broken asphalt requires cautious transit.',
      severity: 'moderate',
    });
  }

  // Clamp final score strictly between 0 and 100
  const finalScore = Math.min(100, Math.max(0, Math.round(baseScore)));

  // Determine standard 5-tier Risk Level
  let level: RiskLevel = 'LOW';
  if (finalScore >= 81) level = 'CRITICAL';
  else if (finalScore >= 61) level = 'HIGH';
  else if (finalScore >= 41) level = 'ELEVATED';
  else if (finalScore >= 21) level = 'MODERATE';
  else level = 'LOW';

  // Human-readable explainable summary
  const topNegativeFactors = factors
    .filter((f) => f.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2)
    .map((f) => f.name.toLowerCase())
    .join(' and ');

  const summaryExplanation = topNegativeFactors
    ? `Risk elevated by ${topNegativeFactors}.`
    : 'Clear driving conditions with nominal segment baseline risk.';

  // Execute Machine Learning Decision Forest Inference
  const mlResult = mlPipeline.predict({
    currentSpeedKmh: input.currentSpeedKmh || (input.trafficDensity === 'jammed' ? 10 : input.trafficDensity === 'heavy' ? 25 : 50),
    freeFlowSpeedKmh: input.freeFlowSpeedKmh || 50,
    trafficDelaySeconds: input.trafficDensity === 'jammed' ? 600 : input.trafficDensity === 'heavy' ? 300 : 0,
    incidentCountInRadius: input.incidentCount || 0,
    hasRoadClosure: Boolean(input.floodDepthCm >= 30 || surfaceCondition === 'flooded'),
    hasFloodingIncident: Boolean(input.floodDepthCm > 0 || surfaceCondition === 'flooded'),
    roadClassification: input.roadWidthMeters > 10 ? 'primary' : input.roadWidthMeters > 6 ? 'secondary' : 'residential',
    precipitationMm: input.precipitationMm || (surfaceCondition === 'wet' ? 5.0 : 0),
    visibilityMeters: 8000,
    windSpeedKmh: 15,
    harshBrakingCount: input.hardBrakingCount,
    hourOfDay: new Date().getHours(),
    isWeekend: [0, 6].includes(new Date().getDay()),
  });

  return {
    score: finalScore,
    level,
    factors,
    summaryExplanation,
    isPassableForVehicle: isPassable,
    vehicleRestrictionReason: restrictionReason,
    mlProbability: mlResult.riskProbability,
    confidence: mlResult.modelConfidence,
    algorithm: mlResult.modelMetadata.algorithm,
  };
}

// Compute aggregate risk for an entire route
export function calculateRouteAggregateRisk(segments: RiskSegment[]): {
  aggregateScore: number;
  level: RiskLevel;
  maxSegmentRisk: number;
} {
  if (!segments.length) return { aggregateScore: 0, level: 'LOW', maxSegmentRisk: 0 };

  const total = segments.reduce((sum, s) => sum + s.riskScore, 0);
  const avg = Math.round(total / segments.length);
  const maxSegmentRisk = Math.max(...segments.map((s) => s.riskScore));

  // Weighted formula: 60% average segment risk + 40% worst bottleneck risk
  const aggregateScore = Math.min(100, Math.round(0.6 * avg + 0.4 * maxSegmentRisk));

  let level: RiskLevel = 'LOW';
  if (aggregateScore >= 81) level = 'CRITICAL';
  else if (aggregateScore >= 61) level = 'HIGH';
  else if (aggregateScore >= 41) level = 'ELEVATED';
  else if (aggregateScore >= 21) level = 'MODERATE';
  else level = 'LOW';

  return { aggregateScore, level, maxSegmentRisk };
}
