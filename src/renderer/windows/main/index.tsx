import React from 'react';
import { createRoot } from 'react-dom/client';
import { ComponentGallery } from '../../components/gallery';
import { startWindowLagMonitor } from '../../lag-monitor';

startWindowLagMonitor();

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ComponentGallery />
    </React.StrictMode>
  );
}
