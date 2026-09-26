// ==============================================================================
// ROADRISK AI — LOGISTICS & DELIVERY INTELLIGENCE CARD COMPONENT
// Fleet delivery dashboard, priority-aware stop sequencing, time windows,
// cost per stop, stop actions, and dynamic reroute demonstration on road closures.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  Package,
  Truck,
  MapPin,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  RotateCcw,
  Zap,
  Shield,
  X,
  Play,
  PhoneCall,
  User,
} from 'lucide-react';
import { logisticsService } from '../../services/logisticsService.ts';
import { roadRiskOrchestrator } from '../../services/roadRiskOrchestrator.ts';
import { navigationVoiceService } from '../../services/navigationVoiceService.ts';
import { eventBus } from '../../services/eventBus.ts';
import type { LogisticsPlan, DeliveryStop, DeliveryStatus } from '../../types/index.ts';

interface LogisticsDashboardCardProps {
  onClose?: () => void;
  onFocusLocation?: (coords: [number, number], zoom?: number) => void;
  onStartNavigation?: (stop: DeliveryStop) => void;
}

export const LogisticsDashboardCard: React.FC<LogisticsDashboardCardProps> = ({
  onClose,
  onFocusLocation,
  onStartNavigation,
}) => {
  const [plan, setPlan] = useState<LogisticsPlan | null>(() => logisticsService.getActivePlan());
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [isSimulatingHazard, setIsSimulatingHazard] = useState<boolean>(false);

  useEffect(() => {
    const unsub = logisticsService.subscribe((updated) => {
      setPlan({ ...updated });
    });
    return unsub;
  }, []);

  if (!plan) return null;

  const currentStop = logisticsService.getCurrentDeliveryStop();

  const handleStopClick = (stop: DeliveryStop) => {
    setActiveStopId(stop.id);
    if (onFocusLocation) {
      onFocusLocation(stop.location.coordinates, 15);
    }
  };

  const handleNavigateStop = (stop: DeliveryStop, e: React.MouseEvent) => {
    e.stopPropagation();
    navigationVoiceService.announceNextDeliveryStop(stop.customerName);
    roadRiskOrchestrator.startNavigation();
    if (onStartNavigation) {
      onStartNavigation(stop);
    }
  };

  const handleMarkDelivered = (stopId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    logisticsService.updateStopStatus(stopId, 'completed');
    navigationVoiceService.announceDeliveryArrived();
  };

  const handleSkipStop = (stopId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    logisticsService.updateStopStatus(stopId, 'skipped');
  };

  // Golden Demo 2: Road Closed Simulation & Dynamic Recalculation (Section 53)
  const handleSimulateRoadClosure = () => {
    setIsSimulatingHazard(true);
    // Publish standard EventBus event
    eventBus.emit('ROAD_CLOSED', {
      title: 'Waterlogging & NH16 Flyover Closure',
      category: 'ROAD_CLOSED',
      coordinates: [80.6480, 16.5062],
      severity: 'critical',
    });

    logisticsService.handleHazardEventTrigger('ROAD_CLOSED', 'Severe Waterlogging & NH16 Flyover Closure');
    navigationVoiceService.announceRoadClosureAhead();

    setTimeout(() => {
      setIsSimulatingHazard(false);
    }, 2500);
  };

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: 16,
        padding: '16px',
        color: '#f8fafc',
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
        width: '100%',
        maxWidth: 440,
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
              background: 'rgba(245, 158, 11, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fbbf24',
            }}
          >
            <Package size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Logistics & Delivery Optimizer</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Fleet: {plan.assignedVehicle.name} • Driver: {plan.assignedVehicle.driverName}
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 2. Fleet Metrics Overview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 10,
          padding: '10px 8px',
          marginBottom: 12,
          textAlign: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Stops</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#ffffff' }}>
            {plan.completedStops}/{plan.totalStops}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Distance</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#38bdf8' }}>
            {plan.totalDistanceKm} km
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Total Cost</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#34d399' }}>
            ₹{plan.totalCostInr}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Cost/Stop</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#fbbf24' }}>
            ₹{plan.costPerStopInr}
          </div>
        </div>
      </div>

      {/* 3. Golden Demo 2: Dynamic Rerouting Simulator Button */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={handleSimulateRoadClosure}
          disabled={isSimulatingHazard}
          style={{
            width: '100%',
            background: isSimulatingHazard
              ? 'rgba(239, 68, 68, 0.25)'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(245, 158, 11, 0.15))',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 11.5,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <AlertTriangle size={14} />
          <span>
            {isSimulatingHazard ? 'Recalculating Detour on Road Closure...' : 'Inject ROAD_CLOSED Event (Test Dynamic Reroute)'}
          </span>
        </button>

        {plan.rerouteCount > 0 && plan.lastRerouteReason && (
          <div
            style={{
              marginTop: 6,
              padding: '6px 8px',
              borderRadius: 6,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              fontSize: 10.5,
              color: '#fca5a5',
            }}
          >
            ⚠️ {plan.lastRerouteReason} (+1.8 km detour, +7 mins)
          </div>
        )}
      </div>

      {/* 4. Delivery Stops List (Sections 32 & 33) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
        {plan.stops.map((stop, idx) => {
          const isCurrent = idx === plan.currentStopIndex;
          const isDone = stop.status === 'completed';
          const isHighPriority = stop.priority === 'HIGH';

          return (
            <div
              key={stop.id}
              onClick={() => handleStopClick(stop)}
              style={{
                background: isDone
                  ? 'rgba(255, 255, 255, 0.02)'
                  : isCurrent
                  ? 'rgba(245, 158, 11, 0.12)'
                  : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${
                  isDone
                    ? 'rgba(255, 255, 255, 0.05)'
                    : isCurrent
                    ? 'rgba(245, 158, 11, 0.5)'
                    : 'rgba(255, 255, 255, 0.08)'
                }`,
                borderRadius: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                opacity: isDone ? 0.65 : 1,
              }}
            >
              {/* Stop Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      background: isDone ? '#10b981' : isCurrent ? '#f59e0b' : '#334155',
                      color: '#ffffff',
                      fontSize: 10,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isDone ? '✓' : idx + 1}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 12.5, color: '#f8fafc' }}>
                    {stop.customerName}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      padding: '2px 5px',
                      borderRadius: 4,
                      background: isHighPriority ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                      color: isHighPriority ? '#f87171' : '#94a3b8',
                      border: `1px solid ${isHighPriority ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                    }}
                  >
                    {stop.priority}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8' }}>
                    ETA: {stop.eta}
                  </span>
                </div>
              </div>

              {/* Stop Address & Package */}
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
                {stop.address} • {stop.packageWeightKg} kg ({stop.packageDescription})
              </div>

              {/* Risk explanation */}
              {stop.riskExplanation && (
                <div style={{ fontSize: 10, color: '#cbd5e1', marginBottom: 6, fontStyle: 'italic' }}>
                  RoadRisk: {stop.riskExplanation}
                </div>
              )}

              {/* Action Buttons */}
              {!isDone && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    onClick={(e) => handleNavigateStop(stop, e)}
                    style={{
                      flex: 1,
                      background: '#0284c7',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Navigation size={12} />
                    <span>Navigate</span>
                  </button>

                  <button
                    onClick={(e) => handleMarkDelivered(stop.id, e)}
                    style={{
                      background: 'rgba(16, 185, 129, 0.2)',
                      border: '1px solid rgba(52, 211, 153, 0.4)',
                      color: '#34d399',
                      borderRadius: 6,
                      padding: '5px 8px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Delivered
                  </button>

                  <button
                    onClick={(e) => handleSkipStop(stop.id, e)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#94a3b8',
                      borderRadius: 6,
                      padding: '5px 8px',
                      fontSize: 10.5,
                      cursor: 'pointer',
                    }}
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LogisticsDashboardCard;
