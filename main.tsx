import React from 'react'
import ReactDOM from 'react-dom/client'
import { EnhancedLoadBalancerSimulator } from './src/EnhancedLoadBalancerSimulator'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EnhancedLoadBalancerSimulator />
  </React.StrictMode>,
) 