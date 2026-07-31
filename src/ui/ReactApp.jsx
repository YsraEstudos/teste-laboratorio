import React from 'react';
import { HUD } from './components/HUD.jsx';

export function ReactApp() {
  return (
    <div
      className="react-overlay-root"
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}
    >
      <HUD />
    </div>
  );
}
