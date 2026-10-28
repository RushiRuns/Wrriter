import React from 'react';
import { createRoot } from 'react-dom/client';
import { CaptureWindow } from './CaptureWindow';
import { startWindowLagMonitor } from '../../lag-monitor';
import '../../styles/tokens.css';
import '../../styles/components.css';

startWindowLagMonitor();

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <CaptureWindow />
    </React.StrictMode>
  );
}
