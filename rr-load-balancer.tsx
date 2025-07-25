import React, { useState, useEffect, useRef, createContext, useContext, ReactNode, RefObject } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend, ResponsiveContainer } from 'recharts';

// Load Balancing Algorithms
const loadBalancingAlgorithms: Record<string, string> = {
  RR: 'Simple Round Robin',
  WRR: 'Weighted Round Robin', 
  DWRR: 'Dynamic Weighted Round Robin',
  LC_RR: 'Least Connection Round Robin'
};

// Load Balancer Context
interface LoadBalancerContextType {
  servers: Server[];
  algorithm: string;
  setAlgorithm: (alg: string) => void;
  requestRate: number;
  setRequestRate: (rate: number) => void;
  isSimulationRunning: boolean;
  toggleSimulation: () => void;
  totalRequests: number;
  setTotalRequests: React.Dispatch<React.SetStateAction<number>>;
  movingRequests: MovingRequest[];
  addServer: (config: ServerConfig) => void;
  removeServer: (serverId: number) => void;
  toggleServer: (serverId: number) => void;
  resetSimulation: () => void;
  updateServer: (serverId: number, config: ServerConfig) => void;
}

const LoadBalancerContext = createContext<LoadBalancerContextType | undefined>(undefined);

const useLoadBalancer = () => {
  const context = useContext(LoadBalancerContext);
  if (!context) {
    throw new Error('useLoadBalancer must be used within LoadBalancerProvider');
  }
  return context;
};

// Request class for simulation
class Request {
  id: number;
  timestamp: number;
  serverId: number | null;
  processed: boolean;
  processingTime: number;
  constructor(id: number) {
    this.id = id;
    this.timestamp = Date.now();
    this.serverId = null;
    this.processed = false;
    this.processingTime = 0;
  }
}

// Server config for adding new servers
interface ServerConfig {
  name: string;
  weight: number;
  maxConnections: number;
  processingTime: number;
}

// Server class
class Server {
  id: number;
  name: string;
  weight: number;
  originalWeight: number;
  maxConnections: number;
  processingTime: number;
  active: boolean;
  currentConnections: number;
  totalRequests: number;
  totalResponseTime: number;
  currentLoad: number;
  queue: Request[];
  constructor(id: number, name: string, weight = 1, maxConnections = 100, processingTime = 1000) {
    this.id = id;
    this.name = name;
    this.weight = weight;
    this.originalWeight = weight;
    this.maxConnections = maxConnections;
    this.processingTime = processingTime;
    this.active = true;
    this.currentConnections = 0;
    this.totalRequests = 0;
    this.totalResponseTime = 0;
    this.currentLoad = 0;
    this.queue = [];
  }

  canAcceptRequest() {
    return this.active && this.currentConnections < this.maxConnections;
  }

  processRequest(request: Request) {
    if (!this.canAcceptRequest()) return false;
    this.currentConnections++;
    this.totalRequests++;
    request.serverId = this.id;
    request.processingTime = this.processingTime;
    this.queue.push(request);
    setTimeout(() => {
      this.currentConnections = Math.max(0, this.currentConnections - 1);
      this.totalResponseTime += request.processingTime;
      request.processed = true;
      this.queue = this.queue.filter(r => r.id !== request.id);
    }, this.processingTime);
    return true;
  }

  getAverageResponseTime() {
    return this.totalRequests > 0 ? (this.totalResponseTime / this.totalRequests).toFixed(2) : 0;
  }
}

// Load Balancer Logic
class LoadBalancer {
  servers: Server[];
  currentIndex: number;
  algorithm: string;
  requestCounter: number;
  weights: Map<number, { current: number; max: number }>;
  constructor() {
    this.servers = [];
    this.currentIndex = 0;
    this.algorithm = 'RR';
    this.requestCounter = 0;
    this.weights = new Map();
  }

  addServer(server: Server) {
    this.servers.push(server);
    this.weights.set(server.id, { current: 0, max: server.weight });
  }

  removeServer(serverId: number) {
    this.servers = this.servers.filter(s => s.id !== serverId);
    this.weights.delete(serverId);
  }

  getActiveServers() {
    return this.servers.filter(server => server.active && server.canAcceptRequest());
  }

  selectServer(algorithm = this.algorithm) {
    const activeServers = this.getActiveServers();
    if (activeServers.length === 0) return null;
    switch (algorithm) {
      case 'RR':
        return this.simpleRoundRobin(activeServers);
      case 'WRR':
        return this.weightedRoundRobin(activeServers);
      case 'DWRR':
        return this.dynamicWeightedRoundRobin(activeServers);
      case 'LC_RR':
        return this.leastConnectionRoundRobin(activeServers);
      default:
        return this.simpleRoundRobin(activeServers);
    }
  }

  simpleRoundRobin(servers: Server[]) {
    const server = servers[this.currentIndex % servers.length];
    this.currentIndex = (this.currentIndex + 1) % servers.length;
    return server;
  }

  weightedRoundRobin(servers: Server[]) {
    let selectedServer: Server | null = null;
    let maxWeight = -1;
    for (const server of servers) {
      const weight = this.weights.get(server.id)!;
      if (weight.current > maxWeight) {
        maxWeight = weight.current;
        selectedServer = server;
      }
    }
    if (selectedServer) {
      this.weights.get(selectedServer.id)!.current -= 1;
      const allWeights = servers.map(s => this.weights.get(s.id)!.current);
      if (allWeights.every(w => w <= 0)) {
        servers.forEach(server => {
          this.weights.get(server.id)!.current = server.weight;
        });
      }
    }
    return selectedServer || servers[0];
  }

  dynamicWeightedRoundRobin(servers: Server[]) {
    servers.forEach(server => {
      const loadFactor = server.currentConnections / server.maxConnections;
      const adjustedWeight = Math.max(1, server.originalWeight * (1 - loadFactor));
      server.weight = Math.round(adjustedWeight);
      this.weights.get(server.id)!.max = server.weight;
    });
    return this.weightedRoundRobin(servers);
  }

  leastConnectionRoundRobin(servers: Server[]) {
    servers.sort((a, b) => a.currentConnections - b.currentConnections);
    const minConnections = servers[0].currentConnections;
    const leastLoadedServers = servers.filter(s => s.currentConnections === minConnections);
    return this.simpleRoundRobin(leastLoadedServers);
  }

  distributeRequest() {
    const request = new Request(++this.requestCounter);
    const server = this.selectServer();
    if (server && server.processRequest(request)) {
      return { request, server, success: true };
    }
    return { request, server: null, success: false };
  }
}

// Styles
type Style = React.CSSProperties;
const styles: Record<string, Style> = {
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f5f5f5'
  },
  leftPanel: {
    width: '300px',
    backgroundColor: '#fff',
    padding: '20px',
    borderRight: '1px solid #ddd',
    overflowY: 'auto' as React.CSSProperties['overflowY']
  },
  mainCanvas: {
    flex: 1,
    backgroundColor: '#fafafa',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as React.CSSProperties['flexDirection'],
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as React.CSSProperties['position'],
    overflow: 'hidden'
  },
  rightPanel: {
    width: '350px',
    backgroundColor: '#fff',
    padding: '20px',
    borderLeft: '1px solid #ddd',
    overflowY: 'auto' as React.CSSProperties['overflowY']
  },
  controlSection: {
    marginBottom: '25px',
    padding: '15px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9'
  },
  button: {
    padding: '8px 16px',
    margin: '5px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  primaryButton: {
    backgroundColor: '#007bff',
    color: 'white'
  },
  dangerButton: {
    backgroundColor: '#dc3545',
    color: 'white'
  },
  select: {
    width: '100%',
    padding: '8px',
    marginBottom: '10px',
    border: '1px solid #ddd',
    borderRadius: '4px'
  },
  input: {
    width: '100%',
    padding: '8px',
    margin: '5px 0',
    border: '1px solid #ddd',
    borderRadius: '4px'
  },
  loadBalancer: {
    width: '120px',
    height: '80px',
    backgroundColor: '#28a745',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold',
    marginBottom: '50px',
    position: 'relative' as React.CSSProperties['position']
  },
  serverContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '24px',
    width: '100%',
    maxWidth: '900px',
    overflowY: 'auto',
    maxHeight: '260px', // limit height for scroll
    alignItems: 'start',
    padding: '8px 0',
    marginBottom: '16px'
  },
  server: {
    width: '100px',
    height: '60px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 'bold',
    position: 'relative' as React.CSSProperties['position'],
    fontSize: '12px'
  },
  activeServer: {
    backgroundColor: '#28a745'
  },
  inactiveServer: {
    backgroundColor: '#6c757d'
  },
  request: {
    position: 'absolute' as React.CSSProperties['position'],
    width: '8px',
    height: '8px',
    backgroundColor: '#ff6b6b',
    borderRadius: '50%',
    transition: 'all 0.5s ease-in-out'
  },
  statsCard: {
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '10px'
  },
  statsTitle: {
    fontWeight: 'bold',
    marginBottom: '10px',
    color: '#495057'
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '5px',
    fontSize: '14px'
  },
  slider: {
    width: '100%',
    marginBottom: '10px'
  }
};

const DownArrowIcon = ({ open }: { open: boolean }) => (
  <span style={{ display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: 8 }}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
  </span>
);

const ControlPanel = ({ simulationState, setSimulationState }: { simulationState: 'stopped' | 'paused' | 'running', setSimulationState: (s: 'stopped' | 'paused' | 'running') => void }) => {
  const {
    algorithm,
    setAlgorithm,
    addServer,
    removeServer,
    toggleServer,
    requestRate,
    setRequestRate,
    isSimulationRunning,
    toggleSimulation,
    resetSimulation,
    updateServer
  } = useLoadBalancer();

  // --- Simulation state management ---
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  useEffect(() => {
    if (isSimulationRunning) {
      setSimulationState('running');
    } else if (simulationState === 'running') {
      setSimulationState('paused');
    }
    // eslint-disable-next-line
  }, [isSimulationRunning]);

  // --- Button handlers ---
  const handleSimulationButton = () => {
    if (simulationState === 'stopped') {
      setSimulationState('running');
      toggleSimulation();
    } else if (simulationState === 'paused') {
      setSimulationState('running');
      toggleSimulation();
    } else if (simulationState === 'running') {
      setSimulationState('paused');
      toggleSimulation();
    }
  };

  const handleStopSimulation = () => {
    setShowStopConfirm(true);
  };

  const confirmStopSimulation = () => {
    setShowStopConfirm(false);
    setSimulationState('stopped');
    resetSimulation();
  };

  const cancelStopSimulation = () => {
    setShowStopConfirm(false);
  };

  const [newServerConfig, setNewServerConfig] = useState({
    name: '',
    weight: 1,
    maxConnections: 100,
    processingTime: 1000
  });
  const [addError, setAddError] = useState('');
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [editServerId, setEditServerId] = useState<number | null>(null);
  const [editConfig, setEditConfig] = useState<ServerConfig | null>(null);
  const [editError, setEditError] = useState('');

  const handleAddServer = () => {
    if (!newServerConfig.name.trim()) {
      setAddError('Server name is required.');
      return;
    }
    setAddError('');
    addServer(newServerConfig);
    setNewServerConfig({ name: '', weight: 1, maxConnections: 100, processingTime: 1000 });
  };

  const handleEditClick = (server: Server) => {
    setEditServerId(server.id);
    setEditConfig({
      name: server.name,
      weight: server.weight,
      maxConnections: server.maxConnections,
      processingTime: server.processingTime
    });
    setEditError('');
  };

  const handleEditSave = () => {
    if (!editConfig || !editConfig.name.trim()) {
      setEditError('Server name is required.');
      return;
    }
    updateServer(editServerId!, editConfig);
    setEditServerId(null);
    setEditConfig(null);
    setEditError('');
  };

  const handleEditCancel = () => {
    setEditServerId(null);
    setEditConfig(null);
    setEditError('');
  };

  const sections = [
    {
      key: 'algorithm',
      title: 'Algorithm',
      content: (
        <div style={{ marginTop: 12 }}>
          <select 
            style={styles.select}
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value)}
          >
            {(Object.entries(loadBalancingAlgorithms) as [string, string][]).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      )
    },
    {
      key: 'traffic',
      title: 'Traffic Control',
      content: (
        <div style={{ marginTop: 12 }}>
          <label htmlFor="requestRateInput">Request Rate (req/sec):</label>
          <input
            id="requestRateInput"
            type="number"
            min={1}
            max={100}
            step={1}
            value={requestRate}
            onChange={e => setRequestRate(Math.max(1, Math.min(100, Number(e.target.value))))}
            style={{...styles.input, width: 120, display: 'inline-block', marginLeft: 8, marginRight: 8}}
          />
          <div style={{marginTop: 12, display: 'flex', gap: 8}}>
            <button
              style={{...styles.button, ...styles.primaryButton}}
              onClick={handleSimulationButton}
              disabled={isSimulationRunning === undefined}
            >
              {simulationState === 'stopped' && 'Start Simulation'}
              {simulationState === 'paused' && 'Continue Simulation'}
              {simulationState === 'running' && 'Pause Simulation'}
            </button>
            <button
              style={{...styles.button, ...styles.dangerButton}}
              onClick={handleStopSimulation}
            >
              Stop Simulation
            </button>
          </div>
          {showStopConfirm && (
            <div style={{marginTop: 16, background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: 8, padding: 16, color: '#856404'}}>
              <div style={{marginBottom: 12}}>Are you sure you want to stop the simulation? This will reset all server stats.</div>
              <button style={{...styles.button, ...styles.dangerButton, marginRight: 8}} onClick={confirmStopSimulation}>Yes, Stop</button>
              <button style={{...styles.button}} onClick={cancelStopSimulation}>Cancel</button>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'add',
      title: 'Add Server',
      content: (
        <div style={{ marginTop: 12 }}>
          <label style={{fontSize: '13px', fontWeight: 500}}>Server Name</label>
          <input
            style={styles.input}
            placeholder="Server Name"
            value={newServerConfig.name}
            onChange={(e) => setNewServerConfig({...newServerConfig, name: e.target.value})}
          />
          <label style={{fontSize: '13px', fontWeight: 500}}>Weight</label>
          <input
            style={styles.input}
            type="number"
            placeholder="Weight"
            value={newServerConfig.weight}
            onChange={(e) => setNewServerConfig({...newServerConfig, weight: Number(e.target.value)})}
          />
          <label style={{fontSize: '13px', fontWeight: 500}}>Max Connections</label>
          <input
            style={styles.input}
            type="number"
            placeholder="Max Connections"
            value={newServerConfig.maxConnections}
            onChange={(e) => setNewServerConfig({...newServerConfig, maxConnections: Number(e.target.value)})}
          />
          <label style={{fontSize: '13px', fontWeight: 500}}>Processing Time (ms)</label>
          <input
            style={styles.input}
            type="number"
            placeholder="Processing Time (ms)"
            value={newServerConfig.processingTime}
            onChange={(e) => setNewServerConfig({...newServerConfig, processingTime: Number(e.target.value)})}
          />
          {addError && <div style={{color: '#dc3545', marginBottom: '8px'}}>{addError}</div>}
          <button style={{...styles.button, ...styles.primaryButton}} onClick={handleAddServer}>
            Add Server
          </button>
        </div>
      )
    },
    {
      key: 'manage',
      title: 'Server Management',
      content: (
        <div style={{ marginTop: 12 }}>
          {useLoadBalancer().servers.map((server: Server) => (
            <div key={server.id} style={{marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px'}}>
              {editServerId === server.id ? (
                <>
                  <label style={{fontSize: '13px', fontWeight: 500}}>Server Name</label>
                  <input
                    style={styles.input}
                    value={editConfig?.name || ''}
                    onChange={e => setEditConfig(ec => ({...ec!, name: e.target.value}))}
                  />
                  <label style={{fontSize: '13px', fontWeight: 500}}>Weight</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={editConfig?.weight || 1}
                    onChange={e => setEditConfig(ec => ({...ec!, weight: Number(e.target.value)}))}
                  />
                  <label style={{fontSize: '13px', fontWeight: 500}}>Max Connections</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={editConfig?.maxConnections || 1}
                    onChange={e => setEditConfig(ec => ({...ec!, maxConnections: Number(e.target.value)}))}
                  />
                  <label style={{fontSize: '13px', fontWeight: 500}}>Processing Time (ms)</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={editConfig?.processingTime || 1}
                    onChange={e => setEditConfig(ec => ({...ec!, processingTime: Number(e.target.value)}))}
                  />
                  {editError && <div style={{color: '#dc3545', marginBottom: '8px'}}>{editError}</div>}
                  <div style={{display: 'flex', gap: 8, marginTop: 8}}>
                    <button style={{...styles.button, ...styles.primaryButton}} onClick={handleEditSave}>Save</button>
                    <button style={{...styles.button}} onClick={handleEditCancel}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <strong>{server.name}</strong>
                  <div style={{fontSize: '12px', color: '#666'}}>
                    Weight: {server.weight} | Max Conn: {server.maxConnections}
                  </div>
                  <button
                    style={{...styles.button, backgroundColor: server.active ? '#ffc107' : '#28a745', color: 'white'}}
                    onClick={() => toggleServer(server.id)}
                  >
                    {server.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    style={{...styles.button, ...styles.dangerButton}}
                    onClick={() => removeServer(server.id)}
                  >
                    Remove
                  </button>
                  <button
                    style={{...styles.button, marginLeft: 4, backgroundColor: '#17a2b8', color: 'white'}}
                    onClick={() => handleEditClick(server)}
                  >
                    Edit
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )
    }
  ];

  return (
    <div style={styles.leftPanel}>
      <h3>Load Balancer Controls</h3>
      {sections.map(section => (
        <div key={section.key} style={{marginBottom: 12, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', background: '#f9f9f9'}}>
          <div
            style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '12px 10px', fontWeight: 500, fontSize: 16}}
            onClick={() => setOpenSection(openSection === section.key ? null : section.key)}
          >
            <span>{section.title}</span>
            <DownArrowIcon open={openSection === section.key} />
          </div>
          {openSection === section.key && (
            <div style={{padding: '0 16px 16px 16px', borderTop: '1px solid #eee'}}>
              {section.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// --- VisualizationCanvas with dynamic animation ---
const MAX_ANIMATED_REQUESTS = 20;

const VisualizationCanvas = () => {
  const { servers, movingRequests } = useLoadBalancer();
  const lbRef = useRef<HTMLDivElement>(null);
  const serverRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Helper to get the center position of an element relative to the canvas
  const getCenter = (el: HTMLElement | null): { x: number; y: number } => {
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const parentRect = el.offsetParent instanceof HTMLElement ? el.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
    return {
      x: rect.left - parentRect.left + rect.width / 2,
      y: rect.top - parentRect.top + rect.height / 2
    };
  };

  return (
    <div style={styles.mainCanvas}>
      <div style={styles.loadBalancer} ref={lbRef}>
        Load Balancer
      </div>
      <div style={styles.serverContainer}>
        {servers.map(server => (
          <div key={server.id}>
            <div
              ref={el => { serverRefs.current[server.id] = el; }}
              style={{
                ...styles.server,
                ...(server.active ? styles.activeServer : styles.inactiveServer)
              }}
            >
              {server.name}
              <div style={{fontSize: '10px', position: 'absolute', bottom: '-20px', color: 'black'}}>
                {server.currentConnections}/{server.maxConnections}
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Animated requests */}
      {movingRequests.slice(-MAX_ANIMATED_REQUESTS).map(request => {
        // Find start (LB) and end (server) positions
        const lbEl = lbRef.current;
        const serverEl = serverRefs.current[request.serverId];
        let start = { x: 0, y: 0 }, end = { x: 0, y: 0 };
        if (lbEl && serverEl) {
          const lbRect = lbEl.getBoundingClientRect();
          const serverRect = serverEl.getBoundingClientRect();
          const canvasRect = lbEl.parentElement!.getBoundingClientRect();
          start = {
            x: lbRect.left - canvasRect.left + lbRect.width / 2 - 4,
            y: lbRect.top - canvasRect.top + lbRect.height / 2 - 4
          };
          end = {
            x: serverRect.left - canvasRect.left + serverRect.width / 2 - 4,
            y: serverRect.top - canvasRect.top + serverRect.height / 2 - 4
          };
        }
        return (
          <RequestDot key={request.id} start={start} end={end} />
        );
      })}
    </div>
  );
};

// Animated dot component
const RequestDot = ({ start, end }: { start: { x: number; y: number }; end: { x: number; y: number } }) => {
  const [pos, setPos] = useState(start);
  useEffect(() => {
    // Animate to end after mount
    requestAnimationFrame(() => setPos(end));
  }, [end.x, end.y]);
  return (
    <div
      style={{
        ...styles.request,
        left: pos.x,
        top: pos.y,
        transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)'
      }}
    />
  );
};

const StatsPanel = () => {
  const { servers, totalRequests, algorithm } = useLoadBalancer();

  return (
    <div style={styles.rightPanel}>
      <h3>Server Statistics</h3>
      
      <div style={styles.statsCard}>
        <div style={styles.statsTitle}>Overall Stats</div>
        <div style={styles.statRow}>
          <span>Algorithm:</span>
          <span>{loadBalancingAlgorithms[algorithm]}</span>
        </div>
        <div style={styles.statRow}>
          <span>Total Requests:</span>
          <span>{totalRequests}</span>
        </div>
        <div style={styles.statRow}>
          <span>Active Servers:</span>
          <span>{servers.filter(s => s.active).length}</span>
        </div>
      </div>

      {servers.map(server => (
        <div key={server.id} style={styles.statsCard}>
          <div style={styles.statsTitle}>{server.name}</div>
          <div style={styles.statRow}>
            <span>Status:</span>
            <span style={{color: server.active ? '#28a745' : '#dc3545'}}>
              {server.active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div style={styles.statRow}>
            <span>Weight:</span>
            <span>{server.weight}</span>
          </div>
          <div style={styles.statRow}>
            <span>Current Load:</span>
            <span>{server.currentConnections}/{server.maxConnections}</span>
          </div>
          <div style={styles.statRow}>
            <span>Total Requests:</span>
            <span>{server.totalRequests}</span>
          </div>
          <div style={styles.statRow}>
            <span>Avg Response:</span>
            <span>{server.getAverageResponseTime()}ms</span>
          </div>
          <div style={{marginTop: '10px', backgroundColor: '#e9ecef', height: '10px', borderRadius: '5px'}}>
            <div
              style={{
                width: `${(server.currentConnections / server.maxConnections) * 100}%`,
                height: '100%',
                backgroundColor: server.currentConnections > server.maxConnections * 0.8 ? '#dc3545' : '#28a745',
                borderRadius: '5px',
                transition: 'width 0.3s'
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

// Update movingRequests type
type MovingRequest = { id: number; serverId: number };

// Update LoadBalancerProvider to accept simulationState and setSimulationState as props
const LoadBalancerProvider = ({ children, simulationState, setSimulationState, onStatsUpdate }: { children: ReactNode, simulationState: 'stopped' | 'paused' | 'running', setSimulationState: (s: 'stopped' | 'paused' | 'running') => void, onStatsUpdate: (servers: Server[], totalRequests: number) => void }) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [algorithm, _setAlgorithm] = useState('RR');
  const [requestRate, setRequestRate] = useState(5);
  const [isSimulationRunning, setIsSimulationRunning] = useState(false);
  const [totalRequests, setTotalRequests] = useState(0);
  const [movingRequests, setMovingRequests] = useState<MovingRequest[]>([]);
  
  const loadBalancerRef = useRef(new LoadBalancer());
  // @ts-ignore
  const intervalRef = useRef<any>(null);
  const requestIdRef = useRef(0);

  // Initialize with sample servers
  useEffect(() => {
    loadBalancerRef.current.servers = [];
    loadBalancerRef.current.weights = new Map();
    loadBalancerRef.current.currentIndex = 0;

    const initialServers = [
      new Server(1, 'Server-1', 3, 100, 800),
      new Server(2, 'Server-2', 2, 80, 1000),
      new Server(3, 'Server-3', 1, 120, 600)
    ];
    initialServers.forEach(server => {
      loadBalancerRef.current.addServer(server);
    });
    setServers([...loadBalancerRef.current.servers]);
  }, []);

  // Update algorithm
  useEffect(() => {
    loadBalancerRef.current.algorithm = algorithm;
  }, [algorithm]);

  // Traffic simulation
  useEffect(() => {
    if (isSimulationRunning) {
      intervalRef.current = setInterval(() => {
        const result = loadBalancerRef.current.distributeRequest();
        if (result.success && result.server) {
          setTotalRequests(prev => prev + 1);

          // Animate request
          const requestId = ++requestIdRef.current;
          const targetServer = servers.find(s => s.id === result.server!.id);
          if (targetServer) {
            const newRequest = {
              id: requestId,
              serverId: targetServer.id
            };
            setMovingRequests(prev => [...prev.slice(-MAX_ANIMATED_REQUESTS + 1), newRequest]);
            setTimeout(() => {
              setMovingRequests(prev => prev.filter(r => r.id !== requestId));
            }, 600);
          }
        }
        setServers([...loadBalancerRef.current.servers]);
        // Update stats for report
        onStatsUpdate([...loadBalancerRef.current.servers], totalRequests + 1);
      }, 1000 / requestRate);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isSimulationRunning, requestRate, servers]);

  // Also update stats when simulation is stopped
  useEffect(() => {
    if (simulationState === 'stopped') {
      onStatsUpdate([...loadBalancerRef.current.servers], totalRequests);
    }
    // eslint-disable-next-line
  }, [simulationState]);

  const addServer = (config: ServerConfig) => {
    const newServer = new Server(
      Date.now(),
      config.name,
      config.weight,
      config.maxConnections,
      config.processingTime
    );
    
    loadBalancerRef.current.addServer(newServer);
    setServers([...loadBalancerRef.current.servers]);
  };

  const removeServer = (serverId: number) => {
    loadBalancerRef.current.removeServer(serverId);
    setServers([...loadBalancerRef.current.servers]);
  };

  const toggleServer = (serverId: number) => {
    const server = loadBalancerRef.current.servers.find(s => s.id === serverId);
    if (server) {
      server.active = !server.active;
      setServers([...loadBalancerRef.current.servers]);
    }
  };

  const toggleSimulation = () => {
    setIsSimulationRunning(!isSimulationRunning);
  };

  // In LoadBalancerProvider, move the clearing logic to a new function
  const clearSimulationStats = () => {
    loadBalancerRef.current.servers.forEach(server => {
      server.currentConnections = 0;
      server.totalRequests = 0;
      server.totalResponseTime = 0;
      server.queue = [];
    });
    setServers([...loadBalancerRef.current.servers]);
    setMovingRequests([]);
  };

  const resetSimulation = () => {
    setIsSimulationRunning(false);
    setTotalRequests(0);
    setSimulationState('stopped');
    // Do not clear stats here!
  };

  const setAlgorithm = (alg: string) => {
    _setAlgorithm(alg);
    setIsSimulationRunning(false);
    // Do not reset stats here, only stop simulation
    setSimulationState('stopped');
  };

  const updateServer = (serverId: number, config: ServerConfig) => {
    const server = loadBalancerRef.current.servers.find(s => s.id === serverId);
    if (server) {
      server.name = config.name;
      server.weight = config.weight;
      server.maxConnections = config.maxConnections;
      server.processingTime = config.processingTime;
      server.originalWeight = config.weight;
      setServers([...loadBalancerRef.current.servers]);
    }
  };

  const value: LoadBalancerContextType = {
    servers,
    algorithm,
    setAlgorithm,
    requestRate,
    setRequestRate,
    isSimulationRunning,
    toggleSimulation,
    totalRequests,
    setTotalRequests,
    movingRequests,
    addServer,
    removeServer,
    toggleServer,
    resetSimulation,
    updateServer
  };

  return (
    <LoadBalancerContext.Provider value={value}>
      {children}
    </LoadBalancerContext.Provider>
  );
};

const useBeforeUnloadWarning = () => {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
};

// --- Simulation Report ---
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28BFE', '#FF6B6B'];

// Define type for perServer analytics
interface ServerAnalytics {
  name: string;
  totalRequests: number;
  avgResponse: number;
  maxConnections: number;
  weight: number;
}

function getReportAnalytics(servers: Server[], totalRequests: number) {
  if (!servers.length) return null;
  const mostTraffic = [...servers].sort((a, b) => b.totalRequests - a.totalRequests)[0];
  const leastTraffic = [...servers].sort((a, b) => a.totalRequests - b.totalRequests)[0];
  const avgResponse = servers.reduce((acc: number, s: Server) => acc + Number(s.getAverageResponseTime()), 0) / servers.length;
  return {
    totalRequests,
    avgResponse: avgResponse.toFixed(2),
    mostTraffic: { name: mostTraffic.name, count: mostTraffic.totalRequests },
    leastTraffic: { name: leastTraffic.name, count: leastTraffic.totalRequests },
    perServer: servers.map((s: Server): ServerAnalytics => ({
      name: s.name,
      totalRequests: s.totalRequests,
      avgResponse: Number(s.getAverageResponseTime()),
      maxConnections: s.maxConnections,
      weight: s.weight
    }))
  };
}

const SimulationReport = ({ servers, totalRequests, onClose }: { servers: Server[], totalRequests: number, onClose: () => void }) => {
  const analytics = getReportAnalytics(servers, totalRequests);
  if (!analytics) return null;

  // Download as JSON
  const handleDownload = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(analytics, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'simulation_report.json');
    dlAnchor.click();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, minWidth: 420, maxWidth: 700, boxShadow: '0 4px 32px rgba(0,0,0,0.18)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>&times;</button>
        <h2 style={{ marginBottom: 12 }}>Simulation Report</h2>
        <div style={{ marginBottom: 18 }}>
          <strong>Total Requests:</strong> {analytics.totalRequests}<br />
          <strong>Average Response Time:</strong> {analytics.avgResponse} ms<br />
          <strong>Server with Most Traffic:</strong> {analytics.mostTraffic.name} ({analytics.mostTraffic.count} requests)<br />
          <strong>Server with Least Traffic:</strong> {analytics.leastTraffic.name} ({analytics.leastTraffic.count} requests)
        </div>
        <div style={{ width: '100%', height: 220, marginBottom: 24 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.perServer}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalRequests" fill="#0088FE" name="Total Requests" />
              <Bar dataKey="avgResponse" fill="#FFBB28" name="Avg Response (ms)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ width: '100%', height: 220, marginBottom: 24 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={analytics.perServer} dataKey="totalRequests" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                {analytics.perServer.map((entry: ServerAnalytics, idx: number) => (
                  <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <button onClick={handleDownload} style={{ ...styles.button, ...styles.primaryButton, width: 180, fontSize: 16 }}>Download Report (JSON)</button>
      </div>
    </div>
  );
};

const LoadBalancerSimulator = () => {
  useBeforeUnloadWarning();
  // Manage simulation state at the top level
  const [simulationState, setSimulationState] = React.useState<'stopped' | 'paused' | 'running'>('stopped');
  const [showReport, setShowReport] = React.useState(false);
  const [showReportButtons, setShowReportButtons] = React.useState(false);
  const [hasSimulated, setHasSimulated] = React.useState(false);

  // Access stats from context
  const [servers, setServers] = React.useState<Server[]>([]);
  const [totalRequests, setTotalRequests] = React.useState<number>(0);
  // Store a snapshot for the report
  const [reportSnapshot, setReportSnapshot] = React.useState<{servers: Server[], totalRequests: number} | null>(null);

  // Listen for simulation stop to show report buttons and capture snapshot
  React.useEffect(() => {
    if (simulationState === 'stopped' && hasSimulated && servers.length > 0) {
      // Take a snapshot BEFORE reset
      setReportSnapshot({ servers: servers.map(s => Object.assign(Object.create(Object.getPrototypeOf(s)), s)), totalRequests });
      setShowReportButtons(true);
    } else if (simulationState === 'running') {
      setShowReportButtons(false);
      setShowReport(false);
      setReportSnapshot(null);
    }
  }, [simulationState, servers.length, hasSimulated]);

  // Track if a simulation has ever run
  React.useEffect(() => {
    if (simulationState === 'running') {
      setHasSimulated(true);
    }
  }, [simulationState]);

  // Provide a way for LoadBalancerProvider to update stats for report
  const handleStatsUpdate = (srv: Server[], total: number) => {
    setServers(srv);
    setTotalRequests(total);
  };

  // In LoadBalancerSimulator, define a function to get the real stats from the LoadBalancer instance
  const getCurrentStats = () => {
    // @ts-ignore
    const lb = (window as any).loadBalancerRefInstance;
    if (lb) {
      return {
        servers: lb.servers.map((s: Server) => Object.assign(Object.create(Object.getPrototypeOf(s)), s)),
        totalRequests: lb.servers.reduce((acc: number, s: Server) => acc + s.totalRequests, 0)
      };
    }
    return { servers: [], totalRequests: 0 };
  };
  // Pass getCurrentStats to ControlPanel

  const handleDownload = () => {
    if (!reportSnapshot) return;
    const analytics = getReportAnalytics(reportSnapshot.servers, reportSnapshot.totalRequests);
    if (!analytics) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(analytics, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'simulation_report.json');
    dlAnchor.click();
  };

  const handleCloseReport = () => {
    setShowReport(false);
    setShowReportButtons(false);
    setShouldClearStats(true);
  };

  const [shouldClearStats, setShouldClearStats] = React.useState(false);

  React.useEffect(() => {
    if (shouldClearStats) {
      // @ts-ignore
      if (window.loadBalancerRefInstance && window.loadBalancerRefInstance.clearSimulationStats) {
        window.loadBalancerRefInstance.clearSimulationStats();
      }
      setShouldClearStats(false);
    }
  }, [shouldClearStats]);

  return (
    <LoadBalancerProvider simulationState={simulationState} setSimulationState={setSimulationState} onStatsUpdate={handleStatsUpdate}>
      <div style={styles.container}>
        <ControlPanel simulationState={simulationState} setSimulationState={setSimulationState} />
        <VisualizationCanvas />
        <StatsPanel />
        {showReportButtons && reportSnapshot && (
          <div style={{ position: 'fixed', bottom: 32, left: 0, width: '100vw', display: 'flex', justifyContent: 'center', zIndex: 100 }}>
            <button style={{ ...styles.button, ...styles.primaryButton, fontSize: 16, marginRight: 12 }} onClick={() => setShowReport(true)}>
              View Report
            </button>
            <button style={{ ...styles.button, ...styles.primaryButton, fontSize: 16 }} onClick={handleDownload}>
              Download Report
            </button>
          </div>
        )}
        {showReport && reportSnapshot && (
          <SimulationReport servers={reportSnapshot.servers} totalRequests={reportSnapshot.totalRequests} onClose={handleCloseReport} />
        )}
      </div>
    </LoadBalancerProvider>
  );
};

export default LoadBalancerSimulator;