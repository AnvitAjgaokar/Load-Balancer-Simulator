import React, { useState, useCallback, useMemo } from 'react';
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

// Memoized utility function
const getServerStatusColor = (server: any): string => {
  if (!server.active) return '#6c757d';
  if (!server.healthy) return '#dc3545';
  const loadPercentage = (server.currentConnections / server.maxConnections) * 100;
  if (loadPercentage > 80) return '#ffc107';
  return '#28a745';
};

export const ControlPanel: React.FC<ControlPanelProps> = React.memo(({
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

  // Memoized event handlers
  const handleAddServer = useCallback(() => {
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
  }, [newServer, onAddServer]);

  const handleUpdateServer = useCallback((serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    if (server) {
      onUpdateServer(serverId, server);
      setEditingServer(null);
    }
  }, [servers, onUpdateServer]);

  const generateServerIP = useCallback(() => {
    const baseIP = '192.168.1.';
    const lastOctet = servers.length + 10;
    setNewServer(prev => ({ ...prev, ipAddress: `${baseIP}${lastOctet}` }));
  }, [servers.length]);

  const handleTabChange = useCallback((tab: 'servers' | 'algorithm' | 'simulation' | 'advanced') => {
    setActiveTab(tab);
  }, []);

  const handleNewServerChange = useCallback((field: keyof ServerConfig, value: any) => {
    setNewServer(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleEditClick = useCallback((serverId: string) => {
    setEditingServer(editingServer === serverId ? null : serverId);
  }, [editingServer]);

  const handleRemoveServerClick = useCallback((serverId: string) => {
    onRemoveServer(serverId);
  }, [onRemoveServer]);

  const handleToggleServer = useCallback((serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    if (server) {
      onUpdateServer(serverId, { active: !server.active });
    }
  }, [servers, onUpdateServer]);

  const handleAlgorithmChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onAlgorithmChange(e.target.value as LoadBalancingAlgorithm);
  }, [onAlgorithmChange]);

  const handleRequestRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, Math.min(100, Number(e.target.value)));
    setSimulationConfig(prev => ({ ...prev, requestRate: value }));
    onUpdateSimulationConfig({ requestRate: value });
  }, [onUpdateSimulationConfig]);

  const handleRequestPatternChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as any;
    setSimulationConfig(prev => ({ ...prev, requestPattern: value }));
    onUpdateSimulationConfig({ requestPattern: value });
  }, [onUpdateSimulationConfig]);

  const handleFailureSimulationToggle = useCallback((enabled: boolean) => {
    setSimulationConfig(prev => ({
      ...prev,
      failureSimulation: { ...prev.failureSimulation, enabled }
    }));
    onUpdateSimulationConfig({
      failureSimulation: { ...simulationConfig.failureSimulation, enabled }
    });
  }, [simulationConfig.failureSimulation, onUpdateSimulationConfig]);

  const handleFailureRateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setSimulationConfig(prev => ({
      ...prev,
      failureSimulation: { ...prev.failureSimulation, failureRate: value }
    }));
    onUpdateSimulationConfig({
      failureSimulation: { ...simulationConfig.failureSimulation, failureRate: value }
    });
  }, [simulationConfig.failureSimulation, onUpdateSimulationConfig]);

  // Memoized tab buttons
  const tabButtons = useMemo(() => {
    const tabs = ['servers', 'algorithm', 'simulation', 'advanced'] as const;
    return tabs.map(tab => (
      <button
        key={tab}
        onClick={() => handleTabChange(tab)}
        style={{
          flex: 1,
          padding: '10px 12px',
          border: 'none',
          backgroundColor: activeTab === tab ? 'white' : 'transparent',
          color: activeTab === tab ? '#007bff' : '#6c757d',
          cursor: 'pointer',
          borderRadius: '6px',
          fontWeight: activeTab === tab ? '600' : '500',
          fontSize: '14px',
          transition: 'all 0.2s ease',
          boxShadow: activeTab === tab ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
        }}
      >
        {tab.charAt(0).toUpperCase() + tab.slice(1)}
      </button>
    ));
  }, [activeTab, handleTabChange]);

  // Memoized server cards
  const serverCards = useMemo(() => {
    return servers.map(server => (
      <div key={server.id} style={{ 
        marginBottom: '16px', 
        padding: '16px', 
        border: '1px solid #dee2e6', 
        borderRadius: '12px',
        backgroundColor: getServerStatusColor(server) === '#28a745' ? '#f8fff8' : 
                       getServerStatusColor(server) === '#ffc107' ? '#fffbf0' : '#fff5f5',
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h5 style={{ margin: 0, color: '#1a1a1a', fontSize: '14px', fontWeight: '600' }}>{server.name}</h5>
          <span style={{
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: '600',
            backgroundColor: getServerStatusColor(server),
            color: 'white'
          }}>
            {server.active && server.healthy ? 'Healthy' : !server.active ? 'Inactive' : 'Unhealthy'}
          </span>
        </div>
        <div style={{ fontSize: '12px', color: '#6c757d', marginBottom: '12px', lineHeight: '1.4' }}>
          {server.ipAddress}:{server.port} | Weight: {server.weight} | Load: {server.currentConnections}/{server.maxConnections}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleEditClick(server.id)}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: '#17a2b8', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontSize: '11px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
          >
            {editingServer === server.id ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={() => handleToggleServer(server.id)}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: server.active ? '#ffc107' : '#28a745', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontSize: '11px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
          >
            {server.active ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => handleRemoveServerClick(server.id)}
            style={{ 
              padding: '6px 12px', 
              backgroundColor: '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontSize: '11px',
              fontWeight: '600',
              transition: 'all 0.2s ease'
            }}
          >
            Remove
          </button>
        </div>
      </div>
    ));
  }, [servers, editingServer, handleEditClick, handleToggleServer, handleRemoveServerClick]);

  return (
    <div style={{ 
      width: '380px', 
      backgroundColor: 'white', 
      borderRight: '1px solid #e9ecef',
      padding: '20px',
      overflowY: 'auto',
      height: '100vh',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h2 style={{ 
        margin: '0 0 20px 0', 
        color: '#1a1a1a',
        fontSize: '20px',
        fontWeight: '600',
        letterSpacing: '-0.025em'
      }}>
        Control Panel
      </h2>

      {/* Tab Navigation with improved styling */}
      <div style={{ 
        display: 'flex', 
        marginBottom: '20px', 
        borderBottom: '2px solid #e9ecef',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        padding: '4px',
        flexShrink: 0
      }}>
        {tabButtons}
      </div>

      {/* Content Area with proper scrolling */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
        {/* Servers Tab */}
        {activeTab === 'servers' && (
          <div>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              color: '#1a1a1a',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Server Management
            </h3>
            
            {/* Add New Server with improved styling */}
            <div style={{ 
              marginBottom: '24px', 
              padding: '20px', 
              border: '1px solid #dee2e6', 
              borderRadius: '12px',
              backgroundColor: '#f8f9fa'
            }}>
              <h4 style={{ 
                margin: '0 0 16px 0', 
                color: '#1a1a1a',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Add New Server
              </h4>
              <div style={{ display: 'grid', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Server Name"
                  value={newServer.name}
                  onChange={(e) => handleNewServerChange('name', e.target.value)}
                  style={{ 
                    padding: '10px 12px', 
                    border: '1px solid #dee2e6', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'white'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="IP Address"
                    value={newServer.ipAddress}
                    onChange={(e) => handleNewServerChange('ipAddress', e.target.value)}
                    style={{ 
                      flex: 1, 
                      padding: '10px 12px', 
                      border: '1px solid #dee2e6', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  />
                  <button
                    onClick={generateServerIP}
                    style={{ 
                      padding: '10px 12px', 
                      backgroundColor: '#6c757d', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '8px', 
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  >
                    Auto
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="Port"
                    value={newServer.port}
                    onChange={(e) => handleNewServerChange('port', parseInt(e.target.value) || 8080)}
                    style={{ 
                      padding: '10px 12px', 
                      border: '1px solid #dee2e6', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Weight"
                    value={newServer.weight}
                    onChange={(e) => handleNewServerChange('weight', parseInt(e.target.value) || 1)}
                    style={{ 
                      padding: '10px 12px', 
                      border: '1px solid #dee2e6', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="number"
                    placeholder="Max Connections"
                    value={newServer.maxConnections}
                    onChange={(e) => handleNewServerChange('maxConnections', parseInt(e.target.value) || 100)}
                    style={{ 
                      padding: '10px 12px', 
                      border: '1px solid #dee2e6', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Processing Time (ms)"
                    value={newServer.processingTime}
                    onChange={(e) => handleNewServerChange('processingTime', parseInt(e.target.value) || 1000)}
                    style={{ 
                      padding: '10px 12px', 
                      border: '1px solid #dee2e6', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
                <button
                  onClick={handleAddServer}
                  style={{ 
                    padding: '12px', 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Add Server
                </button>
              </div>
            </div>

            {/* Existing Servers with improved styling */}
            <div>
              <h4 style={{ 
                margin: '0 0 16px 0', 
                color: '#1a1a1a',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Existing Servers ({servers.length})
              </h4>
              {serverCards}
            </div>
          </div>
        )}

        {/* Algorithm Tab */}
        {activeTab === 'algorithm' && (
          <div>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#1a1a1a',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Load Balancing Algorithm
            </h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#1a1a1a',
                fontSize: '14px'
              }}>
                Algorithm:
              </label>
              <select
                value={algorithm}
                onChange={handleAlgorithmChange}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  border: '1px solid #dee2e6', 
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                {Object.entries(ALGORITHMS).map(([key, name]) => (
                  <option key={key} value={key}>{name}</option>
                ))}
              </select>
            </div>

            <div style={{ 
              padding: '16px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '12px',
              border: '1px solid #dee2e6'
            }}>
              <h4 style={{ 
                margin: '0 0 12px 0', 
                color: '#1a1a1a',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Algorithm Description
              </h4>
              <p style={{ 
                fontSize: '13px', 
                color: '#6c757d', 
                margin: 0,
                lineHeight: '1.5'
              }}>
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
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#1a1a1a',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Simulation Controls
            </h3>
            
            <div style={{ marginBottom: '24px' }}>
              <button
                onClick={onToggleSimulation}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: isSimulationRunning ? '#dc3545' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
              >
                {isSimulationRunning ? 'Stop Simulation' : 'Start Simulation'}
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#1a1a1a',
                fontSize: '14px'
              }}>
                Request Rate (req/sec):
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={simulationConfig.requestRate || 10}
                onChange={handleRequestRateChange}
                style={{ width: '100%', marginBottom: '8px' }}
              />
              <div style={{ 
                textAlign: 'center', 
                fontSize: '14px', 
                color: '#6c757d',
                fontWeight: '500'
              }}>
                {simulationConfig.requestRate || 10} requests/second
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#1a1a1a',
                fontSize: '14px'
              }}>
                Request Pattern:
              </label>
              <select
                value={simulationConfig.requestPattern || 'steady'}
                onChange={handleRequestPatternChange}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  border: '1px solid #dee2e6', 
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="steady">Steady</option>
                <option value="burst">Burst</option>
                <option value="random">Random</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: '600',
                color: '#1a1a1a',
                fontSize: '14px'
              }}>
                Failure Simulation:
              </label>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                marginBottom: '12px' 
              }}>
                <input
                  type="checkbox"
                  checked={simulationConfig.failureSimulation?.enabled || false}
                  onChange={(e) => handleFailureSimulationToggle(e.target.checked)}
                />
                <span style={{ fontSize: '13px', color: '#495057' }}>Enable failure simulation</span>
              </div>
              {simulationConfig.failureSimulation?.enabled && (
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '8px', 
                    fontSize: '12px',
                    color: '#6c757d'
                  }}>
                    Failure Rate:
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.1"
                    step="0.001"
                    value={simulationConfig.failureSimulation?.failureRate || 0.01}
                    onChange={handleFailureRateChange}
                    style={{ width: '100%', marginBottom: '8px' }}
                  />
                  <div style={{ 
                    textAlign: 'center', 
                    fontSize: '12px', 
                    color: '#6c757d' 
                  }}>
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
            <h3 style={{ 
              margin: '0 0 20px 0', 
              color: '#1a1a1a',
              fontSize: '16px',
              fontWeight: '600'
            }}>
              Advanced Configuration
            </h3>
            
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ 
                margin: '0 0 12px 0', 
                color: '#1a1a1a',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Load Balancer Settings
              </h4>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontSize: '12px',
                    color: '#6c757d',
                    fontWeight: '500'
                  }}>
                    Request Timeout (ms):
                  </label>
                  <input
                    type="number"
                    placeholder="5000"
                    onChange={(e) => onUpdateConfig({ requestTimeout: parseInt(e.target.value) || 5000 })}
                    style={{ 
                      width: '100%', 
                      padding: '10px 12px', 
                      border: '1px solid #dee2e6', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '6px', 
                    fontSize: '12px',
                    color: '#6c757d',
                    fontWeight: '500'
                  }}>
                    Max Retries:
                  </label>
                  <input
                    type="number"
                    placeholder="3"
                    onChange={(e) => onUpdateConfig({ maxRetries: parseInt(e.target.value) || 3 })}
                    style={{ 
                      width: '100%', 
                      padding: '10px 12px', 
                      border: '1px solid #dee2e6', 
                      borderRadius: '8px',
                      fontSize: '14px',
                      backgroundColor: 'white'
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ 
                margin: '0 0 12px 0', 
                color: '#1a1a1a',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Session Management
              </h4>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                marginBottom: '12px' 
              }}>
                <input
                  type="checkbox"
                  onChange={(e) => onUpdateConfig({ stickySessionEnabled: e.target.checked })}
                />
                <span style={{ fontSize: '13px', color: '#495057' }}>Enable sticky sessions</span>
              </div>
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '6px', 
                  fontSize: '12px',
                  color: '#6c757d',
                  fontWeight: '500'
                }}>
                  Session Timeout (ms):
                </label>
                <input
                  type="number"
                  placeholder="300000"
                  onChange={(e) => onUpdateConfig({ stickySessionTimeout: parseInt(e.target.value) || 300000 })}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    border: '1px solid #dee2e6', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    backgroundColor: 'white'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ 
                margin: '0 0 12px 0', 
                color: '#1a1a1a',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                Health Checks
              </h4>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                marginBottom: '12px' 
              }}>
                <input
                  type="checkbox"
                  defaultChecked
                  onChange={(e) => onUpdateConfig({ healthCheckEnabled: e.target.checked })}
                />
                <span style={{ fontSize: '13px', color: '#495057' }}>Enable health checks</span>
              </div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px', 
                marginBottom: '12px' 
              }}>
                <input
                  type="checkbox"
                  defaultChecked
                  onChange={(e) => onUpdateConfig({ failoverEnabled: e.target.checked })}
                />
                <span style={{ fontSize: '13px', color: '#495057' }}>Enable failover</span>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <button
                onClick={onReset}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  transition: 'all 0.2s ease'
                }}
              >
                Reset All Statistics
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

ControlPanel.displayName = 'ControlPanel'; 