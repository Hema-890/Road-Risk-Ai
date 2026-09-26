import { AuthorityHotspot } from '../types';

export const AUTHORITY_HOTSPOTS: AuthorityHotspot[] = [
  {
    id: 'hotspot_01',
    junctionName: 'Junction 17 — Central Flyover Descent',
    coordinates: [77.6085, 12.9860],
    riskScore: 84,
    riskLevel: 'CRITICAL',
    category: 'Severe Deceleration Conflict & Merge Zone',
    nearMissCountWeekly: 42,
    hardBrakingFrequency: 18.4, // events per hour
    suddenSlowdownEvents: 142,
    peakRiskTime: '08:30 – 10:30 & 18:00 – 20:30',
    primaryContributingFactors: [
      'Blind crest curve leaving overpass',
      'Sudden lane reduction from 3 to 2 lanes',
      'Uncontrolled merging from feeder ramp',
      'Surface friction deterioration (micro-grooving worn)',
    ],
    investigationRecommendation:
      'Field verification recommended: Install overhead dynamic LED speed warning matrix 200m prior to crest, reconfigure feeder merge angle from 45° to 20°, and re-mill high-friction anti-skid surface coating.',
    roadCharacteristics: {
      lanes: 2,
      widthMeters: 7.2,
      sightlineObstruction: true,
      drainageQuality: 'fair',
    },
  },
  {
    id: 'hotspot_02',
    junctionName: 'Railway Underpass Mile 4 (Sector 9)',
    coordinates: [77.6020, 12.9810],
    riskScore: 68,
    riskLevel: 'HIGH',
    category: 'Waterlogging & Low Overhead Hazard',
    nearMissCountWeekly: 26,
    hardBrakingFrequency: 11.2,
    suddenSlowdownEvents: 89,
    peakRiskTime: 'During & post heavy rain events (>15mm/hr)',
    primaryContributingFactors: [
      'Stormwater sump pump capacity deficit',
      'Overhead bridge clearance restricted to 3.4m',
      'Standing water reduces braking efficiency by 35%',
    ],
    investigationRecommendation:
      'Civil engineering audit required: Upgrade submersible dewatering discharge pumps to 1500 LPM, add physical overhead height clearance gantry with laser tripwire.',
    roadCharacteristics: {
      lanes: 4,
      widthMeters: 13.5,
      sightlineObstruction: false,
      drainageQuality: 'poor',
    },
  },
  {
    id: 'hotspot_03',
    junctionName: 'Indiranagar 100ft Double-Diamond Junction',
    coordinates: [77.6160, 12.9840],
    riskScore: 52,
    riskLevel: 'ELEVATED',
    category: 'Signal Phase Conflict & Pedestrian Crossflow',
    nearMissCountWeekly: 19,
    hardBrakingFrequency: 8.6,
    suddenSlowdownEvents: 64,
    peakRiskTime: '12:00 – 14:00 & 19:00 – 22:00',
    primaryContributingFactors: [
      'Right-turn phase overlapping with pedestrian crosswalk cycle',
      'High two-wheeler lane filtering during amber phase',
    ],
    investigationRecommendation:
      'Traffic signal optimization: Implement split-phase right turns with 4-second all-red pedestrian clearance buffer; coordinate with municipal smart signal network.',
    roadCharacteristics: {
      lanes: 4,
      widthMeters: 16.0,
      sightlineObstruction: false,
      drainageQuality: 'good',
    },
  },
  {
    id: 'hotspot_04',
    junctionName: 'Outer Ring Expressway — Hosur Merge Ramp',
    coordinates: [77.6150, 12.9710],
    riskScore: 48,
    riskLevel: 'ELEVATED',
    category: 'High Speed Differential Weaving',
    nearMissCountWeekly: 15,
    hardBrakingFrequency: 6.9,
    suddenSlowdownEvents: 51,
    peakRiskTime: '06:00 – 08:30 (Freight transition)',
    primaryContributingFactors: [
      'Heavy articulated trucks entering at 30 km/h into 80 km/h traffic',
      'Short acceleration lane length (only 65m)',
    ],
    investigationRecommendation:
      'Infrastructure upgrade: Extend acceleration taper by 110m and restrict heavy commercial vehicles to lane 1 during peak morning windows.',
    roadCharacteristics: {
      lanes: 6,
      widthMeters: 24.0,
      sightlineObstruction: false,
      drainageQuality: 'good',
    },
  },
];

export const HOURLY_RISK_DISTRIBUTION = [
  { hour: '00:00', avgRisk: 16, hardBrakings: 12 },
  { hour: '02:00', avgRisk: 14, hardBrakings: 9 },
  { hour: '04:00', avgRisk: 18, hardBrakings: 14 },
  { hour: '06:00', avgRisk: 32, hardBrakings: 38 },
  { hour: '08:00', avgRisk: 72, hardBrakings: 142 },
  { hour: '10:00', avgRisk: 64, hardBrakings: 110 },
  { hour: '12:00', avgRisk: 48, hardBrakings: 78 },
  { hour: '14:00', avgRisk: 44, hardBrakings: 65 },
  { hour: '16:00', avgRisk: 58, hardBrakings: 95 },
  { hour: '18:00', avgRisk: 82, hardBrakings: 184 },
  { hour: '20:00', avgRisk: 76, hardBrakings: 156 },
  { hour: '22:00', avgRisk: 38, hardBrakings: 46 },
];

export const CITY_SAFETY_METRICS = {
  citySafetyIndex: 78.4, // /100 overall health
  activeMonitoredRoadKm: 428.5,
  connectedTelemetryVehicles: 1840,
  activeHazardClustersToday: 3,
  nearMissesPreventedWeek: 124,
  greenCorridorsGrantedToday: 18,
  avgEmergencyTransitTimeReductionMinutes: 4.6,
};
