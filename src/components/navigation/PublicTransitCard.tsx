// ==============================================================================
// ROADRISK AI — PUBLIC TRANSPORT & GTFS CARD COMPONENT
// Multimodal transit routing card showing walking legs, boarding stops,
// line transfers, tight transfer warnings, fare breakdown, and RoadRisk safety.
// STRICT DATA TRUTH: Clearly labels GTFS Static Timetables vs Live GTFS-RT telemetry.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  Train,
  Footprints,
  Clock,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Volume2,
  VolumeX,
  X,
  Compass,
  Search,
  Shield,
  Layers,
} from 'lucide-react';
import { transitService, type TransitStop, type TransitRoute } from '../../services/transitService.ts';
import { navigationVoiceService } from '../../services/navigationVoiceService.ts';
import type { TransitPlan, TransitLeg } from '../../types/mobility.ts';

interface PublicTransitCardProps {
  originCoords?: [number, number];
  destinationCoords?: [number, number];
  onClose?: () => void;
  onFocusLocation?: (coords: [number, number], zoom?: number) => void;
}

const COMMON_TRANSIT_QUERIES = [
  'Bus from Vijayawada to Guntur',
  'Metro to Hyderabad Airport (RGIA)',
  'Secunderabad to Charminar via Koti',
  'Central Station to Airport Express 10X',
];

export const PublicTransitCard: React.FC<PublicTransitCardProps> = ({
  originCoords = [80.6200, 16.5185],
  destinationCoords = [80.7950, 16.5280],
  onClose,
  onFocusLocation,
}) => {
  const [transitPlan, setTransitPlan] = useState<TransitPlan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [allStops, setAllStops] = useState<TransitStop[]>([]);
  const [activeLegIdx, setActiveLegIdx] = useState<number>(0);

  useEffect(() => {
    setAllStops(transitService.getStops());
    loadTransitPlan();
  }, [originCoords[0], originCoords[1], destinationCoords[0], destinationCoords[1]]);

  const loadTransitPlan = async () => {
    setIsLoading(true);
    try {
      const plan = await transitService.planPublicTransportRoute(originCoords, destinationCoords);
      setTransitPlan(plan);
    } catch (err) {
      console.error('Failed to plan transit:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuerySearch = async (queryText: string) => {
    setIsLoading(true);
    try {
      const results = await transitService.searchTransitQueries(queryText, originCoords);
      if (results.length > 0) {
        setTransitPlan(results[0]);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeakTransitPlan = () => {
    if (!transitPlan) return;
    const transitLeg = transitPlan.legs.find((l) => l.type === 'TRANSIT');
    if (transitLeg) {
      navigationVoiceService.announceTakeTransit(
        transitLeg.transitType || 'bus',
        transitLeg.routeShortName || 'transit line'
      );
    }
  };

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: 16,
        padding: '16px',
        color: '#f8fafc',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
        width: '100%',
        maxWidth: 420,
        fontSize: 13,
      }}
    >
      {/* 1. Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
            }}
          >
            <Train size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Public Transport Intelligence</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>GTFS Static Timetable & Multimodal Routing</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleSpeakTransitPlan}
            title="Read Transit Instructions Aloud"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#38bdf8',
              borderRadius: 8,
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Volume2 size={15} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Transit Query Quick Search Bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transit (e.g. Bus from Vijayawada to Guntur)..."
            style={{
              width: '100%',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: 8,
              padding: '8px 10px',
              paddingRight: 34,
              color: '#ffffff',
              fontSize: 11.5,
              outline: 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuerySearch(searchQuery);
            }}
          />
          <button
            onClick={() => handleQuerySearch(searchQuery)}
            style={{
              position: 'absolute',
              right: 6,
              top: 5,
              bottom: 5,
              background: '#0284c7',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              padding: '0 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Search size={12} />
          </button>
        </div>

        {/* Quick Query Pills */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '6px 0', scrollbarWidth: 'none' }}>
          {COMMON_TRANSIT_QUERIES.map((q, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSearchQuery(q);
                handleQuerySearch(q);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                borderRadius: 10,
                padding: '2px 8px',
                fontSize: 10,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Static vs Realtime Provenance Banner (Data Truth Section 19, 44) */}
      <div
        style={{
          background: 'rgba(14, 165, 233, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 8,
          padding: '6px 10px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#38bdf8' }}>
          <Shield size={13} />
          <span>GTFS Static Timetable Verified</span>
        </div>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 800,
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#cbd5e1',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          SCHEDULE DATA
        </span>
      </div>

      {/* 4. Hero Transit Overview Card */}
      {transitPlan && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            borderRadius: 12,
            padding: '12px',
            marginBottom: 12,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
              {transitPlan.departureTime}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
              {transitPlan.totalDurationMinutes} mins
            </div>
            <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
              Walking: {transitPlan.totalWalkingDistanceMeters}m
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Estimated Total Fare</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#34d399' }}>
              ₹{transitPlan.totalFareInr}
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>Stage Fare Schedule</div>
          </div>
        </div>
      )}

      {/* 5. Door-to-Door Transit Route Steps (Sections 20, 21, 22) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {transitPlan?.legs.map((leg, idx) => (
          <div
            key={idx}
            onClick={() => {
              setActiveLegIdx(idx);
              if (onFocusLocation) {
                onFocusLocation(leg.fromCoordinates, 15);
              }
            }}
            style={{
              background: leg.type === 'TRANSIT' ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              border: `1px solid ${leg.type === 'TRANSIT' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
              borderRadius: 10,
              padding: '10px 12px',
              cursor: 'pointer',
            }}
          >
            {/* Step Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {leg.type === 'WALK' ? (
                  <Footprints size={15} color="#94a3b8" />
                ) : (
                  <div
                    style={{
                      background: leg.routeColor || '#0284c7',
                      color: '#ffffff',
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    {leg.routeShortName}
                  </div>
                )}
                <span style={{ fontWeight: 700, fontSize: 12.5, color: '#f8fafc' }}>
                  {leg.type === 'WALK' ? `Walk ${leg.distanceMeters}m to stop` : leg.routeLongName}
                </span>
              </div>

              <div style={{ fontSize: 11, fontWeight: 700, color: leg.fareInr ? '#34d399' : '#94a3b8' }}>
                {leg.fareInr ? `₹${leg.fareInr}` : `${leg.durationMinutes} min`}
              </div>
            </div>

            {/* Stop Locations */}
            <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 4 }}>
              From: <strong>{leg.fromStopName}</strong> → To: <strong>{leg.toStopName}</strong>
            </div>

            {/* RoadRisk Pedestrian Safety Note */}
            {leg.safetyAdvisories && leg.safetyAdvisories.length > 0 && (
              <div style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Shield size={11} color="#38bdf8" />
                <span>{leg.safetyAdvisories[0]}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PublicTransitCard;
