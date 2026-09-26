import React from 'react';
import { useApp } from '../../context/AppContext';
import { MissionSetupPanel } from './MissionSetupPanel';
import { RouteComparisonPanel } from './RouteComparisonPanel';
import { NavigationCockpit } from './NavigationCockpit';
import { DynamicRerouteModal } from './DynamicRerouteModal';
import { MissionDebriefModal } from './MissionDebriefModal';

export const OperatorPortal: React.FC = () => {
  const { currentMission } = useApp();

  return (
    <div className="operator-portal-root">
      {currentMission.status === 'SETUP' && <MissionSetupPanel />}
      {currentMission.status === 'ROUTE_SELECTION' && <RouteComparisonPanel />}
      {currentMission.status === 'EN_ROUTE' && <NavigationCockpit />}

      {/* Persistent Modals */}
      <DynamicRerouteModal />
      <MissionDebriefModal />
    </div>
  );
};
