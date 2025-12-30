/**
 * React renderer entry point.
 * Uses React 19 with StrictMode for development checks.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/globals.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found. Check index.html has <div id="root">');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
