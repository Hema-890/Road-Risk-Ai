import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { VehicleCategory, UrgencyLevel } from '../../types';
import { CITY_PRESETS, DEFAULT_CITY, DISPATCH_ORIGINS, DISPATCH_DESTINATIONS } from '../../data/mockScenarios';
import {
  Shield,
  Ambulance,
  Flame,
  Siren,
  LifeBuoy,
  ArrowRight,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building2,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';

export const MissionSetupPanel: React.FC = () => {
  const {
    vehicles,
    selectedVehicle,
    setSelectedVehicleId,
    currentMission,
    updateMissionSetup,
    setMissionOrigin,
    setMissionDestination,
    startRouteSelection,
    loadDemoScenario,
    currentCityId,
    changeCityPreset,
  } = useApp();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [filterCategory, setFilterCategory] = useState<VehicleCategory | 'all'>('all');

  const categories: { id: VehicleCategory | 'all'; label: string; icon: React.ReactNode }[] = [
    { id: 'all', label: 'All', icon: <Shield size={13} /> },
    { id: 'medical', label: 'Medical', icon: <Ambulance size={13} /> },
    { id: 'fire_rescue', label: 'Fire', icon: <Flame size={13} /> },
    { id: 'police', label: 'Police', icon: <Siren size={13} /> },
    { id: 'disaster', label: 'Disaster', icon: <LifeBuoy size={13} /> },
  ];

  const filteredVehicles = filterCategory === 'all'
    ? vehicles
    : vehicles.filter((v) => v.category === filterCategory);

  const urgencyOptions: { level: UrgencyLevel; label: string; desc: string; color: string }[] = [
    {
      level: 'CRITICAL',
      label: 'P1 — Critical Threat',
      desc: 'Maximum route priority, signal preemption & sirens.',
      color: '#f43f5e',
    },
    {
      level: 'HIGH',
      label: 'P2 — Urgent Intervention',
      desc: 'Rapid transit, clear multi-lane arterial preference.',
      color: '#f59e0b',
    },
    {
      level: 'MEDIUM',
      label: 'P3 — Standard Response',
      desc: 'Maximizes road safety margins and transit stability.',
      color: '#38bdf8',
    },
  ];

  if (isCollapsed) {
    return (
      <div className="operator-setup-collapsed-pill animate-fade-in">
        <button
          className="expand-dock-btn"
          onClick={() => setIsCollapsed(false)}
          title="Expand Mission Setup Dock"
        >
          <ChevronRight size={18} />
          <span className="dock-vertical-label">MISSION DISPATCH</span>
        </button>
      </div>
    );
  }

  return (
    <aside className="operator-setup-drawer animate-fade-in" aria-label="Mission Dispatch Panel">
      {/* Dock Header */}
      <div className="setup-drawer-header">
        <div className="setup-title-group">
          <div className="setup-icon-badge">
            <HeartPulse size={18} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="setup-heading">Mission Dispatch</h2>
            <p className="setup-subheading">Unit selection & routing criteria</p>
          </div>
        </div>

        <button
          className="collapse-dock-btn"
          onClick={() => setIsCollapsed(true)}
          title="Collapse Panel (Maximize Map View)"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Quick Presets Ribbon */}
      <div className="quick-presets-strip">
        <span className="pills-label">Presets:</span>
        <button className="quick-pill" onClick={() => loadDemoScenario(1)}>
          <Ambulance size={11} /> Cardiac
        </button>
        <button className="quick-pill" onClick={() => loadDemoScenario(2)}>
          <Flame size={11} /> Fire Tender
        </button>
        <button className="quick-pill" onClick={() => loadDemoScenario(3)}>
          <LifeBuoy size={11} /> Flood NDRF
        </button>
      </div>

      {/* Single Clean Vertical Content Scroll */}
      <div className="setup-dock-scrollable-content custom-scrollbar">
        {/* Step 1: Emergency Unit Selection */}
        <section className="setup-section-card">
          <div className="section-head-row">
            <span className="step-badge font-mono">01</span>
            <h3 className="section-title">Select Response Unit</h3>
            <span className="section-active-tag font-mono">{selectedVehicle.callsign}</span>
          </div>

          {/* Agency Filter Chips */}
          <div className="category-pill-row">
            {categories.map((c) => (
              <button
                key={c.id}
                className={`category-filter-btn ${filterCategory === c.id ? 'active' : ''}`}
                onClick={() => setFilterCategory(c.id)}
              >
                {c.icon}
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          {/* Compact Vehicle Cards List */}
          <div className="vehicles-compact-list">
            {filteredVehicles.map((v) => {
              const isSelected = v.id === selectedVehicle.id;
              return (
                <div
                  key={v.id}
                  className={`vehicle-select-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedVehicleId(v.id)}
                >
                  <div className="v-card-top-row">
                    <span className="v-callsign font-mono">{v.callsign}</span>
                    <span className="v-agency-badge">{v.category.toUpperCase()}</span>
                  </div>
                  <div className="v-title-text">{v.name}</div>
                  <div className="v-specs-mini font-mono">
                    <span>{v.weightTons}T</span> • <span>{v.widthMeters}m W</span> • <span>{v.heightMeters}m H</span>
                  </div>
                  <p className="v-suitability-note">{v.roadSuitabilityNotes}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Step 2: Mission Urgency & Priority */}
        <section className="setup-section-card">
          <div className="section-head-row">
            <span className="step-badge font-mono">02</span>
            <h3 className="section-title">Mission Urgency & Priority</h3>
          </div>

          <div className="form-group">
            <label className="dock-field-label">Emergency Nature</label>
            <input
              type="text"
              className="tactical-input"
              value={currentMission.emergencyType}
              onChange={(e) => updateMissionSetup({ emergencyType: e.target.value })}
              placeholder="e.g. Critical Cardiac Emergency, 4-Alarm Fire"
            />
          </div>

          <div className="urgency-option-stack">
            {urgencyOptions.map((opt) => (
              <div
                key={opt.level}
                className={`urgency-compact-card ${currentMission.urgency === opt.level ? 'active' : ''}`}
                onClick={() => updateMissionSetup({ urgency: opt.level })}
                style={{
                  borderColor: currentMission.urgency === opt.level ? opt.color : 'rgba(38, 52, 73, 0.6)',
                }}
              >
                <div className="urgency-head">
                  <span className="urgency-dot" style={{ background: opt.color }} />
                  <strong className="urgency-title">{opt.label}</strong>
                </div>
                <p className="urgency-desc">{opt.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Step 3: Origin & Destination Routing Endpoints */}
        <section className="setup-section-card">
          <div className="section-head-row">
            <span className="step-badge font-mono">03</span>
            <h3 className="section-title">Geographic Theater & Endpoints</h3>
          </div>

          <div className="form-group">
            <label className="dock-field-label">
              <Sparkles size={12} className="text-sky-400 inline mr-1" />
              Operational Metropolitan Region
            </label>
            <select
              className="tactical-select font-mono"
              value={currentCityId}
              onChange={(e) => changeCityPreset(e.target.value)}
            >
              {Object.values(CITY_PRESETS).map((city) => (
                <option key={city.id} value={city.id}>
                  📍 {city.name}, {city.stateCountry}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="dock-field-label">
              <MapPin size={12} className="text-cyan-400 inline mr-1" />
              Dispatch Origin Station
            </label>
            <select
              className="tactical-select font-mono"
              value={
                (CITY_PRESETS[currentCityId] || DEFAULT_CITY).origins.find((o) => o.name === currentMission.origin)?.id ||
                (CITY_PRESETS[currentCityId] || DEFAULT_CITY).origins[0]?.id
              }
              onChange={(e) => setMissionOrigin(e.target.value)}
            >
              {(CITY_PRESETS[currentCityId] || DEFAULT_CITY).origins.map((orig) => (
                <option key={orig.id} value={orig.id}>
                  {orig.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="dock-field-label">
              <Building2 size={12} className="text-emerald-400 inline mr-1" />
              Destination Trauma Facility
            </label>
            <select
              className="tactical-select font-mono"
              value={
                (CITY_PRESETS[currentCityId] || DEFAULT_CITY).destinations.find((d) => d.name === currentMission.destination)?.id ||
                (CITY_PRESETS[currentCityId] || DEFAULT_CITY).destinations[0]?.id
              }
              onChange={(e) => setMissionDestination(e.target.value)}
            >
              {(CITY_PRESETS[currentCityId] || DEFAULT_CITY).destinations.map((dest) => (
                <option key={dest.id} value={dest.id}>
                  {dest.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="dock-field-label">Patient Vitals / Special Hazards</label>
            <textarea
              className="tactical-textarea"
              rows={2}
              value={currentMission.patientVitals || ''}
              onChange={(e) => updateMissionSetup({ patientVitals: e.target.value })}
              placeholder="Live patient stats or dimensional transit constraints..."
            />
          </div>
        </section>
      </div>

      {/* Persistent Bottom Action Button */}
      <div className="setup-dock-footer">
        <button className="commence-dispatch-btn" onClick={startRouteSelection}>
          <span>Evaluate Predictive Corridors</span>
          <ArrowRight size={17} />
        </button>
      </div>
    </aside>
  );
};
export default MissionSetupPanel;
