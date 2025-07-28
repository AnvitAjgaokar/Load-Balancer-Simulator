import React from 'react'
import ReactDOM from 'react-dom/client'
import { EnhancedLoadBalancerSimulator } from './src/EnhancedLoadBalancerSimulator'
import { ErrorBoundary } from './src/components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <EnhancedLoadBalancerSimulator />
    </ErrorBoundary>
  </React.StrictMode>,
) 