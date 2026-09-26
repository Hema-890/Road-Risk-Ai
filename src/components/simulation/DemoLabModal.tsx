import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  FlaskConical,
  X,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  AlertTriangle,
  CloudRain,
  ShieldAlert,
  Zap,
  Radio,
  CheckCircle,
  Truck,
  Ambulance,
  Flame,
  LifeBuoy,
  Sparkles,
} from 'lucide-react';

interface DemoLabModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoLabModal: React.FC<DemoLabModalProps> = ({ isOpen, onClose }) => {
  const {
    loadDemoScenario,
    triggerHazardInjection,
    clearHazards,
    weatherState,
    setWeatherState,
    simulationSpeed,
    setSimulationSpeed,
    isSimulationPlaying,
    setIsSimulationPlaying,
    stepSimulation,
    activeHazards,
    resetToMissionSetup,
    selectedVehicle,
    selectedRoute,
    currentMission,
    toggleGreenCorridorSignal,
    greenCorridor,
    setActivePortal,
    startNavigationMission,
  } = useApp();

  if (!isOpen) return null;

  const scenarios = [
    {
      num: 1 as const,
      title: 'Scenario 1: Critical Cardiac Ambulance',
      vehicle: 'MEDIC-ONE (ALS Ambulance)',
      desc: 'Ambulance navigates towards Apex Trauma Hub. Emerging braking cluster at Junction 17 triggers dynamic reroute via Smart Green Corridor.',
      icon: <Ambulance size={18} className="text-cyan-400" />,
      tag: 'RECOMMENDED CORRIDOR',
    },
    {
      num: 2 as const,
      title: 'Scenario 2: Heavy Fire Engine Clearance',
      vehicle: 'FIRE-ENGINE-09 (18.5T Water Tender)',
      desc: 'Heavy 2.65m wide chassis evaluates clearance. Narrow overpass bottleneck is flagged and traffic routing steers to 24m wide Outer Ring Expressway.',
      icon: <Flame size={18} className="text-orange-400" />,
      tag: 'DIMENSIONAL ENVELOPE',
    },
    {
      num: 3 as const,
      title: 'Scenario 3: Monsoon Flood Inundation',
      vehicle: 'NDRF-CORPS-05 (Flood Rescue Carrier)',
      desc: 'Monsoon rain surge causes 42cm flooding in Railway Underpass. Standard units divert while amphibious rescue unit handles waterlogged sector.',
      icon: <LifeBuoy size={18} className="text-amber-400" />,
      tag: 'WEATHER & HYDROLOGY',
    },
    {
      num: 4 as const,
      title: 'Scenario 4: High-Speed Police Tactical Intercept',
      vehicle: 'PATROL-BRAVO-12 (Police Interceptor)',
      desc: 'High urgency weighting maximizes velocity. Dynamic incident avoidance recalculates trajectory on the fly.',
      icon: <Zap size={18} className="text-blue-400" />,
      tag: 'TACTICAL INTERCEPT',
    },
    {
      num: 5 as const,
      title: 'Scenario 5: Hazmat Vapor Containment',
      vehicle: 'HAZMAT-DELTA-01 (14.0T Hazmat)',
      desc: 'Hazardous chemical transport applies density exclusion zone, avoiding densely populated urban streets.',
      icon: <Truck size={18} className="text-purple-400" />,
      tag: 'EXCLUSION ZONE',
    },
  ];

  const handleLaunchScenario = (scenarioNum: 1 | 2 | 3 | 4 | 5) => {
    loadDemoScenario(scenarioNum);
    startNavigationMission();
    setActivePortal('operator');
    onClose();
  };

  return (
    <div className="demo-lab-backdrop animate-fade-in" onClick={onClose}>
      <div className="demo-lab-container animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="demo-lab-header">
          <div className="header-titles">
            <div className="lab-badge">
              <FlaskConical size={18} className="text-cyan-400" />
              <span>SCENARIO SIMULATION LAB</span>
            </div>
            <h2 className="lab-heading">Autonomous Mission Scenarios & Real-Time Hazard Injection</h2>
            <p className="lab-subheading">
              Select pre-configured demonstration scenarios or inject live road hazards to observe real-time AI rerouting and vehicle telemetry.
            </p>
          </div>

          <button className="lab-close-btn" onClick={onClose} title="Close Simulation Lab">
            <X size={20} />
          </button>
        </div>

        {/* 2-Column Content: Scenarios on Left, Interactive Injections on Right */}
        <div className="demo-lab-grid custom-scrollbar">
          {/* Left Column: Preset Scenarios */}
          <div className="demo-scenarios-column">
            <h3 className="section-label">SELECT DEMONSTRATION SCENARIO</h3>
            <div className="scenarios-list">
              {scenarios.map((s) => (
                <div
                  key={s.num}
                  className="scenario-preset-card"
                  onClick={() => handleLaunchScenario(s.num)}
                >
                  <div className="card-top">
                    <div className="scenario-icon">{s.icon}</div>
                    <span className="scenario-tag font-mono">{s.tag}</span>
                  </div>
                  <h4 className="scenario-title">{s.title}</h4>
                  <div className="scenario-vehicle font-mono">Assigned: {s.vehicle}</div>
                  <p className="scenario-desc">{s.desc}</p>
                  <button className="launch-scenario-btn">
                    <Play size={14} fill="currentColor" />
                    <span>Engage Scenario</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Live Injection Controls & Weather Engine */}
          <div className="demo-controls-column">
            {/* Simulation Execution Bar */}
            <div className="control-block">
              <h4 className="block-title">SIMULATION ENGINE CONTROL</h4>
              <div className="sim-master-controls">
                <button
                  className={`master-play-btn ${isSimulationPlaying ? 'playing' : ''}`}
                  onClick={() => setIsSimulationPlaying(!isSimulationPlaying)}
                >
                  {isSimulationPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                  <span>{isSimulationPlaying ? 'Pause Simulation' : 'Resume Simulation'}</span>
                </button>

                <button
                  className="master-step-btn"
                  onClick={() => stepSimulation(0.1)}
                  title="Advance Vehicle Position +10% Along Polyline"
                >
                  <SkipForward size={16} />
                  <span>Step +10%</span>
                </button>

                <button
                  className="master-reset-btn"
                  onClick={resetToMissionSetup}
                  title="Reset Mission to Initial Setup"
                >
                  <RotateCcw size={16} />
                  <span>Reset Mission</span>
                </button>
              </div>

              {/* Speed Multipliers */}
              <div className="speed-select-row">
                <span className="row-label">Time Acceleration:</span>
                {[1, 2, 5, 10].map((spd) => (
                  <button
                    key={spd}
                    className={`speed-pill-btn ${simulationSpeed === spd ? 'active' : ''}`}
                    onClick={() => setSimulationSpeed(spd)}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Hazard Injection */}
            <div className="control-block">
              <h4 className="block-title">
                <AlertTriangle size={15} className="text-amber-400 inline mr-1" />
                INJECT IN-FLIGHT ROAD HAZARDS
              </h4>
              <p className="block-desc">
                Trigger real-time telemetry anomalies to test instant AI reroute recalculation and voice alerts.
              </p>

              <div className="hazard-buttons-grid">
                <button
                  className="inject-btn braking"
                  onClick={() => triggerHazardInjection('BRAKING_CLUSTER')}
                >
                  <AlertTriangle size={16} />
                  <div>
                    <strong>Braking Spurt (+48 Risk)</strong>
                    <span>Sudden deceleration cluster on Flyover</span>
                  </div>
                </button>

                <button
                  className="inject-btn flood"
                  onClick={() => triggerHazardInjection('FLOOD_RISK')}
                >
                  <CloudRain size={16} />
                  <div>
                    <strong>Flash Flooding (42cm)</strong>
                    <span>Submerged underpass bottleneck</span>
                  </div>
                </button>

                <button
                  className="inject-btn blockage"
                  onClick={() => triggerHazardInjection('ROAD_BLOCKAGE')}
                >
                  <ShieldAlert size={16} />
                  <div>
                    <strong>Multi-Car Collision (+65 Risk)</strong>
                    <span>Complete 2-lane blockage</span>
                  </div>
                </button>
              </div>

              {activeHazards.length > 0 && (
                <button className="clear-hazards-btn" onClick={clearHazards}>
                  <span>Clear All Active Hazards ({activeHazards.length})</span>
                </button>
              )}
            </div>

            {/* Atmospheric Weather Modulation */}
            <div className="control-block">
              <h4 className="block-title">
                <CloudRain size={15} className="text-cyan-400 inline mr-1" />
                METEOROLOGICAL CONDITIONS
              </h4>
              <div className="weather-toggle-row">
                <button
                  className={`weather-toggle-btn ${weatherState === 'clear' ? 'active' : ''}`}
                  onClick={() => setWeatherState('clear')}
                >
                  <span>☀️ Clear & Dry</span>
                </button>
                <button
                  className={`weather-toggle-btn ${weatherState === 'monsoon_rain' ? 'active monsoon' : ''}`}
                  onClick={() => setWeatherState('monsoon_rain')}
                >
                  <span>🌧️ Monsoon Storm (+16 Risk)</span>
                </button>
              </div>
            </div>

            {/* Green Corridor Signals State */}
            <div className="control-block">
              <h4 className="block-title">
                <Zap size={15} className="text-emerald-400 inline mr-1" />
                GREEN CORRIDOR SIGNAL PREEMPTION
              </h4>
              <p className="block-desc">Click any intersection to manually override signal lock state:</p>
              <div className="signals-toggle-grid">
                {greenCorridor.signals.map((sig) => (
                  <button
                    key={sig.id}
                    className={`signal-override-btn ${sig.state.toLowerCase()}`}
                    onClick={() => toggleGreenCorridorSignal(sig.id)}
                  >
                    <span className="sig-dot" />
                    <div className="sig-info">
                      <span className="sig-name">{sig.intersectionName}</span>
                      <span className="sig-state font-mono">{sig.state}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DemoLabModal;
