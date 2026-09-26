// ==============================================================================
// ROADRISK AI — TRAVEL & VEHICLE MODE SELECTOR
// Supports: Car, Motorcycle (Bike), Bicycle, Pedestrian (Walk), and Transit (Train/Bus)
// Connects dynamically to live routing profile engines with honest data notices.
// ==============================================================================

import React from 'react';
import { Car, Bike, Footprints, Train } from 'lucide-react';
import type { RoutingProfile } from '../../services/routingService.ts';

interface TravelModeSelectorProps {
  currentMode: RoutingProfile;
  onSelectMode: (mode: RoutingProfile) => void;
  isLoading?: boolean;
}

export const TravelModeSelector: React.FC<TravelModeSelectorProps> = ({
  currentMode,
  onSelectMode,
  isLoading = false,
}) => {
  const modes: Array<{
    id: RoutingProfile;
    label: string;
    icon: React.ReactNode;
    description: string;
  }> = [
    {
      id: 'CAR',
      label: 'Car',
      icon: <Car size={15} />,
      description: 'Standard road network & live traffic',
    },
    {
      id: 'BIKE',
      label: 'Bike',
      icon: <Bike size={15} />,
      description: 'Motorcycle profile & lane agility',
    },
    {
      id: 'BICYCLE',
      label: 'Bicycle',
      icon: <Bike size={15} style={{ strokeDasharray: '2,1' }} />,
      description: 'Cycleways & bicycle-supported paths',
    },
    {
      id: 'WALK',
      label: 'Walk',
      icon: <Footprints size={15} />,
      description: 'Pedestrian corridors & footpaths',
    },
    {
      id: 'TRANSIT',
      label: 'Transit',
      icon: <Train size={15} />,
      description: 'Public GTFS rail & bus schedules',
    },
  ];

  return (
    <div
      role="tablist"
      aria-label="Travel Modes"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(51, 65, 85, 0.6)',
        borderRadius: 10,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        overflowX: 'auto',
      }}
    >
      {modes.map((m) => {
        const isSelected = currentMode === m.id;
        return (
          <button
            key={m.id}
            role="tab"
            className="travel-mode-pill"
            data-mode={m.id}
            aria-selected={isSelected}
            disabled={isLoading}
            onClick={() => onSelectMode(m.id)}
            title={`${m.label}: ${m.description}`}
            style={{
              flex: 1,
              minWidth: 68,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              padding: '6px 10px',
              borderRadius: 7,
              border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
              background: isSelected
                ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.28), rgba(14, 165, 233, 0.15))'
                : 'transparent',
              color: isSelected ? '#ffffff' : '#94a3b8',
              fontSize: 12,
              fontWeight: isSelected ? 700 : 500,
              cursor: isLoading ? 'wait' : 'pointer',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ color: isSelected ? '#38bdf8' : '#64748b' }}>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default TravelModeSelector;
