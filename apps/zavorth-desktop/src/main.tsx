import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { KaelOverlayApp } from './kael-overlay/KaelOverlayApp';
import './styles.css';
import './styles/design-system.css';
import './styles/right-rail.css';
import './styles/premium-shell.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Zavorth desktop root element was not found.');
}

const isOverlay = new URLSearchParams(window.location.search).get('win') === 'overlay';

createRoot(rootElement).render(
  <React.StrictMode>
    {isOverlay ? <KaelOverlayApp /> : <App />}
  </React.StrictMode>,
);

