import React from 'react';
import { createRoot } from 'react-dom/client';
import LoadBalancerSimulator from './rr-load-balancer';

const root = createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><LoadBalancerSimulator /></React.StrictMode>); 