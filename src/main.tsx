import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { installTauriBridgeIfPresent } from './adapters/tauriBridge';

// Install the Tauri bridge BEFORE React mounts so the factory's
// feature detection sees window.rpgBridge during the first render.
installTauriBridgeIfPresent().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
