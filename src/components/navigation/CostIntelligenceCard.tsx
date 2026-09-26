// ==============================================================================
// ROADRISK AI — COST INTELLIGENCE CARD & COMPARISON COMPONENT
// Transparent journey cost breakdown (Fuel, Tolls, Parking, Transit, Charging),
// user vehicle configuration, multi-mode trade-off comparison, and budget checker.
// MAP-FIRST: Collapsible glassmorphism panel, never blocks full map.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Fuel,
  Zap,
  Shield,
  ChevronDown,
  ChevronUp,
  Sliders,
  Car,
  Bike,
  Train,
  Footprints,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  CreditCard,
  RotateCcw,
} from 'lucide-react';
import {
  mobilityIntelligenceService,
  type BudgetEvaluationResult,
} from '../../services/mobilityIntelligenceService.ts';
import type {
  JourneyCost,
  ModeComparisonItem,
  UserVehicleProfile,
  TransportMode,
} from '../../types/index.ts';

interface CostIntelligenceCardProps {
  distanceKm: number;
  activeTransportMode: TransportMode;
  routeSummary?: string;
  hasTolls?: boolean;
  onSelectMode?: (mode: TransportMode) => void;
  onClose?: () => void;
}

export const CostIntelligenceCard: React.FC<CostIntelligenceCardProps> = ({
  distanceKm,
  activeTransportMode,
  routeSummary = '',
  hasTolls = false,
  onSelectMode,
  onClose,
}) => {
  const [costData, setCostData] = useState<JourneyCost>(() =>
    mobilityIntelligenceService.calculateJourneyCost(distanceKm, activeTransportMode, {
      routeSummary,
      hasTolls,
      destinationParkingType: 'paid',
    })
  );

  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showComparisonModal, setShowComparisonModal] = useState<boolean>(false);
  const [modeComparisons, setModeComparisons] = useState<ModeComparisonItem[]>([]);
  const [budgetInput, setBudgetInput] = useState<string>('500');
  const [budgetResult, setBudgetResult] = useState<BudgetEvaluationResult | null>(null);
  const [vehicleProfile, setVehicleProfile] = useState<UserVehicleProfile>(
    mobilityIntelligenceService.getVehicleProfile()
  );

  // Recalculate on distance, mode, or toll change
  useEffect(() => {
    const updated = mobilityIntelligenceService.calculateJourneyCost(
      distanceKm,
      activeTransportMode,
      {
        routeSummary,
        hasTolls,
        destinationParkingType: 'paid',
      }
    );
    setCostData(updated);

    const comp = mobilityIntelligenceService.compareTransportModes(distanceKm, Math.round((distanceKm / 35) * 60), hasTolls);
    setModeComparisons(comp);
  }, [distanceKm, activeTransportMode, routeSummary, hasTolls]);

  // Handle budget constraint evaluation
  const handleCheckBudget = () => {
    const budgetVal = parseInt(budgetInput.replace(/,/g, ''), 10);
    if (!isNaN(budgetVal) && budgetVal > 0) {
      const res = mobilityIntelligenceService.evaluateBudgetConstraint(
        budgetVal,
        distanceKm,
        activeTransportMode,
        { hasTolls }
      );
      setBudgetResult(res);
    }
  };

  const handleSaveVehicleProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = mobilityIntelligenceService.setVehicleProfile(vehicleProfile);
    setVehicleProfile(updated);
    setShowConfigModal(false);

    // Refresh active cost
    const refreshed = mobilityIntelligenceService.calculateJourneyCost(
      distanceKm,
      activeTransportMode,
      { routeSummary, hasTolls, destinationParkingType: 'paid' }
    );
    setCostData(refreshed);
  };

  return (
    <div
      style={{
        background: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(56, 189, 248, 0.25)',
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <DollarSign size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '0.01em' }}>
              Journey Cost Intelligence
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              {distanceKm.toFixed(1)} km • {activeTransportMode} Mode
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setShowConfigModal(true)}
            title="Configure Vehicle & Fuel Tariff"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              borderRadius: 8,
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Sliders size={14} />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              borderRadius: 8,
              padding: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Hero Total Cost Badge */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(30, 41, 59, 0.5))',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: 12,
          padding: '12px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Estimated Total
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#ffffff', lineHeight: 1.1 }}>
            ₹{costData.totalCost.amount}
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginLeft: 6 }}>
              (₹{costData.costPerKm}/km)
            </span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              fontSize: 10,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 10,
              border: '1px solid rgba(52, 211, 153, 0.3)',
            }}
          >
            MODEL ESTIMATE
          </span>
          <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
            {costData.co2EmissionsKg > 0 ? `${costData.co2EmissionsKg} kg CO₂` : 'Zero Tailpipe CO₂'}
          </div>
        </div>
      </div>

      {/* 3. Expandable Cost Breakdown List */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {/* Fuel / Energy Expense */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {vehicleProfile.fuelType === 'electric' ? <Zap size={14} color="#38bdf8" /> : <Fuel size={14} color="#f59e0b" />}
              <div>
                <div style={{ fontWeight: 600, color: '#f1f5f9' }}>
                  {vehicleProfile.fuelType === 'electric' ? 'EV Battery Charging' : 'Fuel (Petrol/Diesel)'}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                  {costData.fuelLitersUsed ? `${costData.fuelLitersUsed} L required` : costData.electricityKwhUsed ? `${costData.electricityKwhUsed} kWh needed` : 'Direct energy calculation'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                ₹{costData.fuelCost.amount + costData.chargingCost.amount}
              </div>
              <div style={{ fontSize: 9.5, color: '#64748b' }}>Estimated</div>
            </div>
          </div>

          {/* Tolls Expense */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CreditCard size={14} color="#a855f7" />
              <div>
                <div style={{ fontWeight: 600, color: '#f1f5f9' }}>National Highway Tolls</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                  {costData.provenance.tollDataSource === 'FREE'
                    ? 'Toll-free / Two-wheeler exempt'
                    : costData.provenance.tollDataSource === 'ESTIMATED'
                    ? 'NHAI Plaza Electronic Collection'
                    : 'No toll data reported'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                ₹{costData.tollCost.amount}
              </div>
              <div style={{ fontSize: 9.5, color: costData.tollCost.amount > 0 ? '#c084fc' : '#64748b' }}>
                {costData.provenance.tollDataSource}
              </div>
            </div>
          </div>

          {/* Parking Expense */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Car size={14} color="#10b981" />
              <div>
                <div style={{ fontWeight: 600, color: '#f1f5f9' }}>Destination Parking</div>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>
                  {costData.parkingCost.amount > 0 ? 'Commercial Lot Rate (2 hrs)' : 'Free Street Parking'}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                ₹{costData.parkingCost.amount}
              </div>
              <div style={{ fontSize: 9.5, color: '#64748b' }}>Estimated</div>
            </div>
          </div>

          {/* Public Transit Fare (if transit) */}
          {activeTransportMode === 'TRANSIT' && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(56, 189, 248, 0.08)',
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid rgba(56, 189, 248, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Train size={14} color="#38bdf8" />
                <div>
                  <div style={{ fontWeight: 600, color: '#f1f5f9' }}>Municipal Transit Ticket</div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>APSRTC/TSRTC Distance Stage Tariff</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, color: '#38bdf8' }}>
                  ₹{costData.transitCost.amount}
                </div>
                <div style={{ fontSize: 9.5, color: '#64748b' }}>Stage Fare</div>
              </div>
            </div>
          )}

          {/* Honest Disclaimer */}
          <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4, fontStyle: 'italic', marginTop: 2 }}>
            ⓘ {costData.disclaimer}
          </div>
        </div>
      )}

      {/* 4. Budget Constraint Intelligence Box */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.35)',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
            Trip Budget Limit:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#cbd5e1' }}>₹</span>
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="e.g. 500"
              style={{
                width: 70,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                padding: '3px 6px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 700,
                textAlign: 'right',
              }}
            />
            <button
              onClick={handleCheckBudget}
              style={{
                background: '#0284c7',
                border: 'none',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Check
            </button>
          </div>
        </div>

        {budgetResult && (
          <div
            style={{
              marginTop: 6,
              padding: '6px 8px',
              borderRadius: 6,
              background: budgetResult.isWithinBudget ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              border: `1px solid ${budgetResult.isWithinBudget ? 'rgba(52, 211, 153, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`,
              fontSize: 11,
              color: budgetResult.isWithinBudget ? '#34d399' : '#f87171',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 6,
            }}
          >
            {budgetResult.isWithinBudget ? (
              <CheckCircle2 size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            ) : (
              <AlertTriangle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            )}
            <div style={{ lineHeight: 1.3 }}>
              {budgetResult.statusMessage}
              {budgetResult.recommendedMode && onSelectMode && budgetResult.recommendedMode !== activeTransportMode && (
                <button
                  onClick={() => onSelectMode(budgetResult.recommendedMode!)}
                  style={{
                    display: 'block',
                    marginTop: 4,
                    background: 'rgba(255,255,255,0.15)',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Switch to {budgetResult.recommendedMode}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Action Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        <button
          onClick={() => setShowComparisonModal(true)}
          style={{
            background: 'rgba(56, 189, 248, 0.12)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            color: '#38bdf8',
            borderRadius: 8,
            padding: '8px',
            fontWeight: 700,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>Compare All Modes (Car vs Bike vs Transit)</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Modal: Vehicle Profile Configuration */}
      {showConfigModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 16,
              padding: 20,
              maxWidth: 380,
              width: '100%',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Configure Vehicle & Fuel</div>
              <button
                onClick={() => setShowConfigModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicleProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Vehicle Fuel Type:
                </label>
                <select
                  value={vehicleProfile.fuelType}
                  onChange={(e) =>
                    setVehicleProfile({
                      ...vehicleProfile,
                      fuelType: e.target.value as any,
                      unitCostInr:
                        e.target.value === 'diesel'
                          ? 97.5
                          : e.target.value === 'cng'
                          ? 85.0
                          : e.target.value === 'electric'
                          ? 8.5
                          : 109.5,
                    })
                  }
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    padding: 8,
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                >
                  <option value="petrol">Petrol (ICE)</option>
                  <option value="diesel">Diesel (ICE)</option>
                  <option value="cng">CNG (Clean Gas)</option>
                  <option value="electric">Electric (EV Battery)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Efficiency ({vehicleProfile.fuelType === 'electric' ? 'km/kWh' : 'km/L'}):
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={vehicleProfile.efficiencyKmPerUnit}
                  onChange={(e) =>
                    setVehicleProfile({
                      ...vehicleProfile,
                      efficiencyKmPerUnit: parseFloat(e.target.value) || 14.5,
                    })
                  }
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    padding: 8,
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', display: 'block', marginBottom: 4 }}>
                  Fuel / Electricity Tariff (₹/{vehicleProfile.fuelType === 'electric' ? 'kWh' : 'L'}):
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={vehicleProfile.unitCostInr}
                  onChange={(e) =>
                    setVehicleProfile({
                      ...vehicleProfile,
                      unitCostInr: parseFloat(e.target.value) || 109.5,
                    })
                  }
                  style={{
                    width: '100%',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#fff',
                    padding: 8,
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid #475569',
                    color: '#cbd5e1',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: '#0284c7',
                    border: 'none',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '8px 14px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Multi-Mode Side-by-Side Comparison */}
      {showComparisonModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 16,
              padding: 20,
              maxWidth: 580,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              color: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Transport Mode Trade-off Matrix</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {distanceKm.toFixed(1)} km corridor comparison across supported modes
                </div>
              </div>
              <button
                onClick={() => setShowComparisonModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {modeComparisons.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: item.isRecommended ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${item.isRecommended ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.mode === 'CAR' ? <Car size={16} color="#38bdf8" /> : item.mode === 'BIKE' ? <Bike size={16} color="#f59e0b" /> : item.mode === 'TRANSIT' ? <Train size={16} color="#10b981" /> : <Footprints size={16} color="#a855f7" />}
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</span>
                      {item.isRecommended && (
                        <span style={{ fontSize: 10, background: '#0284c7', color: '#fff', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>
                          RECOMMENDED
                        </span>
                      )}
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#38bdf8' }}>
                        ₹{item.estimatedCostInr}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>
                        ~{item.durationMinutes} mins
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, fontSize: 11, color: '#cbd5e1', marginBottom: 6 }}>
                    <div>Risk Score: <strong>{item.riskScore}/100</strong></div>
                    <div>CO₂: <strong>{item.co2Kg} kg</strong></div>
                    <div>Traffic Delay: <strong>+{item.trafficDelayMinutes}m</strong></div>
                  </div>

                  <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginBottom: 6 }}>
                    {item.tradeoffSummary}
                  </div>

                  {onSelectMode && (
                    <button
                      onClick={() => {
                        onSelectMode(item.mode);
                        setShowComparisonModal(false);
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#f8fafc',
                        borderRadius: 6,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Select this Mode
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostIntelligenceCard;
