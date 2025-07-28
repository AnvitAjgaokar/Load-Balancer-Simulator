import React, { useState } from 'react';
import { 
  LoadBalancingAlgorithm, 
  ServerConfig, 
  LoadBalancerConfig, 
  SimulationConfig 
} from '../types';

interface ControlPanelProps {
  algorithm: LoadBalancingAlgorithm;
  onAlgorithmChange: (algorithm: LoadBalancingAlgorithm) => void;
  onAddServer: (config: ServerConfig) => void;
  onRemoveServer: (serverId: string) => void;
  onUpdateServer: (serverId: string, config: Partial<ServerConfig>) => void;
  onUpdateConfig: (config: Partial<LoadBalancerConfig>) => void;
  onUpdateSimulationConfig: (config: Partial<SimulationConfig>) => void;
  servers: any[];
  isSimulationRunning: boolean;
  onToggleSimulation: () => void;
  onReset: () => void;
}

const ALGORITHMS: { [key in LoadBalancingAlgorithm]: string } = {
  ROUND_ROBIN: 'Round Robin',
  WEIGHTED_ROUND_ROBIN: 'Weighted Round Robin',
  LEAST_CONNECTIONS: 'Least Connections',
  LEAST_RESPONSE_TIME: 'Least Response Time',
  IP_HASH: 'IP Hash',
  STICKY_SESSIONS: 'Sticky Sessions'
};

export const ControlPanel: React.FC<ControlPanelProps> = ({
  algorithm,
  onAlgorithmChange,
  onAddServer,
  onRemoveServer,
  onUpdateServer,
  onUpdateConfig,
  onUpdateSimulationConfig,
  servers,
  isSimulationRunning,
  onToggleSimulation,
  onReset
}) => {
  const [activeTab, setActiveTab] = useState<'servers' | 'algorithm' | 'simulation' | 'advanced'>('servers');
  const [newServer, setNewServer] = useState<Partial<ServerConfig>>({
    name: '',
    weight: 1,
    maxConnections: 100,
    processingTime: 1000,
    healthCheckInterval: 30000,
    failureThreshold: 3,
    recoveryThreshold: 2,
    ipAddress: '',
    port: 8080
  });
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [simulationConfig, setSimulationConfig] = useState<Partial<SimulationConfig>>({
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
  });

  const handleAddServer = () => {
    if (!newServer.name || !newServer.ipAddress) {
      alert('Server name and IP address are required');
      return;
    }
    onAddServer(newServer as ServerConfig);
    setNewServer({
      name: '',
      weight: 1,
      maxConnections: 100,
      processingTime: 1000,
      healthCheckInterval: 30000,
      failureThreshold: 3,
      recoveryThreshold: 2,
      ipAddress: '',
      port: 8080
    });
  };

  const handleUpdateServer = (serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    if (server) {
      onUpdateServer(serverId, server);
      setEditingServer(null);
    }
  };

  const generateServerIP = () => {
    const baseIP = '192.168.1.';
    const lastOctet = servers.length + 10;
    setNewServer(prev => ({ ...prev, ipAddress: `${baseIP}${lastOctet}` }));
  };

  return (
    <div style={{ 
      width: '350px', 
      backgroundColor: 'white', 
      borderRight: '1px solid #ddd',
      padding: '20px',
      overflowY: 'auto',
      height: '100vh'
    }}>
      <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>Control Panel</h2>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid #ddd' }}>
        {(['servers', 'algorithm', 'simulation', 'advanced'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 15px',
              border: 'none',
              backgroundColor: activeTab === tab ? '#007bff' : 'transparent',
              color: activeTab === tab ? 'white' : '#666',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0',
              fontWeight: activeTab === tab ? 'bold' : 'normal'
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Servers Tab */}
      {activeTab === 'servers' && (
        <div>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Server Management</h3>
          
          {/* Add New Server */}
          <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Add New Server</h4>
            <div style={{ display: 'grid', gap: '10px' }}>
              <input
                type="text"
                placeholder="Server Name"
                value={newServer.name}
                onChange={(e) => setNewServer(prev => ({ ...prev, name: e.target.value }))}
                style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="IP Address"
                  value={newServer.ipAddress}
                  onChange={(e) => setNewServer(prev => ({ ...prev, ipAddress: e.target.value }))}
                  style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <button
                  onClick={generateServerIP}
                  style={{ padding: '8px 12px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Auto
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="number"
                  placeholder="Port"
                  value={newServer.port}
                  onChange={(e) => setNewServer(prev => ({ ...prev, port: parseInt(e.target.value) || 8080 }))}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="number"
                  placeholder="Weight"
                  value={newServer.weight}
                  onChange={(e) => setNewServer(prev => ({ ...prev, weight: parseInt(e.target.value) || 1 }))}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="number"
                  placeholder="Max Connections"
                  value={newServer.maxConnections}
                  onChange={(e) => setNewServer(prev => ({ ...prev, maxConnections: parseInt(e.target.value) || 100 }))}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
                <input
                  type="number"
                  placeholder="Processing Time (ms)"
                  value={newServer.processingTime}
                  onChange={(e) => setNewServer(prev => ({ ...prev, processingTime: parseInt(e.target.value) || 1000 }))}
                  style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <button
                onClick={handleAddServer}
                style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Add Server
              </button>
            </div>
          </div>

          {/* Existing Servers */}
          <div>
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Existing Servers</h4>
            {servers.map(server => (
              <div key={server.id} style={{ 
                marginBottom: '10px', 
                padding: '10px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                backgroundColor: server.active && server.healthy ? '#f8fff8' : '#fff5f5'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <strong>{server.name}</strong>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontSize: '10px',
                    backgroundColor: server.active && server.healthy ? '#d4edda' : '#f8d7da',
                    color: server.active && server.healthy ? '#155724' : '#721c24'
                  }}>
                    {server.active && server.healthy ? 'Healthy' : !server.active ? 'Inactive' : 'Unhealthy'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>
                  {server.ipAddress}:{server.port} | Weight: {server.weight} | Load: {server.currentConnections}/{server.maxConnections}
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => setEditingServer(editingServer === server.id ? null : server.id)}
                    style={{ padding: '4px 8px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}
                  >
                    {editingServer === server.id ? 'Cancel' : 'Edit'}
                  </button>
                  <button
                    onClick={() => onUpdateServer(server.id, { active: !server.active })}
                    style={{ padding: '4px 8px', backgroundColor: server.active ? '#ffc107' : '#28a745', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}
                  >
                    {server.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => onRemoveServer(server.id)}
                    style={{ padding: '4px 8px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '10px' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Algorithm Tab */}
      {activeTab === 'algorithm' && (
        <div>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Load Balancing Algorithm</h3>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Algorithm:</label>
            <select
              value={algorithm}
              onChange={(e) => onAlgorithmChange(e.target.value as LoadBalancingAlgorithm)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              {Object.entries(ALGORITHMS).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
          </div>

          <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Algorithm Description</h4>
            <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
              {algorithm === 'ROUND_ROBIN' && 'Distributes requests sequentially to each server in rotation.'}
              {algorithm === 'WEIGHTED_ROUND_ROBIN' && 'Similar to Round Robin but servers with higher weights receive more requests.'}
              {algorithm === 'LEAST_CONNECTIONS' && 'Routes requests to the server with the fewest active connections.'}
              {algorithm === 'LEAST_RESPONSE_TIME' && 'Routes requests to the server with the lowest average response time.'}
              {algorithm === 'IP_HASH' && 'Uses client IP address hash to consistently route requests to the same server.'}
              {algorithm === 'STICKY_SESSIONS' && 'Maintains session affinity by routing requests from the same session to the same server.'}
            </p>
          </div>
        </div>
      )}

      {/* Simulation Tab */}
      {activeTab === 'simulation' && (
        <div>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Simulation Controls</h3>
          
          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={onToggleSimulation}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: isSimulationRunning ? '#dc3545' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              {isSimulationRunning ? 'Stop Simulation' : 'Start Simulation'}
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Request Rate (req/sec):</label>
            <input
              type="range"
              min="1"
              max="100"
              value={simulationConfig.requestRate || 10}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setSimulationConfig(prev => ({ ...prev, requestRate: value }));
                onUpdateSimulationConfig({ requestRate: value });
              }}
              style={{ width: '100%' }}
            />
            <div style={{ textAlign: 'center', fontSize: '12px', color: '#666' }}>
              {simulationConfig.requestRate || 10} requests/second
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Request Pattern:</label>
            <select
              value={simulationConfig.requestPattern || 'steady'}
              onChange={(e) => {
                setSimulationConfig(prev => ({ ...prev, requestPattern: e.target.value as any }));
                onUpdateSimulationConfig({ requestPattern: e.target.value as any });
              }}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="steady">Steady</option>
              <option value="burst">Burst</option>
              <option value="random">Random</option>
            </select>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Failure Simulation:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <input
                type="checkbox"
                checked={simulationConfig.failureSimulation?.enabled || false}
                onChange={(e) => {
                  setSimulationConfig(prev => ({
                    ...prev,
                    failureSimulation: { ...prev.failureSimulation, enabled: e.target.checked }
                  }));
                  onUpdateSimulationConfig({
                    failureSimulation: { ...simulationConfig.failureSimulation, enabled: e.target.checked }
                  });
                }}
              />
              <span style={{ fontSize: '12px' }}>Enable failure simulation</span>
            </div>
            {simulationConfig.failureSimulation?.enabled && (
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Failure Rate:</label>
                <input
                  type="range"
                  min="0"
                  max="0.1"
                  step="0.001"
                  value={simulationConfig.failureSimulation?.failureRate || 0.01}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    setSimulationConfig(prev => ({
                      ...prev,
                      failureSimulation: { ...prev.failureSimulation, failureRate: value }
                    }));
                    onUpdateSimulationConfig({
                      failureSimulation: { ...simulationConfig.failureSimulation, failureRate: value }
                    });
                  }}
                  style={{ width: '100%' }}
                />
                <div style={{ textAlign: 'center', fontSize: '12px', color: '#666' }}>
                  {(simulationConfig.failureSimulation?.failureRate || 0.01) * 100}% failure rate
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Advanced Tab */}
      {activeTab === 'advanced' && (
        <div>
          <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Advanced Configuration</h3>
          
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Load Balancer Settings</h4>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Request Timeout (ms):</label>
                <input
                  type="number"
                  placeholder="5000"
                  onChange={(e) => onUpdateConfig({ requestTimeout: parseInt(e.target.value) || 5000 })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Max Retries:</label>
                <input
                  type="number"
                  placeholder="3"
                  onChange={(e) => onUpdateConfig({ maxRetries: parseInt(e.target.value) || 3 })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Session Management</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <input
                type="checkbox"
                onChange={(e) => onUpdateConfig({ stickySessionEnabled: e.target.checked })}
              />
              <span style={{ fontSize: '12px' }}>Enable sticky sessions</span>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>Session Timeout (ms):</label>
              <input
                type="number"
                placeholder="300000"
                onChange={(e) => onUpdateConfig({ stickySessionTimeout: parseInt(e.target.value) || 300000 })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>Health Checks</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <input
                type="checkbox"
                defaultChecked
                onChange={(e) => onUpdateConfig({ healthCheckEnabled: e.target.checked })}
              />
              <span style={{ fontSize: '12px' }}>Enable health checks</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <input
                type="checkbox"
                defaultChecked
                onChange={(e) => onUpdateConfig({ failoverEnabled: e.target.checked })}
              />
              <span style={{ fontSize: '12px' }}>Enable failover</span>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <button
              onClick={onReset}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reset All Statistics
            </button>
          </div>
        </div>
      )}
    </div>
  );
}; 