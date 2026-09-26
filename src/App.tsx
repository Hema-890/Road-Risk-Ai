import React, { useState, Component, ErrorInfo, ReactNode, Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MapContainer } from './components/map/MapContainer';
import { CitizenNavigationControl } from './components/navigation/CitizenNavigationControl';
import { DynamicRerouteModal } from './components/operator/DynamicRerouteModal';

// Code-split / Lazy-loaded secondary portals & modals (reduces initial bundle size)
const EmergencyRouteControl = lazy(() =>
  import('./components/operator/EmergencyRouteControl').then((m) => ({ default: m.EmergencyRouteControl }))
);
const LiveRiskMapView = lazy(() =>
  import('./components/map/LiveRiskMapView').then((m) => ({ default: m.LiveRiskMapView }))
);
const MissionDebriefModal = lazy(() =>
  import('./components/operator/MissionDebriefModal').then((m) => ({ default: m.MissionDebriefModal }))
);
const AuthorityPortal = lazy(() =>
  import('./components/authority/AuthorityPortal').then((m) => ({ default: m.AuthorityPortal }))
);
const FleetPortal = lazy(() =>
  import('./components/fleet/FleetPortal').then((m) => ({ default: m.FleetPortal }))
);
const EventSimulatorView = lazy(() =>
  import('./components/simulation/EventSimulatorView').then((m) => ({ default: m.EventSimulatorView }))
);
const AnalyticsView = lazy(() =>
  import('./components/analytics/AnalyticsView').then((m) => ({ default: m.AnalyticsView }))
);
const DataSourcesView = lazy(() =>
  import('./components/settings/DataSourcesView').then((m) => ({ default: m.DataSourcesView }))
);
const ManualHazardModal = lazy(() =>
  import('./components/operator/ManualHazardModal').then((m) => ({ default: m.ManualHazardModal }))
);
const DemoLabModal = lazy(() =>
  import('./components/simulation/DemoLabModal').then((m) => ({ default: m.DemoLabModal }))
);

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RoadRisk AI Runtime Error Caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: '40px',
            color: '#f8fafc',
            backgroundColor: '#0b0f17',
            height: '100vh',
            fontFamily: 'monospace',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <h1 style={{ color: '#f43f5e', fontSize: '1.8rem' }}>⚠️ RoadRisk AI Encountered a Runtime Error</h1>
          <div
            style={{
              background: '#1e293b',
              padding: '20px',
              borderRadius: '8px',
              border: '1px solid #f43f5e',
            }}
          >
            <p style={{ color: '#fb7185', fontWeight: 'bold', fontSize: '1.1rem' }}>
              {this.state.error?.toString()}
            </p>
            <pre style={{ marginTop: '10px', color: '#94a3b8', whiteSpace: 'pre-wrap' }}>
              {this.state.errorInfo?.componentStack || this.state.error?.stack}
            </pre>
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#38bdf8',
              color: '#0b0f17',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              alignSelf: 'flex-start',
            }}
          >
            Reload Platform
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const MainLayout: React.FC = () => {
  const { activePortal, setActivePortal } = useApp();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDemoLabOpen, setIsDemoLabOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalCoords, setReportModalCoords] = useState<[number, number] | null>(null);

  const handleOpenReportModalWithCoords = (coords?: [number, number]) => {
    if (coords) {
      setReportModalCoords(coords);
    }
    setIsReportModalOpen(true);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#0b0f17',
        position: 'relative',
      }}
    >
      {/* 1. Off-Canvas Slide-out Navigation Drawer */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onClose={() => setIsSidebarOpen(false)}
        onOpenReportModal={() => handleOpenReportModalWithCoords()}
      />

      {/* 2. Top Tactical Status Bar */}
      <Header
        onOpenReportModal={() => handleOpenReportModalWithCoords()}
        onOpenDemoLab={() => setIsDemoLabOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      />

      {/* 3. Main View Content based on active navigation */}
      <Suspense
        fallback={
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#090d16',
              color: '#38bdf8',
              fontSize: 13,
              fontWeight: 600,
              gap: 10,
              zIndex: 900,
            }}
          >
            <div
              className="animate-spin"
              style={{
                width: 20,
                height: 20,
                border: '2px solid #38bdf8',
                borderTopColor: 'transparent',
                borderRadius: '50%',
              }}
            />
            <span>Loading interface...</span>
          </div>
        }
      >
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {/* A1. Citizen Safety Navigation (Default Hero) */}
          {activePortal === 'navigation' && (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <MapContainer />
              <CitizenNavigationControl />
              <DynamicRerouteModal />
            </div>
          )}

          {/* A2. Emergency Routing Dashboard */}
          {activePortal === 'operator' && (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <MapContainer />
              <EmergencyRouteControl onOpenReportModal={() => handleOpenReportModalWithCoords()} />
              <DynamicRerouteModal />
              <MissionDebriefModal />
            </div>
          )}

          {/* B. Live Risk Map */}
          {activePortal === 'risk_map' && (
            <LiveRiskMapView onOpenReportModal={handleOpenReportModalWithCoords} />
          )}

          {/* C. Road Intelligence / Authority Dashboard */}
          {activePortal === 'authority' && <AuthorityPortal />}

          {/* D. Event Simulator */}
          {activePortal === 'simulator' && <EventSimulatorView />}

          {/* E. Analytics & Historical Risk */}
          {activePortal === 'analytics' && <AnalyticsView />}

          {/* F. Settings & Data Sources */}
          {activePortal === 'settings' && <DataSourcesView />}

          {/* Fleet Command */}
          {activePortal === 'fleet' && <FleetPortal />}
        </div>

        {/* Manual Hazard Reporting Modal */}
        {isReportModalOpen && (
          <ManualHazardModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            initialCoords={reportModalCoords}
          />
        )}

        {/* Scenario Simulation / Demo Lab Modal */}
        {(isDemoLabOpen || activePortal === 'simulation') && (
          <DemoLabModal
            isOpen={isDemoLabOpen || activePortal === 'simulation'}
            onClose={() => {
              setIsDemoLabOpen(false);
              if (activePortal === 'simulation') {
                setActivePortal('operator');
              }
            }}
          />
        )}
      </Suspense>
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
