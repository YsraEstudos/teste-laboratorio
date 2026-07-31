import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReactApp } from './ReactApp.jsx';

/**
 * Mounts the React UI (HUD, settings panel) on #react-root during real game
 * boot. Safe to import in node tests: DOM access happens only when called,
 * and a missing root is a silent no-op.
 */
export function mountReactApp() {
  const rootElement = document.getElementById('react-root');
  if (!rootElement) return;
  createRoot(rootElement).render(React.createElement(ReactApp));
}
