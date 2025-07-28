import React, { useState, useEffect, useRef } from 'react';
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

export const EnhancedLoadBalancerSimulator: React.FC = () => {
  const [loadBalancer] = useState(() => new EnhancedLoadBalancer(DEFAULT_CONFIG));
  const [servers, setServers] = useState<Server[]>([]);
  const [stats, setStats] = useState<LoadBalancerStats>(loadBalancer.getStats());
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [failoverEvents, setFailoverEvents] = useState<FailoverEvent[]>([]);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [currentAlgorithm, setCurrentAlgorithm] = useState<LoadBalancingAlgorithm>('ROUND_ROBIN');
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION_CONFIG);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Initialize with sample servers
  useEffect(() => {
    const sampleServers = [
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

    sampleServers.forEach(serverConfig => {
      loadBalancer.addServer(serverConfig);
    });

    updateState();
  }, []);

  const updateState = () => {
    setServers(loadBalancer.getServers());
    setStats(loadBalancer.getStats());
    setRequestLogs(loadBalancer.getRequestLogs());
    setFailoverEvents(loadBalancer.getFailoverEvents());
  };

  // Simulation loop
  useEffect(() => {
    if (isSimulationRunning) {
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateRef.current;
        const requestsPerInterval = Math.floor((simulationConfig.requestRate * timeSinceLastUpdate) / 1000);
        
        for (let i = 0; i < requestsPerInterval; i++) {
          loadBalancer.distributeRequest({});
        }
        
        lastUpdateRef.current = now;
        updateState();
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
    };
  }, [isSimulationRunning, simulationConfig.requestRate]);

  const handleAlgorithmChange = (algorithm: LoadBalancingAlgorithm) => {
    loadBalancer.updateConfig({ algorithm });
    setCurrentAlgorithm(algorithm);
    updateState();
  };

  const handleAddServer = (config: ServerConfig) => {
    loadBalancer.addServer(config);
    updateState();
  };

  const handleRemoveServer = (serverId: string) => {
    loadBalancer.removeServer(serverId);
    updateState();
  };

  const handleUpdateServer = (serverId: string, config: Partial<ServerConfig>) => {
    loadBalancer.updateServer(serverId, config);
    updateState();
  };

  const handleUpdateConfig = (config: Partial<LoadBalancerConfig>) => {
    loadBalancer.updateConfig(config);
    updateState();
  };

  const handleUpdateSimulationConfig = (config: Partial<SimulationConfig>) => {
    setSimulationConfig(prev => ({ ...prev, ...config }));
    loadBalancer.updateSimulationConfig(config);
  };

  const handleToggleSimulation = () => {
    setIsSimulationRunning(!isSimulationRunning);
  };

  const handleReset = () => {
    loadBalancer.reset();
    setIsSimulationRunning(false);
    updateState();
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      backgroundColor: '#f8f9fa',
      fontFamily: 'Arial, sans-serif'
    }}>
      <ControlPanel
        algorithm={currentAlgorithm}
        onAlgorithmChange={handleAlgorithmChange}
        onAddServer={handleAddServer}
        onRemoveServer={handleRemoveServer}
        onUpdateServer={handleUpdateServer}
        onUpdateConfig={handleUpdateConfig}
        onUpdateSimulationConfig={handleUpdateSimulationConfig}
        servers={servers}
        isSimulationRunning={isSimulationRunning}
        onToggleSimulation={handleToggleSimulation}
        onReset={handleReset}
      />
      
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Dashboard
          servers={servers}
          stats={stats}
          requestLogs={requestLogs}
          failoverEvents={failoverEvents}
          algorithm={currentAlgorithm}
          isSimulationRunning={isSimulationRunning}
        />
      </div>
    </div>
  );
}; 