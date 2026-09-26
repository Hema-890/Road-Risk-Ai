import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { VehicleProfile, VehicleCategory } from '../../types';
import {
  Truck,
  Ambulance,
  Flame,
  Siren,
  LifeBuoy,
  Shield,
  Activity,
  Navigation,
  Compass,
  Zap,
  Radio,
  Clock,
  ArrowUpRight,
  Crosshair,
  Sparkles,
} from 'lucide-react';

export const FleetPortal: React.FC = () => {
  const {
    vehicles,
    selectedVehicle,
    setSelectedVehicleId,
    setActivePortal,
    currentMission,
    flyToLocation,
    telemetry,
  } = useApp();

  const [categoryFilter, setCategoryFilter] = useState<VehicleCategory | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredVehicles = vehicles.filter((v) => {
    const matchesCategory = categoryFilter === 'all' || v.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesCategory && matchesStatus;
  });

  const getStatusBadgeClass = (status: VehicleProfile['status']) => {
    switch (status) {
      case 'EN_ROUTE':
        return 'status-en-route';
      case 'DISPATCHED':
        return 'status-dispatched';
      case 'AT_SCENE':
        return 'status-at-scene';
      case 'HAZARD_ALERT':
        return 'status-hazard-alert';
      default:
        return 'status-available';
    }
  };

  const getCategoryIcon = (cat: VehicleCategory) => {
    switch (cat) {
      case 'medical':
        return <Ambulance size={15} className="text-cyan-400" />;
      case 'fire_rescue':
        return <Flame size={15} className="text-orange-400" />;
      case 'police':
        return <Siren size={15} className="text-blue-400" />;
      case 'disaster':
        return <LifeBuoy size={15} className="text-amber-400" />;
      default:
        return <Shield size={15} className="text-emerald-400" />;
    }
  };

  const handleSelectAndFocus = (vehicle: VehicleProfile) => {
    setSelectedVehicleId(vehicle.id);
    flyToLocation(vehicle.currentLocation, 15.8);
  };

  const handleDispatchUnit = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    setActivePortal('operator');
  };

  return (
    <div className="fleet-portal-layout animate-fade-in">
      {/* Fleet Command Header & Filters */}
      <div className="fleet-header-panel">
        <div className="fleet-header-left">
          <div className="fleet-icon-wrapper">
            <Truck size={22} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="fleet-title">Metropolitan Priority Fleet Command</h2>
            <p className="fleet-subtitle">
              Live multi-agency telemetry, road-suitability clearance, and active mission synchronization
            </p>
          </div>
        </div>

        {/* Filters Cluster */}
        <div className="fleet-filters-cluster">
          <div className="filter-select-box">
            <span className="filter-label">Agency:</span>
            <select
              className="tactical-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as VehicleCategory | 'all')}
            >
              <option value="all">All Agencies ({vehicles.length})</option>
              <option value="medical">Medical (ALS / BLS)</option>
              <option value="fire_rescue">Fire & Rescue</option>
              <option value="police">Police Interceptors</option>
              <option value="disaster">NDRF / SDRF Disaster</option>
              <option value="critical_govt">Critical Infrastructure</option>
            </select>
          </div>

          <div className="filter-select-box">
            <span className="filter-label">Status:</span>
            <select
              className="tactical-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="AVAILABLE">Available</option>
              <option value="EN_ROUTE">En Route (Active)</option>
              <option value="HAZARD_ALERT">Hazard Alert</option>
              <option value="AT_SCENE">At Scene</option>
            </select>
          </div>
        </div>
      </div>

      {/* Fleet Vehicles Grid */}
      <div className="fleet-vehicles-grid custom-scrollbar">
        {filteredVehicles.map((v) => {
          const isSelected = v.id === selectedVehicle.id;
          const isLiveEnRoute = v.status === 'EN_ROUTE';

          return (
            <div
              key={v.id}
              className={`fleet-vehicle-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSelectAndFocus(v)}
            >
              {/* Card Top */}
              <div className="v-card-top">
                <div className="v-callsign-group">
                  <div className="v-icon-badge">{getCategoryIcon(v.category)}</div>
                  <div>
                    <h3 className="v-callsign-text font-mono">{v.callsign}</h3>
                    <span className="v-type-text">{v.type}</span>
                  </div>
                </div>

                <span className={`fleet-status-pill ${getStatusBadgeClass(v.status)} font-mono`}>
                  {v.status.replace('_', ' ')}
                </span>
              </div>

              {/* Dynamic In-Flight Status or Standby Location */}
              {isLiveEnRoute ? (
                <div className="v-mission-active-badge">
                  <Activity size={13} className="text-cyan-400 animate-pulse" />
                  <span className="font-mono text-cyan-300">
                    MISSION: {currentMission.id} • {telemetry.speedKmh} KM/H
                  </span>
                </div>
              ) : (
                <div className="v-location-status font-mono">
                  <Navigation size={12} className="text-slate-400" />
                  <span>Coord: [{v.currentLocation[0].toFixed(3)}, {v.currentLocation[1].toFixed(3)}]</span>
                </div>
              )}

              {/* Dimensions & Clearance Specs */}
              <div className="v-card-specs-grid font-mono">
                <div className="spec-item">
                  <span className="spec-k">Width:</span>
                  <span className="spec-v">{v.widthMeters}m</span>
                </div>
                <div className="spec-item">
                  <span className="spec-k">Weight:</span>
                  <span className="spec-v">{v.weightTons}T</span>
                </div>
                <div className="spec-item">
                  <span className="spec-k">Turning:</span>
                  <span className="spec-v">{v.turningRadiusMeters}m</span>
                </div>
                <div className="spec-item">
                  <span className="spec-k">Max Spd:</span>
                  <span className="spec-v">{v.maxSpeedKmh}kph</span>
                </div>
              </div>

              <p className="v-card-notes">{v.roadSuitabilityNotes}</p>

              {/* Action Buttons */}
              <div className="v-card-actions">
                <button
                  className="v-focus-map-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    flyToLocation(v.currentLocation, 16.0);
                  }}
                  title="Focus Map on Vehicle Location"
                >
                  <Crosshair size={13} />
                  <span>Locate</span>
                </button>

                <button
                  className="v-dispatch-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDispatchUnit(v.id);
                  }}
                  title="Dispatch or Re-assign in Operator Portal"
                >
                  <span>{isLiveEnRoute ? 'Live Cockpit' : 'Dispatch Unit'}</span>
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default FleetPortal;
