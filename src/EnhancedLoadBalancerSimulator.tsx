import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { EnhancedLoadBalancer } from './loadBalancer';
import { Dashboard } from './components/Dashboard';
import { ControlPanel } from './components/ControlPanel';
import { 
  LoadBalancingAlgorithm, 
  ServerConfig, 
  LoadBalancerConfig, 
  SimulationConfig,
  Server,
  LoadBalancerStats,
  RequestLog,
  FailoverEvent
} from './types';

const DEFAULT_CONFIG: LoadBalancerConfig = {
  algorithm: 'ROUND_ROBIN',
  healthCheckEnabled: true,
  stickySessionEnabled: false,
  stickySessionTimeout: 300000,
  failoverEnabled: true,
  requestTimeout: 5000,
  maxRetries: 3,
  ipHashSalt: 'default-salt'
};

const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  requestRate: 10,
  requestPattern: 'steady',
  clientDistribution: 'uniform',
  failureSimulation: {
    enabled: false,
    failureRate: 0.01,
    failureTypes: ['server-down', 'timeout', 'overload']
  },
  loadSimulation: {
    enabled: false,
    minRequestSize: 1024,
    maxRequestSize: 10240,
    requestSizeDistribution: 'normal'
  }
};

// Memoized sample servers to prevent recreation on every render
const SAMPLE_SERVERS = [
  {
    name: 'Web Server 1',
    weight: 3,
    maxConnections: 150,
    processingTime: 800,
    ipAddress: '192.168.1.10',
    port: 8080
  },
  {
    name: 'Web Server 2',
    weight: 2,
    maxConnections: 120,
    processingTime: 1000,
    ipAddress: '192.168.1.11',
    port: 8080
  },
  {
    name: 'Web Server 3',
    weight: 1,
    maxConnections: 100,
    processingTime: 600,
    ipAddress: '192.168.1.12',
    port: 8080
  }
];

export const EnhancedLoadBalancerSimulator: React.FC = React.memo(() => {
  // Use useRef to prevent recreation of load balancer instance
  const loadBalancerRef = useRef<EnhancedLoadBalancer>();
  if (!loadBalancerRef.current) {
    loadBalancerRef.current = new EnhancedLoadBalancer(DEFAULT_CONFIG);
  }

  const [servers, setServers] = useState<Server[]>([]);
  const [stats, setStats] = useState<LoadBalancerStats>(loadBalancerRef.current.getStats());
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [failoverEvents, setFailoverEvents] = useState<FailoverEvent[]>([]);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [currentAlgorithm, setCurrentAlgorithm] = useState<LoadBalancingAlgorithm>('ROUND_ROBIN');
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION_CONFIG);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized update function to prevent unnecessary re-renders
  const updateState = useCallback(() => {
    const loadBalancer = loadBalancerRef.current!;
    setServers(loadBalancer.getServers());
    setStats(loadBalancer.getStats());
    setRequestLogs(loadBalancer.getRequestLogs());
    setFailoverEvents(loadBalancer.getFailoverEvents());
  }, []);

  // Debounced update function to prevent excessive re-renders
  const debouncedUpdateState = useCallback(() => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(updateState, 50); // 50ms debounce
  }, [updateState]);

  // Initialize with sample servers - only run once
  useEffect(() => {
    const loadBalancer = loadBalancerRef.current!;
    
    // Only initialize if no servers exist
    if (loadBalancer.getServers().length === 0) {
      SAMPLE_SERVERS.forEach(serverConfig => {
        loadBalancer.addServer(serverConfig);
      });
      updateState();
    }
  }, [updateState]);

  // Optimized simulation loop with better performance
  useEffect(() => {
    if (isSimulationRunning) {
      const loadBalancer = loadBalancerRef.current!;
      
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateRef.current;
        const requestsPerInterval = Math.floor((simulationConfig.requestRate * timeSinceLastUpdate) / 1000);
        
        // Batch process requests for better performance
        for (let i = 0; i < requestsPerInterval; i++) {
          loadBalancer.distributeRequest({});
        }
        
        lastUpdateRef.current = now;
        debouncedUpdateState();
      }, 100); // Update every 100ms for smooth animation
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [isSimulationRunning, simulationConfig.requestRate, debouncedUpdateState]);

  // Memoized event handlers to prevent unnecessary re-renders
  const handleAlgorithmChange = useCallback((algorithm: LoadBalancingAlgorithm) => {
    const loadBalancer = loadBalancerRef.current!;
    loadBalancer.updateConfig({ algorithm });
    setCurrentAlgorithm(algorithm);
    updateState();
  }, [updateState]);

  const handleAddServer = useCallback((config: ServerConfig) => {
    const loadBalancer = loadBalancerRef.current!;
    loadBalancer.addServer(config);
    updateState();
  }, [updateState]);

  const handleRemoveServer = useCallback((serverId: string) => {
    const loadBalancer = loadBalancerRef.current!;
    loadBalancer.removeServer(serverId);
    updateState();
  }, [updateState]);

  const handleUpdateServer = useCallback((serverId: string, config: Partial<ServerConfig>) => {
    const loadBalancer = loadBalancerRef.current!;
    loadBalancer.updateServer(serverId, config);
    updateState();
  }, [updateState]);

  const handleUpdateConfig = useCallback((config: Partial<LoadBalancerConfig>) => {
    const loadBalancer = loadBalancerRef.current!;
    loadBalancer.updateConfig(config);
    updateState();
  }, [updateState]);

  const handleUpdateSimulationConfig = useCallback((config: Partial<SimulationConfig>) => {
    setSimulationConfig(prev => ({ ...prev, ...config }));
    const loadBalancer = loadBalancerRef.current!;
    loadBalancer.updateSimulationConfig(config);
  }, []);

  const handleToggleSimulation = useCallback(() => {
    setIsSimulationRunning(prev => !prev);
  }, []);

  const handleReset = useCallback(() => {
    const loadBalancer = loadBalancerRef.current!;
    loadBalancer.reset();
    setIsSimulationRunning(false);
    updateState();
  }, [updateState]);

  // Memoized props to prevent unnecessary re-renders of child components
  const dashboardProps = useMemo(() => ({
    servers,
    stats,
    requestLogs,
    failoverEvents,
    algorithm: currentAlgorithm,
    isSimulationRunning
  }), [servers, stats, requestLogs, failoverEvents, currentAlgorithm, isSimulationRunning]);

  const controlPanelProps = useMemo(() => ({
    algorithm: currentAlgorithm,
    onAlgorithmChange: handleAlgorithmChange,
    onAddServer: handleAddServer,
    onRemoveServer: handleRemoveServer,
    onUpdateServer: handleUpdateServer,
    onUpdateConfig: handleUpdateConfig,
    onUpdateSimulationConfig: handleUpdateSimulationConfig,
    servers,
    isSimulationRunning,
    onToggleSimulation: handleToggleSimulation,
    onReset: handleReset
  }), [
    currentAlgorithm,
    handleAlgorithmChange,
    handleAddServer,
    handleRemoveServer,
    handleUpdateServer,
    handleUpdateConfig,
    handleUpdateSimulationConfig,
    servers,
    isSimulationRunning,
    handleToggleSimulation,
    handleReset
  ]);

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      backgroundColor: '#f8f9fa',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      <ControlPanel {...controlPanelProps} />
      
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Dashboard {...dashboardProps} />
      </div>
    </div>
  );
});

EnhancedLoadBalancerSimulator.displayName = 'EnhancedLoadBalancerSimulator'; 